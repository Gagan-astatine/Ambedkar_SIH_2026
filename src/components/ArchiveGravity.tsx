'use client';

import {Component,lazy,Suspense,useEffect,useMemo,useRef,useState,type ReactNode} from 'react';
import Link from 'next/link';
import {ArrowLeft,ArrowRight,ArrowUpRight,Focus,Maximize2,RotateCcw,Search,BookOpen,Move3D} from 'lucide-react';
import {orbitalPosition,type GravityRelation,type GravitySnapshot} from '../services/gravity-engine';
import './archive-gravity.css';

const Scene=lazy(()=>import('../scene/gravity/GravityField'));
class SceneBoundary extends Component<{children:ReactNode;fallback:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true}}
 render(){return this.state.failed?this.props.fallback:this.props.children}
}
type Summary={id:string;label:string;type:string};
const start='Dr. B. R. Ambedkar';
const sourceNote=(relation:GravityRelation)=>relation.evidence.kind==='CATALOG METADATA'?'Catalog metadata · confirm attribution at the source':
 relation.evidence.method==='OCR'?'OCR transcription · verify against the original PDF':'Indexed PDF text · inspect the original page';
function Evidence({relation}:{relation:GravityRelation}){
 const evidence=relation.evidence;
 return <div className="gravity-evidence" aria-live="polite">
  <small>{evidence.kind} / {evidence.relation}</small>
  <h3>{relation.node.label}</h3>
  <p>{evidence.kind==='PAGE CO-MENTION'?'These names appear together on an indexed page. This does not prove a historical relationship.':
   evidence.kind==='PAGE MENTION'?'This indexed page mentions the selected object. A mention does not establish authorship, participation or causation.':
   evidence.kind==='EVENT CANDIDATE'?'The timeline extractor associated this dated candidate with this PDF page. Its date and interpretation still need human review.':
   'This connection comes from a reviewed catalog record; follow its original source for attribution.'}</p>
  <blockquote>{evidence.excerpt}</blockquote>
  <dl><div><dt>SOURCE</dt><dd>{evidence.sourceLabel}</dd></div>
   {evidence.documentId&&<div><dt>DOCUMENT</dt><dd>{evidence.documentId}</dd></div>}
   {evidence.pageNumber&&<div><dt>PAGE</dt><dd>{evidence.pageNumber}</dd></div>}
   {evidence.count&&<div><dt>INDEXED OCCURRENCES</dt><dd>{evidence.count.toLocaleString()}</dd></div>}
  </dl>
  <p className="gravity-caution">{sourceNote(relation)}</p>
  <a href={evidence.sourceUrl} target="_blank" rel="noopener noreferrer">OPEN ORIGINAL SOURCE <ArrowUpRight size={14}/></a>
 </div>;
}

