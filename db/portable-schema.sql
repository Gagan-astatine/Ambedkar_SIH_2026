-- Apply once in Supabase SQL editor. Server-only connections access these tables; RLS blocks direct client access.
CREATE TABLE IF NOT EXISTS archive_chunks (
	id text PRIMARY KEY NOT NULL,
	document_id text NOT NULL,
	page_id text NOT NULL,
	page_number integer NOT NULL,
	position integer NOT NULL,
	text text NOT NULL,
	embedding_json text NOT NULL
);


CREATE INDEX IF NOT EXISTS chunk_page ON archive_chunks (document_id,page_number);

CREATE TABLE IF NOT EXISTS archive_documents (
	id text PRIMARY KEY NOT NULL,
	title text NOT NULL,
	filename text NOT NULL,
	sha256 text NOT NULL,
	r2_key text NOT NULL,
	bytes integer NOT NULL,
	page_count integer NOT NULL,
	owner_id text NOT NULL,
	status text DEFAULT 'UPLOADED' NOT NULL,
	processed_pages integer DEFAULT 0 NOT NULL,
	uploaded_at text NOT NULL,
	version integer DEFAULT 1 NOT NULL
);


CREATE UNIQUE INDEX IF NOT EXISTS doc_hash_owner ON archive_documents (sha256,owner_id);

CREATE TABLE IF NOT EXISTS archive_events (
	id text PRIMARY KEY NOT NULL,
	document_id text NOT NULL,
	page_id text NOT NULL,
	title text NOT NULL,
	date_text text NOT NULL,
	date_precision text NOT NULL,
	source_text text NOT NULL,
	confidence double precision NOT NULL,
	review_status text DEFAULT 'CANDIDATE' NOT NULL
);


CREATE INDEX IF NOT EXISTS event_doc ON archive_events (document_id);

CREATE TABLE IF NOT EXISTS archive_nodes (
	id text PRIMARY KEY NOT NULL,
	type text NOT NULL,
	label text NOT NULL
);


CREATE UNIQUE INDEX IF NOT EXISTS node_type_label ON archive_nodes (type,label);

CREATE TABLE IF NOT EXISTS archive_pages (
	id text PRIMARY KEY NOT NULL,
	document_id text NOT NULL,
	page_number integer NOT NULL,
	text text NOT NULL,
	method text NOT NULL,
	confidence double precision,
	section text,
	text_hash text NOT NULL
);


CREATE UNIQUE INDEX IF NOT EXISTS doc_page ON archive_pages (document_id,page_number);

CREATE TABLE IF NOT EXISTS archive_vector_postings (
	chunk_id text NOT NULL,
	dimension integer NOT NULL,
	weight double precision NOT NULL
);


CREATE INDEX IF NOT EXISTS vector_dimension ON archive_vector_postings (dimension,weight);

CREATE TABLE IF NOT EXISTS archive_relationships (
	id text PRIMARY KEY NOT NULL,
	from_id text NOT NULL,
	to_id text NOT NULL,
	type text NOT NULL,
	document_id text NOT NULL,
	page_id text NOT NULL,
	source_text text NOT NULL,
	confidence double precision NOT NULL
);


CREATE INDEX IF NOT EXISTS rel_to ON archive_relationships (to_id);
CREATE TABLE IF NOT EXISTS archive_audit_log (
	id text PRIMARY KEY NOT NULL,
	actor_id text NOT NULL,
	action text NOT NULL,
	record_id text,
	version_id text,
	sha256 text,
	created_at text NOT NULL,
	details_json text NOT NULL
);


CREATE INDEX IF NOT EXISTS audit_record ON archive_audit_log (record_id,created_at);

CREATE TABLE IF NOT EXISTS archive_document_versions (
	id text PRIMARY KEY NOT NULL,
	record_id text NOT NULL,
	logical_document_id text NOT NULL,
	version_number integer NOT NULL,
	sha256 text NOT NULL,
	content_fingerprint text,
	mime_type text NOT NULL,
	storage_reference text NOT NULL,
	file_size integer NOT NULL,
	uploaded_by text NOT NULL,
	created_at text NOT NULL,
	supersedes_version_id text,
	processing_status text DEFAULT 'UPLOADED' NOT NULL,
	approval_status text DEFAULT 'AWAITING_ADMIN' NOT NULL,
	verification_status text DEFAULT 'RECORDED' NOT NULL,
	security_scan_status text DEFAULT 'PENDING' NOT NULL,
	reviewed_by text,
	reviewed_at text,
	published_at text,
	review_reason text,
	review_note text,
	description text,
	creator text,
	source text,
	rights text,
	language text
);


