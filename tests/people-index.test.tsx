// Критерии приёмки 12, 13 и 14 версии v7 — указатель персоналий `/people`:
// 12 — показаны все персоналии базы, отсортированные по имени;
// 13 — фильтр по ролям сужает выборку; несколько выбранных ролей работают как
//      «любая из выбранных»; роль, под которую в базе никого нет, приглушена;
//      неизвестный ключ в адресе молча отбрасывается;
// 14 — пункт «Персоналии» в шапке отмечен активным на страницах раздела.
//
// Страница — асинхронный серверный компонент, `force-dynamic`, как остальные:
//   export default async function PeoplePage({ searchParams }): ReactNode
// с `searchParams: Promise<Record<string, string | string[] | undefined>>`.
// Подменяется только '@/db' — настоящая база в памяти, та же фабрика createDb,
// что во всех тестах хранилища.
//
// Приглушение устроено так же, как приглушение пустого жанра в FiltersPanel: роль
// показана, но ссылкой не является и помечена aria-disabled="true". Это конвенция
// проекта, а не изобретение теста, — план прямо велит повторить панель фильтров.
//
// Число ячеек в ряду и прочая сетка здесь не проверяются: в jsdom Tailwind не загружен.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, within } from '@testing-library/react';
import { createDb, type Db } from '@/db';
import { films, filmPeople, people, type Film, type Person } from '@/db/schema';
import PeoplePage from '@/app/people/page';
import { filmValues, personValues } from './helpers';

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock('@/db', async () => {
  const actual = await vi.importActual<typeof import('@/db')>('@/db');
  return { ...actual, getDb: () => state.db };
});

// v14: страница спрашивает у сессии второй признак — включён ли просмотр глазами
// гостя, — и признак этот достаётся из куки. Подстановка отдаёт банку с двумя куками:
// без неё `cookies()` вне запроса просто бросит, и указатель перестал бы рендериться.
// Режим задаётся настоящей кукой, а не подменённой сессией: вне боевой сборки
// посетитель — владелец без входа, и режим гостя тут единственное, что его меняет
// (критерий 18).
const jar = vi.hoisted(() => ({ owner: undefined as string | undefined, guestView: false }));

vi.mock('next/headers', () => {
  const value = (name: string): string | undefined => {
    if (name === 'kinobase_owner') return jar.owner;
    if (name === 'kinobase_guest_view') return jar.guestView ? '1' : undefined;
    return undefined;
  };
  return {
    cookies: async () => ({
      get: (name: string) => {
        const found = value(name);
        return found === undefined ? undefined : { name, value: found };
      },
      getAll: () => [],
      has: (name: string) => value(name) !== undefined,
    }),
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  // v14: в подвале появилась клиентская ссылка переключателя режима, и она спрашивает
  // текущий путь. Без подстановки страница с подвалом перестала бы рендериться вовсе.
  usePathname: () => '/',
  notFound: () => {
    throw new Error('notFound');
  },
}));

let db: Db;

function insertFilm(values: Parameters<typeof filmValues>[0]): Film {
  return db.insert(films).values(filmValues(values)).returning().all()[0];
}

function insertPerson(values: Parameters<typeof personValues>[0]): Person {
  return db.insert(people).values(personValues(values)).returning().all()[0];
}

function link(film: Film, person: Person, role: string): void {
  db.insert(filmPeople).values({ filmId: film.id, personId: person.id, role }).run();
}

async function renderIndex(
  params: Record<string, string | string[] | undefined> = {},
): Promise<HTMLElement> {
  const searchParams = Promise.resolve(params);
  const { container } = render(await PeoplePage({ searchParams }));
  return container;
}

/** Персоналии в порядке показа: карточка каждой ведёт на её страницу `/people/<slug>`.
 *  Считаем по адресам, а не по тексту: что именно карточка печатает рядом с именем —
 *  дело вёрстки, а вот кто попал в сетку и в каком порядке — предмет спеки. */
function shownSlugs(container: HTMLElement): string[] {
  return within(container)
    .queryAllByRole('link')
    .map((item) => item.getAttribute('href') ?? '')
    .filter((href) => href.startsWith('/people/'))
    .map((href) => href.slice('/people/'.length));
}

