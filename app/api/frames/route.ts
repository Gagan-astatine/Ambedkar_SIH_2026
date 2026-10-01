import { env } from '@/src/server/platform-env';
import { inspectFrames } from '@/src/data/frames-catalogue';
import reviews from '@/public/data/frames-review.json';

export const runtime = 'nodejs';

export async function GET() {
  const records = inspectFrames();
  let overrides: { id: string; status: string }[] = [];
  try { if (env.DB) overrides = (await env.DB.prepare('SELECT id,status FROM archive_frame_reviews').all<{ id: string; status: string }>()).results; } catch { /* Default review file remains usable before the migration is applied. */ }
  const status = new Map(overrides.map((row) => [row.id, row.status]));
  const frames = records.filter((record) => record.frame && (status.get(record.id) || record.review.status) === 'PUBLISHED').map((record) => ({ ...record.frame, display_url: (reviews as Record<string, { assetUrl?: string }>)[record.id]?.assetUrl }));
  return Response.json({ frames }, { headers: { 'Cache-Control': 'public, max-age=60' } });
}
