export type SeasonsError =
  | 'not-series'
  | 'released'
  | 'next-number'
  | 'orphan-date'
  | 'date-format';

export type SeasonsInput = {
  seasonsReleased: number | null;
  nextSeasonNumber: number | null;
  nextSeasonDate: string | null;
};

/** Дата сезона допускает точность до месяца: анонсы обычно называют месяц или
 *  премьерную пору, а не число. */
const SEASON_DATE = /^\d{4}-\d{2}(-\d{2})?$/;

/** null — данные в порядке, иначе код ошибки. Так же устроены `validateTags`
 *  в v3 и `validateDossierBlock` в v4. */
export function validateSeasons(input: SeasonsInput, tags: string[]): SeasonsError | null {
  const filled =
    input.seasonsReleased !== null || input.nextSeasonNumber !== null || input.nextSeasonDate !== null;
  if (!filled) return null;
  if (!tags.includes('series')) return 'not-series';

  if (input.seasonsReleased !== null) {
    if (!Number.isInteger(input.seasonsReleased) || input.seasonsReleased < 1) return 'released';
  }

  if (input.nextSeasonNumber !== null) {
    // Ждать можно только следующий по счёту сезон; без числа вышедших сравнивать не с чем.
    if (input.seasonsReleased === null) return 'next-number';
    if (input.nextSeasonNumber !== input.seasonsReleased + 1) return 'next-number';
  }

  if (input.nextSeasonDate !== null) {
    if (input.nextSeasonNumber === null) return 'orphan-date';
    if (!SEASON_DATE.test(input.nextSeasonDate)) return 'date-format';
  }

  return null;
}

/** Ждёт ли сериал следующего сезона. Дата тут ни при чём: объявленный сезон
 *  без даты ждут точно так же, просто неизвестно когда. */
export function awaitsSeason(film: { nextSeasonNumber: number | null }): boolean {
  return film.nextSeasonNumber !== null;
}

/** Дата, по которой тайтл встаёт в таймлайн «Ждём»: у сериала с объявленным
 *  сезоном — дата сезона, у всех остальных — дата выхода. null — дата неизвестна. */
export function awaitedDate(film: {
  releaseDate: string | null;
  nextSeasonNumber: number | null;
  nextSeasonDate: string | null;
}): string | null {
  return awaitsSeason(film) ? film.nextSeasonDate : film.releaseDate;
}
