CREATE TABLE `archive_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`record_id` text,
	`version_id` text,
	`sha256` text,
	`created_at` text NOT NULL,
	`details_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_record` ON `archive_audit_log` (`record_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `archive_document_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`logical_document_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`sha256` text NOT NULL,
	`content_fingerprint` text,
	`mime_type` text NOT NULL,
	`storage_reference` text NOT NULL,
	`file_size` integer NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` text NOT NULL,
	`supersedes_version_id` text,
	`processing_status` text DEFAULT 'UPLOADED' NOT NULL,
	`approval_status` text DEFAULT 'AWAITING_ADMIN' NOT NULL,
	`verification_status` text DEFAULT 'RECORDED' NOT NULL,
	`security_scan_status` text DEFAULT 'PENDING' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text,
	`published_at` text,
	`review_reason` text,
	`review_note` text,
	`description` text,
	`creator` text,
	`source` text,
	`rights` text,
	`language` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `version_record` ON `archive_document_versions` (`record_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `version_logical_number` ON `archive_document_versions` (`logical_document_id`,`version_number`);--> statement-breakpoint
CREATE INDEX `version_sha` ON `archive_document_versions` (`sha256`);--> statement-breakpoint
CREATE INDEX `version_review` ON `archive_document_versions` (`approval_status`,`created_at`);--> statement-breakpoint
CREATE TABLE `archive_integrity_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`version_id` text NOT NULL,
	`expected_sha256` text NOT NULL,
	`observed_sha256` text,
	`created_at` text NOT NULL,
	`status` text DEFAULT 'OPEN' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `integrity_record` ON `archive_integrity_alerts` (`record_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `archive_processing_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`version_id` text NOT NULL,
	`stage` text NOT NULL,
	`status` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `processing_version` ON `archive_processing_jobs` (`version_id`);