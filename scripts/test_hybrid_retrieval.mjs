import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { analyzeQuery, buildGroundedAnswer, keywordSearch, mergeHybridCandidates, rerankAndVerify, validateCitationResults } from '../src/knowledge/hybrid.ts';
import { embed, rank } from '../src/knowledge/semantic.ts';
import { researchArchive } from '../src/services/archive-retrieval.ts';

const root = new URL('../public/corpus/', import.meta.url);
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input, options) => {
  const request = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
  if (!request.startsWith('/corpus/')) return nativeFetch(input, options);
  return new Response(await readFile(new URL(request.slice('/corpus/'.length), root)), { status: 200 });
};
const jsonFile = async (name) => JSON.parse(await readFile(new URL(name, root), 'utf8'));
const gzipFile = async (name) => JSON.parse(gunzipSync(await readFile(new URL(name, root))).toString('utf8'));
const [documents, model, keywordIndex, graph, timeline] = await Promise.all([
  jsonFile('manifest.json'), gzipFile('semantic-model.bin'), gzipFile('keyword-index.bin'), gzipFile('graph.bin'), jsonFile('timeline.json'),
]);
assert.equal(keywordIndex.schemaVersion, 1);
const textIndexedPageCount = documents.reduce((count, document) => count + document.extraction.native + document.extraction.ocr, 0);
assert.equal(keywordIndex.pageLocations.length, textIndexedPageCount, 'keyword index should cover every text-indexed source page');
assert(model.pageLocations.length > 0 && model.pageLocations.length <= keywordIndex.pageLocations.length, 'vector index should report its indexed page coverage');
const keywordPageIds = new Set(keywordIndex.pageLocations.map(([documentId, pageNumber]) => `${documentId}:${pageNumber}`));
assert(model.pageLocations.every(([documentId, pageNumber]) => keywordPageIds.has(`${documentId}:${pageNumber}`)), 'every vector page should also have source text in the keyword index');

const entityCatalog = [
  ...graph.nodes.map((node) => ({ label: node.label, type: node.type })),
  ...timeline.events.flatMap((event) => event.entities ?? []),
];
const cache = new Map();
async function run(queryText, context) {
  const analysis = analyzeQuery(queryText, model.vocabulary, documents, entityCatalog, context);
  const vector = embed(analysis.semanticQuery, model);
  const semanticHits = rank(vector, model, documents, 120).map(({ documentId, pageNumber, score }) => ({ documentId, pageNumber, score }));
  const keywordHits = keywordSearch(analysis, keywordIndex, 120);
  const candidates = mergeHybridCandidates(semanticHits, keywordHits, documents, analysis, 180);
  const loadedDocs = new Set();
  for (const candidate of candidates) {
    if (loadedDocs.has(candidate.documentId)) continue;
    if (loadedDocs.size >= 8) continue;
    loadedDocs.add(candidate.documentId);
  }
  const pageData = new Map();
  for (const documentId of loadedDocs) {
    let data = cache.get(documentId);
    if (!data) {
      data = await gzipFile(`${documentId}.bin`);
      cache.set(documentId, data);
    }
    for (const page of data.pages) pageData.set(`${documentId}:${page.pageNumber}`, page);
  }
  const evidence = validateCitationResults(
    rerankAndVerify(analysis, candidates.filter((candidate) => loadedDocs.has(candidate.documentId)), (id, page) => pageData.get(`${id}:${page}`), 8),
    documents,
  );
  return { analysis, evidence, answer: buildGroundedAnswer(analysis, evidence), keywordHits, semanticHits };
}

const misspelled = await run('ambedkr anhilition caste');
assert(misspelled.analysis.corrections.some((item) => item.from === 'ambedkr' && item.to === 'ambedkar'), 'correct Ambedkar typo');
assert(misspelled.analysis.corrections.some((item) => item.from === 'anhilition' && item.to === 'annihilation'), 'correct Annihilation typo');
assert(misspelled.keywordHits.length > 0, 'misspelled query must hit the inverted index');
assert(misspelled.semanticHits.length > 0, 'corrected query must reach the vector index');
assert(misspelled.evidence.length > 0, 'hybrid retrieval must produce page evidence');
assert(misspelled.evidence.some((item) => /annihilation/i.test(item.excerpt) && /caste/i.test(item.excerpt)), 'top evidence must contain the intended work/topic');
assert(misspelled.evidence.some((item) => /annihilation[\s\S]{0,30}caste/i.test(item.excerpt)), 'a cited excerpt must preserve the work title as it appears in the source');
assert.equal(misspelled.answer.status, 'SUPPORTED');
assert(!/retrieved passages|I found this relevant passage/i.test(misspelled.answer.text), 'the answer must lead with a direct source-grounded statement');
assert(misspelled.answer.claims.some((claim) => claim.documentId && claim.pageNumber > 0), 'the direct answer must retain its page citation');

