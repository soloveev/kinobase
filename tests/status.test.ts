// Критерий приёмки 4 версии v2 на уровне доменной логики: вышедший без отметки —
// «буду смотреть», вышедший с отметкой — «посмотрел», фильм без даты выхода считается вышедшим.
//
// Дополнение v5, критерии приёмки 10, 11, 12, 5 и 6:
// 10 — снятая галочка «хочу посмотреть» у непросмотренного тайтла переводит его в «Другое»,
//      поставленная возвращает в «Буду смотреть» (вышел) или «Ждём» (не вышел);
// 11 — невышедший тайтл без галочки «хочу посмотреть» — «Другое», а не «Ждём»;
// 12 — счётчик «Все» равен числу тайтлов в базе, остальные счётчики показывают состав таба;
// 5, 6 — состав таба «Ждём» шире своего статуса: туда же попадает сериал, ждущий нового
//      сезона, в том числе уже просмотренный.
//
// Контракт v5 ('@/lib/status'):
//   type FilmStatus = 'watched' | 'will-watch' | 'waiting' | 'other';
//   STATUS_LABELS.other === 'Другое';
//   function filmStatus(film: { releaseDate; watched; wantToWatch }, today): FilmStatus;
//   function isAwaited(film, today): boolean;
//   function statusCounts(films: Film[], today): Record<StatusFilter, number>;
//
// «Сегодня» всегда передаётся аргументом (ISO 'YYYY-MM-DD'), поэтому тесты детерминированы
// и не мокают Date.

import { describe, it, expect } from 'vitest';
import {
  filmStatus,
  isAwaited,
  isReleased,
  statusCounts,
  todayIso,
  STATUS_LABELS,
} from '@/lib/status';
import { makeFilm } from './helpers';

const TODAY = '2026-08-22';
const RELEASED = '2001-04-11';
const NOT_RELEASED = '2030-01-01';

describe('filmStatus: отметка о просмотре главнее всего', () => {
  it('вышедший ранее фильм с отметкой — «посмотрел»', () => {
    expect(filmStatus({ releaseDate: RELEASED, watched: true, wantToWatch: true }, TODAY)).toBe(
      'watched',
    );
  });

  it('фильм, вышедший сегодня, с отметкой — «посмотрел»', () => {
    expect(filmStatus({ releaseDate: TODAY, watched: true, wantToWatch: false }, TODAY)).toBe(
      'watched',
    );
  });

  it('фильм без даты выхода с отметкой — «посмотрел»', () => {
    expect(filmStatus({ releaseDate: null, watched: true, wantToWatch: false }, TODAY)).toBe(
      'watched',
    );
  });

  // Порядок проверок изменился: раньше «не вышел» побеждало всё. Держится это
  // на правиле «нельзя отметить просмотренным невышедший фильм» — оно остаётся в силе.
  it('отметка о просмотре главнее даты выхода', () => {
    expect(filmStatus({ releaseDate: NOT_RELEASED, watched: true, wantToWatch: true }, TODAY)).toBe(
      'watched',
    );
  });

  it('снятая галочка «хочу посмотреть» просмотренный фильм из «Посмотрел» не уводит', () => {
    expect(filmStatus({ releaseDate: RELEASED, watched: true, wantToWatch: false }, TODAY)).toBe(
      'watched',
    );
  });
});

describe('filmStatus: «хочу посмотреть» у непросмотренного (критерий 10)', () => {
  it('вышедший фильм с галочкой — «буду смотреть»', () => {
    expect(filmStatus({ releaseDate: RELEASED, watched: false, wantToWatch: true }, TODAY)).toBe(
      'will-watch',
    );
  });

  it('фильм, вышедший сегодня, с галочкой — «буду смотреть»', () => {
    expect(filmStatus({ releaseDate: TODAY, watched: false, wantToWatch: true }, TODAY)).toBe(
      'will-watch',
    );
  });

  it('фильм без даты выхода с галочкой — «буду смотреть»: он считается вышедшим', () => {
    expect(filmStatus({ releaseDate: null, watched: false, wantToWatch: true }, TODAY)).toBe(
      'will-watch',
    );
  });

  it('невышедший фильм с галочкой — «ждём»', () => {
    expect(filmStatus({ releaseDate: NOT_RELEASED, watched: false, wantToWatch: true }, TODAY)).toBe(
      'waiting',
    );
  });

  it('в день выхода фильм с галочкой сам переходит из «ждём» в «буду смотреть»', () => {
    const film = { releaseDate: '2026-08-22', watched: false, wantToWatch: true };

    expect(filmStatus(film, '2026-08-21')).toBe('waiting');
    expect(filmStatus(film, '2026-08-22')).toBe('will-watch');
  });
});