/** Ссылки панели фильтра: они ведут в сам раздел, а не в карточку человека.
 *  Подписи ролей встречаются и в карточках, поэтому панель отделяется по адресу. */
function roleFilters(container: HTMLElement): HTMLElement[] {
  return within(container)
    .queryAllByRole('link')
    .filter((item) => {
      const href = item.getAttribute('href') ?? '';
      if (!(href === '/people' || href.startsWith('/people?'))) return false;
      // Правка от 25.08.2026. Пункт шапки «Персоналии» ведёт на тот же адрес, что
      // и сброшенный отбор, и потому попадал сюда наравне с фильтрами. В седьмой
      // версии это было безобидно: панель стояла в теле страницы, и её содержимое
      // искали по подписи роли. С одиннадцатой панель свёрнута, и появилась проверка
      // «до нажатия отбора нет» — вот на ней посылка и вылезла: пункт навигации
      // фильтром не является ни при каком состоянии панели.
      return !(item.textContent ?? '').includes('Персоналии');
    });
}

/** Кнопка фильтра по подписи роли; undefined — роль ссылкой не является. */
function roleFilter(container: HTMLElement, label: string): HTMLElement | undefined {
  return roleFilters(container).find((item) => (item.textContent ?? '').includes(label));
}

/** Правка v11 от 25.08.2026 (работа D, критерии 16 и 17). Отбор ролей переехал из тела
 *  страницы в раскрывающуюся панель под шапкой — туда же, где живут фильтры главной.
 *  Панель по умолчанию свёрнута, поэтому проверки самого отбора начинаются с того же
 *  движения, каким её раскрывает читатель: нажатия на кнопку «Фильтры». Сам отбор
 *  при этом не изменился ни на строчку — ниже проверяется ровно то же, что и в v7. */
function openFilters(container: HTMLElement): void {
  fireEvent.click(within(container).getByRole('button', { name: /Фильтры/i }));
}

/** Три персоналии с разными наборами ролей — на них проверяются фильтр и порядок. */
function insertThree(): void {
  insertPerson({
    slug: 'mamoru-oshii',
    nameRu: 'Мамору Осии',
    roles: ['director', 'screenwriter'],
  });
  insertPerson({ slug: 'kenji-kawai', nameRu: 'Кэндзи Каваи', roles: ['composer'] });
  insertPerson({ slug: 'akira-kurosawa', nameRu: 'Акира Куросава', roles: ['director'] });
}

beforeEach(() => {
  db = createDb(':memory:');
  state.db = db;
  jar.owner = undefined;
  jar.guestView = false;
});

afterEach(() => {
  cleanup();
});

describe('указатель: сетка людей (критерий 12)', () => {
  it('показаны все персоналии базы', async () => {
    insertThree();

    const container = await renderIndex();

    expect(container.textContent).toContain('Мамору Осии');
    expect(container.textContent).toContain('Кэндзи Каваи');
    expect(container.textContent).toContain('Акира Куросава');
  });

  it('порядок — по имени, кириллица по алфавиту', async () => {
    insertThree();

    const container = await renderIndex();

    expect(shownSlugs(container)).toEqual(['akira-kurosawa', 'kenji-kawai', 'mamoru-oshii']);
  });

  it('карточка ведёт на страницу персоналии', async () => {
    insertThree();

    const container = await renderIndex();
    const card = within(container).getByRole('link', { name: /Мамору Осии/ });

    expect(card).toHaveAttribute('href', '/people/mamoru-oshii');
  });

  it('роли показаны в карточке подписями словаря', async () => {
    insertThree();

    const container = await renderIndex();

    expect(within(container).getByRole('link', { name: /Кэндзи Каваи/ })).toHaveTextContent(
      'композитор',
    );
    expect(within(container).getByRole('link', { name: /Мамору Осии/ })).toHaveTextContent(
      'режиссёр',
    );
  });

  it('фотография персоналии показана, а без фотографии страница не ломается', async () => {
    insertPerson({
      slug: 'mamoru-oshii',
      nameRu: 'Мамору Осии',
      roles: ['director'],
      photoPath: '/people/mamoru-oshii.jpg',
    });
    insertPerson({ slug: 'moko-chan', nameRu: 'Моко-тян', roles: ['designer'] });

    const container = await renderIndex();

    expect(container.querySelector('img[src*="mamoru-oshii"]')).not.toBeNull();
    expect(container.textContent).toContain('Моко-тян');
  });

  it('в подписи стоит число фильмов человека в базе', async () => {
    const oshii = insertPerson({ slug: 'mamoru-oshii', nameRu: 'Мамору Осии', roles: ['director'] });
    insertPerson({ slug: 'moko-chan', nameRu: 'Моко-тян', roles: ['designer'] });

    for (const titleRu of ['Призрак в доспехах', 'Авалон', 'Невинность', 'Ангельское яйцо']) {
      link(insertFilm({ titleRu }), oshii, 'director');
    }

    const container = await renderIndex();
    const card = within(container).getByRole('link', { name: /Мамору Осии/ });

    expect(card).toHaveTextContent('4');
  });

  it('пустая база указатель не ломает', async () => {
    const container = await renderIndex();

    expect(shownSlugs(container)).toEqual([]);
  });

  it('пункт «Персоналии» в шапке отмечен активным (критерий 14)', async () => {
    insertThree();

    const container = await renderIndex();
    const item = within(container).getByRole('link', { name: /^Персоналии/ });

    expect(item).toHaveAttribute('href', '/people');
    expect(item.getAttribute('aria-current')).not.toBeNull();
  });
});