const exactWork = await run('Annihilation of Caste');
assert(exactWork.evidence.some((item) => /annihilation[\s\S]{0,30}caste/i.test(item.excerpt)), 'exact title search should prioritize its source passage');

const sabha = await run('bahishkrit hitakrini sabha');
assert(sabha.analysis.corrections.some((item) => item.to.includes('hitakarini')), 'correct Hitakarini transliteration typo');
assert(sabha.evidence.length > 0, 'organization typo should retrieve source pages');

const noisyAcceptanceCases = [
  ['ghandhjjjiigii', 'gandhi'],
  ['ambedkkkaar', 'ambedkar'],
  ['annihlation of cast', 'annihilation'],
  ['mahad satyagrah', 'satyagraha'],
  ['poooona pacttt', 'poona'],
  ['constitutn assembly', 'constituent'],
  ['bhahishkrit hitakrini sabha', 'bahishkrit'],
  ['ambedkar and ghandhii', 'gandhi'],
];
for (const [queryText, expected] of noisyAcceptanceCases) {
  const result = await run(queryText);
  assert(result.analysis.normalizedQuery.includes(expected), `${queryText} should normalize toward ${expected}: ${result.analysis.normalizedQuery}`);
  assert(result.evidence.length > 0, `${queryText} should retrieve traceable source pages`);
}
const extremeNoise = await run('ghandhjjjiigii');
assert(extremeNoise.analysis.entities.some((entity) => /gandhi/i.test(entity.label)), 'extreme noise must resolve to a corpus-backed Gandhi person entity');
assert(extremeNoise.evidence.some((item) => /gandhi/i.test(item.excerpt)), 'extreme noise must retrieve a passage that mentions Gandhi');
assert.equal((await run('ambedkar constitution')).analysis.corrections.length, 0, 'clear queries should not be rewritten');

const hinglish = await run('ambedkar ne caste ke bare mein kya kaha');
assert.equal(hinglish.analysis.scope, 'AMBEDKAR_RELATED');
assert(hinglish.evidence.length > 0, 'romanized Hindi query should retrieve source pages');

const hindi = await run('अंबेडकर ने जाति के बारे में क्या कहा');
assert.equal(hindi.analysis.scope, 'AMBEDKAR_RELATED');
assert(hindi.analysis.normalizedQuery.includes('ambedkar') && hindi.analysis.normalizedQuery.includes('caste'), 'Devanagari terms should normalize to corpus terms');
assert(hindi.evidence.length > 0, 'Hindi query should retrieve source pages');

const romanizedMarathi = await run('ambedkar cha samajik vichar');
assert.equal(romanizedMarathi.analysis.scope, 'AMBEDKAR_RELATED');
assert(romanizedMarathi.evidence.length > 0, 'romanized Marathi query should retrieve source pages');

const marathi = await run('आंबेडकरांचे सामाजिक विचार');
assert.equal(marathi.analysis.scope, 'AMBEDKAR_RELATED');
assert(marathi.analysis.normalizedQuery.includes('ambedkar') && marathi.analysis.normalizedQuery.includes('social'), 'Marathi terms should normalize to corpus concepts');
assert(marathi.evidence.length > 0, 'Marathi query should retrieve source pages');

const quoteSearch = await run('exact quote Ambedkar caste');
assert.equal(quoteSearch.analysis.intent, 'QUOTE SEARCH');
if (quoteSearch.answer.claims.length) assert(quoteSearch.answer.claims.every((claim) => claim.method === 'NATIVE_TEXT'), 'exact-quote claims must come from non-OCR PDF text');
else if (quoteSearch.evidence.some((item) => item.method === 'OCR')) assert.equal(quoteSearch.answer.status, 'OCR_REVIEW', 'OCR-only quote hits must ask for visual verification');

const dateQuestion = analyzeQuery('When was Ambedkar born?', model.vocabulary, documents, entityCatalog);
const dateEvidence = misspelled.evidence[0];
const conflictingDates = buildGroundedAnswer(dateQuestion, [
  { ...dateEvidence, documentId: 'VOL-01', excerpt: 'Ambedkar was born on 14 April 1891.' },
  { ...dateEvidence, documentId: 'VOL-02', excerpt: 'Ambedkar was born on 14 April 1892.' },
]);
assert.equal(conflictingDates.sourceConflict, true, 'different source dates tied to the same requested event should be flagged');
const multipleDatesOneSource = buildGroundedAnswer(dateQuestion, [
  { ...dateEvidence, documentId: 'VOL-01', excerpt: 'Ambedkar was born in 1891. He died in 1956.' },
]);
assert.equal(multipleDatesOneSource.sourceConflict, false, 'a source mentioning distinct life events is not a source conflict');