describe('filmStatus: «Другое» (критерии 10 и 11)', () => {
  it('вышедший фильм без галочки «хочу посмотреть» — «другое»', () => {
    expect(filmStatus({ releaseDate: RELEASED, watched: false, wantToWatch: false }, TODAY)).toBe(
      'other',
    );
  });

  it('невышедший фильм без галочки — «другое», а не «ждём» (критерий 11)', () => {
    expect(
      filmStatus({ releaseDate: NOT_RELEASED, watched: false, wantToWatch: false }, TODAY),
    ).toBe('other');
  });

  it('фильм без даты выхода и без галочки — «другое»', () => {
    expect(filmStatus({ releaseDate: null, watched: false, wantToWatch: false }, TODAY)).toBe(
      'other',
    );
  });

  it('галочка переводит тайтл из «другого» обратно в рабочий список', () => {
    const released = { releaseDate: RELEASED, watched: false };
    const upcoming = { releaseDate: NOT_RELEASED, watched: false };

    expect(filmStatus({ ...released, wantToWatch: false }, TODAY)).toBe('other');
    expect(filmStatus({ ...released, wantToWatch: true }, TODAY)).toBe('will-watch');
    expect(filmStatus({ ...upcoming, wantToWatch: false }, TODAY)).toBe('other');
    expect(filmStatus({ ...upcoming, wantToWatch: true }, TODAY)).toBe('waiting');
  });
});

describe('STATUS_LABELS', () => {
  it('четвёртый статус подписан «Другое» — плашка описывает один тайтл', () => {
    expect(STATUS_LABELS.other).toBe('Другое');
  });

  it('прежние три подписи не изменились', () => {
    expect(STATUS_LABELS.watched).toBe('Посмотрел');
    expect(STATUS_LABELS['will-watch']).toBe('Буду смотреть');
    expect(STATUS_LABELS.waiting).toBe('Ждём');
  });
});

describe('isAwaited: состав таба «Ждём» (критерии 5, 6, 11)', () => {
  it('невышедший тайтл с галочкой «хочу посмотреть» — ждём', () => {
    const film = makeFilm({
      id: 1,
      titleRu: 'Премьера впереди',
      releaseDate: NOT_RELEASED,
      wantToWatch: true,
    });

    expect(isAwaited(film, TODAY)).toBe(true);
  });

  it('невышедший тайтл без галочки не ждём: он в «Других» (критерий 11)', () => {
    const film = makeFilm({
      id: 2,
      titleRu: 'Ссылка из рецензии',
      releaseDate: NOT_RELEASED,
      wantToWatch: false,
    });

    expect(isAwaited(film, TODAY)).toBe(false);
  });

  it('просмотренный сериал с объявленным сезоном ждём (критерий 6)', () => {
    const film = makeFilm({
      id: 3,
      titleRu: 'Проклятие',
      releaseDate: '2023-11-10',
      tags: ['series'],
      watched: true,
      wantToWatch: false,
      seasonsReleased: 2,
      nextSeasonNumber: 3,
      nextSeasonDate: '2027-03',
    });

    expect(isAwaited(film, TODAY)).toBe(true);
  });

  it('непросмотренный сериал с галочкой и объявленным сезоном тоже ждём', () => {
    const film = makeFilm({
      id: 4,
      titleRu: 'Мебельная компания',
      releaseDate: '2023-11-10',
      tags: ['series'],
      wantToWatch: true,
      seasonsReleased: 1,
      nextSeasonNumber: 2,
    });

    expect(isAwaited(film, TODAY)).toBe(true);
  });

  it('сериал из «Других» с объявленным сезоном не ждём: он мне не интересен', () => {
    const film = makeFilm({
      id: 5,
      titleRu: 'Чужой сериал',
      releaseDate: '2023-11-10',
      tags: ['series'],
      watched: false,
      wantToWatch: false,
      seasonsReleased: 1,
      nextSeasonNumber: 2,
    });

    expect(isAwaited(film, TODAY)).toBe(false);
  });

  it('вышедший сериал без объявленного сезона не ждём даже при галочке', () => {
    const film = makeFilm({
      id: 6,
      titleRu: 'Законченный сериал',
      releaseDate: '2023-11-10',
      tags: ['series'],
      wantToWatch: true,
      seasonsReleased: 3,
    });

    expect(isAwaited(film, TODAY)).toBe(false);
  });

  it('просмотренный фильм без продолжения не ждём', () => {
    const film = makeFilm({
      id: 7,
      titleRu: 'Просмотренный',
      releaseDate: RELEASED,
      watched: true,
      wantToWatch: true,
    });

    expect(isAwaited(film, TODAY)).toBe(false);
  });
});

