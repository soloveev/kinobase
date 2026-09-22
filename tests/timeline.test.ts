// Критерии приёмки 2 и 3 версии v2 на уровне доменной логики:
// 2 — месяцы идут от ближайшего к дальнему, внутри месяца тайтлы по дате по возрастанию,
//     при равной дате — по алфавиту русского названия;
// 3 — месяцы без тайтлов в результате отсутствуют вовсе.
//
// Дополнение v5, критерии приёмки 5 и 7:
// 5 — дата, по которой тайтл встаёт в таймлайн, приходит извне: у сериала это дата
//     следующего сезона, у фильма — дата выхода;
// 7 — тайтл, которого ждут без известной даты, попадает в хвостовую группу `month: null`
//     («Дата выхода неизвестна»), и она идёт после всех месяцев, как бы далеко в будущее
//     ни уходил последний из них.
//
// Контракт v5 ('@/lib/timeline'):
//   type MonthGroup = { month: string | null; films: Film[] };
//   function groupByMonth(films: Film[], dateOf: (film: Film) => string | null): MonthGroup[];
//
// Дата допускает точность до месяца ('2027-03'): такой тайтл встаёт в начале своего месяца.

import { describe, it, expect } from 'vitest';
import { groupByMonth } from '@/lib/timeline';
import { makeFilm } from './helpers';
import type { Film } from '@/db/schema';

const titles = (films: { titleRu: string }[]) => films.map((f) => f.titleRu);
const months = (groups: { month: string | null }[]) => groups.map((g) => g.month);

/** Обычный случай: тайтл встаёт в таймлайн по дате выхода. */
const byReleaseDate = (film: Film) => film.releaseDate;

describe('groupByMonth, порядок месяцев', () => {
  it('месяцы идут от ближайшего к дальнему независимо от порядка на входе', () => {
    const films = [
      makeFilm({ id: 1, titleRu: 'Декабрьский', releaseDate: '2026-12-04' }),
      makeFilm({ id: 2, titleRu: 'Августовский', releaseDate: '2026-08-14' }),
      makeFilm({ id: 3, titleRu: 'Октябрьский', releaseDate: '2026-10-02' }),
    ];

    expect(months(groupByMonth(films, byReleaseDate))).toEqual(['2026-08', '2026-10', '2026-12']);
  });

  it('месяцы без фильмов не появляются: за августом сразу идёт декабрь', () => {
    const films = [
      makeFilm({ id: 1, titleRu: 'Августовский', releaseDate: '2026-08-14' }),
      makeFilm({ id: 2, titleRu: 'Декабрьский', releaseDate: '2026-12-04' }),
    ];

    const groups = groupByMonth(films, byReleaseDate);

    expect(groups).toHaveLength(2);
    expect(months(groups)).toEqual(['2026-08', '2026-12']);
  });

  it('фильмы одного месяца собираются в одну группу', () => {
    const films = [
      makeFilm({ id: 1, titleRu: 'Первый', releaseDate: '2026-08-01' }),
      makeFilm({ id: 2, titleRu: 'Второй', releaseDate: '2026-08-20' }),
      makeFilm({ id: 3, titleRu: 'Третий', releaseDate: '2026-08-31' }),
    ];

    const groups = groupByMonth(films, byReleaseDate);

    expect(groups).toHaveLength(1);
    expect(groups[0].month).toBe('2026-08');
    expect(titles(groups[0].films)).toEqual(['Первый', 'Второй', 'Третий']);
  });

  it('группировка не путает одинаковые месяцы разных лет', () => {
    const films = [
      makeFilm({ id: 1, titleRu: 'Август следующего года', releaseDate: '2027-08-05' }),
      makeFilm({ id: 2, titleRu: 'Август этого года', releaseDate: '2026-08-05' }),
    ];

    const groups = groupByMonth(films, byReleaseDate);

    expect(months(groups)).toEqual(['2026-08', '2027-08']);
    expect(titles(groups[0].films)).toEqual(['Август этого года']);
    expect(titles(groups[1].films)).toEqual(['Август следующего года']);
  });

  it('месяцы на границе года идут по возрастанию: декабрь 2026 раньше февраля 2027', () => {
    const films = [
      makeFilm({ id: 1, titleRu: 'Февральский', releaseDate: '2027-02-11' }),
      makeFilm({ id: 2, titleRu: 'Январский', releaseDate: '2027-01-09' }),
      makeFilm({ id: 3, titleRu: 'Декабрьский', releaseDate: '2026-12-25' }),
    ];

    expect(months(groupByMonth(films, byReleaseDate))).toEqual(['2026-12', '2027-01', '2027-02']);
  });
});

