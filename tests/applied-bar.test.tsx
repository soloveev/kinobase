// Критерии приёмки 17–22 версии v13 «Отбор» — строка применённого под шапкой:
// 17 — при пустом отборе строки в разметке нет;
// 19 — счёт называет число отобранных и число тайтлов в табе;
// 20 — у каждой плашки есть ссылка, снимающая только этот фильтр и сохраняющая
//      остальные, таб и сортировку;
// 21 — «Сбросить всё» ведёт на адрес текущего таба и сортировки без единого фильтра;
// 22 — порядок плашек: жанры, форма, вид, вкус, оценка, разбор.
//
// Критерий 18 (строка видна и при свёрнутой панели, и при раскрытой) живёт в
// tests/filters-disclosure.test.tsx: он про хромировку, а не про саму строку.
//
// Контракт (spec.md, раздел E; plan.md, раздел 5):
//   <AppliedBar status={StatusFilter} sort={SortMode} filters={Filters}
//               shown={number} total={number} />
//   default export из '@/components/AppliedBar', серверный компонент;
//   при countFilters(filters) === 0 возвращает null — не пустую полосу.
//
// Подписи плашек и состав «без этого фильтра» собирает appliedChips из '@/lib/filters',
// и тесты берут их оттуда, а не переписывают словами: разойтись подписи строки и подписи
// пустого состояния страницы не должны (plan.md, раздел 1).

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import AppliedBar from '@/components/AppliedBar';
import { appliedChips, EMPTY_FILTERS, type Filters } from '@/lib/filters';
import { gridHref, type StatusFilter } from '@/lib/url-state';
import type { SortMode } from '@/lib/sort';

afterEach(() => {
  cleanup();
});

const filters = (overrides: Partial<Filters> = {}): Filters => ({
  ...EMPTY_FILTERS,
  ...overrides,
});

const ALL = filters({
  genres: ['horror', 'comedy'],
  form: 'series',
  kind: 'animation',
  taste: true,
  rating: 8,
  dossier: 'yes',
});

function renderBar(
  overrides: {
    status?: StatusFilter;
    sort?: SortMode;
    filters?: Filters;
    shown?: number;
    total?: number;
  } = {},
) {
  return render(
    <AppliedBar
      status={overrides.status ?? 'all'}
      sort={overrides.sort ?? 'date'}
      filters={overrides.filters ?? filters({ genres: ['horror'] })}
      shown={overrides.shown ?? 3}
      total={overrides.total ?? 42}
    />,
  );
}

/** Текст строки без оглядки на то, как он разбит по элементам. */
const textOf = (container: HTMLElement): string =>
  (container.textContent ?? '').replace(/\s+/g, ' ').trim();

const hrefs = (): string[] =>
  screen.queryAllByRole('link').map((link) => link.getAttribute('href') ?? '');

describe('AppliedBar: строка видна только при отборе (критерий 17)', () => {
  it('при пустом отборе в разметке ничего нет', () => {
    const { container } = renderBar({ filters: EMPTY_FILTERS });

    expect(container).toBeEmptyDOMElement();
  });

  it('пустая полоса не рисуется даже ради ровной высоты шапки', () => {
    renderBar({ filters: EMPTY_FILTERS });

    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryByText(/отобрано/i)).toBeNull();
  });

  it('при одном применённом фильтре строка появляется', () => {
    const { container } = renderBar({ filters: filters({ rating: 'none' }) });

    expect(container).not.toBeEmptyDOMElement();
  });

  it('строка появляется от любой из шести групп', () => {
    for (const one of [
      filters({ genres: ['horror'] }),
      filters({ form: 'film' }),
      filters({ kind: 'animation' }),
      filters({ taste: true }),
      filters({ rating: 5 }),
      filters({ dossier: 'no' }),
    ]) {
      const { container, unmount } = renderBar({ filters: one });

      expect(container, JSON.stringify(one)).not.toBeEmptyDOMElement();
      unmount();
    }
  });
});

describe('AppliedBar: счёт отобранного (критерий 19)', () => {
  it('называет число отобранных и число тайтлов в табе', () => {
    const { container } = renderBar({ shown: 7, total: 132 });

    expect(textOf(container)).toContain('Отобрано 7 из 132');
  });

  it('числа настоящие, а не образец из спеки', () => {
    const { container } = renderBar({ shown: 1, total: 2 });

    expect(textOf(container)).toContain('Отобрано 1 из 2');
  });

  it('пустой результат отбора тоже называется числом', () => {
    const { container } = renderBar({ shown: 0, total: 55 });

    expect(textOf(container)).toContain('Отобрано 0 из 55');
  });
});

