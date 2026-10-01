'use client';
import {Component,Suspense,useEffect,useMemo,useRef,useState,type ComponentRef,type ReactNode} from 'react';
import {Canvas,useFrame,type ThreeEvent} from '@react-three/fiber';
import {Environment,Html,Lightformer,OrbitControls} from '@react-three/drei';
import * as THREE from 'three';
import {type GraphCommand,type GraphEntity,type GraphRelationship} from './types';
import GraphMuseum from './GraphMuseum';

type Controls=ComponentRef<typeof OrbitControls>;
type Props={nodes:GraphEntity[];links:GraphRelationship[];active:string;filter:string;selectedLink:number|null;onSelect:(id:string)=>void;onRelationship:(index:number)=>void;command:GraphCommand;running:boolean;reduced:boolean;visible:boolean};
const home=new THREE.Vector3(0,5.2,17.5);
const museumEntityColors:Record<string,string>={DOCUMENT:'#4c7395',BOOK:'#4c7395',WORK:'#728761',PERSON:'#ac705c',TOPIC:'#3e8d90',PLACE:'#ad8754',INSTITUTION:'#77749b','EVENT REFERENCE':'#a36b80',AUDIO:'#4e897f',VIDEO:'#4e897f',MEDIA:'#4e897f'};
const layers:Record<string,{radius:number;height:number;phase:number}>={
 DOCUMENT:{radius:5.25,height:-1.7,phase:.14},WORK:{radius:3.15,height:-.78,phase:2.8},
 TOPIC:{radius:3.45,height:.32,phase:.36},PERSON:{radius:2.25,height:2.24,phase:1.15},
 PLACE:{radius:4.55,height:1.6,phase:.8},INSTITUTION:{radius:2.7,height:2.38,phase:3.05},
 'EVENT REFERENCE':{radius:3.2,height:2.35,phase:4.4},AUDIO:{radius:3.15,height:-.78,phase:3.5},VIDEO:{radius:3.15,height:-.78,phase:4.5},MEDIA:{radius:3.15,height:-.78,phase:5.1}
};
// Only presentation coordinates change. Source IDs, edge meanings, counts and page references remain the archive index's.
export function spatialPositions(nodes:GraphEntity[]){
 const grouped=new Map<string,GraphEntity[]>();nodes.forEach(n=>grouped.set(n.type,[...(grouped.get(n.type)||[]),n]));
 return new Map(nodes.map(n=>{const group=grouped.get(n.type)!,i=group.indexOf(n),layer=layers[n.type]||layers.WORK;
  const theta=layer.phase+i/group.length*Math.PI*2;return[n.id,new THREE.Vector3(Math.cos(theta)*layer.radius,layer.height+Math.sin(theta*2)*.075,Math.sin(theta)*layer.radius)] as const}));
}
function galleryPositions(nodes:GraphEntity[],links:GraphRelationship[],active:string,overview:Map<string,THREE.Vector3>){
 if(!active||!overview.has(active))return overview;
 const weight=new Map<string,number>();
 links.filter(l=>l.source===active||l.target===active).forEach(l=>{const id=l.source===active?l.target:l.source;weight.set(id,Math.max(weight.get(id)||0,l.count))});
 const connected=[...weight].sort((a,b)=>b[1]-a[1]).map(([id])=>id);
 const positions=new Map([...overview].map(([id,p])=>[id,p.clone()]));positions.set(active,new THREE.Vector3(0,.3,0));
 connected.forEach((id,i)=>{const ring=i<12?0:i<30?1:2,start=ring===0?0:ring===1?12:30,size=Math.min(ring===0?12:ring===1?18:24,connected.length-start);
  const theta=(i-start)/size*Math.PI*2+(ring===1?.17:ring===2?.29:0),radius=[2.75,4.3,5.8][ring],height=[.65,-1.2,1.5][ring];
  positions.set(id,new THREE.Vector3(Math.cos(theta)*radius,height,Math.sin(theta)*radius));
 });return positions;
}
function Folio({color,opacity}:{color:string;opacity:number}){return <group rotation={[0,-.18,0]}>
 <mesh castShadow><boxGeometry args={[.42,.67,.12]}/><meshStandardMaterial color="#c6bbac" roughness={.78} transparent opacity={opacity}/></mesh>
 <mesh position={[-.045,0,.095]} castShadow><boxGeometry args={[.53,.74,.055]}/><meshPhysicalMaterial color={color} metalness={.18} roughness={.53} clearcoat={.14} transparent opacity={opacity}/></mesh>
 <mesh position={[-.29,0,0]}><boxGeometry args={[.045,.73,.19]}/><meshStandardMaterial color={color} metalness={.24} roughness={.5} transparent opacity={opacity}/></mesh>
 <mesh position={[.015,.15,.128]}><boxGeometry args={[.27,.012,.007]}/><meshBasicMaterial color="#ddd2ba" transparent opacity={opacity*.8}/></mesh>
 </group>}
