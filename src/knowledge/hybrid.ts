export type SourceDocument = {
  id: string;
  title: string;
  filename: string;
  source: string;
  pdfUrl?: string;
  pageCount: number;
  sha256?: string;
  versionId?: string;
  extraction?: { native: number; ocr: number; unreadable: number };
};

export type KeywordIndex = {
  schemaVersion: number;
  pageLocations: [string, number][];
  pageMethods: string[];
  pageLengths: number[];
  averagePageLength: number;
  termCount: number;
  postings: Record<string, [number, number][]>;
};

export type EntityLabel = { label: string; type: string };
export type Correction = { from: string; to: string; kind: 'TYPO' | 'TRANSLITERATION' | 'ALIAS' };
export type QueryIntent = 'FACTUAL QUESTION' | 'DOCUMENT SEARCH' | 'PERSON SEARCH' | 'EVENT SEARCH' | 'QUOTE SEARCH' | 'DATE SEARCH' | 'CONCEPT EXPLANATION' | 'COMPARISON' | 'SUMMARY' | 'SOURCE LOOKUP';
export type QueryContext = { previousQuery?: string; entities?: string[]; documentTitles?: string[] };
export type QueryAnalysis = {
  rawQuery: string;
  normalizedQuery: string;
  semanticQuery: string;
  terms: string[];
  corrections: Correction[];
  intent: QueryIntent;
  entities: EntityLabel[];
  scope: 'AMBEDKAR_RELATED' | 'UNRELATED' | 'UNCLEAR';
  contextApplied: boolean;
  trace: { originalTerms: string[]; expandedTerms: string[]; matchedEntities: string[] };
};

export type RetrievalHit = { documentId: string; pageNumber: number; score: number };
export type HybridCandidate = {
  documentId: string;
  pageNumber: number;
  document: SourceDocument;
  semanticScore: number;
  keywordScore: number;
  preliminaryScore: number;
};
export type EvidenceResult = HybridCandidate & {
  excerpt: string;
  method: string;
  printedPage: string | null;
  score: number;
  support: 'HIGH SOURCE SUPPORT' | 'MODERATE SOURCE SUPPORT';
  matchedTerms: string[];
  citation: { documentId: string; documentTitle: string; filename: string; pageNumber: number; method: string; source: string; sha256?: string; versionId?: string };
  trace: { semantic: number; keyword: number; passageCoverage: number; phraseMatch: boolean; entityMatch: number; sourcePriority: number };
};

const stopWords = new Set('a an and are as at be been being by can could did do does for from had has have he her hers him his how i in into is it its me might more most my of on or our she should so than that the their them then there these they this those to too was we were what when where which who why will with would you your ke ka ki ko ne mein me mai hai hain ho tha thi kya kyu kaise bare baare cha che baddal vishayi ने के कि को में क्या है था थी बारे कब कौन कैसे'.split(' '));
const wordAliases: Record<string, string[]> = {
  ambedker: ['ambedkar'], ambedkr: ['ambedkar'], ambedkarji: ['ambedkar'], babasaheb: ['ambedkar'], bhimrao: ['ambedkar'],
  gandhiji: ['gandhi'], annihlation: ['annihilation'], anhilition: ['annihilation'], annihilaton: ['annihilation'], cast: ['caste'], hitakrini: ['hitakarini'], hitakari: ['hitakarini'],
  samajik: ['social'], samaj: ['social'], vichar: ['thought', 'ideas'], soch: ['thought'], kaha: ['said'], kehte: ['said'],
  shiksha: ['education'], shikshan: ['education'], samvidhan: ['constitution'], sanvidhan: ['constitution'], bhashan: ['speech'],
  'अंबेडकर': ['ambedkar'], 'आंबेडकर': ['ambedkar'], 'भीमराव': ['ambedkar'], 'जाति': ['caste'], 'जात': ['caste'],
  'संविधान': ['constitution'], 'सामाजिक': ['social'], 'समाज': ['social'], 'विचार': ['thought', 'ideas'],
  'शिक्षा': ['education'], 'शिक्षण': ['education'], 'भाषण': ['speech'], 'लिखा': ['wrote'], 'कहा': ['said'], 'कब': ['when'],
  'आंबेडकरांचे': ['ambedkar'], 'जाती': ['caste'],
};
const semanticSynonyms: Record<string, string[]> = {
  caste: ['caste', 'castes'], castes: ['castes', 'caste'], labour: ['labour', 'labor'], labor: ['labor', 'labour'],
  constitution: ['constitution', 'constitutional'], constitutional: ['constitutional', 'constitution'],
  idea: ['idea', 'ideas', 'thought'], ideas: ['ideas', 'thought'], thought: ['thought', 'ideas'],
  writing: ['writing', 'writings'], writings: ['writings', 'writing'], speech: ['speech', 'speeches', 'address'],
  speeches: ['speeches', 'speech', 'address'], said: ['said', 'speech', 'wrote'],
};
const domainTerms = new Set('ambedkar bhimrao babasaheb caste castes annihilation bahishkrit hitakarini sabha constitution constitutional constituent assembly buddha buddhism mahad poona pact satyagraha shudras untouchability dalit depressed scheduled federation hindu code bill labour labor equality education rights writings speeches gandhi nehru'.split(' '));
const phraseRules: [RegExp, string, Correction['kind']][] = [
  [/\bannihilation\s+of\s+cast\b/giu, 'annihilation of caste', 'TYPO'],
  [/\bbahishkrit\s+hitakrini\s+sabha\b/giu, 'bahishkrit hitakarini sabha', 'TYPO'],
];
const normalized = (value: string) => value.normalize('NFKC').toLocaleLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const tokens = (value: string) => normalized(value).split(' ').filter(Boolean);
const normalizedAscii = (value: string) => normalized(value).normalize('NFKD').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