describe('groupByMonth, порядок внутри месяца', () => {
  it('фильмы месяца идут по дате по возрастанию', () => {
    const films = [
      makeFilm({ id: 1, titleRu: 'Позже всех', releaseDate: '2026-08-28' }),
      makeFilm({ id: 2, titleRu: 'Раньше всех', releaseDate: '2026-08-03' }),
      makeFilm({ id: 3, titleRu: 'В середине', releaseDate: '2026-08-15' }),
    ];

    const groups = groupByMonth(films, byReleaseDate);

    expect(titles(groups[0].films)).toEqual(['Раньше всех', 'В середине', 'Позже всех']);
  });

  it('при одинаковой дате фильмы идут по алфавиту русского названия', () => {
    const films = [
      makeFilm({ id: 1, titleRu: 'Ящерица', releaseDate: '2026-08-14' }),
      makeFilm({ id: 2, titleRu: 'Берег', releaseDate: '2026-08-14' }),
      makeFilm({ id: 3, titleRu: 'Автобус', releaseDate: '2026-08-14' }),
    ];

    const groups = groupByMonth(films, byReleaseDate);

    expect(titles(groups[0].films)).toEqual(['Автобус', 'Берег', 'Ящерица']);
  });

  it('дата важнее алфавита: ранний «Ящерица» опережает поздний «Автобус»', () => {
    const films = [
      makeFilm({ id: 1, titleRu: 'Автобус', releaseDate: '2026-08-20' }),
      makeFilm({ id: 2, titleRu: 'Ящерица', releaseDate: '2026-08-02' }),
    ];

    expect(titles(groupByMonth(films, byReleaseDate)[0].films)).toEqual(['Ящерица', 'Автобус']);
  });

  it('порядок восстанавливается в каждом месяце независимо', () => {
    const films = [
      makeFilm({ id: 1, titleRu: 'Сентябрь поздний', releaseDate: '2026-09-30' }),
      makeFilm({ id: 2, titleRu: 'Август поздний', releaseDate: '2026-08-30' }),
      makeFilm({ id: 3, titleRu: 'Сентябрь ранний', releaseDate: '2026-09-01' }),
      makeFilm({ id: 4, titleRu: 'Август ранний', releaseDate: '2026-08-01' }),
    ];

    const groups = groupByMonth(films, byReleaseDate);

    expect(titles(groups[0].films)).toEqual(['Август ранний', 'Август поздний']);
    expect(titles(groups[1].films)).toEqual(['Сентябрь ранний', 'Сентябрь поздний']);
  });
});

// Дата приходит вторым аргументом, поэтому таймлайн одинаково умеет расставлять
// и фильмы по дате выхода, и сериалы по дате следующего сезона.
describe('groupByMonth, дата приходит извне (критерий 5)', () => {
  const awaitedDate = (film: Film) =>
    film.nextSeasonNumber !== null ? film.nextSeasonDate : film.releaseDate;

  it('сериал встаёт в месяц следующего сезона, а не первого', () => {
    const films = [
      makeFilm({
        id: 1,
        titleRu: 'Сериал',
        releaseDate: '2023-11-10',
        seasonsReleased: 2,
        nextSeasonNumber: 3,
        nextSeasonDate: '2027-03-12',
      }),
    ];

    const groups = groupByMonth(films, awaitedDate);

    expect(months(groups)).toEqual(['2027-03']);
    expect(titles(groups[0].films)).toEqual(['Сериал']);
  });

  it('сериал и фильм расставляются по своим датам в общем таймлайне', () => {
    const films = [
      makeFilm({
        id: 1,
        titleRu: 'Сериал',
        releaseDate: '2023-11-10',
        seasonsReleased: 2,
        nextSeasonNumber: 3,
        nextSeasonDate: '2027-03-12',
      }),
      makeFilm({ id: 2, titleRu: 'Фильм', releaseDate: '2026-09-18' }),
    ];

    const groups = groupByMonth(films, awaitedDate);

    expect(months(groups)).toEqual(['2026-09', '2027-03']);
    expect(titles(groups[0].films)).toEqual(['Фильм']);
    expect(titles(groups[1].films)).toEqual(['Сериал']);
  });
});

describe('groupByMonth, дата точностью до месяца', () => {
  it('дата «2027-03» попадает в месяц 2027-03', () => {
    const films = [makeFilm({ id: 1, titleRu: 'Месячная точность', releaseDate: '2027-03' })];

    expect(months(groupByMonth(films, byReleaseDate))).toEqual(['2027-03']);
  });

  it('тайтл с месячной точностью встаёт в начале своего месяца', () => {
    const films = [
      makeFilm({ id: 1, titleRu: 'Первое марта', releaseDate: '2027-03-01' }),
      makeFilm({ id: 2, titleRu: 'Просто март', releaseDate: '2027-03' }),
      makeFilm({ id: 3, titleRu: 'Двенадцатое марта', releaseDate: '2027-03-12' }),
    ];

    const groups = groupByMonth(films, byReleaseDate);

    expect(groups).toHaveLength(1);
    expect(titles(groups[0].films)).toEqual(['Просто март', 'Первое марта', 'Двенадцатое марта']);
  });

  it('месяцы с разной точностью дат идут в общем порядке', () => {
    const films = [
      makeFilm({ id: 1, titleRu: 'Май', releaseDate: '2027-05' }),
      makeFilm({ id: 2, titleRu: 'Апрель', releaseDate: '2027-04-20' }),
      makeFilm({ id: 3, titleRu: 'Март', releaseDate: '2027-03' }),
    ];

    expect(months(groupByMonth(films, byReleaseDate))).toEqual(['2027-03', '2027-04', '2027-05']);
  });
});

