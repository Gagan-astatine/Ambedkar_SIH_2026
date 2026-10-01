'use client';
import {ContactShadows,Environment,Lightformer,RoundedBox} from '@react-three/drei';
import {useFrame, useThree} from '@react-three/fiber';
import {useEffect,useMemo,useRef} from 'react';
import * as THREE from 'three';
import {BOOK_PAGE_WIDTH as pageWidth,BOOK_PAGE_HEIGHT as pageHeight,sampleBookPage} from './book-geometry';
import {createReadingPageGeometry,createPaperLayerGeometry} from './book-mesh';
import {BOOK_ROTATION,BOOK_ELEVATION,frameReadingBook} from './book-view';

export type BookEntry={year:string;quote:string;source:string;page:number};
export type BookTurn={from:BookEntry;to:BookEntry;direction:1|-1};
export type BookMotion={progress:number;target:number;dragging:boolean};

function canvasTexture(draw:(ctx:CanvasRenderingContext2D)=>void,width=1024,height=1400){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d')!;draw(ctx);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}
function wrap(ctx:CanvasRenderingContext2D,text:string,maxWidth:number,maxLines:number){
 const words=text.split(/\s+/);const lines:string[]=[];let line='';
 for(const word of words){const next=line?`${line} ${word}`:word;if(ctx.measureText(next).width>maxWidth&&line){lines.push(line);line=word}else line=next}
 if(line)lines.push(line);return lines.slice(0,maxLines);
}
function paperTexture(entry:BookEntry,side:'quote'|'verso'|'back'){
 return canvasTexture(c=>{
  const gradient=c.createLinearGradient(0,0,1024,0);gradient.addColorStop(0,side==='quote'?'#c8bca8':'#f1e8d6');gradient.addColorStop(.08,'#e9dfcb');gradient.addColorStop(.56,'#f3ead8');gradient.addColorStop(1,'#e4d9c3');c.fillStyle=gradient;c.fillRect(0,0,1024,1400);
  // A low-contrast fibre pattern is part of the paper, rather than a decal over the text.
  c.fillStyle='rgba(77,60,38,.055)';for(let i=0;i<1900;i++){const x=(i*619.31)%1024,y=(i*997.13)%1400;c.fillRect(x,y,i%7===0?2:1,1)}
  c.strokeStyle='rgba(129,105,68,.31)';c.lineWidth=2;c.beginPath();c.moveTo(91,100);c.lineTo(933,100);c.moveTo(91,1298);c.lineTo(933,1298);c.stroke();
  c.fillStyle='#806846';c.font='24px Arial';c.letterSpacing='4px';c.fillText('DIGITAL HERITAGE ARCHIVE',92,76);
  c.letterSpacing='2px';c.font='21px Arial';c.fillText(`ARCHIVAL READING  /  ${entry.year}`,92,1340);
  c.textAlign='right';c.fillText(String(entry.page),932,1340);c.textAlign='left';
  if(side==='back'){
   c.fillStyle='#b9a888';c.font='italic 45px Georgia';c.textAlign='center';c.fillText('Words that endure',512,715);c.textAlign='left';return;
  }
  if(side==='verso'){
   c.fillStyle='#a3885a';c.font='26px Arial';c.letterSpacing='5px';c.fillText('THE READING ROOM',111,228);
   c.fillStyle='#283a40';c.font='176px Georgia';c.letterSpacing='0px';c.fillText(entry.year,105,465);
   c.fillStyle='#ae9161';c.fillRect(111,505,164,3);
   c.fillStyle='#536065';c.font='32px Georgia';const source=entry.source.split(' · ')[0];wrap(c,source,760,3).forEach((line,i)=>c.fillText(line,111,648+i*49));
   c.fillStyle='#927952';c.font='23px Arial';c.letterSpacing='3px';c.fillText('ORIGINAL WORDS  /  SOURCE RECORD',111,1166);return;
  }
  c.fillStyle='#a08253';c.font='25px Arial';c.letterSpacing='5px';c.fillText('ORIGINAL QUOTATION',108,221);
  c.fillStyle='#27383d';c.letterSpacing='0px';c.font='54px Georgia';c.fillText(entry.year,108,306);
  const fontSize=entry.quote.length>118?59:entry.quote.length>82?66:78;c.font=`${fontSize}px Georgia`;
  const lines=wrap(c,`“${entry.quote}”`,788,9);const lineHeight=fontSize*1.31;
  const start=Math.max(376,615-lines.length*lineHeight*.39);
  lines.forEach((line,i)=>c.fillText(line,106,start+i*lineHeight));
  c.fillStyle='#b39462';c.fillRect(110,1093,126,3);
  c.fillStyle='#526066';c.font='29px Georgia';wrap(c,entry.source.split(' · ')[0],770,2).forEach((line,i)=>c.fillText(line,110,1170+i*39));
  c.fillStyle='#967c54';c.font='22px Arial';c.letterSpacing='2px';c.fillText(`SOURCE  /  PDF PAGE ${entry.page}`,110,1264);
 });
}
function clothTexture(){return canvasTexture(c=>{
 c.fillStyle='#122a37';c.fillRect(0,0,256,256);
 c.strokeStyle='rgba(197,212,210,.06)';c.lineWidth=1;
 for(let i=0;i<256;i+=3){c.beginPath();c.moveTo(i,0);c.lineTo(i,256);c.stroke();c.beginPath();c.moveTo(0,i);c.lineTo(256,i);c.stroke()}
 },256,256)}
function coverTexture(){return canvasTexture(c=>{
 c.fillStyle='#122a37';c.fillRect(0,0,768,1024);
 c.fillStyle='rgba(218,196,146,.035)';for(let i=0;i<1700;i++){const x=(i*293)%768,y=(i*571)%1024;c.fillRect(x,y,1,2)}
 c.strokeStyle='#a68c5a';c.lineWidth=3;c.strokeRect(48,48,672,928);c.lineWidth=1;c.strokeRect(63,63,642,898);
 c.fillStyle='#b49b6b';c.textAlign='center';c.font='20px Arial';c.letterSpacing='5px';c.fillText('DIGITAL HERITAGE ARCHIVE',384,190);
 c.font='66px Georgia';c.letterSpacing='0px';c.fillText('WORDS THAT',384,440);c.fillText('ENDURE',384,520);
 c.fillRect(327,572,114,2);c.font='22px Georgia';c.fillText('Dr. B. R. Ambedkar',384,634);
 c.font='18px Arial';c.letterSpacing='4px';c.fillText('AN ARCHIVAL READING',384,870);
 },768,1024)}
function paperGrain(){return canvasTexture(c=>{
 c.fillStyle='#808080';c.fillRect(0,0,256,256);
 for(let i=0;i<4500;i++){c.fillStyle=i%2?'#777777':'#898989';c.fillRect((i*73)%256,(i*131)%256,1,i%5===0?3:1)}
},256,256)}
function orientLeaf(geometry:THREE.BufferGeometry,side:1|-1){
 if(side===-1&&geometry.index){const indices=geometry.index.array;for(let i=0;i<indices.length;i+=3){const swap=indices[i+1];indices[i+1]=indices[i+2];indices[i+2]=swap}geometry.index.needsUpdate=true}
 return geometry;
}
function mirrorTexture(texture:THREE.Texture){texture.repeat.x=-1;texture.offset.x=1;return texture}
function Page({entry,side,grain,variant='quote'}:{entry:BookEntry;side:1|-1;grain:THREE.Texture;variant?:'quote'|'verso'|'back'}){
 const texture=useMemo(()=>{const texture=paperTexture(entry,variant);return side===-1?mirrorTexture(texture):texture},[entry,variant,side]);
 const geometry=useMemo(()=>createReadingPageGeometry(side),[side]);
 useEffect(()=>()=>texture.dispose(),[texture]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 return <mesh geometry={geometry} receiveShadow castShadow><meshStandardMaterial map={texture} bumpMap={grain} bumpScale={.003} roughness={.91} side={THREE.DoubleSide}/></mesh>;
}
function PageBlock({side}:{side:1|-1}){
 const geometry=useMemo(()=>createPaperLayerGeometry(side),[side]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 return <group>{Array.from({length:20},(_,i)=><mesh key={i} geometry={geometry} position-z={-i*.018} castShadow={i===0} receiveShadow><meshStandardMaterial color={i%3===0?'#cbbda3':i%3===1?'#e7ddc9':'#d9ccb5'} roughness={1} side={THREE.DoubleSide}/></mesh>)}</group>;
}
function TurningPage({turn,motion,grain}:{turn:BookTurn;motion:React.MutableRefObject<BookMotion>;grain:THREE.Texture}){
 const geometry=useMemo(()=>orientLeaf(new THREE.PlaneGeometry(pageWidth,pageHeight,32,20),turn.direction),[turn.direction]);
 const original=useMemo(()=>Float32Array.from(geometry.attributes.position.array),[geometry]);
 const front=useMemo(()=>{const texture=paperTexture(turn.from,turn.direction===1?'quote':'verso');return turn.direction===-1?mirrorTexture(texture):texture},[turn]);
 const reverse=useMemo(()=>{const texture=paperTexture(turn.to,turn.direction===1?'verso':'quote');return turn.direction===1?mirrorTexture(texture):texture},[turn]);
 const edge=useMemo(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array((32*2+20)*6*3),3));return g},[]);
 const lastProgress=useRef(-1);
 useEffect(()=>()=>{geometry.dispose();edge.dispose();front.dispose();reverse.dispose()},[geometry,edge,front,reverse]);
 useFrame(()=>{
  const p=motion.current.progress;if(Math.abs(p-lastProgress.current)<.00001)return;lastProgress.current=p;
  const positions=geometry.attributes.position as THREE.BufferAttribute;
  for(let i=0;i<positions.count;i++){
   const u=(original[i*3]+pageWidth/2)/pageWidth,v=original[i*3+1]/(pageHeight/2);
   const [x,y,z]=sampleBookPage(u,v,p,turn.direction);positions.setXYZ(i,x,y,z+.007);
  }
  positions.needsUpdate=true;geometry.computeVertexNormals();
  // A thin extruded paper edge catches light along the moving leaf.
  const normals=geometry.attributes.normal as THREE.BufferAttribute,ep=edge.attributes.position as THREE.BufferAttribute;let cursor=0;
  const put=(index:number,offset:number)=>{ep.setXYZ(cursor++,positions.getX(index)+normals.getX(index)*offset,positions.getY(index)+normals.getY(index)*offset,positions.getZ(index)+normals.getZ(index)*offset)};
  const quad=(a:number,b:number)=>{put(a,.003);put(b,.003);put(b,-.003);put(a,.003);put(b,-.003);put(a,-.003)};
  for(let i=0;i<32;i++){quad(i,i+1);quad(20*33+i,20*33+i+1)}
  for(let row=0;row<20;row++)quad(row*33+32,(row+1)*33+32);
  ep.needsUpdate=true;edge.computeVertexNormals();
 });
 return <group>
  <mesh geometry={geometry} frustumCulled={false} castShadow receiveShadow><meshStandardMaterial map={front} bumpMap={grain} bumpScale={.003} roughness={.9} side={THREE.FrontSide}/></mesh>
  <mesh geometry={geometry} frustumCulled={false} castShadow receiveShadow><meshStandardMaterial map={reverse} bumpMap={grain} bumpScale={.003} roughness={.9} side={THREE.BackSide}/></mesh>
  <mesh geometry={edge} frustumCulled={false}><meshStandardMaterial color="#d4c6a8" roughness={1} side={THREE.DoubleSide}/></mesh>
 </group>;
}
function Museum({reduced,compact}:{reduced:boolean;compact:boolean}){
 const dust=useMemo(()=>{const count=compact?18:48,array=new Float32Array(count*3);for(let i=0;i<count;i++){array[i*3]=Math.sin(i*13.17)*6;array[i*3+1]=.3+(i*17%34)/10;array[i*3+2]=-3.5+Math.cos(i*5.47)*3}return array},[compact]);
 const particles=useRef<THREE.Points>(null);
 useFrame((_,delta)=>{if(particles.current&&!reduced)particles.current.rotation.y+=delta*.003});
 return <>
  <color attach="background" args={['#0b1720']}/><fog attach="fog" args={['#0b1720',8,18]}/>
  <ambientLight intensity={.4}/><hemisphereLight args={['#f4e7c9','#101c23',.65]}/><Environment resolution={128} frames={1}><Lightformer intensity={1.4} color="#fff1d4" position={[-3,5,2]} rotation-x={-Math.PI/3} scale={[5,3,1]}/><Lightformer intensity={.6} color="#b8ced8" position={[4,2,-2]} rotation-y={-Math.PI/2} scale={[3,4,1]}/></Environment>
  <directionalLight position={[-2.8,6.3,3.5]} color="#f9dfaf" intensity={2.5} castShadow shadow-mapSize={[1024,1024]} shadow-camera-left={-5} shadow-camera-right={5} shadow-camera-top={5} shadow-camera-bottom={-5} shadow-bias={-.00025} shadow-normalBias={.015} shadow-radius={3}/>
  <pointLight position={[3,2,-3]} color="#9bb9c1" intensity={9} distance={12}/>
  <mesh rotation-x={-Math.PI/2} position={[0,-.69,0]} receiveShadow><planeGeometry args={[35,35]}/><meshStandardMaterial color="#111e27" roughness={.81} metalness={.08}/></mesh>
  <mesh position={[0,-.55,0]} castShadow receiveShadow><boxGeometry args={[8.8,.24,5.5]}/><meshStandardMaterial color="#33434a" metalness={.15} roughness={.63}/></mesh>
  <mesh position={[0,-.417,2.72]}><boxGeometry args={[8.8,.009,.015]}/><meshStandardMaterial color="#856f4d" metalness={.55} roughness={.5}/></mesh>
  <mesh position={[0,-.42,-2.72]}><boxGeometry args={[8.8,.009,.015]}/><meshStandardMaterial color="#856f4d" metalness={.55} roughness={.5}/></mesh>
  <mesh position={[0,1.8,-5.4]} receiveShadow><boxGeometry args={[15,5,.15]}/><meshStandardMaterial color="#17252e" roughness={.93}/></mesh>
  {[-5.2,5.2].map(x=><mesh key={x} position={[x,1.6,-5.28]}><boxGeometry args={[.055,3.2,.08]}/><meshStandardMaterial color="#776a52" metalness={.45} roughness={.63}/></mesh>)}
  <mesh position={[0,3.15,-5.27]}><boxGeometry args={[10.3,.025,.09]}/><meshBasicMaterial color="#aa9066" transparent opacity={.33}/></mesh>
  <points ref={particles} position={[0,0,-1]}><bufferGeometry><bufferAttribute attach="attributes-position" args={[dust,3]}/></bufferGeometry><pointsMaterial color="#c6b48e" size={.014} transparent opacity={.18} depthWrite={false}/></points>
 </>;
}
export default function ReadingBookScene({entry,turn,motion,pointer,reduced,compact,context}:{entry:BookEntry;previous:BookEntry;next:BookEntry;turn:BookTurn|null;motion:React.MutableRefObject<BookMotion>;pointer:React.MutableRefObject<{x:number;y:number}>;reduced:boolean;compact:boolean;context:boolean}){
 const book=useRef<THREE.Group>(null);const {camera,size}=useThree();const time=useRef(0);
 const framing=useMemo(()=>frameReadingBook(size.width/Math.max(1,size.height),compact),[size.width,size.height,compact]);
 useEffect(()=>{camera.position.copy(framing.position);camera.lookAt(framing.target)},[camera,framing]);
 const grain=useMemo(()=>paperGrain(),[]);useEffect(()=>()=>grain.dispose(),[grain]);
 const cloth=useMemo(()=>clothTexture(),[]);useEffect(()=>()=>cloth.dispose(),[cloth]);
 const cover=useMemo(()=>coverTexture(),[]);useEffect(()=>()=>cover.dispose(),[cover]);
 useFrame((_,delta)=>{
  time.current+=Math.min(delta,.05);if(book.current){const p=pointer.current;book.current.rotation.x=THREE.MathUtils.damp(book.current.rotation.x,BOOK_ROTATION[0]+p.y*.025,3,delta);book.current.rotation.y=THREE.MathUtils.damp(book.current.rotation.y,BOOK_ROTATION[1]+p.x*.018,3,delta);book.current.rotation.z=THREE.MathUtils.damp(book.current.rotation.z,BOOK_ROTATION[2]+p.x*.027,3,delta);book.current.position.y=BOOK_ELEVATION+(reduced?0:Math.sin(time.current*.7)*.004)}
  const focus=Math.min(.045,Math.abs(pointer.current.x)*.045);
  camera.position.x=THREE.MathUtils.damp(camera.position.x,framing.position.x+pointer.current.x*.08+(turn?.04:0),2,delta);
  camera.position.y=THREE.MathUtils.damp(camera.position.y,framing.position.y+(turn?.08:0)+(context?.04:0),2,delta);
  camera.position.z=THREE.MathUtils.damp(camera.position.z,framing.position.z-focus-(context?.06:0),2,delta);
  camera.lookAt(framing.target);
 });
 const shown=turn?.direction===1?turn.to:entry;
 return <><Museum reduced={reduced} compact={compact}/><group ref={book} rotation={BOOK_ROTATION} position-y={BOOK_ELEVATION}>
  {/* Both boards are thicker than the paper block; their linen and foil edges remain visible. */}
  {(compact?[1]:[-1,1]).map(side=><group key={side} rotation-y={-side*.35}>
   <RoundedBox args={[2.34,3.32,.28]} radius={.048} smoothness={4} position={[side*1.17,0,-.21]} castShadow receiveShadow><meshStandardMaterial map={cloth} color="#d7e1e2" bumpMap={cloth} bumpScale={.012} roughness={.77} metalness={.02} envMapIntensity={.35}/></RoundedBox>
   <mesh position={[side*1.17,0,-.359]} rotation-y={Math.PI}><planeGeometry args={[2.22,3.18]}/><meshStandardMaterial map={cover} roughness={.84} metalness={.04}/></mesh>
   <mesh position={[side*1.17,0,-.055]}><planeGeometry args={[2.23,3.20]}/><meshStandardMaterial color="#987e50" metalness={.65} roughness={.46}/></mesh>
   <mesh position={[side*1.17,0,-.051]}><planeGeometry args={[2.20,3.17]}/><meshStandardMaterial map={cloth} color="#e0e9e9" bumpMap={cloth} bumpScale={.008} roughness={.83}/></mesh>
   <mesh position={[side*1.17,-1.58,-.047]}><boxGeometry args={[2.12,.012,.016]}/><meshStandardMaterial color="#b0935e" metalness={.67} roughness={.42}/></mesh>
   {[-1,1].map(y=><group key={y} position={[side*2.15,y*1.49,-.041]}><mesh><boxGeometry args={[.18,.008,.012]}/><meshStandardMaterial color="#aa8d5c" metalness={.72} roughness={.42}/></mesh><mesh position-x={-side*.085} position-y={-y*.08}><boxGeometry args={[.008,.17,.012]}/><meshStandardMaterial color="#aa8d5c" metalness={.72} roughness={.42}/></mesh></group>)}
  </group>)}
  <RoundedBox args={[.29,3.36,.45]} radius={.08} smoothness={6} position={[0,0,-.145]} castShadow><meshStandardMaterial map={cloth} color="#cad6d7" roughness={.72}/></RoundedBox>
  {[-.093,.093].map(x=><mesh key={x} position={[x,0,.09]}><boxGeometry args={[.019,3.25,.015]}/><meshStandardMaterial color="#a68a59" metalness={.64} roughness={.43}/></mesh>)}
  {[-1.48,1.48].map(y=><mesh key={y} position={[0,y,.098]}><boxGeometry args={[.19,.018,.018]}/><meshStandardMaterial color="#ac9061" metalness={.7} roughness={.4}/></mesh>)}
  {/* Curved paper layers share the exact reading-page profile and remain below it. */}
  {!compact&&<PageBlock side={-1}/>}<PageBlock side={1}/>
  <mesh position={[0,0,.415]}><boxGeometry args={[.085,3.05,.065]}/><meshStandardMaterial color="#9d8c73" roughness={1}/></mesh>
  {!compact&&<Page entry={turn?.direction===-1?turn.to:entry} side={-1} variant="verso" grain={grain}/>}
  <Page entry={shown} side={1} grain={grain}/>
  {turn&&<TurningPage key={`${turn.from.year}-${turn.to.year}-${turn.direction}`} turn={turn} motion={motion} grain={grain}/>}
 </group>
 <ContactShadows position={[0,-.425,0]} opacity={.63} scale={8} blur={2} far={2.4} resolution={compact?128:256}/>
 </>;
}
