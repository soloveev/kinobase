CREATE TABLE `films` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title_ru` text NOT NULL,
	`title_original` text,
	`poster_path` text,
	`release_date` text,
	`imdb_rating` real,
	`kinopoisk_rating` real,
	`annotation` text,
	`director` text,
	`producer` text,
	`screenwriter` text,
	`sound_designer` text,
	`cast` text,
	`watched` integer DEFAULT false NOT NULL,
	`my_rating` integer,
	`taste_star` integer DEFAULT false NOT NULL,
	`comment` text
);
