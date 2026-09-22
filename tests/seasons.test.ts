// Критерии приёмки 5 и 8 версии v5 на уровне чистой логики сезонов:
// 5 — сериал с объявленным следующим сезоном встаёт в таймлайн по дате этого сезона,
//     а не по дате выхода первого;
// 8 — сезонные данные у тайтла без тега `series`, номер следующего сезона, не равный
//     `seasonsReleased + 1`, и дата без номера отклоняются валидатором.
//
// Контракт модуля '@/lib/seasons', зафиксированный этими тестами:
//   type SeasonsError = 'released' | 'next-number' | 'orphan-date' | 'date-format' | 'not-series';
//   function validateSeasons(
//     input: { seasonsReleased: number | null; nextSeasonNumber: number | null;
//              nextSeasonDate: string | null },
//     tags: string[],
//   ): SeasonsError | null;
//   function awaitsSeason(film: { nextSeasonNumber: number | null }): boolean;
//   function awaitedDate(film): string | null;
//
// Валидатор устроен как `validateTags` в v3 и `validateDossierBlock` в v4: `null` —
// данные в порядке, иначе код ошибки. Коды проверяются поимённо: перепутанные коды
// означают, что скрипт наполнения сообщит агенту не о том.

import { describe, it, expect } from 'vitest';
import { validateSeasons, awaitsSeason, awaitedDate } from '@/lib/seasons';

const SERIES = ['series', 'live-action', 'horror'];
const FILM = ['film', 'live-action', 'drama'];

type SeasonsInput = {
  seasonsReleased: number | null;
  nextSeasonNumber: number | null;
  nextSeasonDate: string | null;
};

/** Пустые сезонные поля: перечисляем только то, что проверяем. */
const seasons = (overrides: Partial<SeasonsInput> = {}): SeasonsInput => ({
  seasonsReleased: null,
  nextSeasonNumber: null,
  nextSeasonDate: null,
  ...overrides,
});

describe('validateSeasons: корректные наборы', () => {
  it('пустые сезонные поля допустимы и у сериала, и у полного метра', () => {
    expect(validateSeasons(seasons(), SERIES)).toBeNull();
    expect(validateSeasons(seasons(), FILM)).toBeNull();
    expect(validateSeasons(seasons(), [])).toBeNull();
  });

  it('у сериала достаточно одного числа вышедших сезонов', () => {
    expect(validateSeasons(seasons({ seasonsReleased: 1 }), SERIES)).toBeNull();
    expect(validateSeasons(seasons({ seasonsReleased: 7 }), SERIES)).toBeNull();
  });

  it('следующий сезон с полной датой принимается', () => {
    const input = seasons({
      seasonsReleased: 2,
      nextSeasonNumber: 3,
      nextSeasonDate: '2027-03-12',
    });

    expect(validateSeasons(input, SERIES)).toBeNull();
  });

  it('следующий сезон с датой точностью до месяца принимается', () => {
    const input = seasons({ seasonsReleased: 2, nextSeasonNumber: 3, nextSeasonDate: '2027-03' });

    expect(validateSeasons(input, SERIES)).toBeNull();
  });

  it('следующий сезон без даты принимается: дата просто неизвестна', () => {
    const input = seasons({ seasonsReleased: 2, nextSeasonNumber: 3 });

    expect(validateSeasons(input, SERIES)).toBeNull();
  });
});

describe('validateSeasons: число вышедших сезонов (критерий 8)', () => {
  it('ноль и отрицательное число отклоняются', () => {
    expect(validateSeasons(seasons({ seasonsReleased: 0 }), SERIES)).toBe('released');
    expect(validateSeasons(seasons({ seasonsReleased: -1 }), SERIES)).toBe('released');
  });

  it('нецелое число сезонов отклоняется', () => {
    expect(validateSeasons(seasons({ seasonsReleased: 2.5 }), SERIES)).toBe('released');
  });
});

