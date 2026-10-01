import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
// Isolated TypeScript transpilation allows service-contract checks without browser automation.
const cache=new Map();
function load(file){if(cache.has(file))return cache.get(file);const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const module={exports:{}};cache.set(file,module.exports);const relRequire=id=>id==='../data/archive'?load(new URL('../src/data/archive.ts',import.meta.url)):require(id);new Function('require','module','exports',code)(relRequire,module,module.exports);cache.set(file,module.exports);return module.exports}
const api=load(new URL('../src/services/index.ts',import.meta.url));
const records=api.archiveService.documents;
assert.equal(new Set(records.map(d=>d.id)).size,records.length);
for(const d of records){assert.ok(d.provenance==='Demo data'?d.id.startsWith('DEMO-'):true);const pages=api.pageIndexService.pages(d);assert.equal(pages.length,d.pages);assert.ok(pages.every((p,i)=>p.document_id===d.id&&p.page_number===i+1&&p.kind==='DEMO ARCHIVAL PAGE'))}
assert.equal(api.searchService.search('constitution').length,1);
assert.ok(api.searchService.search('safeguards',{mode:'Semantic'}).some(d=>d.id==='REF-CONSTITUTION'));
assert.equal(api.searchService.search('',{category:'Video'}).length,0);
assert.equal(api.guardrailService.validate('x',records).status,'REVIEW REQUIRED');
assert.equal(api.guardrailService.validate('exact quote',records).status,'INSUFFICIENT EVIDENCE');
assert.equal(api.guardrailService.validate('unmatched',[]).status,'INSUFFICIENT EVIDENCE');
assert.equal(api.guardrailService.validate('manuscript',[records[4]]).status,'VALIDATED');
assert.equal(api.guardrailService.validate('constitution',[records[0]]).status,'PARTIALLY GROUNDED');
const response=await api.ragService.research('constitution',()=>{});
for(const citation of response.citations){const d=api.archiveService.get(citation.documentId);assert.ok(d);assert.ok(citation.page>=1&&citation.page<=d.pages);assert.equal(citation.demo,true)}
const abort=new AbortController();const promise=api.ragService.research('constitution',()=>{},abort.signal);abort.abort();await assert.rejects(promise,{name:'AbortError'});
const exported=JSON.parse(api.metadataService.export('json'));assert.equal(exported.length,records.length);assert.ok(exported.every(r=>r['demo:provenance']));assert.equal(api.metadataService.export('csv').charCodeAt(0),0xfeff);
console.log('Service audit passed: search, filters, all grounding states, page integrity, citation targets, cancellation, and metadata exports.');
