import { eq } from 'drizzle-orm';
import { films } from '../src/db/schema';
import { filmKey } from '../src/lib/film-key';
import { planRefresh, type FieldChange } from '../src/lib/refresh';
import { openScriptDb, readDataFile } from './lib/db';
import { DATA_FILES } from './lib/data-files';

/** Перенос справочных полей уже занесённых тайтлов из файла данных в базу.
 *
 *  Новых тайтлов не заводит — это `add-films`. Тегов и сезонов не трогает —
 *  у них свои команды. Личных полей и материалов агента не касается вовсе:
 *  перечень обновляемых колонок задан в `src/lib/refresh.ts` и закрыт тестом.
 *
 *  По умолчанию только показывает, что изменится. Записывает с флагом `--go`:
 *  правка справочных полей боевой базы — не то действие, которое стоит делать
 *  между делом. */

const write = process.argv.includes('--go');

const records = readDataFile<Record<string, unknown>[]>(DATA_FILES.films);

const db = openScriptDb();
const rows = db.select().from(films).all();

const plan = planRefresh(rows as unknown as Record<string, unknown>[], records);

if (plan.length === 0) {
  console.log(`Справочные поля сходятся: ${rows.length} тайтлов в базе, переносить нечего`);
  process.exit(0);
}

const show = (value: unknown): string => {
  if (value === null || value === undefined) return 'пусто';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
};

const idByKey = new Map(rows.map((row) => [filmKey(row), row.id]));

let fields = 0;
for (const item of plan) {
  console.log(`\n${item.titleOriginal}`);
  for (const change of item.changes) {
    console.log(`  ${change.field}: ${show(change.from)} → ${show(change.to)}`);
    fields += 1;
  }

  if (!write) continue;

  const id = idByKey.get(item.titleOriginal);
  if (id === undefined) continue;
  const patch = Object.fromEntries(
    item.changes.map((change: FieldChange) => [change.field, change.to]),
  );
  db.update(films).set(patch).where(eq(films.id, id)).run();
}

const summary = `полей — ${fields}, тайтлов — ${plan.length}`;
console.log(
  write
    ? `\nПеренесено в базу: ${summary}`
    : `\nК переносу: ${summary}. Записать: npm run refresh-films -- --go`,
);
