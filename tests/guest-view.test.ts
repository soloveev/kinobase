// Критерии приёмки 18, 21, 22 и 23 версии v14 — режим «глазами гостя» на уровне
// сессии и двух маршрутов:
// 18 — при стоящей куке `kinobase_guest_view` `viewerIsOwner()` возвращает «нет» —
//      и в боевой сборке, и вне её;
// 21 — маршрут включения ставит куку только тому, у кого есть сессия владельца;
//      остальным не ставит ничего;
// 22 — кука сессионная (без срока жизни), `httpOnly`, `sameSite=lax`, путь `/`;
//      `secure` — только в боевой сборке;
// 23 — оба маршрута возвращают на путь из параметра `back`, если он начинается
//      с одной косой черты; подделанный параметр даёт возврат на главную.
//
// Контракт (spec.md, раздел D; plan.md, разделы 6 и 7):
//   '@/lib/owner':    const GUEST_VIEW_COOKIE = 'kinobase_guest_view';
//                     function backPath(raw: string | null): string;
//   '@/lib/session':  async function ownerSession(): Promise<boolean>;   // кто ты
//                     async function guestViewOn(): Promise<boolean>;    // чьими глазами
//                     async function viewerIsOwner(): Promise<boolean>;  // владелец И не режим
//   '@/app/owner/guest-view/route':  export async function GET(request: Request)
//   '@/app/owner/owner-view/route':  export async function GET(request: Request)
//
// Почему разделение сессии надвое проверяется здесь, а не в tests/session.test.ts.
// Тот файл держит прежний контракт — «кто ты» — и правкой этой версии не меняется:
// без куки режима `viewerIsOwner` отвечает ровно то же, что отвечал. Здесь проверяется
// второе слагаемое: чьими глазами смотрят. Оба вместе и дают критерий 18.
//
// Разделение гостя и владельца живёт только в боевой сборке (правило проекта), поэтому
// проверки признака владельца объявляют окружение боевым явно. Режим «глазами гостя» —
// исключение из этого правила и работает всюду: смотреть на сайт глазами читателя нужно
// там, где сайт и собирают, то есть локально. Это прямо сказано критерием 18 и проверяется
// отдельным тестом без подмены окружения.
//
// Модули, которых до имплементации нет вовсе, подгружаются динамически внутри тестов —
// приём из tests/film-page.test.tsx: пока маршрута нет, красным должен быть его блок,
// а не весь файл.
//
// Кука подменяется банкой с записью: `set` и `delete` не только меняют состояние, но
// и складывают в журнал то, с чем их позвали, — иначе критерий 22 нечем проверить.
// Банка принимает обе формы вызова, объектом и тремя аргументами: спека требует
// свойств куки, а не способа их задать.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { viewerIsOwner } from '@/lib/session';

const SECRET = 'a7f3c1e9b40d2856a7f3c1e9b40d2856';
const OWNER_COOKIE_NAME = 'kinobase_owner';
const GUEST_COOKIE_NAME = 'kinobase_guest_view';

type CookieOptions = {
  name: string;
  value: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  path?: string;
  maxAge?: number;
  expires?: unknown;
};

const state = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  set: [] as Record<string, unknown>[],
  deleted: [] as string[],
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      state.jar.has(name) ? { name, value: state.jar.get(name)! } : undefined,
    getAll: () => [...state.jar].map(([name, value]) => ({ name, value })),
    has: (name: string) => state.jar.has(name),
    set: (first: unknown, second?: unknown, third?: unknown) => {
      const options =
        typeof first === 'string'
          ? { name: first, value: String(second), ...(third as object | undefined) }
          : (first as Record<string, unknown>);
      state.set.push(options);
      state.jar.set(String(options.name), String(options.value));
    },
    delete: (target: unknown) => {
      const name = typeof target === 'string' ? target : String((target as { name: string }).name);
      state.deleted.push(name);
      state.jar.delete(name);
    },
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
  notFound: () => {
    throw new Error('notFound');
  },
}));

