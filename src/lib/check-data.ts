import { validateTags } from './tags';
import { validateSeasons } from './seasons';
import {
  parseInline,
  validateDossierBlock,
  validateSources,
  type DossierFragment,
  type DossierNode,
  type DossierSource,
} from './dossier';
import { validatePerson, type Method, type PersonInput, type WorkNote } from './people';

/** Перекрёстная проверка файлов наполнения.
 *
 *  Скрипты наполнения валидируют каждый файл по отдельности и только ту его часть,
 *  которую сами пишут. Между файлами ключ никто не сводит: тег, дописанный в один
 *  файл и забытый в другом, молча откатывается следующим прогоном, а связь
 *  персоналии с фильмом рвётся об одну букву в имени. Эти дефекты живут между
 *  файлами, поэтому и проверка живёт отдельно от них.
 *
 *  Чекер отвечает за весь корпус, а не за одну запись, поэтому возвращает список
 *  проблем, а не код ошибки по конвенции проекта: владельцу нужен полный перечень,
 *  а не первая попавшаяся. Пустой список — порядок. */

export type DataProblemCode =
  | 'unreadable'
  | 'no-title-ru'
  | 'no-title-original'
  | 'duplicate-title-original'
  | 'orphan-title'
  | 'tags-mismatch'
  | 'missing-tags-record'
  | 'seasons-mismatch'
  | 'missing-seasons-record'
  | 'seasons-on-non-series'
  | 'bad-searched-at'
  | 'no-created-at'
  | 'bad-created-at'
  | 'link-not-in-sources'
  | 'duplicate-slug'
  | 'name-not-in-field'
  | 'unknown-work-title'
  | 'poster-missing'
  | 'photo-missing'
  | 'invalid-tags'
  | 'invalid-seasons'
  | 'invalid-dossier'
  | 'invalid-sources'
  | 'invalid-person';

export type DataProblem = {
  file: string;
  record: string;
  code: DataProblemCode;
  detail?: string;
};

export type DataFiles = {
  films: unknown[];
  tags: unknown[];
  seasons: unknown[];
  dossiers: unknown[];
  people: unknown[];
};

const FILMS = 'films-data.json';
const TAGS = 'tags-data.json';
const SEASONS = 'seasons-data.json';
const DOSSIERS = 'dossier-data.json';
const PEOPLE = 'people-data.json';

const SEARCHED_AT = /^\d{4}-\d{2}-\d{2}$/;

/** Дата заведения тайтла в базу. Точность всегда до дня: это не факт из источника,
 *  который бывает известен только годом, а отметка о собственном действии.
 *
 *  Валидатор вынесен и экспортирован, потому что то же правило проверяют скрипты
 *  наполнения: дата приходит только из файла данных, и запись без неё не должна
 *  доехать до базы — ни локальной, ни боевой. */
const CREATED_AT = /^\d{4}-\d{2}-\d{2}$/;

export function validateCreatedAt(value: unknown): 'no-created-at' | 'bad-created-at' | null {
  if (typeof value !== 'string' || value.trim() === '') return 'no-created-at';
  return CREATED_AT.test(value) ? null : 'bad-created-at';
}

/** Роли, у которых в карточке фильма есть своя строка. Оператор, монтажёр,
 *  художник, аниматор и автор оригинала в карточке отдельно не записаны —
 *  сверять имя не по чему, и это не пробел. Тот же словарь ведёт `fill-people.ts`. */
const FIELD_OF_ROLE: Readonly<Record<string, string>> = {
  director: 'director',
  producer: 'producer',
  screenwriter: 'screenwriter',
  composer: 'composer',
  sound: 'soundDesigner',
  actor: 'cast',
};

// Данные приходят из JSON, который пишет агент: на этой границе типам верить нельзя,
// поэтому поля читаются через узкие геттеры, а не приведением записи целиком.

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

function list(row: Row, key: string): unknown[] {
  const value = row[key];
  return Array.isArray(value) ? value : [];
}

