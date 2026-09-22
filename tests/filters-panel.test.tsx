// Критерии приёмки 6, 9 и 12 версии v3 на уровне содержимого раскрывающейся панели:
// 6 — панель содержит жанры со счётчиками, переключатели формы и вида и сортировку;
// 9 — жанр без тайтлов в текущем табе показан приглушённо и не выбирается;
// 12 — при выбранном фильтре в панели есть «сбросить всё», возвращающее полный список таба.
//
// Контракт (по plan.md, минимальный набор пропсов):
//   <FiltersPanel
//      status={status}              // StatusFilter: текущий таб — попадает в адреса ссылок
//      sort={sort}                  // SortMode: текущая сортировка — для адресов и SortSwitch
//      filters={filters}            // Filters: что выбрано сейчас
//      genreCounts={counts}         // Map<string, number>: сколько тайтлов у жанра в текущем табе
//   />
// default export из '@/components/FiltersPanel', серверный компонент без хуков и без базы
// (раскрытием панели ведает клиентский FiltersDisclosure).
//
// Дополнение v5, критерий приёмки 14: в панели появляется пятая группа — «Вкус»
// с двумя взаимоисключающими значениями («все» и «по моему вкусу»). Устроена как
// уже существующие «Форма» и «Вид»: значения — ссылки, состояние живёт в адресе (?taste=star).
//
// Разметка: каждая группа — <nav> с доступным именем «Жанры», «Форма», «Вид», «Вкус», «Сортировка»
// (как уже сделано в SortSwitch через aria-labelledby). Выбранный вариант помечен
// aria-current="true"; приглушённый жанр ссылкой не является и помечен aria-disabled="true".
// Адреса собирает gridHref: /?status=…&sort=…&genre=…&form=…&kind=…
//
// Дополнение v13 (31.08.2026), критерии приёмки 1–7 и 12–13 в части панели:
//  * панель становится таблицей в две колонки — подписи выключенной колонкой справа,
//    значения всех семи групп на одной вертикали (раздел A);
//  * групп семь и порядок у них твёрдый: Жанры, Форма, Вид, Вкус, Оценка, Разбор, Сортировка;
//  * жанры без тайтлов уходят в конец списка, внутри половин порядок словарный (раздел B);
//  * появляются группы «Оценка» (рампа «N и выше» плюс «без оценки») и «Разбор» (все · есть · нет).
//
// Раскладка как таковая тестами не проверяется: в jsdom Tailwind не загружен, вычисленных
// стилей у классов нет (CLAUDE.md, раздел «Тесты»). Поэтому критерии 1 и 3 проверяются
// двумя способами сразу — устройством разметки (строка панели содержит подпись и значения,
// строки идут прямыми детьми корня) и, там где иначе никак, именами классов. Это осознанное
// исключение, как в tests/plaques.test.tsx; настоящая проверка раскладки — живой прогон
// и `npm run measure-layout`.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import FiltersPanel from '@/components/FiltersPanel';
import type { Filters } from '@/lib/filters';
import { tagsOfCategory } from '@/lib/tags';
import type { StatusFilter } from '@/lib/url-state';
import type { SortMode } from '@/lib/sort';

afterEach(() => {
  cleanup();
});

/** Правка v13 от 31.08.2026: ~~четыре поля — genres, form, kind, taste~~. Спека v13,
 *  разделы C и D, добавила «Оценку» и «Разбор». */
const NO_FILTERS: Filters = {
  genres: [],
  form: null,
  kind: null,
  taste: false,
  rating: null,
  dossier: null,
};

/** Счётчики жанров текущего таба: перечислены только непустые жанры. */
const COUNTS = new Map<string, number>([
  ['horror', 3],
  ['thriller', 1],
  ['comedy', 12],
  ['drama', 7],
]);

function renderPanel(
  overrides: {
    status?: StatusFilter;
    sort?: SortMode;
    filters?: Filters;
    genreCounts?: Map<string, number>;
  } = {},
) {
  return render(
    <FiltersPanel
      status={overrides.status ?? 'all'}
      sort={overrides.sort ?? 'date'}
      filters={overrides.filters ?? NO_FILTERS}
      genreCounts={overrides.genreCounts ?? COUNTS}
    />,
  );
}

