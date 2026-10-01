import assert from 'node:assert/strict';
import {parseByteRange,rangeHeaders} from '../app/api/archive/http-range.ts';

assert.equal(parseByteRange(null,1000),null);
assert.deepEqual(parseByteRange('bytes=0-99',1000),{offset:0,length:100});
assert.deepEqual(parseByteRange('bytes=900-',1000),{offset:900,length:100});
assert.deepEqual(parseByteRange('bytes=-50',1000),{offset:950,length:50});
assert.deepEqual(parseByteRange('bytes=980-9999',1000),{offset:980,length:20});
for(const header of ['bytes=1000-','bytes=900-800','bytes=0-1,10-20','bytes=-0','bytes=x-y'])
 assert.equal(parseByteRange(header,1000),'invalid',header);
const headers=rangeHeaders({offset:900,length:100},1000,'application/pdf','private, no-store');
assert.equal(headers.get('content-range'),'bytes 900-999/1000');
assert.equal(headers.get('content-length'),'100');
assert.equal(headers.get('accept-ranges'),'bytes');
console.log(JSON.stringify({result:'PASS',cases:11,range:'single-byte-range'}));
