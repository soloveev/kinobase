import path from 'node:path';
import { films, type NewFilm } from '../src/db/schema';
import { validateCreatedAt } from '../src/lib/check-data';
import { openScriptDb, readDataFile } from './lib/db';
import { DATA_FILES } from './lib/data-files';

const DATA = DATA_FILES.films;
const records = readDataFile<NewFilm[]>(DATA);

if (!Array.isArray(records) || records.length === 0) {
  throw new Error(`В ${path.join(process.cwd(), DATA)} нет записей для наполнения`);
}
for (const record of records) {
  if (typeof record.titleRu !== 'string' || record.titleRu.length === 0) {
    throw new Error(`Запись без русского названия: ${JSON.stringify(record)}`);
  }
  // Дата заведения едет из файла и здесь: пересев пустой базы обязан восстановить
  // настоящую историю, а не проставить всем день пересева.
  const createdAtError = validateCreatedAt(record.createdAt);
  if (createdAtError) {
    throw new Error(`«${record.titleRu}»: дата заведения отклонена (${createdAtError})`);
  }
}

const db = openScriptDb();

const existing = db.select().from(films).all();
if (existing.length > 0) {
  console.error(
    `В базе уже ${existing.length} фильмов — сид остановлен, чтобы не затереть личные данные. ` +
      'Для повторного наполнения удалите файл базы вручную.'
  );
  process.exit(1);
}

db.insert(films).values(records).run();
console.log(`Занесено фильмов: ${records.length}`);
