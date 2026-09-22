// Критерии приёмки 1–4 версии v5 на уровне блока выходных данных карточки фильма:
// 1 — у сериала с заполненными сезонами блок показывает строку «Сезоны» сразу после даты
//     выхода, а в ней — по плашке на каждый сезон;
// 2 — вышедшие сезоны показаны одной формой, ожидаемый — другой; подписей и дат в строке нет;
// 3 — у сериала без объявленного продолжения ряд заканчивается последним вышедшим сезоном;
// 4 — у полнометражного кино блок выходных данных выглядит ровно как прежде.
//
// Контракт: <FilmFacts film={film} /> — default export из '@/components/FilmFacts'.
// Блок — список определений: подпись строки в <dt>, значение в <dd>. Заглавные буквы
// подписей — оформление (text-transform), поэтому в разметке они пишутся как в спеке.
//
// Значение строки «Сезоны» рендерит компонент SeasonPlaques из '@/components/plaques'
// (его собственные тесты — в plaques.test.tsx). Здесь проверяется наблюдаемое поведение
// блока: состав и порядок строк, сколько плашек и какие, как ряд представляется
// экранному диктору. Форма плашки — цвет и заливка — тестами не проверяется: за состояние
// отвечает атрибут data-state, за внешность — вёрстка.

import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, within } from '@testing-library/react';
import FilmFacts from '@/components/FilmFacts';
import { makeFilm } from './helpers';
import type { Film } from '@/db/schema';

afterEach(() => {
  cleanup();
});

/** Подписи строк блока по порядку сверху вниз. */
function labels(film: Film): string[] {
  const { container } = render(<FilmFacts film={film} />);
  return [...container.querySelectorAll('dt')].map((dt) => dt.textContent?.trim() ?? '');
}

/** Значение строки с заданной подписью; null — строки в блоке нет. */
function rowValue(film: Film, label: string): HTMLElement | null {
  const { container } = render(<FilmFacts film={film} />);
  for (const dt of container.querySelectorAll('dt')) {
    if ((dt.textContent ?? '').trim() === label) {
      return dt.nextElementSibling as HTMLElement | null;
    }
  }
  return null;
}

/** Ряд сезонных плашек как его видит читатель: номера по порядку и состояние каждой. */
function seasonRow(film: Film): { group: HTMLElement; plaques: { text: string; state: string }[] } {
  const value = rowValue(film, 'Сезоны');
  expect(value, 'в блоке нет строки «Сезоны»').not.toBeNull();

  const group = within(value!).getByRole('group');
  const plaques = [...group.querySelectorAll('[data-state]')].map((node) => ({
    text: (node.textContent ?? '').trim(),
    state: node.getAttribute('data-state') ?? '',
  }));

  return { group, plaques };
}

/** Весь текст блока — чтобы проверять, чего в нём быть не должно. */
function textOf(film: Film): string {
  const { container } = render(<FilmFacts film={film} />);
  return (container.textContent ?? '').replace(/\s+/g, ' ').trim();
}

const series = (overrides: Partial<Film> = {}): Film =>
  makeFilm({
    id: 1,
    titleRu: 'Проклятие',
    releaseDate: '2023-11-10',
    tags: ['series'],
    imdbRating: 7.9,
    kinopoiskRating: 8.1,
    ...overrides,
  });

const film = (overrides: Partial<Film> = {}): Film =>
  makeFilm({
    id: 2,
    titleRu: 'Одиссея',
    releaseDate: '2026-07-17',
    tags: ['film'],
    imdbRating: 8.4,
    kinopoiskRating: 7.9,
    ...overrides,
  });

describe('FilmFacts: строка «Сезоны» в блоке (критерий 1)', () => {
  it('показывается у сериала с заполненным числом сезонов', () => {
    expect(rowValue(series({ seasonsReleased: 2 }), 'Сезоны')).not.toBeNull();
  });

  it('встаёт сразу после даты выхода, перед внешними оценками', () => {
    expect(labels(series({ seasonsReleased: 2 }))).toEqual([
      'Дата выхода',
      'Сезоны',
      'IMDb',
      'Кинопоиск',
    ]);
  });

  it('строка одна — прежних двух строк о сезонах в блоке нет', () => {
    const rows = labels(series({ seasonsReleased: 2, nextSeasonNumber: 3, nextSeasonDate: '2027-03' }));

    expect(rows).toEqual(['Дата выхода', 'Сезоны', 'IMDb', 'Кинопоиск']);
    expect(rows).not.toContain('Сезонов вышло');
    expect(rows).not.toContain('Ждём сезон 3');
  });

  it('без числа вышедших сезонов строки нет, даже если объявлен следующий', () => {
    expect(rowValue(series(), 'Сезоны')).toBeNull();
    expect(rowValue(series({ nextSeasonNumber: 2 }), 'Сезоны')).toBeNull();
  });
});