const group = (name: string) => screen.getByRole('navigation', { name });

/** Ссылка внутри группы по русскому названию варианта. */
const optionLink = (groupName: string, label: string) =>
  within(group(groupName)).getByRole('link', { name: new RegExp(label, 'i') });

describe('FiltersPanel: состав панели (критерий 6)', () => {
  // Правка v13 от 31.08.2026: ~~«в панели есть группы жанров, формы, вида, вкуса
  // и сортировки» — пять групп~~. Спека v13, разделы C и D (критерии 2, 8–16): между
  // «Вкусом» и «Сортировкой» встают «Оценка» и «Разбор», и групп стало семь.
  it('в панели есть все семь групп: жанры, форма, вид, вкус, оценка, разбор, сортировка', () => {
    renderPanel();

    expect(group('Жанры')).toBeInTheDocument();
    expect(group('Форма')).toBeInTheDocument();
    expect(group('Вид')).toBeInTheDocument();
    expect(group('Вкус')).toBeInTheDocument();
    expect(group('Оценка')).toBeInTheDocument();
    expect(group('Разбор')).toBeInTheDocument();
    expect(group('Сортировка')).toBeInTheDocument();
  });

  it('сортировка показывает оба режима', () => {
    renderPanel();

    const sort = group('Сортировка');

    expect(within(sort).getByRole('link', { name: /по дате выхода/i })).toBeInTheDocument();
    expect(within(sort).getByRole('link', { name: /по моей оценке/i })).toBeInTheDocument();
  });

  it('в группе жанров показаны жанры словаря — и пустые, и непустые', () => {
    renderPanel();

    const genres = group('Жанры');

    for (const label of ['боевик', 'комедия', 'ужасы', 'триллер', 'вестерн', 'мюзикл']) {
      expect(
        within(genres).queryAllByText(new RegExp(label, 'i')).length,
        `в панели нет жанра «${label}»`,
      ).toBeGreaterThan(0);
    }
  });
});

describe('FiltersPanel: жанры со счётчиками (критерий 6)', () => {
  it('у жанра показан счётчик тайтлов текущего таба', () => {
    renderPanel();

    expect(optionLink('Жанры', 'ужасы')).toHaveTextContent('3');
    expect(optionLink('Жанры', 'комедия')).toHaveTextContent('12');
  });

  it('невыбранный жанр ведёт на главную с этим жанром', () => {
    renderPanel();

    expect(optionLink('Жанры', 'ужасы')).toHaveAttribute('href', '/?genre=horror');
  });

  it('выбранный жанр помечен и снимается тем же кликом', () => {
    renderPanel({ filters: { ...NO_FILTERS, genres: ['horror'] } });

    const selected = optionLink('Жанры', 'ужасы');

    expect(selected).toHaveAttribute('aria-current', 'true');
    expect(selected).toHaveAttribute('href', '/');
  });

  it('к выбранному жанру второй добавляется, а не заменяет его', () => {
    renderPanel({ filters: { ...NO_FILTERS, genres: ['horror'] } });

    const href = optionLink('Жанры', 'триллер').getAttribute('href') ?? '';
    const genres = new URL(href, 'http://localhost').searchParams.get('genre')?.split(',') ?? [];

    expect([...genres].sort()).toEqual(['horror', 'thriller']);
  });

  it('таб и сортировка сохраняются в адресах жанров', () => {
    renderPanel({ status: 'watched', sort: 'rating' });

    const href = optionLink('Жанры', 'ужасы').getAttribute('href') ?? '';
    const params = new URL(href, 'http://localhost').searchParams;

    expect(params.get('status')).toBe('watched');
    expect(params.get('sort')).toBe('rating');
    expect(params.get('genre')).toBe('horror');
  });
});

