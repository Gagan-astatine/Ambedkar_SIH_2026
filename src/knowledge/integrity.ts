export const MAX_ARCHIVAL_UPLOAD_BYTES = 20 * 1024 * 1024;

export type ArchivalAsset = { kind: 'PDF' | 'IMAGE' | 'AUDIO' | 'VIDEO'; mimeType: string; extension: string };

const signatures: { extension: string; kind: ArchivalAsset['kind']; mimeType: string; matches: (bytes: Uint8Array) => boolean }[] = [
  { extension: 'pdf', kind: 'PDF', mimeType: 'application/pdf', matches: (b) => String.fromCharCode(...b.slice(0, 5)) === '%PDF-' },
  { extension: 'png', kind: 'IMAGE', mimeType: 'image/png', matches: (b) => b[0] === 0x89 && String.fromCharCode(...b.slice(1, 4)) === 'PNG' },
  { extension: 'jpg', kind: 'IMAGE', mimeType: 'image/jpeg', matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { extension: 'webp', kind: 'IMAGE', mimeType: 'image/webp', matches: (b) => String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP' },
  { extension: 'wav', kind: 'AUDIO', mimeType: 'audio/wav', matches: (b) => String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WAVE' },
  { extension: 'mp3', kind: 'AUDIO', mimeType: 'audio/mpeg', matches: (b) => String.fromCharCode(...b.slice(0, 3)) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
  { extension: 'mp4', kind: 'VIDEO', mimeType: 'video/mp4', matches: (b) => String.fromCharCode(...b.slice(4, 8)) === 'ftyp' },
  { extension: 'webm', kind: 'VIDEO', mimeType: 'video/webm', matches: (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 },
];

export function sanitizedFilename(name: string) {
  return name.split(/[\\/]/).at(-1)?.normalize('NFKC').replace(/[^\p{L}\p{N}._() -]/gu, '_').replace(/^\.+/, '').slice(0, 160) || 'archival-file';
}

export function classifyArchivalAsset(filename: string, originalBytes: ArrayBuffer): ArchivalAsset | null {
  const extension = filename.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  const bytes = new Uint8Array(originalBytes, 0, Math.min(originalBytes.byteLength, 32));
  const entry = signatures.find((candidate) => (extension === candidate.extension || extension === 'jpeg' && candidate.extension === 'jpg') && candidate.matches(bytes));
  return entry ? { kind: entry.kind, mimeType: entry.mimeType, extension: entry.extension } : null;
}

export async function sha256Hex(originalBytes: ArrayBuffer) {
  const hash = await crypto.subtle.digest('SHA-256', originalBytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export const fullHash = (hash: string) => /^[0-9a-f]{64}$/.test(hash);
