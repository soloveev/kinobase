// Критерии приёмки 24 и 25 версии v14 на уровне главной страницы: признак режима
// «глазами гостя» доезжает до подвала.
//
// Почему файл заводится только сейчас. У главной до сих пор не было своего теста:
// её части проверялись по отдельности — сетка в tests/film-cell.test.tsx, отбор
// в tests/filters.test.ts, полоса в tests/applied-bar.test.tsx, подвал в
// tests/site-footer.test.tsx. Четырнадцатая версия завела первое требование, которое
// принадлежит именно странице: второй признак сессии подвал получает не сам, его
// передаёт каждая из страниц с подвалом по отдельности. Страница, забывшая
// передать, покажет владельцу «Выйти» в режиме гостя — то есть ровно то,
// ради отсутствия чего режим и заведён.
//
// Контракт страницы:
//   export default async function Home({ searchParams }): Promise<ReactElement>
//   export const dynamic = 'force-dynamic';
// из '@/app/page', с `searchParams: Promise<Record<string, string | string[] | undefined>>` —
// тем же видом, что у указателя персоналий.
//
// Режим включается настоящей кукой `kinobase_guest_view`, а не подменённой сессией:
// вне боевой сборки посетитель — владелец без входа (правило v7), и кука здесь
// единственное, что делает его гостем. Это критерий 18, увиденный со стороны страницы.
//
// Подменяются три источника: '@/db' — настоящая база в памяти (та же фабрика createDb,
// что во всех тестах хранилища), 'next/headers' — банка с двумя куками, 'next/navigation' —
// технически: клиентские части страницы и подвала просят useRouter и usePathname.
//
// Вёрстка здесь не проверяется: число ячеек в ряду, липкая шапка и место подвала на
// экране — работа живого прогона, в jsdom Tailwind не загружен.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, within } from '@testing-library/react';
import { createDb, type Db } from '@/db';
import { films } from '@/db/schema';
import Home from '@/app/page';
import { filmValues } from './helpers';

const SECRET = 'a7f3c1e9b40d2856a7f3c1e9b40d2856';

const state = vi.hoisted(() => ({ db: null as unknown }));

const jar = vi.hoisted(() => ({ owner: undefined as string | undefined, guestView: false }));

vi.mock('@/db', async () => {
  const actual = await vi.importActual<typeof import('@/db')>('@/db');
  return { ...actual, getDb: () => state.db };
});

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
  usePathname: () => '/',
  notFound: () => {
    throw new Error('notFound');
  },
}));

let db: Db;

async function renderHome(
  params: Record<string, string | string[] | undefined> = {},
): Promise<HTMLElement> {
  const searchParams = Promise.resolve(params);
  const { container } = render(await Home({ searchParams }));
  return container;
}

/** Ссылка подвала по её подписи. */
function named(container: HTMLElement, pattern: RegExp): HTMLElement | undefined {
  return within(container)
    .queryAllByRole('link')
    .find((link) => pattern.test(link.textContent ?? ''));
}

/** Самостоятельная пометка режима: элемент, чей собственный текст и есть «Глазами
 *  гостя». Искать вхождением нельзя — эта строка целиком лежит внутри подписи
 *  переключателя «Посмотреть глазами гостя» (конфликт критериев 24 и 25, разобранный
 *  31.08.2026 в tests/site-footer.test.tsx). */
function modeMark(container: HTMLElement): HTMLElement | undefined {
  return [...container.querySelectorAll('*')].find(
    (element) => (element.textContent ?? '').trim() === 'Глазами гостя',
  ) as HTMLElement | undefined;
}

beforeEach(() => {
  db = createDb(':memory:');
  state.db = db;
  jar.owner = undefined;
  jar.guestView = false;
  db.insert(films).values(filmValues({ titleRu: 'Сират', releaseDate: '2025-05-15' })).run();
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('главная: подвал на месте', () => {
  it('подвал на странице есть', async () => {
    const container = await renderHome();

    expect(container.querySelector('footer')).not.toBeNull();
    // portable 22.09.2026: имя владельца — личное поле site.config.ts, пустое
    // по умолчанию, поэтому надпись сверяется без него.
    expect(container.textContent ?? '').toContain('Каталог фильмов');
  });
});

describe('главная: режим «глазами гостя» в подвале (критерии 24 и 25)', () => {
  // portable 22.09.2026: проверка ссылки «Админка» снята — этой ссылки в подвале
  // больше нет вовсе, независимо от режима.
  it('вне режима подвал показывает владельческое, включая переключатель', async () => {
    const container = await renderHome();

    expect(named(container, /Посмотреть глазами гостя/i)).toBeDefined();
    expect(named(container, /Выйти/i)).toBeDefined();
  });

  it('при стоящей куке подвал несёт пометку «Глазами гостя» (критерий 25)', async () => {
    jar.guestView = true;

    const container = await renderHome();

    expect(modeMark(container), 'в подвале нет пометки режима').toBeDefined();
  });

  it('при стоящей куке есть ссылка возврата (критерий 25)', async () => {
    jar.guestView = true;

    const container = await renderHome();
    const back = named(container, /Вернуться в админский режим/i);

    expect(back).toBeDefined();
    expect((back!.getAttribute('href') ?? '').startsWith('/owner/owner-view')).toBe(true);
  });

  // portable 22.09.2026: часть про «Админку» снята — этой ссылки в подвале больше
  // нет вовсе, независимо от режима.
  it('при стоящей куке нет «Выйти» (критерий 25)', async () => {
    jar.guestView = true;

    const container = await renderHome();

    expect(named(container, /Выйти/i)).toBeUndefined();
  });

  it('в режиме гостя показано то, что видит гость, — «Войти» (критерий 25)', async () => {
    jar.guestView = true;

    const container = await renderHome();

    expect(named(container, /Войти/i)).toBeDefined();
  });

  it('после снятия куки подвал владельца возвращается', async () => {
    jar.guestView = false;

    const container = await renderHome();

    expect(modeMark(container)).toBeUndefined();
    expect(named(container, /Выйти/i)).toBeDefined();
  });

  // Настоящему гостю переключателя не показывают: режим — вход в чужие глаза,
  // а не выход из своих.
  it('гостю в боевой сборке переключателя не показывают (критерий 24)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('OWNER_TOKEN', SECRET);

    const container = await renderHome();

    expect(named(container, /Посмотреть глазами гостя/i)).toBeUndefined();
    expect(modeMark(container)).toBeUndefined();
    expect(named(container, /Войти/i)).toBeDefined();
  });
});
