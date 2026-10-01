import {env} from '@/src/server/platform-env';
import {integrationEvent,n8nSecret} from '@/src/server/external-integrations';
export const runtime='nodejs';
const stages=new Set(['SECURITY_SCAN','OCR','PAGE_INDEX','METADATA','ENTITY_EXTRACTION','EVENT_EXTRACTION','KNOWLEDGE_GRAPH','EMBEDDINGS','SEMANTIC_INDEX','JEV_VALIDATION','TRANSCRIPTION','COMPLETE']);
export async function POST(req:Request){const secret=n8nSecret();if(!secret||req.headers.get('authorization')!==`Bearer ${secret}`)return Response.json({error:'Unauthorized'},{status:401});
 if(!env.DB)return Response.json({error:'Archive database unavailable'},{status:503});
 let value:unknown;try{value=await req.json()}catch{return Response.json({error:'Invalid payload'},{status:400})}
 const body=value as {recordId?:string;versionId?:string;sha256?:string;stage?:string;status?:string;outputReference?:string;error?:string};
 if(!body||!/^DOC-[0-9a-f]{16}$/.test(body.recordId||'')||!/^VER-[0-9a-f]{16}$/.test(body.versionId||'')||!stages.has(body.stage||'')||!['RUNNING','COMPLETE','FAILED','REVIEW_REQUIRED'].includes(body.status||''))return Response.json({error:'Invalid processing event'},{status:400});
 const row=await env.DB.prepare('SELECT sha256 FROM archive_document_versions WHERE id=? AND record_id=?').bind(body.versionId,body.recordId).first<{sha256:string}>();if(!row||row.sha256!==body.sha256)return Response.json({error:'Version mismatch'},{status:404});
 await integrationEvent(body.recordId!,body.versionId!,'N8N',body.stage!,body.status!,{outputReference:body.outputReference?.slice(0,400)||null},body.error?.slice(0,500)||null);
 if(body.status==='FAILED')await env.DB.prepare('UPDATE archive_processing_jobs SET status=?,error=?,updated_at=? WHERE version_id=?').bind('FAILED',body.error?.slice(0,500)||'External processing failed',new Date().toISOString(),body.versionId).run();
 return Response.json({accepted:true});
}
