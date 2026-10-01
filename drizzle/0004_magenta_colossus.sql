CREATE TABLE `archive_stories` (
	`story_id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`language` text NOT NULL,
	`query` text NOT NULL,
	`kind` text NOT NULL,
	`introduction` text NOT NULL,
	`source_documents` text NOT NULL,
	`source_pages` text NOT NULL,
	`chapters_json` text NOT NULL,
	`media_json` text NOT NULL,
	`generated_at` text NOT NULL,
	`generation_status` text NOT NULL,
	`review_status` text NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text
);
--> statement-breakpoint
CREATE INDEX `story_review` ON `archive_stories` (`review_status`,`generated_at`);