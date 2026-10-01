import { env } from '@/src/server/platform-env';

export const runtime = 'nodejs';

type RequestBody = {
  query: string;
  normalizedQuery: string;
  terms: string[];
  entities: { label: string; type: string }[];
  vector: number[];
};

type CandidateRow = {
  chunkId: string;
  documentId: string;
  pageNumber: number;
  chunkText: string;
  pageText: string;
  embedding: string;
  method: string;
  confidence: number | null;
  section: string | null;
  title: string;
  filename: string;
  pageCount: number;
  version: number;
  versionId: string;
  sha256: string;
  vectorScore?: number;
};

const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const words = (value: string) => normalize(value).split(' ').filter(Boolean);

function validRequest(value: unknown): value is RequestBody {
  if (!value || typeof value !== 'object') return false;
  const body = value as Partial<RequestBody>;
  return typeof body.query === 'string' && body.query.length >= 2 && body.query.length <= 500
    && typeof body.normalizedQuery === 'string' && body.normalizedQuery.length <= 800
    && Array.isArray(body.terms) && body.terms.length <= 64 && body.terms.every((term) => typeof term === 'string' && term.length <= 80)
    && Array.isArray(body.entities) && body.entities.length <= 32 && body.entities.every((entity) => !!entity && typeof entity.label === 'string' && entity.label.length <= 180 && typeof entity.type === 'string')
    && Array.isArray(body.vector) && body.vector.length === 48 && body.vector.every(Number.isFinite);
}

function safeEmbedding(value: string) {
  try {
    const embedding = JSON.parse(value) as unknown;
    return Array.isArray(embedding) && embedding.length === 48 && embedding.every(Number.isFinite) ? embedding as number[] : null;
  } catch { return null; }
}

