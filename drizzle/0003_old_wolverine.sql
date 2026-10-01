CREATE TABLE `archive_frame_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`reason` text NOT NULL,
	`reviewed_by` text NOT NULL,
	`reviewed_at` text NOT NULL
);
