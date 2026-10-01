import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { classifyArchivalAsset, fullHash, sanitizedFilename, sha256Hex } from '../src/knowledge/integrity.ts';

const bytes = new TextEncoder().encode('test').buffer;
assert.equal(await sha256Hex(bytes), '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08', 'hash the original binary bytes');
assert.notEqual(await sha256Hex(new TextEncoder().encode('test\n').buffer), await sha256Hex(bytes), 'a changed original must have a different fingerprint');
assert(fullHash(await sha256Hex(bytes)), 'store the complete lowercase 64-character digest');
assert.equal(sanitizedFilename('../../manuscript.pdf'), 'manuscript.pdf', 'remove path elements from supplied names');
const pdf = new TextEncoder().encode('%PDF-1.7\nexample source');
assert.equal(classifyArchivalAsset('manuscript.pdf', pdf.buffer)?.mimeType, 'application/pdf', 'identify a PDF by original bytes');
assert.equal(classifyArchivalAsset('fake.pdf', new TextEncoder().encode('this is not a pdf').buffer), null, 'extension alone cannot validate a file');
assert.equal(classifyArchivalAsset('renamed.mp3', pdf.buffer), null, 'reject mismatched formats');

const manifest = JSON.parse(await readFile(new URL('../public/corpus/manifest.json', import.meta.url), 'utf8'));
assert(manifest.length > 0 && manifest.every((source) => fullHash(source.sha256)), 'all supplied source records retain full SHA-256 fingerprints');
console.log(JSON.stringify({ result: 'PASS', checks: ['original byte SHA-256', 'changed version hash', 'full lowercase digest', 'filename sanitization', 'binary file signature', 'supplied source fingerprints'], suppliedSources: manifest.length }));