describe('указатель: фильтр по ролям (критерий 13)', () => {
  beforeEach(() => {
    insertThree();
  });

  it('без параметра показаны все', async () => {
    const container = await renderIndex();

    expect(shownSlugs(container)).toHaveLength(3);
  });

  it('роли словаря показаны кнопками фильтра', async () => {
    const container = await renderIndex();
    openFilters(container);

    for (const label of ['режиссёр', 'сценарист', 'композитор', 'актёр', 'автор оригинала']) {
      expect(container.textContent, `в панели нет роли «${label}»`).toContain(label);
    }
  });

  it('выбранная роль сужает выборку', async () => {
    const container = await renderIndex({ role: 'composer' });

    expect(shownSlugs(container)).toEqual(['kenji-kawai']);
  });

  it('роль ищется по всем ролям человека, а не только по первой', async () => {
    const container = await renderIndex({ role: 'screenwriter' });

    expect(shownSlugs(container)).toEqual(['mamoru-oshii']);
  });

  it('несколько ролей работают как «любая из выбранных»', async () => {
    const container = await renderIndex({ role: 'composer,screenwriter' });

    expect(shownSlugs(container)).toEqual(['kenji-kawai', 'mamoru-oshii']);
  });

  it('выбранная роль отмечена, невыбранная — нет', async () => {
    const container = await renderIndex({ role: 'director' });
    openFilters(container);

    expect(roleFilter(container, 'режиссёр')).toHaveAttribute('aria-current', 'true');
    expect(roleFilter(container, 'композитор')?.getAttribute('aria-current')).toBeNull();
  });

  it('кнопка невыбранной роли ведёт в указатель с этим фильтром', async () => {
    const container = await renderIndex();
    openFilters(container);

    expect(roleFilter(container, 'композитор')).toHaveAttribute('href', '/people?role=composer');
  });

  it('роль, под которую в базе никого нет, показана, но ссылкой не является', async () => {
    const container = await renderIndex();
    openFilters(container);

    expect(container.textContent).toContain('монтажёр');
    expect(roleFilter(container, 'монтажёр')).toBeUndefined();
  });

  it('приглушённая роль помечена как недоступная', async () => {
    const container = await renderIndex();
    openFilters(container);

    // Из всех совпадений берём последнее: обёртки в разметке идут раньше самого элемента.
    const matches = within(container).queryAllByText(/монтажёр/);
    const editor = matches[matches.length - 1];

    expect(editor.closest('[aria-disabled="true"]')).not.toBeNull();
  });

  it('неизвестный ключ в адресе молча отбрасывается', async () => {
    const container = await renderIndex({ role: 'гримёр' });

    expect(shownSlugs(container)).toHaveLength(3);
  });

  it('неизвестный ключ рядом с известным не мешает известному', async () => {
    const container = await renderIndex({ role: 'composer,гримёр' });

    expect(shownSlugs(container)).toEqual(['kenji-kawai']);
  });

  it('под роль, выбранную в адресе, может не подойти никто — тогда сетка пуста', async () => {
    const container = await renderIndex({ role: 'actor' });

    expect(shownSlugs(container)).toEqual([]);
    expect(container.textContent).not.toContain('Мамору Осии');
  });
});