async function loadOwner() {
  return import('@/lib/owner');
}

async function loadSession() {
  return import('@/lib/session');
}

async function guestViewGet(): Promise<(request: Request) => Promise<unknown>> {
  const route = await import('@/app/owner/guest-view/route');
  return route.GET;
}

async function ownerViewGet(): Promise<(request: Request) => Promise<unknown>> {
  const route = await import('@/app/owner/owner-view/route');
  return route.GET;
}

function request(path: string, back?: string): Request {
  // portable 22.09.2026: базовый адрес нужен только `new URL()`, чтобы собрать
  // валидный `Request` из относительного пути — конкретный домен не имеет значения.
  const url = new URL(path, 'https://kinobase.example.com');
  if (back !== undefined) url.searchParams.set('back', back);
  return new Request(url.toString());
}

/** Куда маршрут увёл посетителя. `redirect` в Next бросает, поэтому исход достаётся
 *  из исключения, а не из возвращённого значения. */
async function redirectOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith('redirect:')) return message.slice('redirect:'.length);
    throw error;
  }
  throw new Error('маршрут не позвал redirect');
}

/** Единственная поставленная кука режима гостя — со всеми свойствами, с какими её ставили. */
function guestCookieSet(): CookieOptions {
  const put = state.set.filter((options) => options.name === GUEST_COOKIE_NAME);
  expect(put, 'кука режима гостя не ставилась').toHaveLength(1);
  return put[0] as CookieOptions;
}

function signIn() {
  state.jar.set(OWNER_COOKIE_NAME, SECRET);
}

function guestViewCookie() {
  state.jar.set(GUEST_COOKIE_NAME, '1');
}

