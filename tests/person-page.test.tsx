// Критерии приёмки 1, 2, 3, 4, 5, 8, 9, 10, 11, 14 и 17 версии v7 — что показывает
// страница персоналии `/people/<slug>`:
// 1 — фотография, имя, оригинальное написание, теги ролей, дата и место рождения,
//     основные работы, ссылки, аннотация, «Творческий метод» и галерея фильмов из базы;
// 2 — персоналии, которой нет, отвечает 404, а не пустая страница;
// 3 — тег роли ведёт в указатель с этим фильтром;
// 4 — у человека с известным только годом рождения печатается год, без выдуманных
//     месяца и дня;
// 5 — у умершего вместо двух строк печатается одна строка «Годы жизни»;
// 8 — заголовок работы, которая есть в базе, разрешается страницей в ссылку на карточку:
//     сопоставление идёт по оригинальному названию, компонент получает готовый filmId;
// 9, 10 — галерея показывает только связанные фильмы, а у персоналии без связей
//     раздела нет и пустой заголовок на его месте не остаётся;
// 11 — у персоналии без материалов показана справка и плашка «агенты ещё не собрали»;
// 14 — пункт «Персоналии» в шапке отмечен активным на страницах раздела;
// 17 — ГЛАВНОЕ: на странице нет ни оценки, ни звёздочки, ни комментария, ни отметок
//     о просмотре — ни при каких условиях, и серверного действия правки персоналии
//     не существует.
//
// Как это проверяется. Страница — асинхронный серверный компонент; она ходит в базу,
// поэтому подменяется '@/db' (настоящая база в памяти, та же фабрика createDb, что
// во всех тестах хранилища) и 'next/navigation' (notFound бросает). '@/lib/session'
// подменяется слежкой: признак посетителя задаётся тестом, а не достаётся из куки.
//
// Правка v11 от 25.08.2026. До одиннадцатой версии критерий 17 проверялся ещё и тем,
// что страница НЕ спрашивает признак владельца вовсе: правки на ней нет, спрашивать
// было не для чего. С работой A на странице появился подвал, и одна ссылка в нём —
// «Войти» или «Выйти» — от признака зависит. Запрет остался, но переехал с вопроса
// на ответ: личного на странице человека нет ни при каких условиях, включая
// признанного владельца. Подробности — в комментарии к самой переписанной проверке.
//
// Личное проверяется на персоналии без связанных фильмов: галерея рисует карточки
// фильмов, а у фильма плашка оценки и статуса законна — она про фильм, а не про
// человека. Без галереи на странице не остаётся ни одного законного источника
// личной разметки, и любая находка означает нарушение критерия 17.
//
// Дополнение: правка от 23.08.2026, критерий приёмки 23 — год у неоднозначного названия.
// Правило одинаково всюду, где показано название тайтла, и галерея «В базе» не исключение:
// карточки в ней рисует тот же `FilmCell`, значит и здесь заголовок одноимённого тайтла
// обязан нести год. Неоднозначность — свойство базы целиком, а не выборки этой страницы:
// одноимённый тайтл, с этим человеком не связанный и в галерею не попавший, всё равно
// делает название неоднозначным. Набор считает страница и передаёт ячейке пропом
// `ambiguous` — тот же контракт, что на главной.

// Классы сетки, прилипшая колонка и размер ячеек галереи здесь не проверяются:
// в jsdom Tailwind не загружен, это работа живого прогона в браузере.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, within } from '@testing-library/react';
import { createDb, type Db } from '@/db';
import { films, filmPeople, people, type Film, type Person } from '@/db/schema';
import PersonPage from '@/app/people/[slug]/page';
import * as serverActions from '@/app/actions';
import { filmValues, personValues } from './helpers';
import type { Method, WorkNote } from '@/lib/people';
import type { DossierNode } from '@/lib/dossier';

const state = vi.hoisted(() => ({ db: null as unknown }));

const session = vi.hoisted(() => ({
  viewerIsOwner: vi.fn(async () => false),
  // v14: у сессии два признака вместо одного — кто ты и чьими глазами смотришь.
  // Подвал спрашивает оба, и режим гостя задаётся здесь тем же приёмом, что владелец.
  guestViewOn: vi.fn(async () => false),
}));

vi.mock('@/db', async () => {
  const actual = await vi.importActual<typeof import('@/db')>('@/db');
  return { ...actual, getDb: () => state.db };
});

vi.mock('@/lib/session', () => ({
  viewerIsOwner: session.viewerIsOwner,
  guestViewOn: session.guestViewOn,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  // v14: в подвале появилась клиентская ссылка переключателя режима, и она спрашивает
  // текущий путь. Без подстановки страница с подвалом перестала бы рендериться вовсе.
  usePathname: () => '/',
  notFound: () => {
    throw new Error('notFound');
  },
}));

const p = (text: string): DossierNode => ({ type: 'p', text });

const METHOD: Method[] = [
  {
    title: null,
    theses: [
      { title: 'У кино нет реальности', body: [p('Граница между сном и явью не проведена.')] },
    ],
  },
];

