// Спецификация захода 22.09.2026 (без версии — вынос имени и ссылки владельца
// в конфиг), пункты 1–3: отчуждаемая копия базы получает единый переключатель
// «кто владелец», а не три константы вручную.
//
// Контракт, зафиксированный этими тестами:
//
//   '@/site.config' — новый модуль:
//     export const siteConfig: {
//       title: string;        // по умолчанию 'Кино База'
//       url: string;          // по умолчанию 'http://localhost:3000'
//       author: string;       // по умолчанию '' (владелец не назван)
//       authorLink: string | null; // по умолчанию null
//       description: string;
//     };
//
//   '@/lib/site' берёт оттуда SITE_TITLE, SITE_URL, SITE_AUTHOR, AUTHOR_LINK
//   (= siteConfig.authorLink, может быть null) и SITE_DESCRIPTION. Прежней константы
//   AUTHOR_BLOG больше нет — адрес блога был её единственным смыслом, а теперь
//   его либо нет вовсе (author === ''), либо он лежит в AUTHOR_LINK.
//
//   '@/components/SiteFooter' (пропсы owner/guestView, как в tests/site-footer.test.tsx):
//     - author === '' → первая строка подвала несёт «Каталог фильмов» без тире и имени;
//     - author задан, authorLink === null → «Каталог фильмов — <имя>», имя не ссылка;
//     - authorLink задан → имя — внешняя ссылка (_blank, noopener noreferrer);
//     - ссылок на /admin и на t.me в подвале больше нет вовсе — ни владельцу, ни гостю;
//     - «Войти»/«Выйти» не меняются: владельцу — /owner/logout, гостю — /owner/login.
//
//   '@/components/FilmComment' (пропсы comment/action):
//     - подпись — имя автора из конфига; при author === '' подпись — «Владелец базы»;
//     - authorLink === null → имя не ссылка; иначе — ссылка target="_blank";
//     - текста «автор блога» в разметке больше нет ни при одном значении конфига.
//
// Модуль '@/site.config' на момент написания этих тестов не существует — они красные
// до имплементации. Значения конфига меняются между кейсами, а константы '@/lib/site'
// и сами компоненты читают их один раз при загрузке модуля, поэтому свежее значение
// требует и свежего модуля: между кейсами меняем поля мутируемого объекта, зовём
// `vi.resetModules()` и импортируем модули заново динамическим `import()`. Сам модуль
// конфига (пункт 1) проверяется отдельно через `vi.importActual`, в обход мока, — но
// только его форма, а не значения: файл правится онбордингом под владельца, и тест
// на значения свежего клона красил бы прогон после честного онбординга (цикл 3).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

type SiteConfigShape = {
  title: string;
  url: string;
  author: string;
  authorLink: string | null;
  description: string;
};

const state = vi.hoisted(() => ({
  pathname: '/',
  siteConfig: {
    title: 'Кино База',
    url: 'http://localhost:3000',
    author: '',
    authorLink: null as string | null,
    description: 'Тестовое описание сайта',
  },
}));

vi.mock('@/site.config', () => ({ siteConfig: state.siteConfig }));

// Тот же приём, что в tests/site-footer.test.tsx: путь известен только на клиенте,
// а роутера в jsdom нет вовсе. Подвал владельца зовёт ViewModeLink, и без этого мока
// его рендер падает независимо от того, что здесь проверяется.
vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

beforeEach(() => {
  state.pathname = '/';
  state.siteConfig.title = 'Кино База';
  state.siteConfig.url = 'http://localhost:3000';
  state.siteConfig.author = '';
  state.siteConfig.authorLink = null;
  state.siteConfig.description = 'Тестовое описание сайта';
});

afterEach(() => {
  cleanup();
  vi.resetModules();
});

async function loadSiteLib() {
  return import('@/lib/site');
}

async function loadSiteFooter() {
  const mod = await import('@/components/SiteFooter');
  return mod.default;
}

async function loadFilmComment() {
  const mod = await import('@/components/FilmComment');
  return mod.default;
}

