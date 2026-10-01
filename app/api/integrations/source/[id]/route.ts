import {env} from '@/src/server/platform-env';
import {verifyOriginalLink} from '@/src/server/external-integrations';
import {parseByteRange,rangeHeaders} from '@/app/api/archive/http-range';
export const runtime='nodejs';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;const url=new URL(req.url);const version=url.searchParams.get('version')||'';const expires=url.searchParams.get('expires')||'';const signature=url.searchParams.get('signature')||'';
 if(!env.DB||!env.BUCKET)return new Response('Unavailable',{status:503});
 const row=await env.DB.prepare('SELECT v.sha256,v.storage_reference AS key,v.file_size AS bytes,v.mime_type AS mimeType FROM archive_document_versions v WHERE v.record_id=? AND v.id=?').bind(id,version).first<{sha256:string;key:string;bytes:number;mimeType:string}>();
 if(!row||!await verifyOriginalLink(id,version,row.sha256,expires,signature))return new Response('Not found',{status:404});
 const range=parseByteRange(req.headers.get('range'),row.bytes);if(range==='invalid')return new Response(null,{status:416,headers:{'Content-Range':`bytes */${row.bytes}`,'Accept-Ranges':'bytes'}});
 const original=await env.BUCKET.get(row.key,range?{range}:undefined);if(!original)return new Response('Not found',{status:404});
 return new Response(original.body,{status:range?206:200,headers:rangeHeaders(range,row.bytes,row.mimeType,'private, no-store')});
}
