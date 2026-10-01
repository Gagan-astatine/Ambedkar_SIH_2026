import * as THREE from 'three';
import {sampleBookPage} from './book-geometry.ts';

export const BOOK_ROTATION:[number,number,number]=[-1.12,-.19,-.055];
export const BOOK_ELEVATION=.40;

/** Fit the actual boards and page surfaces, including their perspective depth. */
export function frameReadingBook(aspect:number,compact:boolean){
 const transform=new THREE.Matrix4().compose(new THREE.Vector3(0,BOOK_ELEVATION,0),new THREE.Quaternion().setFromEuler(new THREE.Euler(...BOOK_ROTATION)),new THREE.Vector3(1,1,1));
 const points:THREE.Vector3[]=[];
 for(const side of compact?[1] as const:[-1,1] as const){
  for(const u of [0,.5,1])for(const v of [-1,0,1])points.push(new THREE.Vector3(...sampleBookPage(u,v,0,side)).applyMatrix4(transform));
  const boardRotation=new THREE.Matrix4().makeRotationY(-side*.35);
  for(const x of [0,side*2.34])for(const y of [-1.66,1.66])for(const z of [-.35,-.05])points.push(new THREE.Vector3(x,y,z).applyMatrix4(boardRotation).applyMatrix4(transform));
 }
 const target=new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());
 const nominal=new THREE.Vector3(...(compact?[1.2,3.9,4.25] as const:[.5,4.2,5.2] as const));
 const direction=nominal.sub(new THREE.Vector3(compact?1.03:0,.35,0)).normalize();
 const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right).normalize();
 const tan=Math.tan(THREE.MathUtils.degToRad(compact?32:36)/2),margin=.85;
 let distance=0;
 for(const point of points){const offset=point.clone().sub(target),depth=offset.dot(direction);distance=Math.max(distance,Math.abs(offset.dot(right))/(tan*Math.max(.2,aspect)*margin)+depth,Math.abs(offset.dot(up))/(tan*margin)+depth)}
 return {position:target.clone().addScaledVector(direction,distance+.12),target,points};
}
