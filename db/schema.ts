import {sqliteTable,text,integer,real,index,uniqueIndex} from 'drizzle-orm/sqlite-core';
export const documents=sqliteTable('archive_documents',{id:text('id').primaryKey(),title:text('title').notNull(),filename:text('filename').notNull(),sha256:text('sha256').notNull(),r2Key:text('r2_key').notNull(),bytes:integer('bytes').notNull(),pageCount:integer('page_count').notNull(),ownerId:text('owner_id').notNull(),status:text('status').notNull().default('UPLOADED'),processedPages:integer('processed_pages').notNull().default(0),uploadedAt:text('uploaded_at').notNull(),version:integer('version').notNull().default(1)},t=>[uniqueIndex('doc_hash_owner').on(t.sha256,t.ownerId)]);
export const pages=sqliteTable('archive_pages',{id:text('id').primaryKey(),documentId:text('document_id').notNull(),pageNumber:integer('page_number').notNull(),text:text('text').notNull(),method:text('method').notNull(),confidence:real('confidence'),section:text('section'),textHash:text('text_hash').notNull()},t=>[uniqueIndex('doc_page').on(t.documentId,t.pageNumber)]);
export const chunks=sqliteTable('archive_chunks',{id:text('id').primaryKey(),documentId:text('document_id').notNull(),pageId:text('page_id').notNull(),pageNumber:integer('page_number').notNull(),position:integer('position').notNull(),text:text('text').notNull(),embedding:text('embedding_json').notNull()},t=>[index('chunk_page').on(t.documentId,t.pageNumber)]);
export const postings=sqliteTable('archive_vector_postings',{chunkId:text('chunk_id').notNull(),dimension:integer('dimension').notNull(),weight:real('weight').notNull()},t=>[index('vector_dimension').on(t.dimension,t.weight)]);
export const nodes=sqliteTable('archive_nodes',{id:text('id').primaryKey(),type:text('type').notNull(),label:text('label').notNull()},t=>[uniqueIndex('node_type_label').on(t.type,t.label)]);
export const relationships=sqliteTable('archive_relationships',{id:text('id').primaryKey(),fromId:text('from_id').notNull(),toId:text('to_id').notNull(),type:text('type').notNull(),documentId:text('document_id').notNull(),pageId:text('page_id').notNull(),sourceText:text('source_text').notNull(),confidence:real('confidence').notNull()},t=>[index('rel_to').on(t.toId)]);
export const events=sqliteTable('archive_events',{id:text('id').primaryKey(),documentId:text('document_id').notNull(),pageId:text('page_id').notNull(),title:text('title').notNull(),dateText:text('date_text').notNull(),datePrecision:text('date_precision').notNull(),sourceText:text('source_text').notNull(),confidence:real('confidence').notNull(),reviewStatus:text('review_status').notNull().default('CANDIDATE')},t=>[index('event_doc').on(t.documentId)]);

// A physical archive_documents row is one immutable original. Logical documents
// can have multiple originals, each with its own version, hash and review state.
export const documentVersions=sqliteTable('archive_document_versions',{
 id:text('id').primaryKey(),recordId:text('record_id').notNull(),logicalDocumentId:text('logical_document_id').notNull(),versionNumber:integer('version_number').notNull(),sha256:text('sha256').notNull(),contentFingerprint:text('content_fingerprint'),mimeType:text('mime_type').notNull(),storageReference:text('storage_reference').notNull(),fileSize:integer('file_size').notNull(),uploadedBy:text('uploaded_by').notNull(),createdAt:text('created_at').notNull(),supersedesVersionId:text('supersedes_version_id'),processingStatus:text('processing_status').notNull().default('UPLOADED'),approvalStatus:text('approval_status').notNull().default('AWAITING_ADMIN'),verificationStatus:text('verification_status').notNull().default('RECORDED'),securityScanStatus:text('security_scan_status').notNull().default('PENDING'),reviewedBy:text('reviewed_by'),reviewedAt:text('reviewed_at'),publishedAt:text('published_at'),reviewReason:text('review_reason'),reviewNote:text('review_note'),description:text('description'),creator:text('creator'),source:text('source'),rights:text('rights'),language:text('language'),
},t=>[uniqueIndex('version_record').on(t.recordId),uniqueIndex('version_logical_number').on(t.logicalDocumentId,t.versionNumber),index('version_sha').on(t.sha256),index('version_review').on(t.approvalStatus,t.createdAt)]);

