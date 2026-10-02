import {env} from '@/src/server/platform-env';
import manifest from '@/public/corpus/manifest.json';
import {parseByteRange,rangeHeaders} from '../http-range';
export const runtime='nodejs';

type SourceDocument={id:string;filename:string;sha256:string;bytes:number;delivery?:string};
type AssetFetcher={fetch(request:Request):Promise<Response>};
const supplied=manifest as SourceDocument[];
const storage=env as unknown as {BUCKET?:R2Bucket;ASSETS?:AssetFetcher;ARCHIVE_IMPORT_KEY?:string};

export async function GET(req:Request){
 const id=new URL(req.url).searchParams.get('documentId');
 const doc=supplied.find(d=>d.id===id);
 if(!doc)return new Response('Source not found',{status:404});
 const range=parseByteRange(req.headers.get('range'),doc.bytes);
 if(range==='invalid')return new Response(null,{status:416,headers:{'Content-Range':`bytes */${doc.bytes}`,'Accept-Ranges':'bytes'}});
 let body:ReadableStream<Uint8Array>|null=null,status=range?206:200,headers:Headers;
 if(doc.delivery==='R2'){
  const object=await storage.BUCKET?.get(`supplied/${doc.sha256}.pdf`,range?{range}:undefined);
  if(!object){const base=process.env.ARCHIVE_SOURCE_BASE_URL;if(!base)return new Response('Original PDF unavailable',{status:404});const remote=new URL(`/api/archive/supplied?documentId=${encodeURIComponent(doc.id)}`,base);if(remote.origin===new URL(req.url).origin)return new Response('Original PDF unavailable',{status:404});const response=await fetch(remote,{headers:range?{Range:req.headers.get('range')||''}:{}});if(!response.ok)return new Response('Original PDF unavailable',{status:response.status});const copy=new Headers(response.headers);copy.set('Content-Disposition',`inline; filename*=UTF-8''${encodeURIComponent(doc.filename)}`);return new Response(response.body,{status:response.status,headers:copy});}
  headers=rangeHeaders(range,doc.bytes,'application/pdf','public, max-age=3600');body=object.body;
 }else{
  if(!storage.ASSETS){
    // Use the raw filename in the path — the static server matches the literal file name.
    // Reconstruct the public origin from forwarded headers so that internal
    // Firebase App Hosting addresses (0.0.0.0:8080) are never exposed to clients.
    const path=`/corpus/pdf/${doc.filename}`;
    const reqUrl=new URL(req.url);
    const proto=req.headers.get('x-forwarded-proto')||reqUrl.protocol.replace(':','');
    const host=req.headers.get('x-forwarded-host')||req.headers.get('host')||reqUrl.host;
    const publicBase=`${proto}://${host}`;
    return Response.redirect(new URL(path,publicBase),307);
  }
  const assetUrl=new URL(`/corpus/pdf/${doc.filename}`,req.url);
  const assetRequest=new Request(assetUrl,{headers:req.headers});
  const asset=await storage.ASSETS.fetch(assetRequest);

  if(!asset.ok)return new Response('Original PDF unavailable',{status:asset.status});
  status=asset.status;headers=new Headers(asset.headers);body=asset.body;
  headers.set('Content-Type','application/pdf');headers.set('Accept-Ranges','bytes');headers.set('Cache-Control','public, max-age=3600');headers.set('X-Content-Type-Options','nosniff');
 }
 headers.set('Content-Disposition',`inline; filename*=UTF-8''${encodeURIComponent(doc.filename)}`);
 return new Response(body,{status,headers});
}

export async function PUT(req:Request){
 const secret=storage.ARCHIVE_IMPORT_KEY;
 if(!secret||req.headers.get('x-archive-import-key')!==secret)return new Response('Not authorized',{status:401});
 if(!storage.BUCKET)return new Response('Storage unavailable',{status:503});
 const id=new URL(req.url).searchParams.get('documentId');
 const doc=supplied.find(d=>d.id===id&&d.delivery==='R2');
 if(!doc)return new Response('Unknown source',{status:404});
 const bytes=await req.arrayBuffer();
 if(bytes.byteLength!==doc.bytes)return new Response('Size mismatch',{status:422});
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
 if(hash!==doc.sha256)return new Response('Checksum mismatch',{status:422});
 await storage.BUCKET.put(`supplied/${doc.sha256}.pdf`,bytes,{httpMetadata:{contentType:'application/pdf'},customMetadata:{sha256:hash,documentId:doc.id}});
 return Response.json({documentId:doc.id,verified:true,bytes:bytes.byteLength});
}
