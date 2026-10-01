export function sameOrigin(req: Request) {
  const origin = req.headers.get('origin');
  return !!origin && origin === new URL(req.url).origin;
}