// Критерий 7: секция «Дата выхода неизвестна» — это группа с month === null.
describe('groupByMonth, группа без даты (критерий 7)', () => {
  it('тайтлы без даты собираются в отдельную группу с month === null', () => {
    const films = [
      makeFilm({ id: 1, titleRu: 'С датой', releaseDate: '2026-08-14' }),
      makeFilm({ id: 2, titleRu: 'Без даты', releaseDate: null }),
    ];

    const groups = groupByMonth(films, byReleaseDate);

    expect(months(groups)).toEqual(['2026-08', null]);
    expect(titles(groups[1].films)).toEqual(['Без даты']);
  });

  it('группа без даты идёт после самого дальнего месяца', () => {
    const films = [
      makeFilm({ id: 1, titleRu: 'Без даты', releaseDate: null }),
      makeFilm({ id: 2, titleRu: 'Далёкий', releaseDate: '2099-12-31' }),
      makeFilm({ id: 3, titleRu: 'Близкий', releaseDate: '2026-08-14' }),
    ];

    expect(months(groupByMonth(films, byReleaseDate))).toEqual(['2026-08', '2099-12', null]);
  });

  it('внутри группы без даты порядок по алфавиту русского названия', () => {
    const films = [
      makeFilm({ id: 1, titleRu: 'Ящерица', releaseDate: null }),
      makeFilm({ id: 2, titleRu: 'Берег', releaseDate: null }),
      makeFilm({ id: 3, titleRu: 'Автобус', releaseDate: null }),
    ];

    const groups = groupByMonth(films, byReleaseDate);

    expect(titles(groups[0].films)).toEqual(['Автобус', 'Берег', 'Ящерица']);
  });

  it('если ждать нечего без даты, группы с month === null нет вовсе', () => {
    const films = [makeFilm({ id: 1, titleRu: 'С датой', releaseDate: '2026-08-14' })];

    expect(months(groupByMonth(films, byReleaseDate))).toEqual(['2026-08']);
  });

  it('сериал с объявленным сезоном без даты попадает в группу без даты', () => {
    const awaitedDate = (film: Film) =>
      film.nextSeasonNumber !== null ? film.nextSeasonDate : film.releaseDate;
    const films = [
      makeFilm({
        id: 1,
        titleRu: 'Сезон без даты',
        releaseDate: '2023-11-10',
        seasonsReleased: 1,
        nextSeasonNumber: 2,
        nextSeasonDate: null,
      }),
      makeFilm({ id: 2, titleRu: 'Фильм', releaseDate: '2026-09-18' }),
    ];

    const groups = groupByMonth(films, awaitedDate);

    expect(months(groups)).toEqual(['2026-09', null]);
    expect(titles(groups[1].films)).toEqual(['Сезон без даты']);
  });
});

describe('groupByMonth, краевые случаи', () => {
  it('пустой список даёт пустой результат', () => {
    expect(groupByMonth([], byReleaseDate)).toEqual([]);
  });

  it('список из одних тайтлов без даты даёт одну группу — хвостовую', () => {
    const films = [
      makeFilm({ id: 1, titleRu: 'Без даты один', releaseDate: null }),
      makeFilm({ id: 2, titleRu: 'Без даты два', releaseDate: null }),
    ];

    const groups = groupByMonth(films, byReleaseDate);

    expect(months(groups)).toEqual([null]);
    // По алфавиту, а не по порядку на входе: «два» раньше «один». Правило то же,
    // что в тесте выше про Автобус — Берег — Ящерицу, и то же, что в спеке.
    expect(titles(groups[0].films)).toEqual(['Без даты два', 'Без даты один']);
  });

  it('исходный список не изменяется', () => {
    const films = [
      makeFilm({ id: 1, titleRu: 'Позже', releaseDate: '2026-08-28' }),
      makeFilm({ id: 2, titleRu: 'Раньше', releaseDate: '2026-08-03' }),
    ];

    groupByMonth(films, byReleaseDate);

    expect(titles(films)).toEqual(['Позже', 'Раньше']);
  });
});
