// Критерий приёмки 7 версии v2.1: в подвале главной страницы есть надпись «Каталог
// фильмов» с именем владельца, заданным конфигом; строки с числом фильмов и текущим
// месяцем нет.
//
// Контракт: <SiteFooter /> — default export из '@/components/SiteFooter', без пропсов
// (подвал больше ничего не считает и потому ничего не принимает). Главная страница
// подставляет его вместо прежней строки «Кино База — август 2026 · 19 фильмов».

//
// Дополнение v14 (31.08.2026): у подвала появляется второй признак — <SiteFooter
// owner={boolean} guestView={boolean} />. `owner` остаётся эффективным признаком (в режиме
// гостя он `false`), поэтому «Войти» и «Выйти» разбираются прежним кодом сами.
// Все прежние проверки этого файла получили `guestView={false}` — «смотрим не глазами
// гостя», то есть ровно то состояние, в котором они писались.
//
// portable 22.09.2026: имя владельца и ссылки на личный сайт и телеграм-канал были
// личными полями, а «Админка» — снятой поверхностью; подробности — у соответствующих
// блоков ниже.

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import SiteFooter from '@/components/SiteFooter';

// Переключатель режима — клиентская ссылка: текущий путь известен только на клиенте
// (план, раздел 8). Путь подменяется, потому что в jsdom роутера нет вовсе.
const state = vi.hoisted(() => ({ pathname: '/' }));

vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

beforeEach(() => {
  state.pathname = '/';
});

afterEach(() => {
  cleanup();
});

const MONTHS =
  /(январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр|декабр)/i;

describe('SiteFooter: надпись', () => {
  // portable 22.09.2026: имя владельца — личное поле из site.config.ts; у отчуждаемой
  // копии оно по умолчанию пустое, и подпись сводится к «Каталог фильмов» без имени.
  it('показывает «Каталог фильмов»', () => {
    render(<SiteFooter owner={false} guestView={false} />);

    expect(screen.getByText(/Каталог фильмов/)).toBeInTheDocument();
  });
});

// portable 22.09.2026: блок `SiteFooter: ссылки автора` снят целиком — личные ссылки
// на личный сайт автора и телеграм-канал автора были жёстко вшиты в подвал, теперь подвал отдаёт
// ссылку на имя только при заданном `AUTHOR_LINK` (проверяется в site-config.test.tsx).

describe('SiteFooter: старой служебной строки нет', () => {
  // «фильмов» само по себе в подвале есть — в надписи «Каталог фильмов…».
  // Уйти должен счётчик: число рядом со словом.
  it('нет счётчика фильмов', () => {
    const { container } = render(<SiteFooter owner={false} guestView={false} />);

    expect(container.textContent ?? '').not.toMatch(/\d+\s*фильм/i);
    expect(container.textContent ?? '').not.toMatch(/фильм\S*\s*\d+/i);
  });

  it('нет названия месяца', () => {
    const { container } = render(<SiteFooter owner={false} guestView={false} />);

    expect(container.textContent ?? '').not.toMatch(MONTHS);
  });

  it('нет года', () => {
    const { container } = render(<SiteFooter owner={false} guestView={false} />);

    expect(container.textContent ?? '').not.toMatch(/\d{4}/);
  });
});

// ---------------------------------------------------------------------------
// Дополнение v6, критерии приёмки 7 и 9: ссылка входа и выхода в подвале.
//
// Контракт: <SiteFooter owner={boolean} />. Гостю показывается «Войти» со ссылкой
// на '/owner/login' (там браузер спросит пароль), владельцу — «Выйти» со ссылкой
// на '/owner/logout'. Одновременно обе не показываются никогда: это одно место
// в подвале, меняющее надпись. Ссылки на личный сайт и телеграм-канал остаются
// в обоих случаях — вход ничего из подвала не вытесняет.
//
// Ссылки ищутся по доступному имени, а не по классам: как именно подвал их
// оформляет, тестами не проверяется.

function linkNamed(pattern: RegExp): HTMLElement | undefined {
  return screen
    .getAllByRole('link')
    .find((link) => pattern.test(link.textContent ?? ''));
}

