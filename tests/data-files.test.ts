// Спецификация захода 22.09.2026 (без версии — рефакторинг путей к файлам наполнения),
// пункт 4: единый список файлов данных для скриптов наполнения.
//
// Контракт модуля '../scripts/lib/data-files':
//   export const DATA_FILES: {
//     films: string;
//     tags: string;
//     seasons: string;
//     dossiers: string;
//     people: string;
//   };
//
// До этой правки пути к файлам наполнения лежали в `specs/vN/*-data.json` — разными
// версиями в разных скриптах (`scripts/check-data.ts`, `scripts/fill-*.ts` и прочие),
// и правка одного скрипта молча расходилась с остальными. Новый модуль — общий дом
// для пяти путей, и они переезжают в `content/*.json`: ни один больше не должен
// указывать внутрь `specs/`, это архив версий, а не источник для скриптов наполнения.
//
// Тест проверяет сам модуль как контракт: ровно пять ключей, ровно эти пять значений,
// и что среди них нет ни одного пути внутрь `specs/`. Правильность самого пути на диске
// (существование файла) — забота других тестов и живого прогона скриптов, не этого.

import { describe, it, expect } from 'vitest';
import { DATA_FILES } from '../scripts/lib/data-files';

describe('DATA_FILES: состав (пункт 4)', () => {
  it('несёт ровно пять ключей', () => {
    expect(Object.keys(DATA_FILES).sort()).toEqual(
      ['dossiers', 'films', 'people', 'seasons', 'tags'].sort(),
    );
  });

  it('films — content/films-data.json', () => {
    expect(DATA_FILES.films).toBe('content/films-data.json');
  });

  it('tags — content/tags-data.json', () => {
    expect(DATA_FILES.tags).toBe('content/tags-data.json');
  });

  it('seasons — content/seasons-data.json', () => {
    expect(DATA_FILES.seasons).toBe('content/seasons-data.json');
  });

  it('dossiers — content/dossier-data.json', () => {
    expect(DATA_FILES.dossiers).toBe('content/dossier-data.json');
  });

  it('people — content/people-data.json', () => {
    expect(DATA_FILES.people).toBe('content/people-data.json');
  });
});

describe('DATA_FILES: ни один путь не смотрит в specs/ (пункт 4)', () => {
  it('ни одно значение не начинается с "specs/"', () => {
    for (const [key, value] of Object.entries(DATA_FILES)) {
      expect(value.startsWith('specs/'), `${key}: "${value}" начинается с specs/`).toBe(false);
    }
  });

  it('значений ровно пять и все — непустые строки', () => {
    const values = Object.values(DATA_FILES);

    expect(values).toHaveLength(5);
    for (const value of values) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
    }
  });
});
