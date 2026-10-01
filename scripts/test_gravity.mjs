import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createServer} from 'vite';

const json=path=>JSON.parse(readFileSync(path,'utf8'));
const source=JSON.parse(gunzipSync(readFileSync('public/corpus/explorer.bin')));
const index=json('src/generated/gravity-index.json');
const manifest=json('public/corpus/manifest.json');
const reviews=json('public/data/frames-review.json');
const mediaReviews=json('public/data/media-review.json');
const events=json('public/corpus/timeline.json').events;
const frames=['frames-1','frames-2','frames-3']
 .flatMap(file=>json(`public/data/${file}.json`).images)
 .filter(frame=>reviews[frame.id]?.status==='PUBLISHED')
 .map(frame=>({...frame,display_url:reviews[frame.id].assetUrl,
  locationLabel:frame.location?.name||'Location unrecorded',
  sourceLabel:frame.source?.institution||frame.source?.title}));
const audio=json('public/data/AMBD_AUD.json').audio_tracks
 .map(item=>({...item,review:mediaReviews[item.id]}));
assert.equal(index.links.length,source.links.filter(link=>link.sources.length).length,'index remains derived from corpus');
assert.equal(index.nodes.length,source.nodes.length,'no graph entities dropped');
const vite=await createServer({configFile:false,resolve:{alias:{'@':process.cwd()}},server:{middlewareMode:true},appType:'custom'});
try{
 const {buildGravityField,orbitalPosition}=await vite.ssrLoadModule('/src/services/gravity-engine.ts');
 const field=buildGravityField(index,manifest,frames,audio,events);
 assert.equal(field.focus('nonexistent'),null);
 const document=field.focus('VOL-01');
 assert.ok(document&&document.relations.length>0);
 assert.ok(document.relations.length>=index.links.filter(link=>link.source==='VOL-01'||link.target==='VOL-01').length);
 for(const relationship of document.relations.filter(item=>item.evidence.kind==='PAGE MENTION')){
  assert.equal(relationship.evidence.kind,'PAGE MENTION');
  assert.ok(relationship.evidence.documentId&&relationship.evidence.pageNumber);
  assert.ok(relationship.evidence.sourceUrl.endsWith(`#page=${relationship.evidence.pageNumber}`));
 }
 const person=field.focus('Dr. B. R. Ambedkar');
 assert.ok(person&&person.relations.length>0);
 assert.ok(person.relations.some(relation=>relation.evidence.kind==='PAGE CO-MENTION'));
 for(const frame of frames){
  const focus=field.focus(frame.id);
  assert.ok(focus&&focus.center.imageUrl===reviews[frame.id].assetUrl);
  assert.ok(focus.relations.some(relation=>relation.node.type==='PERSON'));
  assert.ok(focus.relations.every(relation=>relation.evidence.sourceUrl===frame.source_page_url));
  assert.ok(!focus.relations.some(relation=>relation.node.type==='AUDIO'),'no invented photograph-audio link');
 }
 const recording=field.focus('AMB-AUD-0001');
 assert.ok(recording&&recording.center.type==='AUDIO');
 assert.ok(recording.relations.some(relation=>relation.evidence.kind==='CATALOG METADATA'));
 for(const relation of recording.relations){
  const position=orbitalPosition(relation,0,recording.total);
  assert.ok(Object.values(position).every(Number.isFinite));
 }
 assert.ok(field.summaries.some(item=>item.type==='PLACE'));
 const candidate=events.find(event=>event.sourceReferences.some(ref=>manifest.some(doc=>doc.id===ref.documentId)));
 const event=field.focus(candidate.id);
 assert.equal(event.center.type,'EVENT');
 assert.match(event.center.description,/candidate.*review/i);
 assert.ok(event.relations.some(item=>item.evidence.kind==='EVENT CANDIDATE'&&item.evidence.sourceUrl.includes('#page=')));
 const {GET}=await vite.ssrLoadModule('/app/api/archive/gravity/route.ts');
 for(const [id,kind] of [['VOL-01','DOCUMENT'],['AMB-IMG-0005','PHOTOGRAPH'],['AMB-AUD-0001','AUDIO'],['Dr. B. R. Ambedkar','PERSON'],[candidate.id,'EVENT']]){
  const response=await GET(new Request('http://localhost/api/archive/gravity?entity='+encodeURIComponent(id)));
  assert.equal(response.status,200);
  assert.equal((await response.json()).center.type,kind);
 }
 const directory=await GET(new Request('http://localhost/api/archive/gravity?catalog=1'));
 assert.equal(directory.status,200);
 assert.ok((await directory.json()).objects.length>=index.nodes.length);
 console.log(`Archive Gravity: ${index.nodes.length} indexed entities, ${index.links.length} page-cited links, ${frames.length} published frames and dated event candidates; direct focus, provenance, missing links and layout verified.`);
}finally{await vite.close()}
