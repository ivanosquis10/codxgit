CREATE TABLE `repositories` (
	`account` text NOT NULL,
	`organization` text NOT NULL,
	`full_name_key` text NOT NULL,
	`full_name` text NOT NULL,
	`url` text NOT NULL,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`pinned` integer DEFAULT false NOT NULL,
	`source` text DEFAULT 'observed' NOT NULL,
	PRIMARY KEY(`account`, `organization`, `full_name_key`)
);
