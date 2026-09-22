// Критерии приёмки 12 и 13 версии v13 «Отбор» — рампа фильтра по моей оценке:
// 12 — ссылка ступени N ведёт на адрес с rating=N, а ссылка уже выбранной ступени —
//      на адрес без rating (щелчок по выбранной ступени снимает фильтр);
// 13 — ступени от выбранной и выше помечены как выбранные (aria-current), ступени ниже — нет.
//
// Контракт (spec.md, раздел C; plan.md, раздел 3):
//   <RatingRamp status={StatusFilter} sort={SortMode} filters={Filters} />
//   default export из '@/components/RatingRamp', серверный компонент: десять ссылок,
//   у каждой aria-label «Оценка N и выше», адрес собирает gridHref.
//
// «Без оценки» — не нулевая ступень, а другой вопрос, и стоит он текстом рядом со шкалой;
// проверяется он в tests/filters-panel.test.tsx вместе с подписью «и выше»: спека и план
// не говорят, чьей разметке они принадлежат — рампы или группы, — а проверять надо то,
// что видит читатель, а не то, чей это файл.
//
// Показ выбранного (spec.md, раздел C): ступени от порога и выше несут чернильный контур —
// тот же знак, которым помечена выбранная ступень оценки в карточке (критерий 30), — а ступени
// ниже приглушаются. Стиль здесь проверяется по той же причине, что и в критериях 26–30:
// предмет проверки и есть вычисленный стиль, и берётся он из общих ratingStyle/ratingPickStyle,
// а не переписывается в тесте формулой.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import RatingRamp from '@/components/RatingRamp';
import { ratingPickStyle, ratingStyle } from '@/components/plaques';
import { EMPTY_FILTERS, type Filters } from '@/lib/filters';
import type { StatusFilter } from '@/lib/url-state';
import type { SortMode } from '@/lib/sort';

afterEach(() => {
  cleanup();
});

function renderRamp(
  overrides: { status?: StatusFilter; sort?: SortMode; filters?: Partial<Filters> } = {},
) {
  return render(
    <RatingRamp
      status={overrides.status ?? 'all'}
      sort={overrides.sort ?? 'date'}
      filters={{ ...EMPTY_FILTERS, ...overrides.filters }}
    />,
  );
}

/** Ступени рампы в порядке разметки: у каждой имя «Оценка N и выше». */
const steps = (): HTMLElement[] => screen.getAllByRole('link', { name: /^Оценка \d+ и выше$/ });

const step = (value: number): HTMLElement =>
  screen.getByRole('link', { name: `Оценка ${value} и выше` });

const paramsOf = (element: HTMLElement): URLSearchParams =>
  new URL(element.getAttribute('href') ?? '', 'http://localhost').searchParams;

describe('RatingRamp: десять ступеней (критерий 12)', () => {
  it('в рампе ровно десять ступеней', () => {
    renderRamp();

    expect(steps()).toHaveLength(10);
  });

  it('ступени идут по возрастанию, от единицы к десятке', () => {
    renderRamp();

    expect(steps().map((link) => (link.textContent ?? '').trim())).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
    ]);
  });

  it('каждая ступень объясняет себя словами: «Оценка N и выше»', () => {
    renderRamp();

    for (let value = 1; value <= 10; value += 1) {
      expect(step(value)).toHaveAccessibleName(`Оценка ${value} и выше`);
    }
  });
});

