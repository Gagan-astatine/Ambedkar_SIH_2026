import {env} from '@/src/server/platform-env';
import audio from '@/public/data/AMBD_AUD.json';
import video from '@/public/data/AMD_VID.json';
import reviews from '@/public/data/media-review.json';
export const runtime='nodejs';
export async function GET(){
 let items:Record<string,unknown>[]=[];
 try { if (env.DB) {
 const rows=await env.DB.prepare(`SELECT d.id AS recordId,d.title,d.filename,v.mime_type AS mimeType,v.creator,v.source,v.rights,v.language,v.created_at AS uploadedAt,t.id AS transcriptId,t.segments_json AS segmentsJson,t.language AS transcriptLanguage
  FROM archive_documents d JOIN archive_document_versions v ON v.record_id=d.id LEFT JOIN archive_media_transcripts t ON t.version_id=v.id AND t.status='APPROVED'
  WHERE (v.mime_type LIKE 'audio/%' OR v.mime_type LIKE 'video/%') AND v.approval_status='PUBLISHED' AND v.verification_status='VERIFIED' AND v.security_scan_status='PASSED' ORDER BY v.created_at DESC LIMIT 100`).all();
 items=rows.results.map(row=>({...row,segments:row.segmentsJson?JSON.parse(String(row.segmentsJson)):[],segmentsJson:undefined}));
 }} catch { /* Bundled catalogue is still accessible if the upload index is unavailable. */ }
 const catalogue=[...audio.audio_tracks.map(record=>({...record,kind:'audio' as const})),...video.videos.map(record=>({...record,kind:'video' as const}))]
  .filter(record=>record.id&&record.title&&record.description&&record.year&&record.qualifying_subject==='ambedkar'&&record.ambedkar_present===true)
  .map(record=>({...record,review:reviews[record.id as keyof typeof reviews]||{status:'AWAITING_SOURCE_VERIFICATION',reason:'Source review required.'}}));
 const filmsDivisionRecord={
  id:'AMB-VID-FD-1991',title:'Dr. BabaSaheb Ambedkar',description:'An Internet Archive item attributed to the Ministry of Information, Films Division, and described as a biographical film about Dr. B. R. Ambedkar.',kind:'video',year:1991,language:'Unrecorded',location:{name:'India'},ambedkar_present:true,qualifying_subject:'ambedkar',source_page_url:'https://archive.org/details/dli.MoI.films.109',source:{institution:'Ministry of Information, Films Division',title:'Dr. BabaSaheb Ambedkar'},topics:['Biographical film','Films Division','Dr. B. R. Ambedkar'],historical_context:'The Internet Archive item page lists the Ministry of Information, Films Division, a 1991 publication date, and describes the item as a biographical film. It is presented as a related film, not as the supplied 1956 newsreel footage.',review:{status:'SOURCE_PAGE_MATCHED',reason:'The Internet Archive item page lists the Ministry of Information, Films Division, and publication date 1991. Its description identifies a biographical film; this is not verified as the specific 1956 newsreel footage in the supplied catalogue.',embedUrl:'https://archive.org/embed/dli.MoI.films.109'}
 };
 return Response.json({items,catalogue:[...catalogue,filmsDivisionRecord]},{headers:{'Cache-Control':'public, max-age=60'}});
}