describe('FiltersPanel: пустой жанр приглушён (критерий 9)', () => {
  it('жанр без тайтлов в текущем табе показан, но ссылкой не является', () => {
    renderPanel();

    const genres = group('Жанры');

    expect(within(genres).queryAllByText(/вестерн/i).length).toBeGreaterThan(0);
    expect(within(genres).queryByRole('link', { name: /вестерн/i })).toBeNull();
  });

  it('приглушённый жанр помечен как недоступный', () => {
    renderPanel();

    // Из всех совпадений берём последнее: обёртки в разметке идут раньше самого элемента.
    const matches = within(group('Жанры')).queryAllByText(/вестерн/i);
    const western = matches[matches.length - 1];

    expect(western.closest('[aria-disabled="true"]')).not.toBeNull();
  });

  it('жанры с тайтлами при этом кликаются', () => {
    renderPanel();

    expect(optionLink('Жанры', 'ужасы')).toBeInTheDocument();
    expect(optionLink('Жанры', 'драма')).toBeInTheDocument();
  });

  it('когда в табе нет ни одного тайтла, ни один жанр не кликается', () => {
    renderPanel({ genreCounts: new Map() });

    expect(within(group('Жанры')).queryAllByRole('link')).toHaveLength(0);
  });
});

describe('FiltersPanel: переключатели формы и вида (критерий 6)', () => {
  it('форма показывает «все», «фильмы» и «сериалы»', () => {
    renderPanel();

    const form = group('Форма');

    expect(within(form).getByRole('link', { name: /^все$/i })).toBeInTheDocument();
    expect(within(form).getByRole('link', { name: /фильмы/i })).toBeInTheDocument();
    expect(within(form).getByRole('link', { name: /сериалы/i })).toBeInTheDocument();
  });

  it('вид показывает «все», «игровое», «анимация» и «документальное»', () => {
    renderPanel();

    const kind = group('Вид');

    expect(within(kind).getByRole('link', { name: /^все$/i })).toBeInTheDocument();
    expect(within(kind).getByRole('link', { name: /игровое/i })).toBeInTheDocument();
    expect(within(kind).getByRole('link', { name: /анимация/i })).toBeInTheDocument();
    expect(within(kind).getByRole('link', { name: /документальное/i })).toBeInTheDocument();
  });

  it('по умолчанию в обеих группах выбрано «все»', () => {
    renderPanel();

    expect(optionLink('Форма', '^все$')).toHaveAttribute('aria-current', 'true');
    expect(optionLink('Вид', '^все$')).toHaveAttribute('aria-current', 'true');
  });

  it('выбранная форма помечена, «все» — уже нет', () => {
    renderPanel({ filters: { ...NO_FILTERS, form: 'series' } });

    expect(optionLink('Форма', 'сериалы')).toHaveAttribute('aria-current', 'true');
    expect(optionLink('Форма', '^все$')).not.toHaveAttribute('aria-current', 'true');
  });

  it('вариант формы ведёт на главную с этой формой, «все» — на главную без неё', () => {
    renderPanel({ filters: { ...NO_FILTERS, form: 'series' } });

    expect(optionLink('Форма', 'фильмы')).toHaveAttribute('href', '/?form=film');
    expect(optionLink('Форма', '^все$')).toHaveAttribute('href', '/');
  });

  it('вариант вида ведёт на главную с этим видом', () => {
    renderPanel();

    expect(optionLink('Вид', 'анимация')).toHaveAttribute('href', '/?kind=animation');
  });

  it('форма и вид не сбрасывают друг друга и выбранные жанры', () => {
    renderPanel({ filters: { ...NO_FILTERS, genres: ['horror'], kind: 'animation' } });

    const href = optionLink('Форма', 'сериалы').getAttribute('href') ?? '';
    const params = new URL(href, 'http://localhost').searchParams;

    expect(params.get('genre')).toBe('horror');
    expect(params.get('kind')).toBe('animation');
    expect(params.get('form')).toBe('series');
  });
});

