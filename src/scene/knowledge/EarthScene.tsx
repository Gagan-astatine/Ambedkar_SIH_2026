'use client';
import {Suspense,useEffect,useMemo,useRef,useState,type ComponentRef,type MutableRefObject} from 'react';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {AdaptiveDpr,Html,OrbitControls,useTexture} from '@react-three/drei';
import * as THREE from 'three';

export type PlaceRecord={id:string;label:string;lat:number;lon:number;highlight?:{title:string}};
type Props={places:PlaceRecord[];active:string;onSelect:(id:string)=>void;resetToken:number;reduced:boolean;visible:boolean};
type Controls=ComponentRef<typeof OrbitControls>;
const up=new THREE.Vector3(0,1,0);
const toSphere=(lat:number,lon:number,r=2.5)=>{const phi=(90-lat)*Math.PI/180,theta=(lon+180)*Math.PI/180;return new THREE.Vector3(-r*Math.sin(phi)*Math.cos(theta),r*Math.cos(phi),r*Math.sin(phi)*Math.sin(theta))};

function SpaceBackdrop({compact}:{compact:boolean}){
 const positions=useMemo(()=>{const count=compact?36:75,values=new Float32Array(count*3);let seed=9281;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);for(let i=0;i<count;i++){const z=rand()*2-1,angle=rand()*Math.PI*2,r=22+rand()*13,span=Math.sqrt(1-z*z);values[i*3]=r*span*Math.cos(angle);values[i*3+1]=r*z;values[i*3+2]=r*span*Math.sin(angle)}return values},[compact]);
 return <points frustumCulled={false}><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions,3]}/></bufferGeometry><pointsMaterial color="#829eae" size={compact?.038:.045} sizeAttenuation transparent opacity={.42} depthWrite={false}/></points>;
}

function GeographicMarker({place,selected,onSelect,onDeepFocus,reduced,compact}:{place:PlaceRecord;selected:boolean;onSelect:()=>void;onDeepFocus:()=>void;reduced:boolean;compact:boolean}){
 const [hover,setHover]=useState(false),ref=useRef<THREE.Group>(null),pulse=useRef<THREE.Mesh>(null),world=useRef(new THREE.Vector3()),normal=useRef(new THREE.Vector3());
 const point=useMemo(()=>toSphere(place.lat,place.lon,2.515),[place.lat,place.lon]);
 const orientation=useMemo(()=>new THREE.Quaternion().setFromUnitVectors(up,point.clone().normalize()),[point]);
 useFrame(({camera,clock})=>{if(!ref.current)return;ref.current.getWorldPosition(world.current);normal.current.copy(world.current).normalize();ref.current.visible=normal.current.dot(camera.position.clone().sub(world.current))>-.04;const d=camera.position.distanceTo(world.current);ref.current.scale.setScalar(THREE.MathUtils.clamp(d/5.5,.78,1.18));if(pulse.current){const phase=reduced?.3:clock.elapsedTime*1.35;const size=1+(phase%1)*.85;pulse.current.scale.set(size,size,size);(pulse.current.material as THREE.MeshBasicMaterial).opacity=(selected?.34:.18)*(1-phase%1)}});
 return <group ref={ref} position={point} quaternion={orientation}>
  <mesh ref={pulse} rotation={[-Math.PI/2,0,0]} position={[0,.012,0]}><ringGeometry args={[.055,.06,24]}/><meshBasicMaterial color={selected?'#dfc08c':'#8ebec6'} transparent opacity={.2} depthWrite={false} side={THREE.DoubleSide}/></mesh>
  <mesh rotation={[-Math.PI/2,0,0]} position={[0,.015,0]}><ringGeometry args={[selected?.053:.038,selected?.057:.041,24]}/><meshBasicMaterial color={selected?'#e4c693':'#a4c2c7'} transparent opacity={selected?.85:.55} depthWrite={false} side={THREE.DoubleSide}/></mesh>
  <mesh position={[0,.025,0]}><sphereGeometry args={[selected?.027:.019,10,10]}/><meshBasicMaterial color={selected?'#f2d8a6':hover?'#d6e6e6':'#b8d2d6'}/></mesh>
  {selected&&<mesh position={[0,.075,0]}><cylinderGeometry args={[.006,.009,.11,6]}/><meshBasicMaterial color="#dfbd82" transparent opacity={.84}/></mesh>}
  <mesh position={[0,.065,0]} onClick={selected?undefined:e=>{e.stopPropagation();if(e.delta<6)onSelect()}} onDoubleClick={e=>{e.stopPropagation();onDeepFocus()}} onPointerOver={e=>{e.stopPropagation();setHover(true);document.body.style.cursor='pointer'}} onPointerOut={()=>{setHover(false);document.body.style.cursor='auto'}}><sphereGeometry args={[selected?.055:compact?.14:.105,8,8]}/><meshBasicMaterial transparent opacity={0} depthWrite={false}/></mesh>
  {hover&&!selected&&<Html center occlude distanceFactor={6} position={[0,.2,0]} style={{pointerEvents:'none'}}><div className="globe-marker-label"><strong>{place.label}</strong></div></Html>}
 </group>;
}

