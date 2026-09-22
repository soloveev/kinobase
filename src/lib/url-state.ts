import type { FilmStatus } from './status';
import type { SortMode } from './sort';
import { EMPTY_FILTERS, type DossierFilter, type Filters, type RatingFilter } from './filters';
import { ROLE_BY_SLUG } from './people';
import { TAG_BY_SLUG, type TagCategory } from './tags';

export type StatusFilter = FilmStatus | 'all';

const STATUS_VALUES: readonly StatusFilter[] = ['all', 'watched', 'will-watch', 'waiting', 'other'];
const SORT_VALUES: readonly SortMode[] = ['date', 'rating'];

/** Одно значение параметра. Повторный параметр адреса (`?status=a&status=b`) Next
 *  отдаёт массивом; выбирать за человека, какое из двух значений он имел в виду,
 *  нельзя — значит, параметра нет. Конвенция общая для всего разбора адреса.
 *
 *  Помощник завела админка; сюда он переехал 15.09.2026, потому что предмет у него —
 *  разбор адреса, а не админка, и `parseStatus` с `parseSort` решали ту же задачу
 *  вручную, каждая своим текстом. */
export function single(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** Значение из перечня либо умолчание. Умолчание своё у каждого вызова: перечень
 *  описывает то, что принимается из адреса, а чем отвечать на непринятое — решает
 *  вызывающий. */
export function oneOf<T extends string>(
  value: string | string[] | undefined,
  values: readonly T[],
  fallback: T,
): T {
  const given = single(value);
  return given !== undefined && (values as readonly string[]).includes(given)
    ? (given as T)
    : fallback;
}

export function parseStatus(value: string | string[] | undefined): StatusFilter {
  return oneOf(value, STATUS_VALUES, 'all');
}

export function parseSort(value: string | string[] | undefined): SortMode {
  return oneOf(value, SORT_VALUES, 'date');
}

/** Значение принимается, только если это тег нужной категории; всё остальное
 *  (неизвестные имена, тег чужой категории, повторный параметр) отбрасывается. */
export function parseTag(value: string | string[] | undefined, category: TagCategory): string | null {
  if (typeof value !== 'string') return null;
  return TAG_BY_SLUG.get(value)?.category === category ? value : null;
}

/** Оценка в адресе: целое от 1 до 10 («эта оценка и выше») либо `none` («без оценки»).
 *  Всё прочее — «фильтр не применён». Проверка на целость обязательна: `Number('8.5')`
 *  и `Number('08')` иначе проехали бы числами, которых на шкале нет. */
export function parseRating(value: string | string[] | undefined): RatingFilter {
  if (typeof value !== 'string') return null;
  if (value === 'none') return 'none';
  const step = Number(value);
  if (!Number.isInteger(step) || step < 1 || step > 10) return null;
  // '08' и ' 8' дают то же число, что '8', но адресом не являются: сверяемся с записью.
  return String(step) === value ? step : null;
}

export function parseDossier(value: string | string[] | undefined): DossierFilter {
  return value === 'yes' || value === 'no' ? value : null;
}

export function parseFilters(params: Record<string, string | string[] | undefined>): Filters {
  const genre = params.genre;
  const genres =
    typeof genre === 'string'
      ? genre.split(',').filter((slug) => TAG_BY_SLUG.get(slug)?.category === 'genre')
      : [];

  return {
    genres,
    form: parseTag(params.form, 'form'),
    kind: parseTag(params.kind, 'kind'),
    // Единственное принимаемое значение; всё остальное — «фильтр не применён».
    taste: params.taste === 'star',
    rating: parseRating(params.rating),
    dossier: parseDossier(params.dossier),
  };
}

export function gridHref(
  status: StatusFilter,
  sort: SortMode,
  filters: Filters = EMPTY_FILTERS
): string {
  const params = new URLSearchParams();
  if (status !== 'all') params.set('status', status);
  if (sort !== 'date') params.set('sort', sort);
  if (filters.genres.length > 0) params.set('genre', filters.genres.join(','));
  if (filters.form !== null) params.set('form', filters.form);
  if (filters.kind !== null) params.set('kind', filters.kind);
  if (filters.taste) params.set('taste', 'star');
  // Дописываются в хвост: перестановка параметров сделала бы уже разосланные
  // ссылки непохожими на новые, хотя ведут они в то же место.
  if (filters.rating !== null) params.set('rating', String(filters.rating));
  if (filters.dossier !== null) params.set('dossier', filters.dossier);
  const query = params.toString();
  return query ? `/?${query}` : '/';
}

/** Роли из адреса указателя персоналий. Разбирается так же, как жанры: список через
 *  запятую, неизвестные ключи и повторы отбрасываются молча. */
export function parseRoles(value: string | string[] | undefined): string[] {
  if (typeof value !== 'string') return [];
  const seen = new Set<string>();
  for (const slug of value.split(',')) {
    if (ROLE_BY_SLUG.has(slug)) seen.add(slug);
  }
  return [...seen];
}

export function peopleHref(roles: string[]): string {
  const params = new URLSearchParams();
  if (roles.length > 0) params.set('role', roles.join(','));
  const query = params.toString();
  return query ? `/people?${query}` : '/people';
}
