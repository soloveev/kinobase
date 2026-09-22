import type { Film } from '@/db/schema';
import type { StatusFilter } from './url-state';
import { awaitsSeason } from './seasons';

export type FilmStatus = 'watched' | 'will-watch' | 'waiting' | 'other';

export const STATUS_LABELS: Record<FilmStatus, string> = {
  watched: 'Посмотрел',
  'will-watch': 'Буду смотреть',
  waiting: 'Ждём',
  // Таб перечисляет тайтлы и называется «Другие», плашка описывает один.
  other: 'Другое',
};

export function isReleased(releaseDate: string | null, today: string): boolean {
  return releaseDate === null || releaseDate <= today;
}

/** Статус не хранится, а выводится из отметки о просмотре, галочки «хочу
 *  посмотреть» и даты выхода. Отметка о просмотре главнее даты: раньше «не вышел»
 *  побеждало всё, но это держалось на правиле «нельзя отметить просмотренным
 *  невышедший фильм» — оно остаётся в силе и делает новый порядок безопасным. */
export function filmStatus(
  film: { releaseDate: string | null; watched: boolean; wantToWatch: boolean },
  today: string
): FilmStatus {
  if (film.watched) return 'watched';
  if (!film.wantToWatch) return 'other';
  return isReleased(film.releaseDate, today) ? 'will-watch' : 'waiting';
}

/** Состав таба «Ждём» шире своего статуса — это единственный таб, где так.
 *  Тайтл попадает туда, если он мне интересен (просмотрен или отмечен «хочу
 *  посмотреть») и от него есть чего ждать (ещё не вышел или у сериала объявлен
 *  следующий сезон). Поэтому просмотренный сериал честно стоит и в «Посмотрел»,
 *  и в «Ждём»: первый таб отвечает на вопрос «что я видел», второй — «что впереди». */
export function isAwaited(
  film: {
    releaseDate: string | null;
    watched: boolean;
    wantToWatch: boolean;
    nextSeasonNumber: number | null;
  },
  today: string
): boolean {
  if (!film.watched && !film.wantToWatch) return false;
  return !isReleased(film.releaseDate, today) || awaitsSeason(film);
}

/** Счётчики табов. «Ждём» считается по составу таба, а не по статусу, поэтому
 *  счётчики сознательно не складываются в общее число; честным остаётся «Все». */
export function statusCounts(films: Film[], today: string): Record<StatusFilter, number> {
  const counts: Record<StatusFilter, number> = {
    all: films.length,
    watched: 0,
    'will-watch': 0,
    waiting: 0,
    other: 0,
  };

  for (const film of films) {
    const status = filmStatus(film, today);
    // Статус «ждём» — подмножество состава таба, иначе такой тайтл посчитался бы дважды.
    if (status !== 'waiting') counts[status] += 1;
    if (isAwaited(film, today)) counts.waiting += 1;
  }

  return counts;
}

export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