const WORKS: WorkNote[] = [
  {
    title: 'Авалон',
    year: 2001,
    titleOriginal: 'Avalon',
    method: [p('Игра затягивает сильнее жизни.')],
    facts: ['Снят в Польше на польском языке.'],
  },
  {
    title: 'Ангельское яйцо',
    year: 1985,
    titleOriginal: 'Angel’s Egg',
    method: [p('Фильм почти без слов.')],
    facts: [],
  },
];

const COMMENT = 'Личная заметка про финал, которую видеть никому не надо';

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

/** Разметка страницы персоналии по её slug. */
async function renderPage(slug: string): Promise<HTMLElement> {
  const params = Promise.resolve({ slug });
  const { container } = render(await PersonPage({ params }));
  return container;
}

/** Содержимое страницы без шапки: в шапке живут табы статусов, и слово «Посмотрел»
 *  там — название таба про фильмы, а не отметка о просмотре человека. */
function body(container: HTMLElement): HTMLElement {
  return (container.querySelector('main') as HTMLElement | null) ?? container;
}

/** Полностью заполненная персоналия — от неё отталкиваются тесты состава. */
function insertOshii(): Person {
  return insertPerson({
    slug: 'mamoru-oshii',
    nameRu: 'Мамору Осии',
    nameOriginal: 'Mamoru Oshii',
    photoPath: '/people/mamoru-oshii.jpg',
    birthDate: '1951-08-08',
    birthPlace: 'Токио, Япония',
    roles: ['director', 'screenwriter'],
    notableWorks: [
      { title: 'Призрак в доспехах', year: 1995 },
      { title: 'Авалон', year: 2001 },
    ],
    links: [{ label: 'Интервью Sight & Sound', url: 'https://example.com/interview' }],
    imdbId: 'nm0651900',
    kinopoiskId: 32168,
    annotation: 'Тридцать лет снимает про то, что у кино нет реальности.',
    method: METHOD,
    workNotes: WORKS,
    sources: [
      { publication: 'Sight & Sound', title: 'Разговор с Осии', url: 'https://example.com/s' },
    ],
    searchedAt: '2026-08-23',
  });
}

beforeEach(() => {
  db = createDb(':memory:');
  state.db = db;
  session.viewerIsOwner.mockClear();
  session.viewerIsOwner.mockResolvedValue(false);
  session.guestViewOn.mockClear();
  session.guestViewOn.mockResolvedValue(false);
});

afterEach(() => {
  cleanup();
});

describe('страница персоналии: состав (критерий 1)', () => {
  beforeEach(() => {
    const oshii = insertOshii();
    const gits = insertFilm({
      titleRu: 'Призрак в доспехах',
      titleOriginal: 'Ghost in the Shell',
      releaseDate: '1995-11-18',
    });
    link(gits, oshii, 'director');
  });

  it('имя стоит заголовком первого уровня', async () => {
    const container = await renderPage('mamoru-oshii');

    expect(within(container).getByRole('heading', { level: 1, name: 'Мамору Осии' })).toBeInTheDocument();
  });

  it('оригинальное написание показано', async () => {
    const container = await renderPage('mamoru-oshii');

    expect(container.textContent).toContain('Mamoru Oshii');
  });

  it('фотография показана', async () => {
    const container = await renderPage('mamoru-oshii');

    expect(container.querySelector('img[src*="mamoru-oshii"]')).not.toBeNull();
  });

  it('теги ролей показаны подписями словаря', async () => {
    const container = await renderPage('mamoru-oshii');

    expect(container.textContent).toContain('режиссёр');
    expect(container.textContent).toContain('сценарист');
  });

  it('дата и место рождения показаны', async () => {
    const container = await renderPage('mamoru-oshii');

    expect(container.textContent).toContain('Родился');
    expect(container.textContent).toContain('8 августа 1951');
    expect(container.textContent).toContain('Токио, Япония');
  });

  it('основные работы показаны названием и годом', async () => {
    const container = await renderPage('mamoru-oshii');

    expect(container.textContent).toContain('Авалон');
    expect(container.textContent).toContain('2001');
  });

  it('внешние ссылки, IMDb и Кинопоиск показаны', async () => {
    const container = await renderPage('mamoru-oshii');

    expect(
      within(container).getByRole('link', { name: /Интервью Sight & Sound/ }),
    ).toHaveAttribute('href', 'https://example.com/interview');
    expect(container.textContent).toMatch(/IMDb/i);
    expect(container.textContent).toMatch(/Кинопоиск/i);
  });

  it('аннотация показана абзацем', async () => {
    const container = await renderPage('mamoru-oshii');

    expect(container.textContent).toContain('Тридцать лет снимает про то, что у кино нет реальности.');
  });

  it('раздел «Творческий метод» показан вместе с тезисами и работами', async () => {
    const container = await renderPage('mamoru-oshii');

    expect(within(container).getByRole('heading', { name: 'Творческий метод' })).toBeInTheDocument();
    expect(container.textContent).toContain('У кино нет реальности');
    expect(container.textContent).toContain('Игра затягивает сильнее жизни');
    expect(container.textContent).toContain('Снят в Польше');
  });

  it('источники показаны отдельным разделом', async () => {
    const container = await renderPage('mamoru-oshii');

    expect(container.textContent).toContain('Источники');
  });

  it('галерея «В базе» показывает связанный фильм', async () => {
    const container = await renderPage('mamoru-oshii');

    expect(within(container).getByRole('heading', { name: 'В базе' })).toBeInTheDocument();
    expect(within(container).getByRole('link', { name: /Призрак в доспехах/ })).toHaveAttribute(
      'href',
      '/films/1',
    );
  });

  it('пункт «Персоналии» в шапке отмечен активным (критерий 14)', async () => {
    const container = await renderPage('mamoru-oshii');

    const item = within(container).getByRole('link', { name: /^Персоналии/ });

    expect(item).toHaveAttribute('href', '/people');
    expect(item.getAttribute('aria-current')).not.toBeNull();
  });
});

