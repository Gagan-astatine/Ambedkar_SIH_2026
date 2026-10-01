import { env } from '@/src/server/platform-env';
import { cookies } from 'next/headers';

export type ArchiveUser = { userId: string; displayName: string; email: string; fullName: string | null };
type GoogleConfig = { GOOGLE_CLIENT_ID?: string; GOOGLE_SESSION_SECRET?: string };
type GoogleClaims = { sub?: string; email?: string; email_verified?: boolean; name?: string; aud?: string | string[]; iss?: string; exp?: number; iat?: number };
type GoogleJwk = JsonWebKey & { kid?: string; kty?: string };
const config = () => env as unknown as GoogleConfig;
const COOKIE = 'archive_google_session';
const enc = new TextEncoder();
const dec = new TextDecoder();
let keyCache: { expires: number; keys: GoogleJwk[] } | null = null;
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
function decodePart(value: string) { return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)), c => c.charCodeAt(0)); }
function decodeJson<T>(value: string): T { return JSON.parse(dec.decode(decodePart(value))) as T; }
async function hmacKey() {
  const secret = config().GOOGLE_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('Google session signing is not configured.');
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function googleKeys() {
  if (keyCache && keyCache.expires > Date.now()) return keyCache.keys;
  const response = await fetch('https://www.googleapis.com/oauth2/v3/certs', { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Google signing keys are unavailable.');
  const result = await response.json() as { keys?: GoogleJwk[] };
  if (!result.keys?.length) throw new Error('Google signing keys are unavailable.');
  const maxAge = Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1] || 300);
  keyCache = { keys: result.keys, expires: Date.now() + Math.max(60, Math.min(maxAge, 3600)) * 1000 };
  return result.keys;
}
export async function verifyGoogleIdToken(token: string): Promise<ArchiveUser> {
  const clientId = config().GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('Google sign-in is not configured.');
  if (token.length > 8192) throw new Error('Invalid Google credential.');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid Google credential.');
  const header = decodeJson<{ alg?: string; kid?: string }>(parts[0]);
  const claims = decodeJson<GoogleClaims>(parts[1]);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Invalid Google credential signature.');
  const jwk = (await googleKeys()).find(key => key.kid === header.kid && key.kty === 'RSA');
  if (!jwk) throw new Error('Google credential key is unavailable.');
  const publicKey = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, decodePart(parts[2]), enc.encode(`${parts[0]}.${parts[1]}`));
  const now = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!valid || !['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss || '') || !aud.includes(clientId)
    || !claims.sub || !claims.email || claims.email_verified !== true || !claims.exp || claims.exp <= now || !claims.iat || claims.iat > now + 60 || claims.exp - claims.iat > 7200) {
    throw new Error('Google could not verify this account. Please try again.');
  }
  return { userId: `google:${claims.sub}`, displayName: claims.name?.trim() || claims.email, email: claims.email.trim().toLowerCase(), fullName: claims.name || null };
}
export async function issueGoogleSession(user: ArchiveUser) {
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = b64url(enc.encode(JSON.stringify({ ...user, expiresAt })));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(), enc.encode(payload));
  return `${payload}.${b64url(new Uint8Array(sig))}`;
}
export async function googleUser(): Promise<ArchiveUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return null;
  try {
    const valid = await crypto.subtle.verify('HMAC', await hmacKey(), decodePart(signature), enc.encode(payload));
    if (!valid) return null;
    const data = decodeJson<ArchiveUser & { expiresAt: number }>(payload);
    if (!data.userId?.startsWith('google:') || !data.email || !Number.isFinite(data.expiresAt) || data.expiresAt <= Date.now()) return null;
    return { userId: data.userId, displayName: data.displayName, email: data.email, fullName: data.fullName };
  } catch { return null; }
}
export function googleClientId() { return config().GOOGLE_CLIENT_ID || ''; }
export function googleSessionCookie(token: string, req: Request) {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`;
}
export function clearGoogleSessionCookie(req: Request) {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
