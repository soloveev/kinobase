// Критерии приёмки 4 и 5 версии v3: на странице фильма теги показаны блоком в порядке
// «форма, вид, жанры, настроения», и клик по тегу открывает главную с соответствующим фильтром.
//
// Контракт из plan.md: <TagList tags={['series', 'animation', ...]} /> — default export
// из '@/components/TagList', серверный компонент без хуков и без обращения к базе.
// Единственный проп — машинные имена тегов тайтла; порядок показа задаёт сам компонент
// через sortTags, поэтому в тестах теги передаются вперемешку.
// Адреса ссылок собирает gridHref: жанр — /?genre=<slug>, форма — /?form=<slug>,
// вид — /?kind=<slug>. Настроения в v3 не фильтруются и ссылками не являются.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import TagList from '@/components/TagList';

afterEach(() => {
  cleanup();
});

/** Позиция первого вхождения текста в разметку — чтобы проверять порядок тегов,
 *  не завися от конкретных тегов вёрстки. */
function positionOf(container: HTMLElement, needle: string): number {
  const found = (container.textContent ?? '').indexOf(needle);
  expect(found, `в разметке нет текста «${needle}»`).toBeGreaterThanOrEqual(0);
  return found;
}

const mixed = ['folk-horror', 'horror', 'animation', 'series', 'drama'];

describe('TagList: порядок и названия (критерий 4)', () => {
  it('показывает русские названия тегов', () => {
    render(<TagList tags={mixed} />);

    for (const label of ['сериал', 'анимация', 'ужасы', 'драма', 'фольк-хоррор']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('порядок — форма, вид, жанры, настроения', () => {
    const { container } = render(<TagList tags={mixed} />);

    expect(positionOf(container, 'сериал')).toBeLessThan(positionOf(container, 'анимация'));
    expect(positionOf(container, 'анимация')).toBeLessThan(positionOf(container, 'ужасы'));
    expect(positionOf(container, 'драма')).toBeLessThan(positionOf(container, 'фольк-хоррор'));
  });

  it('порядок не зависит от того, как теги перечислены у тайтла', () => {
    const { container } = render(<TagList tags={[...mixed].reverse()} />);

    expect(positionOf(container, 'сериал')).toBeLessThan(positionOf(container, 'анимация'));
    expect(positionOf(container, 'анимация')).toBeLessThan(positionOf(container, 'драма'));
    expect(positionOf(container, 'драма')).toBeLessThan(positionOf(container, 'фольк-хоррор'));
  });

  it('минимальный набор — только форма и вид', () => {
    render(<TagList tags={['film', 'live-action']} />);

    expect(screen.getByText('фильм')).toBeInTheDocument();
    expect(screen.getByText('игровое')).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });
});

describe('TagList: ссылки на отфильтрованную главную (критерий 5)', () => {
  it('тег формы ведёт на главную с фильтром по форме', () => {
    render(<TagList tags={['series', 'live-action']} />);

    expect(screen.getByRole('link', { name: 'сериал' })).toHaveAttribute('href', '/?form=series');
  });

  it('тег вида ведёт на главную с фильтром по виду', () => {
    render(<TagList tags={['film', 'animation']} />);

    expect(screen.getByRole('link', { name: 'анимация' })).toHaveAttribute(
      'href',
      '/?kind=animation',
    );
  });

  it('тег жанра ведёт на главную с выбранным жанром', () => {
    render(<TagList tags={['film', 'live-action', 'horror']} />);

    expect(screen.getByRole('link', { name: 'ужасы' })).toHaveAttribute('href', '/?genre=horror');
  });

  it('каждый жанр ведёт на главную только со своим жанром', () => {
    render(<TagList tags={['film', 'live-action', 'horror', 'thriller']} />);

    expect(screen.getByRole('link', { name: 'ужасы' })).toHaveAttribute('href', '/?genre=horror');
    expect(screen.getByRole('link', { name: 'триллер' })).toHaveAttribute(
      'href',
      '/?genre=thriller',
    );
  });
});

describe('TagList: настроения', () => {
  it('тег настроения показан, но ссылкой не является', () => {
    render(<TagList tags={['film', 'live-action', 'folk-horror']} />);

    expect(screen.getByText('фольк-хоррор')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'фольк-хоррор' })).toBeNull();
  });

  it('в наборе из формы, вида, жанра и настроения ссылок ровно три', () => {
    render(<TagList tags={['film', 'live-action', 'horror', 'folk-horror']} />);

    expect(screen.getAllByRole('link')).toHaveLength(3);
  });
});

describe('TagList: пустой набор', () => {
  it('без тегов не рендерит ничего', () => {
    const { container } = render(<TagList tags={[]} />);

    expect(container.textContent?.trim()).toBe('');
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});
