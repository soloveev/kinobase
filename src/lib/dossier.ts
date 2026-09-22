import { isReleased, type FilmStatus } from './status';

export type DossierBlock = 'before' | 'keys' | 'after';

export const DOSSIER_BLOCK_LABELS: Record<DossierBlock, string> = {
  before: 'Зачем смотреть',
  keys: 'Важные вещи о фильме',
  after: 'После просмотра',
};

/** Кусок рубрики. Абзац, пункт списка и справка несут разметку внутри строки,
 *  подзаголовок и цитата — нет: они и так набраны отдельно.
 *
 *  Справка (`note`) вводит неискушённого читателя в предмет — что это за место, кто
 *  этот режиссёр, — и потому набрана отдельным блоком, а не первым пунктом списка:
 *  её читают до того, как начинают разбираться. Заголовок темы живёт в данных, потому
 *  что у каждой темы свой; названия рубрик, наоборот, приходят из словаря.
 *
 *  Цитата — врезка голосом создателя фильма: режиссёра, актёра, оператора, монтажёра.
 *  Критику цитируют в тексте абзаца, называя издание словами. */
export type DossierNode =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'note'; text: string }
  | { type: 'quote'; text: string; author: string };

export type DossierFragment = { key: string; body: DossierNode[] };

export type DossierSource = { publication: string; title: string; url: string };

export type DossierSection = { key: string; label: string; block: DossierBlock };

/** Единый словарь рубрик — источник правды. Порядок показа задаёт он, а не данные;
 *  рубрику, которой здесь нет, записать нельзя. */
export const DOSSIER_SECTIONS: readonly DossierSection[] = [
  { key: 'why', label: 'Почему это может быть интересно', block: 'before' },
  { key: 'experience', label: 'Какого опыта ждать', block: 'before' },

  // Блок ключей состоит из одной рубрики, и её заголовок совпадает с заголовком
  // блока: на странице он поэтому не печатается.
  { key: 'keys', label: 'Важные вещи о фильме', block: 'keys' },

  { key: 'reading', label: 'Важные статьи', block: 'after' },
  { key: 'context', label: 'Контекст', block: 'after' },
  { key: 'themes', label: 'Смыслы и темы', block: 'after' },
  { key: 'form', label: 'Форма', block: 'after' },
  { key: 'characters', label: 'Персонажи', block: 'after' },
  { key: 'critique', label: 'Критика', block: 'after' },
  { key: 'reception', label: 'Как приняли', block: 'after' },
  { key: 'place', label: 'Место фильма', block: 'after' },
];

export const SECTION_BY_KEY: ReadonlyMap<string, DossierSection> = new Map(
  DOSSIER_SECTIONS.map((section) => [section.key, section]),
);

/** Рубрики, без которых блок неполон. У «После просмотра» таких нет: правило
 *  «не додумываем» сильнее полноты — что собрали, то и показываем. */
const REQUIRED_KEYS: Record<DossierBlock, string[]> = {
  before: ['why'],
  // Блок ключей недостачи не знает: пустой массив ловится как `empty`, чужая
  // рубрика на месте единственной — как `foreign`.
  keys: [],
  after: [],
};

export function sectionsOfBlock(block: DossierBlock): DossierSection[] {
  return DOSSIER_SECTIONS.filter((section) => section.block === block);
}

export type SortedFragment = { section: DossierSection; body: DossierNode[] };

/** Фрагменты в порядке словаря. Чужие и неизвестные ключи молча отбрасываются —
 *  как `sortTags`: показ не должен падать из-за данных, которые не прошли валидатор. */
export function sortFragments(
  block: DossierBlock,
  fragments: DossierFragment[],
): DossierFragment[] {
  const byKey = new Map(fragments.map((fragment) => [fragment.key, fragment]));
  return sectionsOfBlock(block)
    .map((section) => byKey.get(section.key))
    .filter((fragment): fragment is DossierFragment => fragment !== undefined);
}

/** То же, но сразу с рубрикой словаря — чтобы вёрстка не искала название сама. */
export function sortedSections(
  block: DossierBlock,
  fragments: DossierFragment[],
): SortedFragment[] {
  return sortFragments(block, fragments).map((fragment) => ({
    section: SECTION_BY_KEY.get(fragment.key)!,
    body: fragment.body,
  }));
}

// Разметка внутри строки

export type DossierSpan =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'link'; text: string; href: string };

