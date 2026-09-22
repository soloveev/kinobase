ALTER TABLE `films` ADD `seasons_released` integer;--> statement-breakpoint
ALTER TABLE `films` ADD `next_season_number` integer;--> statement-breakpoint
ALTER TABLE `films` ADD `next_season_date` text;--> statement-breakpoint
ALTER TABLE `films` ADD `want_to_watch` integer DEFAULT false NOT NULL;--> statement-breakpoint
-- Девятнадцать тайтлов, заведённых до v5, владелец занёс осознанно: каждый из
-- них — «хочу посмотреть». Без этой строки все они провалились бы в «Другие»
-- (критерий приёмки 13). На пустой базе строка отрабатывает по нулю строк.
-- ВНИМАНИЕ: повторный `npm run db:generate` перезапишет файл и сотрёт её.
UPDATE `films` SET `want_to_watch` = 1;