describe('страница персоналии: которой нет (критерий 2)', () => {
  it('несуществующий slug уходит в notFound, а не в пустую страницу', async () => {
    insertOshii();

    await expect(renderPage('kenji-kawai')).rejects.toThrow('notFound');
  });

  it('пустая база — тот же ответ', async () => {
    await expect(renderPage('mamoru-oshii')).rejects.toThrow('notFound');
  });
});

describe('страница персоналии: теги ролей ведут в указатель (критерий 3)', () => {
  it('тег роли — ссылка на указатель с этим фильтром', async () => {
    insertPerson({
      slug: 'kenji-kawai',
      nameRu: 'Кэндзи Каваи',
      roles: ['composer'],
      annotation: 'Композитор.',
    });

    const container = await renderPage('kenji-kawai');
    const tag = within(container).getByRole('link', { name: 'композитор' });

    expect(tag).toHaveAttribute('href', '/people?role=composer');
  });
});

describe('страница персоналии: даты (критерии 4 и 5)', () => {
  it('известен только год рождения — печатается год, без выдуманных месяца и дня', async () => {
    insertPerson({
      slug: 'moko-chan',
      nameRu: 'Моко-тян',
      roles: ['designer'],
      birthDate: '1992',
      annotation: 'Дизайнер персонажей.',
    });

    const container = await renderPage('moko-chan');

    expect(container.textContent).toContain('1992');
    expect(container.textContent).not.toMatch(/январ/i);
    expect(container.textContent).not.toContain('1 января 1992');
  });

  it('известны год и месяц — печатается месяц с годом', async () => {
    insertPerson({
      slug: 'moko-chan',
      nameRu: 'Моко-тян',
      roles: ['designer'],
      birthDate: '1992-03',
      annotation: 'Дизайнер персонажей.',
    });

    const container = await renderPage('moko-chan');

    expect(container.textContent).toContain('март 1992');
  });

  it('у умершего человека вместо двух строк одна — «Годы жизни»', async () => {
    insertPerson({
      slug: 'satoshi-kon',
      nameRu: 'Сатоси Кон',
      roles: ['director'],
      birthDate: '1963-10-12',
      deathDate: '2010-08-24',
      birthPlace: 'Саппоро, Япония',
      annotation: 'Режиссёр.',
    });

    const container = await renderPage('satoshi-kon');

    expect(container.textContent).toContain('Годы жизни');
    expect(container.textContent).not.toContain('Родился');
    expect(container.textContent).toContain('1963');
    expect(container.textContent).toContain('2010');
  });

  it('у живого человека строки «Годы жизни» нет', async () => {
    insertPerson({
      slug: 'mamoru-oshii',
      nameRu: 'Мамору Осии',
      roles: ['director'],
      birthDate: '1951-08-08',
      annotation: 'Режиссёр.',
    });

    const container = await renderPage('mamoru-oshii');

    expect(container.textContent).toContain('Родился');
    expect(container.textContent).not.toContain('Годы жизни');
  });
});

describe('страница персоналии: работа из базы становится ссылкой (критерий 8)', () => {
  beforeEach(() => {
    insertOshii();
    // Фильм в базе есть, но с персоналией не связан: разбор работы — не галерея,
    // и ссылку даёт совпадение оригинального названия, а не связь.
    insertFilm({ titleRu: 'Авалон', titleOriginal: 'Avalon', releaseDate: '2001-01-20' });
  });

  // Правка v11 (работа E, критерий 22). Прежде ссылкой на карточку был сам заголовок
  // работы. Теперь каждая работа в «Методе в произведениях» свёрнута, её заголовок живёт
  // в `<summary>`, а ссылка внутри `<summary>` конфликтует со сворачиванием: щелчок по
  // ней и раскрывал бы секцию, и уводил со страницы. Поэтому ссылка уехала внутрь
  // раскрытого содержимого отдельной строкой. Требование критерия 8 версии v7 не
  // отменено, а переехало: работа, чьё оригинальное название нашлось в базе,
  // по-прежнему связана со своей карточкой — меняется только то, что кликается.
  it('у работы, чьё оригинальное название нашлось в базе, есть ссылка на карточку', async () => {
    const container = await renderPage('mamoru-oshii');
    const link = within(container).getByRole('link', { name: /Смотреть карточку в базе/i });

    expect(link).toHaveAttribute('href', '/films/1');
  });

  it('заголовок работы при этом остаётся на месте', async () => {
    const container = await renderPage('mamoru-oshii');

    expect(within(container).getByRole('heading', { name: /Авалон/ })).toBeInTheDocument();
  });

  it('заголовок работы, которой в базе нет, ссылкой не является', async () => {
    const container = await renderPage('mamoru-oshii');

    expect(container.textContent).toContain('Ангельское яйцо');
    expect(within(container).queryByRole('link', { name: /Ангельское яйцо/ })).toBeNull();
  });
});

