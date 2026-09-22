import { eq } from 'drizzle-orm';
import { films } from '../src/db/schema';
import { filmKey } from '../src/lib/film-key';
import { validateTags } from '../src/lib/tags';
import { openScriptDb, readDataFile } from './lib/db';
import { DATA_FILES } from './lib/data-files';

const records = readDataFile<
  { titleRu: string; titleOriginal?: string | null; tags: string[] }[]
>(DATA_FILES.tags);

for (const record of records) {
  const error = validateTags(record.tags);
  if (error) {
    throw new Error(`«${record.titleRu}»: набор тегов отклонён (${error}): ${record.tags.join(', ')}`);
  }
}

const db = openScriptDb();

const byTitle = new Map(records.map((record) => [filmKey(record), record.tags]));
const existing = db.select().from(films).all();

let updated = 0;
const missing: string[] = [];
for (const film of existing) {
  const tags = byTitle.get(filmKey(film));
  if (!tags) {
    missing.push(film.titleRu);
    continue;
  }
  db.update(films).set({ tags }).where(eq(films.id, film.id)).run();
  updated += 1;
}

console.log(`Теги проставлены: ${updated} из ${existing.length}`);
if (missing.length > 0) {
  console.error(`Без тегов остались: ${missing.join(', ')}`);
  process.exit(1);
}
