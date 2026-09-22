import type { Film } from '@/db/schema';
import { TAG_BY_SLUG } from './tags';

/** Число — «эта оценка и выше», `'none'` — «оценка не поставлена», null — не фильтруем.
 *  «Без оценки» не ступень шкалы, а другой вопрос, поэтому отдельное значение, а не ноль. */
export type RatingFilter = number | 'none' | null;

export type DossierFilter = 'yes' | 'no' | null;

export type Filters = {
  genres: string[]; // пусто — не фильтруем; несколько — «любой из выбранных»
  form: string | null;
  kind: string | null;
  taste: boolean; // true — только тайтлы со звёздочкой вкуса
  rating: RatingFilter;
  dossier: DossierFilter;
};

export const EMPTY_FILTERS: Filters = {
  genres: [],
  form: null,
  kind: null,
  taste: false,
  rating: null,
  dossier: null,
};

export function isEmpty(filters: Filters): boolean {
  return (
    filters.genres.length === 0 &&
    filters.form === null &&
    filters.kind === null &&
    !filters.taste &&
    filters.rating === null &&
    filters.dossier === null
  );
}

/** Сколько фильтров применено. Каждый выбранный жанр — единица: снимаются они
 *  тоже по одному. Сортировки здесь нет и быть не может — её нет в `Filters`. */
export function countFilters(filters: Filters): number {
  return (
    filters.genres.length +
    (filters.form !== null ? 1 : 0) +
    (filters.kind !== null ? 1 : 0) +
    (filters.taste ? 1 : 0) +
    (filters.rating !== null ? 1 : 0) +
    (filters.dossier !== null ? 1 : 0)
  );
}

export type AppliedChip = {
  kind: 'genre' | 'form' | 'kind' | 'taste' | 'rating' | 'dossier';
  label: string;
  /** Те же фильтры без этого одного — адрес плашки собирается из них. */
  without: Filters;
};

/** Перечень выбранного: подпись и способ снять. Живёт здесь, а не в вёрстке, потому
 *  что подписи читают двое — строка применённого и пустое состояние страницы, —
 *  и разойтись они не должны. Порядок тот же, что в панели.
 *
 *  Витрина говорит с читателем; словарь подписей — её и только её. */
export function appliedChips(filters: Filters): AppliedChip[] {
  const chips: AppliedChip[] = [];

  for (const slug of filters.genres) {
    chips.push({
      kind: 'genre',
      label: TAG_BY_SLUG.get(slug)?.label ?? slug,
      without: { ...filters, genres: filters.genres.filter((other) => other !== slug) },
    });
  }

  if (filters.form !== null) {
    chips.push({
      // «фильм» → «фильмы»: в перечне выбранного форма называется множественным,
      // как и в панели, где она отвечает на вопрос «что показывать».
      kind: 'form',
      label: `${TAG_BY_SLUG.get(filters.form)?.label ?? filters.form}ы`,
      without: { ...filters, form: null },
    });
  }

  if (filters.kind !== null) {
    chips.push({
      kind: 'kind',
      label: TAG_BY_SLUG.get(filters.kind)?.label ?? filters.kind,
      without: { ...filters, kind: null },
    });
  }

  if (filters.taste) {
    chips.push({ kind: 'taste', label: 'по вкусу', without: { ...filters, taste: false } });
  }

  if (filters.rating !== null) {
    chips.push({
      kind: 'rating',
      label: filters.rating === 'none' ? 'без оценки' : `оценка ${filters.rating}+`,
      without: { ...filters, rating: null },
    });
  }

  if (filters.dossier !== null) {
    chips.push({
      kind: 'dossier',
      label: filters.dossier === 'yes' ? 'с разбором' : 'без разбора',
      without: { ...filters, dossier: null },
    });
  }

  return chips;
}

/** Фильтры разных групп сужают выборку совместно; внутри группы жанров —
 *  «любой из выбранных». Порядок записей сохраняется. */
export function applyFilters(films: Film[], filters: Filters): Film[] {
  if (isEmpty(filters)) return films;

  return films.filter((film) => {
    const tags = film.tags ?? [];
    if (filters.taste && !film.tasteStar) return false;
    if (filters.form !== null && !tags.includes(filters.form)) return false;
    if (filters.kind !== null && !tags.includes(filters.kind)) return false;
    if (filters.genres.length > 0 && !filters.genres.some((genre) => tags.includes(genre))) {
      return false;
    }
    if (filters.rating === 'none') {
      if (film.myRating !== null) return false;
    } else if (filters.rating !== null) {
      if (film.myRating === null || film.myRating < filters.rating) return false;
    }
    // Разбор считается по блоку «Зачем смотреть»: пустой массив запрещён валидатором,
    // поэтому третьего состояния нет и проверки на null достаточно.
    if (filters.dossier === 'yes' && film.dossierBefore === null) return false;
    if (filters.dossier === 'no' && film.dossierBefore !== null) return false;
    return true;
  });
}

/** Сколько тайтлов выборки несёт каждый жанр — для счётчиков в панели фильтров
 *  и для приглушения жанров, под которые ничего нет. */
export function genreCounts(films: Film[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const film of films) {
    for (const slug of film.tags ?? []) {
      if (TAG_BY_SLUG.get(slug)?.category === 'genre') {
        counts.set(slug, (counts.get(slug) ?? 0) + 1);
      }
    }
  }
  return counts;
}