describe('validateSeasons: номер следующего сезона (критерий 8)', () => {
  it('номер, не равный «вышло + 1», отклоняется', () => {
    expect(
      validateSeasons(seasons({ seasonsReleased: 2, nextSeasonNumber: 4 }), SERIES),
    ).toBe('next-number');
    expect(
      validateSeasons(seasons({ seasonsReleased: 2, nextSeasonNumber: 2 }), SERIES),
    ).toBe('next-number');
    expect(
      validateSeasons(seasons({ seasonsReleased: 3, nextSeasonNumber: 1 }), SERIES),
    ).toBe('next-number');
  });

  it('номер следующего сезона без числа вышедших отклоняется: сравнивать не с чем', () => {
    expect(validateSeasons(seasons({ nextSeasonNumber: 2 }), SERIES)).toBe('next-number');
  });
});

describe('validateSeasons: дата следующего сезона (критерий 8)', () => {
  it('дата без номера сезона отклоняется', () => {
    expect(
      validateSeasons(seasons({ seasonsReleased: 2, nextSeasonDate: '2027-03' }), SERIES),
    ).toBe('orphan-date');
  });

  it('дата в чужом формате отклоняется', () => {
    for (const date of ['2027', '2027-3', '2027-03-1', '12.03.2027', 'март 2027', '']) {
      expect(
        validateSeasons(
          seasons({ seasonsReleased: 2, nextSeasonNumber: 3, nextSeasonDate: date }),
          SERIES,
        ),
        `дата «${date}» не должна проходить валидацию`,
      ).toBe('date-format');
    }
  });
});

describe('validateSeasons: сезоны только у сериала (критерий 8)', () => {
  it('число вышедших сезонов у полного метра отклоняется', () => {
    expect(validateSeasons(seasons({ seasonsReleased: 2 }), FILM)).toBe('not-series');
  });

  it('номер следующего сезона у полного метра отклоняется', () => {
    expect(
      validateSeasons(seasons({ seasonsReleased: 2, nextSeasonNumber: 3 }), FILM),
    ).toBe('not-series');
  });

  it('сезоны у тайтла вообще без тегов отклоняются', () => {
    expect(validateSeasons(seasons({ seasonsReleased: 1 }), [])).toBe('not-series');
  });
});

describe('awaitsSeason', () => {
  it('объявленный следующий сезон — ждём', () => {
    expect(awaitsSeason({ nextSeasonNumber: 3 })).toBe(true);
  });

  it('без объявленного сезона не ждём: сериал закончен или продолжение не объявлено', () => {
    expect(awaitsSeason({ nextSeasonNumber: null })).toBe(false);
  });

  it('дата тут ни при чём: сезон без даты всё равно ждут', () => {
    expect(awaitsSeason({ nextSeasonNumber: 2 })).toBe(true);
  });
});

describe('awaitedDate (критерий 5)', () => {
  it('у сериала с объявленным сезоном это дата сезона, а не дата выхода', () => {
    const film = {
      releaseDate: '2023-11-10',
      nextSeasonNumber: 3,
      nextSeasonDate: '2027-03-12',
    };

    expect(awaitedDate(film)).toBe('2027-03-12');
  });

  it('дата сезона точностью до месяца возвращается как есть', () => {
    const film = { releaseDate: '2023-11-10', nextSeasonNumber: 3, nextSeasonDate: '2027-03' };

    expect(awaitedDate(film)).toBe('2027-03');
  });

  it('у сериала с объявленным сезоном без даты дата неизвестна', () => {
    const film = { releaseDate: '2023-11-10', nextSeasonNumber: 3, nextSeasonDate: null };

    expect(awaitedDate(film)).toBeNull();
  });

  it('у сериала без объявленного сезона это дата выхода', () => {
    const film = { releaseDate: '2023-11-10', nextSeasonNumber: null, nextSeasonDate: null };

    expect(awaitedDate(film)).toBe('2023-11-10');
  });

  it('у полного метра это дата выхода', () => {
    const film = { releaseDate: '2026-09-18', nextSeasonNumber: null, nextSeasonDate: null };

    expect(awaitedDate(film)).toBe('2026-09-18');
  });

  it('у тайтла без даты выхода и без сезона даты нет', () => {
    const film = { releaseDate: null, nextSeasonNumber: null, nextSeasonDate: null };

    expect(awaitedDate(film)).toBeNull();
  });
});
