// Критерии приёмки 1, 2, 3, 4 и 8 версии v2 на уровне интерфейса таймлайна:
// 1 — фильмы показаны секциями по месяцам: заголовок «месяц + год», под ним сетка;
// 2 — секции идут от ближайшего месяца к дальнему, внутри секции — по дате, при равной дате по алфавиту;
// 3 — месяцев без фильмов между секциями нет;
// 4 — каждый фильм показывает дату выхода и открывается ссылкой на свою карточку;
// 8 — нумерация ячеек сквозная через все секции.
//
// Контракт из plan.md: <Timeline films={films} /> — default export из '@/components/Timeline',
// серверный компонент без хуков и без обращения к базе. Статус ячеек — всегда «ждём».
// Заголовок месяца форматирует formatMonthYearRu, регистр задаёт вёрстка, поэтому
// заголовки проверяются без учёта регистра.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import Timeline from '@/components/Timeline';
import { makeFilm } from './helpers';
import type { Film } from '@/db/schema';

afterEach(() => {
  cleanup();
});

/** Заголовки секций в порядке появления в разметке: из всех заголовков берём
 *  те, что выглядят как «месяц + год», — заголовки самих ячеек так не выглядят. */
function sectionHeadings(): string[] {
  const monthYear = /(январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)\S*\s+\d{4}/i;
  return screen
    .queryAllByRole('heading')
    .map((node) => node.textContent?.trim() ?? '')
    .filter((text) => monthYear.test(text));
}

/** Позиция первого вхождения текста в разметку — чтобы проверять взаимный порядок
 *  заголовков и фильмов, не завися от конкретных тегов секций. */
function positionOf(container: HTMLElement, needle: RegExp): number {
  const text = container.textContent ?? '';
  const found = text.search(needle);
  expect(found, `в разметке нет текста ${needle}`).toBeGreaterThanOrEqual(0);
  return found;
}

const augustFilms: Film[] = [
  makeFilm({ id: 1, titleRu: 'Августовский ранний', releaseDate: '2026-08-05' }),
  makeFilm({ id: 2, titleRu: 'Августовский поздний', releaseDate: '2026-08-28' }),
];

const decemberFilms: Film[] = [
  makeFilm({ id: 3, titleRu: 'Декабрьский', releaseDate: '2026-12-11' }),
];

describe('Timeline: секции месяцев', () => {
  it('показывает заголовок «месяц + год» для каждого месяца', () => {
    render(<Timeline films={[...augustFilms, ...decemberFilms]} />);

    const headings = sectionHeadings();

    expect(headings).toHaveLength(2);
    expect(headings[0]).toMatch(/август\s+2026/i);
    expect(headings[1]).toMatch(/декабр\S*\s+2026/i);
  });

  it('секции идут от ближайшего месяца к дальнему', () => {
    render(<Timeline films={[...decemberFilms, ...augustFilms]} />);

    const headings = sectionHeadings();

    expect(headings[0]).toMatch(/август/i);
    expect(headings[1]).toMatch(/декабр/i);
  });

  it('месяцы без фильмов не показываются', () => {
    render(<Timeline films={[...augustFilms, ...decemberFilms]} />);

    expect(sectionHeadings()).toHaveLength(2);
    expect(screen.queryByText(/сентябр\S*\s+2026/i)).toBeNull();
    expect(screen.queryByText(/октябр\S*\s+2026/i)).toBeNull();
    expect(screen.queryByText(/ноябр\S*\s+2026/i)).toBeNull();
  });

  it('переход через год: декабрь 2026 показан раньше февраля 2027', () => {
    render(
      <Timeline
        films={[
          makeFilm({ id: 1, titleRu: 'Февральский', releaseDate: '2027-02-11' }),
          makeFilm({ id: 2, titleRu: 'Декабрьский', releaseDate: '2026-12-25' }),
        ]}
      />,
    );

    const headings = sectionHeadings();

    expect(headings[0]).toMatch(/декабр\S*\s+2026/i);
    expect(headings[1]).toMatch(/феврал\S*\s+2027/i);
  });

  it('пустой список фильмов не даёт ни одной секции', () => {
    render(<Timeline films={[]} />);

    expect(sectionHeadings()).toEqual([]);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});

describe('Timeline: фильмы внутри секций', () => {
  it('каждый фильм стоит между заголовком своего месяца и следующим заголовком', () => {
    const { container } = render(<Timeline films={[...augustFilms, ...decemberFilms]} />);

    const august = positionOf(container, /август\s+2026/i);
    const december = positionOf(container, /декабр\S*\s+2026/i);
    const augustFilm = positionOf(container, /Августовский ранний/);
    const decemberFilm = positionOf(container, /Декабрьский/);

    expect(august).toBeLessThan(augustFilm);
    expect(augustFilm).toBeLessThan(december);
    expect(december).toBeLessThan(decemberFilm);
  });

  it('внутри месяца фильмы идут по дате выхода по возрастанию', () => {
    const { container } = render(<Timeline films={augustFilms} />);

    expect(positionOf(container, /Августовский ранний/)).toBeLessThan(
      positionOf(container, /Августовский поздний/),
    );
  });

  it('при одинаковой дате фильмы идут по алфавиту русского названия', () => {
    const { container } = render(
      <Timeline
        films={[
          makeFilm({ id: 1, titleRu: 'Ящерица', releaseDate: '2026-08-14' }),
          makeFilm({ id: 2, titleRu: 'Автобус', releaseDate: '2026-08-14' }),
        ]}
      />,
    );

    expect(positionOf(container, /Автобус/)).toBeLessThan(positionOf(container, /Ящерица/));
  });
});

describe('Timeline: ячейки', () => {
  it('нумерация сквозная: первая ячейка второй секции продолжает счёт', () => {
    render(<Timeline films={[...augustFilms, ...decemberFilms]} />);

    const numbers = screen
      .getAllByRole('link')
      .map((link) => within(link).getByText(/^\d{2}$/).textContent);

    expect(numbers).toEqual(['01', '02', '03']);
  });

  it('нумерация не сбрасывается и на третьей секции', () => {
    render(
      <Timeline
        films={[
          makeFilm({ id: 1, titleRu: 'Август', releaseDate: '2026-08-05' }),
          makeFilm({ id: 2, titleRu: 'Октябрь', releaseDate: '2026-10-05' }),
          makeFilm({ id: 3, titleRu: 'Декабрь один', releaseDate: '2026-12-05' }),
          makeFilm({ id: 4, titleRu: 'Декабрь два', releaseDate: '2026-12-06' }),
        ]}
      />,
    );

    const numbers = screen
      .getAllByRole('link')
      .map((link) => within(link).getByText(/^\d{2}$/).textContent);

    expect(numbers).toEqual(['01', '02', '03', '04']);
  });

  it('каждая ячейка — ссылка на карточку своего фильма', () => {
    render(<Timeline films={[...augustFilms, ...decemberFilms]} />);

    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'));

    expect(hrefs).toEqual(['/films/1', '/films/2', '/films/3']);
  });

  it('ячейка показывает пометку «Ждём» с датой выхода', () => {
    render(<Timeline films={decemberFilms} />);

    const cell = screen.getByRole('link');

    // Формат даты уточнён в v2.1: день и месяц словом, без года — год стоит
    // в заголовке секции таймлайна.
    expect(within(cell).getByText(/Ждём с 11 декабря/)).toBeInTheDocument();
  });
});
