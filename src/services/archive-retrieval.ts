import type { PipelineStatus } from '../types/archive.ts';
import {
  analyzeQuery,
  buildGroundedAnswer,
  keywordSearch,
  mergeHybridCandidates,
  rerankAndVerify,
  validateCitationResults,
  type EntityLabel,
  type GroundedAnswer,
  type IndexedPage,
  type KeywordIndex,
  type QueryAnalysis,
  type QueryContext,
  type EvidenceResult,
  type SourceDocument,
} from '../knowledge/hybrid.ts';
import { embed, manifest, model, rank, type Model, type Volume } from '../knowledge/semantic.ts';

export type ArchiveResearchResponse = {
  analysis: QueryAnalysis;
  answer: GroundedAnswer;
  results: EvidenceResult[];
  trace: {
    elapsedMs: number;
    indexedDocuments: number;
    keywordPages: number;
    vectorPages: number;
    semanticCandidates: number;
    keywordCandidates: number;
    mergedCandidates: number;
    verifiedCitations: number;
    privateUploadCandidates: number;
  };
};

type TimelineEntities = { events?: { entities?: EntityLabel[] }[] };
type GraphEntities = { nodes?: EntityLabel[] };
let keywordIndexPromise: Promise<KeywordIndex> | null = null;
let entityCatalogPromise: Promise<EntityLabel[]> | null = null;

async function compressedJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal });
  if (!response.ok || !response.body) throw new Error(`The indexed archive resource ${path} is unavailable.`);
  const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text()) as T;
}

function keywordIndex(signal?: AbortSignal) {
  return keywordIndexPromise ??= compressedJson<KeywordIndex>('/corpus/keyword-index.bin', signal).catch((error) => {
    keywordIndexPromise = null;
    throw error;
  });
}

function entityCatalog(signal?: AbortSignal) {
  return entityCatalogPromise ??= Promise.all([
    compressedJson<GraphEntities>('/corpus/graph.bin', signal),
    fetch('/corpus/timeline.json', { signal }).then(async (response) => {
      if (!response.ok) throw new Error('The generated event index is unavailable.');
      return response.json() as Promise<TimelineEntities>;
    }),
  ]).then(([graph, timeline]) => [
    ...(graph.nodes ?? []),
    ...(timeline.events ?? []).flatMap((event) => event.entities ?? []),
  ]).catch((error) => {
    entityCatalogPromise = null;
    throw error;
  });
}

async function loadRequestedPages(documentId: string, requested: Set<number>, signal?: AbortSignal): Promise<Map<number, IndexedPage & { pageNumber: number }>> {
  const volume = await compressedJson<{ pages: (IndexedPage & { pageNumber: number })[] }>(`/corpus/${encodeURIComponent(documentId)}.bin`, signal);
  const pages = new Map<number, IndexedPage & { pageNumber: number }>();
  for (const pageNumber of requested) {
    const page = volume.pages[pageNumber - 1];
    if (page && page.pageNumber === pageNumber) pages.set(pageNumber, page);
  }
  return pages;
}

const checkAbort = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException('Retrieval cancelled.', 'AbortError');
};

type PrivateUploadResult = {
  documentId: string; pageNumber: number; score: number; semanticScore: number; keywordScore: number; preliminaryScore: number;
  excerpt: string; method: string; printedPage: string | null; section: string | null; title: string; filename: string;
  pageCount: number; source: string; matchedTerms: string[]; trace: EvidenceResult['trace'];
  versionId: string; sha256: string;
};

async function retrievePrivateUploads(analysis: QueryAnalysis, vector: number[], signal?: AbortSignal) {
  try {
    const response = await fetch('/api/archive/search', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: analysis.rawQuery,
        normalizedQuery: analysis.normalizedQuery,
        terms: analysis.terms,
        entities: analysis.entities,
        vector,
      }),
    });
    if (!response.ok) return { results: [] as EvidenceResult[], candidateCount: 0 };
    const data = await response.json() as { results?: PrivateUploadResult[]; candidateCount?: number };
    const results = (data.results ?? []).flatMap((item): EvidenceResult[] => {
      if (!item.documentId || !Number.isInteger(item.pageNumber) || item.pageNumber < 1 || item.pageNumber > item.pageCount
        || !item.title || !item.filename || !item.excerpt?.trim() || !['NATIVE_TEXT', 'OCR'].includes(item.method)) return [];
      const document: SourceDocument = {
        id: item.documentId, title: item.title, filename: item.filename, source: item.source || 'PRIVATE UPLOAD',
        pageCount: item.pageCount, pdfUrl: `/api/archive/source/${encodeURIComponent(item.documentId)}`,
        versionId: item.versionId, sha256: item.sha256,
      };
      return [{
        documentId: item.documentId, pageNumber: item.pageNumber, document,
        semanticScore: item.semanticScore, keywordScore: item.keywordScore, preliminaryScore: item.preliminaryScore,
        excerpt: item.excerpt, method: item.method, printedPage: item.printedPage,
        score: item.score, support: item.score >= 0.56 ? 'HIGH SOURCE SUPPORT' : 'MODERATE SOURCE SUPPORT',
        matchedTerms: item.matchedTerms ?? [], citation: {
          documentId: item.documentId, documentTitle: item.title, filename: item.filename,
          pageNumber: item.pageNumber, method: item.method, source: item.source || 'PRIVATE UPLOAD',
          versionId: item.versionId, sha256: item.sha256,
        },
        trace: item.trace,
      }];
    });
    return { results, candidateCount: data.candidateCount ?? 0 };
  } catch (error) {
    if (signal?.aborted) throw error;
    // A signed-in archive can search private uploads; anonymous readers retain
    // the same supplied-source retrieval path when no private index is present.
    return { results: [] as EvidenceResult[], candidateCount: 0 };
  }
}

