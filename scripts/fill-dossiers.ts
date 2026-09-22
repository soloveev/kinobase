import { eq } from 'drizzle-orm';
import { films } from '../src/db/schema';
import { filmKey } from '../src/lib/film-key';
import {
  validateDossierBlock,
  validateSources,
  type DossierFragment,
  type DossierSource,
} from '../src/lib/dossier';
import { openScriptDb, readDataFile } from './lib/db';
import { DATA_FILES } from './lib/data-files';

type Record = {
  titleRu: string;
  titleOriginal?: string | null;
  searchedAt: string;
  before: DossierFragment[];
  keys?: DossierFragment[];
  after?: DossierFragment[];
  sources: DossierSource[];
};

const records = readDataFile<Record[]>(DATA_FILES.dossiers);

// Валидируем весь файл до открытия базы: ошибка в данных не должна оставить
// половину фильмов обновлёнными, а половину — нет.
for (const record of records) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.searchedAt)) {
    throw new Error(`«${record.titleRu}»: дата поиска должна быть в формате ГГГГ-ММ-ДД`);
  }

  const blocks = [
    ['before', record.before],
    ['keys', record.keys],
    ['after', record.after],
  ] as const;

  for (const [block, fragments] of blocks) {
    if (fragments === undefined) continue;
    const error = validateDossierBlock(block, fragments);
    if (error) {
      throw new Error(`«${record.titleRu}»: блок ${block} отклонён (${error})`);
    }
  }

  const sourcesError = validateSources(record.sources);
  if (sourcesError) {
    throw new Error(`«${record.titleRu}»: список источников отклонён (${sourcesError})`);
  }
}

const db = openScriptDb();

const byTitle = new Map(db.select().from(films).all().map((film) => [filmKey(film), film.id]));

let updated = 0;
const orphans: string[] = [];
for (const record of records) {
  const id = byTitle.get(filmKey(record));
  if (id === undefined) {
    orphans.push(record.titleRu);
    continue;
  }

  // Пишем ровно четыре колонки: оценка, звёздочка, комментарий и отметка
  // о просмотре — личные данные, скрипт их не касается.
  db.update(films)
    .set({
      dossierBefore: record.before,
      dossierKeys: record.keys ?? null,
      dossierAfter: record.after ?? null,
      dossierSources: record.sources,
      dossierSearchedAt: record.searchedAt,
    })
    .where(eq(films.id, id))
    .run();
  updated += 1;
}

console.log(`Досье записаны: ${updated} из ${records.length}`);
if (orphans.length > 0) {
  console.error(`Не нашлись в базе: ${orphans.join(', ')}`);
  process.exit(1);
}