// ---------------------------------------------------------------------------
// Дополнение v11, критерии приёмки 1, 16, 17, 18, 19, 20 и 26 — указатель персоналий
// переходит на грамматику фильтров главной:
// 16 — в шапке есть кнопка «Фильтры», в теле страницы отбора ролей больше нет;
// 17 — панель раскрывается под шапкой и содержит группу «Роли» с теми же ролями
//      и счётчиками, что были в теле;
// 18 — кнопка несёт перечень выбранных ролей: «Фильтры · режиссёр, композитор»;
// 19 — при выбранной роли в панели есть «Сбросить всё»;
// 20 — пункт «Персоналии» в шапке остаётся отмеченным текущим разделом;
// 26 — рядом с ним появляется пункт «О проекте»;
// 1 — подвал стоит последним внутри `<main>`.
//
// Контракт (plan.md, работа D): `SiteHeader` на странице заменяется на клиентский
// `FiltersDisclosure` — тот же, что на главной, — которому добавляется проброс `section`.
// Панелью служит `RoleFilters`, вызываемый страницей напрямую.
//
// ~~«Панель — отдельный компонент `RoleFiltersPanel`, чтобы место для второй группы
// отбора персоналий уже существовало»~~ — решение v11 отменено 15.09.2026 (рефакторинг,
// находка 7). Обёртка не делала ничего, кроме `<div className="flex flex-col gap-4">`,
// а точно такой же контейнер с теми же классами уже стоял первой строкой внутри самого
// `RoleFilters`: не пустая обёртка, а вложенный дубль контейнера. Заведена она была
// «на будущее» — ровно то, что запрещает раздел «Код» в CLAUDE.md. Когда вторая группа
// отбора действительно появится, обёртка заведётся тогда же, одним движением.
//
// Тесты указателя от этого не зависят и не зависели: панель они ищут по содержимому —
// по группе «Роли», по кнопкам ролей со счётчиками, — а не по имени компонента-обёртки.
//
// «В теле страницы фильтров нет» проверяется отсутствием отбора до нажатия на кнопку:
// свёрнутая панель не рендерится вовсе — так устроен `FiltersDisclosure` с первой
// версии, и tests/filters-disclosure.test.tsx это фиксирует.