function linkNamed(container: HTMLElement, pattern: RegExp): HTMLElement | undefined {
  return [...container.querySelectorAll('a')].find((link) => pattern.test(link.textContent ?? ''));
}

// ---------------------------------------------------------------------------
// Пункт 1: сам конфиг и то, что lib/site берёт значения из него.

describe('siteConfig: форма модуля (пункт 1)', () => {
  it('title, url и description непустые строки, author строка, authorLink строка или null', async () => {
    const actual = await vi.importActual<{ siteConfig: SiteConfigShape }>('@/site.config');
    const config = actual.siteConfig;

    expect(typeof config.title).toBe('string');
    expect(config.title.length).toBeGreaterThan(0);
    expect(() => new URL(config.url)).not.toThrow();
    expect(typeof config.author).toBe('string');
    expect(config.authorLink === null || typeof config.authorLink === 'string').toBe(true);
    const link = config.authorLink;
    if (link !== null) expect(() => new URL(link)).not.toThrow();
    expect(typeof config.description).toBe('string');
    expect(config.description.length).toBeGreaterThan(0);
  });
});

describe('lib/site: значения приходят из siteConfig (пункт 1)', () => {
  it('SITE_TITLE, SITE_URL, SITE_AUTHOR и SITE_DESCRIPTION совпадают с конфигом', async () => {
    state.siteConfig.title = 'Заголовок для теста';
    state.siteConfig.url = 'https://test.example';
    state.siteConfig.author = 'Тестовый Владелец';
    state.siteConfig.description = 'Описание для теста';
    vi.resetModules();

    const site = await loadSiteLib();

    expect(site.SITE_TITLE).toBe('Заголовок для теста');
    expect(site.SITE_URL).toBe('https://test.example');
    expect(site.SITE_AUTHOR).toBe('Тестовый Владелец');
    expect(site.SITE_DESCRIPTION).toBe('Описание для теста');
  });

  it('AUTHOR_LINK — это siteConfig.authorLink, включая null', async () => {
    state.siteConfig.authorLink = null;
    vi.resetModules();
    const withoutLink = await loadSiteLib();

    expect(withoutLink.AUTHOR_LINK).toBeNull();

    state.siteConfig.authorLink = 'https://example.com';
    vi.resetModules();
    const withLink = await loadSiteLib();

    expect(withLink.AUTHOR_LINK).toBe('https://example.com');
  });

  it('прежней константы AUTHOR_BLOG больше нет', async () => {
    vi.resetModules();
    const site: Record<string, unknown> = await loadSiteLib();

    expect('AUTHOR_BLOG' in site).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Пункт 2: SiteFooter реагирует на автора и ссылку из конфига.

describe('SiteFooter: автор не задан (пункт 2)', () => {
  it('первая строка несёт «Каталог фильмов» без тире и без имени', async () => {
    vi.resetModules();
    const SiteFooter = await loadSiteFooter();

    const { container } = render(<SiteFooter owner={false} guestView={false} />);
    const text = container.textContent ?? '';

    expect(text).toContain('Каталог фильмов');
    expect(text).not.toMatch(/Каталог фильмов\s*—/);
  });
});

describe('SiteFooter: автор задан без ссылки (пункт 2)', () => {
  it('строка — «Каталог фильмов — Тестовый Владелец», имя не является ссылкой', async () => {
    state.siteConfig.author = 'Тестовый Владелец';
    state.siteConfig.authorLink = null;
    vi.resetModules();
    const SiteFooter = await loadSiteFooter();

    const { container } = render(<SiteFooter owner={false} guestView={false} />);

    expect(container.textContent ?? '').toMatch(/Каталог фильмов\s*—\s*Тестовый Владелец/);
    expect(linkNamed(container, /Тестовый Владелец/)).toBeUndefined();
  });
});

describe('SiteFooter: у автора есть ссылка (пункт 2)', () => {
  it('имя владельца — внешняя ссылка на authorLink', async () => {
    state.siteConfig.author = 'Тестовый Владелец';
    state.siteConfig.authorLink = 'https://example.com';
    vi.resetModules();
    const SiteFooter = await loadSiteFooter();

    render(<SiteFooter owner={false} guestView={false} />);
    const link = screen.getByRole('link', { name: 'Тестовый Владелец' });

    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel') ?? '').toContain('noopener');
    expect(link.getAttribute('rel') ?? '').toContain('noreferrer');
  });
});

describe('SiteFooter: без входа в админку и без телеграма (пункт 2)', () => {
  it('ссылки на /admin в подвале больше нет — ни владельцу, ни гостю', async () => {
    vi.resetModules();
    const SiteFooter = await loadSiteFooter();

    const owner = render(<SiteFooter owner={true} guestView={false} />);
    expect(owner.container.innerHTML).not.toContain('/admin');
    cleanup();

    const guest = render(<SiteFooter owner={false} guestView={false} />);
    expect(guest.container.innerHTML).not.toContain('/admin');
  });

  it('ссылки на t.me в подвале больше нет — ни владельцу, ни гостю', async () => {
    vi.resetModules();
    const SiteFooter = await loadSiteFooter();

    const owner = render(<SiteFooter owner={true} guestView={false} />);
    expect(owner.container.innerHTML).not.toContain('t.me');
    cleanup();

    const guest = render(<SiteFooter owner={false} guestView={false} />);
    expect(guest.container.innerHTML).not.toContain('t.me');
  });
});

describe('SiteFooter: вход и выход остаются прежними (пункт 2)', () => {
  it('владельцу — ссылка «Выйти» на /owner/logout', async () => {
    vi.resetModules();
    const SiteFooter = await loadSiteFooter();

    render(<SiteFooter owner={true} guestView={false} />);

    expect(screen.getByRole('link', { name: /Выйти/i })).toHaveAttribute(
      'href',
      '/owner/logout',
    );
  });

  it('гостю — ссылка «Войти» на /owner/login', async () => {
    vi.resetModules();
    const SiteFooter = await loadSiteFooter();

    render(<SiteFooter owner={false} guestView={false} />);

    expect(screen.getByRole('link', { name: /Войти/i })).toHaveAttribute('href', '/owner/login');
  });
});

// ---------------------------------------------------------------------------
// Пункт 3: подпись FilmComment реагирует на автора и ссылку из конфига.

describe('FilmComment: подпись из конфига (пункт 3)', () => {
  const COMMENT = 'Комментарий для теста подписи';

  it('при пустом авторе подпись — «Владелец базы»', async () => {
    vi.resetModules();
    const FilmComment = await loadFilmComment();

    const { container } = render(<FilmComment comment={COMMENT} />);

    expect(container.textContent ?? '').toContain('Владелец базы');
  });

  it('при заданном авторе без ссылки подпись — имя, и оно не ссылка', async () => {
    state.siteConfig.author = 'Тестовый Владелец';
    state.siteConfig.authorLink = null;
    vi.resetModules();
    const FilmComment = await loadFilmComment();

    const { container } = render(<FilmComment comment={COMMENT} />);

    expect(container.textContent ?? '').toContain('Тестовый Владелец');
    expect(screen.queryByRole('link', { name: 'Тестовый Владелец' })).toBeNull();
  });

  it('при заданной ссылке имя — ссылка, открывается в новой вкладке', async () => {
    state.siteConfig.author = 'Тестовый Владелец';
    state.siteConfig.authorLink = 'https://example.com';
    vi.resetModules();
    const FilmComment = await loadFilmComment();

    render(<FilmComment comment={COMMENT} />);
    const link = screen.getByRole('link', { name: 'Тестовый Владелец' });

    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('текста «автор блога» в разметке больше нет ни при одном значении конфига', async () => {
    const cases: Array<[string, string | null]> = [
      ['', null],
      ['Тестовый Владелец', null],
      ['Тестовый Владелец', 'https://example.com'],
    ];

    for (const [author, authorLink] of cases) {
      state.siteConfig.author = author;
      state.siteConfig.authorLink = authorLink;
      vi.resetModules();
      const FilmComment = await loadFilmComment();

      const { container } = render(<FilmComment comment={COMMENT} />);
      expect(container.textContent ?? '').not.toContain('автор блога');
      cleanup();
    }
  });
});
