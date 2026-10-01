'use client';

import {useMemo,useRef} from 'react';
import {Canvas,useFrame} from '@react-three/fiber';
import {Html,OrbitControls,ContactShadows} from '@react-three/drei';
import * as THREE from 'three';
import {orbitalPosition,type GravityNode,type GravityRelation,type GravitySnapshot,type GravityPosition} from '../../services/gravity-engine';

function Form({node,central}:{node:GravityNode;central:boolean}){
 const color=node.type==='PHOTOGRAPH'?'#b79b73':node.type==='DOCUMENT'||node.type==='WORK'?'#e8d8bb':
  node.type==='PERSON'?'#91b9c4':node.type==='PLACE'?'#9db69c':
  node.type==='AUDIO'?'#b9a0bc':node.type==='INSTITUTION'?'#b8b3cc':
  node.type==='TOPIC'?'#bca38a':'#b7a2a1';
 const material=<meshStandardMaterial color={color} roughness={.56} metalness={node.type==='AUDIO'?.35:.12}/>;
 const size=central?1.2:.72;
 return <group scale={size}>
  {node.type==='PHOTOGRAPH'?<>
   <mesh castShadow><boxGeometry args={[1.22,.94,.09]}/><meshStandardMaterial color="#655a4d" metalness={.22} roughness={.53}/></mesh>
   <mesh position={[0,0,.052]}><planeGeometry args={[1.08,.8]}/><meshStandardMaterial color="#dbc9a8" roughness={.88}/></mesh>
   {node.imageUrl&&<Html transform position={[0,0,.065]} distanceFactor={1.8} pointerEvents="none" style={{width:96,height:70,overflow:'hidden'}}><img src={node.imageUrl} alt="" loading="lazy" style={{width:'100%',height:'100%',objectFit:'cover'}}/></Html>}
  </>:node.type==='DOCUMENT'||node.type==='WORK'?<>
   {[0,1,2].map(layer=><mesh key={layer} position={[layer*.018,-layer*.025,layer*.038]} castShadow><boxGeometry args={[.96,1.24,.036]}/><meshStandardMaterial color={layer===2?'#ebdfc5':'#aea18b'} roughness={.91}/></mesh>)}
   <mesh position={[0,.33,.135]}><boxGeometry args={[.57,.012,.005]}/>{material}</mesh>
   <mesh position={[-.15,.18,.135]}><boxGeometry args={[.56,.008,.005]}/>{material}</mesh>
  </>:node.type==='PERSON'?<>
   <mesh position={[0,-.42,0]} castShadow><cylinderGeometry args={[.42,.46,.1,16]}/><meshStandardMaterial color="#383d45" metalness={.25} roughness={.65}/></mesh>
   <mesh position={[0,-.08,0]} castShadow><cylinderGeometry args={[.32,.37,.59,14]}/>{material}</mesh>
   <mesh position={[0,.35,0]} castShadow><sphereGeometry args={[.22,14,12]}/>{material}</mesh>
  </>:node.type==='PLACE'?<>
   <mesh position={[0,-.37,0]} castShadow><cylinderGeometry args={[.55,.55,.06,32]}/><meshStandardMaterial color="#3a4642" roughness={.68}/></mesh>
   <mesh position={[0,-.08,0]} castShadow><coneGeometry args={[.25,.62,8]}/>{material}</mesh>
   <mesh position={[0,.29,0]}><sphereGeometry args={[.095,12,8]}/>{material}</mesh>
  </>:node.type==='AUDIO'?<>
   {[-2,-1,0,1,2].map((bar)=><mesh key={bar} position={[bar*.19,0,0]} castShadow><boxGeometry args={[.09,bar===0?.85:Math.abs(bar)===1?.57:.33,.16]}/>{material}</mesh>)}
   <mesh position={[0,-.52,0]}><boxGeometry args={[1.17,.055,.24]}/><meshStandardMaterial color="#44404a" roughness={.62}/></mesh>
  </>:node.type==='INSTITUTION'?<>
   <mesh position={[0,.43,0]} castShadow><boxGeometry args={[1.15,.15,.36]}/>{material}</mesh>
   {[-.39,0,.39].map(x=><mesh key={x} position={[x,-.06,0]} castShadow><cylinderGeometry args={[.07,.085,.86,8]}/>{material}</mesh>)}
   <mesh position={[0,-.53,0]} castShadow><boxGeometry args={[1.28,.09,.43]}/>{material}</mesh>
  </>:node.type==='TOPIC'?<>
   {[0,1,2].map(i=><mesh key={i} rotation={[0,i*.34,0]} position={[0,(i-1)*.15,0]} castShadow><octahedronGeometry args={[.43-i*.035,0]}/>{material}</mesh>)}
  </>:<>
   <mesh castShadow><boxGeometry args={[1.02,.6,.18]}/>{material}</mesh>
   <mesh position={[0,-.37,0]} castShadow><boxGeometry args={[.78,.05,.28]}/><meshStandardMaterial color="#494143" roughness={.66}/></mesh>
  </>}
 </group>;
}