describe('указатель: фильтры переехали в шапку (критерии 16 и 17 версии v11)', () => {
  beforeEach(() => {
    insertThree();
  });

  it('в шапке есть кнопка «Фильтры»', async () => {
    const container = await renderIndex();

    expect(within(container).getByRole('button', { name: /Фильтры/i })).toBeInTheDocument();
  });

  it('до нажатия отбора ролей на странице нет', async () => {
    const container = await renderIndex();

    expect(roleFilters(container)).toHaveLength(0);
  });

  it('нажатие раскрывает панель', async () => {
    const container = await renderIndex();
    openFilters(container);

    expect(within(container).getByRole('button', { name: /Фильтры/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(roleFilters(container).length).toBeGreaterThan(0);
  });

  it('в панели есть группа «Роли»', async () => {
    const container = await renderIndex();
    openFilters(container);

    expect(container.textContent).toContain('Роли');
  });

  it('роли в панели идут со счётчиками', async () => {
    const container = await renderIndex();
    openFilters(container);

    expect(roleFilter(container, 'режиссёр')).toHaveTextContent('2');
    expect(roleFilter(container, 'композитор')).toHaveTextContent('1');
  });

  it('повторное нажатие панель сворачивает', async () => {
    const container = await renderIndex();
    openFilters(container);
    openFilters(container);

    expect(roleFilters(container)).toHaveLength(0);
  });
});

// Правка v13 от 31.08.2026. Прежняя редакция: ~~«кнопка перечисляет выбранное:
// выбранная роль названа на кнопке, две роли названы обе, неизвестный ключ не попадает»~~ —
// критерий 18 версии v11. Отменена спекой v13, критерий 23: хвост из названий на кнопке
// убран везде, где эта кнопка стоит. Довод общий для главной и для указателя — хвост рос
// с каждым выбранным значением, при пяти переносил шапку на вторую строку и не давал снять
// ни одно значение по отдельности. На главной перечень переехал в строку применённого;
// у указателя своей строки пока нет, и кнопка несёт только число. Проверка «неизвестный ключ
// не попадает» не потеряна: она живёт в parseRoles (tests/url-state.test.ts) — там ей и место,
// потому что это разбор адреса, а не вёрстка кнопки.
describe('указатель: число выбранного на кнопке (правка v13 к критерию 18 версии v11)', () => {
  beforeEach(() => {
    insertThree();
  });

  it('без выбора кнопка несёт только слово «Фильтры»', async () => {
    const container = await renderIndex();

    expect(within(container).getByRole('button', { name: /Фильтры/i }).textContent).toBe('Фильтры');
  });

  it('одна выбранная роль даёт на кнопке единицу', async () => {
    const container = await renderIndex({ role: 'director' });
    const button = within(container).getByRole('button', { name: /Фильтры/i });

    expect(button).toHaveTextContent('1');
    expect(button.textContent).not.toContain('режиссёр');
  });

  it('две выбранные роли дают двойку', async () => {
    const container = await renderIndex({ role: 'director,composer' });

    expect(within(container).getByRole('button', { name: /Фильтры/i })).toHaveTextContent('2');
  });

  it('неизвестный ключ в счёт не идёт', async () => {
    const container = await renderIndex({ role: 'composer,гримёр' });
    const button = within(container).getByRole('button', { name: /Фильтры/i });

    expect(button).toHaveTextContent('1');
    expect(button.textContent).not.toContain('гримёр');
  });
});

describe('указатель: «Сбросить всё» (критерий 19 версии v11)', () => {
  beforeEach(() => {
    insertThree();
  });

  it('при выбранной роли в панели есть «Сбросить всё»', async () => {
    const container = await renderIndex({ role: 'director' });
    openFilters(container);

    expect(within(container).getByRole('link', { name: 'Сбросить всё' })).toHaveAttribute(
      'href',
      '/people',
    );
  });

  it('без выбора «Сбросить всё» не показывают', async () => {
    const container = await renderIndex();
    openFilters(container);

    expect(within(container).queryByRole('link', { name: 'Сбросить всё' })).toBeNull();
  });
});

describe('указатель: шапка и подвал (критерии 1, 20 и 26 версии v11)', () => {
  beforeEach(() => {
    insertThree();
  });

  it('пункт «Персоналии» остаётся отмеченным текущим разделом', async () => {
    const container = await renderIndex();

    expect(within(container).getByRole('link', { name: /^Персоналии/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('отметка не пропадает и при раскрытой панели', async () => {
    const container = await renderIndex({ role: 'director' });
    openFilters(container);

    expect(within(container).getByRole('link', { name: /^Персоналии/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  // portable 22.09.2026: кейс «рядом есть пункт «О проекте»» снят целиком — страницы
  // «О проекте» в отчуждаемой копии нет.

  it('подвал стоит последним внутри <main>', async () => {
    const container = await renderIndex();
    const area = container.querySelector('main');
    const footer = area?.querySelector('footer') ?? null;

    expect(footer).not.toBeNull();
    // portable 22.09.2026: имя владельца — личное поле site.config.ts, пустое
    // по умолчанию, поэтому надпись сверяется без него.
    expect(container.textContent).toContain('Каталог фильмов');

    let node: Element | null = footer;
    while (node !== null && node !== area) {
      expect(node.nextElementSibling, 'после подвала в <main> что-то есть').toBeNull();
      node = node.parentElement;
    }
  });
});

// Критерий приёмки 20а версии v11 — счётчик у пункта «Персоналии» в шапке.
//
// Порядок здесь честнее назвать: критерий пришёл от владельца уже после того, как
// тесты версии были написаны, и на уровне хранилища `countPeople` делался красным-
// зелёным, а этот блок дописан после правки шапки. Поэтому он проверен мутацией:
// если убрать проп `peopleCount` со страницы, обе проверки ниже краснеют.
//
// Число — по всей базе, а не по выбранным ролям: шапка про отбор не знает, ровно как
// счётчики табов статусов не знают о выбранных жанрах. Вторая проверка именно об этом
// и написана — она и есть содержание критерия, а не первая.
describe('указатель: счётчик у пункта «Персоналии» (критерий 20а версии v11)', () => {
  function peopleItem(container: HTMLElement): HTMLElement {
    return within(container).getByRole('link', { name: /^Персоналии/ });
  }

  it('пункт шапки несёт число персоналий базы', async () => {
    insertThree();

    const container = await renderIndex();

    expect(peopleItem(container)).toHaveTextContent('3');
  });

  it('выбор роли число не меняет: оно про базу, а не про выборку', async () => {
    insertThree();

    const container = await renderIndex({ role: 'composer' });

    // Под отбор подошёл один человек, а в шапке по-прежнему трое.
    expect(shownSlugs(container)).toEqual(['kenji-kawai']);
    expect(peopleItem(container)).toHaveTextContent('3');
  });
});

// ---------------------------------------------------------------------------
// Дополнение v14 (31.08.2026), критерии приёмки 24 и 25 на уровне страницы: признак
// режима «глазами гостя» доезжает до подвала указателя.
//
// Режим включается настоящей кукой `kinobase_guest_view`, а не подменённой сессией:
// вне боевой сборки посетитель — владелец без входа (правило v7), и кука здесь
// единственное, что делает его гостем. Это и есть критерий 18, увиденный со стороны
// страницы: подвал перестаёт показывать владельческое, не спрашивая ни о чём больше.

describe('указатель персоналий: режим «глазами гостя» в подвале (критерии 24 и 25)', () => {
  /** Самостоятельная пометка режима: элемент, чей собственный текст и есть «Глазами
   *  гостя». Искать вхождением нельзя — эта строка целиком лежит внутри подписи
   *  переключателя «Посмотреть глазами гостя» (конфликт критериев 24 и 25, разобранный
   *  31.08.2026 в tests/site-footer.test.tsx). */
  const modeMark = (container: HTMLElement): HTMLElement | undefined =>
    [...container.querySelectorAll('*')].find(
      (element) => (element.textContent ?? '').trim() === 'Глазами гостя',
    ) as HTMLElement | undefined;

  const named = (container: HTMLElement, pattern: RegExp): HTMLElement | undefined =>
    within(container)
      .queryAllByRole('link')
      .find((item) => pattern.test(item.textContent ?? ''));

  // portable 22.09.2026: проверка ссылки «Админка» снята — этой ссылки в подвале
  // больше нет вовсе, независимо от режима.
  it('вне режима подвал показывает владельческое, включая переключатель', async () => {
    insertThree();

    const container = await renderIndex();

    expect(named(container, /Посмотреть глазами гостя/i)).toBeDefined();
    expect(named(container, /Выйти/i)).toBeDefined();
  });

  it('при стоящей куке подвал несёт строку «Глазами гостя» (критерий 25)', async () => {
    insertThree();
    jar.guestView = true;

    const container = await renderIndex();

    expect(modeMark(container), 'в подвале нет пометки режима').toBeDefined();
  });

  it('при стоящей куке есть ссылка возврата (критерий 25)', async () => {
    insertThree();
    jar.guestView = true;

    const container = await renderIndex();
    const back = named(container, /Вернуться к своему виду/i);

    expect(back).toBeDefined();
    expect((back!.getAttribute('href') ?? '').startsWith('/owner/owner-view')).toBe(true);
  });

  // portable 22.09.2026: часть про «Админку» снята — этой ссылки в подвале больше
  // нет вовсе, независимо от режима.
  it('при стоящей куке нет «Выйти» (критерий 25)', async () => {
    insertThree();
    jar.guestView = true;

    const container = await renderIndex();

    expect(named(container, /Выйти/i)).toBeUndefined();
  });

  it('после снятия куки подвал владельца возвращается', async () => {
    insertThree();
    jar.guestView = false;

    const container = await renderIndex();

    expect(modeMark(container)).toBeUndefined();
    expect(named(container, /Выйти/i)).toBeDefined();
  });
});