beforeEach(() => {
  state.jar.clear();
  state.set.length = 0;
  state.deleted.length = 0;
  vi.stubEnv('OWNER_TOKEN', SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// Разбор параметра возврата

describe('backPath: внутренний путь принимается (критерий 23)', () => {
  it('путь карточки фильма возвращается как есть', async () => {
    const { backPath } = await loadOwner();

    expect(backPath('/films/12')).toBe('/films/12');
  });

  it('главная возвращается как есть', async () => {
    const { backPath } = await loadOwner();

    expect(backPath('/')).toBe('/');
  });

  it('путь с параметрами адреса сохраняется целиком', async () => {
    const { backPath } = await loadOwner();

    expect(backPath('/?status=watched&sort=rating')).toBe('/?status=watched&sort=rating');
  });

  it('путь персоналии возвращается как есть', async () => {
    const { backPath } = await loadOwner();

    expect(backPath('/people/mamoru-oshii')).toBe('/people/mamoru-oshii');
  });
});

describe('backPath: подделанный параметр даёт главную (критерий 23)', () => {
  it('параметра нет вовсе', async () => {
    const { backPath } = await loadOwner();

    expect(backPath(null)).toBe('/');
  });

  it('параметр пустой', async () => {
    const { backPath } = await loadOwner();

    expect(backPath('')).toBe('/');
  });

  it('две косые черты — это чужой сайт без схемы', async () => {
    const { backPath } = await loadOwner();

    expect(backPath('//example.com')).toBe('/');
  });

  it('полный внешний адрес', async () => {
    const { backPath } = await loadOwner();

    expect(backPath('https://example.com')).toBe('/');
    expect(backPath('http://example.com/films/1')).toBe('/');
  });

  it('обратные косые черты', async () => {
    const { backPath } = await loadOwner();

    expect(backPath('\\\\example.com')).toBe('/');
  });

  it('обратная косая сразу за прямой', async () => {
    const { backPath } = await loadOwner();

    expect(backPath('/\\example.com')).toBe('/');
  });

  it('путь без ведущей косой черты', async () => {
    const { backPath } = await loadOwner();

    expect(backPath('films/12')).toBe('/');
  });

  it('схема вместо пути', async () => {
    const { backPath } = await loadOwner();

    expect(backPath('javascript:alert(1)')).toBe('/');
  });

  // План, раздел 6: пробелы и управляющие знаки в пути — признак подделки, а не адреса.
  it('пробел внутри пути', async () => {
    const { backPath } = await loadOwner();

    expect(backPath('/films/12 https://example.com')).toBe('/');
  });

  it('перенос строки внутри пути', async () => {
    const { backPath } = await loadOwner();

    expect(backPath('/films\n/12')).toBe('/');
  });
});

describe('имя куки режима гостя', () => {
  it('константа GUEST_VIEW_COOKIE — «kinobase_guest_view»', async () => {
    const { GUEST_VIEW_COOKIE } = await loadOwner();

    expect(GUEST_VIEW_COOKIE).toBe(GUEST_COOKIE_NAME);
  });

  it('имя куки владельца рядом и не меняется', async () => {
    const { OWNER_COOKIE, GUEST_VIEW_COOKIE } = await loadOwner();

    expect(OWNER_COOKIE).toBe(OWNER_COOKIE_NAME);
    expect(GUEST_VIEW_COOKIE).not.toBe(OWNER_COOKIE);
  });
});

// ---------------------------------------------------------------------------
// Сессия: кто ты и чьими глазами смотришь

describe('ownerSession: кто ты (план, раздел 6)', () => {
  it('в боевой сборке — по куке владельца', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { ownerSession } = await loadSession();

    await expect(ownerSession()).resolves.toBe(false);

    signIn();
    await expect(ownerSession()).resolves.toBe(true);
  });

  it('вне боевой сборки — всегда владелец', async () => {
    const { ownerSession } = await loadSession();

    await expect(ownerSession()).resolves.toBe(true);
  });

  // Режим гостя не отвечает на вопрос «кто ты»: владелец в нём остаётся владельцем,
  // иначе снять режим было бы некому.
  it('кука режима гостя ответа не меняет: владелец остаётся владельцем', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    signIn();
    guestViewCookie();
    const { ownerSession } = await loadSession();

    await expect(ownerSession()).resolves.toBe(true);
  });
});

describe('guestViewOn: чьими глазами смотришь (план, раздел 6)', () => {
  it('куки нет — режим выключен', async () => {
    const { guestViewOn } = await loadSession();

    await expect(guestViewOn()).resolves.toBe(false);
  });

  it('кука стоит — режим включён', async () => {
    guestViewCookie();
    const { guestViewOn } = await loadSession();

    await expect(guestViewOn()).resolves.toBe(true);
  });

  it('в боевой сборке ответ тот же', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    guestViewCookie();
    const { guestViewOn } = await loadSession();

    await expect(guestViewOn()).resolves.toBe(true);
  });
});