function ArchiveObject({node,position,central,active,onFocus,onPointerDown,reduced}:{node:GravityNode;position:GravityPosition;central:boolean;active:boolean;onFocus:()=>void;onPointerDown:(event:React.PointerEvent)=>void;reduced:boolean}){
 const group=useRef<THREE.Group>(null);
 const initial=useRef(false);
 useFrame(({clock},delta)=>{
  const object=group.current;if(!object)return;
  if(!initial.current){object.position.set(position.x*1.34,position.y-.15,position.z*1.34);initial.current=true}
  const targetY=position.y+(reduced?0:Math.sin(clock.elapsedTime*.39+position.x)*.028);
  object.position.x=THREE.MathUtils.damp(object.position.x,position.x,3.6,delta);
  object.position.y=THREE.MathUtils.damp(object.position.y,targetY,3.6,delta);
  object.position.z=THREE.MathUtils.damp(object.position.z,position.z,3.6,delta);
  object.rotation.y=THREE.MathUtils.damp(object.rotation.y,central?.12:-.18,2.6,delta);
 });
 return <group ref={group}>
  <Form node={node} central={central}/>
  {central&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,-.7,0]}><ringGeometry args={[.78,.8,48]}/><meshBasicMaterial color="#c5a879" transparent opacity={.6} side={THREE.DoubleSide}/></mesh>}
  <Html position={[0,central?-1.14:.69,0]} center distanceFactor={central?8:10} zIndexRange={[12,3]} className="gravity-object-html">
   <button type="button" className={`gravity-object-label ${central?'central':''} ${active?'active':''}`}
    aria-label={`Focus ${node.label}, ${node.type.toLocaleLowerCase()}`} onClick={onFocus} onPointerDown={onPointerDown}>
    <small>{node.type==='EVENT REFERENCE'?'EVENT MENTION':node.type==='EVENT'?'EVENT CANDIDATE':node.type}</small><span>{node.label}</span>
   </button>
  </Html>
 </group>;
}

function EvidencePath({source,destination}:{source:GravityPosition;destination:GravityPosition}){
 const curve=useMemo(()=>new THREE.QuadraticBezierCurve3(new THREE.Vector3(source.x,source.y,source.z),
  new THREE.Vector3((source.x+destination.x)*.5,.63,(source.z+destination.z)*.5),
  new THREE.Vector3(destination.x,destination.y,destination.z)),[source.x,source.y,source.z,destination.x,destination.y,destination.z]);
 return <mesh><tubeGeometry args={[curve,32,.008,4,false]}/><meshBasicMaterial color="#cfb78f" transparent opacity={.8}/></mesh>;
}

