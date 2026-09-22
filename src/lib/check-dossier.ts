/** Механические проверки досье и справочных полей карточки: рифмы, кириллица,
 *  правовая рамка, врезка под заголовком, русские написания чужих названий.
 *
 *  Всё это до десятой версии сверял глазами проверочный проход — работу он делал хуже
 *  и дороже кода. Проходу остаётся сверка перевода: её детерминированной не сделать.
 *
 *  Чтения с диска здесь нет намеренно: разобранный JSON приходит массивами, тексты
 *  архивов — картой «оригинальное название → текст `facts.md`». Та же граница, что
 *  у `checkData` с предикатом `exists` и у `checkFacts` с картой файлов.
 *
 *  Чекер отвечает за весь корпус, поэтому возвращает перечень нарушений, а не первый
 *  код: владельцу нужен полный список. `null` — корпус в порядке.
 *
 *  Общее правило разбора: **ложная тревога дороже пропуска**, потому что скрипту верят
 *  на слово. Где формулировка спеки допускает два чтения, берётся то, которое молчит
 *  на законном тексте. */

export type DossierProblemCode =
  | 'rhyme-no-director'
  | 'latin-in-fields'
  | 'legal-star-no-footnote'
  | 'legal-star-in-bold'
  | 'quote-after-heading'
  | 'title-not-in-spellings'
  | 'reading-not-first'
  | 'reading-count'
  | 'context-no-note'
  | 'form-no-categories'
  | 'critique-too-long'
  | 'concepts-too-many'
  | 'prose-in-list'
  | 'note-misplaced';

export type DossierProblem = {
  title: string;
  code: DossierProblemCode;
  /** Имя поля карточки, адрес рубрики `<блок>/<ключ>` либо имя блока. */
  where: string;
  detail?: string;
};

/** Замер захода считает код, а не агент (CLAUDE.md, «Данные»). */
export type DossierCount = {
  records: number;
  rhymes: number;
  quotes: number;
  legalBlocks: number;
};

export type DossierInput = {
  dossiers: unknown[];
  films: unknown[];
  facts: Record<string, string>;
};

/** Слаг папки архива переехал в `src/lib/archive-slug.ts` (15.09.2026): к проверкам
 *  формы досье он отношения не имеет и жил здесь исторически. Реэкспорт оставлен,
 *  чтобы скрипты проверки не переписывались одновременно с переездом. */
export { slugArchive, matchesArchiveFolder } from './archive-slug';

/** Справочные поля карточки, где имя записано по-русски. Название, аннотация и теги
 *  латиницу несут законно: там она либо оригинал, либо служебный ключ. */
const PERSON_FIELDS = ['director', 'producer', 'screenwriter', 'soundDesigner', 'composer'];

/** Сноска правовой рамки — абзац, начинающийся с одиночной звёздочки и пробела
 *  (research/LEGAL.md, «Пометки, которых требует местное право»). Содержание пометки
 *  задаёт юрисдикция владельца, форма — одна на все. */
function isLegalFootnote(line: string | null): boolean {
  return line !== null && /^\* \S/.test(line);
}

const BOLD = /\*\*([^*]+)\*\*/g;
const LATIN = /[A-Za-z]/;
const CYRILLIC = /[А-Яа-яЁё]/;
const YEAR = /(?:1[89]\d{2}|20\d{2})/;

const BLOCKS = ['before', 'keys', 'after'] as const;

// Данные приходят из JSON, который пишет агент: на этой границе типам не верим,
// поэтому поля читаются узкими геттерами, а не приведением записи целиком.

type Row = Record<string, unknown>;

function asRow(value: unknown): Row | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Row)
    : null;
}

function text(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' ? value : null;
}

function list(row: Row, key: string): Row[] {
  const value = row[key];
  return Array.isArray(value) ? value.map(asRow).filter((item): item is Row => item !== null) : [];
}