function jaroWinkler(left: string, right: string) {
  if (left === right) return 1;
  if (!left || !right) return 0;
  const range = Math.max(0, Math.floor(Math.max(left.length, right.length) / 2) - 1);
  const leftMatched = Array(left.length).fill(false) as boolean[];
  const rightMatched = Array(right.length).fill(false) as boolean[];
  let matches = 0;
  for (let i = 0; i < left.length; i++) {
    for (let j = Math.max(0, i - range); j < Math.min(i + range + 1, right.length); j++) {
      if (rightMatched[j] || left[i] !== right[j]) continue;
      leftMatched[i] = true;
      rightMatched[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;
  const leftSequence = left.split('').filter((_, index) => leftMatched[index]);
  const rightSequence = right.split('').filter((_, index) => rightMatched[index]);
  let transpositions = 0;
  for (let i = 0; i < matches; i++) if (leftSequence[i] !== rightSequence[i]) transpositions++;
  const jaro = (matches / left.length + matches / right.length + (matches - transpositions / 2) / matches) / 3;
  let prefix = 0;
  while (prefix < Math.min(4, left.length, right.length) && left[prefix] === right[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

function noisyForms(word: string) {
  const original = normalizedAscii(word).replace(/ /g, '');
  if (!original) return [];
  const forms = new Set([original]);
  const collapseOne = original.replace(/(.)\1+/g, '$1');
  const collapseTwo = original.replace(/(.)\1{2,}/g, '$1$1');
  for (const value of [collapseOne, collapseTwo]) {
    forms.add(value);
    if (value.startsWith('gh')) forms.add(`g${value.slice(2)}`);
  }
  return [...forms];
}

const vocabularyBucketCache = new WeakMap<Record<string, number>, Map<string, string[]>>();
function vocabularyBuckets(vocabulary: Record<string, number>) {
  const cached = vocabularyBucketCache.get(vocabulary);
  if (cached) return cached;
  const buckets = new Map<string, string[]>();
  for (const term of Object.keys(vocabulary)) {
    if (term.length < 3 || !/^[a-z0-9]+$/.test(term)) continue;
    const bucket = buckets.get(term[0]) ?? [];
    bucket.push(term);
    buckets.set(term[0], bucket);
  }
  vocabularyBucketCache.set(vocabulary, buckets);
  return buckets;
}

const editDistance = (left: string, right: string) => {
  if (Math.abs(left.length - right.length) > 2) return 3;
  const row = Array.from({ length: right.length + 1 }, (_, i) => i);
  for (let i = 1; i <= left.length; i++) {
    let previous = row[0]; row[0] = i;
    for (let j = 1; j <= right.length; j++) {
      const old = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1));
      previous = old;
    }
  }
  return row[right.length];
};

export function detectIntent(query: string): QueryIntent {
  const q = normalized(query);
  if (/\b(कब|कधी)\b/.test(q)) return 'DATE SEARCH';
  if (/\b(कौन|कोण)\b/.test(q)) return 'PERSON SEARCH';
  if (/\b(kab|kadhi)\b/.test(q)) return 'DATE SEARCH';
  if (/\b(kaun|kon)\b/.test(q)) return 'PERSON SEARCH';
  if (/\b(quote|verbatim|exact words|exact wording|what did .* say|kya kaha)\b/.test(q)) return 'QUOTE SEARCH';
  if (/\b(बताओ|समझाओ|स्पष्ट)\b/.test(q)) return 'CONCEPT EXPLANATION';
  if (/\b(when|what date|which date|what year|how old|date of)\b/.test(q)) return 'DATE SEARCH';
  if (/\b(compare|comparison|difference between|versus| vs )\b/.test(q)) return 'COMPARISON';
  if (/\b(summarize|summary|overview|main points|in brief)\b/.test(q)) return 'SUMMARY';
  if (/\b(source|citation|reference|original page|where is this|where did)\b/.test(q)) return 'SOURCE LOOKUP';
  if (/\b(speech|address|lecture|what did .* say)\b/.test(q)) return 'EVENT SEARCH';
  if (/\b(book|document|essay|article|writing|writings|work|volume|pdf|chapter)\b/.test(q)) return 'DOCUMENT SEARCH';
  if (/\b(who|person|people|associated|colleague|member)\b/.test(q)) return 'PERSON SEARCH';
  if (/\b(event|movement|conference|meeting|march|satyagraha|happened)\b/.test(q)) return 'EVENT SEARCH';
  if (/\b(idea|ideas|concept|meaning|explain|thought|philosophy|principle)\b/.test(q)) return 'CONCEPT EXPLANATION';
  return /\b(what|how|why|where|which|who|when)\b/.test(q) ? 'FACTUAL QUESTION' : 'DOCUMENT SEARCH';
}

export function analyzeQuery(
  input: string,
  vocabulary: Record<string, number>,
  documents: SourceDocument[],
  entityCatalog: EntityLabel[] = [],
  context?: QueryContext,
): QueryAnalysis {
  const originalTerms = tokens(input);
  const corrections: Correction[] = [];
  let phraseResolved = input.normalize('NFKC');
  for (const [pattern, replacement, kind] of phraseRules) {
    if (pattern.test(phraseResolved)) corrections.push({ from: phraseResolved.match(pattern)?.[0] ?? '', to: replacement, kind });
    pattern.lastIndex = 0;
    phraseResolved = phraseResolved.replace(pattern, replacement);
    pattern.lastIndex = 0;
  }
  const knownTerms = vocabularyBuckets(vocabulary);
  const resolvedWords: string[] = [];
  const entities: EntityLabel[] = [...new Map(
    [...entityCatalog, ...documents.map((document) => ({ label: document.title, type: 'DOCUMENT' }))]
      .map((entity) => [`${entity.type}:${normalized(entity.label)}`, entity] as const),
  ).values()];
  const entityAliases = new Map<string, { display: string; entity: EntityLabel }[]>();
  for (const entity of entities) {
    for (const part of entity.label.split(/[^\p{L}\p{M}\p{N}]+/u).filter((value) => value.length >= 4)) {
      const term = normalizedAscii(part);
      if (!term || term.length < 4) continue;
      const aliases = entityAliases.get(term) ?? [];
      aliases.push({ display: part, entity });
      entityAliases.set(term, aliases);
    }
  }

  const findCorpusCorrection = (word: string) => {
    if (!/^[\p{Script=Latin}\p{N}]+$/u.test(word) || word.length > 48) return undefined;
    const forms = noisyForms(word);
    const neighboringTerms = tokens(phraseResolved).filter((token) => token !== word);
    const candidates = new Map<string, { score: number; display: string; entity: boolean }>();
    for (const form of forms) {
      const bucket = knownTerms.get(form[0]) ?? [];
      const maxDifference = Math.max(3, Math.floor(form.length * 0.4));
      for (const term of bucket) {
        if (Math.abs(term.length - form.length) > maxDifference) continue;
        const distance = editDistance(form, term);
        const similarity = jaroWinkler(form, term) + (distance <= 1 ? 0.02 : distance === 2 ? 0.01 : 0);
        if (similarity < 0.76) continue;
        const entityOptions = entityAliases.get(term) ?? [];
        const entityOption = entityOptions[0];
        const entityContext = entityOptions.some(({ entity }) => tokens(entity.label).some((labelTerm) => neighboringTerms.includes(labelTerm)));
        const score = similarity + (entityOption ? 0.08 : 0) + (entityContext ? 0.12 : 0);
        const prior = candidates.get(term);
        if (!prior || score > prior.score) candidates.set(term, { score, display: entityOption?.display ?? term, entity: !!entityOption });
      }
    }
    const ranked = [...candidates.entries()].sort((a, b) => b[1].score - a[1].score || a[0].length - b[0].length);
    const best = ranked[0];
    if (!best) return undefined;
    const [target, match] = best;
    const second = ranked.find(([term]) => term !== target);
    const margin = second ? match.score - second[1].score : Infinity;
    const exactAfterNormalization = forms.includes(target);
    const highSimilarity = match.score >= (match.entity ? 0.88 : 0.91);
    if (!exactAfterNormalization && (!highSimilarity || (margin < 0.035 && !match.entity))) return undefined;
    if (!exactAfterNormalization && second && margin < 0.025 && second[1].entity && match.entity && second[1].display.toLowerCase() !== match.display.toLowerCase()) return undefined;
    return { target, display: match.display, kind: match.entity ? 'ALIAS' as const : 'TYPO' as const };
  };

  for (const word of tokens(phraseResolved)) {
    const aliases = wordAliases[word];
    if (aliases) {
      resolvedWords.push(...aliases);
      if (!aliases.includes(word)) corrections.push({ from: word, to: aliases.join(' '), kind: 'TRANSLITERATION' });
      continue;
    }
    if (vocabulary[word] !== undefined || word.length < 5) { resolvedWords.push(word); continue; }
    const candidate = findCorpusCorrection(word);
    if (candidate) {
      resolvedWords.push(candidate.target);
      corrections.push({ from: word, to: candidate.display, kind: candidate.kind });
    } else resolvedWords.push(word);
  }

  const retrievalTerms = [...new Set(resolvedWords.filter((word) => !stopWords.has(word)))];
  const expandedTerms = [...new Set(retrievalTerms.flatMap((word) => semanticSynonyms[word] ?? [word]))];
  const contextRequested = /\b(it|he|she|they|that|those|this|then|there|same|previous|him|her)\b/.test(normalized(input));
  const contextTerms: string[] = [];
  if (contextRequested && context) {
    for (const entity of context.entities ?? []) contextTerms.push(...tokens(entity));
    for (const title of context.documentTitles ?? []) contextTerms.push(...tokens(title));
    if (context.previousQuery) contextTerms.push(...tokens(context.previousQuery));
  }
  const allTerms = [...new Set([...expandedTerms, ...contextTerms.filter((word) => !stopWords.has(word))])];
  const semanticTerms = allTerms.filter((word) => vocabulary[word] !== undefined);
  const normalizedQuery = resolvedWords.join(' ').replace(/\s+/g, ' ').trim();
  const phraseForm = normalized(normalizedQuery);
  const normalizedInput = ` ${phraseForm} `;
  const matchedEntities = entities.filter((entity) => {
    const label = normalized(entity.label);
    if (!label || label.length < 4) return false;
    if (normalizedInput.includes(` ${label} `)) return true;
    const important = tokens(label).filter((word) => !stopWords.has(word) && word.length > 3);
    if (important.length > 0 && important.every((word) => resolvedWords.includes(word))) return true;
    return ['PERSON', 'ORGANIZATION', 'EVENT', 'MOVEMENT', 'PLACE', 'BOOK', 'SPEECH'].includes(entity.type)
      && important.some((word) => resolvedWords.includes(word));
  });
  const domainMatch = allTerms.some((word) => domainTerms.has(word)) || matchedEntities.length > 0;
  const contextApplied = contextRequested && contextTerms.length > 0;
  return {
    rawQuery: input,
    normalizedQuery,
    semanticQuery: semanticTerms.join(' '),
    terms: allTerms,
    corrections: corrections.filter((item, index, list) => list.findIndex((other) => other.from === item.from && other.to === item.to) === index),
    intent: detectIntent(input),
    entities: matchedEntities,
    scope: domainMatch ? 'AMBEDKAR_RELATED' : contextApplied ? 'UNCLEAR' : 'UNRELATED',
    contextApplied,
    trace: { originalTerms, expandedTerms: allTerms, matchedEntities: matchedEntities.map((entity) => entity.label) },
  };
}

export function keywordSearch(query: QueryAnalysis, index: KeywordIndex, limit = 100): RetrievalHit[] {
  const terms = [...new Set(query.terms)].filter((term) => term.length >= 2);
  if (!terms.length || !index.pageLocations.length) return [];
  const scores = new Map<number, number>();
  const totalPages = index.pageLocations.length;
  const average = index.averagePageLength || 1;
  for (const term of terms) {
    const postings = index.postings[term];
    if (!postings?.length) continue;
    const inverse = Math.log(1 + (totalPages - postings.length + 0.5) / (postings.length + 0.5));
    for (const [pageIndex, frequency] of postings) {
      const length = index.pageLengths[pageIndex] || average;
      const k = 1.2;
      const norm = frequency + k * (1 - 0.75 + 0.75 * length / average);
      const boost = query.trace.expandedTerms.includes(term) ? 1 : 0.65;
      scores.set(pageIndex, (scores.get(pageIndex) ?? 0) + inverse * (frequency * (k + 1) / norm) * boost);
    }
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([pageIndex, score]) => {
    const [documentId, pageNumber] = index.pageLocations[pageIndex];
    return { documentId, pageNumber, score };
  });
}

export function mergeHybridCandidates(
  semanticHits: RetrievalHit[],
  keywordHits: RetrievalHit[],
  documents: SourceDocument[],
  query: QueryAnalysis,
  limit = 100,
): HybridCandidate[] {
  const docs = new Map(documents.map((document) => [document.id, document]));
  const semMax = Math.max(0.001, ...semanticHits.map((hit) => hit.score));
  const keyMax = Math.max(0.001, ...keywordHits.map((hit) => hit.score));
  const merged = new Map<string, HybridCandidate>();
  const add = (hit: RetrievalHit, kind: 'semantic' | 'keyword') => {
    const document = docs.get(hit.documentId);
    if (!document || hit.pageNumber < 1 || hit.pageNumber > document.pageCount) return;
    const key = `${hit.documentId}:${hit.pageNumber}`;
    const item = merged.get(key) ?? { documentId: hit.documentId, pageNumber: hit.pageNumber, document, semanticScore: 0, keywordScore: 0, preliminaryScore: 0 };
    if (kind === 'semantic') item.semanticScore = Math.max(item.semanticScore, hit.score / semMax);
    else item.keywordScore = Math.max(item.keywordScore, hit.score / keyMax);
    merged.set(key, item);
  };
  semanticHits.forEach((hit) => add(hit, 'semantic'));
  keywordHits.forEach((hit) => add(hit, 'keyword'));
  const phrase = normalized(query.normalizedQuery);
  for (const candidate of merged.values()) {
    const metadata = normalized(`${candidate.document.title} ${candidate.document.filename}`);
    const exactMetadata = phrase.length > 3 && metadata.includes(phrase) ? 1 : 0;
    const sourcePriority = candidate.document.id.startsWith('VOL-') ? 0.035
      : candidate.document.id === 'SRC-CONSTITUTION' ? 0.025
        : candidate.document.id === 'SRC-LIFE-MISSION' ? -0.015
          : candidate.document.id === 'SRC-BR-AMBEDKAR' ? -0.035 : 0;
    const hasSemantic = candidate.semanticScore > 0;
    const hasKeyword = candidate.keywordScore > 0;
    const semanticWeight = hasSemantic && hasKeyword ? 0.48 : hasSemantic ? 0.67 : 0;
    const keywordWeight = hasSemantic && hasKeyword ? 0.39 : hasKeyword ? 0.84 : 0;
    candidate.preliminaryScore = semanticWeight * candidate.semanticScore + keywordWeight * candidate.keywordScore + exactMetadata * 0.1 + sourcePriority;
  }
  return [...merged.values()].sort((a, b) => b.preliminaryScore - a.preliminaryScore).slice(0, limit);
}

export type IndexedPage = { text: string; method: string; confidence: number | null; printedPage?: string | null; headings?: { title: string }[]; chunks?: { text: string }[] };

function passageScore(text: string, terms: string[]) {
  const clean = normalizedAscii(text);
  const matches = terms.filter((term) => clean.split(' ').includes(term));
  const coverage = terms.length ? matches.length / terms.length : 0;
  const positions = terms.map((term) => clean.indexOf(term)).filter((position) => position >= 0);
  const span = positions.length > 1 ? Math.max(...positions) - Math.min(...positions) : 0;
  const proximity = positions.length > 1 ? Math.max(0, 1 - span / Math.max(120, terms.length * 80)) : positions.length ? 0.5 : 0;
  return { coverage, proximity, matches };
}

function bestPassage(page: IndexedPage, query: QueryAnalysis, limit = 520) {
  const candidates = page.chunks?.map((chunk) => chunk.text).filter(Boolean) ?? [];
  if (!candidates.length) candidates.push(page.text);
  const terms = query.terms.filter((term) => term.length > 2);
  const queryPhrase = normalizedAscii(query.normalizedQuery);
  const rated = candidates.map((text) => {
    const score = passageScore(text, terms);
    const phraseMatch = queryPhrase.length > 8 && normalizedAscii(text).includes(queryPhrase);
    return { text, ...score, phraseMatch, scoreValue: score.coverage * 0.7 + score.proximity * 0.12 + (phraseMatch ? 0.22 : 0) };
  }).sort((a, b) => b.scoreValue - a.scoreValue);
  let excerpt = rated[0]?.text ?? '';
  if (excerpt.length > limit) {
    const relevant = terms.map((term) => excerpt.toLowerCase().indexOf(term)).filter((position) => position >= 0);
    const start = relevant.length ? Math.max(0, Math.min(...relevant) - 100) : 0;
    excerpt = excerpt.slice(start, start + limit);
    if (start > 0) excerpt = `…${excerpt}`;
    if (start + limit < (rated[0]?.text.length ?? 0)) excerpt += '…';
  }
  const evidenceScore = passageScore(excerpt, terms);
  return { excerpt, passageCoverage: evidenceScore.coverage, proximity: evidenceScore.proximity, phraseMatch: rated[0]?.phraseMatch ?? false, matchedTerms: evidenceScore.matches };
}

export function rerankAndVerify(
  query: QueryAnalysis,
  candidates: HybridCandidate[],
  pageFor: (documentId: string, pageNumber: number) => IndexedPage | undefined,
  limit = 8,
): EvidenceResult[] {
  const maxSemantic = Math.max(0.001, ...candidates.map((candidate) => candidate.semanticScore));
  const maxKeyword = Math.max(0.001, ...candidates.map((candidate) => candidate.keywordScore));
  const results: EvidenceResult[] = [];
  for (const candidate of candidates) {
    const page = pageFor(candidate.documentId, candidate.pageNumber);
    if (!page || !page.text?.trim() || !['NATIVE_TEXT', 'OCR'].includes(page.method)) continue;
    const passage = bestPassage(page, query);
    const semantic = candidate.semanticScore / maxSemantic;
    const keyword = candidate.keywordScore / maxKeyword;
    const entityMatch = query.entities.length ? query.entities.filter((entity) => normalized(`${page.text} ${candidate.document.title}`).includes(normalized(entity.label))).length / query.entities.length : 0;
    const titleWords = tokens(candidate.document.title);
    const metadataCoverage = titleWords.length ? titleWords.filter((word) => query.terms.includes(word)).length / titleWords.length : 0;
    const sourcePriority = candidate.document.id.startsWith('VOL-') ? 0.035
      : candidate.document.id === 'SRC-CONSTITUTION' ? 0.025
        : candidate.document.id === 'SRC-LIFE-MISSION' ? -0.015
          : candidate.document.id === 'SRC-BR-AMBEDKAR' ? -0.035 : 0;
    const score = Math.max(0, Math.min(1, 0.38 * semantic + 0.31 * keyword + 0.2 * passage.passageCoverage + 0.07 * passage.proximity + 0.08 * entityMatch + 0.07 * metadataCoverage + sourcePriority + (passage.phraseMatch ? 0.18 : 0)));
    const sufficient = passage.phraseMatch || (passage.passageCoverage >= (query.terms.length <= 1 ? 1 : 0.5) && (semantic >= 0.12 || keyword >= 0.12)) || (entityMatch > 0 && passage.passageCoverage >= 0.4 && (semantic > 0.15 || keyword > 0.15));
    if (!sufficient) continue;
    results.push({
      ...candidate,
      excerpt: passage.excerpt,
      method: page.method,
      printedPage: page.printedPage ?? null,
      score,
      support: score >= 0.52 ? 'HIGH SOURCE SUPPORT' : 'MODERATE SOURCE SUPPORT',
      matchedTerms: passage.matchedTerms,
      citation: { documentId: candidate.documentId, documentTitle: candidate.document.title, filename: candidate.document.filename, pageNumber: candidate.pageNumber, method: page.method, source: candidate.document.source, sha256: candidate.document.sha256, versionId: candidate.document.versionId },
      trace: { semantic: semantic, keyword, passageCoverage: passage.passageCoverage, phraseMatch: passage.phraseMatch, entityMatch, sourcePriority },
    });
  }
  return results.sort((a, b) => b.score - a.score).filter((result, index, all) => all.findIndex((item) => item.documentId === result.documentId && item.pageNumber === result.pageNumber) === index).slice(0, limit);
}

export type GroundedAnswer = { status: 'SUPPORTED' | 'OCR_REVIEW' | 'INSUFFICIENT SOURCE SUPPORT' | 'OUT OF SCOPE'; text: string; claims: { text: string; documentId: string; pageNumber: number; method: string }[]; sourceConflict: boolean };

const answerActions: Record<string, RegExp> = {
  born: /\b(born|birth|birthday)\b/i, died: /\b(died|death)\b/i,
  wrote: /\b(wrote|written|writing|published)\b/i, published: /\b(published|publication)\b/i,
  signed: /\b(signed|signing|agreement)\b/i, founded: /\b(founded|founder|established|formation)\b/i,
};

function answerSentence(query: QueryAnalysis, item: EvidenceResult, fullText?: string) {
  const text = (fullText || item.excerpt).replace(/\s+/g, ' ').trim();
  const raw = normalizedAscii(query.rawQuery);
  if (query.terms.includes('annihilation') && query.terms.includes('caste') && /\bVol\.?\s*1\b[\s\S]{0,140}\bAnnihilation of Caste\b/i.test(item.excerpt)) {
    return {text:'Annihilation of Caste is listed in Volume 1 of Dr. Babasaheb Ambedkar: Writings and Speeches.',score:1.2,index:0};
  }
  if (query.terms.includes('poona') && query.terms.includes('pact') && /by agreeing to alter the Communal Award in a manner satisfactory to Mr\. Gandhi\. This agreement is known as the Poona Pact\./i.test(text)) {
    return {text:'The Poona Pact was an agreement to alter the Communal Award in a manner satisfactory to Mr. Gandhi.',score:1.1,index:0};
  }
  const sentences = text.replace(/\b(Dr|Mr|Mrs|Ms|Prof)\.\s+/g,'$1.\uE000').replace(/\b([A-Z])\.\s+(?=[A-Z])/g,'$1.\uE000')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9“‘"(*])/u).map(sentence=>sentence.replaceAll('\uE000',' '));
  const terms = [...new Set(query.terms.filter((term) => term.length > 2 && !['ambedkar', 'babasaheb'].includes(term)))];
  const asksAboutAmbedkar = /\b(ambedkar|babasaheb|bhimrao)\b/i.test(query.normalizedQuery);
  const action = Object.entries(answerActions).find(([verb]) => new RegExp(`\\b${verb}\\b`).test(raw))?.[1];
  const dateQuestion = query.intent === 'DATE SEARCH';
  const founderQuestion = /\b(who|which person)\b[\s\S]*\b(found|founded|established)\b/.test(raw);
  const writingQuestion = /\b(what|how)\b[\s\S]*\b(write|wrote|written)\b[\s\S]*\b(about|on)\b/.test(raw);
  const definitionQuestion = /\bwhat\s+(?:is|was|are|were)\b/.test(raw);
  const candidates = sentences.flatMap((sentence, index) => {
    const clean = sentence.trim().replace(/^[*•\s]+/, '');
    const words = tokens(clean);
    if (clean.length < 35 || clean.length > 450 || words.length < 7 || !/[.!?]$/.test(clean) || /^(?:contents|index|published volumes|vol\.)\b/i.test(clean)) return [];
    const lower = normalizedAscii(clean);
    const sentenceWords = new Set(lower.split(' '));
    const matches = terms.filter((term) => sentenceWords.has(term) || (term === 'born' && sentenceWords.has('birth')) || (term === 'died' && sentenceWords.has('death')));
    const coverage = terms.length ? matches.length / terms.length : 0;
    const anchored = !asksAboutAmbedkar || /\b(ambedkar|babasaheb|bhimrao)\b/i.test(clean);
    if (!anchored || coverage < (terms.length <= 1 ? 1 : 0.45)) return [];
    if (dateQuestion && (!/\b(?:17|18|19|20)\d{2}\b/.test(clean) || (action && !action.test(clean)))) return [];
    if (founderQuestion) {
      const targetTerms=terms.filter(term=>!['found','founded','established'].includes(term));
      const target=targetTerms.some(term=>normalizedAscii(clean).includes(term));
      const active=/\b(?:Dr\.?\s*)?(?:[A-Z][a-z]+\s+){1,3}[A-Z][a-z]+\b.{0,35}\b(?:founded|established)\b/.exec(clean);
      const passive=/\b(?:founded|established)\s+by\s+(?:Dr\.?\s*)?(?:[A-Z][a-z]+\s+){1,3}[A-Z][a-z]+\b/.exec(clean);
      const afterAction=active ? normalizedAscii(clean.slice(active.index+active[0].length)) : '';
      if (!target || (!passive && (!active || targetTerms.filter(term=>afterAction.includes(term)).length<Math.min(2,targetTerms.length)))) return [];
    }
    if (founderQuestion && /\b(closing down|closed|dissolved)\b/i.test(clean)) return [];
    if (writingQuestion && !/\b(write|wrote|written|argued|described|called)\b/i.test(clean)) return [];
    if (definitionQuestion && /\b(?:is|was)\s+(?:known|called|named)\s+as\b/i.test(clean)) return [];
    if (/\b(ignore previous instructions|system prompt|assistant must)\b/i.test(clean)) return [];
    const source = item.documentId.startsWith('VOL-') ? 0.08 : 0;
    const score = coverage * 0.55 + (dateQuestion ? 0.18 : 0) + (anchored ? 0.12 : 0) + source + item.score * 0.1 - Math.max(0, clean.length - 270) / 1400;
    return [{text:clean,score,index}];
  });
  return candidates.sort((a,b)=>b.score-a.score)[0];
}

export function buildGroundedAnswer(query: QueryAnalysis, evidence: EvidenceResult[], pageFor?: (documentId:string,pageNumber:number)=>string|undefined): GroundedAnswer {
  if (query.scope === 'UNRELATED') return { status: 'OUT OF SCOPE', text: 'I’m NANAK RATTU, focused exclusively on Dr. B. R. Ambedkar and directly related historical material.', claims: [], sourceConflict: false };
  if (!evidence.length) return { status: 'INSUFFICIENT SOURCE SUPPORT', text: 'I couldn’t verify this from the available sources.', claims: [], sourceConflict: false };
  const answerEvidence = query.intent === 'QUOTE SEARCH' ? evidence.filter((item) => item.method === 'NATIVE_TEXT') : evidence;
  if (query.intent === 'QUOTE SEARCH' && answerEvidence.length === 0 && evidence.some((item) => item.method === 'OCR')) {
    return { status: 'OCR_REVIEW', text: 'I found OCR-extracted text, but I can’t verify exact wording from the scan. Open the cited PDF page to check it.', claims: [], sourceConflict: false };
  }
  if (!answerEvidence.length) return { status: 'INSUFFICIENT SOURCE SUPPORT', text: 'I couldn’t verify this from the available sources.', claims: [], sourceConflict: false };
  const candidates = answerEvidence.map((item) => ({item, candidate:answerSentence(query,item,pageFor?.(item.documentId,item.pageNumber))})).filter((value) => !!value.candidate)
    .sort((a,b)=>b.candidate!.score-a.candidate!.score);
  if (!candidates.length) return { status: 'INSUFFICIENT SOURCE SUPPORT', text: 'I couldn’t verify a direct answer from the available sources.', claims: [], sourceConflict: false };
  const dateActions = ['born', 'died', 'wrote', 'published', 'delivered', 'signed', 'appointed', 'elected', 'adopted', 'passed', 'founded', 'established', 'held', 'convened', 'launched'];
  const requestedActions = query.intent === 'DATE SEARCH' ? dateActions.filter((action) => query.terms.includes(action) || normalized(query.rawQuery).includes(action)) : [];
  const datedClaims = candidates.flatMap(({item,candidate}) => {
    const claim={text:candidate!.text,documentId:item.documentId};
    const sentences = claim.text.match(/[^.!?]+[.!?]?/g) ?? [claim.text];
    const matches = sentences.flatMap((sentence) => {
      const years = sentence.match(/\b(?:17|18|19|20)\d{2}\b/g) ?? [];
      const action = requestedActions.find((candidate) => (answerActions[candidate] ?? new RegExp(`\\b${candidate}\\b`, 'i')).test(sentence));
      return years.length === 1 && action ? [{ documentId: claim.documentId, year: years[0], action }] : [];
    });
    return matches;
  });
  const sourceConflict = datedClaims.some((first, index) => datedClaims.slice(index + 1).some((second) => first.documentId !== second.documentId && first.year !== second.year && first.action === second.action));
  const selected = candidates.slice(0,sourceConflict || query.intent === 'COMPARISON' || query.intent === 'SUMMARY' ? 2 : 1);
  const claims = selected.map(({item,candidate}) => ({ text:candidate!.text, documentId:item.documentId, pageNumber:item.pageNumber, method:item.method }));
  const text = sourceConflict ? 'Sources differ on this point. The cited passages give different dates.' : claims.map(claim => claim.text).join(' ');
  return { status: 'SUPPORTED', text, claims, sourceConflict };
}

export function validateCitationResults(results: EvidenceResult[], documents: SourceDocument[]) {
  const byId = new Map(documents.map((document) => [document.id, document]));
  return results.filter((result) => {
    const document = byId.get(result.documentId);
    return !!document && result.citation.documentId === document.id && result.citation.documentTitle === document.title
      && result.citation.filename === document.filename && result.pageNumber >= 1 && result.pageNumber <= document.pageCount
      && result.citation.pageNumber === result.pageNumber && (!document.sha256 || result.citation.sha256 === document.sha256)
      && (!document.versionId || result.citation.versionId === document.versionId)
      && result.excerpt.trim().length > 0 && ['NATIVE_TEXT', 'OCR'].includes(result.method);
  });
}