describe('RatingRamp: адреса ступеней (критерий 12)', () => {
  it('ссылка ступени N ведёт на адрес с rating=N', () => {
    renderRamp();

    for (let value = 1; value <= 10; value += 1) {
      expect(paramsOf(step(value)).get('rating'), `ступень ${value}`).toBe(String(value));
    }
  });

  it('ссылка уже выбранной ступени ведёт на адрес без rating', () => {
    renderRamp({ filters: { rating: 8 } });

    expect(step(8)).toHaveAttribute('href', '/');
    expect(paramsOf(step(8)).has('rating')).toBe(false);
  });

  it('остальные ступени при выбранном пороге по-прежнему ведут на свой порог', () => {
    renderRamp({ filters: { rating: 8 } });

    expect(paramsOf(step(5)).get('rating')).toBe('5');
    expect(paramsOf(step(10)).get('rating')).toBe('10');
  });

  it('щелчок по ступени при выбранном «без оценки» ставит порог, а не снимает фильтр', () => {
    renderRamp({ filters: { rating: 'none' } });

    expect(paramsOf(step(7)).get('rating')).toBe('7');
  });

  it('таб, сортировка и остальные фильтры в адресах ступеней сохраняются', () => {
    renderRamp({
      status: 'watched',
      sort: 'rating',
      filters: { genres: ['horror', 'comedy'], form: 'series', kind: 'animation', taste: true },
    });

    const params = paramsOf(step(9));

    expect(params.get('status')).toBe('watched');
    expect(params.get('sort')).toBe('rating');
    expect(params.get('genre')).toBe('horror,comedy');
    expect(params.get('form')).toBe('series');
    expect(params.get('kind')).toBe('animation');
    expect(params.get('taste')).toBe('star');
    expect(params.get('rating')).toBe('9');
  });

  it('снятие порога остальные фильтры не трогает', () => {
    renderRamp({ status: 'other', filters: { genres: ['horror'], rating: 3 } });

    const params = paramsOf(step(3));

    expect(params.has('rating')).toBe(false);
    expect(params.get('genre')).toBe('horror');
    expect(params.get('status')).toBe('other');
  });

  it('разбор в адресах ступеней тоже сохраняется', () => {
    renderRamp({ filters: { dossier: 'yes' } });

    expect(paramsOf(step(6)).get('dossier')).toBe('yes');
  });
});

describe('RatingRamp: показ выбранного диапазона (критерий 13)', () => {
  const marked = (): number[] =>
    steps()
      .filter((link) => link.getAttribute('aria-current') === 'true')
      .map((link) => Number((link.textContent ?? '').trim()));

  it('без фильтра не помечена ни одна ступень', () => {
    renderRamp();

    expect(marked()).toEqual([]);
  });

  it('при пороге 8 помечены восьмёрка, девятка и десятка', () => {
    renderRamp({ filters: { rating: 8 } });

    expect(marked()).toEqual([8, 9, 10]);
  });

  it('ступени ниже порога не помечены', () => {
    renderRamp({ filters: { rating: 8 } });

    for (const value of [1, 2, 3, 4, 5, 6, 7]) {
      expect(step(value), `ступень ${value}`).not.toHaveAttribute('aria-current', 'true');
    }
  });

  it('при пороге 1 помечены все десять', () => {
    renderRamp({ filters: { rating: 1 } });

    expect(marked()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('при пороге 10 помечена одна десятка', () => {
    renderRamp({ filters: { rating: 10 } });

    expect(marked()).toEqual([10]);
  });

  // «Без оценки» — другой вопрос, а не нулевая ступень (spec.md, раздел C): порога он
  // не задаёт, и помечать в шкале ему нечего.
  it('при «без оценки» ни одна ступень шкалы не помечена', () => {
    renderRamp({ filters: { rating: 'none' } });

    expect(marked()).toEqual([]);
  });
});

describe('RatingRamp: чернильный контур и приглушение (раздел C)', () => {
  it('ступень от порога и выше несёт чернильный контур', () => {
    renderRamp({ filters: { rating: 8 } });

    for (const value of [8, 9, 10]) {
      expect(step(value).style.boxShadow, `ступень ${value}`).toBe(
        ratingPickStyle(value).boxShadow,
      );
    }
  });

  it('ступень ниже порога чернильного контура не несёт', () => {
    renderRamp({ filters: { rating: 8 } });

    for (const value of [1, 5, 7]) {
      expect(step(value).style.boxShadow, `ступень ${value}`).toBe(ratingStyle(value).boxShadow);
    }
  });

  it('ступень ниже порога приглушена, а от порога и выше — нет', () => {
    renderRamp({ filters: { rating: 8 } });

    const opacity = (value: number) => Number(step(value).style.opacity || '1');

    expect(opacity(7)).toBeLessThan(1);
    expect(opacity(8)).toBe(1);
    expect(opacity(10)).toBe(1);
  });

  it('без фильтра ни одна ступень не приглушена', () => {
    renderRamp();

    for (const link of steps()) {
      expect(Number(link.style.opacity || '1'), (link.textContent ?? '').trim()).toBe(1);
    }
  });

  it('заливка ступени — та же рампа, что у плашки оценки', () => {
    renderRamp();

    for (let value = 1; value <= 10; value += 1) {
      expect(step(value).style.background, `ступень ${value}`).toBe(ratingStyle(value).background);
    }
  });
});
