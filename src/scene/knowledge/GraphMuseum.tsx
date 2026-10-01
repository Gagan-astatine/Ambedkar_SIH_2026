'use client';
import {useEffect,useMemo} from 'react';
import {ContactShadows,MeshReflectorMaterial} from '@react-three/drei';
import * as THREE from 'three';

const radius=12.8,wallStart=Math.PI*.65,wallLength=Math.PI*.7;

function useStoneGrain(){
 const texture=useMemo(()=>{const width=64,data=new Uint8Array(width*width*4);
  for(let i=0;i<width*width;i++){const grain=Math.sin(i*12.9898+78.233)*43758.5453,value=128+Math.floor((grain-Math.floor(grain)-.5)*7);data.set([value,value,value,255],i*4)}
  const map=new THREE.DataTexture(data,width,width,THREE.RGBAFormat);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(6,2);map.needsUpdate=true;return map},[]);
 useEffect(()=>()=>texture.dispose(),[texture]);return texture;
}
function ArcTrim({height,color,width=.025,opacity=1}:{height:number;color:string;width?:number;opacity?:number}){
 const curve=useMemo(()=>new THREE.CatmullRomCurve3(Array.from({length:49},(_,i)=>{const angle=wallStart+i/48*wallLength;return new THREE.Vector3(Math.sin(angle)*(radius-.06),height,Math.cos(angle)*(radius-.06))})),[height]);
 return <mesh><tubeGeometry args={[curve,96,width,6,false]}/><meshStandardMaterial color={color} metalness={.28} roughness={.64} transparent opacity={opacity}/></mesh>;
}
function ExhibitionRecess({side,grain}:{side:number;grain:THREE.Texture}){
 const x=side*5.55,z=-Math.sqrt(radius*radius-x*x)+.28;
 return <group position={[x,.42,z]} rotation={[0,-Math.asin(x/radius),0]}>
  <mesh position={[0,0,-.13]} receiveShadow><boxGeometry args={[3.85,5.65,.25]}/><meshStandardMaterial color="#c9c5bc" roughness={.94}/></mesh>
  <mesh position={[0,0,-.012]} receiveShadow><boxGeometry args={[3.48,5.3,.045]}/><meshStandardMaterial color="#e5e1d7" bumpMap={grain} bumpScale={.009} roughness={.94}/></mesh>
  <mesh position={[0,0,.018]}><planeGeometry args={[3.13,4.93]}/><meshStandardMaterial color="#dcd8cd" roughness={.98}/></mesh>
  {[-1,1].map(edge=><mesh key={edge} position={[edge*1.72,0,.043]}><boxGeometry args={[.026,5.32,.04]}/><meshStandardMaterial color="#aa9b7d" metalness={.45} roughness={.54}/></mesh>)}
  {[-1,1].map(edge=><mesh key={edge} position={[0,edge*2.66,.043]}><boxGeometry args={[3.49,.026,.04]}/><meshStandardMaterial color="#aa9b7d" metalness={.45} roughness={.54}/></mesh>)}
  <mesh position={[0,-2.47,.051]}><boxGeometry args={[2.35,.012,.018]}/><meshBasicMaterial color="#a99b81" transparent opacity={.5}/></mesh>
 </group>;
}

/** The museum is architectural scenery; the graph, its links and controls live elsewhere. */
export default function GraphMuseum(){
 const grain=useStoneGrain();
 return <group>
  <mesh position={[0,.12,0]} receiveShadow>
   <cylinderGeometry args={[radius,radius,10.35,80,1,true,wallStart,wallLength]}/>
   <meshStandardMaterial color="#e8e4da" roughness={.98} metalness={0} bumpMap={grain} bumpScale={.012} side={THREE.DoubleSide}/>
  </mesh>
  <ArcTrim height={-3.49} color="#bdb6a8" width={.075}/>
  <ArcTrim height={-2.74} color="#d4cfc2" width={.015}/>
  <ArcTrim height={4.56} color="#c6bdab" width={.042}/>
  <ArcTrim height={4.83} color="#f7f3e9" width={.028}/>
  <ExhibitionRecess side={-1} grain={grain}/><ExhibitionRecess side={1} grain={grain}/>
  {[-1,1].map(side=><group key={side} position={[side*9.7,.1,-6.55]} rotation={[0,-side*.22,0]}>
   <mesh receiveShadow castShadow><boxGeometry args={[.45,7.35,4.3]}/><meshStandardMaterial color="#e1ddd2" roughness={.91}/></mesh>
   <mesh position={[-side*.25,0,0]} receiveShadow><boxGeometry args={[.025,7.02,3.75]}/><meshStandardMaterial color="#d0c9bb" roughness={.9}/></mesh>
  </group>)}
  {[-1,1].map(side=><group key={side} position={[side*4.3,4.91,-6.3]}>
   <mesh receiveShadow><boxGeometry args={[5.45,.27,.76]}/><meshStandardMaterial color="#dfd9ce" roughness={.83}/></mesh>
   <mesh position={[0,-.145,.08]}><boxGeometry args={[4.7,.014,.35]}/><meshBasicMaterial color="#fff8e9" transparent opacity={.64}/></mesh>
  </group>)}
  <mesh position={[0,-3.54,0]} rotation={[-Math.PI/2,0,0]} receiveShadow>
   <planeGeometry args={[42,42]}/>
   <MeshReflectorMaterial resolution={256} blur={[250,140]} mixBlur={.88} mixStrength={.12} mirror={.045} depthScale={.05} minDepthThreshold={.85} maxDepthThreshold={1.1} color="#d9d6cc" metalness={.02} roughness={.89}/>
  </mesh>
  <ContactShadows position={[0,-3.525,0]} opacity={.18} scale={18} blur={2.8} far={8} resolution={256} color="#4c5353"/>
  <mesh position={[0,-3.43,0]} receiveShadow castShadow>
   <cylinderGeometry args={[6.35,6.43,.2,80]}/>
   <meshStandardMaterial color="#bdb8ae" metalness={.08} roughness={.88}/>
  </mesh>
  <mesh position={[0,-3.322,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[6.25,6.28,96]}/><meshStandardMaterial color="#a68d63" metalness={.55} roughness={.5}/></mesh>
  <spotLight position={[0,8,3]} target-position={[0,0,0]} color="#fff2de" intensity={3} angle={.82} penumbra={.9} distance={25} decay={2} castShadow shadow-mapSize={[512,512]} shadow-bias={-.0002}/>
  <pointLight position={[0,3,-6]} color="#fff5df" intensity={.8} distance={19} decay={2}/>
 </group>;
}
