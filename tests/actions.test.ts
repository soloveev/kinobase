// Критерии приёмки 6 и 11 версии v6 на уровне серверного действия:
// 6 — гость, отправивший запрос на изменение личных полей напрямую, получает отказ,
//     значения в базе при этом не меняются;
// 11 — отказ не молчит: действие возвращает ту же форму, что и все прочие ошибки,
//     `{ ok: false, error }`, с текстом «Сессия истекла, войдите заново, чтобы менять
//     личные поля» — существующая ветка ошибки в PersonalFields покажет его как есть.
//
// Почему проверяется само действие, а не отдельная функция-страж.
// Спека требует, чтобы отказывало именно то, что пишет в базу («серверное действие
// отказывается писать в базу без признака»). Проверка чистого стража оставила бы
// открытым главный вопрос — вызван ли страж до записи, — а он и есть предмет критерия 6.
// Мокирования при этом ровно два, и оба безобидные: '@/db' подменяется настоящей базой
// в памяти (фабрика createDb — та же, что во всех остальных тестах хранилища), а
// 'next/headers' — объектом с одной кукой. Ни то, ни другое не подделывает поведение,
// которое проверяется: результат действия и содержимое базы после него настоящие.
//
// Признак владельца действие берёт из куки OWNER_COOKIE и сверяет с секретом
// в переменной окружения OWNER_TOKEN — так это описано в плане v6. Секрет ставится
// до импорта модулей, чтобы реализация могла прочитать его хоть на верхнем уровне.
//
// Правка от 23.08.2026 (спека v7, раздел 6.2). Разделение гостя и владельца существует
// только в боевой сборке: локальная база — личная копия владельца, и вне production
// `viewerIsOwner` возвращает `true` без куки. Поэтому здесь окружение объявляется
// боевым явно — иначе тесты проверяли бы не то, что описывают.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDb, type Db } from '@/db';
import { films, type Film } from '@/db/schema';
import { getFilm } from '@/lib/films-repo';
import { updatePersonalAction } from '@/app/actions';
import { filmValues } from './helpers';

const SECRET = 'a7f3c1e9b40d2856a7f3c1e9b40d2856';
const DENIED = 'Сессия истекла, войдите заново, чтобы менять личные поля';
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

let db: Db;
let film: Film;

/** Признак владельца в браузере посетителя: с секретом — владелец, без — гость. */
function signIn() {
  state.cookie = SECRET;
}

function signOut() {
  state.cookie = undefined;
}

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('OWNER_TOKEN', SECRET);
  db = createDb(':memory:');
  state.db = db;
  film = db
    .insert(films)
    .values(
      filmValues({
        titleRu: 'Малхолланд Драйв',
        releaseDate: RELEASED,
        watched: true,
        myRating: 7,
        tasteStar: false,
        comment: 'Личная заметка',
      }),
    )
    .returning()
    .all()[0];
  signOut();
  state.guestView = false;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('правка личных полей без признака владельца', () => {
  it('отклоняется с понятной ошибкой', async () => {
    const result = await updatePersonalAction(film.id, { myRating: 10 });

    expect(result).toEqual({ ok: false, error: DENIED });
  });

  it('не меняет базу', async () => {
    await updatePersonalAction(film.id, { myRating: 10 });

    expect(getFilm(db, film.id)?.myRating).toBe(7);
  });

  it('не меняет комментарий', async () => {
    await updatePersonalAction(film.id, { comment: 'подмена' });

    expect(getFilm(db, film.id)?.comment).toBe('Личная заметка');
  });

  it('не меняет галочки и звёздочку', async () => {
    await updatePersonalAction(film.id, { watched: false, wantToWatch: true, tasteStar: true });

    const saved = getFilm(db, film.id);
    expect(saved?.watched).toBe(true);
    expect(saved?.wantToWatch).toBe(false);
    expect(saved?.tasteStar).toBe(false);
  });

  it('отказ приходит раньше разбора данных: заведомо негодный патч даёт тот же текст', async () => {
    const result = await updatePersonalAction(film.id, { myRating: 'десять' });

    expect(result).toEqual({ ok: false, error: DENIED });
  });

  it('отказ приходит раньше поиска фильма: несуществующий id даёт тот же текст', async () => {
    const result = await updatePersonalAction(9999, { tasteStar: true });

    expect(result).toEqual({ ok: false, error: DENIED });
  });
});

describe('правка личных полей с чужой или испорченной кукой', () => {
  it('значение куки не совпало с секретом — отказ', async () => {
    state.cookie = 'a7f3c1e9b40d2856a7f3c1e9b40d2857';

    const result = await updatePersonalAction(film.id, { myRating: 10 });

    expect(result).toEqual({ ok: false, error: DENIED });
    expect(getFilm(db, film.id)?.myRating).toBe(7);
  });

  it('кука пустая — отказ', async () => {
    state.cookie = '';

    const result = await updatePersonalAction(film.id, { myRating: 10 });

    expect(result).toEqual({ ok: false, error: DENIED });
  });

  it('секрета на сервере нет — отказ даже при верной на вид куке', async () => {
    vi.stubEnv('OWNER_TOKEN', '');
    signIn();

    const result = await updatePersonalAction(film.id, { myRating: 10 });

    expect(result).toEqual({ ok: false, error: DENIED });
    expect(getFilm(db, film.id)?.myRating).toBe(7);
  });
});

