import { clearGoogleSessionCookie, googleClientId, googleSessionCookie, googleUser, issueGoogleSession, verifyGoogleIdToken } from '@/app/google-auth';
import { sameOrigin } from '@/app/origin';
export const runtime = 'nodejs';
export async function GET() {
  const user = await googleUser();
  return Response.json({ clientId: googleClientId(), user: user ? { displayName: user.displayName, email: user.email } : null }, { headers: { 'Cache-Control': 'no-store' } });
}
export async function POST(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: 'Invalid request origin.' }, { status: 403, headers: { 'Cache-Control': 'no-store' } });
  let body: { credential?: string };
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid sign-in request.' }, { status: 400 }); }
  try {
    const user = await verifyGoogleIdToken(typeof body.credential === 'string' ? body.credential : '');
    const headers = new Headers({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    headers.append('Set-Cookie', googleSessionCookie(await issueGoogleSession(user), req));
    return new Response(JSON.stringify({ signedIn: true }), { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Google sign-in failed.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
}
export async function DELETE(req: Request) {
  if (!sameOrigin(req)) return Response.json({ error: 'Invalid request origin.' }, { status: 403 });
  return new Response(JSON.stringify({ signedOut: true }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Set-Cookie': clearGoogleSessionCookie(req) } });
}
