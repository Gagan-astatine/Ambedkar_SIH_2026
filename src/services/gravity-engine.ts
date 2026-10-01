import type {ArchiveFrame} from './frames';
import type {SourceReference} from '../scene/knowledge/types';

export type GravityKind='DOCUMENT'|'PERSON'|'PLACE'|'TOPIC'|'EVENT REFERENCE'|'INSTITUTION'|'WORK'|'PHOTOGRAPH'|'AUDIO'|'EVENT';
export type GravityNode={
 id:string;label:string;type:GravityKind;description:string;sourceUrl?:string;
 imageUrl?:string;year?:number|string|null;sourceLabel?:string;mentionCount?:number;
};
export type GravityEvidence={
 kind:'PAGE MENTION'|'PAGE CO-MENTION'|'CATALOG METADATA'|'EVENT CANDIDATE';
 relation:string;sourceUrl:string;sourceLabel:string;excerpt:string;method?:string;
 documentId?:string;pageNumber?:number;count?:number;
};
export type GravityRelation={id:string;node:GravityNode;evidence:GravityEvidence};
export type GravitySnapshot={center:GravityNode;relations:GravityRelation[];total:number;rule:string};
export type GravityPosition={x:number;y:number;z:number};
export function orbitalPosition(relation:GravityRelation,index:number,total:number):GravityPosition{
 // Layout tiers reflect source-link type, not historical strength or certainty.
 const tier=relation.evidence.kind==='CATALOG METADATA'?0:relation.evidence.kind==='PAGE MENTION'?1:2;
 const angle=index*2.399963229728653+total*.13;
 const radius=2.15+tier*.62+(index%3)*.15;
 return {x:Math.cos(angle)*radius,y:Math.sin(index*1.7)*.7,z:Math.sin(angle)*radius*.72};
}
export type GravityIndex={
 nodes:{id:string;label:string;type:string;mentionCount:number}[];
 links:{source:string;target:string;relation:string;count:number;sources:SourceReference[]}[];
};
export type GravityMedia={
 id:string;title:string;description?:string;year?:number;
 source_page_url?:string;event?:{name?:string};people_present?:{name:string}[];
 review?:{status:string};
};
export type GravityEvent={
 id:string;title:string;description:string;year:number;dateLabel:string;reviewStatus:string;
 sourceReferences:{documentId:string;pageNumber:number;sourceText:string;method:string;documentTitle:string}[];
};
type Document={id:string;title:string;source?:string};

const sourceUrl=(ref:SourceReference)=>`/api/archive/supplied?documentId=${encodeURIComponent(ref.documentId)}#page=${ref.pageNumber}`;
const normalize=(text:string)=>text.normalize('NFKD').toLocaleLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const idPart=(text:string)=>encodeURIComponent(text.toLocaleLowerCase());