function strings(row: Row, key: string): string[] {
  return list(row, key).filter((item): item is string => typeof item === 'string');
}

/** Ключ записи — оригинальное название: одноимённые русские названия в базе норма. */
function keyOf(row: Row): string {
  return text(row, 'titleOriginal') ?? '';
}

function sameSet(left: string[], right: string[]): boolean {
  const a = new Set(left);
  const b = new Set(right);
  return a.size === b.size && [...a].every((item) => b.has(item));
}

function difference(left: string[], right: string[]): string[] {
  const a = new Set(left);
  const b = new Set(right);
  return [...new Set([...left.filter((x) => !b.has(x)), ...right.filter((x) => !a.has(x))])];
}

/** Адреса, которые читатель увидит ссылкой. Врезка и подзаголовок разметку не несут:
 *  там `[текст](адрес)` выводится как есть, и ссылкой не становится. */
function linksOfNodes(nodes: DossierNode[]): string[] {
  const urls: string[] = [];
  for (const node of nodes) {
    const texts = node.type === 'ul' ? node.items : node.type === 'p' ? [node.text] : [];
    for (const line of texts) {
      for (const span of parseInline(line)) {
        if (span.kind === 'link') urls.push(span.href);
      }
    }
  }
  return urls;
}

function linksOfFragments(fragments: unknown[]): string[] {
  const urls: string[] = [];
  for (const raw of fragments) {
    const fragment = asRow(raw);
    if (!fragment) continue;
    const body = list(fragment, 'body');
    urls.push(...linksOfNodes(body as DossierNode[]));
  }
  return urls;
}

function urlsOfSources(row: Row): Set<string> {
  const urls = new Set<string>();
  for (const raw of list(row, 'sources')) {
    const source = asRow(raw);
    const url = source ? text(source, 'url') : null;
    if (url !== null) urls.add(url);
  }
  return urls;
}

/** Рабочий и полноразмерный файлы постера по одному полю данных: имя у них общее,
 *  отдельного поля в базе нет — так же устроен и показ. */
function posterFiles(posterPath: string): string[] {
  const name = posterPath.split('/').pop() ?? '';
  return [`public${posterPath}`, `public/posters/original/${name}`];
}