function Earth({places,active,onSelect,onDeepFocus,reduced,interactionUntil,compact,resetToken}:{places:PlaceRecord[];active:string;onSelect:(id:string)=>void;onDeepFocus:(id:string)=>void;reduced:boolean;interactionUntil:MutableRefObject<number>;compact:boolean;resetToken:number}){
 const texture=useTexture('/explorer/earth-atmos.jpg'),group=useRef<THREE.Group>(null),lastActive=useRef(active),lastReset=useRef(resetToken),aligning=useRef(false),resetting=useRef(false);
 useEffect(()=>{texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;texture.needsUpdate=true},[texture]);
 const selected=places.find(p=>p.id===active);
 useFrame(({camera},delta)=>{if(!group.current)return;const dt=Math.min(delta,.05);
  if(lastActive.current!==active){lastActive.current=active;aligning.current=!!selected}
  if(lastReset.current!==resetToken){lastReset.current=resetToken;resetting.current=true;aligning.current=false}
  if(selected&&aligning.current){const local=toSphere(selected.lat,selected.lon),target=Math.atan2(camera.position.x,camera.position.z)-Math.atan2(local.x,local.z),difference=Math.atan2(Math.sin(target-group.current.rotation.y),Math.cos(target-group.current.rotation.y));group.current.rotation.y+=difference*Math.min(1,dt*1.55);if(Math.abs(difference)<.018)aligning.current=false}
  else if(resetting.current){group.current.rotation.y=THREE.MathUtils.damp(group.current.rotation.y,0,1.8,dt);if(Math.abs(group.current.rotation.y)<.012)resetting.current=false}
  else if(!reduced&&performance.now()>interactionUntil.current)group.current.rotation.y+=dt*(selected?.009:.018);
 });
 return <group ref={group}>
  <mesh><sphereGeometry args={[2.5,compact?48:72,compact?32:48]}/><meshStandardMaterial map={texture} bumpMap={texture} bumpScale={.009} color="#d4dfe2" roughness={.94} metalness={0}/></mesh>
  <mesh><sphereGeometry args={[2.558,compact?48:64,compact?32:40]}/><shaderMaterial transparent depthWrite={false} blending={THREE.AdditiveBlending} uniforms={{tint:{value:new THREE.Color('#6bafcf')}}} vertexShader={'varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}'} fragmentShader={'uniform vec3 tint;varying vec3 n;varying vec3 v;void main(){float rim=pow(1.-abs(dot(normalize(n),normalize(v))),3.6);gl_FragColor=vec4(tint,rim*.18);}'}/></mesh>
  {places.map(p=><GeographicMarker key={p.id} place={p} selected={p.id===active} onSelect={()=>onSelect(p.id)} onDeepFocus={()=>onDeepFocus(p.id)} reduced={reduced} compact={compact}/>)}
 </group>;
}