function EntityForm({node,opacity}:{node:GraphEntity;opacity:number}){
 const color=museumEntityColors[node.type]||'#5e7980',material=<meshPhysicalMaterial color={color} emissive={color} emissiveIntensity={0} metalness={.16} roughness={.51} clearcoat={.18} clearcoatRoughness={.42} transparent opacity={opacity}/>;
 if(['DOCUMENT','BOOK','WORK'].includes(node.type))return <Folio color={color} opacity={opacity}/>;
 if(node.type==='PERSON')return <group><mesh castShadow position={[0,.13,0]}><sphereGeometry args={[.18,16,12]}/>{material}</mesh><mesh castShadow position={[0,-.17,0]}><cylinderGeometry args={[.16,.3,.37,12]}/>{material}</mesh><mesh position={[0,-.42,0]}><cylinderGeometry args={[.37,.41,.06,24]}/>{material}</mesh></group>;
 if(node.type==='INSTITUTION')return <group>{[-.23,0,.23].map(x=><mesh key={x} castShadow position={[x,0,0]}><boxGeometry args={[.07,.52,.16]}/>{material}</mesh>)}{[-.3,.31].map(y=><mesh key={y} position={[0,y,0]}><boxGeometry args={[.65,.07,.3]}/>{material}</mesh>)}</group>;
 if(node.type==='PLACE')return <group><mesh castShadow rotation={[0,Math.PI/4,0]} position={[0,.1,0]}><octahedronGeometry args={[.31,0]}/>{material}</mesh><mesh position={[0,-.32,0]}><cylinderGeometry args={[.16,.28,.26,12]}/>{material}</mesh></group>;
 if(node.type.includes('EVENT'))return <group><mesh castShadow><boxGeometry args={[.55,.49,.11]}/>{material}</mesh><mesh position={[0,0,.07]}><torusGeometry args={[.14,.018,6,24]}/><meshBasicMaterial color="#dfd0ae" transparent opacity={opacity}/></mesh></group>;
 if(['MEDIA','AUDIO','VIDEO'].includes(node.type))return <group><mesh castShadow><cylinderGeometry args={[.3,.3,.1,24]}/>{material}</mesh><mesh rotation={[Math.PI/2,0,0]} position={[0,.06,0]}><torusGeometry args={[.18,.015,6,24]}/>{material}</mesh></group>;
 return <mesh rotation={[0,.28,.18]} castShadow><octahedronGeometry args={[.36,0]}/>{material}</mesh>;
}
function Rail({radius,height,show,accent=false}:{radius:number;height:number;show:boolean;accent?:boolean}){
 const materials=useRef<THREE.MeshStandardMaterial[]>([]);
 useFrame((_,dt)=>materials.current.forEach(m=>{if(m)m.opacity=THREE.MathUtils.damp(m.opacity,show?(accent?.37:.22):.012,2.7,Math.min(dt,.05))}));
 return <group position={[0,height,0]} rotation={[Math.PI/2,0,0]}>
  {[0,.052].map((offset,i)=><mesh key={i}><torusGeometry args={[radius+offset,i===0?.02:.005,6,96]}/><meshStandardMaterial ref={m=>{if(m)materials.current[i]=m}} color={i===0?'#364d54':'#988260'} metalness={.73} roughness={.37} transparent opacity={.012} depthWrite={false}/></mesh>)}
  {show&&Array.from({length:12},(_,i)=>{const a=i/12*Math.PI*2;return <mesh key={i} position={[Math.cos(a)*radius,Math.sin(a)*radius,0]}><boxGeometry args={[.05,.05,.012]}/><meshBasicMaterial color="#b9aa8d" transparent opacity={accent?.35:.16}/></mesh>})}
 </group>
}
function ArchiveCore({focused}:{focused:boolean}){
 const ref=useRef<THREE.Group>(null);
 useFrame((_,dt)=>{if(ref.current)ref.current.scale.setScalar(THREE.MathUtils.damp(ref.current.scale.x,focused?.22:1,2.8,dt))});
 return <group ref={ref}>
  <mesh castShadow position={[0,-.7,0]}><boxGeometry args={[.84,3.2,.84]}/><meshPhysicalMaterial color="#26383c" metalness={.8} roughness={.32} clearcoat={.25} clearcoatRoughness={.32} transparent opacity={.83}/></mesh>
  <mesh position={[0,-.7,0]}><boxGeometry args={[.62,2.9,.62]}/><meshPhysicalMaterial color="#5c7579" metalness={.22} roughness={.2} transmission={.42} thickness={.28} transparent opacity={.55}/></mesh>
  {[-2.15,-1.45,-.7,0,.7].map(y=><group key={y} position={[0,y,0]}><mesh castShadow><boxGeometry args={[1.18,.047,1.18]}/><meshStandardMaterial color="#948363" metalness={.83} roughness={.3}/></mesh><mesh position={[0,.015,0]}><boxGeometry args={[.7,.01,.7]}/><meshBasicMaterial color="#c9b88e" transparent opacity={.38}/></mesh></group>)}
  <mesh position={[0,-.7,0]}><boxGeometry args={[.055,2.75,.055]}/><meshBasicMaterial color="#d5bc8d" transparent opacity={.54}/></mesh>
 </group>
}
function Entity({node,position,active,connected,filter,onSelect}:{node:GraphEntity;position:THREE.Vector3;active:string;connected:boolean;filter:string;onSelect:()=>void}){
 const ref=useRef<THREE.Group>(null),[hover,setHover]=useState(false);
 const materials=useRef<{material:THREE.Material&{opacity:number};base:number}[]>([]);
 const selected=node.id===active,dim=active?!connected&&!selected:filter!=='ALL'&&node.type!==filter;
 useEffect(()=>{const result:typeof materials.current=[];ref.current?.traverse(object=>{if(!(object instanceof THREE.Mesh))return;const list=Array.isArray(object.material)?object.material:[object.material];list.forEach(material=>{if(material?.transparent&&'opacity' in material)result.push({material:material as THREE.Material&{opacity:number},base:(material as THREE.Material&{opacity:number}).opacity})})});materials.current=result},[]);
 useFrame((_,dt)=>{if(!ref.current)return;ref.current.position.copy(position);ref.current.scale.setScalar(THREE.MathUtils.damp(ref.current.scale.x,selected?1.72:active?(connected?1.07:.7):hover?1.16:1,4.2,dt));materials.current.forEach(({material,base})=>{material.opacity=THREE.MathUtils.damp(material.opacity,base*(dim?.12:1),3.8,dt);if('emissiveIntensity' in material)(material as THREE.MeshStandardMaterial).emissiveIntensity=THREE.MathUtils.damp((material as THREE.MeshStandardMaterial).emissiveIntensity,selected?.18:connected&&active?.055:0,3.8,dt)})});
 return <group ref={ref} position={position} onClick={e=>{e.stopPropagation();if(e.delta<6)onSelect()}} onPointerOver={e=>{e.stopPropagation();setHover(true)}} onPointerOut={()=>setHover(false)}>
  <group position={[0,.28,0]}><EntityForm node={node} opacity={1}/></group>
  <mesh position={[0,-.25,0]} receiveShadow><cylinderGeometry args={[.37,.42,.075,20]}/><meshStandardMaterial color={selected?'#93784f':'#243941'} emissive={selected?'#93784f':'#243941'} emissiveIntensity={0} metalness={.72} roughness={.33} transparent opacity={.9}/></mesh>
  <mesh position={[0,-.202,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.29,.32,28]}/><meshBasicMaterial color={selected?'#ad8b56':connected&&active?'#476b72':'#526a6c'} transparent opacity={.72}/></mesh>
  <mesh visible={false}><sphereGeometry args={[.5,8,8]}/></mesh>
  {(selected||hover)&&<Html center distanceFactor={14} position={[0,1.02,0]} zIndexRange={[20,1]} style={{pointerEvents:'none'}}><div className={`space-label ${selected?'selected':''}`}><small>{node.type}</small><span>{node.label}</span></div></Html>}
 </group>
}
const segments=18,focusSegments=28;
function GalleryPaths({links,active,positions,selectedLink,onSelect}:{links:GraphRelationship[];active:string;positions:Map<string,THREE.Vector3>;selectedLink:number|null;onSelect:(index:number)=>void}){
 const [shown,setShown]=useState(0),[hover,setHover]=useState<number|null>(null),geometry=useRef<THREE.LineSegments>(null);
 const indices=useMemo(()=>links.map((l,i)=>({l,i})).filter(({l})=>l.source===active||l.target===active).sort((a,b)=>b.l.count-a.l.count).map(({i})=>i),[links,active]);
 useEffect(()=>{setShown(0);if(!active)return;let count=0;const timer=setInterval(()=>{count=Math.min(indices.length,count+4);setShown(count);if(count===indices.length)clearInterval(timer)},125);return()=>clearInterval(timer)},[active,indices]);
 const visible=indices.slice(0,shown),selected=hover??selectedLink;
 const shape=useMemo(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(visible.length*segments*6),3));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(visible.length*segments*6),3));return g},[visible.length]);
 const focusShape=useMemo(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(focusSegments*6),3));return g},[]);
 useEffect(()=>()=>shape.dispose(),[shape]);
 useEffect(()=>()=>focusShape.dispose(),[focusShape]);
 useFrame(()=>{const g=geometry.current?.geometry;if(!g)return;const p=g.getAttribute('position') as THREE.BufferAttribute,c=g.getAttribute('color') as THREE.BufferAttribute;
  visible.forEach((index,order)=>{const link=links[index],id=link.source===active?link.target:link.source,point=positions.get(id);if(!point)return;
   const angle=Math.atan2(point.z,point.x)+(index%5-2)*.018,from=point.clone().multiplyScalar(.97),to=new THREE.Vector3(Math.cos(angle+.15)*Math.hypot(point.x,point.z),point.y-.2,Math.sin(angle+.15)*Math.hypot(point.x,point.z));
   const control=from.clone().lerp(to,.5);control.y+=.17;
   const curve=new THREE.QuadraticBezierCurve3(from,control,to),color=new THREE.Color(index===selected?'#9d7644':'#365961');
   for(let j=0;j<segments;j++){const a=curve.getPoint(j/segments),b=curve.getPoint((j+1)/segments),k=(order*segments+j)*2;p.setXYZ(k,a.x,a.y,a.z);p.setXYZ(k+1,b.x,b.y,b.z);c.setXYZ(k,color.r,color.g,color.b);c.setXYZ(k+1,color.r,color.g,color.b)}
  });p.needsUpdate=true;c.needsUpdate=true;g.computeBoundingSphere();
  if(selected!==null){const link=links[selected],id=link?.source===active?link.target:link?.target===active?link.source:null,point=id?positions.get(id):null;
   if(point){const path=new THREE.CubicBezierCurve3(new THREE.Vector3(0,.3,0),new THREE.Vector3(point.x*.22,Math.max(.85,point.y+.55),point.z*.22),new THREE.Vector3(point.x*.72,point.y+.42,point.z*.72),point.clone());const attribute=focusShape.getAttribute('position') as THREE.BufferAttribute;
    for(let i=0;i<focusSegments;i++){const a=path.getPoint(i/focusSegments),b=path.getPoint((i+1)/focusSegments);attribute.setXYZ(i*2,a.x,a.y,a.z);attribute.setXYZ(i*2+1,b.x,b.y,b.z)}attribute.needsUpdate=true;focusShape.computeBoundingSphere()}
  }
 });
 const pick=(event:ThreeEvent<MouseEvent|PointerEvent>)=>visible[Math.floor((event.index??0)/(segments*2))];
 const shownLink=selected!==null?links[selected]:null,point=shownLink?positions.get(shownLink.source===active?shownLink.target:shownLink.source):null;
 return <>{visible.length>0&&<lineSegments ref={geometry} geometry={shape} onClick={e=>{const index=pick(e);if(index!==undefined&&e.delta<6){e.stopPropagation();onSelect(index)}}} onPointerMove={e=>{const index=pick(e);if(index!==undefined){e.stopPropagation();setHover(index)}}} onPointerOut={()=>setHover(null)}><lineBasicMaterial vertexColors transparent opacity={.7} depthWrite={false}/></lineSegments>}
 {active&&shownLink&&<lineSegments geometry={focusShape} onClick={e=>{e.stopPropagation();if(e.delta<6)onSelect(selected!)}}><lineBasicMaterial color="#997748" transparent opacity={.6} depthWrite={false}/></lineSegments>}
 {shownLink&&point&&<Html center distanceFactor={13} position={[point.x*.94,point.y+.5,point.z*.94]} zIndexRange={[19,1]} style={{pointerEvents:'none'}}><div className="space-edge-label"><span>{shownLink.relation.replaceAll('_',' ')}</span><small>{shownLink.sources[0]?`${shownLink.sources[0].documentId} · PDF page ${shownLink.sources[0].pageNumber}`:'No page source recorded'}</small><small>{shownLink.sources.length} cited passage{shownLink.sources.length===1?'':'s'} · click path to inspect</small></div></Html>}
 </>;
}
function Sculpture(props:Props){
 const root=useRef<THREE.Group>(null),controls=useRef<Controls>(null);
 const overview=useMemo(()=>spatialPositions(props.nodes),[props.nodes]);
 const gallery=useMemo(()=>galleryPositions(props.nodes,props.links,props.active,overview),[props.nodes,props.links,props.active,overview]);
 const current=useMemo(()=>new Map([...overview].map(([id,p])=>[id,p.clone()])),[overview]);
 const connected=useMemo(()=>new Set(props.links.filter(l=>l.source===props.active||l.target===props.active).flatMap(l=>[l.source,l.target])),[props.links,props.active]);
 const dragging=useRef(false),spin=useRef(1),request=useRef({active:'',sequence:-1}),destination=useRef<THREE.Vector3|null>(null);
 useEffect(()=>{const c=controls.current;if(!c)return;const start=()=>{dragging.current=true;destination.current=null},end=()=>{dragging.current=false};c.addEventListener('start',start);c.addEventListener('end',end);return()=>{c.removeEventListener('start',start);c.removeEventListener('end',end)}},[]);
 useFrame(({camera,pointer,size},delta)=>{
  const dt=Math.min(.05,delta),g=root.current,c=controls.current;
  if(g){spin.current=THREE.MathUtils.damp(spin.current,props.running&&!props.reduced&&!dragging.current?1:0,2.2,dt);g.rotation.y+=dt*.042*spin.current;g.rotation.x=THREE.MathUtils.damp(g.rotation.x,props.reduced?0:pointer.y*.032,2.1,dt);g.rotation.z=THREE.MathUtils.damp(g.rotation.z,props.reduced?0:-pointer.x*.018,2.1,dt)}
  for(const [id,position] of current){const target=gallery.get(id);if(target)position.lerp(target,1-Math.exp(-dt*2.8))}
  if(!c)return;
  if(request.current.active!==props.active||request.current.sequence!==props.command.sequence){
   const changed=request.current.active!==props.active;request.current={active:props.active,sequence:props.command.sequence};
   const kind=changed&&props.active?'connections':props.command.kind;
   if(kind==='in'||kind==='out')destination.current=camera.position.clone().sub(c.target).normalize().multiplyScalar(THREE.MathUtils.clamp(camera.position.distanceTo(c.target)*(kind==='in'?.8:1.25),3.2,38));
   else{const radius=kind==='focus'?2.1:props.active?6.2:6.7,fov=(camera as THREE.PerspectiveCamera).fov*Math.PI/180;
    const angle=Math.min(fov/2,Math.atan(Math.tan(fov/2)*size.width/size.height));const distance=THREE.MathUtils.clamp(radius/Math.sin(angle)*1.04,kind==='focus'?5.5:12,38);
    const direction=kind==='reset'?home.clone().normalize():camera.position.clone().sub(c.target).normalize();destination.current=direction.multiplyScalar(distance)}
  }
  if(destination.current&&!dragging.current){const desired=destination.current,desiredTarget=new THREE.Vector3(0,props.active?.18:0,0),t=props.reduced?1:1-Math.exp(-dt*2.5);
   c.target.lerp(desiredTarget,t);camera.position.lerp(desiredTarget.clone().add(desired),t);
   if(camera.position.distanceTo(desiredTarget.clone().add(desired))<.025&&c.target.distanceTo(desiredTarget)<.025)destination.current=null}
  c.update();
 });
 return <>
  <color attach="background" args={['#e6e2d8']}/><fog attach="fog" args={['#e6e2d8',30,58]}/>
  <ambientLight intensity={.62}/><directionalLight position={[6,10,7]} color="#fff4e3" intensity={1.6} castShadow shadow-mapSize={[1024,1024]} shadow-bias={-.00018} shadow-normalBias={.025} shadow-radius={2} shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10} shadow-camera-far={35}/><pointLight position={[-5,3,-4]} color="#f5e8d5" intensity={1.1}/>
  <Suspense fallback={null}><Environment resolution={128} frames={1}><Lightformer position={[0,8,0]} rotation={[Math.PI/2,0,0]} scale={[10,10,1]} intensity={1.1} color="#f6eee0"/><Lightformer position={[5,1,2]} rotation={[0,-Math.PI/2,0]} scale={[3,6,1]} intensity={.6} color="#dcc6a4"/></Environment></Suspense>
  <GraphMuseum/>
  <group ref={root}>
   <ArchiveCore focused={!!props.active}/>
   {[['DOCUMENT',5.25,-1.7],['TOPIC',3.45,.32],['PLACE',4.55,1.6],['PERSON',2.25,2.24]].map(([type,r,y])=><Rail key={String(type)} radius={r as number} height={y as number} show={!props.active} accent={type==='DOCUMENT'}/>)}
   {[[2.75,.65],[4.3,-1.2],[5.8,1.5]].map(([r,y])=><Rail key={r} radius={r} height={y} show={!!props.active} accent/>)}
   {props.active&&[-1.05,.4,1.15].map(y=><mesh key={y} position={[0,y/2,0]}><cylinderGeometry args={[.013,.013,Math.abs(y)+.25,6]}/><meshBasicMaterial color="#d0ba90" transparent opacity={.33}/></mesh>)}
   <GalleryPaths links={props.links} active={props.active} positions={current} selectedLink={props.selectedLink} onSelect={props.onRelationship}/>
   {props.nodes.map(n=><Entity key={n.id} node={n} position={current.get(n.id)!} active={props.active} connected={connected.has(n.id)} filter={props.filter} onSelect={()=>props.onSelect(n.id)}/>)}
  </group>
  <OrbitControls ref={controls} enablePan={false} enableDamping dampingFactor={.07} minDistance={3.2} maxDistance={38} zoomSpeed={.72} rotateSpeed={.62} maxPolarAngle={Math.PI*.88} makeDefault/>
 </>;
}
class SceneBoundary extends Component<{children:ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return{failed:true}}render(){return this.state.failed?<div className="space-fallback">3D rendering is unavailable. Select an entity from the directory to inspect every relationship and source.</div>:this.props.children}}
export default function KnowledgeSpace(props:Props){
 const [supported,setSupported]=useState<boolean|null>(null);
 useEffect(()=>{try{const canvas=document.createElement('canvas'),context=canvas.getContext('webgl2');setSupported(!!context);context?.getExtension('WEBGL_lose_context')?.loseContext()}catch{setSupported(false)}},[]);
 if(supported===null)return <div className="space-loading">Opening the knowledge space…</div>;
 if(!supported)return <div className="space-fallback"><strong>3D requires WebGL</strong><span>Your browser cannot create a 3D view. All entities, connections and cited pages remain available in the directory.</span></div>;
 return <SceneBoundary><Canvas shadows camera={{position:home.toArray(),fov:48,near:.1,far:100}} dpr={[1,1.6]} frameloop={props.visible?'always':'never'} gl={{antialias:true,alpha:false,powerPreference:'high-performance'}} onCreated={({raycaster})=>{raycaster.params.Line={threshold:.18}}}><Sculpture {...props}/></Canvas></SceneBoundary>;
}
