import { env } from '@/src/server/platform-env';
import { archiveUser } from '@/app/archive-auth';
import { parseByteRange, rangeHeaders } from '../../http-range';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await archiveUser();
  if (!env.DB || !env.BUCKET) return new Response('Storage unavailable', { status: 503 });
  const { id } = await params;
  const record = await env.DB.prepare(`SELECT d.r2_key AS key,d.filename,d.bytes,d.owner_id AS ownerId,v.mime_type AS mimeType,v.verification_status AS verificationStatus,v.approval_status AS approvalStatus,v.security_scan_status AS securityScanStatus
    FROM archive_documents d JOIN archive_document_versions v ON v.record_id=d.id WHERE d.id=?`)
    .bind(id).first<{ key: string; filename: string; bytes: number; ownerId: string; mimeType: string; verificationStatus: string; approvalStatus: string; securityScanStatus: string }>();
  if (!record) return new Response('Not found', { status: 404 });
  const published = record.approvalStatus === 'PUBLISHED' && record.verificationStatus === 'VERIFIED' && record.securityScanStatus === 'PASSED';
  if (!published && (!user || record.ownerId !== user.userId)) return new Response('Not found', { status: 404 });
  if (record.verificationStatus === 'FAILED') return new Response('Integrity check failed. Original file access is paused.', { status: 409 });
  const range = parseByteRange(req.headers.get('range'), record.bytes);
  if (range === 'invalid') return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${record.bytes}`, 'Accept-Ranges': 'bytes' } });
  const original = await env.BUCKET.get(record.key, range ? { range } : undefined);
  if (!original) return new Response('Original unavailable', { status: 404 });
  const headers = rangeHeaders(range, record.bytes, record.mimeType, 'private, no-store');
  headers.set('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(record.filename)}`);
  return new Response(original.body, { status: range ? 206 : 200, headers });
}
