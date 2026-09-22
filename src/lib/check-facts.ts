import { DOSSIER_SECTIONS } from './dossier';

/** Разбор таблиц фактов из архива захода. Таблицу читает и агент, который по ней пишет,
 *  и этот код: формат из `research/VERIFICATION.md` — контракт, а не оформление.
 *
 *  Чтения с диска здесь нет намеренно. Содержимое приходит картой «имя файла → текст»,
 *  список файлов-страниц архива — множеством имён: та же граница, что у `checkData`
 *  с предикатом `exists`. */

export type FactsErrorCode =
  | 'bad-status'
  | 'pseudo-heading'
  | 'no-sources'
  | 'weak-confirmed'
  | 'missing-file'
  | 'bad-spoiler'
  | 'spoiler-no-reason'
  | 'unknown-rubric'
  | 'quote-no-file'
  | 'bad-columns'
  | 'reference-in-zone';

export type FactsProblem = {
  file: string;
  line: number;
  code: FactsErrorCode;
  claim: string;
};

export type FactsCount = {
  rows: number;
  confirmed: number;
  reported: number;
  rumor: number;
  reference: number;
  unused: number;
  withQuote: number;
  files: number;
  /** Таблица собрана по правилам до девятой версии: контракт к ней не применяется. */
  legacy?: boolean;
};

/** Архив, собранный по правилам до десятой версии: `reference-in-zone` для него молчит.
 *  Какие папки объявить старыми, решает `scripts/check-facts.ts` — чтения с диска здесь нет. */
export type FactsOptions = { legacyRules?: boolean };

const STATUSES = ['подтверждено', 'сообщается', 'слух'] as const;
type Status = (typeof STATUSES)[number];

/** Служебные значения колонки «Рубрики». `справка` уводит строку в карточку тайтла,
 *  `не использовать` помнит, что вопрос разобран; `написание` держит русское написание
 *  имени или названия; `метод` и `работа: …` — персоналия. */
const SERVICE_RUBRICS = ['справка', 'не использовать', 'метод', 'написание'];

const RUBRIC_KEYS = new Set<string>(DOSSIER_SECTIONS.map((section) => section.key));

/** Рубрики, которых в словаре больше нет, но которые законны в архиве. `theses`
 *  переехала в блок ключей пятнадцатой версией, а девяносто пять таблиц фактов
 *  прежних заходов ссылаются на неё поимённо: переписывать архив ради зелёного
 *  вывода нельзя — он и есть свидетельство того, как работа шла. Правило то же,
 *  что у `reference-in-zone`: новое требование не предъявляется задним числом. */
const LEGACY_RUBRICS = ['theses'];

/** Оговорки, объясняющие, почему одного источника довольно. */
const SINGLE_SOURCE_REASONS = ['первичный', 'написание', 'рифма', 'промо', 'догадка источника'];

const CLAIM_LIMIT = 70;

function isSeparator(line: string): boolean {
  return /^\|[\s:|-]+\|\s*$/.test(line);
}

/** Ячейки строки таблицы. Символа `|` внутри ячейки формат не допускает, поэтому
 *  простого разбиения достаточно и разбор остаётся предсказуемым. */
function cellsOf(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
}

/** Имена файлов архива, названные в ячейке: только в обратных кавычках. Издание,
 *  написанное словами, источником не считается — адрес живёт в шапке файла. */
function filesOf(cell: string): string[] {
  return [...cell.matchAll(/`([^`]+\.md)`/g)].map((match) => match[1]);
}

/** Файл из соседнего архива на существование не проверяется: сюда приходят имена
 *  файлов одной папки захода, и о содержимом соседней папке знать неоткуда. */
function isForeign(file: string): boolean {
  return file.startsWith('../');
}

/** Зональная таблица захода: `facts-production.md`, `facts-audience.md` и прочие.
 *  Сводная `facts.md` зоной не считается — в ней `справка` законна. */
function isZoneTable(file: string): boolean {
  return /^facts-[a-z0-9-]+\.md$/.test(file);
}

function rubricKeys(cell: string): string[] {
  return cell
    .split(',')
    .map((part) => part.trim().replace(/`/g, ''))
    .filter((part) => part !== '' && part !== '—');
}

function isKnownRubric(raw: string): boolean {
  if (SERVICE_RUBRICS.includes(raw)) return true;
  if (LEGACY_RUBRICS.includes(raw)) return true;
  if (raw.startsWith('работа:')) return true;
  // Подзаголовок через косую черту уточняет место внутри рубрики: ключ — то, что слева.
  const key = raw.split('/')[0].trim();
  return RUBRIC_KEYS.has(key);
}

/** Строка-раздел: набранный жирным заголовок, у которого остальные ячейки пусты.
 *  Разделы набираются заголовками `##`; тринадцать таких «фактов» в зоне производства
 *  на «Бугонии» и есть причина правила. Жирное начало самого утверждения при
 *  заполненных соседних ячейках — обычный факт, а не заголовок. */