// Критерий приёмки 14: группа «Вкус» — две взаимоисключающие ссылки.
describe('FiltersPanel: группа «Вкус» (критерий 14)', () => {
  it('показывает «все» и «по моему вкусу»', () => {
    renderPanel();

    const taste = group('Вкус');

    expect(within(taste).getByRole('link', { name: /^все$/i })).toBeInTheDocument();
    expect(within(taste).getByRole('link', { name: /по моему вкусу/i })).toBeInTheDocument();
  });

  it('по умолчанию выбрано «все»', () => {
    renderPanel();

    expect(optionLink('Вкус', '^все$')).toHaveAttribute('aria-current', 'true');
    expect(optionLink('Вкус', 'по моему вкусу')).not.toHaveAttribute('aria-current', 'true');
  });

  it('«по моему вкусу» ведёт на главную с параметром taste=star', () => {
    renderPanel();

    expect(optionLink('Вкус', 'по моему вкусу')).toHaveAttribute('href', '/?taste=star');
  });

  it('при выбранном вкусе помечен он, а «все» возвращает к полному списку', () => {
    renderPanel({ filters: { ...NO_FILTERS, taste: true } });

    expect(optionLink('Вкус', 'по моему вкусу')).toHaveAttribute('aria-current', 'true');
    expect(optionLink('Вкус', '^все$')).toHaveAttribute('href', '/');
  });

  it('вкус не сбрасывает жанры, форму и вид', () => {
    renderPanel({ filters: { ...NO_FILTERS, genres: ['horror'], form: 'series' } });

    const href = optionLink('Вкус', 'по моему вкусу').getAttribute('href') ?? '';
    const params = new URL(href, 'http://localhost').searchParams;

    expect(params.get('genre')).toBe('horror');
    expect(params.get('form')).toBe('series');
    expect(params.get('taste')).toBe('star');
  });

  it('выбранный вкус сохраняется в адресах других групп', () => {
    renderPanel({ filters: { ...NO_FILTERS, taste: true } });

    const href = optionLink('Форма', 'сериалы').getAttribute('href') ?? '';

    expect(new URL(href, 'http://localhost').searchParams.get('taste')).toBe('star');
  });

  it('таб и сортировка сохраняются в адресе вкуса', () => {
    renderPanel({ status: 'watched', sort: 'rating' });

    const href = optionLink('Вкус', 'по моему вкусу').getAttribute('href') ?? '';
    const params = new URL(href, 'http://localhost').searchParams;

    expect(params.get('status')).toBe('watched');
    expect(params.get('sort')).toBe('rating');
    expect(params.get('taste')).toBe('star');
  });
});

// Правка v13 от 31.08.2026. Прежняя редакция: ~~«сброс живёт в панели: без фильтров
// его нет, при любом выбранном появляется и ведёт на чистый адрес таба»~~ — пять тестов
// на критерий 12 версии v3. Отменена спекой v13, раздел «Доуточнения»: сброс переехал
// в строку применённого. Довод — оба сброса появлялись при одном и том же условии
// («применён хотя бы один фильтр») и всегда стояли на экране вместе, то есть это было
// не два пути к действию, а одно действие, нарисованное дважды. Проверка не исчезла,
// а переехала в tests/applied-bar.test.tsx (критерий 21), где заодно проверено, что
// сброс сохраняет таб и сортировку. Здесь остаётся сторож: в панели сброса нет.
describe('FiltersPanel: сброса в панели нет (правка v13 к критерию 12)', () => {
  const reset = () => screen.queryByRole('link', { name: /сбросить вс[её]/i });

  it('без выбранных фильтров сброса в панели нет', () => {
    renderPanel();

    expect(reset()).toBeNull();
  });

  it('при выбранных фильтрах сброса в панели тоже нет: он в строке применённого', () => {
    renderPanel({
      filters: {
        genres: ['horror', 'thriller'],
        form: 'series',
        kind: 'animation',
        taste: true,
        rating: 8,
        dossier: 'yes',
      },
    });

    expect(reset()).toBeNull();
  });
});

// ─── A. Раскладка полосы: подписи выключенной колонкой (критерии 1–4) ──────────
// Восстановлено 31.08.2026: вспомогательные функции были снесены вместе с блоком
// про сброс при правке под v13 — оставлены как были.

const GROUP_ORDER = ['Жанры', 'Форма', 'Вид', 'Вкус', 'Оценка', 'Разбор', 'Сортировка'];

/** Корень панели: единственный элемент, в который она рендерится. */
function panelRoot(container: HTMLElement): HTMLElement {
  const root = container.firstElementChild;
  expect(root, 'у панели должен быть один корневой элемент').not.toBeNull();
  return root as HTMLElement;
}

/** Подпись группы — элемент, на который указывает aria-labelledby её навигации. */
function labelOf(nav: HTMLElement): HTMLElement {
  const id = nav.getAttribute('aria-labelledby');
  expect(id, 'у группы должен быть aria-labelledby').not.toBeNull();
  const label = document.getElementById(id!);
  expect(label, `подписи с id «${id}» нет в разметке`).not.toBeNull();
  return label as HTMLElement;
}