export async function POST(req: Request) {
  if (!env.DB) return Response.json({ results: [] }, { status: 503 });

  let body: unknown;
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid search request.' }, { status: 400 }); }
  if (!validRequest(body)) return Response.json({ error: 'Invalid search request.' }, { status: 400 });

  const terms = [...new Set(body.terms.map((term) => normalize(term)).filter((term) => term.length >= 3 && /^[\p{L}\p{M}\p{N}]+$/u.test(term)))].slice(0, 24);
  const entities = body.entities.filter((entity) => ['PERSON', 'DOCUMENT', 'BOOK', 'SPEECH', 'EVENT', 'ORGANIZATION', 'PLACE', 'CONCEPT', 'MOVEMENT'].includes(entity.type));
  const documents = await env.DB.prepare("SELECT count(*) AS count FROM archive_documents d JOIN archive_document_versions vv ON vv.record_id=d.id WHERE d.status='READY' AND vv.approval_status='PUBLISHED' AND vv.verification_status='VERIFIED' AND vv.security_scan_status='PASSED'").first<{ count: number }>();
  const totalChunks = await env.DB.prepare("SELECT count(*) AS count FROM archive_chunks c JOIN archive_documents d ON d.id=c.document_id JOIN archive_document_versions vv ON vv.record_id=d.id WHERE d.status='READY' AND vv.approval_status='PUBLISHED' AND vv.verification_status='VERIFIED' AND vv.security_scan_status='PASSED'").first<{ count: number }>();
  const candidates = new Map<string, CandidateRow>();
  const vectorDimensions = body.vector.map((weight, dimension) => ({ weight, dimension })).filter((item) => Math.abs(item.weight) > 0.0001).sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)).slice(0, 12);

  if (vectorDimensions.length) {
    const sql = `SELECT c.id AS chunkId,c.document_id AS documentId,c.page_number AS pageNumber,c.text AS chunkText,c.embedding_json AS embedding,p.text AS pageText,p.method,p.confidence,p.section,d.title,d.filename,d.page_count AS pageCount,d.version,vv.id AS versionId,vv.sha256,SUM(v.weight*(CASE v.dimension ${vectorDimensions.map(() => 'WHEN ? THEN ?').join(' ')} ELSE 0 END)) AS vectorScore FROM archive_vector_postings v JOIN archive_chunks c ON c.id=v.chunk_id JOIN archive_documents d ON d.id=c.document_id JOIN archive_document_versions vv ON vv.record_id=d.id JOIN archive_pages p ON p.id=c.page_id WHERE v.dimension IN (${vectorDimensions.map(() => '?').join(',')}) AND d.status='READY' AND vv.approval_status='PUBLISHED' AND vv.verification_status='VERIFIED' AND vv.security_scan_status='PASSED' GROUP BY c.id,c.document_id,c.page_number,c.text,c.embedding_json,p.text,p.method,p.confidence,p.section,d.title,d.filename,d.page_count,d.version,vv.id,vv.sha256 ORDER BY "vectorScore" DESC LIMIT 240`;
    const rows = await env.DB.prepare(sql).bind(...vectorDimensions.flatMap((item) => [item.dimension, item.weight]), ...vectorDimensions.map((item) => item.dimension)).all<CandidateRow>();
    for (const row of rows.results) {
      const embedding = safeEmbedding(row.embedding);
      if (!embedding) continue;
      const vectorScore = body.vector.reduce((sum, weight, index) => sum + weight * (embedding[index] || 0), 0);
      candidates.set(row.chunkId, { ...row, vectorScore });
    }
  }

  // The owner's private corpus is small enough to query directly; the shared
  // supplied archive uses its prebuilt inverted keyword index in the caller.
  if (terms.length) {
    const clauses = terms.map(() => 'lower(c.text) LIKE ?').join(' OR ');
    const rows = await env.DB.prepare(`SELECT c.id AS chunkId,c.document_id AS documentId,c.page_number AS pageNumber,c.text AS chunkText,c.embedding_json AS embedding,p.text AS pageText,p.method,p.confidence,p.section,d.title,d.filename,d.page_count AS pageCount,d.version,vv.id AS versionId,vv.sha256 FROM archive_chunks c JOIN archive_documents d ON d.id=c.document_id JOIN archive_document_versions vv ON vv.record_id=d.id JOIN archive_pages p ON p.id=c.page_id WHERE d.status='READY' AND vv.approval_status='PUBLISHED' AND vv.verification_status='VERIFIED' AND vv.security_scan_status='PASSED' AND (${clauses}) LIMIT 500`).bind(...terms.map((term) => `%${term}%`)).all<CandidateRow>();
    for (const row of rows.results) {
      const existing = candidates.get(row.chunkId);
      candidates.set(row.chunkId, existing ? { ...existing, ...row } : row);
    }
  }

  if (!candidates.size) return Response.json({ results: [], candidateCount: 0 });
  const candidateValues = [...candidates.values()];
  const vectorMax = Math.max(0.001, ...candidateValues.map((row) => row.vectorScore || 0));
  const averageLength = candidateValues.reduce((sum, row) => sum + words(row.chunkText).length, 0) / candidateValues.length || 1;
  const documentFrequency = new Map(terms.map((term) => [term, candidateValues.filter((row) => new Set(words(row.chunkText)).has(term)).length]));
  const ranked = candidateValues.flatMap((row) => {
    const passageWords = words(row.chunkText);
    const passageSet = new Set(passageWords);
    const matchedTerms = terms.filter((term) => passageSet.has(term));
    const coverage = terms.length ? matchedTerms.length / terms.length : 0;
    const rawKeyword = matchedTerms.reduce((score, term) => {
      const frequency = passageWords.filter((word) => word === term).length;
      const df = documentFrequency.get(term) || 0;
      const inverse = Math.log(1 + ((totalChunks?.count || candidateValues.length) - df + 0.5) / (df + 0.5));
      const length = passageWords.length || averageLength;
      const normalizer = frequency + 1.2 * (0.25 + 0.75 * length / averageLength);
      return score + inverse * frequency * 2.2 / normalizer;
    }, 0);
    const compactText = normalize(row.chunkText);
    const phrase = body.normalizedQuery.length > 5 && compactText.includes(normalize(body.normalizedQuery));
    const metadata = normalize(`${row.title} ${row.filename}`);
    const metadataCoverage = terms.length ? terms.filter((term) => metadata.includes(term)).length / terms.length : 0;
    const entityMatch = entities.length ? entities.filter((entity) => normalize(`${row.pageText} ${row.title}`).includes(normalize(entity.label))).length / entities.length : 0;
    return [{ row, matchedTerms, coverage, phrase, rawKeyword, vector: Math.max(0, row.vectorScore || 0) / vectorMax, metadataCoverage, entityMatch }];
  });
  const keywordMax = Math.max(0.001, ...ranked.map((item) => item.rawKeyword));
  const results = ranked.map((item) => {
    const keyword = item.rawKeyword / keywordMax;
    const semantic = item.vector;
    const semanticWeight = semantic && keyword ? 0.45 : semantic ? 0.68 : 0;
    const keywordWeight = semantic && keyword ? 0.38 : keyword ? 0.84 : 0;
    const score = Math.max(0, Math.min(1, semanticWeight * semantic + keywordWeight * keyword + 0.2 * item.coverage + 0.08 * item.entityMatch + 0.07 * item.metadataCoverage + (item.phrase ? 0.18 : 0)));
    const sufficient = item.phrase || (item.coverage >= (terms.length <= 1 ? 1 : 0.5) && (semantic >= 0.12 || keyword >= 0.12));
    if (!sufficient || !['NATIVE_TEXT', 'OCR'].includes(item.row.method) || !item.row.chunkText.trim()) return null;
    return {
      documentId: item.row.documentId,
      pageNumber: item.row.pageNumber,
      score,
      semanticScore: semantic,
      keywordScore: keyword,
      preliminaryScore: score,
      excerpt: item.row.chunkText.slice(0, 520),
      method: item.row.method,
      printedPage: null,
      section: item.row.section,
      title: item.row.title,
      filename: item.row.filename,
      pageCount: item.row.pageCount,
      version: item.row.version,
      versionId: item.row.versionId,
      sha256: item.row.sha256,
      source: 'PUBLISHED ARCHIVAL SOURCE',
      matchedTerms: item.matchedTerms,
      support: score >= 0.56 ? 'HIGH SOURCE SUPPORT' : 'MODERATE SOURCE SUPPORT',
      trace: { semantic, keyword, passageCoverage: item.coverage, phraseMatch: item.phrase, entityMatch: item.entityMatch, sourcePriority: 0 },
    };
  }).filter((row): row is NonNullable<typeof row> => !!row)
    .sort((a, b) => b.score - a.score)
    .filter((row, index, all) => all.findIndex((item) => item.documentId === row.documentId && item.pageNumber === row.pageNumber) === index)
    .slice(0, 40);

  return Response.json({ results, candidateCount: candidateValues.length, indexedDocuments: documents?.count || 0 });
}