/** Разметки ровно две: `**полужирный**` и `[текст](адрес)`. Грамматика узкая
 *  намеренно — это не markdown: всё, что не совпало с ней, остаётся простым текстом
 *  и не может испортить вёрстку. Испорченный случай ловит валидатор на границе. */
const INLINE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

export function parseInline(text: string): DossierSpan[] {
  const spans: DossierSpan[] = [];
  let last = 0;

  for (const match of text.matchAll(INLINE)) {
    if (match.index > last) spans.push({ kind: 'text', text: text.slice(last, match.index) });
    if (match[1] !== undefined) spans.push({ kind: 'bold', text: match[1] });
    else spans.push({ kind: 'link', text: match[2], href: match[3] });
    last = match.index + match[0].length;
  }

  if (last < text.length) spans.push({ kind: 'text', text: text.slice(last) });
  return spans;
}

/** Незакрытая пара звёздочек или ссылка не на `http` — не «почти правильно»,
 *  а сломанный текст: читатель увидит служебные символы. Ловим до записи в базу.
 *
 *  Вложенности у этой разметки нет: `**[текст](адрес)**` разбирается как один
 *  полужирный кусок, и адрес выводится читателю буквально, со скобками. Молча это
 *  не ловилось — остаток после вырезания совпадений был чист, — и на «Важных
 *  статьях» шесть пунктов из шести уехали в показ сломанными. */
