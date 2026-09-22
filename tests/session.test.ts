// Критерий приёмки 24 версии v7: локально база всегда своя.
//
// Спека, раздел 6.2: вне боевой сборки (`NODE_ENV !== 'production'`) посетитель считается
// владельцем всегда — без куки и без входа. Локальная база — личная копия владельца на его
// же машине, гостя там нет и быть не может. В боевой сборке ничего не меняется: там
// по-прежнему сверяется кука с секретом `OWNER_TOKEN`, и без совпадения — гость.
//
// Контракт '@/lib/session':
//   async function viewerIsOwner(): Promise<boolean>;
//
// Проверяется именно `viewerIsOwner`, а не `isOwner` из '@/lib/owner'. Разделение
// намеренное: `isOwner` — чистая сверка двух значений, она не знает ни про куки, ни про
// окружение и этой правкой не меняется вовсе (её контракт держит tests/owner.test.ts).
// Послабление живёт на границе системы — там, где признак владельца достаётся из запроса.
//
// Как это проверяется. `viewerIsOwner` асинхронна и читает куку через 'next/headers',
// поэтому модуль подменяется: подстановка отдаёт ровно одну куку — ту, которую задал тест.
// `NODE_ENV` в тестах равен 'test', то есть «не боевая сборка» — это умолчание и отдельной
// подготовки не требует; боевая сборка задаётся подстановкой значения на время теста
// и снимается после него.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { viewerIsOwner } from '@/lib/session';
import { OWNER_COOKIE } from '@/lib/owner';

const SECRET = 'a7f3c1e9b40d2856a7f3c1e9b40d2856';

const state = vi.hoisted(() => ({ cookie: undefined as string | undefined }));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === 'kinobase_owner' && state.cookie !== undefined
        ? { name, value: state.cookie }
        : undefined,
    getAll: () => [],
    has: (name: string) => name === 'kinobase_owner' && state.cookie !== undefined,
  }),
}));

beforeEach(() => {
  state.cookie = undefined;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('viewerIsOwner: вне боевой сборки посетитель — владелец', () => {
  it('NODE_ENV в тестах не «production»', () => {
    expect(process.env.NODE_ENV).not.toBe('production');
  });

  it('куки нет вовсе — всё равно владелец', async () => {
    vi.stubEnv('OWNER_TOKEN', SECRET);

    await expect(viewerIsOwner()).resolves.toBe(true);
  });

  it('секрета нет вовсе — всё равно владелец', async () => {
    vi.stubEnv('OWNER_TOKEN', '');

    await expect(viewerIsOwner()).resolves.toBe(true);
  });

  it('кука чужая — всё равно владелец', async () => {
    vi.stubEnv('OWNER_TOKEN', SECRET);
    state.cookie = 'совсем не тот секрет';

    await expect(viewerIsOwner()).resolves.toBe(true);
  });

  it('кука пустая — всё равно владелец', async () => {
    vi.stubEnv('OWNER_TOKEN', SECRET);
    state.cookie = '';

    await expect(viewerIsOwner()).resolves.toBe(true);
  });

  it('в сборке «development» правило то же', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('OWNER_TOKEN', SECRET);

    await expect(viewerIsOwner()).resolves.toBe(true);
  });
});

describe('viewerIsOwner: в боевой сборке правило прежнее', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
  });

  it('куки нет — не владелец', async () => {
    vi.stubEnv('OWNER_TOKEN', SECRET);

    await expect(viewerIsOwner()).resolves.toBe(false);
  });

  it('кука сошлась с секретом — владелец', async () => {
    vi.stubEnv('OWNER_TOKEN', SECRET);
    state.cookie = SECRET;

    await expect(viewerIsOwner()).resolves.toBe(true);
  });

  it('кука не сошлась с секретом — не владелец', async () => {
    vi.stubEnv('OWNER_TOKEN', SECRET);
    state.cookie = `${SECRET.slice(0, -1)}0`;

    await expect(viewerIsOwner()).resolves.toBe(false);
  });

  it('кука пустая — не владелец', async () => {
    vi.stubEnv('OWNER_TOKEN', SECRET);
    state.cookie = '';

    await expect(viewerIsOwner()).resolves.toBe(false);
  });

  it('секрет пустой — не владелец, хотя кука формально ему равна', async () => {
    vi.stubEnv('OWNER_TOKEN', '');
    state.cookie = '';

    await expect(viewerIsOwner()).resolves.toBe(false);
  });

  it('секрета нет вовсе — не владелец: опечатка в конфигурации закрывает дверь', async () => {
    vi.stubEnv('OWNER_TOKEN', undefined);
    state.cookie = SECRET;

    await expect(viewerIsOwner()).resolves.toBe(false);
  });
});

describe('viewerIsOwner: имя куки', () => {
  it('признак берётся из куки OWNER_COOKIE', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('OWNER_TOKEN', SECRET);
    state.cookie = SECRET;

    expect(OWNER_COOKIE).toBe('kinobase_owner');
    await expect(viewerIsOwner()).resolves.toBe(true);
  });
});
