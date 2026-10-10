CREATE TABLE `accounts` (
	`login` text PRIMARY KEY NOT NULL,
	`name` text,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `snapshots` (
	`key` text PRIMARY KEY NOT NULL,
	`account` text NOT NULL,
	`organization` text NOT NULL,
	`scope` text NOT NULL,
	`window_start` text,
	`window_end` text,
	`fetched_at` integer NOT NULL,
	`incomplete` integer DEFAULT false NOT NULL,
	`note` text,
	`payload` text NOT NULL
);