function strings(row: Row, key: string): string[] {
  const value = row[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/** Строки, несущие разметку внутри себя. Подзаголовок и врезка её не несут
 *  (`src/lib/dossier.ts`), поэтому полужирного названия и звёздочки там не ищем. */
function markedLines(node: Row): string[] {
  const type = text(node, 'type');
  if (type === 'ul') return strings(node, 'items');
  if (type !== 'p') return [];
  const line = text(node, 'text');
  return line === null ? [] : [line];
}

/** Скобка сразу за названием: имя и год. Один год без имени и одно имя без года
 *  формату не отвечают — по ним читатель картину не опознает. */
function hasCredit(tail: string): boolean {
  const paren = /^\s*\(([^)]*)\)/.exec(tail);
  if (paren === null) return false;
  const inside = paren[1];
  if (!YEAR.test(inside)) return false;
  return /\p{L}/u.test(inside.replace(new RegExp(YEAR, 'g'), ''));
}

type Named = { title: string; credited: boolean };

/** Картины, названные в строке полужирным. Именно так формат велит именовать рифму
 *  и вообще чужой фильм (research/DOSSIER-FORMAT.md). Название, помянутое прозой,
 *  стоит в косвенном падеже, и требовать от него скобки или строки написания значит
 *  завалить проверку ложными тревогами. */
function namedTitles(line: string): Named[] {
  const found: Named[] = [];
  for (const match of line.matchAll(BOLD)) {
    const quoted = /«([^»]+)»/.exec(match[1]);
    if (quoted === null) continue;
    found.push({
      title: quoted[1],
      credited: hasCredit(line.slice(match.index + match[0].length)),
    });
  }
  return found;
}

/** Звёздочка правовой рамки — одиночная, а не пара разметки. Сама сноска звёздочкой
 *  не считается: иначе блок, где стоит только она, читался бы как нарушение. */
function hasLegalStar(line: string): boolean {
  if (isLegalFootnote(line)) return false;
  return line.replace(BOLD, '').includes('*');
}

/** Звёздочка сноски, попавшая внутрь полужирного, ломает разметку молча: пара `**` там
 *  разорвана, `BOLD` на такой строке не срабатывает, и `hasLegalStar` возвращает `true` —
 *  то есть проверка проходит именно потому, что разметка сломана, а читателю уезжает
 *  сырой markdown. Поэтому пары считаются вручную, а не регуляркой. */
function starInsideBold(line: string): boolean {
  let bold = false;
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] !== '*') continue;
    if (line[i + 1] === '*') {
      bold = !bold;
      i += 1;
      continue;
    }
    if (bold) return true;
  }
  return false;
}

function checkFilm(film: Row, add: (problem: DossierProblem) => void): void {
  const title = text(film, 'titleRu') ?? text(film, 'titleOriginal') ?? '';

  for (const field of PERSON_FIELDS) {
    const value = text(film, field);
    if (value !== null && LATIN.test(value)) {
      add({ title, code: 'latin-in-fields', where: field, detail: value });
    }
  }

  const latinCast = strings(film, 'cast').filter((name) => LATIN.test(name));
  if (latinCast.length > 0) {
    add({ title, code: 'latin-in-fields', where: 'cast', detail: latinCast.join(', ') });
  }
}

/** Заведено ли русское написание названия в архиве захода. Раздел написаний опознаётся
 *  по строке таблицы, а не по заголовку: ключ рубрики `написание` введён десятой
 *  версией, и в архивах, собранных раньше, написания стоят под `справка`. Строка есть
 *  — значит написание разобрано заходом, а не придумано на письме. */
function spellingRows(facts: string): string[] {
  return facts
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && !/^\|[\s:|-]+\|$/.test(line));
}

/** Форма блока «После просмотра», введённая заходом 26 августа 2026 года.
 *
 *  Все проверки ниже включаются только у досье нового формата, и признак один:
 *  в блоке есть рубрика `reading`. Девятнадцать досье, собранных раньше, по новым
 *  правилам не переписаны, и красный прогон на них был бы хуже отсутствующей
 *  проверки — её перестают читать. Задним числом правило не применяется, как
 *  и запрет справочных строк в зональной таблице. */
const READING_ITEMS = 3;
const CRITIQUE_ITEMS = 8;
const CONCEPT_ITEMS = 5;

function itemCount(node: Row): number {
  return text(node, 'type') === 'ul' ? strings(node, 'items').length : 0;
}

function checkAfterShape(
  fragments: Row[],
  title: string,
  add: (problem: DossierProblem) => void,
): void {
  const keys = fragments.map((fragment) => text(fragment, 'key') ?? '');
  if (!keys.includes('reading')) return;

  if (keys[0] !== 'reading') {
    add({ title, code: 'reading-not-first', where: 'after', detail: `первой стоит «${keys[0]}»` });
  }

  for (const fragment of fragments) {
    const key = text(fragment, 'key') ?? '';
    const where = `after/${key}`;
    const body = list(fragment, 'body');

    // Абзац законен вводкой: в начале рубрики и сразу под подзаголовком. Дальше
    // по рубрике идёт список, и абзац там — проза на месте пункта.
    let previous: string | null = null;
    let headings = 0;
    let underConcepts = false;
    let items = 0;
    let concepts = 0;

    for (const node of body) {
      const type = text(node, 'type') ?? '';

      // Сноска правовой рамки — единственный абзац, законный после списка: она не часть
      // разбора, а служебная строка, и пунктом списка не бывает (research/LEGAL.md).
      const footnote = type === 'p' && isLegalFootnote(text(node, 'text'));

      if (type === 'p' && !footnote && previous !== null && previous !== 'h') {
        add({ title, code: 'prose-in-list', where, detail: text(node, 'text')?.slice(0, 60) });
      }
      if (type === 'note' && (key !== 'context' || previous !== null)) {
        add({ title, code: 'note-misplaced', where });
      }
      if (type === 'h') {
        headings += 1;
        underConcepts = (text(node, 'text') ?? '').includes('Концепц');
      }

      const count = itemCount(node);
      items += count;
      if (underConcepts) concepts += count;

      previous = type;
    }

    if (key === 'reading' && items !== READING_ITEMS) {
      add({ title, code: 'reading-count', where, detail: `${items} вместо ${READING_ITEMS}` });
    }
    if (key === 'context' && text(body[0] ?? {}, 'type') !== 'note') {
      add({ title, code: 'context-no-note', where });
    }
    if (key === 'form' && headings < 2) {
      add({ title, code: 'form-no-categories', where, detail: `подзаголовков ${headings}` });
    }
    if (key === 'critique' && items > CRITIQUE_ITEMS) {
      add({ title, code: 'critique-too-long', where, detail: `пунктов ${items}` });
    }
    if (concepts > CONCEPT_ITEMS) {
      add({ title, code: 'concepts-too-many', where, detail: `концепций ${concepts}` });
    }
  }
}