function report(progress: (status: PipelineStatus) => void, stage: number, label: string, complete = false) {
  progress({ stage, label, complete });
}

async function focusedDateEvidence(query: QueryAnalysis, index: KeywordIndex, documents: (Volume & {pdfUrl:string})[], signal?: AbortSignal) {
  if (query.intent !== 'DATE SEARCH' || !query.terms.includes('ambedkar')) return {evidence:[] as EvidenceResult[],pages:new Map<string,IndexedPage & {pageNumber:number}>()};
  const actions = /\b(born|birth)\b/i.test(query.rawQuery) ? ['born','birth']
    : /\b(died|death)\b/i.test(query.rawQuery) ? ['died','death'] : [];
  if (!actions.length) return {evidence:[] as EvidenceResult[],pages:new Map<string,IndexedPage & {pageNumber:number}>()};
  const anchor = new Map(index.postings.ambedkar || []);
  const predicate = new Map<number,number>();
  for (const term of actions) for (const [page, frequency] of index.postings[term] || []) predicate.set(page,(predicate.get(page)||0)+frequency);
  const byId = new Map(documents.map(document=>[document.id,document]));
  const locations = [...predicate].filter(([page])=>anchor.has(page)).map(([page,frequency])=>{
    const [documentId,pageNumber]=index.pageLocations[page],document=byId.get(documentId);
    const length=index.pageLengths[page]||1000;
    return {document,pageNumber,score:(Math.min(2,anchor.get(page)!) + 3*Math.min(2,frequency))/Math.log2(10+length)+(documentId.startsWith('VOL-')?.3:0)};
  }).filter((item):item is {document:Volume&{pdfUrl:string};pageNumber:number;score:number}=>!!item.document)
    .sort((a,b)=>b.score-a.score).slice(0,24);
  const pageRequests=new Map<string,Set<number>>();
  for(const item of locations){const pages=pageRequests.get(item.document.id)||new Set<number>();pages.add(item.pageNumber);pageRequests.set(item.document.id,pages)}
  const pages=new Map<string,IndexedPage & {pageNumber:number}>();
  for(const [documentId,requested] of pageRequests){checkAbort(signal);const loaded=await loadRequestedPages(documentId,requested,signal);for(const [pageNumber,page] of loaded)pages.set(`${documentId}:${pageNumber}`,page)}
  const candidates=locations.map(item=>({documentId:item.document.id,pageNumber:item.pageNumber,document:item.document,semanticScore:0,keywordScore:item.score,preliminaryScore:item.score}));
  return {evidence:validateCitationResults(rerankAndVerify(query,candidates,(documentId,pageNumber)=>pages.get(`${documentId}:${pageNumber}`),24),documents),pages};
}

