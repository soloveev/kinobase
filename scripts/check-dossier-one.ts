/** Проверка одной записи досье, лежащей в отдельном файле.
 *
 *  `check-dossier` читает общий `content/dossier-data.json`, а агенты порции пишут
 *  каждый в свой файл и на общий не претендуют — иначе они толкались бы на одной
 *  записи (правило работы порцией — в CLAUDE.md). Правила те же: логика берётся
 *  из `src/lib/check-dossier.ts`, здесь только чтение файла и печать.
 *
 *  npm run check-dossier-one content/dossier-<slug>.json
 */
import { checkDossier, type DossierInput } from '../src/lib/check-dossier';
import { readDataFile } from './lib/db';
import { DATA_FILES } from './lib/data-files';
import { factsByTitle } from './lib/facts-archive';

const target = process.argv[2];
if (!target) throw new Error('нужен путь к файлу с одной записью досье');

const root = process.cwd();
const read = (rel: string): unknown[] => {
  const parsed = readDataFile<unknown>(rel);
  if (!Array.isArray(parsed)) throw new Error(`${rel}: ожидался массив записей`);
  return parsed;
};

const dossiers = read(target);
const films = read(DATA_FILES.films);

const keys = dossiers.map((r) => (r as Record<string, unknown>).titleOriginal).filter((k): k is string => typeof k === 'string');
// Несопоставленная папка печатается так же, как в `check-dossier`: до 15.09.2026 этот
// скрипт о ней молчал, и именно его молчание трижды прятало дефект `slugArchive`.
const { facts, skipped } = factsByTitle(root, keys);

type Node = { type?: string; text?: string; items?: string[]; body?: Node[] };
function measure(body: Node[]): { chars: number; units: number } {
  let chars = 0;
  let units = 0;
  const walk = (nodes: Node[]) => {
    for (const node of nodes) {
      if (node.type === 'ul') {
        for (const item of node.items ?? []) { chars += item.length; units += 1; }
        continue;
      }
      if (node.type === 'p' || node.type === 'quote') units += 1;
      chars += node.text?.length ?? 0;
      if (node.body) walk(node.body);
    }
  };
  walk(body);
  return { chars, units };
}

let missingFacts = false;
for (const record of dossiers as { titleRu: string; after?: { key: string; body: Node[] }[] }[]) {
  const after = record.after ?? [];
  const { chars, units } = measure(after.flatMap((b) => b.body));
  console.log(`«${record.titleRu}»: после просмотра — ${chars} знаков, пунктов ${units}, рубрики: ${after.map((b) => b.key).join(', ')}`);
  const found = facts.get((record as unknown as { titleOriginal: string }).titleOriginal) !== undefined;
  if (!found) missingFacts = true;
  console.log(`  таблица фактов: ${found ? 'есть' : 'НЕТ'}`);
}

/** Несопоставленная папка здесь не молчит — но и не кричит сорок раз. `check-dossier`
 *  держит в руках весь корпус, и там неопознанная папка означает сломанный слаг;
 *  здесь ключ один, и все прочие папки архива не сопоставляются просто потому, что
 *  проверяется одна запись. Перечислять их поимённо значило бы каждый прогон выдавать
 *  четыре десятка ложных тревог, а ложная тревога дороже пропуска: скрипту верят
 *  на слово, и строку, которая всегда горит, перестают читать.
 *
 *  Поэтому в норме печатается счёт, а поимённый перечень — тогда, когда таблица фактов
 *  у записи не нашлась: именно в этом случае её папка лежит среди несопоставленных,
 *  и смотреть надо на них. Молчания нет ни в одном из двух случаев — молчание и было
 *  дефектом, который трижды прятал отказ `slugArchive`. */
if (missingFacts) {
  for (const folder of skipped) {
    console.log(`  архив ${folder} не сопоставлен с тайтлом — написания по нему не сверялись`);
  }
} else if (skipped.length > 0) {
  console.log(
    `  архивов не сопоставлено: ${skipped.length} — при проверке одной записи это норма`,
  );
}

const input: DossierInput = { dossiers, films, facts: Object.fromEntries(facts) };
const problems = checkDossier(input);
if (problems === null) { console.log('Форма сходится: нарушений нет'); process.exit(0); }
console.error(`Найдено нарушений: ${problems.length}\n`);
for (const p of problems) console.error(`  ${p.code}: ${p.where}${p.detail === undefined ? '' : ` — ${p.detail}`}`);
process.exit(1);
