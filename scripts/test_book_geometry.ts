import assert from 'node:assert/strict';
import {BOOK_PAGE_WIDTH,sampleBookPage} from '../src/components/book-geometry.ts';
for(const side of [1,-1] as const){
 for(const v of [-1,0,1])for(let i=0;i<=32;i++){
  const u=i/32,end=sampleBookPage(u,v,1,side),destination=sampleBookPage(u,v,0,side===1?-1:1);
  for(let axis=0;axis<3;axis++)assert.ok(Math.abs(end[axis]-destination[axis])<1e-9,'turn settles on the exact destination surface');
 }
 for(const p of [0,.1,.25,.5,.75,.9,1])for(const v of [-1,0,1]){
  let length=0,previous=sampleBookPage(0,v,p,side);
  const hinge=sampleBookPage(0,v,0,side);assert.deepEqual(previous,hinge,'page stays attached to the gutter');
  for(let i=1;i<=64;i++){const point=sampleBookPage(i/64,v,p,side);assert.ok(point.every(Number.isFinite));length+=Math.hypot(...point.map((value,axis)=>value-previous[axis]));previous=point}
  assert.ok(Math.abs(length-BOOK_PAGE_WIDTH)<.05,`leaf remains near its physical width: ${length}`);
 }
}
const corner=sampleBookPage(1,1,.35,1),centre=sampleBookPage(.5,0,.35,1);
assert.ok(corner[2]>centre[2],'outer corner visibly lifts during the curl');
console.log('Book geometry: both directions, exact settling, anchored spine, finite vertices and paper width passed.');
