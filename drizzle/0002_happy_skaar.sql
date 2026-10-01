CREATE TABLE `archive_integration_events` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`version_id` text NOT NULL,
	`service` text NOT NULL,
	`stage` text NOT NULL,
	`status` text NOT NULL,
	`input_reference` text,
	`output_reference` text,
	`error` text,
	`details_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `integration_version` ON `archive_integration_events` (`version_id`,`service`,`created_at`);--> statement-breakpoint
CREATE TABLE `archive_media_transcripts` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`version_id` text NOT NULL,
	`language` text,
	`provider` text,
	`segments_json` text NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `media_transcript_version` ON `archive_media_transcripts` (`version_id`,`status`);--> statement-breakpoint
CREATE TABLE `archive_reviewed_translations` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`page_number` integer NOT NULL,
	`locale` text NOT NULL,
	`source_text_hash` text NOT NULL,
	`translated_text` text NOT NULL,
	`provider` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `translation_source` ON `archive_reviewed_translations` (`source_id`,`page_number`,`locale`,`status`);