function checkDossierRecord(
  record: Row,
  facts: string | undefined,
  count: DossierCount,
  add: (problem: DossierProblem) => void,
): void {
  const title = text(record, 'titleRu') ?? text(record, 'titleOriginal') ?? '';
  const rows = facts === undefined ? null : spellingRows(facts);
  const reportedRhymes = new Set<string>();
  const reportedSpellings = new Set<string>();

  for (const block of BLOCKS) {
    let starred = false;
    let footnote = false;

    for (const fragment of list(record, block)) {
      const key = text(fragment, 'key') ?? '';
      const where = `${block}/${key}`;
      const body = list(fragment, 'body');

      // Рифмы живут списком под своим подзаголовком; проза рубрики называет картины
      // свободно, и скобка там не обязательна.
      let underRhymes = false;
      let previous: string | null = null;

      for (const node of body) {
        const type = text(node, 'type');

        if (type === 'quote') {
          count.quotes += 1;
          if (previous === 'h') add({ title, code: 'quote-after-heading', where });
        }
        if (type === 'h' && key === 'place') {
          underRhymes = (text(node, 'text') ?? '').includes('Рифм');
        }
        previous = type;

        for (const line of markedLines(node)) {
          if (!starred && hasLegalStar(line)) starred = true;
          if (type === 'p' && isLegalFootnote(line)) footnote = true;
          if (starInsideBold(line)) {
            add({ title, code: 'legal-star-in-bold', where, detail: line.slice(0, 60) });
          }

          for (const named of namedTitles(line)) {
            if (underRhymes && type === 'ul') count.rhymes += 1;

            if (underRhymes && type === 'ul' && !named.credited) {
              if (!reportedRhymes.has(named.title)) {
                reportedRhymes.add(named.title);
                add({
                  title,
                  code: 'rhyme-no-director',
                  where,
                  detail: `«${named.title}» — без режиссёра и года`,
                });
              }
            }

            if (
              rows !== null &&
              named.credited &&
              CYRILLIC.test(named.title) &&
              named.title !== title &&
              !reportedSpellings.has(named.title) &&
              !rows.some((row) => row.includes(named.title))
            ) {
              reportedSpellings.add(named.title);
              add({
                title,
                code: 'title-not-in-spellings',
                where,
                detail: `«${named.title}» нет в написаниях архива`,
              });
            }
          }
        }
      }
    }

    if (block === 'after') checkAfterShape(list(record, block), title, add);

    // Блоки раскрываются по одному, поэтому сноска нужна в каждом блоке, где стоит
    // звёздочка (research/LEGAL.md). Внутри блока сноска одна на все рубрики.
    if (starred) {
      count.legalBlocks += 1;
      if (!footnote) add({ title, code: 'legal-star-no-footnote', where: block });
    }
  }
}

function scan(input: DossierInput): { problems: DossierProblem[]; count: DossierCount } {
  const problems: DossierProblem[] = [];
  const count: DossierCount = { records: 0, rhymes: 0, quotes: 0, legalBlocks: 0 };
  const add = (problem: DossierProblem): void => {
    problems.push(problem);
  };

  for (const raw of input.films) {
    const film = asRow(raw);
    if (film !== null) checkFilm(film, add);
  }

  for (const raw of input.dossiers) {
    const record = asRow(raw);
    if (record === null) continue;
    count.records += 1;
    const key = text(record, 'titleOriginal') ?? '';
    checkDossierRecord(record, key === '' ? undefined : input.facts[key], count, add);
  }

  return { problems, count };
}

/** Граница системы: файлы наполнения пишет агент, и любое поле может прийти в любом
 *  виде. `null` — нарушений нет. */
export function checkDossier(input: DossierInput): DossierProblem[] | null {
  const { problems } = scan(input);
  return problems.length === 0 ? null : problems;
}

/** Тот же разбор, но ради счёта: сколько записей, рифм, цитат и блоков со звёздочкой
 *  правовой рамки в корпусе. Печатает его `scripts/check-dossier.ts`, когда нарушений нет. */
export function countDossier(input: DossierInput): DossierCount {
  return scan(input).count;
}
