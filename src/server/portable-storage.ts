const bucket = 'archive-originals';
function config() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase storage is not configured');
  return { url: new URL(url), key };
}
function objectPath(key: string) { return `${bucket}/${key.split('/').map(encodeURIComponent).join('/')}`; }
function headers(key: string) { return { apikey: key, Authorization: `Bearer ${key}` }; }
export const portableStorage = {
  async put(key: string, bytes: ArrayBuffer, options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string,string> }) {
    const c = config();
    const response = await fetch(new URL(`/storage/v1/object/${objectPath(key)}`, c.url), { method: 'POST', headers: { ...headers(c.key), 'content-type': options?.httpMetadata?.contentType || 'application/octet-stream', 'x-upsert': 'false' }, body: bytes });
    if (!response.ok) throw new Error(`Storage upload failed (${response.status})`);
    return { key };
  },
  async get(key: string, options?: { range?: { offset: number; length: number } }) {
    const c = config();
    const response = await fetch(new URL(`/storage/v1/object/authenticated/${objectPath(key)}`, c.url), { headers: { ...headers(c.key), ...(options?.range ? { Range: `bytes=${options.range.offset}-${options.range.offset + options.range.length - 1}` } : {}) } });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Storage read failed (${response.status})`);
    if (options?.range && response.status !== 206) {
      const bytes = (await response.arrayBuffer()).slice(options.range.offset, options.range.offset + options.range.length);
      return { body: new Blob([bytes]).stream(), arrayBuffer: async () => bytes, size: bytes.byteLength, httpMetadata: { contentType: response.headers.get('content-type') || 'application/octet-stream' } };
    }
    return { body: response.body, arrayBuffer: () => response.arrayBuffer(), size: Number(response.headers.get('content-length') || 0), httpMetadata: { contentType: response.headers.get('content-type') || 'application/octet-stream' } };
  },
  async delete(key: string) {
    const c = config();
    const response = await fetch(new URL(`/storage/v1/object/${objectPath(key)}`, c.url), { method: 'DELETE', headers: headers(c.key) });
    if (!response.ok && response.status !== 404) throw new Error(`Storage deletion failed (${response.status})`);
  },
};
