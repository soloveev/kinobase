// Критерии приёмки 4 и 5 версии v6 — что видит гость на странице фильма:
// 4 — постер, название, теги, выходные данные, аннотация, создатели, досье и разбор,
//     плашка статуса, плашка оценки и звёздочка гостю показаны;
// 5 — в исходном коде страницы, полученной гостем, нет ни секции «Моё», ~~ни текста
//     комментария,~~ ни органов правки. Не скрыты стилями — не отправлены вовсе.
//
//     Правка 31.08.2026 по критериям приёмки 1 и 5 версии v14. Комментарий владельца
//     перестал быть личной запиской и стал частью карточки: он показывается всем, курсивом
//     и с подписью. Уходит из формулировки ровно одно слагаемое — текст комментария;
//     секция «Моё» и органы правки гостю по-прежнему не отправляются, и запрет на них
//     стережётся теми же проверками. Это решение владельца от 31.08.2026, а не регрессия:
//     до v14 комментарий был единственным местом, где в базе звучал его собственный голос,
//     и не доходил до читателя вовсе.
//
// Как это проверяется. Сначала фиксируется база сравнения: <PersonalFields /> —
// единственный носитель личного, и в его разметке действительно есть и заголовок
// «Моё», и текст комментария, и все органы правки. Если бы это было не так,
// проверки отсутствия ниже ничего не стоили бы. Затем рендерится сама страница —
// гостю и владельцу — и сравнивается, что в ней есть.
//
// Страница — асинхронный серверный компонент; она ходит в базу и в куки, поэтому
// подменяются ровно два источника: '@/db' отдаёт настоящую базу в памяти (та же
// фабрика createDb, что во всех тестах хранилища), 'next/headers' — одну куку.
// Мокирование 'next/navigation' техническое: PersonalFields — клиентский компонент
// и просит useRouter, а страница — notFound.
//
// Признак владельца страница берёт из куки OWNER_COOKIE и сверяет с секретом
// в переменной окружения OWNER_TOKEN — так это описано в плане v6.

// Дополнение v7, критерии приёмки 15 и 16 — карточка фильма узнаёт о персоналиях:
// 15 — имя, у которого есть персоналия, становится ссылкой на её страницу; имена без
//      персоналии остаются простым текстом, в том числе в той же строке рядом со ссылкой.
//      Сопоставление идёт по связям `film_people` этого фильма, а не по угадыванию:
//      строки «Создатели» по-прежнему печатают текстовые поля, и связь отвечает
//      на единственный вопрос — какое из уже напечатанных имён сделать ссылкой;
// 16 — в карточке есть строка «Композитор», между «Сценаристом» и «Звукорежиссёром».
//
// Дополнение: правка от 23.08.2026, критерий приёмки 23 — год у неоднозначного названия.
// Если в базе больше одного тайтла с таким же русским названием, заголовок карточки несёт
// год в скобках: «Призрак в доспехах (1995)». Уникальное название не меняется, а `titleRu`
// в базе остаётся настоящим названием — год приписывается только при показе.
//
// Неоднозначность — свойство базы целиком, поэтому набор одноимённых названий считает
// страница: она и так ходит в базу. Здесь это и проверяется — не чистое правило (оно
// живёт в '@/lib/titles' и покрыто tests/titles.test.ts), а то, что страница набор
// действительно посчитала и заголовок им разрешила.

// Строки создателей отделяются от выходных данных по разделу «Создатели»: определительный
// список там не единственный на странице, и порядок строк проверяется внутри своей секции.
//
// Правка от 23.08.2026 (спека v7, раздел 6.2). Разделение гостя и владельца существует
// только в боевой сборке: локальная база — личная копия владельца, и вне production
// `viewerIsOwner` возвращает `true` без куки. Поэтому здесь окружение объявляется
// боевым явно — иначе тесты проверяли бы не то, что описывают.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { createDb, type Db } from '@/db';
import { films, filmPeople, people, type Film } from '@/db/schema';
import PersonalFields from '@/components/PersonalFields';
import FilmPage from '@/app/films/[id]/page';
import { filmValues, personValues } from './helpers';

const SECRET = 'a7f3c1e9b40d2856a7f3c1e9b40d2856';
const COMMENT = 'Личная заметка про финал, которую видеть никому не надо';
const RELEASED = '2001-04-11';

vi.hoisted(() => {
  process.env.OWNER_TOKEN = 'a7f3c1e9b40d2856a7f3c1e9b40d2856';
});

const state = vi.hoisted(() => ({
  db: null as unknown,
  cookie: undefined as string | undefined,
  // v14: вторая кука — признак режима «глазами гостя».
  guestView: false,
}));