function inlineError(text: string): 'markup' | 'link' | 'link-in-bold' | null {
  for (const match of text.matchAll(INLINE)) {
    if (match[1] !== undefined && /\]\(https?:\/\//.test(match[1])) return 'link-in-bold';
  }

  const rest = text.replace(INLINE, '');
  if (rest.includes('**')) return 'markup';
  if (/\[[^\]]*\]\(/.test(rest)) return 'link';
  return null;
}

export type DossierError =
  | 'empty'
  | 'unknown'
  | 'foreign'
  | 'duplicate'
  | 'no-body'
  | 'blank-text'
  | 'blank-item'
  | 'no-author'
  | 'quote-after-heading'
  | 'markup'
  | 'link'
  | 'link-in-bold'
  | 'keys-shape'
  | 'keys-count'
  | 'keys-length'
  | 'incomplete';

/** Проверка тела: пустых абзацев нет, врезка названа голосом, разметка внутри строки
 *  закрыта. Вынесена отдельно, потому что тем же телом набраны тезисы метода
 *  и разборы работ на странице персоналии, — второй копии этих правил в проекте быть
 *  не должно, она разъедется с первой. */
export function validateNodes(nodes: DossierNode[]): DossierError | null {
  if (nodes.length === 0) return 'no-body';

  let previous: DossierNode['type'] | null = null;

  for (const node of nodes) {
    // Врезка подтверждает уже сказанное, а не открывает разговор. Поставленная сразу
    // под заголовком темы, она читается эпиграфом и заставляет разбираться в цитате
    // раньше, чем читатель узнал, о чём речь.
    if (node.type === 'quote' && previous === 'h') return 'quote-after-heading';
    previous = node.type;

    if (node.type === 'ul') {
      if (node.items.length === 0) return 'blank-item';
      for (const item of node.items) {
        if (item.trim() === '') return 'blank-item';
        const error = inlineError(item);
        if (error) return error;
      }
      continue;
    }

    if (node.text.trim() === '') return 'blank-text';
    // Цитата без автора — не цитата: врезка без голоса читается как лозунг.
    if (node.type === 'quote' && node.author.trim() === '') return 'no-author';
    if (node.type === 'p' || node.type === 'note') {
      const error = inlineError(node.text);
      if (error) return error;
    }
  }

  return null;
}

/** Ровно семь вещей — правило письма, а не вилка: research/DOSSIER-FORMAT.md, редакция
 *  15.09.2026. ~~Пять—семь~~: вилка была шире правила нарочно, потому что девятнадцать
 *  досье прежней формы жили в базе рядом с новыми и прогон покраснел бы на них. Повод
 *  исчез — все записи с блоком ключей несут ровно семь пунктов, — и 15.09.2026 числа
 *  сведены. Поблажка, охраняющая несуществующий случай, — это ровно «правило записано,
 *  а ни одна проверка его не сторожит». */
const KEYS_MIN = 7;
const KEYS_MAX = 7;

/** Потолок объёма блока в видимых знаках. Правило письма — «до 6000 знаков», допуск —
 *  6059; валидатор стоит на допуске: норма дело пишущего, потолок дело кода. То же
 *  число, что у `scripts/keys-check.py`. */
const KEYS_CHARS_MAX = 6059;

/** Объём блока так, как его видит читатель: сумма знаков всех пунктов списка с пробелами,
 *  без разметки полужирного. Звёздочки читателю не видны и съедать у него по четыре
 *  знака с пункта не должны. Вводка и врезка в счёт не идут — счёт ведётся по пунктам. */
function keysVisibleLength(items: string[]): number {
  return items.reduce((sum, item) => sum + item.replaceAll('**', '').length, 0);
}

/** Блок ключей устроен жёстче прочих: один список ровно из семи пунктов и ни одного
 *  подзаголовка — делить в блоке нечего. Вводка перед списком и врезка после него
 *  разрешены, как везде в проекте: на переносе строгая форма отвергла два досье
 *  из тридцати четырёх, и оба законно — оговорка о неполном сезоне и голос
 *  создателя.
 *
 *  Сначала число пунктов, потом объём: «пунктов не семь» — про устройство блока,
 *  и отвечать на него счётом знаков значит называть не ту причину. */
function validateKeysBody(nodes: DossierNode[]): DossierError | null {
  if (nodes.some((node) => node.type === 'h')) return 'keys-shape';

  const lists = nodes.filter((node) => node.type === 'ul');
  if (lists.length !== 1) return 'keys-shape';

  const [list] = lists;
  if (list.items.length < KEYS_MIN || list.items.length > KEYS_MAX) return 'keys-count';
  if (keysVisibleLength(list.items) > KEYS_CHARS_MAX) return 'keys-length';
  return null;
}

/** Граница системы: материалы приходят из JSON, который пишет агент. `null` — набор
 *  корректен, иначе код ошибки. */
export function validateDossierBlock(
  block: DossierBlock,
  fragments: DossierFragment[],
): DossierError | null {
  if (fragments.length === 0) return 'empty';

  const seen = new Set<string>();
  for (const fragment of fragments) {
    const section = SECTION_BY_KEY.get(fragment.key);
    if (!section) return 'unknown';
    if (section.block !== block) return 'foreign';
    if (seen.has(fragment.key)) return 'duplicate';
    seen.add(fragment.key);

    const error = validateNodes(fragment.body);
    if (error) return error;

    if (block === 'keys') {
      const shapeError = validateKeysBody(fragment.body);
      if (shapeError) return shapeError;
    }
  }

  if (REQUIRED_KEYS[block].some((key) => !seen.has(key))) return 'incomplete';

  return null;
}

export type DossierSourcesError = 'empty' | 'publication' | 'title' | 'url';

export function validateSources(sources: DossierSource[]): DossierSourcesError | null {
  if (sources.length === 0) return 'empty';

  for (const source of sources) {
    if (source.publication.trim() === '') return 'publication';
    if (source.title.trim() === '') return 'title';
    if (!/^https?:\/\//.test(source.url)) return 'url';
  }

  return null;
}

export type DossierFreshness = 'none' | 'fresh' | 'stale';

/** Материалы устарели, если фильм уже вышел, а агент ходил за ними раньше выхода:
 *  разбора тогда не существовало и собрать его было неоткуда. */
export function dossierFreshness(
  film: { releaseDate: string | null; dossierSearchedAt: string | null },
  today: string,
): DossierFreshness {
  if (film.dossierSearchedAt === null) return 'none';
  if (film.releaseDate === null) return 'fresh';
  if (!isReleased(film.releaseDate, today)) return 'fresh';
  return film.dossierSearchedAt < film.releaseDate ? 'stale' : 'fresh';
}

/** Раскрыто то, что отвечает на вопрос момента. Вернувшемуся из зала нужны и ключи,
 *  и разбор; тому, кто ещё выбирает, — подготовка, а ключи спойлерят. */
export function defaultOpenBlocks(status: FilmStatus): DossierBlock[] {
  return status === 'watched' ? ['keys', 'after'] : ['before'];
}

export function hasDossier(film: {
  dossierBefore: DossierFragment[] | null;
  dossierKeys: DossierFragment[] | null;
  dossierAfter: DossierFragment[] | null;
  dossierSources: DossierSource[] | null;
}): boolean {
  return (
    film.dossierBefore !== null ||
    film.dossierKeys !== null ||
    film.dossierAfter !== null ||
    film.dossierSources !== null
  );
}