const founderQuery=analyzeQuery('Who founded Bahishkrit Hitakarini Sabha?',model.vocabulary,documents,entityCatalog);
const misleadingFounder=buildGroundedAnswer(founderQuery,[{...dateEvidence,excerpt:'Shankardas Narayandas Barve is a worker of the Bahishkrit Hitakarini Sabha, an organization established for the uplift of the Depressed Classes.'}]);
assert.equal(misleadingFounder.status,'INSUFFICIENT SOURCE SUPPORT','a worker in a founded organization is not evidence of who founded it');

const unrelated = await run('What is the weather forecast for tomorrow?');
assert.equal(unrelated.answer.status, 'OUT OF SCOPE');
assert.equal(unrelated.answer.claims.length, 0, 'out-of-scope response must not contain historical claims');

const followup = await run('When did he write it?', { previousQuery: 'What did Ambedkar write about caste?', entities: ['Dr. B. R. Ambedkar'], documentTitles: ['Annihilation of Caste'] });
assert.equal(followup.analysis.contextApplied, true, 'follow-up should carry prior entities/source terms into retrieval');
assert(followup.evidence.length > 0, 'contextual follow-up should retrieve source evidence');

const pipelineStages = [];
const integrated = await researchArchive('ambedkr anhilition caste', (status) => pipelineStages.push(status));
assert(integrated.results.length > 0 && integrated.answer.status === 'SUPPORTED', 'runtime service should return real cited evidence');
assert(integrated.results.every((item) => item.document.pdfUrl), 'every returned result should carry a direct PDF page URL');
assert.equal(integrated.trace.indexedDocuments, 24);
assert(integrated.trace.keywordCandidates > 0 && integrated.trace.semanticCandidates > 0, 'runtime service must use both retrieval indexes');
assert.deepEqual(pipelineStages.map((status) => status.stage), [0, 1, 2, 3, 4, 5]);
assert.equal(pipelineStages.at(-1)?.complete, true, 'final status should follow completed evidence checks');

const integratedExtremeNoise = await researchArchive('ghandhjjjiigii', () => {});
assert(integratedExtremeNoise.analysis.corrections.some((item) => item.to.toLowerCase() === 'gandhi'), 'shared runtime service should expose the Gandhi interpretation');
assert(integratedExtremeNoise.results.some((item) => /gandhi/i.test(item.excerpt)), 'shared runtime service should return a Gandhi source passage');
assert(integratedExtremeNoise.results.every((item) => item.citation.pageNumber === item.pageNumber && item.citation.documentId === item.documentId), 'shared runtime service should retain traceable page citations');

const birth=await researchArchive('When was Ambedkar born?',()=>{});
assert.equal(birth.answer.status,'SUPPORTED','a directly sourced birth date should be answered');
assert(/14(?:th)? April 1891/.test(birth.answer.text),'the answer should use the indexed school-register date');
assert(birth.answer.claims.every(claim=>birth.results.some(item=>item.documentId===claim.documentId&&item.pageNumber===claim.pageNumber)),'every answer reference must be present among visible results');

for (const result of [...misspelled.evidence, ...sabha.evidence, ...hinglish.evidence, ...hindi.evidence, ...followup.evidence]) {
  const page = cache.get(result.documentId)?.pages[result.pageNumber - 1];
  assert(page, `source page must exist: ${result.documentId} p${result.pageNumber}`);
  assert.equal(page.pageId, `${result.documentId}-P${String(result.pageNumber).padStart(4, '0')}`);
  assert(['NATIVE_TEXT', 'OCR'].includes(result.method), 'evidence method must reflect the indexed page');
}

console.log(JSON.stringify({
  result: 'PASS',
  corpus: { documents: documents.length, keywordPages: keywordIndex.pageLocations.length, vectorPages: model.pageLocations.length, terms: keywordIndex.termCount },
  checks: {
    typo: { corrections: misspelled.analysis.corrections, hits: misspelled.evidence.length, topSource: `${misspelled.evidence[0].documentId} p${misspelled.evidence[0].pageNumber}` },
    transliteratedOrganisation: { corrections: sabha.analysis.corrections, hits: sabha.evidence.length },
    romanizedHindiHits: hinglish.evidence.length,
    devanagariHindiHits: hindi.evidence.length,
    romanizedMarathiHits: romanizedMarathi.evidence.length,
    devanagariMarathiHits: marathi.evidence.length,
    quoteVerification: { status: quoteSearch.answer.status, claimMethods: quoteSearch.answer.claims.map((claim) => claim.method) },
    dateConflictChecks: { disagreementFlagged: conflictingDates.sourceConflict, multipleEventsKeptDistinct: !multipleDatesOneSource.sourceConflict },
    contextualFollowup: { applied: followup.analysis.contextApplied, hits: followup.evidence.length },
    unrelatedScope: unrelated.answer.status,
    integratedPipeline: { hits: integrated.results.length, trace: integrated.trace, stages: pipelineStages.length },
    citationsChecked: [...misspelled.evidence, ...sabha.evidence, ...hinglish.evidence, ...hindi.evidence, ...followup.evidence].length,
  },
}, null, 2));
