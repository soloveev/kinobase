CREATE TABLE `film_people` (
	`film_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	`role` text NOT NULL,
	PRIMARY KEY(`film_id`, `person_id`, `role`),
	FOREIGN KEY (`film_id`) REFERENCES `films`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `people` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name_ru` text NOT NULL,
	`name_original` text,
	`photo_path` text,
	`birth_date` text,
	`birth_place` text,
	`death_date` text,
	`roles` text DEFAULT '[]' NOT NULL,
	`notable_works` text,
	`links` text,
	`imdb_id` text,
	`kinopoisk_id` integer,
	`annotation` text,
	`method` text,
	`work_notes` text,
	`sources` text,
	`searched_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `people_slug_unique` ON `people` (`slug`);--> statement-breakpoint
ALTER TABLE `films` ADD `composer` text;