describe('statusCounts (критерии 12, 6)', () => {
  const films = [
    makeFilm({ id: 1, titleRu: 'Просмотренный', releaseDate: RELEASED, watched: true }),
    makeFilm({
      id: 2,
      titleRu: 'В планах',
      releaseDate: RELEASED,
      wantToWatch: true,
    }),
    makeFilm({
      id: 3,
      titleRu: 'Премьера впереди',
      releaseDate: NOT_RELEASED,
      wantToWatch: true,
    }),
    makeFilm({
      id: 4,
      titleRu: 'Ссылка из рецензии',
      releaseDate: RELEASED,
      wantToWatch: false,
    }),
    makeFilm({
      id: 5,
      titleRu: 'Проклятие',
      releaseDate: '2023-11-10',
      tags: ['series'],
      watched: true,
      wantToWatch: true,
      seasonsReleased: 2,
      nextSeasonNumber: 3,
      nextSeasonDate: '2027-03',
    }),
  ];

  it('счётчик «Все» равен числу тайтлов в базе', () => {
    expect(statusCounts(films, TODAY).all).toBe(5);
  });

  it('счётчики трёх обычных табов равны числу тайтлов своего статуса', () => {
    const counts = statusCounts(films, TODAY);

    expect(counts.watched).toBe(2);
    expect(counts['will-watch']).toBe(1);
    expect(counts.other).toBe(1);
  });

  it('счётчик «Ждём» считает состав таба, а не статус: просмотренный сериал в нём тоже', () => {
    expect(statusCounts(films, TODAY).waiting).toBe(2);
  });

  it('счётчики табов больше не складываются в общее число — это принято сознательно', () => {
    const counts = statusCounts(films, TODAY);
    const sum = counts.watched + counts['will-watch'] + counts.waiting + counts.other;

    expect(sum).toBeGreaterThan(counts.all);
  });

  it('на пустой базе все счётчики нулевые', () => {
    expect(statusCounts([], TODAY)).toEqual({
      all: 0,
      watched: 0,
      'will-watch': 0,
      waiting: 0,
      other: 0,
    });
  });
});

describe('isReleased', () => {
  it('дата в будущем — фильм не вышел', () => {
    expect(isReleased('2026-08-23', TODAY)).toBe(false);
  });

  it('дата сегодня — фильм вышел', () => {
    expect(isReleased(TODAY, TODAY)).toBe(true);
  });

  it('дата в прошлом — фильм вышел', () => {
    expect(isReleased('1999-12-31', TODAY)).toBe(true);
  });

  it('дата неизвестна — фильм считается вышедшим', () => {
    expect(isReleased(null, TODAY)).toBe(true);
  });
});

describe('todayIso', () => {
  it('возвращает текущую дату в формате YYYY-MM-DD', () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('пригодна как аргумент today: фильм с датой из далёкого прошлого уже вышел', () => {
    expect(isReleased('1970-01-01', todayIso())).toBe(true);
  });
});