/** Строка панели: сам nav либо ближайшая обёртка, лежащая прямым ребёнком корня.
 *  Обёртка допустима — линейку и колонки может нести и она. */
function rowOf(nav: HTMLElement, root: HTMLElement): HTMLElement {
  let node: HTMLElement = nav;
  while (node.parentElement && node.parentElement !== root) node = node.parentElement;
  expect(node.parentElement, 'строка группы должна лежать в корне панели').toBe(root);
  return node;
}

const classesOf = (element: Element): string[] =>
  (element.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);

/** Верхняя линейка строки: border-t сам по себе или с цветом. */
const hasTopRule = (element: Element): boolean =>
  classesOf(element).some((name) => /^border-t($|-)/.test(name));

/** Все навигации панели в порядке разметки. */
const navsInOrder = (): HTMLElement[] => screen.getAllByRole('navigation');

describe('FiltersPanel: раскладка таблицей (критерии 1 и 4)', () => {
  it('панель — сетка, а не строка значений с подписью первым словом (критерий 1)', () => {
    const { container } = renderPanel();

    expect(classesOf(panelRoot(container))).toContain('grid');
  });

  it('подписи всех семи групп выключены по правому краю (критерий 1)', () => {
    renderPanel();

    for (const name of GROUP_ORDER) {
      expect(classesOf(labelOf(group(name))), `подпись «${name}»`).toContain('text-right');
    }
  });

  it('каждая группа — отдельная строка панели, лежащая прямым ребёнком корня (критерий 1)', () => {
    const { container } = renderPanel();
    const root = panelRoot(container);
    const rows = GROUP_ORDER.map((name) => rowOf(group(name), root));

    expect(new Set(rows).size, 'две группы не могут делить одну строку').toBe(GROUP_ORDER.length);
  });

  it('каждая группа остаётся навигацией с именем (критерий 4)', () => {
    renderPanel();

    for (const name of GROUP_ORDER) {
      const nav = group(name);

      expect(nav.tagName, `группа «${name}»`).toBe('NAV');
      expect(nav).toHaveAttribute('aria-labelledby');
      expect(labelOf(nav)).toHaveTextContent(name);
    }
  });

  it('значения групп остаются ссылками (критерий 4)', () => {
    renderPanel();

    for (const name of GROUP_ORDER) {
      expect(
        within(group(name)).queryAllByRole('link').length,
        `в группе «${name}» нет ни одной ссылки`,
      ).toBeGreaterThan(0);
    }
  });
});

describe('FiltersPanel: порядок групп (критерий 2)', () => {
  it('группы идут: Жанры, Форма, Вид, Вкус, Оценка, Разбор, Сортировка', () => {
    renderPanel();

    expect(navsInOrder().map((nav) => (labelOf(nav).textContent ?? '').trim())).toEqual(
      GROUP_ORDER,
    );
  });

  it('сортировка остаётся последней: она не отбор', () => {
    renderPanel();

    const names = navsInOrder().map((nav) => (labelOf(nav).textContent ?? '').trim());

    expect(names[names.length - 1]).toBe('Сортировка');
  });

  it('без сортировки (таб «Ждём») порядок остальных шести не меняется', () => {
    render(
      <FiltersPanel
        status="waiting"
        sort="date"
        filters={NO_FILTERS}
        genreCounts={COUNTS}
        showSort={false}
      />,
    );

    expect(navsInOrder().map((nav) => (labelOf(nav).textContent ?? '').trim())).toEqual(
      GROUP_ORDER.filter((name) => name !== 'Сортировка'),
    );
  });
});

describe('FiltersPanel: hairline-линейка между строками (критерий 3)', () => {
  it('первая строка линейки не несёт', () => {
    const { container } = renderPanel();

    expect(hasTopRule(rowOf(group('Жанры'), panelRoot(container)))).toBe(false);
  });

  it('строки со второй несут линейку сверху', () => {
    const { container } = renderPanel();
    const root = panelRoot(container);

    for (const name of GROUP_ORDER.slice(1)) {
      expect(hasTopRule(rowOf(group(name), root)), `строка «${name}»`).toBe(true);
    }
  });
});

