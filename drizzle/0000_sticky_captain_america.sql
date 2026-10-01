CREATE TABLE `archive_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`page_id` text NOT NULL,
	`page_number` integer NOT NULL,
	`position` integer NOT NULL,
	`text` text NOT NULL,
	`embedding_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chunk_page` ON `archive_chunks` (`document_id`,`page_number`);--> statement-breakpoint
CREATE TABLE `archive_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`filename` text NOT NULL,
	`sha256` text NOT NULL,
	`r2_key` text NOT NULL,
	`bytes` integer NOT NULL,
	`page_count` integer NOT NULL,
	`owner_id` text NOT NULL,
	`status` text DEFAULT 'UPLOADED' NOT NULL,
	`processed_pages` integer DEFAULT 0 NOT NULL,
	`uploaded_at` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `doc_hash_owner` ON `archive_documents` (`sha256`,`owner_id`);--> statement-breakpoint
CREATE TABLE `archive_events` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`page_id` text NOT NULL,
	`title` text NOT NULL,
	`date_text` text NOT NULL,
	`date_precision` text NOT NULL,
	`source_text` text NOT NULL,
	`confidence` real NOT NULL,
	`review_status` text DEFAULT 'CANDIDATE' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `event_doc` ON `archive_events` (`document_id`);--> statement-breakpoint
CREATE TABLE `archive_nodes` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`label` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `node_type_label` ON `archive_nodes` (`type`,`label`);--> statement-breakpoint
CREATE TABLE `archive_pages` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`page_number` integer NOT NULL,
	`text` text NOT NULL,
	`method` text NOT NULL,
	`confidence` real,
	`section` text,
	`text_hash` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `doc_page` ON `archive_pages` (`document_id`,`page_number`);--> statement-breakpoint
CREATE TABLE `archive_vector_postings` (
	`chunk_id` text NOT NULL,
	`dimension` integer NOT NULL,
	`weight` real NOT NULL
);
--> statement-breakpoint
CREATE INDEX `vector_dimension` ON `archive_vector_postings` (`dimension`,`weight`);--> statement-breakpoint
CREATE TABLE `archive_relationships` (
	`id` text PRIMARY KEY NOT NULL,
	`from_id` text NOT NULL,
	`to_id` text NOT NULL,
	`type` text NOT NULL,
	`document_id` text NOT NULL,
	`page_id` text NOT NULL,
	`source_text` text NOT NULL,
	`confidence` real NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rel_to` ON `archive_relationships` (`to_id`);