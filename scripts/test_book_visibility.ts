import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sampleBookPage} from '../src/components/book-geometry.ts';
import {createReadingPageGeometry,createPaperLayerGeometry} from '../src/components/book-mesh.ts';
import {BOOK_ROTATION,BOOK_ELEVATION,frameReadingBook} from '../src/components/book-view.ts';

let tested=0;
for(const [width,height] of [[1400,680],[1200,650],[800,580],[761,580],[760,550],[375,550],[320,550]]){
 const compact=width<=760,frame=frameReadingBook(width/height,compact);
 const camera=new THREE.PerspectiveCamera(compact?32:36,width/height,.1,35);
 camera.position.copy(frame.position);camera.lookAt(frame.target);camera.updateMatrixWorld(true);
 for(const point of frame.points){const ndc=point.clone().project(camera);assert.ok(Math.abs(ndc.x)<.86&&Math.abs(ndc.y)<.86,`${width}px book fits inside the viewport`)}
 for(const pointer of [-1,0,1]){
  const book=new THREE.Group();book.rotation.set(BOOK_ROTATION[0]+pointer*.025,BOOK_ROTATION[1]+pointer*.018,BOOK_ROTATION[2]+pointer*.027);book.position.y=BOOK_ELEVATION;
  const layers:THREE.Mesh[]=[];
  for(const side of compact?[1] as const:[-1,1] as const){
   const geometry=createPaperLayerGeometry(side);
   for(let i=0;i<20;i++){const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.position.z=-i*.018;book.add(mesh);layers.push(mesh)}
   const reading=createReadingPageGeometry(side);const normals=reading.attributes.normal;
   for(let i=0;i<normals.count;i++)assert.ok(normals.getZ(i)>0,'reading page front faces the camera');reading.dispose();
  }
  book.updateMatrixWorld(true);
  for(const side of compact?[1] as const:[-1,1] as const)for(let col=1;col<=19;col++)for(let row=1;row<=19;row++){
   const point=new THREE.Vector3(...sampleBookPage(col/20,row/10-1,0,side)).applyMatrix4(book.matrixWorld);
   const direction=point.clone().sub(camera.position).normalize(),distance=camera.position.distanceTo(point);
   const ray=new THREE.Raycaster(camera.position,direction,.001,distance-.0001);
   assert.equal(ray.intersectObjects(layers,false).length,0,`${width}px: no blank layer covers the reading page (${side}, ${col}, ${row})`);
   const ndc=point.clone().project(camera);assert.ok(Math.abs(ndc.x)<.92&&Math.abs(ndc.y)<.92,'pointer tilt does not crop the reading page');tested++;
  }
  for(const layer of layers){layer.geometry.dispose();(layer.material as THREE.Material).dispose()}
 }
}
console.log(`Book visibility: ${tested} reading points unobstructed; desktop, tablet and mobile framing passed.`);