export default function ArchiveGravity(){
 const [catalog,setCatalog]=useState<Summary[]>([]),[snapshot,setSnapshot]=useState<GravitySnapshot|null>(null);
 const [requested,setRequested]=useState(()=>typeof window==='undefined'?start:new URLSearchParams(window.location.search).get('entity')||start);
 const [busy,setBusy]=useState(true),[error,setError]=useState(''),[activeRelation,setActiveRelation]=useState<string|null>(null);
 const [visibleCount,setVisibleCount]=useState(12),[webgl,setWebgl]=useState(false),[reduced,setReduced]=useState(false),[inView,setInView]=useState(true);
 const [dragOffset,setDragOffset]=useState<Record<string,{x:number;y:number}>>({}),[dragMessage,setDragMessage]=useState('');
 const [interacting,setInteracting]=useState(false);
 const [pendingFocus,setPendingFocus]=useState<string|null>(null);
 const [discovery,setDiscovery]=useState<{from:string;to:string;fromLabel:string;toLabel:string;relation:GravityRelation}|null>(null);
 const stage=useRef<HTMLDivElement>(null),abort=useRef<AbortController|null>(null),discoveryAbort=useRef<AbortController|null>(null),suppressClick=useRef(0);
 useEffect(()=>{
  let live=true;let gl:WebGLRenderingContext|null=null;
  try{gl=document.createElement('canvas').getContext('webgl')}catch{/* Accessible source list remains usable. */}
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const update=()=>setReduced(motion.matches);
  queueMicrotask(()=>{if(live){setWebgl(!!gl);update()}});
  motion.addEventListener('change',update);
  fetch('/api/archive/gravity?catalog=1').then(async response=>{if(!response.ok)throw Error('Object directory unavailable.');return response.json() as Promise<{objects:Summary[]}>})
   .then(result=>{if(live)setCatalog(result.objects)}).catch(()=>{/* The focused field can still open. */});
  const observer=new IntersectionObserver(([entry])=>setInView(entry.isIntersecting),{threshold:0});
  if(stage.current)observer.observe(stage.current);
  const visibility=()=>setInView(!document.hidden&&!!stage.current&&stage.current.getBoundingClientRect().bottom>0&&stage.current.getBoundingClientRect().top<innerHeight);
  document.addEventListener('visibilitychange',visibility);
  return()=>{live=false;observer.disconnect();motion.removeEventListener('change',update);document.removeEventListener('visibilitychange',visibility);abort.current?.abort();discoveryAbort.current?.abort()};
 },[]);
 useEffect(()=>{
  const controller=new AbortController();abort.current?.abort();abort.current=controller;
  queueMicrotask(()=>{if(!controller.signal.aborted){setBusy(true);setError('');setDragMessage('')}});
  const next=fetch(`/api/archive/gravity?entity=${encodeURIComponent(requested)}`,{signal:controller.signal})
   .then(async response=>{const value=await response.json() as GravitySnapshot&{error?:string};if(!response.ok)throw Error(value.error||'Archive field unavailable.');return value});
  Promise.all([next,new Promise<void>(resolve=>setTimeout(resolve,reduced?0:560))])
   .then(([value])=>{if(!controller.signal.aborted){setSnapshot(value);setActiveRelation(null);setDiscovery(null);setVisibleCount(12);setDragOffset({});setPendingFocus(null)}})
   .catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Archive field unavailable.')})
   .finally(()=>{if(!controller.signal.aborted)setBusy(false)});
  return()=>controller.abort();
 },[requested,reduced]);
 const relations=snapshot?.relations||[];
 const visible=relations.slice(0,visibleCount);
 const selected=relations.find(item=>item.id===activeRelation),shownEvidence=discovery?.relation||selected;
 const nodeList=useMemo(()=>catalog.slice().sort((a,b)=>a.label.localeCompare(b.label)),[catalog]);
 const groups=useMemo(()=>[
  {label:'ARCHIVAL SOURCES',types:['DOCUMENT','WORK']},
  {label:'PEOPLE, PLACES & IDEAS',types:['PERSON','PLACE','INSTITUTION','TOPIC','EVENT REFERENCE']},
  {label:'PHOTOGRAPHS & AUDIO',types:['PHOTOGRAPH','AUDIO']},
  {label:'SOURCE-EXTRACTED EVENT CANDIDATES',types:['EVENT']},
 ].map(group=>({...group,items:nodeList.filter(item=>group.types.includes(item.type))})).filter(group=>group.items.length),[nodeList]);
 const focus=(id:string)=>{
  if(Date.now()<suppressClick.current)return;
  discoveryAbort.current?.abort();
  if(id!==requested){setDiscovery(null);setPendingFocus(id);setRequested(id);history.replaceState(null,'',`/archive/gravity?entity=${encodeURIComponent(id)}`)}
  else{setActiveRelation(null);stage.current?.scrollIntoView({behavior:reduced?'instant':'smooth',block:'center'})}
 };
 const reset=()=>{discoveryAbort.current?.abort();setDiscovery(null);setPendingFocus(start);setRequested(start);history.replaceState(null,'','/archive/gravity');setActiveRelation(null);setVisibleCount(12);setDragOffset({});setDragMessage('')};
 const selectRelation=(relation:GravityRelation)=>{
  const index=relations.findIndex(item=>item.id===relation.id);
  setVisibleCount(value=>Math.max(value,index+1));setActiveRelation(relation.id);setDiscovery(null);setDragMessage('');
 };
 const drag=(event:React.PointerEvent,id:string)=>{
  if(event.button!==0||!snapshot||id===snapshot.center.id)return;
  const button=event.currentTarget as HTMLElement,origin={x:event.clientX,y:event.clientY},pointer=event.pointerId;
  discoveryAbort.current?.abort();
  let moved=false;button.setPointerCapture(pointer);
  setInteracting(true);
  const onMove=(next:PointerEvent)=>{
   if(next.pointerId!==pointer)return;
   const x=next.clientX-origin.x,y=next.clientY-origin.y;
   if(Math.abs(x)+Math.abs(y)>7)moved=true;
   if(moved)setDragOffset(old=>({...old,[id]:{x:x*.012,y:-y*.012}}));
  };
  const finish=async(next:PointerEvent)=>{
   if(next.pointerId!==pointer)return;
   button.removeEventListener('pointermove',onMove);button.removeEventListener('pointerup',finish);
   button.removeEventListener('pointercancel',finish);
   if(button.hasPointerCapture(pointer))button.releasePointerCapture(pointer);
   setInteracting(false);
   if(!moved)return;
   suppressClick.current=Date.now()+350;
   const offset={x:(next.clientX-origin.x)*.012,y:-(next.clientY-origin.y)*.012};
   const index=visible.findIndex(item=>item.node.id===id);
   const base=visible[index]?orbitalPosition(visible[index],index,snapshot.total):{x:0,y:0,z:0};
   const position={x:base.x+offset.x,y:base.y+offset.y,z:base.z};
   const possible=[{id:snapshot.center.id,label:snapshot.center.label,position:{x:0,y:0,z:0}},
    ...visible.filter(item=>item.node.id!==id).map(item=>({
     id:item.node.id,label:item.node.label,
     position:orbitalPosition(item,visible.findIndex(other=>other.id===item.id),snapshot.total),
    }))];
   const closest=possible.map(item=>({...item,distance:Math.hypot(position.x-item.position.x,position.y-item.position.y,position.z-item.position.z)}))
    .sort((a,b)=>a.distance-b.distance)[0];
   setDragOffset(old=>({...old,[id]:{x:0,y:0}}));
   if(closest?.distance<1.6&&closest.id===snapshot.center.id){
    const relation=relations.find(item=>item.node.id===id);
    if(relation){selectRelation(relation);setDragMessage('Source-backed connection to the center revealed.')}
   }else if(closest?.distance<1.6){
    setDragMessage('Checking the page index for a direct link…');
    try{
     const controller=new AbortController();discoveryAbort.current=controller;
     const response=await fetch(`/api/archive/gravity?entity=${encodeURIComponent(closest.id)}`,{signal:controller.signal});
     if(!response.ok)throw Error('Relationship unavailable');
     const field=await response.json() as GravitySnapshot;
     if(controller.signal.aborted)return;
     const evidence=field.relations.find(item=>item.node.id===id);
     if(evidence){setDiscovery({from:id,to:closest.id,fromLabel:visible.find(item=>item.node.id===id)?.node.label||id,toLabel:closest.label,relation:evidence});setActiveRelation(null);setDragMessage('A source-backed connection was found. Inspect the cited record.')}
     else{setDiscovery(null);setDragMessage('No direct source-backed link is recorded between these objects.')}
    }catch{if(!discoveryAbort.current?.signal.aborted)setDragMessage('The relationship check is unavailable. No connection was inferred.')}
   }else setDragMessage('Object returned to its source-linked orbit. Moving it does not change the archive.');
  };
  button.addEventListener('pointermove',onMove);
  button.addEventListener('pointerup',finish);
  button.addEventListener('pointercancel',finish);
 };
 const fallback=<div className="gravity-fallback"><span>3D VIEW UNAVAILABLE</span><p>Explore the same archival connections through the source list below.</p></div>;
 return <div className="gravity-shell"><header className="gravity-header"><Link href="/"><ArrowLeft size={16}/> DIGITAL HERITAGE ARCHIVE</Link><span>ARCHIVE GRAVITY / AN EVIDENCE INSTALLATION</span><Link href="/explore#graph">KNOWLEDGE SCULPTURE <ArrowUpRight size={15}/></Link></header>
  <main><div className="gravity-intro"><span>ONE OBJECT · ITS DIRECT CONNECTIONS</span><h1>History has <em>gravity.</em></h1><p>Select an archival object. Its page-linked records gather around it. Distance is a visual rule, never a claim about historical certainty.</p></div>
   <div className="gravity-layout"><div className="gravity-work"><div className="gravity-topbar"><label htmlFor="gravity-object">FOCUS OBJECT</label><select id="gravity-object" value={snapshot&&nodeList.some(item=>item.id===snapshot.center.id)?snapshot.center.id:requested} onChange={event=>focus(event.target.value)} disabled={!nodeList.length}>{nodeList.length?groups.map(group=><optgroup key={group.label} label={group.label}>{group.items.map(item=><option key={item.id} value={item.id}>{item.label} · {item.type==='EVENT'?'CANDIDATE':item.type}</option>)}</optgroup>):<option value={requested}>Opening archive directory…</option>}</select><span>{snapshot?`${snapshot.total} source-linked relationships`:'Loading cited records…'}</span></div>
    <div className="gravity-stage" ref={stage} aria-label="Source-linked spatial archive field">
     {snapshot&&(webgl?<SceneBoundary fallback={fallback}><Suspense fallback={<p className="gravity-stage-state" role="status">Preparing the 3D field…</p>}><Scene snapshot={snapshot} visibleRelations={visible} selectedId={discovery?.from||selected?.node.id||null} connection={discovery?{from:discovery.from,to:discovery.to}:selected?{from:snapshot.center.id,to:selected.node.id}:null} pendingFocus={pendingFocus} offset={dragOffset} onFocus={focus} onBeginDrag={drag} reduced={reduced||interacting} visible={inView} onInteract={setInteracting}/></Suspense></SceneBoundary>:fallback)}
     {!snapshot&&<div className="gravity-stage-state" role={error?'alert':'status'}>{error||'Gathering the indexed source relationships…'}{error&&<button onClick={reset}>RETURN TO START</button>}</div>}
     {busy&&snapshot&&<div className="gravity-transition" role="status">REORGANIZING THE EVIDENCE…</div>}
     {snapshot&&<div className="gravity-stage-caption"><span>{snapshot.center.type==='EVENT'?'EVENT CANDIDATE':snapshot.center.type}</span><strong>{snapshot.center.label}</strong></div>}
    </div>
    <div className="gravity-controls"><span>DRAG TO ORBIT · SCROLL TO ZOOM · DRAG AN OBJECT TOWARD THE CENTER</span><div><button onClick={reset}><RotateCcw size={15}/> RESET</button><button onClick={()=>{setActiveRelation(null);stage.current?.scrollIntoView({behavior:reduced?'instant':'smooth',block:'center'})}}><Focus size={15}/> FOCUS</button><button onClick={()=>{setVisibleCount(relations.length);stage.current?.scrollIntoView({behavior:reduced?'instant':'smooth',block:'center'})}}><Maximize2 size={15}/> FIT</button></div></div>
    {dragMessage&&<p className="gravity-drag-message" role="status">{dragMessage}</p>}
    {snapshot&&<div className="gravity-relationship-list"><div><span>DIRECT SOURCE LINKS</span><small>{snapshot.rule}</small></div>
     {relations.length?<div className="gravity-link-grid">{visible.map(relation=><button key={relation.id} className={selected?.id===relation.id?'active':''} onClick={()=>selectRelation(relation)}><span>{relation.node.type==='EVENT'?'EVENT CANDIDATE':relation.node.type}</span><strong>{relation.node.label}</strong><small>{relation.evidence.relation} · {relation.evidence.sourceLabel}</small><ArrowRight size={13}/></button>)}</div>:<div className="gravity-empty"><p>Few linked records are currently available for this object.</p><Link href="/archive"><Search size={14}/> SEARCH THE ARCHIVE</Link></div>}
     {relations.length>visible.length&&<button className="gravity-more" onClick={()=>setVisibleCount(value=>Math.min(relations.length,value+12))}>REVEAL NEXT {Math.min(12,relations.length-visible.length)} OBJECTS <ArrowRight size={14}/></button>}
    </div>}
   </div>
   <aside className="gravity-inspector">{snapshot?<><span className="gravity-eyebrow">THE CENTER / {snapshot.center.type==='EVENT'?'EVENT CANDIDATE':snapshot.center.type}</span><h2>{snapshot.center.label}</h2><p>{snapshot.center.description}</p>
    {snapshot.center.year&&<small>{snapshot.center.year}</small>}
    {snapshot.center.imageUrl&&<img className="gravity-inspector-image" src={snapshot.center.imageUrl} alt={snapshot.center.label} loading="lazy"/>}
    {snapshot.center.sourceUrl&&<a className="gravity-open" href={snapshot.center.sourceUrl} target="_blank" rel="noopener noreferrer"><BookOpen size={15}/> OPEN RECORD <ArrowUpRight size={14}/></a>}
    <div className="gravity-count"><strong>{snapshot.total}</strong><span>direct connections in the current index</span></div>
    {shownEvidence?<>{discovery&&<p className="gravity-cross-heading">BETWEEN {discovery.fromLabel} AND {discovery.toLabel}</p>}<Evidence relation={shownEvidence}/></>:<div className="gravity-instruction"><Move3D size={22}/><p>Select a relationship to inspect its exact source and PDF page. Click an object to make it the new center.</p></div>}
    <p className="gravity-note">Indexed mentions, catalog attributions and OCR are shown as distinct evidence types. Spatial proximity does not create an archival relationship.</p>
   </>:<p role="status">Select an object to reveal its evidence.</p>}</aside></div>
  </main></div>;
}
