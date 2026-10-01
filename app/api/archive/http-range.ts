// Single-range responses let PDF.js fetch the pages it needs without downloading
// the entire original. The R2 object remains immutable and is never transformed.
export function parseByteRange(header: string | null, size: number): { offset: number; length: number } | null | 'invalid' {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(size) || size < 1) return 'invalid';
  const first = match[1] ? Number(match[1]) : null;
  const last = match[2] ? Number(match[2]) : null;
  if (first !== null && (!Number.isSafeInteger(first) || first >= size)) return 'invalid';
  if (last !== null && (!Number.isSafeInteger(last) || last < 0)) return 'invalid';
  if (first === null) {
    const length = Math.min(last!, size);
    if (!length) return 'invalid';
    return { offset: size - length, length };
  }
  const end = last === null ? size - 1 : Math.min(last, size - 1);
  if (end < first) return 'invalid';
  return { offset: first, length: end - first + 1 };
}

export function rangeHeaders(range: { offset: number; length: number } | null, size: number, mimeType: string, cacheControl: string) {
  const headers = new Headers({
    'Content-Type': mimeType,
    'Content-Length': String(range?.length ?? size),
    'Accept-Ranges': 'bytes',
    'Cache-Control': cacheControl,
    'X-Content-Type-Options': 'nosniff',
  });
  if (range) headers.set('Content-Range', `bytes ${range.offset}-${range.offset + range.length - 1}/${size}`);
  return headers;
}