describe('страница персоналии: галерея (критерии 9 и 10)', () => {
  it('в галерее только связанные фильмы', async () => {
    const oshii = insertOshii();
    const gits = insertFilm({ titleRu: 'Призрак в доспехах', releaseDate: '1995-11-18' });
    insertFilm({ titleRu: 'Матрица', releaseDate: '1999-03-31' });
    link(gits, oshii, 'director');

    const container = await renderPage('mamoru-oshii');

    expect(container.textContent).toContain('Призрак в доспехах');
    expect(container.textContent).not.toContain('Матрица');
  });

  it('у персоналии без связанных фильмов галереи нет и пустого заголовка не остаётся', async () => {
    insertOshii();
    insertFilm({ titleRu: 'Матрица', releaseDate: '1999-03-31' });

    const container = await renderPage('mamoru-oshii');

    expect(within(container).queryByRole('heading', { name: 'В базе' })).toBeNull();
    expect(container.textContent).not.toContain('В базе');
  });
});

describe('страница персоналии: без материалов (критерий 11)', () => {
  beforeEach(() => {
    insertPerson({
      slug: 'moko-chan',
      nameRu: 'Моко-тян',
      nameOriginal: 'モコちゃん',
      roles: ['designer', 'animator'],
      birthDate: '1992',
    });
  });

  it('показана плашка «агенты ещё не собрали информацию»', async () => {
    const container = await renderPage('moko-chan');

    expect(container.textContent).toMatch(/Агенты ещё не собрали информацию/i);
  });

  it('справка при этом на месте', async () => {
    const container = await renderPage('moko-chan');

    expect(within(container).getByRole('heading', { level: 1, name: 'Моко-тян' })).toBeInTheDocument();
    expect(container.textContent).toContain('モコちゃん');
    expect(container.textContent).toContain('художник');
    expect(container.textContent).toContain('1992');
  });

  it('раздела «Творческий метод» без материалов нет', async () => {
    const container = await renderPage('moko-chan');

    expect(within(container).queryByRole('heading', { name: 'Творческий метод' })).toBeNull();
  });

  it('у персоналии с материалами плашки нет', async () => {
    insertOshii();

    const container = await renderPage('mamoru-oshii');

    expect(container.textContent).not.toMatch(/Агенты ещё не собрали информацию/i);
  });
});

describe('страница персоналии: фотографии нет (критерий 1)', () => {
  it('на месте фотографии стоит имя', async () => {
    insertPerson({
      slug: 'moko-chan',
      nameRu: 'Моко-тян',
      roles: ['designer'],
      photoPath: null,
      annotation: 'Дизайнер персонажей.',
    });

    const container = await renderPage('moko-chan');

    expect(container.querySelector('img')).toBeNull();
    expect(within(container).getAllByText('Моко-тян').length).toBeGreaterThan(0);
  });
});

// Ради этого блока версия и оговаривает запрет отдельным разделом спеки: база — личный
// дневник о фильмах, и оценка в ней означает «фильм такой-то». Оценка, поставленная
// человеку, означала бы совсем другое.
describe('персоналию нельзя оценить (критерий 17)', () => {
  beforeEach(() => {
    insertOshii();
    // Фильм в базе есть, но с персоналией не связан: галереи на странице не будет,
    // и ни одного законного источника личной разметки на ней не остаётся.
    insertFilm({
      titleRu: 'Матрица',
      releaseDate: '1999-03-31',
      watched: true,
      myRating: 9,
      tasteStar: true,
      comment: COMMENT,
    });
  });

  it('заголовка «Моё» на странице нет', async () => {
    const container = await renderPage('mamoru-oshii');

    expect(within(container).queryByRole('heading', { name: 'Моё' })).toBeNull();
  });

  it('органов правки личных полей нет', async () => {
    const container = await renderPage('mamoru-oshii');

    expect(container.querySelector('textarea')).toBeNull();
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(within(container).queryByRole('switch')).toBeNull();
    expect(within(container).queryByRole('button', { name: /Оценка/ })).toBeNull();
  });

  it('отметок о просмотре нет', async () => {
    const container = await renderPage('mamoru-oshii');

    expect(body(container).textContent).not.toMatch(/Посмотрел/);
    expect(body(container).textContent).not.toMatch(/Хочу посмотреть/);
    expect(body(container).textContent).not.toMatch(/Буду смотреть/);
  });

  it('чужого комментария на странице нет', async () => {
    const container = await renderPage('mamoru-oshii');

    expect(container.innerHTML).not.toContain(COMMENT);
  });

  it('владельцу страница выглядит так же: секция «Моё» не появляется', async () => {
    session.viewerIsOwner.mockResolvedValue(true);

    const container = await renderPage('mamoru-oshii');

    expect(within(container).queryByRole('heading', { name: 'Моё' })).toBeNull();
    expect(container.querySelector('textarea')).toBeNull();
    expect(within(container).queryByRole('button', { name: /Оценка/ })).toBeNull();
  });

  // Правка v11 (работа A, критерии 1 и 2). Прежде здесь стоял запрет на сам вызов:
  // `expect(session.viewerIsOwner).not.toHaveBeenCalled()`. Он был верным пересказом
  // спеки v7 ровно до тех пор, пока на странице не появился подвал: подвалу нужен
  // признак посетителя, чтобы показать «Войти» или «Выйти», и страница его теперь
  // спрашивает. Само требование критерия 17 при этом не ослабло, оно переформулировано
  // ближе к сути: запрет не на вопрос, а на ответ — личного на странице человека нет
  // ни при каких условиях, включая признанного владельца. Именно это и проверяется
  // ниже, вместе со всем блоком, который остаётся на месте.
  it('признак владельца спрашивается только ради подвала, а не ради правки', async () => {
    session.viewerIsOwner.mockResolvedValue(true);

    const container = await renderPage('mamoru-oshii');

    expect(within(container).queryByRole('heading', { name: 'Моё' })).toBeNull();
    expect(container.querySelector('textarea')).toBeNull();
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(within(container).queryByRole('switch')).toBeNull();
    expect(container.innerHTML).not.toContain(COMMENT);
    // Единственное, на что признак влияет, — надпись одной ссылки в подвале.
    expect(within(container).getByRole('link', { name: /Выйти/i })).toBeInTheDocument();
  });

  // Правка от 23.08.2026. Отбор шёл по /person|people/i и ловил `updatePersonalAction` —
  // действие правки личных полей ФИЛЬМА, которое живёт в проекте с первой версии
  // и обязано существовать. Спека запрещает другое: действие правки персоналии.
  // Поэтому отбор сужен до имён, которые говорят именно о человеке, а `personal`
  // из него исключён явно.
  it('серверного действия правки персоналии не существует', async () => {
    const aboutPeople = Object.keys(serverActions).filter(
      (name) => /person|people/i.test(name) && !/personal/i.test(name),
    );

    expect(aboutPeople).toEqual([]);
  });
});