describe('viewerIsOwner в режиме гостя (критерий 18)', () => {
  it('в боевой сборке владелец с кукой режима — не владелец', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    signIn();
    guestViewCookie();

    await expect(viewerIsOwner()).resolves.toBe(false);
  });

  it('в боевой сборке без куки режима владелец остаётся владельцем', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    signIn();

    await expect(viewerIsOwner()).resolves.toBe(true);
  });

  // Главное отличие режима от послабления v7: локально он работает. Иначе проверить
  // «как это выглядит для читателя» было бы негде — боевая сборка на то и боевая.
  it('вне боевой сборки кука режима тоже делает посетителя гостем', async () => {
    guestViewCookie();

    await expect(viewerIsOwner()).resolves.toBe(false);
  });

  it('вне боевой сборки без куки режима посетитель по-прежнему владелец', async () => {
    await expect(viewerIsOwner()).resolves.toBe(true);
  });

  it('снятие куки возвращает владельца', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    signIn();
    guestViewCookie();
    await expect(viewerIsOwner()).resolves.toBe(false);

    state.jar.delete(GUEST_COOKIE_NAME);

    await expect(viewerIsOwner()).resolves.toBe(true);
  });

  it('гостю кука режима ничего не даёт: он и так гость', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    guestViewCookie();

    await expect(viewerIsOwner()).resolves.toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Маршрут включения режима

describe('/owner/guest-view: кука ставится только владельцу (критерий 21)', () => {
  it('владельцу в боевой сборке кука ставится', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    signIn();
    const GET = await guestViewGet();

    await redirectOf(() => GET(request('/owner/guest-view', '/films/12')));

    expect(guestCookieSet().value).toBe('1');
  });

  it('гостю не ставится ничего', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const GET = await guestViewGet();

    await redirectOf(() => GET(request('/owner/guest-view', '/films/12')));

    expect(state.set).toHaveLength(0);
    expect(state.jar.has(GUEST_COOKIE_NAME)).toBe(false);
  });

  it('гость отправляется на главную, а не на свой путь', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const GET = await guestViewGet();

    const to = await redirectOf(() => GET(request('/owner/guest-view', '/films/12')));

    expect(to).toBe('/');
  });

  it('чужая кука владельцем не делает', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    state.jar.set(OWNER_COOKIE_NAME, 'совсем не тот секрет');
    const GET = await guestViewGet();

    await redirectOf(() => GET(request('/owner/guest-view', '/films/12')));

    expect(state.set).toHaveLength(0);
  });

  // Вне боевой сборки посетитель — владелец без куки (правило v7), и режим ему доступен:
  // ради локальной проверки он и заведён.
  it('вне боевой сборки кука ставится без входа', async () => {
    const GET = await guestViewGet();

    await redirectOf(() => GET(request('/owner/guest-view', '/films/12')));

    expect(guestCookieSet().value).toBe('1');
  });
});

describe('/owner/guest-view: свойства куки (критерий 22)', () => {
  beforeEach(() => {
    signIn();
  });

  it('имя куки — GUEST_VIEW_COOKIE', async () => {
    const GET = await guestViewGet();

    await redirectOf(() => GET(request('/owner/guest-view', '/')));

    expect(guestCookieSet().name).toBe(GUEST_COOKIE_NAME);
  });

  it('кука httpOnly', async () => {
    const GET = await guestViewGet();

    await redirectOf(() => GET(request('/owner/guest-view', '/')));

    expect(guestCookieSet().httpOnly).toBe(true);
  });

  it('sameSite — lax', async () => {
    const GET = await guestViewGet();

    await redirectOf(() => GET(request('/owner/guest-view', '/')));

    expect(guestCookieSet().sameSite).toBe('lax');
  });

  it('путь куки — весь сайт', async () => {
    const GET = await guestViewGet();

    await redirectOf(() => GET(request('/owner/guest-view', '/')));

    expect(guestCookieSet().path).toBe('/');
  });

  // Режим гостя — заход на минуту, а не состояние базы: кука живёт до закрытия вкладки.
  it('срока жизни у куки нет', async () => {
    const GET = await guestViewGet();

    await redirectOf(() => GET(request('/owner/guest-view', '/')));

    const cookie = guestCookieSet();
    expect(cookie.maxAge).toBeUndefined();
    expect(cookie.expires).toBeUndefined();
  });

  it('в боевой сборке кука несёт secure', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const GET = await guestViewGet();

    await redirectOf(() => GET(request('/owner/guest-view', '/')));

    expect(guestCookieSet().secure).toBe(true);
  });

  // Локально сайт открыт по http, и вечно secure кука там бы не поставилась —
  // а режим нужен именно там, где сайт собирают.
  it('вне боевой сборки secure не ставится', async () => {
    const GET = await guestViewGet();

    await redirectOf(() => GET(request('/owner/guest-view', '/')));

    expect(guestCookieSet().secure).toBe(false);
  });
});

