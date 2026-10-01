import gravityIndex from '@/src/generated/gravity-index.json';
import manifest from '@/public/corpus/manifest.json';
import audio from '@/public/data/AMBD_AUD.json';
import mediaReviews from '@/public/data/media-review.json';
import frameReviews from '@/public/data/frames-review.json';
import timeline from '@/public/corpus/timeline.json';
import {inspectFrames} from '@/src/data/frames-catalogue';
import {buildGravityField,type GravityEvent,type GravityIndex,type GravityMedia} from '@/src/services/gravity-engine';
import {env} from '@/src/server/platform-env';

export const runtime='nodejs';

async function publishedFrames(){
 let overrides:{id:string;status:string}[]=[];
 try{if(env.DB)overrides=(await env.DB.prepare('SELECT id,status FROM archive_frame_reviews').all<{id:string;status:string}>()).results}
 catch{/* The reviewed bundled catalog remains available if D1 is not configured. */}
 const status=new Map(overrides.map(row=>[row.id,row.status]));
 return inspectFrames().filter(record=>record.frame&&(status.get(record.id)||record.review.status)==='PUBLISHED')
  .map(record=>({...record.frame!,display_url:(frameReviews as Record<string,{assetUrl?:string}>)[record.id]?.assetUrl}));
}

export async function GET(request:Request){
 const url=new URL(request.url),requested=url.searchParams.get('entity');
 if(requested&&requested.length>160)return Response.json({error:'Invalid entity reference.'},{status:400});
 const frames=await publishedFrames();
 const media=audio.audio_tracks.map(item=>({...item,review:(mediaReviews as Record<string,{status:string}>)[item.id]})) as GravityMedia[];
 const field=buildGravityField(gravityIndex as GravityIndex,manifest,frames,media,timeline.events as GravityEvent[]);
 if(url.searchParams.get('catalog')==='1'){
  return Response.json({objects:field.summaries},{headers:{'Cache-Control':'public, max-age=60'}});
 }
 const snapshot=field.focus(requested||undefined);
 if(!snapshot)return Response.json({error:'This archival object is not in the current source index.'},{status:404});
 return Response.json(snapshot,{headers:{'Cache-Control':'public, max-age=60'}});
}