describe('правка личных полей владельцем', () => {
  it('оценка сохраняется', async () => {
    signIn();

    const result = await updatePersonalAction(film.id, { myRating: 10 });

    expect(result.ok).toBe(true);
    expect(getFilm(db, film.id)?.myRating).toBe(10);
  });

  it('комментарий сохраняется', async () => {
    signIn();

    await updatePersonalAction(film.id, { comment: 'Новая заметка' });

    expect(getFilm(db, film.id)?.comment).toBe('Новая заметка');
  });

  it('звёздочка вкуса переключается', async () => {
    signIn();

    await updatePersonalAction(film.id, { tasteStar: true });

    expect(getFilm(db, film.id)?.tasteStar).toBe(true);
  });

  it('проверки версии v2 остались на месте: негодная оценка отклоняется своим текстом', async () => {
    signIn();

    const result = await updatePersonalAction(film.id, { myRating: 42 });

    expect(result).toEqual({ ok: false, error: 'Оценка — целое число от 1 до 10' });
    expect(getFilm(db, film.id)?.myRating).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// Дополнение v14, критерий приёмки 19: `updatePersonalAction` в режиме «глазами гостя»
// отказывает тем же текстом, что и настоящему гостю.
//
// Ни строки в самом действии это не требует: страж `viewerIsOwner()` стоит здесь с v6,
// а режим гостя меняет его ответ. В этом и главное решение раздела D — режим не прячет
// владельца вёрсткой, а по-настоящему делает его гостем на время просмотра. Проверяется
// поэтому результат: тот же текст отказа, база не тронута.
//
// Отдельно закреплено, что текст отказа один и тот же. Разные тексты для «гостя» и «режима
// гостя» выдали бы владельца самому себе — и заодно завели бы вторую ветку ошибки в
// PersonalFields, которой там быть не должно.

describe('правка личных полей в режиме «глазами гостя» (критерий 19)', () => {
  beforeEach(() => {
    signIn();
    state.guestView = true;
  });

  it('отклоняется тем же текстом, что и у настоящего гостя', async () => {
    const result = await updatePersonalAction(film.id, { myRating: 10 });

    expect(result).toEqual({ ok: false, error: DENIED });
  });

  it('оценка в базе не меняется', async () => {
    await updatePersonalAction(film.id, { myRating: 10 });

    expect(getFilm(db, film.id)?.myRating).toBe(7);
  });

  it('комментарий в базе не меняется', async () => {
    await updatePersonalAction(film.id, { comment: 'подмена' });

    expect(getFilm(db, film.id)?.comment).toBe('Личная заметка');
  });

  it('галочки и звёздочка не меняются', async () => {
    await updatePersonalAction(film.id, { watched: false, wantToWatch: true, tasteStar: true });

    const saved = getFilm(db, film.id);
    expect(saved?.watched).toBe(true);
    expect(saved?.wantToWatch).toBe(false);
    expect(saved?.tasteStar).toBe(false);
  });

  it('отказ приходит раньше разбора данных: негодный патч даёт тот же текст', async () => {
    const result = await updatePersonalAction(film.id, { myRating: 'десять' });

    expect(result).toEqual({ ok: false, error: DENIED });
  });

  // Локально владелец правит личные поля без входа (правило v7), и режим гостя —
  // единственное, что закрывает ему правку вне боевой сборки.
  it('вне боевой сборки режим тоже отбивает правку (критерий 18)', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    signOut();

    const result = await updatePersonalAction(film.id, { myRating: 10 });

    expect(result).toEqual({ ok: false, error: DENIED });
    expect(getFilm(db, film.id)?.myRating).toBe(7);
  });

  it('после снятия режима правка снова проходит', async () => {
    expect(await updatePersonalAction(film.id, { myRating: 10 })).toEqual({
      ok: false,
      error: DENIED,
    });

    state.guestView = false;

    const result = await updatePersonalAction(film.id, { myRating: 10 });

    expect(result.ok).toBe(true);
    expect(getFilm(db, film.id)?.myRating).toBe(10);
  });
});

// Дополнение v14, критерий приёмки 6 на уровне пути записи: пустой комментарий доезжает
// до базы как `null`, а не как пустая строка. Приведение делает валидатор, но проверяется
// оно здесь же — на настоящей базе: от `null` зависит, покажется ли блок читателю.
describe('комментарий в базе после правки владельцем (критерий 6)', () => {
  beforeEach(() => {
    signIn();
  });

  it('пустая строка снимает комментарий в null', async () => {
    await updatePersonalAction(film.id, { comment: '' });

    expect(getFilm(db, film.id)?.comment).toBeNull();
  });

  it('одни пробелы — тоже null', async () => {
    await updatePersonalAction(film.id, { comment: '   \n ' });

    expect(getFilm(db, film.id)?.comment).toBeNull();
  });

  it('у непустого комментария обрезаются края', async () => {
    await updatePersonalAction(film.id, { comment: '  Пересмотрел\n\n' });

    expect(getFilm(db, film.id)?.comment).toBe('Пересмотрел');
  });
});