vi.mock('@/db', async () => {
  const actual = await vi.importActual<typeof import('@/db')>('@/db');
  return { ...actual, getDb: () => state.db };
});

vi.mock('next/headers', () => {
  const value = (name: string): string | undefined => {
    if (name === 'kinobase_owner') return state.cookie;
    if (name === 'kinobase_guest_view') return state.guestView ? '1' : undefined;
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
let film: Film;

/** Разметка страницы фильма для текущего посетителя. */
async function renderPage(): Promise<HTMLElement> {
  const params = Promise.resolve({ id: String(film.id) });
  const { container } = render(await FilmPage({ params }));
  return container;
}

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('OWNER_TOKEN', SECRET);
  db = createDb(':memory:');
  state.db = db;
  state.cookie = undefined;
  state.guestView = false;
  film = db
    .insert(films)
    .values(
      filmValues({
        titleRu: 'Малхолланд Драйв',
        titleOriginal: 'Mulholland Drive',
        releaseDate: RELEASED,
        annotation: 'Певица приезжает в Лос-Анджелес и теряет там себя.',
        director: 'Дэвид Линч',
        imdbRating: 7.9,
        watched: true,
        myRating: 9,
        tasteStar: true,
        comment: COMMENT,
        tags: ['drama'],
      }),
    )
    .returning()
    .all()[0];
});

afterEach(() => {
  vi.unstubAllEnvs();
  cleanup();
});

/** «Сегодня» секция получает пропом со страницы фильма: с 15.09.2026 (рефакторинг,
 *  находка 15) она не вызывает `todayIso()` внутри себя — правило «сегодня приходит
 *  с сервера» записано в `DossierSection.tsx` и было соблюдено только `DossierZone`.
 *  Дата тайтла в этих тестах давняя, и на разметку значение не влияет. */
const TODAY = '2026-09-15';

describe('база сравнения: что именно несёт секция «Моё»', () => {
  it('в разметке PersonalFields есть заголовок «Моё»', () => {
    render(<PersonalFields film={film} today={TODAY} />);

    expect(screen.getByRole('heading', { name: 'Моё' })).toBeInTheDocument();
  });

  it('в разметке PersonalFields есть текст комментария', () => {
    const { container } = render(<PersonalFields film={film} today={TODAY} />);

    expect(container.innerHTML).toContain(COMMENT);
  });

  // Правка 31.08.2026 по критерию приёмки 11 версии v14. Прежняя редакция ждала
  // ~~`container.querySelector('textarea')` не пустым всегда~~ — поле комментария стояло
  // в секции раскрытым при любом её состоянии. Теперь у блока два вида, и у фильма
  // с непустым комментарием (а он здесь непустой) поля ввода в разметке нет: есть
  // кнопка «Редактировать». Она и встаёт в перечень органов правки вместо поля.
  it('в разметке PersonalFields есть органы правки', () => {
    const { container } = render(<PersonalFields film={film} today={TODAY} />);

    expect(container.querySelectorAll('input[type="checkbox"]').length).toBeGreaterThan(0);
    expect(screen.getByRole('switch', { name: /зв[её]здочка/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Оценка 9' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Редактировать/i })).toBeInTheDocument();
  });

  it('у фильма без комментария в PersonalFields есть раскрытое поле правки', () => {
    const { container } = render(<PersonalFields film={{ ...film, comment: null }} today={TODAY} />);

    expect(container.querySelector('textarea')).not.toBeNull();
  });

  // Рефакторинг 15.09.2026, находка 15: дату секция получает от страницы, и отвечает
  // она на неё, а не на системные часы. Страница считает «сегодня» на сервере — тем же
  // `todayIso()`, которым считает его для `DossierZone`, — и отдаёт обоим одно значение.
  it('невышедший на переданную дату фильм оценить нельзя, вышедший — можно', () => {
    const soon = { ...film, releaseDate: '2026-09-20', myRating: null };

    const before = render(<PersonalFields film={soon} today="2026-09-15" />);
    expect(screen.getByRole('button', { name: 'Оценка 9' })).toBeDisabled();
    before.unmount();

    render(<PersonalFields film={soon} today="2026-09-25" />);
    expect(screen.getByRole('button', { name: 'Оценка 9' })).not.toBeDisabled();
  });
});

describe('страница фильма: справочная часть открыта гостю', () => {
  it('название показано', async () => {
    const container = await renderPage();

    expect(within(container).getByRole('heading', { name: 'Малхолланд Драйв' })).toBeInTheDocument();
  });

  it('оригинальное название, аннотация и создатели показаны', async () => {
    const container = await renderPage();

    expect(container.textContent).toContain('Mulholland Drive');
    expect(container.textContent).toContain('Певица приезжает в Лос-Анджелес');
    expect(container.textContent).toContain('Дэвид Линч');
  });

  it('выходные данные показаны', async () => {
    const container = await renderPage();

    expect(container.textContent).toContain('IMDb');
    expect(container.textContent).toContain('7,9');
    expect(container.textContent).toContain('11 апреля 2001');
  });

  it('теги показаны', async () => {
    const container = await renderPage();

    expect(container.textContent).toContain('драма');
  });

  it('плашки статуса и оценки показаны — оценка остаётся публичной', async () => {
    const container = await renderPage();

    expect(container.textContent).toContain('Посмотрел');
    expect(within(container).getAllByText('9').length).toBeGreaterThan(0);
  });
});

describe('страница фильма: гость не получает секции «Моё»', () => {
  it('заголовка «Моё» в разметке нет', async () => {
    const container = await renderPage();

    expect(within(container).queryByRole('heading', { name: 'Моё' })).toBeNull();
  });

  // Правка 31.08.2026, критерий приёмки 1 версии v14. Прежняя редакция:
  // ~~«текста комментария в исходном коде страницы нет»: `container.innerHTML` не должен
  // был содержать ни COMMENT, ни слов «Личная заметка».~~ Отменено спекой v14: комментарий
  // владельца открыт читателю. Проверка не выброшена, а перевёрнута — текст теперь обязан
  // быть в разметке гостя, и стережёт это тест в блоке «голос владельца» ниже.

  it('органов правки в разметке нет (критерий 5)', async () => {
    const container = await renderPage();

    expect(container.querySelector('textarea')).toBeNull();
    expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
    expect(within(container).queryByRole('switch', { name: /зв[её]здочка/i })).toBeNull();
    expect(within(container).queryByRole('button', { name: 'Оценка 9' })).toBeNull();
  });

  it('чужая кука владельцем не делает', async () => {
    state.cookie = 'a7f3c1e9b40d2856a7f3c1e9b40d2857';

    const container = await renderPage();

    expect(within(container).queryByRole('heading', { name: 'Моё' })).toBeNull();
    expect(container.querySelector('textarea')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Дополнение v14, критерии приёмки 1, 2 и 5 — голос владельца на карточке:
// 1 — у фильма с непустым комментарием гость видит текст; у фильма с пустым —
//     не видит ни блока, ни подписи под ним;
// 2 — гостю блок стоит сразу после выходных данных и до читательской зоны;
// 5 — в разметке гостя нет ни кнопки «Редактировать», ни поля ввода.
//
// Место проверяется порядком в разметке, а не отступами: hairline-линейка сверху, курсив
// и мера в 65 знаков — это CSS, и в jsdom его нет. Якоря выбраны те, что названы спекой:
// выходные данные (строка «Дата выхода» в `FilmFacts`) и начало читательской зоны
// (заголовок «О фильме»).

describe('карточка фильма: комментарий владельца виден гостю (критерии 1, 2 и 5)', () => {
  /** Порядок элемента в разметке страницы: чем меньше число, тем выше по документу. */
  function documentOrder(container: HTMLElement, element: Element): number {
    return [...container.querySelectorAll('*')].indexOf(element);
  }

  // portable 22.09.2026: имя владельца и ссылка на его блог — личные поля из
  // site.config.ts; у отчуждаемой копии оба пустые по умолчанию, и подпись под
  // комментарием — не ссылка, а текст-заглушка «Владелец базы» (см. FilmComment).
  const SIGNATURE_TEXT = 'Владелец базы';

  /** Подпись под комментарием — единственный текстовый узел с этим содержимым. */
  function signature(container: HTMLElement): HTMLElement {
    return within(container).getByText(SIGNATURE_TEXT);
  }

  /** Строка выходных данных: конец справочной части карточки. */
  function facts(container: HTMLElement): HTMLElement {
    const found = [...container.querySelectorAll('dt')].find(
      (item) => (item.textContent ?? '').trim() === 'Дата выхода',
    );
    if (!found) throw new Error('на карточке нет строки «Дата выхода»');
    return found as HTMLElement;
  }

  /** Начало читательской зоны: первый её заголовок. */
  function readingZone(container: HTMLElement): HTMLElement {
    return within(container).getByRole('heading', { name: 'О фильме' });
  }

  it('текст комментария показан гостю (критерий 1)', async () => {
    const container = await renderPage();

    expect(container.textContent).toContain(COMMENT);
  });

  // portable 22.09.2026: кейс «под текстом стоит подпись со ссылкой на блог» снят —
  // проверял жёстко вшитый адрес личный сайт автора и слова «автор блога», которых больше
  // нет; поведение подписи от site.config.ts проверяет tests/site-config.test.tsx.
  it('под текстом стоит подпись владельца (критерии 7 и 9)', async () => {
    const container = await renderPage();

    expect(signature(container)).toBeInTheDocument();
  });

  it('у фильма с пустым комментарием блока нет (критерий 1)', async () => {
    db.update(films).set({ comment: null }).run();

    const container = await renderPage();

    expect(within(container).queryByText(SIGNATURE_TEXT)).toBeNull();
  });

  it('комментарий из одних пробелов блока не показывает (критерий 1)', async () => {
    db.update(films).set({ comment: '   ' }).run();

    const container = await renderPage();

    expect(within(container).queryByText(SIGNATURE_TEXT)).toBeNull();
  });

  it('пустой комментарий заглушкой не подменяется (критерий 1)', async () => {
    db.update(films).set({ comment: null }).run();

    const container = await renderPage();

    expect(container.textContent ?? '').not.toMatch(/мнени[яе] пока нет|комментария нет/i);
  });

  it('блок стоит после выходных данных (критерий 2)', async () => {
    const container = await renderPage();

    expect(documentOrder(container, signature(container))).toBeGreaterThan(
      documentOrder(container, facts(container)),
    );
  });

  it('блок стоит до читательской зоны (критерий 2)', async () => {
    const container = await renderPage();

    expect(documentOrder(container, signature(container))).toBeLessThan(
      documentOrder(container, readingZone(container)),
    );
  });

  it('в разметке гостя нет кнопки «Редактировать» (критерий 5)', async () => {
    const container = await renderPage();

    expect(within(container).queryByRole('button', { name: /Редактировать/i })).toBeNull();
    expect(container.innerHTML).not.toContain('Редактировать');
  });

  it('в разметке гостя нет поля ввода комментария (критерий 5)', async () => {
    const container = await renderPage();

    expect(container.querySelector('textarea')).toBeNull();
    expect(within(container).queryByRole('textbox')).toBeNull();
  });

  it('секции «Моё» гостю по-прежнему не приходит (критерий 5)', async () => {
    const container = await renderPage();

    expect(within(container).queryByRole('heading', { name: 'Моё' })).toBeNull();
  });
});

describe('страница фильма: владелец получает секцию «Моё» целиком', () => {
  beforeEach(() => {
    state.cookie = SECRET;
  });

  it('заголовок «Моё» показан', async () => {
    const container = await renderPage();

    expect(within(container).getByRole('heading', { name: 'Моё' })).toBeInTheDocument();
  });

  it('текст комментария показан', async () => {
    const container = await renderPage();

    expect(container.innerHTML).toContain(COMMENT);
  });

  // Правка 31.08.2026, критерий приёмки 11 версии v14: у тайтла с непустым комментарием
  // поля ввода в разметке нет — ~~`container.querySelector('textarea')`~~ уступил место
  // кнопке «Редактировать». Прочие органы правки на месте и проверяются как прежде.
  it('органы правки показаны', async () => {
    const container = await renderPage();

    expect(container.querySelectorAll('input[type="checkbox"]').length).toBeGreaterThan(0);
    expect(within(container).getByRole('switch', { name: /зв[её]здочка/i })).toBeInTheDocument();
    expect(within(container).getByRole('button', { name: 'Оценка 9' })).toBeInTheDocument();
    expect(within(container).getByRole('button', { name: /Редактировать/i })).toBeInTheDocument();
  });

  // Критерий приёмки 3: у владельца блок стоит последним в секции «Моё», то есть внутри
  // неё, а не отдельным разделом карточки, как у гостя.
  it('блок комментария лежит внутри секции «Моё» (критерий 3)', async () => {
    const container = await renderPage();
    const section = within(container)
      .getByRole('heading', { name: 'Моё' })
      .closest('section');

    expect(section).not.toBeNull();
    expect(section!.textContent).toContain(COMMENT);
    // portable 22.09.2026: подпись — имя владельца из site.config.ts, у отчуждаемой
    // копии по умолчанию пустое, и подпись — заглушка «Владелец базы».
    expect(section!.textContent).toContain('Владелец базы');
  });

  it('справочная часть никуда не делась', async () => {
    const container = await renderPage();

    expect(container.textContent).toContain('Дэвид Линч');
  });
});

describe('карточка фильма: композитор и имена-ссылки (критерии 15 и 16)', () => {
  let gits: Film;

  function insertPerson(values: Parameters<typeof personValues>[0], role: string): void {
    const person = db.insert(people).values(personValues(values)).returning().all()[0];
    db.insert(filmPeople).values({ filmId: gits.id, personId: person.id, role }).run();
  }

  /** Разметка карточки «Призрака в доспехах». */
  async function renderGits(): Promise<HTMLElement> {
    const params = Promise.resolve({ id: String(gits.id) });
    const { container } = render(await FilmPage({ params }));
    return container;
  }

  /** Секция «Создатели» — строки создателей живут только в ней. */
  function creators(container: HTMLElement): HTMLElement {
    const heading = within(container).getByRole('heading', { name: 'Создатели' });
    return heading.closest('section') as HTMLElement;
  }

  /** Значение строки создателей по её подписи. */
  function row(container: HTMLElement, label: string): HTMLElement {
    const section = creators(container);
    const dt = Array.from(section.querySelectorAll('dt')).find(
      (item) => (item.textContent ?? '').trim() === label,
    );
    if (!dt) throw new Error(`в разделе «Создатели» нет строки «${label}»`);
    const dd = dt.parentElement?.querySelector('dd');
    if (!dd) throw new Error(`у строки «${label}» нет значения`);
    return dd as HTMLElement;
  }

  beforeEach(() => {
    gits = db
      .insert(films)
      .values(
        filmValues({
          titleRu: 'Призрак в доспехах',
          titleOriginal: 'Ghost in the Shell',
          releaseDate: '1995-11-18',
          director: 'Мамору Осии',
          producer: 'Ясухиса Кадзама',
          screenwriter: 'Кадзунори Ито, Мамору Осии',
          composer: 'Кэндзи Каваи',
          soundDesigner: 'Кадзухиро Вакабаяси',
          cast: ['Ацуко Танака', 'Акио Оцука'],
        }),
      )
      .returning()
      .all()[0];

    insertPerson(
      { slug: 'mamoru-oshii', nameRu: 'Мамору Осии', roles: ['director', 'screenwriter'] },
      'director',
    );
    insertPerson({ slug: 'atsuko-tanaka', nameRu: 'Ацуко Танака', roles: ['actor'] }, 'actor');
  });

  it('строка «Композитор» есть и заполнена', async () => {
    const container = await renderGits();

    expect(row(container, 'Композитор')).toHaveTextContent('Кэндзи Каваи');
  });

  it('«Композитор» стоит между «Сценаристом» и «Звукорежиссёром»', async () => {
    const container = await renderGits();
    const labels = Array.from(creators(container).querySelectorAll('dt')).map(
      (item) => (item.textContent ?? '').trim(),
    );

    expect(labels).toEqual([
      'Режиссёр',
      'Продюсер',
      'Сценарист',
      'Композитор',
      'Звукорежиссёр',
      'В ролях',
    ]);
  });

  it('у фильма без композитора строки «Композитор» нет', async () => {
    const container = await renderPage();

    expect(container.textContent).not.toContain('Композитор');
  });

  it('имя со связанной персоналией — ссылка на её страницу', async () => {
    const container = await renderGits();
    const director = within(row(container, 'Режиссёр')).getByRole('link', { name: 'Мамору Осии' });

    expect(director).toHaveAttribute('href', '/people/mamoru-oshii');
  });

  it('имя без персоналии остаётся простым текстом', async () => {
    const container = await renderGits();
    const composer = row(container, 'Композитор');

    expect(composer).toHaveTextContent('Кэндзи Каваи');
    expect(within(composer).queryByRole('link')).toBeNull();
  });

  it('в одной строке ссылкой становится только знакомое имя', async () => {
    const container = await renderGits();
    const screenwriter = row(container, 'Сценарист');

    expect(screenwriter).toHaveTextContent('Кадзунори Ито');
    expect(within(screenwriter).getAllByRole('link')).toHaveLength(1);
    expect(within(screenwriter).getByRole('link', { name: 'Мамору Осии' })).toHaveAttribute(
      'href',
      '/people/mamoru-oshii',
    );
  });

  it('правило распространяется и на строку «В ролях»', async () => {
    const container = await renderGits();
    const cast = row(container, 'В ролях');

    expect(cast).toHaveTextContent('Акио Оцука');
    expect(within(cast).getAllByRole('link')).toHaveLength(1);
    expect(within(cast).getByRole('link', { name: 'Ацуко Танака' })).toHaveAttribute(
      'href',
      '/people/atsuko-tanaka',
    );
  });

  it('у фильма без связей все имена остаются текстом', async () => {
    const container = await renderPage();
    const director = row(container, 'Режиссёр');

    expect(director).toHaveTextContent('Дэвид Линч');
    expect(within(director).queryByRole('link')).toBeNull();
  });
});

// Дополнение: правка от 23.08.2026, критерий приёмки 23.
describe('карточка фильма: год у неоднозначного названия', () => {
  /** Разметка карточки заданного фильма. */
  async function renderFilm(target: Film): Promise<HTMLElement> {
    const params = Promise.resolve({ id: String(target.id) });
    const { container } = render(await FilmPage({ params }));
    return container;
  }

  function insert(values: Parameters<typeof filmValues>[0]): Film {
    return db.insert(films).values(filmValues(values)).returning().all()[0];
  }

  it('заголовок одного из двух одноимённых тайтлов несёт свой год', async () => {
    const movie = insert({
      titleRu: 'Призрак в доспехах',
      titleOriginal: 'Ghost in the Shell',
      releaseDate: '1995-11-18',
    });
    insert({
      titleRu: 'Призрак в доспехах',
      titleOriginal: 'Ghost in the Shell: SAC_2045',
      releaseDate: '2026-01-15',
    });

    const container = await renderFilm(movie);

    expect(
      within(container).getByRole('heading', { level: 1, name: 'Призрак в доспехах (1995)' }),
    ).toBeInTheDocument();
  });

  it('заголовок второго одноимённого тайтла несёт год этого тайтла', async () => {
    insert({
      titleRu: 'Призрак в доспехах',
      titleOriginal: 'Ghost in the Shell',
      releaseDate: '1995-11-18',
    });
    const series = insert({
      titleRu: 'Призрак в доспехах',
      titleOriginal: 'Ghost in the Shell: SAC_2045',
      releaseDate: '2026-01-15',
    });

    const container = await renderFilm(series);

    expect(
      within(container).getByRole('heading', { level: 1, name: 'Призрак в доспехах (2026)' }),
    ).toBeInTheDocument();
  });

  it('заголовок уникального названия года не получает', async () => {
    const single = insert({
      titleRu: 'Авалон',
      titleOriginal: 'Avalon',
      releaseDate: '2001-01-20',
    });
    insert({ titleRu: 'Призрак в доспехах', releaseDate: '1995-11-18' });
    insert({ titleRu: 'Призрак в доспехах', releaseDate: '2026-01-15' });

    const container = await renderFilm(single);

    expect(within(container).getByRole('heading', { level: 1, name: 'Авалон' })).toBeInTheDocument();
  });

  it('неоднозначное название без даты выхода остаётся без года', async () => {
    const undated = insert({ titleRu: 'Призрак в доспехах', releaseDate: null });
    insert({ titleRu: 'Призрак в доспехах', releaseDate: '1995-11-18' });

    const container = await renderFilm(undated);

    expect(
      within(container).getByRole('heading', { level: 1, name: 'Призрак в доспехах' }),
    ).toBeInTheDocument();
  });

  it('год приписан только показу: в базе titleRu остался без года', async () => {
    const movie = insert({ titleRu: 'Призрак в доспехах', releaseDate: '1995-11-18' });
    insert({ titleRu: 'Призрак в доспехах', releaseDate: '2026-01-15' });

    await renderFilm(movie);

    const stored = db.select().from(films).all();

    expect(stored.map((row) => row.titleRu)).not.toContain('Призрак в доспехах (1995)');
  });
});

// ---------------------------------------------------------------------------
// Дополнение v11, критерии приёмки 1, 2, 3, 26, 31, 32 и 33 — карточка фильма
// как полноценная страница сайта:
// 1, 3 — подвал стоит последним элементом `<main>`;
// 2 — ссылка входа в подвале отражает признак посетителя: гостю «Войти»,
//     владельцу «Выйти». Карточка фильма — самая частая точка входа снаружи,
//     поэтому спека проверяет разделение именно здесь;
// portable 22.09.2026: пункт критерия 26 про «О проекте» в шапке снят — страницы
// «О проекте» в отчуждаемой копии нет.
// 31 — превью ссылки в мессенджере: название (с годом при неоднозначности),
//      аннотация, постер, свой адрес и тип `article`;
// 32 — у тайтла без аннотации описание — общее описание сайта, а не пустая строка;
// 33 — у тайтла без постера ключа `images` в превью нет вовсе.
//
// Признак посетителя здесь настоящий, а не подставленный: окружение уже объявлено
// боевым в общем beforeEach, и владельца от гостя отделяет кука — та же, что
// в проверках секции «Моё» выше. Отдельного мокирования сессии не требуется.
//
// Сборку описания делает чистая функция `pageMetadata` из '@/lib/site', и её контракт
// держат тесты этого модуля. Здесь проверяется другое: что страница позвала её со
// своими данными — с названием этого тайтла, его аннотацией и его постером, а не
// с общими для всего сайта. Модуль '@/lib/site' и `generateMetadata` подгружаются
// динамически внутри тестов: пока их нет, красным должен быть этот блок, а не весь файл.

describe('карточка фильма: подвал (критерии 1, 2 и 3 версии v11)', () => {
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

  it('подвал на карточке есть', async () => {
    const container = await renderPage();

    expect(container.querySelector('footer')).not.toBeNull();
    // portable 22.09.2026: имя владельца — личное поле site.config.ts, пустое
    // по умолчанию, поэтому надпись сверяется без него.
    expect(container.textContent).toContain('Каталог фильмов');
  });

  it('подвал стоит внутри <main> последним', async () => {
    const container = await renderPage();

    expect(footerIsLast(container)).toBe(true);
  });

  it('гостю в подвале показана ссылка «Войти»', async () => {
    const container = await renderPage();

    expect(within(container).getByRole('link', { name: /Войти/i })).toHaveAttribute(
      'href',
      '/owner/login',
    );
  });

  it('владельцу в подвале показана ссылка «Выйти»', async () => {
    state.cookie = SECRET;

    const container = await renderPage();

    expect(within(container).getByRole('link', { name: /Выйти/i })).toHaveAttribute(
      'href',
      '/owner/logout',
    );
  });

  it('одновременно обе надписи не показываются', async () => {
    const container = await renderPage();

    expect(within(container).queryByRole('link', { name: /Выйти/i })).toBeNull();
  });

  // portable 22.09.2026: кейс «ссылки автора в подвале на месте» снят — личный сайт автора
  // и телеграм-канал автора были жёстко вшиты, теперь подвал их не несёт вовсе.
});

// portable 22.09.2026: `карточка фильма: пункт «О проекте» в шапке (критерий 26
// версии v11)` — оба кейса про пункт «О проекте» снят целиком, страницы нет в
// отчуждаемой копии; кейс про «Персоналии» рядом сохранён — эта поверхность осталась.
describe('карточка фильма: пункты навигации в шапке', () => {
  it('«Персоналии» рядом никуда не делись', async () => {
    const container = await renderPage();

    expect(within(container).getByRole('link', { name: /^Персоналии/ })).toHaveAttribute(
      'href',
      '/people',
    );
  });
});

describe('карточка фильма: превью ссылки (критерии 31, 32 и 33 версии v11)', () => {
  async function metadataOf(target: Film): Promise<Record<string, unknown>> {
    const page = await import('@/app/films/[id]/page');
    const meta = await page.generateMetadata({ params: Promise.resolve({ id: String(target.id) }) });
    return meta as unknown as Record<string, unknown>;
  }

  async function openGraphOf(target: Film): Promise<Record<string, unknown>> {
    const og = (await metadataOf(target)).openGraph;
    expect(og, 'у карточки фильма нет openGraph').toBeDefined();
    return og as Record<string, unknown>;
  }

  function insert(values: Parameters<typeof filmValues>[0]): Film {
    return db.insert(films).values(filmValues(values)).returning().all()[0];
  }

  it('заголовок превью — название тайтла, без приписки имени сайта', async () => {
    const og = await openGraphOf(film);

    expect(og.title).toBe('Малхолланд Драйв');
  });

  it('заголовок вкладки при этом остаётся прежним по форме', async () => {
    const meta = await metadataOf(film);

    expect(meta.title).toBe('Малхолланд Драйв — Кино База');
  });

  it('описание превью — аннотация тайтла', async () => {
    const og = await openGraphOf(film);

    expect(og.description).toBe('Певица приезжает в Лос-Анджелес и теряет там себя.');
  });

  it('адрес превью — адрес самой карточки', async () => {
    const og = await openGraphOf(film);

    expect(og.url).toBe(`/films/${film.id}`);
  });

  it('тип страницы — article, а не website', async () => {
    const og = await openGraphOf(film);

    expect(og.type).toBe('article');
  });

  it('картинка превью — постер тайтла', async () => {
    const withPoster = insert({
      titleRu: 'Авалон',
      titleOriginal: 'Avalon',
      releaseDate: '2001-01-20',
      annotation: 'Игра затягивает сильнее жизни.',
      posterPath: '/posters/avalon.jpg',
    });

    const og = await openGraphOf(withPoster);

    expect(JSON.stringify(og.images)).toContain('/posters/avalon.jpg');
  });

  // Правило «название с годом при неоднозначности» едет за названием всюду, где оно
  // показано, и превью в мессенджере — тот же показ: две ссылки на одноимённые тайтлы
  // иначе развернулись бы одинаковыми карточками.
  it('название неоднозначного тайтла в превью несёт год', async () => {
    const movie = insert({
      titleRu: 'Призрак в доспехах',
      titleOriginal: 'Ghost in the Shell',
      releaseDate: '1995-11-18',
    });
    insert({
      titleRu: 'Призрак в доспехах',
      titleOriginal: 'Ghost in the Shell: SAC_2045',
      releaseDate: '2026-01-15',
    });

    const og = await openGraphOf(movie);

    expect(og.title).toBe('Призрак в доспехах (1995)');
  });

  it('у тайтла без аннотации описание — общее описание сайта (критерий 32)', async () => {
    const { SITE_DESCRIPTION } = await import('@/lib/site');
    const bare = insert({ titleRu: 'Авалон', releaseDate: '2001-01-20', annotation: null });

    const og = await openGraphOf(bare);

    expect(og.description).toBe(SITE_DESCRIPTION);
  });

  it('пустой строкой описание не бывает (критерий 32)', async () => {
    const bare = insert({ titleRu: 'Авалон', releaseDate: '2001-01-20', annotation: null });

    const og = await openGraphOf(bare);

    expect(String(og.description ?? '').length).toBeGreaterThan(0);
  });

  // Дополнение v14, раздел «Что не входит»: комментарий в превью ссылки не попадает.
  // Описание страницы остаётся аннотацией фильма — посланная в чат ссылка обещает
  // рассказ о тайтле, а не мнение о нём. Правило живёт в '@/lib/site' и не меняется,
  // но проверяется здесь: комментарий стал публичным, и соблазн подставить его
  // в описание появился ровно сейчас.
  it('комментарий владельца в описание превью не попадает (v14)', async () => {
    const og = await openGraphOf(film);

    expect(String(og.description ?? '')).not.toContain(COMMENT);
    expect(String(og.description ?? '')).toBe('Певица приезжает в Лос-Анджелес и теряет там себя.');
  });

  it('у тайтла без постера ключа images нет вовсе (критерий 33)', async () => {
    const bare = insert({ titleRu: 'Авалон', releaseDate: '2001-01-20', posterPath: null });

    const og = await openGraphOf(bare);

    expect('images' in og).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Дополнение v14, критерии приёмки 24 и 25 на уровне карточки: признак режима «глазами
// гостя» доезжает до подвала и здесь. Карточка — одна из страниц с подвалом и самая
// частая точка входа снаружи: если признак теряется, теряется он именно тут.
//
// portable 22.09.2026: довод про недостижимость `/admin` и ссылку «Админка» снят —
// админки в подвале больше нет вовсе, независимо от режима.

describe('карточка фильма: режим «глазами гостя» в подвале (критерии 24 и 25)', () => {
  const named = (container: HTMLElement, pattern: RegExp): HTMLElement | undefined =>
    within(container)
      .queryAllByRole('link')
      .find((link) => pattern.test(link.textContent ?? ''));

  /** Самостоятельная пометка режима: элемент, чей собственный текст и есть «Глазами
   *  гостя». Искать вхождением нельзя — эта строка целиком лежит внутри подписи
   *  переключателя «Посмотреть глазами гостя» (конфликт критериев 24 и 25, разобранный
   *  31.08.2026 в tests/site-footer.test.tsx). */
  const modeMark = (container: HTMLElement): HTMLElement | undefined =>
    [...container.querySelectorAll('*')].find(
      (element) => (element.textContent ?? '').trim() === 'Глазами гостя',
    ) as HTMLElement | undefined;

  it('владельцу вне режима показан переключатель', async () => {
    state.cookie = SECRET;

    const container = await renderPage();

    expect(named(container, /Посмотреть глазами гостя/i)).toBeDefined();
  });

  it('в режиме гостя подвал несёт пометку и ссылку возврата (критерий 25)', async () => {
    state.cookie = SECRET;
    state.guestView = true;

    const container = await renderPage();
    const back = named(container, /Вернуться в админский режим/i);

    expect(modeMark(container), 'в подвале нет пометки режима').toBeDefined();
    expect(back).toBeDefined();
    expect((back!.getAttribute('href') ?? '').startsWith('/owner/owner-view')).toBe(true);
  });

  // portable 22.09.2026: часть про «Админку» снята — этой ссылки в подвале больше
  // нет вовсе, независимо от режима.
  it('в режиме гостя нет «Выйти» (критерий 25)', async () => {
    state.cookie = SECRET;
    state.guestView = true;

    const container = await renderPage();

    expect(named(container, /Выйти/i)).toBeUndefined();
  });

  // Режим гостя не прячет секцию «Моё» вёрсткой, а не отправляет её вовсе — тем же
  // стражем, что и настоящему гостю. Комментарий при этом виден: он теперь публичен.
  it('в режиме гостя секции «Моё» в разметке нет, а комментарий виден', async () => {
    state.cookie = SECRET;
    state.guestView = true;

    const container = await renderPage();

    expect(within(container).queryByRole('heading', { name: 'Моё' })).toBeNull();
    expect(within(container).queryByRole('button', { name: /Редактировать/i })).toBeNull();
    expect(container.textContent).toContain(COMMENT);
  });

  it('обычному гостю пометки режима не показывают (критерий 24)', async () => {
    const container = await renderPage();

    expect(modeMark(container)).toBeUndefined();
    expect(named(container, /Посмотреть глазами гостя/i)).toBeUndefined();
  });
});
