import { films, type NewFilm } from '../src/db/schema';
import { filmKey } from '../src/lib/film-key';
import { validateTags } from '../src/lib/tags';
import { validateSeasons } from '../src/lib/seasons';
import { validateCreatedAt } from '../src/lib/check-data';
import { openScriptDb, readDataFile } from './lib/db';
import { DATA_FILES } from './lib/data-files';

// Долив новых тайтлов в непустую базу. Сид на это не годится: он работает
// только с пустой базой, чтобы не затереть личные поля. Дублем считается
// совпадение оригинального названия (у отечественного кино оно же русское),
// поэтому повторный прогон ничего не портит и ничего не задваивает.

const records = readDataFile<NewFilm[]>(DATA_FILES.films);

// Весь файл проверяется до открытия базы: ошибка в одной записи не должна
// оставить базу долитой наполовину.
for (const record of records) {
  if (typeof record.titleRu !== 'string' || record.titleRu.length === 0) {
    throw new Error(`Запись без русского названия: ${JSON.stringify(record)}`);
  }
  const tagsError = validateTags(record.tags ?? []);
  if (tagsError) {
    throw new Error(`«${record.titleRu}»: теги отклонены (${tagsError})`);
  }
  const seasonsError = validateSeasons(
    {
      seasonsReleased: record.seasonsReleased ?? null,
      nextSeasonNumber: record.nextSeasonNumber ?? null,
      nextSeasonDate: record.nextSeasonDate ?? null,
    },
    record.tags ?? []
  );
  if (seasonsError) {
    throw new Error(`«${record.titleRu}»: сезоны отклонены (${seasonsError})`);
  }
  // Дату заведения скрипт не подставляет: прогон на сервере случается позже
  // локального, и «сегодня» развело бы две базы. Дата приходит из файла — либо
  // она там есть, либо тайтл не заводится.
  const createdAtError = validateCreatedAt(record.createdAt);
  if (createdAtError) {
    throw new Error(`«${record.titleRu}»: дата заведения отклонена (${createdAtError})`);
  }
}

const db = openScriptDb();

const existing = new Set(db.select().from(films).all().map(filmKey));
const fresh = records.filter((record) => !existing.has(filmKey(record)));

if (fresh.length === 0) {
  console.log(`Новых тайтлов нет: все ${records.length} записей уже в базе`);
  process.exit(0);
}

db.insert(films).values(fresh).run();
console.log(`Занесено новых тайтлов: ${fresh.length}`);
for (const record of fresh) {
  console.log(`  + ${record.titleRu}`);
}