export const archiveAudit=sqliteTable('archive_audit_log',{
 id:text('id').primaryKey(),actorId:text('actor_id').notNull(),action:text('action').notNull(),recordId:text('record_id'),versionId:text('version_id'),sha256:text('sha256'),createdAt:text('created_at').notNull(),detailsJson:text('details_json').notNull(),
},t=>[index('audit_record').on(t.recordId,t.createdAt)]);

export const integrityAlerts=sqliteTable('archive_integrity_alerts',{
 id:text('id').primaryKey(),recordId:text('record_id').notNull(),versionId:text('version_id').notNull(),expectedSha256:text('expected_sha256').notNull(),observedSha256:text('observed_sha256'),createdAt:text('created_at').notNull(),status:text('status').notNull().default('OPEN'),
},t=>[index('integrity_record').on(t.recordId,t.createdAt)]);

export const processingJobs=sqliteTable('archive_processing_jobs',{
 id:text('id').primaryKey(),recordId:text('record_id').notNull(),versionId:text('version_id').notNull(),stage:text('stage').notNull(),status:text('status').notNull(),attempts:integer('attempts').notNull().default(0),updatedAt:text('updated_at').notNull(),error:text('error'),
},t=>[uniqueIndex('processing_version').on(t.versionId)]);

export const integrationEvents=sqliteTable('archive_integration_events',{
 id:text('id').primaryKey(),recordId:text('record_id').notNull(),versionId:text('version_id').notNull(),service:text('service').notNull(),stage:text('stage').notNull(),status:text('status').notNull(),inputReference:text('input_reference'),outputReference:text('output_reference'),error:text('error'),detailsJson:text('details_json').notNull().default('{}'),createdAt:text('created_at').notNull(),
},t=>[index('integration_version').on(t.versionId,t.service,t.createdAt)]);

export const reviewedTranslations=sqliteTable('archive_reviewed_translations',{
 id:text('id').primaryKey(),sourceId:text('source_id').notNull(),pageNumber:integer('page_number').notNull(),locale:text('locale').notNull(),sourceTextHash:text('source_text_hash').notNull(),translatedText:text('translated_text').notNull(),provider:text('provider'),status:text('status').notNull().default('PENDING'),reviewedBy:text('reviewed_by'),reviewedAt:text('reviewed_at'),createdAt:text('created_at').notNull(),
},t=>[index('translation_source').on(t.sourceId,t.pageNumber,t.locale,t.status)]);

export const mediaTranscripts=sqliteTable('archive_media_transcripts',{
 id:text('id').primaryKey(),recordId:text('record_id').notNull(),versionId:text('version_id').notNull(),language:text('language'),provider:text('provider'),segmentsJson:text('segments_json').notNull(),status:text('status').notNull().default('PENDING'),reviewedBy:text('reviewed_by'),reviewedAt:text('reviewed_at'),createdAt:text('created_at').notNull(),
},t=>[index('media_transcript_version').on(t.versionId,t.status)]);

export const frameReviews=sqliteTable('archive_frame_reviews',{
 id:text('id').primaryKey(),status:text('status').notNull(),reason:text('reason').notNull(),reviewedBy:text('reviewed_by').notNull(),reviewedAt:text('reviewed_at').notNull(),
});

export const stories=sqliteTable('archive_stories',{
 storyId:text('story_id').primaryKey(),title:text('title').notNull(),language:text('language').notNull(),query:text('query').notNull(),kind:text('kind').notNull(),introduction:text('introduction').notNull(),sourceDocuments:text('source_documents').notNull(),sourcePages:text('source_pages').notNull(),chaptersJson:text('chapters_json').notNull(),mediaJson:text('media_json').notNull(),generatedAt:text('generated_at').notNull(),generationStatus:text('generation_status').notNull(),reviewStatus:text('review_status').notNull(),reviewedBy:text('reviewed_by'),reviewedAt:text('reviewed_at'),
},t=>[index('story_review').on(t.reviewStatus,t.generatedAt)]);