export function checkData(files: DataFiles, exists: (path: string) => boolean): DataProblem[] {
  const problems: DataProblem[] = [];
  const add = (file: string, record: string, code: DataProblemCode, detail?: string): void => {
    problems.push(detail === undefined ? { file, record, code } : { file, record, code, detail });
  };

  // Файл, который не массив, дальше не разбирается: судить о его записях нечем.
  const readable = (value: unknown[], file: string): unknown[] => {
    if (Array.isArray(value)) return value;
    add(file, file, 'unreadable', 'ожидался массив записей');
    return [];
  };

  const filmRows = readable(files.films, FILMS).map(asRow).filter((row): row is Row => row !== null);
  const tagRows = readable(files.tags, TAGS).map(asRow).filter((row): row is Row => row !== null);
  const seasonRows = readable(files.seasons, SEASONS).map(asRow).filter((row): row is Row => row !== null);
  const dossierRows = readable(files.dossiers, DOSSIERS).map(asRow).filter((row): row is Row => row !== null);
  const peopleRows = readable(files.people, PEOPLE).map(asRow).filter((row): row is Row => row !== null);

  const filmByKey = new Map<string, Row>();
  const seenKeys = new Set<string>();
  const reportedDuplicates = new Set<string>();

  for (const film of filmRows) {
    const key = keyOf(film);
    const titleRu = text(film, 'titleRu') ?? '';
    const record = key !== '' ? key : titleRu;

    if (titleRu.trim() === '') add(FILMS, record, 'no-title-ru');
    if (key.trim() === '') {
      add(FILMS, record, 'no-title-original', 'по нему тайтл ищут все скрипты наполнения');
    } else if (seenKeys.has(key)) {
      if (!reportedDuplicates.has(key)) {
        reportedDuplicates.add(key);
        add(FILMS, key, 'duplicate-title-original');
      }
    } else {
      seenKeys.add(key);
      filmByKey.set(key, film);
    }

    const tags = strings(film, 'tags');
    const tagsError = validateTags(tags);
    if (tagsError !== null) add(FILMS, record, 'invalid-tags', tagsError);

    const seasonsError = validateSeasons(
      {
        seasonsReleased: typeof film.seasonsReleased === 'number' ? film.seasonsReleased : null,
        nextSeasonNumber: typeof film.nextSeasonNumber === 'number' ? film.nextSeasonNumber : null,
        nextSeasonDate: text(film, 'nextSeasonDate'),
      },
      tags,
    );
    if (seasonsError !== null) add(FILMS, record, 'invalid-seasons', seasonsError);

    const posterPath = text(film, 'posterPath');
    if (posterPath !== null && posterPath !== '') {
      const missing = posterFiles(posterPath).filter((path) => !exists(path));
      if (missing.length > 0) add(FILMS, record, 'poster-missing', missing.join(', '));
    }

    // Дата заведения обязательна и приходит только отсюда: скрипт наполнения её
    // не выдумывает, иначе боевая база получила бы день долива вместо дня,
    // когда тайтл на самом деле завели.
    const createdAtError = validateCreatedAt(film.createdAt);
    if (createdAtError === 'no-created-at') add(FILMS, record, 'no-created-at');
    if (createdAtError === 'bad-created-at') {
      add(FILMS, record, 'bad-created-at', text(film, 'createdAt') ?? '');
    }
  }

  // Теги: наборы обязаны совпасть, и запись обязана быть у каждого тайтла.
  const tagsByKey = new Map<string, Row>();
  for (const row of tagRows) {
    const key = keyOf(row);
    const film = key === '' ? undefined : filmByKey.get(key);
    if (film === undefined) {
      add(TAGS, key !== '' ? key : (text(row, 'titleRu') ?? ''), 'orphan-title');
      continue;
    }
    tagsByKey.set(key, row);
    if (!sameSet(strings(film, 'tags'), strings(row, 'tags'))) {
      add(TAGS, key, 'tags-mismatch', difference(strings(film, 'tags'), strings(row, 'tags')).join(', '));
    }
  }
  for (const [key] of filmByKey) {
    if (!tagsByKey.has(key)) add(TAGS, key, 'missing-tags-record');
  }

  // Сезоны: то же самое плюс запрет записи у тайтла без тега `series`.
  const seasonsByKey = new Map<string, Row>();
  for (const row of seasonRows) {
    const key = keyOf(row);
    const film = key === '' ? undefined : filmByKey.get(key);
    if (film === undefined) {
      add(SEASONS, key !== '' ? key : (text(row, 'titleRu') ?? ''), 'orphan-title');
      continue;
    }
    seasonsByKey.set(key, row);
    if (!strings(film, 'tags').includes('series')) {
      add(SEASONS, key, 'seasons-on-non-series');
      continue;
    }
    const fields = ['seasonsReleased', 'nextSeasonNumber', 'nextSeasonDate'];
    const diverged = fields.filter((field) => (film[field] ?? null) !== (row[field] ?? null));
    if (diverged.length > 0) add(SEASONS, key, 'seasons-mismatch', diverged.join(', '));
  }
  for (const [key, film] of filmByKey) {
    if (strings(film, 'tags').includes('series') && !seasonsByKey.has(key)) {
      add(SEASONS, key, 'missing-seasons-record');
    }
  }

  for (const row of dossierRows) {
    const key = keyOf(row);
    const record = key !== '' ? key : (text(row, 'titleRu') ?? '');
    if (key === '' || !filmByKey.has(key)) {
      add(DOSSIERS, record, 'orphan-title');
      continue;
    }

    const searchedAt = text(row, 'searchedAt');
    if (searchedAt === null || !SEARCHED_AT.test(searchedAt)) {
      add(DOSSIERS, record, 'bad-searched-at', searchedAt ?? 'дата не задана');
    }

    for (const block of ['before', 'keys', 'after'] as const) {
      if (row[block] === undefined || row[block] === null) continue;
      const error = validateDossierBlock(block, list(row, block) as DossierFragment[]);
      if (error !== null) add(DOSSIERS, record, 'invalid-dossier', `${block}: ${error}`);
    }

    const sourcesError = validateSources(list(row, 'sources') as DossierSource[]);
    if (sourcesError !== null) add(DOSSIERS, record, 'invalid-sources', sourcesError);

    const known = urlsOfSources(row);
    const used = [
      ...linksOfFragments(list(row, 'before')),
      ...linksOfFragments(list(row, 'keys')),
      ...linksOfFragments(list(row, 'after')),
    ];
    for (const url of new Set(used)) {
      if (!known.has(url)) add(DOSSIERS, record, 'link-not-in-sources', url);
    }
  }

  const seenSlugs = new Set<string>();
  const reportedSlugs = new Set<string>();
  for (const row of peopleRows) {
    const slug = text(row, 'slug') ?? '';
    const record = slug !== '' ? slug : (text(row, 'nameRu') ?? '');

    const personError = validatePerson(row as unknown as PersonInput);
    if (personError !== null) {
      add(PEOPLE, record, 'invalid-person', personError);
      continue;
    }

    if (seenSlugs.has(slug)) {
      if (!reportedSlugs.has(slug)) {
        reportedSlugs.add(slug);
        add(PEOPLE, slug, 'duplicate-slug');
      }
      continue;
    }
    seenSlugs.add(slug);

    const nameRu = text(row, 'nameRu') ?? '';

    for (const raw of list(row, 'films')) {
      const link = asRow(raw);
      if (link === null) continue;
      const key = text(link, 'titleOriginal') ?? '';
      const film = filmByKey.get(key);
      if (film === undefined) {
        add(PEOPLE, record, 'orphan-title', key);
        continue;
      }
      const field = FIELD_OF_ROLE[text(link, 'role') ?? ''];
      if (field === undefined) continue;
      const value = field === 'cast' ? strings(film, 'cast').join(', ') : text(film, field);
      if (value === null || !value.includes(nameRu)) {
        add(PEOPLE, record, 'name-not-in-field', `«${nameRu}» не встречается в поле «${field}»`);
      }
    }

    for (const raw of list(row, 'workNotes')) {
      const work = asRow(raw);
      if (work === null) continue;
      const key = text(work, 'titleOriginal');
      if (key !== null && key !== '' && !filmByKey.has(key)) {
        add(PEOPLE, record, 'unknown-work-title', key);
      }
    }

    const photoPath = text(row, 'photoPath');
    if (photoPath !== null && photoPath !== '' && !exists(`public${photoPath}`)) {
      add(PEOPLE, record, 'photo-missing', photoPath);
    }

    const known = urlsOfSources(row);
    const used: string[] = [];
    for (const raw of list(row, 'method')) {
      const item = asRow(raw);
      if (item === null) continue;
      for (const rawThesis of list(item, 'theses')) {
        const thesis = asRow(rawThesis);
        if (thesis === null) continue;
        used.push(...linksOfNodes(list(thesis, 'body') as DossierNode[]));
      }
    }
    for (const raw of list(row, 'workNotes')) {
      const work = asRow(raw);
      if (work === null) continue;
      used.push(...linksOfNodes(list(work, 'method') as DossierNode[]));
    }
    for (const url of new Set(used)) {
      if (!known.has(url)) add(PEOPLE, record, 'link-not-in-sources', url);
    }
  }

  return problems;
}

// Типы `Method` и `WorkNote` переиспользуются как есть — второй модели метода
// в проекте быть не должно.
export type { Method, WorkNote };
