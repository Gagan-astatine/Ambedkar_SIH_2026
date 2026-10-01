import {sameOrigin} from '@/app/origin';
import {saveSubmission} from '@/app/api/archive/_submission';

export const runtime='nodejs';
export async function GET(){return Response.json({error:'Submission history requires verified authentication.'},{status:403,headers:{'Cache-Control':'private, no-store'}})}
export async function POST(req:Request){
 if(!sameOrigin(req))return Response.json({error:'Invalid request origin.'},{status:403});
 return saveSubmission(req);
}