/** A compact, source-only field. Co-mentions never become causal relationships. */
export function buildGravityField(index:GravityIndex,documents:Document[],frames:ArchiveFrame[],media:GravityMedia[],events:GravityEvent[]=[]){
 const docs=new Map(documents.map(document=>[document.id,document]));
 const nodes=new Map<string,GravityNode>();
 const edges:{a:string;b:string;evidence:GravityEvidence}[]=[];
 for(const item of index.nodes){
  const doc=docs.get(item.id);
  const type=item.type as GravityKind;
  nodes.set(item.id,{
   id:item.id,label:doc?.title||item.label,type,mentionCount:item.mentionCount,
   description:type==='DOCUMENT'?'Indexed source document. Open an original PDF page from its relationships.':`An indexed ${type.toLocaleLowerCase()} mention. A mention alone does not establish historical participation.`,
   sourceUrl:doc?`/api/archive/supplied?documentId=${encodeURIComponent(doc.id)}`:undefined,
   sourceLabel:doc?.source,
  });
 }
 for(const link of index.links){
  if(!nodes.has(link.source)||!nodes.has(link.target))continue;
  const ref=link.sources.find(source=>source.documentId&&Number.isInteger(source.pageNumber)&&source.pageNumber>0&&source.sourceText);
  if(!ref)continue;
  const co=link.relation==='CO_MENTIONED_ON_PAGE';
  edges.push({a:link.source,b:link.target,evidence:{
   kind:co?'PAGE CO-MENTION':'PAGE MENTION',relation:co?'CO-MENTIONED ON PAGE':link.relation.replaceAll('_',' '),
   sourceUrl:sourceUrl(ref),sourceLabel:`${docs.get(ref.documentId)?.title||ref.documentId} · PDF page ${ref.pageNumber}`,
   excerpt:ref.sourceText,method:ref.method,documentId:ref.documentId,pageNumber:ref.pageNumber,count:link.count,
  }});
 }
 const graphByName=new Map([...nodes.values()].filter(node=>node.type!=='DOCUMENT').map(node=>[normalize(node.label),node.id]));
 const catalogEdge=(a:string,b:string,relation:string,source:string,label:string,excerpt:string)=>{
  if(!nodes.has(a)||!nodes.has(b)||!source)return;
  edges.push({a,b,evidence:{kind:'CATALOG METADATA',relation,sourceUrl:source,sourceLabel:label,excerpt}});
 };
 const namedNode=(label:string,type:GravityKind,prefix:string,description:string)=>{
  const exact=graphByName.get(normalize(label));
  if(exact)return exact;
  const id=`${prefix}:${idPart(label)}`;
  if(!nodes.has(id))nodes.set(id,{id,label,type,description});
  return id;
 };
 for(const frame of frames){
  if(!frame.source_page_url)continue;
  nodes.set(frame.id,{id:frame.id,label:frame.title,type:'PHOTOGRAPH',description:frame.description,
   year:frame.year,imageUrl:frame.display_url||frame.thumbnail_url||frame.image_url,
   sourceUrl:frame.source_page_url,sourceLabel:frame.sourceLabel});
  const record=`Photograph catalog record ${frame.id}`;
  if(frame.event?.name){
   const event=namedNode(frame.event.name,'EVENT',`event:${frame.id}`,
    'An event label recorded in a photograph caption; attribution should be checked against the original.');
   catalogEdge(frame.id,event,'CAPTIONED EVENT',frame.source_page_url,record,
    `The photograph metadata names “${frame.event.name}”. The caption does not independently verify the depicted event.`);
  }
  for(const person of frame.people_present||[]){
   if(!person.name?.trim())continue;
   const id=namedNode(person.name,'PERSON',`person:${frame.id}`,'A person named in the photograph metadata.');
   catalogEdge(frame.id,id,'NAMED IN PHOTOGRAPH RECORD',frame.source_page_url,record,
    `The photograph metadata names ${person.name}. This is a recorded attribution, not automated face identification.`);
  }
  if(frame.locationLabel&&frame.locationLabel!=='Location unrecorded'){
   const place=namedNode(frame.locationLabel,'PLACE',`place:${frame.id}`,
    'A place label supplied with the photograph metadata; not a verified incident coordinate.');
   catalogEdge(frame.id,place,'RECORDED LOCATION',frame.source_page_url,record,
    `The photograph record lists ${frame.locationLabel} as its location.`);
  }
 }
 for(const item of media){
  if(item.review?.status!=='SOURCE_PAGE_MATCHED'||!item.source_page_url)continue;
  nodes.set(item.id,{id:item.id,label:item.title,type:'AUDIO',description:item.description||'Reviewed audio catalog record.',
   year:item.year,sourceUrl:item.source_page_url,sourceLabel:'Reviewed audio source page'});
  const record=`Audio catalog record ${item.id}`;
  if(item.event?.name){
   const event=namedNode(item.event.name,'EVENT',`event:${item.id}`,
    'An event label in the audio catalog. The recording itself requires source review.');
   catalogEdge(item.id,event,'AUDIO CATALOG EVENT',item.source_page_url,record,
    `The reviewed audio catalog names “${item.event.name}”. This does not authenticate every spoken passage.`);
  }
  for(const person of item.people_present||[]){
   if(!person.name?.trim())continue;
   const id=namedNode(person.name,'PERSON',`person:${item.id}`,'A person listed by the audio catalog.');
   catalogEdge(item.id,id,'NAMED IN AUDIO CATALOG',item.source_page_url,record,
    `The reviewed audio catalog names ${person.name}; inspect its source for attribution.`);
  }
 }
 // The timeline extractor emits candidates. Their page anchors are searchable,
 // but no candidate is silently promoted to a verified historical incident.
 for(const event of events){
  if(event.reviewStatus!=='CANDIDATE'||!event.sourceReferences.length)continue;
  const refs=event.sourceReferences.filter(ref=>docs.has(ref.documentId)&&Number.isInteger(ref.pageNumber)&&ref.pageNumber>0&&ref.sourceText?.trim());
  if(!refs.length)continue;
  const ref=refs[0];
  nodes.set(event.id,{id:event.id,label:event.title,type:'EVENT',
   description:`Source-extracted event candidate dated ${event.dateLabel}. ${event.description} This date and attribution need review against the original PDF page.`,
   year:event.year,sourceUrl:`/api/archive/supplied?documentId=${encodeURIComponent(ref.documentId)}#page=${ref.pageNumber}`,
   sourceLabel:`${ref.documentTitle} · PDF page ${ref.pageNumber}`});
  const seen=new Set<string>();
  for(const page of refs){
   if(seen.has(page.documentId))continue;
   seen.add(page.documentId);
   edges.push({a:event.id,b:page.documentId,evidence:{
    kind:'EVENT CANDIDATE',relation:'EXTRACTED FROM INDEXED PAGE',
    sourceUrl:`/api/archive/supplied?documentId=${encodeURIComponent(page.documentId)}#page=${page.pageNumber}`,
    sourceLabel:`${page.documentTitle} · PDF page ${page.pageNumber}`,
    excerpt:page.sourceText,method:page.method,documentId:page.documentId,pageNumber:page.pageNumber,
   }});
  }
 }
 const adjacency=new Map<string,{neighbor:string;evidence:GravityEvidence}[]>();
 for(const edge of edges)for(const [id,neighbor] of [[edge.a,edge.b],[edge.b,edge.a]]){
  const list=adjacency.get(id)||[];list.push({neighbor,evidence:edge.evidence});adjacency.set(id,list);
 }
 const summaries=[...nodes.values()].map(({id,label,type})=>({id,label,type}));
 function focus(requested?:string):GravitySnapshot|null{
  const center=nodes.get(requested||'Dr. B. R. Ambedkar');if(!center)return null;
  const relations=(adjacency.get(center.id)||[]).map(({neighbor,evidence},i)=>({
   id:`${center.id}:${neighbor}:${i}`,node:nodes.get(neighbor)!,evidence,
  })).sort((a,b)=>{
   const priority=(r:GravityRelation)=>r.evidence.kind==='CATALOG METADATA'?0:r.evidence.kind==='PAGE MENTION'?1:2;
   return priority(a)-priority(b)||a.node.label.localeCompare(b.node.label);
  });
  return {center,relations,total:relations.length,
   rule:'Distance indicates source-link type and layout spacing only. It is not a measure of historical importance or certainty.'};
 }
 return {summaries,focus};
}
