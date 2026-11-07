CREATE TABLE `share` (
	`id` text PRIMARY KEY NOT NULL,
	`plan_id` text NOT NULL,
	`token` text NOT NULL,
	`mode` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`plan_id`) REFERENCES `plan`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `share_token_unique` ON `share` (`token`);--> statement-breakpoint
CREATE INDEX `share_plan_idx` ON `share` (`plan_id`);