function Room(){
 return <group>
  <color attach="background" args={['#101620']}/>
  <fog attach="fog" args={['#101620',12,26]}/>
  <ambientLight intensity={.7} color="#bfcee0"/>
  <spotLight position={[-5,8,5]} intensity={58} angle={.72} penumbra={.9} decay={2} distance={19} color="#f7e4c4" castShadow shadow-mapSize={[512,512]}/>
  <pointLight position={[5,3,-4]} intensity={14} distance={14} decay={2} color="#8daebf"/>
  <mesh position={[0,-2.65,0]} rotation={[-Math.PI/2,0,0]} receiveShadow>
   <planeGeometry args={[32,32]}/><meshStandardMaterial color="#222a34" metalness={.28} roughness={.63}/>
  </mesh>
  <ContactShadows position={[0,-2.62,0]} scale={13} opacity={.21} blur={2.7} far={8} resolution={256} color="#050708"/>
  <mesh position={[0,-2.22,-11]} receiveShadow><boxGeometry args={[27,7,.23]}/><meshStandardMaterial color="#1d2531" roughness={.9}/></mesh>
  {[-8,8].map(x=><mesh key={x} position={[x,-.1,-10.7]}><boxGeometry args={[.07,5.3,.08]}/><meshStandardMaterial color="#686052" roughness={.7} metalness={.23}/></mesh>)}
  <mesh position={[0,1.84,-10.79]}><boxGeometry args={[12,.025,.02]}/><meshBasicMaterial color="#b3a07c" transparent opacity={.45}/></mesh>
  {[2.35,3.55,4.8].map(radius=><mesh key={radius} rotation={[-Math.PI/2,0,0]} position={[0,-1.5,0]}>
   <ringGeometry args={[radius,radius+.008,96]}/><meshBasicMaterial color="#9b917c" transparent opacity={.18} side={THREE.DoubleSide}/></mesh>)}
 </group>;
}

export default function GravityField({snapshot,visibleRelations,selectedId,connection,pendingFocus,offset,onFocus,onBeginDrag,reduced,visible,onInteract}:{snapshot:GravitySnapshot;visibleRelations:GravityRelation[];selectedId:string|null;connection:{from:string;to:string}|null;pendingFocus:string|null;offset:Record<string,{x:number;y:number}>;onFocus:(id:string)=>void;onBeginDrag:(event:React.PointerEvent,id:string)=>void;reduced:boolean;visible:boolean;onInteract:(active:boolean)=>void}){
 const positions=useMemo(()=>new Map(visibleRelations.map((r,i)=>[r.node.id,orbitalPosition(r,i,snapshot.total)])),[visibleRelations,snapshot.total]);
 const pathPosition=(id:string)=>id===snapshot.center.id?{x:0,y:0,z:0}:positions.get(id);
 const from=connection&&pathPosition(connection.from),to=connection&&pathPosition(connection.to);
 return <Canvas className="gravity-canvas" shadows dpr={[1,1.6]} frameloop={visible?'always':'never'} camera={{position:[0,1.8,9.7],fov:48,near:.1,far:55}}
  gl={{antialias:true,powerPreference:'high-performance'}}>
  <Room/>
  <mesh position={[0,-.92,0]} receiveShadow><cylinderGeometry args={[.83,1.02,.13,48]}/><meshStandardMaterial color="#343946" metalness={.31} roughness={.56}/></mesh>
  <ArchiveObject key={snapshot.center.id} node={snapshot.center} position={pendingFocus&&pendingFocus!==snapshot.center.id?{x:-2.25,y:.14,z:-.55}:{x:0,y:0,z:0}} central active onFocus={()=>onFocus(snapshot.center.id)} onPointerDown={event=>onBeginDrag(event,snapshot.center.id)} reduced={reduced}/>
  {visibleRelations.map((relation)=>{
   const base=positions.get(relation.node.id)!,shift=offset[relation.node.id];
   return <ArchiveObject key={relation.node.id} node={relation.node}
    position={pendingFocus===relation.node.id?{x:0,y:0,z:0}:{x:base.x+(shift?.x||0),y:base.y+(shift?.y||0),z:base.z}}
    central={false} active={selectedId===relation.node.id}
    onFocus={()=>onFocus(relation.node.id)} onPointerDown={event=>onBeginDrag(event,relation.node.id)}
    reduced={reduced}/>;
  })}
  {from&&to&&<EvidencePath source={from} destination={to}/>}
  <OrbitControls makeDefault enableDamping dampingFactor={.08} minDistance={5.2} maxDistance={16}
   enablePan enableZoom autoRotate={!reduced&&visible} autoRotateSpeed={.14}
   minPolarAngle={.5} maxPolarAngle={2.2} onStart={()=>onInteract(true)} onEnd={()=>onInteract(false)}/>
 </Canvas>;
}
