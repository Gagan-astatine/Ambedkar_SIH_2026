import * as THREE from 'three';
import {BOOK_PAGE_WIDTH,BOOK_PAGE_HEIGHT,sampleBookPage} from './book-geometry.ts';

export function createReadingPageGeometry(side:1|-1){
 const geometry=new THREE.PlaneGeometry(BOOK_PAGE_WIDTH,BOOK_PAGE_HEIGHT,32,20);
 if(side===-1&&geometry.index){const indices=geometry.index.array;for(let i=0;i<indices.length;i+=3){const swap=indices[i+1];indices[i+1]=indices[i+2];indices[i+2]=swap}}
 const positions=geometry.attributes.position as THREE.BufferAttribute;
 const original=Float32Array.from(positions.array);
 for(let i=0;i<positions.count;i++){
  const u=(original[i*3]+BOOK_PAGE_WIDTH/2)/BOOK_PAGE_WIDTH,v=original[i*3+1]/(BOOK_PAGE_HEIGHT/2);
  positions.setXYZ(i,...sampleBookPage(u,v,0,side));
 }
 positions.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}

/** Every stacked leaf follows the reading surface, instead of intersecting it. */
export function createPaperLayerGeometry(side:1|-1){
 const columns=24,rows=8,vertices:number[]=[],indices:number[]=[],count=(columns+1)*(rows+1);
 for(const bottom of [false,true])for(let row=0;row<=rows;row++)for(let column=0;column<=columns;column++){
  const [x,y,z]=sampleBookPage(column/columns,row/rows*2-1,0,side);
  vertices.push(x*.993,y*.993,z-.055-(bottom?.014:0));
 }
 const quad=(a:number,b:number,c:number,d:number)=>indices.push(a,b,c,a,c,d);
 for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
  const a=row*(columns+1)+column,b=a+1,c=b+columns+1,d=a+columns+1;
  if(side===1){quad(a,b,c,d);quad(a+count,d+count,c+count,b+count)}else{quad(a,d,c,b);quad(a+count,b+count,c+count,d+count)}
 }
 for(let column=0;column<columns;column++){quad(column,column+1,column+1+count,column+count);const a=rows*(columns+1)+column;quad(a,a+count,a+1+count,a+1)}
 for(let row=0;row<rows;row++){const a=row*(columns+1),b=a+columns+1;quad(a,a+count,b+count,b);quad(a+columns,b+columns,b+columns+count,a+columns+count)}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
