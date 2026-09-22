import { eq } from 'drizzle-orm';
import { filmPeople, films, people, type NewPerson } from '../src/db/schema';
import { filmKey } from '../src/lib/film-key';
import { ROLE_BY_SLUG, validatePerson } from '../src/lib/people';
import { openScriptDb, readDataFile } from './lib/db';
import { DATA_FILES } from './lib/data-files';

type FilmLink = { titleOriginal: string; role: string };
type PersonRecord = NewPerson & { films?: FilmLink[] };

const records = readDataFile<PersonRecord[]>(DATA_FILES.people);

// Весь файл проверяется до открытия базы: ошибка в одной записи не должна оставить
// базу наполненной наполовину. Тот же порядок, что у остальных скриптов наполнения.
const slugs = new Set<string>();
for (const record of records) {
  const error = validatePerson({
    slug: record.slug,
    nameRu: record.nameRu,
    birthDate: record.birthDate,
    deathDate: record.deathDate,
    roles: record.roles ?? [],
    links: record.links,
    method: record.method,
    workNotes: record.workNotes,
    sources: record.sources,
    // Без этих двух долив стал бы дырой в запрете: валидатор не увидел бы снимка
    // и пропустил бы фотографию без указания автора прямо в базу.
    photoPath: record.photoPath,
    photoCredit: record.photoCredit,
  });
  if (error) {
    throw new Error(`«${record.nameRu}»: запись отклонена (${error})`);
  }

  if (slugs.has(record.slug)) {
    throw new Error(`«${record.nameRu}»: slug «${record.slug}» встречается дважды`);
  }
  slugs.add(record.slug);

  for (const link of record.films ?? []) {
    if (!ROLE_BY_SLUG.has(link.role)) {
      throw new Error(`«${record.nameRu}»: роль «${link.role}» не из словаря`);
    }
  }
}

/** Какое текстовое поле карточки отвечает за роль. Роли, которой в карточке нет
 *  отдельной строки (оператор, монтажёр, художник, аниматор, автор оригинала),
 *  проверять не по чему — связь для них заводится без сверки имени. */
const FIELD_OF_ROLE: Partial<Record<string, 'director' | 'producer' | 'screenwriter' | 'composer' | 'soundDesigner' | 'cast'>> = {
  director: 'director',
  producer: 'producer',
  screenwriter: 'screenwriter',
  composer: 'composer',
  sound: 'soundDesigner',
  actor: 'cast',
};

const db = openScriptDb();

const filmByOriginal = new Map(
  db
    .select()
    .from(films)
    .all()
    .map((film) => [filmKey(film), film]),
);

const problems: string[] = [];
let added = 0;
let updated = 0;
let links = 0;

for (const record of records) {
  const { films: filmLinks = [], ...values } = record;

  const existing = db.select().from(people).where(eq(people.slug, record.slug)).get();
  let personId: number;
  if (existing) {
    db.update(people).set(values).where(eq(people.id, existing.id)).run();
    personId = existing.id;
    updated += 1;
  } else {
    personId = db.insert(people).values(values).returning().get().id;
    added += 1;
  }

  // Связи персоналии пересобираются целиком: снятая роль должна исчезать, а не
  // оставаться в базе призраком прошлого прогона.
  db.delete(filmPeople).where(eq(filmPeople.personId, personId)).run();

  for (const link of filmLinks) {
    const film = filmByOriginal.get(link.titleOriginal);
    if (!film) {
      problems.push(`«${record.nameRu}»: фильма «${link.titleOriginal}» нет в базе`);
      continue;
    }

    // Молчаливая связь, которая никуда не ведёт, хуже отсутствующей: имя в карточке
    // так и останется текстом, а база будет уверена, что ссылка есть.
    const field = FIELD_OF_ROLE[link.role];
    if (field) {
      const value = field === 'cast' ? (film.cast ?? []).join(', ') : film[field];
      if (!value || !value.includes(record.nameRu)) {
        problems.push(
          `«${record.nameRu}»: имя не встречается в поле «${field}» фильма «${film.titleRu}»`,
        );
        continue;
      }
    }

    db.insert(filmPeople).values({ filmId: film.id, personId, role: link.role }).run();
    links += 1;
  }
}

console.log(`Персоналии: заведено ${added}, обновлено ${updated}; связей с фильмами ${links}`);

if (problems.length > 0) {
  console.error('Связи, которые не удалось записать:');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