function isPseudoHeading(cells: string[]): boolean {
  const [first, ...rest] = cells;
  if (!/^\*\*.+\*\*$/.test(first)) return false;
  return rest.every((cell) => cell === '');
}

function emptyCount(): FactsCount {
  return {
    rows: 0,
    confirmed: 0,
    reported: 0,
    rumor: 0,
    reference: 0,
    unused: 0,
    withQuote: 0,
    files: 0,
  };
}

function checkFile(
  file: string,
  text: string,
  archiveFiles: Set<string>,
  options: FactsOptions,
  collect: FactsProblem[],
): FactsCount {
  const problems: FactsProblem[] = [];
  const count = emptyCount();
  const archiveNames = new Set<string>();
  const lines = text.split('\n');

  // Контракт семи колонок введён девятой версией и задним числом не применяется:
  // таблица со старой пятиколоночной шапкой пропускается целиком, иначе скрипт
  // засыпал бы ошибками архивы, собранные по прежним правилам, и перестал быть воротами.
  let legacy = false;

  lines.forEach((line, index) => {
    if (legacy) return;
    if (!line.trimStart().startsWith('|')) return;
    if (isSeparator(line)) return;

    const cells = cellsOf(line);
    if (cells[0] === 'Утверждение') {
      if (cells.length !== 7) legacy = true;
      return;
    }

    const number = index + 1;
    const claim = cells[0].slice(0, CLAIM_LIMIT);
    const report = (code: FactsErrorCode) => problems.push({ file, line: number, code, claim });

    if (isPseudoHeading(cells)) {
      report('pseudo-heading');
      return;
    }

    // Ячейки не разобрать — дальнейшие проверки говорили бы не о том поле.
    if (cells.length !== 7) {
      report('bad-columns');
      return;
    }

    const [, status, caveat, sources, spoiler, rubrics, quote] = cells;
    count.rows += 1;

    if ((STATUSES as readonly string[]).includes(status)) {
      const kind = status as Status;
      if (kind === 'подтверждено') count.confirmed += 1;
      if (kind === 'сообщается') count.reported += 1;
      if (kind === 'слух') count.rumor += 1;
    } else {
      report('bad-status');
    }

    const sourceFiles = filesOf(sources);
    if (sourceFiles.length === 0) report('no-sources');

    // «Подтверждено» держится на двух независимых источниках либо на одном — и тогда
    // оговорка обязана объяснить, почему одного довольно. Написание имени и рифма стоят
    // на одном источнике по природе, а не по недосмотру: правка внесена после первого
    // прогона по новым правилам (правило «задним числом ничего не применяется»).
    if (status === 'подтверждено' && sourceFiles.length === 1 && !SINGLE_SOURCE_REASONS.some((reason) => caveat.includes(reason))) {
      report('weak-confirmed');
    }

    for (const name of sourceFiles) {
      archiveNames.add(name);
      if (!isForeign(name) && !archiveFiles.has(name)) report('missing-file');
    }

    if (spoiler === 'нет') {
      // законно
    } else if (spoiler.startsWith('да')) {
      // Приписка обязательна: без неё следующий агент видит только «да» и переформулировать
      // безопасную версию уже не может.
      if (!/\(.+\)/.test(spoiler)) report('spoiler-no-reason');
    } else {
      report('bad-spoiler');
    }

    const keys = rubricKeys(rubrics);
    if (keys.some((key) => !isKnownRubric(key))) report('unknown-rubric');
    if (keys.includes('справка')) {
      count.reference += 1;
      // Справка живёт в сводной таблице: зона собирает материал для разбора, а не для
      // карточки тайтла. Правило введено десятой версией, и архивам, собранным раньше,
      // не предъявляется — их бы пришлось переписывать ради зелёного вывода.
      if (isZoneTable(file) && !options.legacyRules) report('reference-in-zone');
    }
    if (keys.includes('не использовать')) count.unused += 1;

    if (quote !== '' && quote !== '—') {
      count.withQuote += 1;
      const quoteFiles = filesOf(quote);
      const named = quoteFiles.filter((name) => isForeign(name) || archiveFiles.has(name));
      if (named.length === 0) report('quote-no-file');
      for (const name of quoteFiles) archiveNames.add(name);
    }
  });

  if (legacy) return { ...emptyCount(), legacy: true };

  collect.push(...problems);
  count.files = archiveNames.size;
  return count;
}

/** Граница системы: таблицы пишет агент, и любое поле может прийти в любом виде.
 *  Пустой список проблем — контракт соблюдён. */
export function checkFacts(
  files: Record<string, string>,
  archiveFiles: Set<string>,
  options: FactsOptions = {},
): { problems: FactsProblem[]; counts: Record<string, FactsCount> } {
  const problems: FactsProblem[] = [];
  const counts: Record<string, FactsCount> = {};

  for (const [file, text] of Object.entries(files)) {
    counts[file] = checkFile(file, text, archiveFiles, options, problems);
  }

  return { problems, counts };
}