describe('AppliedBar: плашки выбранного (критерии 20 и 22)', () => {
  it('в строке есть плашка на каждый применённый фильтр', () => {
    const { container } = renderBar({ filters: ALL });
    const text = textOf(container);

    for (const chip of appliedChips(ALL)) {
      expect(text, `плашка «${chip.label}»`).toContain(chip.label);
    }
  });

  it('порядок плашек: жанры, форма, вид, вкус, оценка, разбор (критерий 22)', () => {
    const { container } = renderBar({ filters: ALL });
    const text = textOf(container);
    const positions = appliedChips(ALL).map((chip) => text.indexOf(chip.label));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('подписи взяты из appliedChips, а не переписаны в вёрстке', () => {
    const { container } = renderBar({ filters: ALL });
    const text = textOf(container);

    expect(text).toContain('ужасы');
    expect(text).toContain('сериалы');
    expect(text).toContain('анимация');
    expect(text).toContain('по вкусу');
    expect(text).toContain('оценка 8+');
    expect(text).toContain('с разбором');
  });

  it('у каждой плашки есть ссылка, снимающая только её (критерий 20)', () => {
    renderBar({ status: 'watched', sort: 'rating', filters: ALL });
    const links = hrefs();

    for (const chip of appliedChips(ALL)) {
      expect(links, `плашка «${chip.label}»`).toContain(
        gridHref('watched', 'rating', chip.without),
      );
    }
  });

  it('снятие жанра сохраняет второй жанр и остальные группы', () => {
    renderBar({ filters: ALL });
    const comedy = appliedChips(ALL).find((chip) => chip.label === 'комедия')!;
    const params = new URL(
      gridHref('all', 'date', comedy.without),
      'http://localhost',
    ).searchParams;

    expect(hrefs()).toContain(gridHref('all', 'date', comedy.without));
    expect(params.get('genre')).toBe('horror');
    expect(params.get('form')).toBe('series');
    expect(params.get('rating')).toBe('8');
  });

  it('снятие плашки сохраняет таб и сортировку', () => {
    renderBar({ status: 'other', sort: 'rating', filters: filters({ taste: true }) });

    const params = new URL(hrefs()[0], 'http://localhost').searchParams;

    expect(params.get('status')).toBe('other');
    expect(params.get('sort')).toBe('rating');
    expect(params.has('taste')).toBe(false);
  });

  it('«без оценки» и «без разбора» тоже снимаются по отдельности', () => {
    const set = filters({ rating: 'none', dossier: 'no' });
    renderBar({ filters: set });
    const links = hrefs();

    for (const chip of appliedChips(set)) {
      expect(links, `плашка «${chip.label}»`).toContain(gridHref('all', 'date', chip.without));
    }
  });

  // Плашка вкуса несёт звезду — тем же авторским SVG, что в сетке (spec.md, раздел E).
  // Найти именно её плашку разметкой сложнее, чем прочитать текст: поднимаемся от подписи
  // до ближайшего предка, внутри которого лежит ссылка-крестик.
  it('плашка вкуса несёт звезду', () => {
    renderBar({ filters: filters({ taste: true }) });

    let node: HTMLElement = screen.getByText('по вкусу');
    while (node.parentElement && node.querySelectorAll('a').length === 0) {
      node = node.parentElement;
    }

    expect(node.querySelector('svg')).not.toBeNull();
  });

  it('крестик — авторский SVG, а не юникодный знак умножения', () => {
    const { container } = renderBar({ filters: filters({ genres: ['horror'] }) });

    expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
    expect(textOf(container)).not.toContain('×');
    expect(textOf(container)).not.toContain('✕');
  });
});

describe('AppliedBar: «Сбросить всё» (критерий 21)', () => {
  const reset = () => screen.getByRole('link', { name: /сбросить вс[её]/i });

  it('ссылка есть, когда строка показана', () => {
    renderBar({ filters: ALL });

    expect(reset()).toBeInTheDocument();
  });

  it('ведёт на адрес текущего таба и сортировки без единого фильтра', () => {
    renderBar({ status: 'watched', sort: 'rating', filters: ALL });

    expect(reset()).toHaveAttribute('href', gridHref('watched', 'rating', EMPTY_FILTERS));
  });

  it('в адресе сброса нет ни одного параметра отбора', () => {
    renderBar({ status: 'watched', sort: 'rating', filters: ALL });
    const params = new URL(reset().getAttribute('href') ?? '', 'http://localhost').searchParams;

    for (const key of ['genre', 'form', 'kind', 'taste', 'rating', 'dossier']) {
      expect(params.has(key), `параметр «${key}»`).toBe(false);
    }
    expect(params.get('status')).toBe('watched');
    expect(params.get('sort')).toBe('rating');
  });

  it('в табе «Все» с сортировкой по умолчанию сброс ведёт на чистый адрес', () => {
    renderBar({ filters: ALL });

    expect(reset()).toHaveAttribute('href', '/');
  });
});
