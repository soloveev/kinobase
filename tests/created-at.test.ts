// Дата заведения тайтла в базу: колонка `created_at` в таблице `films`.
//
// Зачем поле появилось. В базе не было ответа на вопрос «когда этот тайтл сюда попал»:
// год выхода фильма и дата сбора материалов есть, а дата собственной записи — нет.
//
// Контракт, зафиксированный этими тестами: колонка `created_at` в `films` — text,
// ISO-дата 'ГГГГ-ММ-ДД', допускает null, значения по умолчанию на уровне БД нет.
//
// Почему у колонки нет умолчания вроде `CURRENT_DATE`. Дата принадлежит тайтлу,
// а не конкретной базе: локальная копия и боевая обязаны нести одну и ту же дату,
// даже если долив на сервер случился позже. Умолчание на уровне БД проставило бы
// на сервере день долива, и две базы разошлись бы. Поэтому дата приезжает из файла
// данных — а проверяет её наличие и форму `check-data`, см. tests/check-data.test.ts.
//
// Null означает «дата неизвестна». Таким поле останется у тайтлов, занесённых
// до появления колонки, если их не удалось датировать: выдуманная дата хуже пустой.
//
// Дату заведения не меняют задним числом, и это проверяют соседние файлы:
// tests/refresh.test.ts — что её не переносит пересев справочных полей,
// tests/films-repo.test.ts — что её не трогает сохранение личных полей.

import { describe, it, expect, beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';
import { createDb } from '@/db';
import type { Db } from '@/db';
import { films } from '@/db/schema';
import { filmValues } from './helpers';

describe('колонка created_at в таблице films', () => {
  let db: Db;

  beforeEach(() => {
    db = createDb(':memory:');
  });

  /** Описание колонки из `PRAGMA table_info`: имя, тип, обязательность, значение
   *  по умолчанию. Читаем схему у самой базы, а не у объявления в коде: до строки
   *  таблицы поле доезжает только через миграцию. */
  function columnInfo(name: string) {
    const rows = db.all<{
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
    }>(sql`PRAGMA table_info(films)`);
    return rows.find((column) => column.name === name);
  }

  it('колонка текстовая, допускает null и не имеет значения по умолчанию', () => {
    const column = columnInfo('created_at');

    expect(column).toBeDefined();
    expect(column!.type.toLowerCase()).toBe('text');
    // Null означает «дата неизвестна»: у тайтлов, занесённых до появления колонки,
    // она такой и останется.
    expect(column!.notnull).toBe(0);
    // Умолчания на уровне БД нет: дата приезжает из файла данных, одинаковая
    // в локальной базе и на сервере.
    expect(column!.dflt_value).toBeNull();
  });

  it('строка, вставленная с датой заведения, читается тем же значением', () => {
    const inserted = db
      .insert(films)
      .values(
        filmValues({ titleRu: 'Одиссея', titleOriginal: 'The Odyssey', createdAt: '2025-03-14' }),
      )
      .returning()
      .all();

    expect(inserted[0].createdAt).toBe('2025-03-14');
    expect(db.select().from(films).all()[0].createdAt).toBe('2025-03-14');
  });

  it('строка, вставленная без даты заведения, читается с null', () => {
    const inserted = db
      .insert(films)
      .values(filmValues({ titleRu: 'Оружие', titleOriginal: 'Weapons' }))
      .returning()
      .all();

    expect(inserted[0].createdAt).toBeNull();
  });
});
