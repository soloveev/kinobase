import { count, eq, inArray } from 'drizzle-orm';
import type { Db } from '@/db';
import { filmPeople, films, people, type Film, type Person } from '@/db/schema';

/** Персоналии в порядке показа указателя — по имени, по-русски. `localeCompare`
 *  здесь, а не `ORDER BY` в SQLite: у SQLite нет русской локали, и «Ё» уехала бы
 *  в конец алфавита. */
export function listPeople(db: Db): Person[] {
  return db
    .select()
    .from(people)
    .all()
    .sort((a, b) => a.nameRu.localeCompare(b.nameRu, 'ru'));
}

/** Сколько персоналий в базе. Нужно шапке — она несёт это число на каждой странице
 *  сайта, и вычитывать ради него все записи целиком незачем. Отбор ролей на счётчик
 *  не влияет: он живёт в адресе указателя, а шапка про него не знает — ровно как
 *  счётчики табов статусов не знают о выбранных жанрах. */
export function countPeople(db: Db): number {
  return db.select({ value: count() }).from(people).get()?.value ?? 0;
}

export function getPersonBySlug(db: Db, slug: string): Person | undefined {
  return db.select().from(people).where(eq(people.slug, slug)).get();
}

/** Фильмы человека, по одному разу каждый: связь — тройка, и у режиссёра-сценариста
 *  одного фильма строк в `film_people` две, а фильм в галерее один. */
export function filmsOfPerson(db: Db, personId: number): Film[] {
  const ids = [
    ...new Set(
      db
        .select({ filmId: filmPeople.filmId })
        .from(filmPeople)
        .where(eq(filmPeople.personId, personId))
        .all()
        .map((row) => row.filmId),
    ),
  ];
  if (ids.length === 0) return [];

  return db
    .select()
    .from(films)
    .where(inArray(films.id, ids))
    .all()
    .sort((a, b) => (a.releaseDate ?? '').localeCompare(b.releaseDate ?? ''));
}

/** Люди фильма вместе с ролью. Человек, названный в двух ролях, встречается дважды —
 *  по разу на роль: строку «Режиссёр» и строку «Сценарист» карточка печатает отдельно. */
export function peopleOfFilm(db: Db, filmId: number): { person: Person; role: string }[] {
  return db
    .select({ person: people, role: filmPeople.role })
    .from(filmPeople)
    .innerJoin(people, eq(people.id, filmPeople.personId))
    .where(eq(filmPeople.filmId, filmId))
    .all();
}

/** Сколько у кого фильмов в базе — для подписи в указателе. Считается по разным
 *  фильмам, а не по строкам связи, по той же причине, что и в `filmsOfPerson`. */
export function filmCountsByPerson(db: Db): Map<number, number> {
  const seen = new Map<number, Set<number>>();

  for (const row of db
    .select({ personId: filmPeople.personId, filmId: filmPeople.filmId })
    .from(filmPeople)
    .all()) {
    const forPerson = seen.get(row.personId) ?? new Set<number>();
    forPerson.add(row.filmId);
    seen.set(row.personId, forPerson);
  }

  return new Map([...seen].map(([personId, filmIds]) => [personId, filmIds.size]));
}