describe('SiteFooter: вход для гостя', () => {
  it('гостю показана ссылка «Войти»', () => {
    render(<SiteFooter owner={false} guestView={false} />);

    expect(screen.getByRole('link', { name: /Войти/i })).toBeInTheDocument();
  });

  it('ссылка «Войти» ведёт на /owner/login', () => {
    render(<SiteFooter owner={false} guestView={false} />);

    expect(screen.getByRole('link', { name: /Войти/i })).toHaveAttribute('href', '/owner/login');
  });

  it('гостю ссылки «Выйти» не показывают', () => {
    render(<SiteFooter owner={false} guestView={false} />);

    expect(linkNamed(/Выйти/i)).toBeUndefined();
  });

  // portable 22.09.2026: кейс «ссылки автора остаются на месте» снят — проверял
  // жёстко вшитые ссылки на личный сайт автора и телеграм-канал, которых больше нет.
});

describe('SiteFooter: выход для владельца', () => {
  it('владельцу показана ссылка «Выйти»', () => {
    render(<SiteFooter owner={true} guestView={false} />);

    expect(screen.getByRole('link', { name: /Выйти/i })).toBeInTheDocument();
  });

  it('ссылка «Выйти» ведёт на /owner/logout', () => {
    render(<SiteFooter owner={true} guestView={false} />);

    expect(screen.getByRole('link', { name: /Выйти/i })).toHaveAttribute('href', '/owner/logout');
  });

  it('владельцу ссылки «Войти» не показывают', () => {
    render(<SiteFooter owner={true} guestView={false} />);

    expect(linkNamed(/Войти/i)).toBeUndefined();
  });

  // portable 22.09.2026: кейс «ссылки автора остаются на месте» снят — та же причина,
  // что у гостя выше.

  it('надпись подвала не меняется от того, кто смотрит', () => {
    render(<SiteFooter owner={true} guestView={false} />);

    expect(screen.getByText(/Каталог фильмов/)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Дополнение v11, критерий приёмки 1: подвал становится последним элементом `<main>`
// на страницах сайта — главной, карточке фильма, указателе персоналий и странице
// персоналии, — и на каждой несёт тот же состав.
//
// Сам компонент версией не меняется. Здесь фиксируется база сравнения. Проверки
// «подвал есть на странице» в film-page, person-page и people-index опираются
// на этот состав, и если он однажды поедет, ломаться должно здесь — в одном месте,
// а не в трёх разом.

describe('SiteFooter: состав ссылок (критерий 1 версии v11)', () => {
  // portable 22.09.2026: число ссылок пересчитано по новой разметке — личный сайт автора,
  // телеграм-канал и «Админка» из подвала сняты; у гостя с пустым site.config
  // остаётся только «Войти».
  it('гостю показаны подпись и одна ссылка', () => {
    const { container } = render(<SiteFooter owner={false} guestView={false} />);

    expect(screen.getByText(/Каталог фильмов/)).toBeInTheDocument();
    expect(container.querySelectorAll('a')).toHaveLength(1);
  });

  // portable 22.09.2026: кейс «владельцу — те же элементы плюс вход в админку»
  // снят — админки в подвале больше нет; состав владельца (переключатель + «Выйти»)
  // проверяют кейсы ниже по имени ссылки.
  it('владельцу — переключатель режима и «Выйти», две ссылки', () => {
    const { container } = render(<SiteFooter owner={true} guestView={false} />);

    expect(screen.getByText(/Каталог фильмов/)).toBeInTheDocument();
    expect(container.querySelectorAll('a')).toHaveLength(2);
  });

  it('подвал отдан тегом <footer>: страницы ищут его именно так', () => {
    const { container } = render(<SiteFooter owner={false} guestView={false} />);

    expect(container.querySelector('footer')).not.toBeNull();
  });
});

// portable 22.09.2026: блок `SiteFooter: вход в админку (критерии 1 и 2 версии v12)`
// снят целиком — админка и ссылка «Админка» в подвале изъяты из отчуждаемой копии.

// ---------------------------------------------------------------------------
// Дополнение v14, критерии приёмки 24, 25 и 26 — переключатель режима «глазами гостя»:
// 24 — подвал владельца несёт ссылку «Посмотреть глазами гостя»; подвал гостя — нет;
// 25 — подвал в режиме гостя несёт строку «Глазами гостя» и ссылку «Вернуться
//      в админский режим» и не несёт ни «Админки», ни «Выйти»;
// 26 — ссылка переключателя несёт текущий путь страницы в параметре `back`.
//
// Контракт: <SiteFooter owner={boolean} guestView={boolean} />. `owner` — эффективный
// признак: в режиме гостя он `false`, и подвал показывает ровно то, что видит гость,
// включая «Войти». Сверх этого при `guestView` появляется вторая строка — пометка режима
// и возврат; иначе владелец, ушедший посмотреть чужими глазами, остался бы там навсегда.
//
// Тестами не проверяется, что возврат набран киноварью, а пометка — вторичным цветом:
// это CSS, и в jsdom Tailwind не загружен. Не проверяется и отсутствие полосы под шапкой
// с плавающей кнопкой в углу — отсутствие того, чего нет ни в одном компоненте, стеречь
// нечем; это работа живого прогона.

const GUEST_VIEW_LABEL = /Посмотреть глазами гостя/i;
const OWNER_VIEW_LABEL = /Вернуться к своему виду/i;

// Правка 31.08.2026, конфликт критериев 24 и 25, найденный на имплементации.
// Прежняя редакция проверки «пометки „Глазами гостя“ вне режима нет» искала подстроку:
// ~~`expect(container.textContent).not.toMatch(/Глазами гостя/i)`~~. Зелёной она быть
// не может ни при какой правильной имплементации: подпись переключателя — «Посмотреть
// глазами гостя» (критерий 24, дословно из спеки), пометка режима — «Глазами гостя»
// (критерий 25, тоже дословно), и вторая целиком лежит внутри первой. Подстрока нашлась бы
// всегда, когда критерий 24 выполнен.
//
// Решение владельца-имплементатора от 31.08.2026, с оговоркой в спеке: подписи остаются
// как в спеке, правится тест. Обе формулировки выбраны владельцем и в интерфейсе читаются
// верно; переименовывать пометку ради разрешимости подстроки значило бы менять интерфейс
// под тест.
//
// Поэтому проверяется намерение, а не подстрока: есть ли в подвале **самостоятельная**
// пометка — элемент, чей собственный текст и есть «Глазами гостя», а не кусок чужой
// подписи. Ссылка возврата проверяется отдельно и своим именем.

/** Самостоятельная пометка режима в подвале, если она там есть. */
function modeMark(container: HTMLElement): HTMLElement | undefined {
  return [...container.querySelectorAll('*')].find(
    (element) => (element.textContent ?? '').trim() === 'Глазами гостя',
  ) as HTMLElement | undefined;
}

describe('SiteFooter: переключатель у владельца (критерий 24)', () => {
  it('владельцу показана ссылка «Посмотреть глазами гостя»', () => {
    render(<SiteFooter owner={true} guestView={false} />);

    expect(screen.getByRole('link', { name: GUEST_VIEW_LABEL })).toBeInTheDocument();
  });

  it('ссылка ведёт на маршрут включения режима', () => {
    render(<SiteFooter owner={true} guestView={false} />);

    const href = screen.getByRole('link', { name: GUEST_VIEW_LABEL }).getAttribute('href') ?? '';

    expect(href.startsWith('/owner/guest-view')).toBe(true);
  });

  it('гостю ссылки переключателя в разметке нет', () => {
    const { container } = render(<SiteFooter owner={false} guestView={false} />);

    expect(linkNamed(GUEST_VIEW_LABEL)).toBeUndefined();
    expect(container.innerHTML).not.toContain('/owner/guest-view');
  });

  // portable 22.09.2026: проверка «Админка» снята вместе со ссылкой в подвале;
  // от исходного кейса остаётся то, что «Выйти» переключатель не вытесняет.
  it('«Выйти» у владельца никуда не делась', () => {
    render(<SiteFooter owner={true} guestView={false} />);

    expect(screen.getByRole('link', { name: /Выйти/i })).toBeInTheDocument();
  });

  it('пометки «Глазами гостя» вне режима нет', () => {
    const { container } = render(<SiteFooter owner={true} guestView={false} />);

    expect(modeMark(container)).toBeUndefined();
    expect(linkNamed(OWNER_VIEW_LABEL)).toBeUndefined();
  });
});

describe('SiteFooter: подвал в режиме гостя (критерий 25)', () => {
  // Пометка ищется точным совпадением, а не вхождением: строка «Глазами гостя» лежит
  // внутри подписи переключателя «Посмотреть глазами гостя», и поиск по вхождению
  // не отличил бы пометку режима от ссылки, которая в этот режим ведёт.
  it('несёт строку «Глазами гостя»', () => {
    const { container } = render(<SiteFooter owner={false} guestView={true} />);

    expect(modeMark(container), 'в подвале нет самостоятельной пометки режима').toBeDefined();
  });

  it('несёт ссылку «Вернуться к своему виду»', () => {
    render(<SiteFooter owner={false} guestView={true} />);

    expect(screen.getByRole('link', { name: OWNER_VIEW_LABEL })).toBeInTheDocument();
  });

  it('ссылка возврата ведёт на маршрут снятия режима', () => {
    render(<SiteFooter owner={false} guestView={true} />);

    const href = screen.getByRole('link', { name: OWNER_VIEW_LABEL }).getAttribute('href') ?? '';

    expect(href.startsWith('/owner/owner-view')).toBe(true);
  });

  // portable 22.09.2026: кейс «Админки в режиме гостя нет» снят — админки в подвале
  // нет вовсе, независимо от режима.

  it('«Выйти» в режиме гостя нет', () => {
    render(<SiteFooter owner={false} guestView={true} />);

    expect(linkNamed(/Выйти/i)).toBeUndefined();
  });

  it('«Посмотреть глазами гостя» в режиме гостя не показывается', () => {
    render(<SiteFooter owner={false} guestView={true} />);

    expect(linkNamed(GUEST_VIEW_LABEL)).toBeUndefined();
  });

  // Режим гостя показывает ровно то, что видит гость, — а гость видит «Войти».
  it('«Войти» остаётся: это то, что видит гость', () => {
    render(<SiteFooter owner={false} guestView={true} />);

    expect(screen.getByRole('link', { name: /Войти/i })).toHaveAttribute('href', '/owner/login');
  });

  // portable 22.09.2026: проверки ссылок на личный сайт автора и телеграм-канал сняты —
  // их больше нет в подвале; от исходного кейса остаётся то, что надпись на месте.
  it('надпись подвала на месте', () => {
    render(<SiteFooter owner={false} guestView={true} />);

    expect(screen.getByText(/Каталог фильмов/)).toBeInTheDocument();
  });

  it('пометка режима стоит отдельной строкой, а не в ряду ссылок', () => {
    const { container } = render(<SiteFooter owner={false} guestView={true} />);
    const mark = modeMark(container);

    expect(mark, 'в подвале нет самостоятельной пометки режима').toBeDefined();
    const line = mark!.closest('p');

    expect(line, 'пометка «Глазами гостя» стоит не в абзаце').not.toBeNull();
    expect(line!.textContent ?? '').not.toMatch(/Каталог фильмов/);
  });
});

describe('SiteFooter: переключатель помнит страницу (критерий 26)', () => {
  /** Значение параметра `back` у ссылки переключателя. */
  function backOf(link: HTMLElement): string | null {
    const href = link.getAttribute('href') ?? '';
    // portable 22.09.2026: базовый адрес нужен только `new URL()`, конкретный домен
    // не имеет значения.
    return new URL(href, 'https://kinobase.example.com').searchParams.get('back');
  }

  it('со страницы фильма включение режима несёт её путь', () => {
    state.pathname = '/films/12';
    render(<SiteFooter owner={true} guestView={false} />);

    expect(backOf(screen.getByRole('link', { name: GUEST_VIEW_LABEL }))).toBe('/films/12');
  });

  it('со страницы персоналии — её путь', () => {
    state.pathname = '/people/mamoru-oshii';
    render(<SiteFooter owner={true} guestView={false} />);

    expect(backOf(screen.getByRole('link', { name: GUEST_VIEW_LABEL }))).toBe(
      '/people/mamoru-oshii',
    );
  });

  it('с главной — корень сайта', () => {
    state.pathname = '/';
    render(<SiteFooter owner={true} guestView={false} />);

    expect(backOf(screen.getByRole('link', { name: GUEST_VIEW_LABEL }))).toBe('/');
  });

  it('снятие режима возвращает на ту же страницу', () => {
    state.pathname = '/films/12';
    render(<SiteFooter owner={false} guestView={true} />);

    expect(backOf(screen.getByRole('link', { name: OWNER_VIEW_LABEL }))).toBe('/films/12');
  });

  // Путь уезжает в адрес закодированным, иначе косые черты разъехались бы по параметрам.
  it('путь закодирован в адресе ссылки', () => {
    state.pathname = '/films/12';
    render(<SiteFooter owner={true} guestView={false} />);

    const href = screen.getByRole('link', { name: GUEST_VIEW_LABEL }).getAttribute('href') ?? '';

    expect(href).toContain('back=%2Ffilms%2F12');
  });

  // Обычный <a>, а не Link: маршрут ставит куку и отвечает редиректом, клиентская
  // навигация здесь не нужна — так же сделаны «Админка» и «Выйти».
  it('переключатель — внутренняя ссылка, без новой вкладки', () => {
    render(<SiteFooter owner={true} guestView={false} />);

    expect(screen.getByRole('link', { name: GUEST_VIEW_LABEL })).not.toHaveAttribute('target');
  });
});