// Дополнение: правка от 23.08.2026, критерий приёмки 23.
describe('страница персоналии: год у неоднозначного названия в галерее', () => {
  it('заголовок одноимённого тайтла в галерее несёт год', async () => {
    const oshii = insertOshii();
    const movie = insertFilm({
      titleRu: 'Призрак в доспехах',
      titleOriginal: 'Ghost in the Shell',
      releaseDate: '1995-11-18',
    });
    insertFilm({
      titleRu: 'Призрак в доспехах',
      titleOriginal: 'Ghost in the Shell: SAC_2045',
      releaseDate: '2026-01-15',
    });
    link(movie, oshii, 'director');

    const container = await renderPage('mamoru-oshii');
    const gallery = within(container).getByRole('heading', { name: 'В базе' })
      .closest('section') as HTMLElement;

    expect(within(gallery).getByRole('heading', { level: 2, name: /Призрак в доспехах/ }))
      .toHaveTextContent('Призрак в доспехах (1995)');
  });

  it('одноимённый тайтл, в галерею не попавший, всё равно делает название неоднозначным', async () => {
    const oshii = insertOshii();
    const movie = insertFilm({ titleRu: 'Призрак в доспехах', releaseDate: '1995-11-18' });
    insertFilm({ titleRu: 'Призрак в доспехах', releaseDate: '2026-01-15' });
    link(movie, oshii, 'director');

    const container = await renderPage('mamoru-oshii');

    expect(body(container).textContent).toContain('Призрак в доспехах (1995)');
  });

  it('заголовок уникального названия в галерее года не получает', async () => {
    const oshii = insertOshii();
    const avalon = insertFilm({
      titleRu: 'Авалон',
      titleOriginal: 'Avalon',
      releaseDate: '2001-01-20',
    });
    link(avalon, oshii, 'director');

    const container = await renderPage('mamoru-oshii');
    const gallery = within(container).getByRole('heading', { name: 'В базе' })
      .closest('section') as HTMLElement;

    expect(within(gallery).getByRole('heading', { level: 2, name: 'Авалон' })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Дополнение v11, критерии приёмки 1, 2, 3, 12, 14, 21, 22, 23, 24, 26 и 34 —
// страница человека обустраивается:
// 1, 2, 3 — подвал стоит последним в `<main>`, и ссылка входа в нём отражает признак
//           посетителя. Ради этой одной ссылки страница и начала спрашивать
//           `viewerIsOwner()` — см. переписанную проверку в блоке про критерий 17 выше;
// 12, 14 — у персоналии со снимком последним в читательской колонке стоит блок
//          «Фотография», после «Источников»; у персоналии без снимка блока нет;
// 21, 24 — «Основные работы» и «Источники» — `<details>` без `open`, и «Основные работы»
//          в свёрнутом виде говорят, сколько внутри работ;
// 22 — каждое произведение в «Методе в произведениях» свёрнуто по отдельности,
//      а заголовок самого раздела виден всегда;
// 23 — «О человеке» и каждый метод целиком не сворачиваются и элемента управления
//      не имеют: это и есть та половина правила, из-за которой сворачивание вообще
//      имеет смысл — свёрнуто ровно то, что перечислено, и ничего сверх;
// 26 — в шапке рядом с «Персоналиями» есть пункт «О проекте»;
// 34 — превью ссылки: имя, аннотация, фотография, свой адрес и тип `article`.
//
// Про `<details>` в jsdom. Содержимое свёрнутой секции из DOM там не пропадает
// и стилями не прячется, поэтому «не видно» здесь не проверяется и проверяться не может:
// такая проверка была бы зелёной при любой реализации. Проверяется контракт разметки —
// есть `<details>`, атрибута `open` нет, заголовок в `<summary>`. Само сворачивание
// смотрится живым прогоном в браузере, на всех трёх персоналиях базы (критерий 25).
//
// Сборку описания превью делает чистая функция `pageMetadata` из '@/lib/site', и её
// контракт держат тесты этого модуля. Здесь — только то, что страница позвала её со
// своими данными. `generateMetadata` и '@/lib/site' подгружаются динамически:
// пока их нет, красным должен быть этот блок, а не весь файл.

/** Кредит снимка в той форме, в какой его отдаёт Викисклад: имя автора не переводится
 *  и не транслитерируется — это юридическое указание авторства, а не текст о человеке. */
const PHOTO_CREDIT = {
  author: 'Niccolò Caranti',
  licence: 'CC BY-SA 4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  fileUrl: 'https://commons.wikimedia.org/wiki/File:Mamoru_Oshii_2017.jpg',
  modified: true,
};

/** Осии со снимком и кредитом к нему: с v11 одно без другого не заводится. */
function insertOshiiWithCredit(): Person {
  return insertPerson({
    slug: 'mamoru-oshii',
    nameRu: 'Мамору Осии',
    photoPath: '/people/mamoru-oshii.jpg',
    photoCredit: PHOTO_CREDIT,
    roles: ['director'],
    notableWorks: [
      { title: 'Призрак в доспехах', year: 1995 },
      { title: 'Авалон', year: 2001 },
    ],
    annotation: 'Тридцать лет снимает про то, что у кино нет реальности.',
    method: METHOD,
    workNotes: WORKS,
    sources: [
      { publication: 'Sight & Sound', title: 'Разговор с Осии', url: 'https://example.com/s' },
    ],
    searchedAt: '2026-08-23',
  });
}

/** Свёрнутая секция, чей заголовок содержит заданный текст. */
function detailsTitled(container: HTMLElement, text: string): HTMLDetailsElement | undefined {
  return Array.from(container.querySelectorAll('details')).find((node) =>
    (node.querySelector('summary')?.textContent ?? '').includes(text),
  );
}

/** Подвал стоит последним в `<main>`: после него в разметке страницы ничего нет. */
function footerIsLast(container: HTMLElement): boolean {
  const area = container.querySelector('main');
  if (!area) return false;
  const footer = area.querySelector('footer');
  if (!footer) return false;

  let node: Element | null = footer;
  while (node !== null && node !== area) {
    if (node.nextElementSibling !== null) return false;
    node = node.parentElement;
  }
  return true;
}

describe('страница персоналии: подвал (критерии 1, 2 и 3 версии v11)', () => {
  beforeEach(() => {
    insertOshii();
  });

  it('подвал на странице есть', async () => {
    const container = await renderPage('mamoru-oshii');

    expect(container.querySelector('footer')).not.toBeNull();
    // portable 22.09.2026: имя владельца — личное поле site.config.ts, пустое
    // по умолчанию, поэтому надпись сверяется без него.
    expect(container.textContent).toContain('Каталог фильмов');
  });

  it('подвал стоит внутри <main> последним', async () => {
    const container = await renderPage('mamoru-oshii');

    expect(footerIsLast(container)).toBe(true);
  });

  it('гостю показана ссылка «Войти»', async () => {
    session.viewerIsOwner.mockResolvedValue(false);

    const container = await renderPage('mamoru-oshii');

    expect(within(container).getByRole('link', { name: /Войти/i })).toHaveAttribute(
      'href',
      '/owner/login',
    );
    expect(within(container).queryByRole('link', { name: /Выйти/i })).toBeNull();
  });

  it('владельцу показана ссылка «Выйти»', async () => {
    session.viewerIsOwner.mockResolvedValue(true);

    const container = await renderPage('mamoru-oshii');

    expect(within(container).getByRole('link', { name: /Выйти/i })).toHaveAttribute(
      'href',
      '/owner/logout',
    );
    expect(within(container).queryByRole('link', { name: /Войти/i })).toBeNull();
  });

  // portable 22.09.2026: кейс «ссылки автора в подвале на месте» снят — личный сайт автора
  // и телеграм-канал автора были жёстко вшиты, теперь подвал их не несёт вовсе.
});

// portable 22.09.2026: `страница персоналии: пункт «О проекте» в шапке (критерий 26
// версии v11)` — кейс про пункт «О проекте» снят целиком, страницы нет в отчуждаемой
// копии; проверка активного состояния «Персоналии» сохранена — эта поверхность осталась.
describe('страница персоналии: пункт «Персоналии» отмечен активным', () => {
  beforeEach(() => {
    insertOshii();
  });

  it('на странице человека «Персоналии» отмечены текущим разделом', async () => {
    const container = await renderPage('mamoru-oshii');

    expect(within(container).getByRole('link', { name: /^Персоналии/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});

describe('страница персоналии: блок «Фотография» (критерии 12 и 14 версии v11)', () => {
  it('у персоналии со снимком блок есть', async () => {
    insertOshiiWithCredit();

    const container = await renderPage('mamoru-oshii');

    expect(within(container).getByRole('heading', { name: 'Фотография' })).toBeInTheDocument();
  });

  it('в блоке названы автор и лицензия ссылками', async () => {
    insertOshiiWithCredit();

    const container = await renderPage('mamoru-oshii');

    expect(within(container).getByRole('link', { name: 'Niccolò Caranti' })).toHaveAttribute(
      'href',
      PHOTO_CREDIT.fileUrl,
    );
    expect(within(container).getByRole('link', { name: 'CC BY-SA 4.0' })).toHaveAttribute(
      'href',
      PHOTO_CREDIT.licenceUrl,
    );
  });

  it('блок стоит после «Источников»', async () => {
    insertOshiiWithCredit();

    const container = await renderPage('mamoru-oshii');
    const sources = within(container).getByRole('heading', { name: /Источники/ });
    const photo = within(container).getByRole('heading', { name: 'Фотография' });

    expect(
      sources.compareDocumentPosition(photo) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('блок не свёрнут: он не внутри <details> (критерий 13)', async () => {
    insertOshiiWithCredit();

    const container = await renderPage('mamoru-oshii');
    const photo = within(container).getByRole('heading', { name: 'Фотография' });

    expect(photo.closest('details')).toBeNull();
  });

  it('у персоналии без снимка блока нет (критерий 14)', async () => {
    insertPerson({
      slug: 'moko-chan',
      nameRu: 'Моко-тян',
      roles: ['designer'],
      photoPath: null,
      annotation: 'Дизайнер персонажей.',
    });

    const container = await renderPage('moko-chan');

    expect(within(container).queryByRole('heading', { name: 'Фотография' })).toBeNull();
  });
});

describe('страница персоналии: что сворачивается (критерии 21, 22 и 24 версии v11)', () => {
  beforeEach(() => {
    insertOshii();
    insertFilm({ titleRu: 'Авалон', titleOriginal: 'Avalon', releaseDate: '2001-01-20' });
  });

  it('«Основные работы» — <details> без атрибута open', async () => {
    const container = await renderPage('mamoru-oshii');
    const section = detailsTitled(container, 'Основные работы');

    expect(section, 'раздел «Основные работы» не свёрнут').toBeDefined();
    expect(section!.hasAttribute('open')).toBe(false);
  });

  it('в свёрнутом виде «Основные работы» говорят, сколько внутри работ', async () => {
    const container = await renderPage('mamoru-oshii');
    const summary = detailsTitled(container, 'Основные работы')?.querySelector('summary');

    expect(summary?.textContent).toMatch(/2\s+работы/);
  });

  it('«Источники» — <details> без атрибута open', async () => {
    const container = await renderPage('mamoru-oshii');
    const section = detailsTitled(container, 'Источники');

    expect(section, 'раздел «Источники» не свёрнут').toBeDefined();
    expect(section!.hasAttribute('open')).toBe(false);
  });

  it('«Источники» переведены на нативное сворачивание: кнопки у них больше нет', async () => {
    const container = await renderPage('mamoru-oshii');
    const section = detailsTitled(container, 'Источники');

    expect(section!.querySelector('button')).toBeNull();
  });

  it('каждое произведение свёрнуто по отдельности', async () => {
    const container = await renderPage('mamoru-oshii');

    for (const title of ['Авалон', 'Ангельское яйцо']) {
      const work = detailsTitled(container, title);
      expect(work, `работа «${title}» не свёрнута`).toBeDefined();
      expect(work!.hasAttribute('open')).toBe(false);
    }
  });

  it('заголовок раздела «Метод в произведениях» виден всегда', async () => {
    const container = await renderPage('mamoru-oshii');
    const heading = within(container).getByRole('heading', { name: 'Метод в произведениях' });

    expect(heading.closest('details')).toBeNull();
  });

  it('ссылка на карточку лежит внутри содержимого, а не в заголовке', async () => {
    const container = await renderPage('mamoru-oshii');
    const link = within(container).getByRole('link', { name: /Смотреть карточку в базе/i });

    expect(link.closest('summary')).toBeNull();
    expect(link.closest('details')).toBe(detailsTitled(container, 'Авалон'));
  });
});

describe('страница персоналии: что не сворачивается (критерий 23 версии v11)', () => {
  beforeEach(() => {
    insertOshii();
  });

  it('«О человеке» не обёрнут в <details>', async () => {
    const container = await renderPage('mamoru-oshii');
    const heading = within(container).getByRole('heading', { name: 'О человеке' });

    expect(heading.closest('details')).toBeNull();
  });

  it('«Творческий метод» не обёрнут в <details>', async () => {
    const container = await renderPage('mamoru-oshii');
    const heading = within(container).getByRole('heading', { name: 'Творческий метод' });

    expect(heading.closest('details')).toBeNull();
  });

  it('сам метод со всеми тезисами не сворачивается', async () => {
    const container = await renderPage('mamoru-oshii');

    expect(within(container).getByRole('heading', { name: 'Метод' }).closest('details')).toBeNull();
    expect(
      within(container).getByRole('heading', { name: 'У кино нет реальности' }).closest('details'),
    ).toBeNull();
  });
});

describe('страница персоналии: превью ссылки (критерий 34 версии v11)', () => {
  async function metadataOf(slug: string): Promise<Record<string, unknown>> {
    const page = await import('@/app/people/[slug]/page');
    const meta = await page.generateMetadata({ params: Promise.resolve({ slug }) });
    return meta as unknown as Record<string, unknown>;
  }

  async function openGraphOf(slug: string): Promise<Record<string, unknown>> {
    const og = (await metadataOf(slug)).openGraph;
    expect(og, 'у страницы персоналии нет openGraph').toBeDefined();
    return og as Record<string, unknown>;
  }

  it('заголовок превью — имя человека, без приписки имени сайта', async () => {
    insertOshii();

    expect((await openGraphOf('mamoru-oshii')).title).toBe('Мамору Осии');
  });

  it('заголовок вкладки при этом остаётся прежним по форме', async () => {
    insertOshii();

    expect((await metadataOf('mamoru-oshii')).title).toBe('Мамору Осии — Кино База');
  });

  it('описание превью — аннотация', async () => {
    insertOshii();

    expect((await openGraphOf('mamoru-oshii')).description).toBe(
      'Тридцать лет снимает про то, что у кино нет реальности.',
    );
  });

  it('картинка превью — фотография человека', async () => {
    insertOshii();

    expect(JSON.stringify((await openGraphOf('mamoru-oshii')).images)).toContain(
      '/people/mamoru-oshii.jpg',
    );
  });

  it('адрес превью — адрес самой страницы, тип — article', async () => {
    insertOshii();
    const og = await openGraphOf('mamoru-oshii');

    expect(og.url).toBe('/people/mamoru-oshii');
    expect(og.type).toBe('article');
  });

  it('у персоналии без аннотации описание — общее описание сайта', async () => {
    const { SITE_DESCRIPTION } = await import('@/lib/site');
    insertPerson({ slug: 'moko-chan', nameRu: 'Моко-тян', roles: ['designer'] });

    expect((await openGraphOf('moko-chan')).description).toBe(SITE_DESCRIPTION);
  });

  it('у персоналии без фотографии ключа images нет вовсе', async () => {
    insertPerson({ slug: 'moko-chan', nameRu: 'Моко-тян', roles: ['designer'] });

    expect('images' in (await openGraphOf('moko-chan'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Дополнение v14 (31.08.2026), критерии приёмки 24 и 25 на уровне страницы: признак
// режима «глазами гостя» доезжает до подвала.
//
// Сам подвал проверяется в tests/site-footer.test.tsx — здесь проверяется другое и
// проверяется потому, что забыть это легко: подвал стоит на шести страницах, и второй
// признак ему передаёт каждая из них по отдельности. Страница, забывшая передать,
// покажет владельцу «Админку» и «Выйти» в режиме гостя — то есть ровно то, ради
// отсутствия чего режим и заведён.
//
// Проверяется наблюдаемое поведение подвала, а не переданный проп: тест не знает,
// как страница зовёт признак, он видит только то, что видно читателю.

describe('страница персоналии: режим «глазами гостя» в подвале (критерии 24 и 25)', () => {
  const guestViewLink = (container: HTMLElement): HTMLElement | undefined =>
    within(container)
      .queryAllByRole('link')
      .find((link) => /Посмотреть глазами гостя/i.test(link.textContent ?? ''));

  const ownerViewLink = (container: HTMLElement): HTMLElement | undefined =>
    within(container)
      .queryAllByRole('link')
      .find((link) => /Вернуться к своему виду/i.test(link.textContent ?? ''));

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
      .find((link) => pattern.test(link.textContent ?? ''));

  beforeEach(() => {
    insertPerson({ slug: 'mamoru-oshii', nameRu: 'Мамору Осии', roles: ['director'] });
  });

  it('владельцу вне режима показан переключатель', async () => {
    session.viewerIsOwner.mockResolvedValue(true);

    const container = await renderPage('mamoru-oshii');

    expect(guestViewLink(container)).toBeDefined();
  });

  it('в режиме гостя подвал несёт строку «Глазами гостя» (критерий 25)', async () => {
    session.viewerIsOwner.mockResolvedValue(false);
    session.guestViewOn.mockResolvedValue(true);

    const container = await renderPage('mamoru-oshii');

    expect(modeMark(container), 'в подвале нет пометки режима').toBeDefined();
  });

  it('в режиме гостя есть ссылка возврата (критерий 25)', async () => {
    session.viewerIsOwner.mockResolvedValue(false);
    session.guestViewOn.mockResolvedValue(true);

    const container = await renderPage('mamoru-oshii');
    const back = ownerViewLink(container);

    expect(back).toBeDefined();
    expect((back!.getAttribute('href') ?? '').startsWith('/owner/owner-view')).toBe(true);
  });

  it('в режиме гостя нет ни «Админки», ни «Выйти» (критерий 25)', async () => {
    session.viewerIsOwner.mockResolvedValue(false);
    session.guestViewOn.mockResolvedValue(true);

    const container = await renderPage('mamoru-oshii');

    expect(named(container, /Админка/i)).toBeUndefined();
    expect(named(container, /Выйти/i)).toBeUndefined();
  });

  it('обычному гостю пометки режима не показывают (критерий 24)', async () => {
    session.viewerIsOwner.mockResolvedValue(false);

    const container = await renderPage('mamoru-oshii');

    expect(modeMark(container)).toBeUndefined();
    expect(guestViewLink(container)).toBeUndefined();
  });
});