describe('FilmFacts: ряд плашек (критерии 1, 2 и 3)', () => {
  it('по плашке на каждый вышедший сезон, номера по порядку', () => {
    const { plaques } = seasonRow(series({ seasonsReleased: 3 }));

    expect(plaques.map((p) => p.text)).toEqual(['1', '2', '3']);
  });

  it('вышедшие сезоны помечены как вышедшие', () => {
    const { plaques } = seasonRow(series({ seasonsReleased: 3 }));

    expect(plaques.map((p) => p.state)).toEqual(['released', 'released', 'released']);
  });

  it('объявленный сезон добавляет к ряду ещё одну плашку — ожидаемую (критерий 2)', () => {
    const { plaques } = seasonRow(series({ seasonsReleased: 2, nextSeasonNumber: 3 }));

    expect(plaques).toEqual([
      { text: '1', state: 'released' },
      { text: '2', state: 'released' },
      { text: '3', state: 'awaited' },
    ]);
  });

  it('ожидаемая плашка одна и стоит последней', () => {
    const { plaques } = seasonRow(series({ seasonsReleased: 4, nextSeasonNumber: 5 }));

    expect(plaques.filter((p) => p.state === 'awaited')).toHaveLength(1);
    expect(plaques[plaques.length - 1]).toEqual({ text: '5', state: 'awaited' });
  });

  it('без объявленного продолжения ряд заканчивается последним вышедшим (критерий 3)', () => {
    const { plaques } = seasonRow(series({ seasonsReleased: 3 }));

    expect(plaques).toHaveLength(3);
    expect(plaques.some((p) => p.state === 'awaited')).toBe(false);
  });

  it('дата объявленного сезона на состав ряда не влияет', () => {
    const withDate = seasonRow(
      series({ seasonsReleased: 2, nextSeasonNumber: 3, nextSeasonDate: '2027-03-12' }),
    );
    const withoutDate = seasonRow(series({ seasonsReleased: 2, nextSeasonNumber: 3 }));

    expect(withDate.plaques).toEqual(withoutDate.plaques);
  });

  it('единственный вышедший сезон — одна плашка', () => {
    const { plaques } = seasonRow(series({ seasonsReleased: 1 }));

    expect(plaques).toEqual([{ text: '1', state: 'released' }]);
  });
});

describe('FilmFacts: ряд для экранного диктора (критерий 1)', () => {
  it('с объявленным сезоном ряд представляется словами', () => {
    const { group } = seasonRow(series({ seasonsReleased: 2, nextSeasonNumber: 3 }));

    expect(group).toHaveAccessibleName('Сезоны: вышло 2, ждём 3-й');
  });

  it('без объявленного сезона диктору называют только вышедшие', () => {
    const { group } = seasonRow(series({ seasonsReleased: 2 }));

    expect(group).toHaveAccessibleName('Сезоны: вышло 2');
  });

  it('числа в имени — настоящие, а не образец из спеки', () => {
    const { group } = seasonRow(series({ seasonsReleased: 4, nextSeasonNumber: 5 }));

    expect(group).toHaveAccessibleName('Сезоны: вышло 4, ждём 5-й');
  });
});

describe('FilmFacts: в строке нет ни подписей, ни дат (критерий 2)', () => {
  const withSeason = () =>
    series({ seasonsReleased: 2, nextSeasonNumber: 3, nextSeasonDate: '2027-03-12' });

  it('прежних словесных подписей в блоке не осталось', () => {
    const text = textOf(withSeason());

    expect(text).not.toMatch(/Сезонов вышло/i);
    expect(text).not.toMatch(/Ждём сезон/i);
    expect(text).not.toMatch(/дата неизвестна/i);
  });

  it('даты следующего сезона в блоке нет — её несёт плашка в таймлайне', () => {
    const text = textOf(withSeason());

    expect(text).not.toMatch(/2027/);
    expect(text).not.toMatch(/март/i);
  });

  it('у сезона без даты в блоке тоже ничего не дописывается', () => {
    const { plaques } = seasonRow(series({ seasonsReleased: 2, nextSeasonNumber: 3 }));

    expect(plaques.map((p) => p.text).join('')).toBe('123');
  });

  it('дата выхода при этом остаётся на месте и полной', () => {
    const value = rowValue(withSeason(), 'Дата выхода');

    expect(value?.textContent?.trim()).toBe('10 ноября 2023');
  });
});

describe('FilmFacts: полнометражное кино (критерий 4)', () => {
  it('блок выглядит ровно как прежде: дата выхода, IMDb, Кинопоиск', () => {
    expect(labels(film())).toEqual(['Дата выхода', 'IMDb', 'Кинопоиск']);
  });

  it('строки о сезонах в блоке нет', () => {
    expect(rowValue(film(), 'Сезоны')).toBeNull();
    expect(textOf(film())).not.toMatch(/сезон/i);
  });

  it('дата выхода по-прежнему полная, с годом', () => {
    expect(rowValue(film(), 'Дата выхода')?.textContent?.trim()).toBe('17 июля 2026');
  });
});
