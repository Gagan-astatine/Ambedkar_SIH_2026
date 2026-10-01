import assert from 'node:assert/strict';
import {BookPlayback} from '../src/components/book-playback.ts';
const book=new BookPlayback(5);
assert.equal(book.begin(-1,false,0),false,'cannot go before the first page');
assert.equal(book.begin(1,false,0),true);
assert.equal(book.begin(1,false,20),false,'rapid clicks cannot start overlapping turns');
book.tick(450);assert.equal(book.index,0,'quote changes only after the page settles');assert.ok(book.progress>.4&&book.progress<.6);
book.tick(5000);assert.equal(book.index,1,'a late frame completes, independent of renderer/FPS');assert.equal(book.turn,null);
book.begin(1,true,6000);book.drag(.2);book.tick(6040);assert.ok(book.progress>0&&book.progress<.2,'drag follows the pointer with damping');book.tick(9000);assert.ok(Math.abs(book.progress-.2)<.01,'drag converges without overshooting');
book.release(false,9000);book.tick(10000);assert.equal(book.index,1,'short drag returns to current page');assert.equal(book.turn,null);
book.begin(1,true,11000);book.drag(.7);book.release(true,11100);book.tick(12000);assert.equal(book.index,2);
book.begin(-1,false,13000);book.tick(14000);assert.equal(book.index,1,'previous reverses the destination');
for(let i=0;i<3;i++){book.begin(1,false,15000+i*1000);book.tick(16000+i*1000)}
assert.equal(book.index,4);assert.equal(book.begin(1,false,19000),false,'final page remains in bounds');
console.log('Reading book: click, rapid-click guard, drag, cancel, previous, final boundary and slow-frame checks passed.');

const smooth=new BookPlayback(2);smooth.begin(1,false,0);let lastProgress=0;for(let now=0;now<980;now+=16){smooth.tick(now);assert.ok(smooth.progress>=lastProgress&&smooth.progress<=1);lastProgress=smooth.progress}smooth.tick(980);assert.equal(smooth.index,1);
