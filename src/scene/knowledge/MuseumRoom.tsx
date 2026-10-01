import * as THREE from 'three';

/** Sparse gallery architecture positioned inside the default camera frustum. */
export default function MuseumRoom({floor=-3.45,compact=false}:{floor?:number;compact?:boolean}){
 const back=compact?-6.8:-10.5,wing=compact?4.75:8.1,frame=compact?3.35:5.65,frameWidth=compact?1.45:2.55;
 return <group>
  <mesh position={[0,.1,back]} renderOrder={-10}>
   <planeGeometry args={[compact?15:27,11]}/>
   <meshStandardMaterial color="#203038" roughness={.98} side={THREE.DoubleSide} depthWrite={false}/>
  </mesh>
  {[-1,1].map(side=><group key={side}>
   <mesh position={[side*wing,.1,back+3]} rotation={[0,-side*.18,0]} renderOrder={-9}>
    <planeGeometry args={[compact?3.1:5.2,10]}/>
    <meshStandardMaterial color="#17262e" roughness={1} side={THREE.DoubleSide} depthWrite={false}/>
   </mesh>
   <mesh position={[side*(wing-.3),.15,back+3.38]} castShadow>
    <boxGeometry args={[.25,7.1,.26]}/>
    <meshStandardMaterial color="#495153" metalness={.4} roughness={.64}/>
   </mesh>
   <mesh position={[side*(wing-.3),.15,back+3.53]}>
    <boxGeometry args={[.02,6.9,.015]}/>
    <meshBasicMaterial color="#ad9367" transparent opacity={.52} depthWrite={false}/>
   </mesh>
   <group position={[side*frame,.4,back+.045]} renderOrder={-8}>
    <mesh position={[0,0,.01]}>
     <planeGeometry args={[frameWidth,4.45]}/>
     <meshStandardMaterial color="#121f25" roughness={.87} side={THREE.DoubleSide} depthWrite={false}/>
    </mesh>
    {[-1,1].map(edge=><mesh key={edge} position={[edge*(frameWidth/2+.025),0,.07]}>
     <boxGeometry args={[.045,4.55,.04]}/><meshStandardMaterial color="#927e5d" metalness={.59} roughness={.42} depthWrite={false}/>
    </mesh>)}
    {[-1,1].map(edge=><mesh key={edge} position={[0,edge*2.27,.07]}>
     <boxGeometry args={[frameWidth+.09,.045,.04]}/><meshStandardMaterial color="#927e5d" metalness={.59} roughness={.42} depthWrite={false}/>
    </mesh>)}
    <mesh position={[0,0,.045]}><planeGeometry args={[frameWidth-.27,4.14]}/><meshBasicMaterial color="#263941" transparent opacity={.46} depthWrite={false}/></mesh>
   </group>
  </group>)}
  <mesh position={[0,3.75,back+1.5]} renderOrder={-7}>
   <boxGeometry args={[compact?10.3:17,.11,.32]}/><meshStandardMaterial color="#555958" metalness={.35} roughness={.69} depthWrite={false}/>
  </mesh>
  <mesh position={[0,floor-.08,0]} rotation={[-Math.PI/2,0,0]} receiveShadow>
   <planeGeometry args={[36,36]}/><meshStandardMaterial color="#1a2529" metalness={.1} roughness={.79}/>
  </mesh>
  <mesh position={[0,floor+.015,0]} receiveShadow castShadow>
   <cylinderGeometry args={[compact?3.05:6.35,compact?3.12:6.43,.14,80]}/>
   <meshStandardMaterial color="#293538" metalness={.24} roughness={.64}/>
  </mesh>
  <mesh position={[0,floor+.092,0]} rotation={[-Math.PI/2,0,0]}>
   <ringGeometry args={[compact?2.98:6.28,compact?3.01:6.31,96]}/>
   <meshBasicMaterial color="#a38e6b" transparent opacity={.46} depthWrite={false}/>
  </mesh>
  {[-1,1].map(side=><mesh key={side} position={[side*(compact?4.1:7.25),floor-.067,-3]}>
   <boxGeometry args={[.02,.005,14]}/><meshBasicMaterial color="#ac9b7b" transparent opacity={.23} depthWrite={false}/>
  </mesh>)}
  <pointLight position={[0,4,back+4]} color="#d5c9af" intensity={compact?2:4} distance={25} decay={2}/>
 </group>;
}