// ─── B. Жанры без тайтлов уходят в конец (критерии 5, 6 и 7) ────────────────────

/** Словарный порядок жанров — тот, что задаёт src/lib/tags.ts. */
const GENRE_LABELS = tagsOfCategory('genre').map((tag) => tag.label);

/** Названия жанров в том порядке, в каком они стоят в разметке. Счётчик из подписи
 *  отброшен: сравнивается порядок, а не оформление. */
function genresInOrder(): string[] {
  const nodes = group('Жанры').querySelectorAll('a, [aria-disabled="true"]');

  return [...nodes].map((node) => (node.textContent ?? '').replace(/\d+/g, '').trim());
}

describe('FiltersPanel: пустые жанры в конце списка (критерии 5 и 6)', () => {
  const filled = () => [...COUNTS.keys()].map((slug) => tagsOfCategory('genre').find((tag) => tag.slug === slug)!.label);

  it('в списке по-прежнему все жанры словаря', () => {
    renderPanel();

    expect([...genresInOrder()].sort()).toEqual([...GENRE_LABELS].sort());
  });

  it('жанры с нулевым счётчиком идут после всех жанров с ненулевым (критерий 5)', () => {
    renderPanel();

    const order = genresInOrder();
    const live = filled();
    const lastLive = Math.max(...live.map((label) => order.indexOf(label)));
    const firstEmpty = Math.min(
      ...order.filter((label) => !live.includes(label)).map((label) => order.indexOf(label)),
    );

    expect(lastLive).toBeLessThan(firstEmpty);
  });

  it('внутри половины с тайтлами порядок словарный (критерий 6)', () => {
    renderPanel();

    const live = filled();
    const order = genresInOrder().filter((label) => live.includes(label));

    expect(order).toEqual(GENRE_LABELS.filter((label) => live.includes(label)));
  });

  it('внутри половины без тайтлов порядок тоже словарный (критерий 6)', () => {
    renderPanel();

    const live = filled();
    const order = genresInOrder().filter((label) => !live.includes(label));

    expect(order).toEqual(GENRE_LABELS.filter((label) => !live.includes(label)));
  });

  it('когда тайтлы есть у всех жанров, порядок ровно словарный', () => {
    renderPanel({ genreCounts: new Map(tagsOfCategory('genre').map((tag) => [tag.slug, 1])) });

    expect(genresInOrder()).toEqual(GENRE_LABELS);
  });

  it('когда тайтлов нет ни у одного жанра, порядок тоже ровно словарный', () => {
    renderPanel({ genreCounts: new Map() });

    expect(genresInOrder()).toEqual(GENRE_LABELS);
  });
});

describe('FiltersPanel: выбор жанра порядок не меняет (критерий 7)', () => {
  it('список стоит на месте при выбранном жанре', () => {
    const { unmount } = renderPanel();
    const before = genresInOrder();
    unmount();

    renderPanel({ filters: { ...NO_FILTERS, genres: ['horror'] } });

    expect(genresInOrder()).toEqual(before);
  });

  it('и при нескольких выбранных жанрах тоже', () => {
    const { unmount } = renderPanel();
    const before = genresInOrder();
    unmount();

    renderPanel({ filters: { ...NO_FILTERS, genres: ['comedy', 'drama', 'thriller'] } });

    expect(genresInOrder()).toEqual(before);
  });

  it('выбор жанра, которого нет в счётчиках, порядка тоже не меняет', () => {
    const { unmount } = renderPanel();
    const before = genresInOrder();
    unmount();

    renderPanel({ filters: { ...NO_FILTERS, genres: ['western'] } });

    expect(genresInOrder()).toEqual(before);
  });
});

// ─── C и D в панели: группы «Оценка» и «Разбор» ─────────────────────────────────

