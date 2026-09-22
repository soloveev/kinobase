import type { Film } from '@/db/schema';

export type SortMode = 'date' | 'rating';

function byDateDescThenTitle(a: Film, b: Film): number {
  if (a.releaseDate === b.releaseDate) {
    return a.titleRu.localeCompare(b.titleRu, 'ru');
  }
  if (a.releaseDate === null) return 1;
  if (b.releaseDate === null) return -1;
  return a.releaseDate < b.releaseDate ? 1 : -1;
}

function byRatingDescThenDate(a: Film, b: Film): number {
  if (a.myRating === b.myRating) return byDateDescThenTitle(a, b);
  if (a.myRating === null) return 1;
  if (b.myRating === null) return -1;
  return b.myRating - a.myRating;
}

export function sortFilms(films: Film[], mode: SortMode): Film[] {
  const comparator = mode === 'rating' ? byRatingDescThenDate : byDateDescThenTitle;
  return [...films].sort(comparator);
}
