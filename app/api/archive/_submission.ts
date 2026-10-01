import { archiveId, database, privateJson, storage } from '@/app/archive-records';
import { classifyArchivalAsset, MAX_ARCHIVAL_UPLOAD_BYTES, sanitizedFilename, sha256Hex } from '@/src/knowledge/integrity';

export async function saveSubmission(req: Request) {
  if (!database() || !storage()) return privateJson({ error: 'Archive storage unavailable.' }, { status: 503 });
  let form: FormData;
  try { form = await req.formData(); } catch { return privateJson({ error: 'Invalid upload request.' }, { status: 400 }); }
  const email = String(form.get('email') || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return privateJson({error:'Enter a valid email address.'},{status:400});
  const ownerId = `submission:${await sha256Hex(new TextEncoder().encode(email).buffer)}`;
  const recent = await database().prepare('SELECT count(*) AS n FROM archive_documents WHERE owner_id=? AND uploaded_at>?').bind(ownerId,new Date(Date.now()-86400000).toISOString()).first<{n:number}>();
  if ((recent?.n || 0) >= 5) return privateJson({error:'Daily contribution limit reached. Please try again tomorrow.'},{status:429});
  const file = form.get('file');
  if (!(file instanceof File) || file.size < 8 || file.size > MAX_ARCHIVAL_UPLOAD_BYTES) return privateJson({ error: 'Choose a supported file no larger than 20 MB.' }, { status: 400 });
  const filename = sanitizedFilename(file.name);
  const title = String(form.get('title') || '').trim().slice(0, 200);
  const source = String(form.get('source') || '').trim().slice(0, 300);
  const rights = String(form.get('rights') || '').trim().slice(0, 300);
  const creator = String(form.get('creator') || '').trim().slice(0, 200);
  const description = String(form.get('description') || '').trim().slice(0, 1500);
  const language = String(form.get('language') || '').trim().slice(0, 60);
  if (title.length < 3 || !source || !rights) return privateJson({ error: 'Title, source and rights information are required.' }, { status: 400 });

  const originalBytes = await file.arrayBuffer();
  const asset = classifyArchivalAsset(filename, originalBytes);
  if (!asset) return privateJson({ error: 'File extension and binary signature must identify a supported PDF, image, audio or video format.' }, { status: 415 });
  const declared = file.type.toLowerCase();
  if (declared && declared !== 'application/octet-stream' && declared !== asset.mimeType
    && !(asset.extension === 'jpg' && declared === 'image/jpg')
    && !(asset.extension === 'wav' && declared === 'audio/x-wav')) return privateJson({ error: 'The file content does not match its declared type.' }, { status: 415 });
  const pageCount = asset.kind === 'PDF' ? Number(form.get('pageCount')) : 0;
  if (asset.kind === 'PDF' && (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 600)) return privateJson({ error: 'The PDF page count is invalid or exceeds the supported limit.' }, { status: 400 });
  const sha256 = await sha256Hex(originalBytes);

  const existing = await database().prepare(`SELECT d.id AS recordId,d.title,d.uploaded_at AS uploadedAt,d.status,
    d.owner_id AS ownerId,v.approval_status AS approvalStatus,v.logical_document_id AS documentId,v.id AS versionId,v.version_number AS version,v.source,v.uploaded_by AS uploadedBy
    FROM archive_documents d LEFT JOIN archive_document_versions v ON v.record_id=d.id WHERE d.sha256=? LIMIT 1`).bind(sha256).first();
  if (existing) {
    return privateJson({ exactDuplicate: true, message: 'EXACT FILE MATCH FOUND' }, { status: 409 });
  }

  const recordId = archiveId('DOC');
  const documentId = archiveId('ARC');
  const versionId = archiveId('VER');
  const versionNumber = 1;
  const key = `originals/${recordId}/${sha256}.${asset.extension}`;
  const now = new Date().toISOString();
  try {
    await storage().put(key, originalBytes, { httpMetadata: { contentType: asset.mimeType }, customMetadata: { sha256, recordId, versionId } });
    await database().batch([
      database().prepare('INSERT INTO archive_documents(id,title,filename,sha256,r2_key,bytes,page_count,owner_id,status,processed_pages,uploaded_at,version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(recordId,title,filename,sha256,key,originalBytes.byteLength,pageCount,ownerId,'PENDING_PROCESSING',0,now,versionNumber),
      database().prepare(`INSERT INTO archive_document_versions(id,record_id,logical_document_id,version_number,sha256,mime_type,storage_reference,file_size,uploaded_by,created_at,supersedes_version_id,processing_status,approval_status,verification_status,security_scan_status,description,creator,source,rights,language) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(versionId,recordId,documentId,versionNumber,sha256,asset.mimeType,key,originalBytes.byteLength,email,now,null,'PENDING_PROCESSING','UNREVIEWED','RECORDED','PENDING',description,creator,source,rights,language),
      database().prepare('INSERT INTO archive_processing_jobs(id,record_id,version_id,stage,status,attempts,updated_at,error) VALUES(?,?,?,?,?,?,?,?)')
        .bind(archiveId('JOB'),recordId,versionId,asset.kind === 'PDF' ? 'TEXT_EXTRACTION' : 'MEDIA_PROCESSING','WAITING_FOR_SERVICE',0,now,null),
      database().prepare('INSERT INTO archive_audit_log(id,actor_id,action,record_id,version_id,sha256,created_at,details_json) VALUES(?,?,?,?,?,?,?,?)')
        .bind(archiveId('AUD'),ownerId,'UPLOADED_ORIGINAL',recordId,versionId,sha256,now,JSON.stringify({ mimeType: asset.mimeType, fileSize: originalBytes.byteLength, versionNumber, source })),
    ]);
  } catch {
    const inserted = await database().prepare('SELECT id FROM archive_documents WHERE id=?').bind(recordId).first();
    if (!inserted) await storage().delete(key).catch(() => {});
    if (inserted) return privateJson({ error: 'The source was preserved privately, but its record needs maintenance.' }, { status: 503 });
    const duplicate = await database().prepare('SELECT id AS recordId,title,uploaded_at AS uploadedAt,status FROM archive_documents WHERE sha256=? LIMIT 1').bind(sha256).first();
    if (duplicate) return privateJson({ exactDuplicate: true, message: 'EXACT FILE MATCH FOUND' }, { status: 409 });
    return privateJson({ error: 'The original could not be preserved. No source was indexed.' }, { status: 503 });
  }
  return privateJson({ document: { recordId, title, processingStatus: 'PENDING_PROCESSING' } }, { status: 201 });
}
