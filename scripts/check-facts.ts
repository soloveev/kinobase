import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { checkFacts, type FactsCount } from '../src/lib/check-facts';

/** Считает и проверяет таблицы фактов в архивах заходов. Замер захода перестаёт быть
 *  словом агента: строки, статусы и файлы архива считает код. */

const ROOT = 'research';
const SKIP = new Set(['new-titles']);

/** Архивы, собранные по прежним правилам таблицы фактов, где рубрика `справка` ещё
 *  допускалась в зональной таблице. В этой версии таких архивов нет: список пуст и
 *  остаётся местом, куда вписывается папка, если правило меняется задним числом. */
const LEGACY_RULES = new Set<string>([]);

function runFolders(): string[] {
  const folders: string[] = [];
  for (const name of readdirSync(ROOT)) {
    const path = join(ROOT, name);
    if (!statSync(path).isDirectory() || SKIP.has(name)) continue;
    if (name === 'people') {
      for (const person of readdirSync(path)) {
        const inner = join(path, person);
        if (statSync(inner).isDirectory()) folders.push(inner);
      }
      continue;
    }
    folders.push(path);
  }
  return folders;
}

const isFactsFile = (name: string) => /^facts(-[a-z0-9-]+)?\.md$/.test(name);
const isPage = (name: string) =>
  name.endsWith('.md') && !/^(facts|findings|sources|SOURCES|review|task)/.test(name);

let failed = false;

for (const folder of runFolders()) {
  const names = readdirSync(folder);
  const tables = names.filter(isFactsFile);
  if (tables.length === 0) continue;

  const files = Object.fromEntries(
    tables.map((name) => [name, readFileSync(join(folder, name), 'utf8')]),
  );
  const slug = folder.slice(`${ROOT}/`.length);
  const legacyRules = LEGACY_RULES.has(slug);
  const { problems, counts } = checkFacts(files, new Set(names.filter(isPage)), { legacyRules });

  const total = Object.values(counts).reduce<FactsCount>(
    (sum, count) => ({
      rows: sum.rows + count.rows,
      confirmed: sum.confirmed + count.confirmed,
      reported: sum.reported + count.reported,
      rumor: sum.rumor + count.rumor,
      reference: sum.reference + count.reference,
      unused: sum.unused + count.unused,
      withQuote: sum.withQuote + count.withQuote,
      files: Math.max(sum.files, count.files),
    }),
    { rows: 0, confirmed: 0, reported: 0, rumor: 0, reference: 0, unused: 0, withQuote: 0, files: 0 },
  );

  const era = legacyRules ? ', правила до v10' : '';
  console.log(`\n${folder} — страниц в архиве: ${names.filter(isPage).length}${era}`);
  for (const [name, count] of Object.entries(counts)) {
    if (count.legacy) {
      console.log(`  ${name}: старый формат до v9, контракт не применяется`);
      continue;
    }
    console.log(
      `  ${name}: строк ${count.rows} ` +
        `(подтверждено ${count.confirmed}, сообщается ${count.reported}, слух ${count.rumor}), ` +
        `справка ${count.reference}, не использовать ${count.unused}, ` +
        `врезок ${count.withQuote}, файлов названо ${count.files}`,
    );
  }
  console.log(`  итого строк: ${total.rows}, врезок: ${total.withQuote}`);

  for (const problem of problems) {
    failed = true;
    console.error(`  ОШИБКА ${problem.code} — ${problem.file}:${problem.line} — ${problem.claim}`);
  }
}

if (failed) {
  console.error('\nТаблицы фактов не соответствуют контракту.');
  process.exit(1);
}
console.log('\nТаблицы фактов сходятся.');
