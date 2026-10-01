import {env} from '@/src/server/platform-env';
import manifest from '@/public/corpus/manifest.json';
export const runtime='nodejs';
export async function GET(req:Request){const url=new URL(req.url);const sourceId=url.searchParams.get('sourceId')||'';const page=Number(url.searchParams.get('page'));const locale=url.searchParams.get('locale')||'';
 if(!/^[A-Z0-9-]{3,40}$/.test(sourceId)||!Number.isInteger(page)||page<1||!['hi','kn'].includes(locale))return Response.json({error:'Invalid source reference.'},{status:400});
 const supplied=(manifest as {id:string;pageCount:number}[]).find(item=>item.id===sourceId&&page<=item.pageCount);
 if(!supplied){const published=await env.DB?.prepare(`SELECT d.page_count AS pageCount FROM archive_documents d JOIN archive_document_versions v ON v.record_id=d.id WHERE d.id=? AND v.approval_status='PUBLISHED' AND v.verification_status='VERIFIED' AND v.security_scan_status='PASSED'`).bind(sourceId).first<{pageCount:number}>();if(!published||page>published.pageCount)return Response.json({translation:null},{headers:{'Cache-Control':'private, no-store'}})}
 const row=await env.DB?.prepare(`SELECT source_text_hash AS sourceTextHash,translated_text AS translatedText,reviewed_by AS reviewedBy,reviewed_at AS reviewedAt,provider FROM archive_reviewed_translations WHERE source_id=? AND page_number=? AND locale=? AND status='APPROVED' ORDER BY reviewed_at DESC LIMIT 1`).bind(sourceId,page,locale).first();
 return Response.json({translation:row||null},{headers:{'Cache-Control':'private, no-store'}})
}