describe('/owner/guest-view: возврат на прежнюю страницу (критерий 23)', () => {
  beforeEach(() => {
    signIn();
  });

  it('возвращает на путь из параметра back', async () => {
    const GET = await guestViewGet();

    const to = await redirectOf(() => GET(request('/owner/guest-view', '/films/12')));

    expect(to).toBe('/films/12');
  });

  it('путь с параметрами адреса сохраняется', async () => {
    const GET = await guestViewGet();

    const to = await redirectOf(() => GET(request('/owner/guest-view', '/?status=watched')));

    expect(to).toBe('/?status=watched');
  });

  it('без параметра back — на главную', async () => {
    const GET = await guestViewGet();

    const to = await redirectOf(() => GET(request('/owner/guest-view')));

    expect(to).toBe('/');
  });

  it('пустой параметр — на главную', async () => {
    const GET = await guestViewGet();

    const to = await redirectOf(() => GET(request('/owner/guest-view', '')));

    expect(to).toBe('/');
  });

  it('внешний адрес — на главную', async () => {
    const GET = await guestViewGet();

    expect(await redirectOf(() => GET(request('/owner/guest-view', '//example.com')))).toBe('/');
    expect(
      await redirectOf(() => GET(request('/owner/guest-view', 'https://example.com'))),
    ).toBe('/');
    expect(await redirectOf(() => GET(request('/owner/guest-view', '\\\\example.com')))).toBe('/');
  });

  it('подделанный параметр режима не отменяет: кука всё равно ставится', async () => {
    const GET = await guestViewGet();

    await redirectOf(() => GET(request('/owner/guest-view', 'https://example.com')));

    expect(guestCookieSet().value).toBe('1');
  });
});

// ---------------------------------------------------------------------------
// Маршрут снятия режима

describe('/owner/owner-view: снятие режима', () => {
  it('кука режима снимается', async () => {
    signIn();
    guestViewCookie();
    const GET = await ownerViewGet();

    await redirectOf(() => GET(request('/owner/owner-view', '/films/12')));

    expect(state.deleted).toContain(GUEST_COOKIE_NAME);
    expect(state.jar.has(GUEST_COOKIE_NAME)).toBe(false);
  });

  it('после снятия владелец снова владелец', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    signIn();
    guestViewCookie();
    await expect(viewerIsOwner()).resolves.toBe(false);

    const GET = await ownerViewGet();
    await redirectOf(() => GET(request('/owner/owner-view', '/')));

    await expect(viewerIsOwner()).resolves.toBe(true);
  });

  it('куку владельца маршрут не трогает', async () => {
    signIn();
    guestViewCookie();
    const GET = await ownerViewGet();

    await redirectOf(() => GET(request('/owner/owner-view', '/')));

    expect(state.deleted).not.toContain(OWNER_COOKIE_NAME);
    expect(state.jar.get(OWNER_COOKIE_NAME)).toBe(SECRET);
  });

  // Снятие куки никому не вредит, поэтому сессия здесь не сверяется (план, раздел 7):
  // маршрут не должен падать на том, у кого режима и не было.
  it('без стоящего режима маршрут не падает', async () => {
    signIn();
    const GET = await ownerViewGet();

    const to = await redirectOf(() => GET(request('/owner/owner-view', '/films/12')));

    expect(to).toBe('/films/12');
  });

  it('возвращает на путь из параметра back (критерий 23)', async () => {
    signIn();
    guestViewCookie();
    const GET = await ownerViewGet();

    const to = await redirectOf(() => GET(request('/owner/owner-view', '/people/mamoru-oshii')));

    expect(to).toBe('/people/mamoru-oshii');
  });

  it('без параметра back — на главную (критерий 23)', async () => {
    signIn();
    const GET = await ownerViewGet();

    expect(await redirectOf(() => GET(request('/owner/owner-view')))).toBe('/');
  });

  it('внешний адрес — на главную (критерий 23)', async () => {
    signIn();
    const GET = await ownerViewGet();

    expect(await redirectOf(() => GET(request('/owner/owner-view', '//example.com')))).toBe('/');
    expect(
      await redirectOf(() => GET(request('/owner/owner-view', 'https://example.com'))),
    ).toBe('/');
    expect(await redirectOf(() => GET(request('/owner/owner-view', '/\\example.com')))).toBe('/');
  });
});
