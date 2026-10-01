import {googleUser} from '@/app/google-auth';
/** Local supervised preview has no Google identity cookie; production requires Google sign-in. */
export async function archiveUser(){const user=await googleUser();if(user)return user;if(process.env.NODE_ENV==='development' && process.env.ARCHIVE_DEV_PREVIEW_AUTH==='true')return {userId:'preview-archivist',displayName:'Preview archivist',email:'preview@local.invalid',fullName:null};return null}