export async function researchArchive(
  rawQuery: string,
  progress: (status: PipelineStatus) => void,
  signal?: AbortSignal,
  context?: QueryContext,
): Promise<ArchiveResearchResponse> {
  const started = performance.now();
  report(progress, 0, 'LOADING THE PDF PAGE INDEX, EMBEDDINGS AND KEYWORD INDEX');
  const [volumes, vectorModel, index, entities] = await Promise.all([
    manifest(), model(), keywordIndex(signal), entityCatalog(signal),
  ]) as [Volume[], Model, KeywordIndex, EntityLabel[]];
  const documents = volumes.map((volume) => ({
    ...volume,
    pdfUrl: volume.delivery === 'R2'
      ? `/api/archive/supplied?documentId=${encodeURIComponent(volume.id)}`
      : `/api/archive/supplied?documentId=${encodeURIComponent(volume.id)}`,
  }));
  checkAbort(signal);

  report(progress, 1, 'NORMALIZING SPELLING, INTENT AND ENTITIES');
  const analysis = analyzeQuery(rawQuery, vectorModel.vocabulary, documents, entities, context);
  checkAbort(signal);

  if (analysis.scope === 'UNRELATED') {
    const answer = buildGroundedAnswer(analysis, []);
    report(progress, 5, 'QUERY OUTSIDE THE AMBEDKAR ARCHIVE SCOPE', true);
    return {
      analysis, answer, results: [],
      trace: {
        elapsedMs: Math.round(performance.now() - started), indexedDocuments: documents.length,
        keywordPages: index.pageLocations.length, vectorPages: vectorModel.pageLocations.length,
        semanticCandidates: 0, keywordCandidates: 0, mergedCandidates: 0, verifiedCitations: 0, privateUploadCandidates: 0,
      },
    };
  }

  report(progress, 2, 'SEARCHING SEMANTIC VECTORS AND PAGE KEYWORDS');
  const queryVector = embed(analysis.semanticQuery, vectorModel);
  const semanticHits = rank(queryVector, vectorModel, documents, 120).map(({ documentId, pageNumber, score }) => ({ documentId, pageNumber, score }));
  const keywordHits = keywordSearch(analysis, index, 120);
  const candidates = mergeHybridCandidates(semanticHits, keywordHits, documents, analysis, 180);
  checkAbort(signal);

  report(progress, 3, 'RERANKING PAGE PASSAGES AND SOURCE QUALITY');
  const pageRequests = new Map<string, Set<number>>();
  const allowedDocuments = new Set<string>();
  for (const candidate of candidates) {
    if (!allowedDocuments.has(candidate.documentId) && allowedDocuments.size >= 6) continue;
    allowedDocuments.add(candidate.documentId);
    const requested = pageRequests.get(candidate.documentId) ?? new Set<number>();
    requested.add(candidate.pageNumber);
    pageRequests.set(candidate.documentId, requested);
  }
  const pageData = new Map<string, IndexedPage & { pageNumber: number }>();
  for (const [documentId, requested] of pageRequests) {
    checkAbort(signal);
    const pages = await loadRequestedPages(documentId, requested, signal);
    for (const [pageNumber, page] of pages) pageData.set(`${documentId}:${pageNumber}`, page);
  }
  const allowedCandidates = candidates.filter((candidate) => allowedDocuments.has(candidate.documentId));
  const reranked = rerankAndVerify(analysis, allowedCandidates, (documentId, pageNumber) => pageData.get(`${documentId}:${pageNumber}`), 8);
  const privateUploads = await retrievePrivateUploads(analysis, queryVector, signal);
  checkAbort(signal);
  const uploadDocuments = privateUploads.results.map((item) => item.document);
  let results = validateCitationResults([...reranked, ...privateUploads.results], [...documents, ...uploadDocuments])
    .sort((left, right) => right.score - left.score)
    .filter((item, index, all) => all.findIndex((candidate) => candidate.documentId === item.documentId && candidate.pageNumber === item.pageNumber) === index)
    .slice(0, 8);
  checkAbort(signal);

  report(progress, 4, 'CHECKING PAGE NUMBERS, PASSAGES AND CITATION METADATA');
  let answer = buildGroundedAnswer(analysis, results, (documentId, pageNumber) => pageData.get(`${documentId}:${pageNumber}`)?.text);
  if(answer.status==='INSUFFICIENT SOURCE SUPPORT' && analysis.intent==='DATE SEARCH'){
    const focused=await focusedDateEvidence(analysis,index,documents,signal);
    const combined=[...focused.evidence,...results].filter((item,i,all)=>all.findIndex(other=>other.documentId===item.documentId&&other.pageNumber===item.pageNumber)===i);
    const next=buildGroundedAnswer(analysis,combined,(documentId,pageNumber)=>(focused.pages.get(`${documentId}:${pageNumber}`)||pageData.get(`${documentId}:${pageNumber}`))?.text);
    if(next.status==='SUPPORTED'){
      answer=next;
      results=[...combined.filter(item=>answer.claims.some(claim=>claim.documentId===item.documentId&&claim.pageNumber===item.pageNumber)),...results]
        .filter((item,i,all)=>all.findIndex(other=>other.documentId===item.documentId&&other.pageNumber===item.pageNumber)===i).slice(0,8);
    }
  }
  report(progress, 5, 'SOURCE-GROUNDED RESPONSE READY', true);
  return {
    analysis,
    answer,
    results,
    trace: {
      elapsedMs: Math.round(performance.now() - started),
      indexedDocuments: documents.length,
      keywordPages: index.pageLocations.length,
      vectorPages: vectorModel.pageLocations.length,
      semanticCandidates: semanticHits.length,
      keywordCandidates: keywordHits.length,
      mergedCandidates: candidates.length,
      verifiedCitations: results.length,
      privateUploadCandidates: privateUploads.candidateCount,
    },
  };
}
