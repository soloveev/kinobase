import { sqliteTable, integer, text, real, primaryKey } from 'drizzle-orm/sqlite-core';
import type { DossierFragment, DossierSource } from '@/lib/dossier';
import type { Method, NotableWork, PersonLink, PhotoCredit, WorkNote } from '@/lib/people';

export const films = sqliteTable('films', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  titleRu: text('title_ru').notNull(),
  titleOriginal: text('title_original'),
  posterPath: text('poster_path'),
  releaseDate: text('release_date'),
  // Сезоны сериала; у полного метра пусты. Дата следующего сезона допускает
  // точность до месяца ('ГГГГ-ММ'), потому что анонсы обычно называют месяц.
  // Номер следующего сезона при пустой дате означает «ждём, дата неизвестна».
  seasonsReleased: integer('seasons_released'),
  nextSeasonNumber: integer('next_season_number'),
  nextSeasonDate: text('next_season_date'),
  imdbRating: real('imdb_rating'),
  kinopoiskRating: real('kinopoisk_rating'),
  imdbId: text('imdb_id'),
  kinopoiskId: integer('kinopoisk_id'),
  annotation: text('annotation'),
  director: text('director'),
  producer: text('producer'),
  screenwriter: text('screenwriter'),
  composer: text('composer'),
  soundDesigner: text('sound_designer'),
  cast: text('cast', { mode: 'json' }).$type<string[]>(),
  tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
  // Материалы агента. null означает «блок не собран»; пустой массив запрещён
  // валидатором, иначе появилось бы третье неотличимое состояние.
  dossierBefore: text('dossier_before', { mode: 'json' }).$type<DossierFragment[]>(),
  dossierKeys: text('dossier_keys', { mode: 'json' }).$type<DossierFragment[]>(),
  dossierAfter: text('dossier_after', { mode: 'json' }).$type<DossierFragment[]>(),
  dossierSources: text('dossier_sources', { mode: 'json' }).$type<DossierSource[]>(),
  dossierSearchedAt: text('dossier_searched_at'),
  watched: integer('watched', { mode: 'boolean' }).notNull().default(false),
  // Намерение посмотреть — личное поле, а не признак справочника. По умолчанию
  // «нет»: тайтл, который агент занёс как ссылку из рецензии, попадает
  // в «Другие», а не в рабочий список.
  wantToWatch: integer('want_to_watch', { mode: 'boolean' }).notNull().default(false),
  myRating: integer('my_rating'),
  tasteStar: integer('taste_star', { mode: 'boolean' }).notNull().default(false),
  comment: text('comment'),
  // День, когда тайтл завели в базу. Свойство тайтла, а не конкретной базы: дата
  // едет из файла данных, поэтому у локальной копии и у боевой она одна и та же,
  // даже когда долив на сервер случился позже. Пустой остаётся там, где заведение
  // не датировано, — у записей старше самой колонки, если их не удалось найти
  // в истории файла данных.
  createdAt: text('created_at'),
});

/** Создатель фильма. Личных полей здесь нет и не будет: оценка в этой базе означает
 *  «фильм такой-то», и поставленная человеку означала бы совсем другое. Запрет держится
 *  схемой, а не вёрсткой, — иначе его можно было бы обойти правкой шаблона.
 *
 *  Даты — строки переменной точности ('ГГГГ', 'ГГГГ-ММ', 'ГГГГ-ММ-ДД') по той же причине,
 *  что и `nextSeasonDate`: источник часто называет только год, и первое января было бы
 *  выдумкой. */
export const people = sqliteTable('people', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  nameRu: text('name_ru').notNull(),
  nameOriginal: text('name_original'),
  photoPath: text('photo_path'),
  // Указание автора и лицензии. Пустым остаётся только вместе с `photoPath`:
  // снимок без имени автора показывать нельзя, и валидатор персоналии этого
  // не пропускает. Требование — правовое, см. `research/LEGAL.md`.
  photoCredit: text('photo_credit', { mode: 'json' }).$type<PhotoCredit>(),
  birthDate: text('birth_date'),
  birthPlace: text('birth_place'),
  deathDate: text('death_date'),
  roles: text('roles', { mode: 'json' }).$type<string[]>().notNull().default([]),
  notableWorks: text('notable_works', { mode: 'json' }).$type<NotableWork[]>(),
  links: text('links', { mode: 'json' }).$type<PersonLink[]>(),
  imdbId: text('imdb_id'),
  kinopoiskId: integer('kinopoisk_id'),
  annotation: text('annotation'),
  method: text('method', { mode: 'json' }).$type<Method[]>(),
  workNotes: text('work_notes', { mode: 'json' }).$type<WorkNote[]>(),
  sources: text('sources', { mode: 'json' }).$type<DossierSource[]>(),
  searchedAt: text('searched_at'),
});

/** Первая настоящая связь между таблицами в проекте. Ключ — тройка, а не пара: один
 *  человек бывает в одном фильме и режиссёром, и сценаристом, и это две разные связи. */
export const filmPeople = sqliteTable(
  'film_people',
  {
    filmId: integer('film_id')
      .notNull()
      .references(() => films.id, { onDelete: 'cascade' }),
    personId: integer('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
  },
  (table) => [primaryKey({ columns: [table.filmId, table.personId, table.role] })],
);

export type Film = typeof films.$inferSelect;
export type NewFilm = typeof films.$inferInsert;
export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;
