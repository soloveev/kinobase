import {
  checkDossier,
  countDossier,
  type DossierInput,
  type DossierProblem,
} from '../src/lib/check-dossier';
import { readDataFile } from './lib/db';
import { DATA_FILES } from './lib/data-files';
import { factsByTitle } from './lib/facts-archive';

/** Механическая проверка досье и справочных полей карточки: базу не открывает,
 *  в сеть не ходит, ничего не чинит. Вся логика — в `src/lib/check-dossier.ts`;
 *  здесь только чтение файлов и печать найденного. */

const root = process.cwd();

const FILMS = DATA_FILES.films;
const DOSSIERS = DATA_FILES.dossiers;

function read(relative: string): unknown[] {
  const parsed = readDataFile<unknown>(relative);
  if (!Array.isArray(parsed)) throw new Error(`${relative}: ожидался массив записей`);
  return parsed;
}

const films = read(FILMS);
const dossiers = read(DOSSIERS);

const keys = dossiers
  .map((record) =>
    typeof record === 'object' && record !== null
      ? (record as Record<string, unknown>).titleOriginal
      : null,
  )
  .filter((key): key is string => typeof key === 'string' && key !== '');

// Неопознанная папка не проверяется молча: о ней печатается строка — иначе проверка
// тихо перестала бы работать на новом тайтле.
const { facts, skipped } = factsByTitle(root, keys);
const input: DossierInput = { dossiers, films, facts: Object.fromEntries(facts) };

const problems = checkDossier(input);

if (problems === null) {
  const count = countDossier(input);
  console.log(
    `Досье сходятся: записей ${count.records}, рифм ${count.rhymes}, ` +
      `цитат ${count.quotes}, блоков со звёздочкой правовой рамки ${count.legalBlocks}; ` +
      `архивов сверено ${facts.size}, карточек ${films.length}`,
  );
  for (const folder of skipped) {
    console.log(`  архив ${folder} не сопоставлен с тайтлом — написания по нему не сверялись`);
  }
  process.exit(0);
}

const byTitle = new Map<string, DossierProblem[]>();
for (const problem of problems) {
  const bucket = byTitle.get(problem.title) ?? [];
  bucket.push(problem);
  byTitle.set(problem.title, bucket);
}

console.error(`Найдено нарушений: ${problems.length}\n`);
for (const [title, found] of byTitle) {
  console.error(`«${title}»:`);
  for (const problem of found) {
    const detail = problem.detail === undefined ? '' : ` — ${problem.detail}`;
    console.error(`  ${problem.code}: ${problem.where}${detail}`);
  }
  console.error('');
}
process.exit(1);