describe('FiltersPanel: группа «Оценка» (критерии 12 и 13)', () => {
  const steps = () =>
    within(group('Оценка')).getAllByRole('link', { name: /^Оценка \d+ и выше$/ });

  it('рампа из десяти ступеней', () => {
    renderPanel();

    expect(steps()).toHaveLength(10);
  });

  it('рядом с рампой стоит подпись «и выше»', () => {
    renderPanel();

    expect(within(group('Оценка')).getByText(/и выше/i)).toBeInTheDocument();
  });

  it('отдельным значением стоит «без оценки»', () => {
    renderPanel();

    expect(
      within(group('Оценка')).getByRole('link', { name: /^без оценки$/i }),
    ).toBeInTheDocument();
  });

  it('«без оценки» ведёт на адрес с rating=none', () => {
    renderPanel();

    const href =
      within(group('Оценка'))
        .getByRole('link', { name: /^без оценки$/i })
        .getAttribute('href') ?? '';

    expect(new URL(href, 'http://localhost').searchParams.get('rating')).toBe('none');
  });

  it('выбранное «без оценки» помечено и снимается тем же щелчком', () => {
    renderPanel({ filters: { ...NO_FILTERS, rating: 'none' } });

    const none = within(group('Оценка')).getByRole('link', { name: /^без оценки$/i });

    expect(none).toHaveAttribute('aria-current', 'true');
    expect(none).toHaveAttribute('href', '/');
  });

  it('оценка не сбрасывает остальные фильтры, таб и сортировку', () => {
    renderPanel({
      status: 'watched',
      sort: 'rating',
      filters: { ...NO_FILTERS, genres: ['horror'], form: 'series' },
    });

    const href = steps()[7].getAttribute('href') ?? '';
    const params = new URL(href, 'http://localhost').searchParams;

    expect(params.get('status')).toBe('watched');
    expect(params.get('sort')).toBe('rating');
    expect(params.get('genre')).toBe('horror');
    expect(params.get('form')).toBe('series');
  });

  it('выбранная оценка сохраняется в адресах других групп', () => {
    renderPanel({ filters: { ...NO_FILTERS, rating: 8 } });

    const href = optionLink('Форма', 'сериалы').getAttribute('href') ?? '';

    expect(new URL(href, 'http://localhost').searchParams.get('rating')).toBe('8');
  });
});

describe('FiltersPanel: группа «Разбор» (критерий 14)', () => {
  it('показывает три значения: все, есть, нет', () => {
    renderPanel();

    const dossier = group('Разбор');

    expect(within(dossier).getByRole('link', { name: /^все$/i })).toBeInTheDocument();
    expect(within(dossier).getByRole('link', { name: /^есть$/i })).toBeInTheDocument();
    expect(within(dossier).getByRole('link', { name: /^нет$/i })).toBeInTheDocument();
  });

  it('по умолчанию выбрано «все»', () => {
    renderPanel();

    expect(optionLink('Разбор', '^все$')).toHaveAttribute('aria-current', 'true');
    expect(optionLink('Разбор', '^есть$')).not.toHaveAttribute('aria-current', 'true');
  });

  it('«есть» и «нет» ведут на адреса с dossier=yes и dossier=no', () => {
    renderPanel();

    expect(optionLink('Разбор', '^есть$')).toHaveAttribute('href', '/?dossier=yes');
    expect(optionLink('Разбор', '^нет$')).toHaveAttribute('href', '/?dossier=no');
  });

  it('при выбранном разборе помечен он, а «все» возвращает к полному списку', () => {
    renderPanel({ filters: { ...NO_FILTERS, dossier: 'yes' } });

    expect(optionLink('Разбор', '^есть$')).toHaveAttribute('aria-current', 'true');
    expect(optionLink('Разбор', '^все$')).toHaveAttribute('href', '/');
  });

  it('разбор не сбрасывает остальные фильтры', () => {
    renderPanel({ filters: { ...NO_FILTERS, genres: ['horror'], taste: true } });

    const params = new URL(
      optionLink('Разбор', '^есть$').getAttribute('href') ?? '',
      'http://localhost',
    ).searchParams;

    expect(params.get('genre')).toBe('horror');
    expect(params.get('taste')).toBe('star');
    expect(params.get('dossier')).toBe('yes');
  });

  it('выбранный разбор сохраняется в адресах других групп', () => {
    renderPanel({ filters: { ...NO_FILTERS, dossier: 'no' } });

    const href = optionLink('Вид', 'анимация').getAttribute('href') ?? '';

    expect(new URL(href, 'http://localhost').searchParams.get('dossier')).toBe('no');
  });
});
