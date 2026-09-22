import { eq } from 'drizzle-orm';
import { films } from '../src/db/schema';
import { filmKey } from '../src/lib/film-key';
import { validateSeasons } from '../src/lib/seasons';
import { openScriptDb, readDataFile } from './lib/db';
import { DATA_FILES } from './lib/data-files';

type SeasonsRecord = {
  titleRu: string;
  titleOriginal?: string | null;
  seasonsReleased: number | null;
  nextSeasonNumber: number | null;
  nextSeasonDate: string | null;
};

const records = readDataFile<SeasonsRecord[]>(DATA_FILES.seasons);

const db = openScriptDb();

const existing = db.select().from(films).all();
const byTitle = new Map(existing.map((film) => [filmKey(film), film]));

// Валидируем весь файл до единой записи в базу: ошибка в данных не должна
// оставить половину сериалов обновлёнными. Сезоны проверяются вместе с тегами —
// у тайтла без тега `series` их быть не может.
for (const record of records) {
  const film = byTitle.get(filmKey(record));
  if (!film) {
    throw new Error(`«${record.titleRu}»: такого тайтла в базе нет`);
  }
  const error = validateSeasons(record, film.tags ?? []);
  if (error) {
    throw new Error(`«${record.titleRu}»: сезоны отклонены (${error})`);
  }
}

let updated = 0;
for (const record of records) {
  const film = byTitle.get(filmKey(record))!;
  // Оценка, звёздочка, комментарий, отметка о просмотре и галочка «хочу
  // посмотреть» — личные данные, скрипт их не касается.
  db.update(films)
    .set({
      seasonsReleased: record.seasonsReleased,
      nextSeasonNumber: record.nextSeasonNumber,
      nextSeasonDate: record.nextSeasonDate,
    })
    .where(eq(films.id, film.id))
    .run();
  updated += 1;
}

const series = existing.filter((film) => (film.tags ?? []).includes('series'));
console.log(`Сезоны записаны: ${updated} тайтлов из ${series.length} сериалов в базе`);

const untouched = series.filter((film) => !records.some((r) => filmKey(r) === filmKey(film)));
if (untouched.length > 0) {
  console.error(`Без сезонов остались: ${untouched.map((f) => f.titleRu).join(', ')}`);
  process.exit(1);
}