CREATE UNIQUE INDEX IF NOT EXISTS version_record ON archive_document_versions (record_id);

CREATE UNIQUE INDEX IF NOT EXISTS version_logical_number ON archive_document_versions (logical_document_id,version_number);

CREATE INDEX IF NOT EXISTS version_sha ON archive_document_versions (sha256);

CREATE INDEX IF NOT EXISTS version_review ON archive_document_versions (approval_status,created_at);

CREATE TABLE IF NOT EXISTS archive_integrity_alerts (
	id text PRIMARY KEY NOT NULL,
	record_id text NOT NULL,
	version_id text NOT NULL,
	expected_sha256 text NOT NULL,
	observed_sha256 text,
	created_at text NOT NULL,
	status text DEFAULT 'OPEN' NOT NULL
);


CREATE INDEX IF NOT EXISTS integrity_record ON archive_integrity_alerts (record_id,created_at);

CREATE TABLE IF NOT EXISTS archive_processing_jobs (
	id text PRIMARY KEY NOT NULL,
	record_id text NOT NULL,
	version_id text NOT NULL,
	stage text NOT NULL,
	status text NOT NULL,
	attempts integer DEFAULT 0 NOT NULL,
	updated_at text NOT NULL,
	error text
);


CREATE UNIQUE INDEX IF NOT EXISTS processing_version ON archive_processing_jobs (version_id);
CREATE TABLE IF NOT EXISTS archive_integration_events (
	id text PRIMARY KEY NOT NULL,
	record_id text NOT NULL,
	version_id text NOT NULL,
	service text NOT NULL,
	stage text NOT NULL,
	status text NOT NULL,
	input_reference text,
	output_reference text,
	error text,
	details_json text DEFAULT '{}' NOT NULL,
	created_at text NOT NULL
);


CREATE INDEX IF NOT EXISTS integration_version ON archive_integration_events (version_id,service,created_at);

CREATE TABLE IF NOT EXISTS archive_media_transcripts (
	id text PRIMARY KEY NOT NULL,
	record_id text NOT NULL,
	version_id text NOT NULL,
	language text,
	provider text,
	segments_json text NOT NULL,
	status text DEFAULT 'PENDING' NOT NULL,
	reviewed_by text,
	reviewed_at text,
	created_at text NOT NULL
);


CREATE INDEX IF NOT EXISTS media_transcript_version ON archive_media_transcripts (version_id,status);

CREATE TABLE IF NOT EXISTS archive_reviewed_translations (
	id text PRIMARY KEY NOT NULL,
	source_id text NOT NULL,
	page_number integer NOT NULL,
	locale text NOT NULL,
	source_text_hash text NOT NULL,
	translated_text text NOT NULL,
	provider text,
	status text DEFAULT 'PENDING' NOT NULL,
	reviewed_by text,
	reviewed_at text,
	created_at text NOT NULL
);


CREATE INDEX IF NOT EXISTS translation_source ON archive_reviewed_translations (source_id,page_number,locale,status);
CREATE TABLE IF NOT EXISTS archive_frame_reviews (
	id text PRIMARY KEY NOT NULL,
	status text NOT NULL,
	reason text NOT NULL,
	reviewed_by text NOT NULL,
	reviewed_at text NOT NULL
);

ALTER TABLE public.archive_chunks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.archive_chunks FROM anon, authenticated;
ALTER TABLE public.archive_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.archive_documents FROM anon, authenticated;
ALTER TABLE public.archive_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.archive_events FROM anon, authenticated;
ALTER TABLE public.archive_nodes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.archive_nodes FROM anon, authenticated;
ALTER TABLE public.archive_pages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.archive_pages FROM anon, authenticated;
ALTER TABLE public.archive_vector_postings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.archive_vector_postings FROM anon, authenticated;
ALTER TABLE public.archive_relationships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.archive_relationships FROM anon, authenticated;
ALTER TABLE public.archive_audit_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.archive_audit_log FROM anon, authenticated;
ALTER TABLE public.archive_document_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.archive_document_versions FROM anon, authenticated;
ALTER TABLE public.archive_integrity_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.archive_integrity_alerts FROM anon, authenticated;
ALTER TABLE public.archive_processing_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.archive_processing_jobs FROM anon, authenticated;
ALTER TABLE public.archive_integration_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.archive_integration_events FROM anon, authenticated;
ALTER TABLE public.archive_media_transcripts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.archive_media_transcripts FROM anon, authenticated;
ALTER TABLE public.archive_reviewed_translations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.archive_reviewed_translations FROM anon, authenticated;
ALTER TABLE public.archive_frame_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.archive_frame_reviews FROM anon, authenticated;
