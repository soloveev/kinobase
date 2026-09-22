// Общие фабрики для тестов. Не тест-файл: vitest подхватывает только *.test.ts(x).

import type { Film, Person } from '@/db/schema';
import type { DossierFragment, DossierNode, DossierSource } from '@/lib/dossier';

export type { DossierFragment, DossierNode, DossierSource };

/** Оба псевдонима остались с тех версий, когда полей ещё не было в схеме: v3 добавила
 *  теги, v4 — досье. Миграции прошли, и теперь оба сошлись с самим `Film`. */
export type FilmWithTags = Film & { tags: string[] };
export type FilmWithDossier = Film;

/** Полностью заполненный фильм с пустыми значениями по умолчанию — чтобы тесты
 *  задавали только те поля, которые действительно проверяют. */
export function makeFilm(
  overrides: Partial<FilmWithDossier> & { id: number; titleRu: string },
): FilmWithDossier {
  return {
    titleOriginal: null,
    posterPath: null,
    releaseDate: null,
    seasonsReleased: null,
    nextSeasonNumber: null,
    nextSeasonDate: null,
    imdbRating: null,
    kinopoiskRating: null,
    imdbId: null,
    kinopoiskId: null,
    annotation: null,
    director: null,
    producer: null,
    screenwriter: null,
    // v7: композитор — такое же текстовое поле создателей, как звукорежиссёр рядом.
    composer: null,
    soundDesigner: null,
    cast: null,
    watched: false,
    wantToWatch: false,
    myRating: null,
    tasteStar: false,
    comment: null,
    tags: [],
    dossierBefore: null,
    dossierKeys: null,
    dossierAfter: null,
    dossierSources: null,
    dossierSearchedAt: null,
    createdAt: null,
    ...overrides,
  };
}

/** Значения для вставки в базу: id генерирует SQLite. */
export function filmValues(
  overrides: Partial<Omit<FilmWithDossier, 'id'>> & { titleRu: string },
): Omit<Film, 'id'> {
  const film: Partial<FilmWithDossier> = makeFilm({ id: 0, ...overrides });
  delete film.id;
  return film as Omit<Film, 'id'>;
}

/** Полностью заполненная персоналия с пустыми значениями по умолчанию — тот же приём,
 *  что у `makeFilm`: тест задаёт только то, что проверяет.
 *
 *  Личных полей здесь нет и быть не может: спека v7, раздел 7 — персоналию нельзя
 *  оценить, и запрет держится схемой, а не вёрсткой. */
export function makePerson(
  overrides: Partial<Person> & { id: number; slug: string; nameRu: string },
): Person {
  return {
    nameOriginal: null,
    photoPath: null,
    // v11: снимок и указание автора существуют только вместе — колонка появилась
    // вместе с блоком «Фотография» на странице человека.
    photoCredit: null,
    birthDate: null,
    birthPlace: null,
    deathDate: null,
    roles: [],
    notableWorks: null,
    links: null,
    imdbId: null,
    kinopoiskId: null,
    annotation: null,
    method: null,
    workNotes: null,
    sources: null,
    searchedAt: null,
    ...overrides,
  };
}

/** Значения для вставки в базу: id генерирует SQLite. */
export function personValues(
  overrides: Partial<Omit<Person, 'id'>> & { slug: string; nameRu: string },
): Omit<Person, 'id'> {
  const person: Partial<Person> = makePerson({ id: 0, ...overrides });
  delete person.id;
  return person as Omit<Person, 'id'>;
}
