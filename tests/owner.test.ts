// Критерии приёмки 5–11 версии v6 на уровне доменной логики: признак владельца.
// Владелец — тот, у кого кука совпала с секретом приложения. Всё остальное — гость.
//
// Контракт '@/lib/owner', зафиксированный планом v6:
//   const OWNER_COOKIE = 'kinobase_owner';
//   function isOwner(cookieValue: string | undefined, secret: string | undefined): boolean;
//
// Оба аргумента приходят снаружи, поэтому функция чистая и проверяется без
// переменных окружения и без кук. Отказ по умолчанию — явное требование плана:
// пустой или отсутствующий секрет означает «не владелец никогда», иначе опечатка
// в конфигурации сервера превратилась бы в открытую дверь.
//
// Отдельно проверяется сравнение значений разной длины: постоянное по времени
// сравнение из node:crypto бросает исключение, если буферы разной длины, поэтому
// длины обязаны сверяться до него.

import { describe, it, expect } from 'vitest';
import { isOwner, OWNER_COOKIE } from '@/lib/owner';

const SECRET = 'a7f3c1e9b40d2856a7f3c1e9b40d2856';

describe('имя куки', () => {
  it('константа OWNER_COOKIE — «kinobase_owner»', () => {
    expect(OWNER_COOKIE).toBe('kinobase_owner');
  });
});

describe('isOwner: владелец', () => {
  it('кука совпала с секретом — владелец', () => {
    expect(isOwner(SECRET, SECRET)).toBe(true);
  });

  it('совпадение проверяется по значению, а не по ссылке', () => {
    expect(isOwner(`${SECRET}`, [SECRET].join(''))).toBe(true);
  });
});

describe('isOwner: гость', () => {
  it('другое значение той же длины — не владелец', () => {
    const other = `${'0'.repeat(SECRET.length - 1)}1`;

    expect(other).toHaveLength(SECRET.length);
    expect(isOwner(other, SECRET)).toBe(false);
  });

  it('значение отличается одним символом — не владелец', () => {
    const almost = `${SECRET.slice(0, -1)}0`;

    expect(isOwner(almost, SECRET)).toBe(false);
  });

  it('куки нет вовсе — не владелец', () => {
    expect(isOwner(undefined, SECRET)).toBe(false);
  });

  it('кука пустая — не владелец', () => {
    expect(isOwner('', SECRET)).toBe(false);
  });

  it('регистр значения имеет значение', () => {
    expect(isOwner(SECRET.toUpperCase(), SECRET)).toBe(false);
  });
});

describe('isOwner: отказ по умолчанию при отсутствующем секрете', () => {
  it('секрета нет, кука верная на вид — не владелец', () => {
    expect(isOwner(SECRET, undefined)).toBe(false);
  });

  it('секрет пустой — не владелец', () => {
    expect(isOwner(SECRET, '')).toBe(false);
  });

  it('пустой секрет и пустая кука — не владелец, хотя значения формально равны', () => {
    expect(isOwner('', '')).toBe(false);
  });

  it('нет ни куки, ни секрета — не владелец', () => {
    expect(isOwner(undefined, undefined)).toBe(false);
  });
});

describe('isOwner: значения разной длины', () => {
  it('кука короче секрета — false, а не исключение', () => {
    expect(() => isOwner(SECRET.slice(0, 8), SECRET)).not.toThrow();
    expect(isOwner(SECRET.slice(0, 8), SECRET)).toBe(false);
  });

  it('кука длиннее секрета — false, а не исключение', () => {
    expect(() => isOwner(`${SECRET}хвост`, SECRET)).not.toThrow();
    expect(isOwner(`${SECRET}хвост`, SECRET)).toBe(false);
  });

  it('кука начинается с секрета — не владелец', () => {
    expect(isOwner(`${SECRET}0`, SECRET)).toBe(false);
  });

  it('секрет начинается с куки — не владелец', () => {
    expect(isOwner(SECRET.slice(0, -1), SECRET)).toBe(false);
  });
});