function GlobeCamera({active,places,deep,resetToken,interactionUntil}:{active:string;places:PlaceRecord[];deep:number;resetToken:number;interactionUntil:MutableRefObject<number>}){
 const controls=useRef<Controls>(null),last=useRef(active),lastDeep=useRef(deep),lastReset=useRef(resetToken),moving=useRef(true),resetting=useRef(false),dragging=useRef(false),viewport=useRef('');
 const {size,camera}=useThree();
 useEffect(()=>{const c=controls.current;if(!c)return;const start=()=>{dragging.current=true;moving.current=false;interactionUntil.current=performance.now()+2400},end=()=>{dragging.current=false;interactionUntil.current=performance.now()+2400};c.addEventListener('start',start);c.addEventListener('end',end);return()=>{c.removeEventListener('start',start);c.removeEventListener('end',end)}},[interactionUntil]);
 useFrame((_,delta)=>{const c=controls.current;if(!c)return;const key=`${size.width}x${size.height}`;if(last.current!==active||lastDeep.current!==deep||viewport.current!==key){last.current=active;lastDeep.current=deep;viewport.current=key;moving.current=true}
  if(lastReset.current!==resetToken){lastReset.current=resetToken;resetting.current=true;moving.current=true}
  const fov=(camera as THREE.PerspectiveCamera).fov*Math.PI/180,half=Math.min(fov/2,Math.atan(Math.tan(fov/2)*size.width/Math.max(size.height,1))),overview=THREE.MathUtils.clamp(2.66/Math.sin(half),6.7,17);
  if(moving.current&&!dragging.current){const dt=Math.min(delta,.05),distance=active?overview*(deep?.76:.87):overview,place=places.find(p=>p.id===active),target=new THREE.Vector3(0,place?toSphere(place.lat,place.lon).y*.12:0,0),direction=camera.position.clone().sub(c.target).normalize(),next=THREE.MathUtils.damp(camera.position.distanceTo(c.target),distance,2.2,dt);
   if(resetting.current){direction.lerp(new THREE.Vector3(0,.08,1).normalize(),1-Math.exp(-dt*2)).normalize();if(direction.distanceTo(new THREE.Vector3(0,.08,1).normalize())<.008)resetting.current=false}
   c.target.lerp(target,1-Math.exp(-dt*2.2));camera.position.copy(c.target).addScaledVector(direction,next);
   if(Math.abs(next-distance)<.025&&c.target.distanceTo(target)<.025&&!resetting.current)moving.current=false}
  c.update();
 });
 return <OrbitControls ref={controls} enablePan={false} enableDamping dampingFactor={.07} minDistance={3.7} maxDistance={20} zoomSpeed={.68} rotateSpeed={.58} makeDefault/>;
}

export default function EarthScene({places,active,onSelect,resetToken,reduced,visible}:Props){
 const [supported,setSupported]=useState<boolean|null>(null),[deep,setDeep]=useState(0),[compact,setCompact]=useState(false),interactionUntil=useRef(0);
 useEffect(()=>{try{const canvas=document.createElement('canvas'),context=canvas.getContext('webgl2');setSupported(!!context);context?.getExtension('WEBGL_lose_context')?.loseContext()}catch{setSupported(false)}},[]);
 useEffect(()=>{const mq=matchMedia('(max-width: 700px)'),update=()=>setCompact(mq.matches);update();mq.addEventListener('change',update);return()=>mq.removeEventListener('change',update)},[]);
 useEffect(()=>setDeep(0),[active]);
 if(supported===null)return <div className="space-loading">Opening the Earth…</div>;
 if(!supported)return <div className="space-fallback"><strong>3D requires WebGL</strong><span>Select a place from the directory to inspect its connected records and cited pages.</span></div>;
 return <Canvas camera={{position:[0,.65,8],fov:45,near:.1,far:90}} dpr={[1,compact?1.3:1.7]} frameloop={visible?'always':'never'} gl={{antialias:true,alpha:false,powerPreference:'high-performance'}}>
  <color attach="background" args={['#02050b']}/><fog attach="fog" args={['#02050b',30,65]}/>
  <ambientLight intensity={.25}/><directionalLight position={[6,4,7]} intensity={2.5} color="#f8eedb"/><directionalLight position={[-6,-3,-5]} intensity={.22} color="#5688a6"/>
  <SpaceBackdrop compact={compact}/><AdaptiveDpr pixelated={false}/>
  <Suspense fallback={null}><Earth places={places} active={active} onSelect={onSelect} onDeepFocus={id=>{onSelect(id);setDeep(v=>v+1)}} resetToken={resetToken} reduced={reduced} interactionUntil={interactionUntil} compact={compact}/></Suspense>
  <GlobeCamera active={active} places={places} deep={deep} resetToken={resetToken} interactionUntil={interactionUntil}/>
 </Canvas>;
}
