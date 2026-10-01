import { env } from '@/src/server/platform-env';
import { archiveUser } from '@/app/archive-auth';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const user = await archiveUser();
  if (!env.DB) return Response.json({ error: 'Index unavailable.' }, { status: 503 });
  const url = new URL(req.url);
  const id = url.searchParams.get('documentId');
  const page = Number(url.searchParams.get('page'));
  if (!id || !Number.isInteger(page) || page < 1) return Response.json({ error: 'Invalid page.' }, { status: 400 });
  const row = await env.DB.prepare(`SELECT p.text,p.page_number AS pageNumber,p.method,p.confidence,p.section,
    d.owner_id AS ownerId,v.approval_status AS approvalStatus,v.verification_status AS verificationStatus,v.security_scan_status AS securityScanStatus
    FROM archive_pages p JOIN archive_documents d ON d.id=p.document_id JOIN archive_document_versions v ON v.record_id=d.id
    WHERE d.id=? AND p.page_number=?`).bind(id,page).first<{
    text: string; pageNumber: number; method: string; confidence: number | null; section: string | null;
    ownerId: string; approvalStatus: string; verificationStatus: string; securityScanStatus: string;
  }>();
  if (!row) return Response.json({ error: 'Page not found.' }, { status: 404 });
  const published = row.approvalStatus === 'PUBLISHED' && row.verificationStatus === 'VERIFIED' && row.securityScanStatus === 'PASSED';
  if ((!published && (!user || row.ownerId !== user.userId)) || row.verificationStatus === 'FAILED') return Response.json({ error: 'Page not found.' }, { status: 404 });
  const { ownerId: _ownerId,approvalStatus: _approvalStatus,verificationStatus: _verificationStatus,securityScanStatus: _securityScanStatus,...pageData } = row;
  return Response.json({ page: pageData }, { headers: { 'Cache-Control': 'private, no-store' } });
}
