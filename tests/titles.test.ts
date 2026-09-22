// Критерий приёмки 23 версии v7 на уровне чистой логики: год у неоднозначного названия.
//
// Спека, раздел 6.1: если в базе больше одного тайтла с одинаковым русским названием,
// к названию при показе добавляется год в скобках — «Призрак в доспехах (1995)».
// Названия, уникальные в базе, не меняются. Год берётся из даты выхода; у тайтла без
// даты добавить нечего, и он остаётся как есть. В данные год не пишется никогда:
// `titleRu` — настоящее название, год живёт в `releaseDate` и приписывается при показе.
//
// Решение владельца от 26.08.2026: к неоднозначному названию приписывается год, а если
// это сериал — ещё и пометка «сериал». Одноимённые фильм и сериал тогда различаются
// с одного взгляда, а не по году, которого читатель может не помнить. Слова «фильм»
// в скобках нет: полный метр остаётся тем, чем был, — «Призрак в доспехах (1995)».
// Порядок внутри скобок — «сериал, 2026»: сначала то, что различает само, потом год.
// Уникальное название не трогается вовсе, даже у сериала, — путать его не с чем.
//
// Контракт '@/lib/titles':
//   function ambiguousTitles(films: { titleRu: string }[]): Set<string>;
//   function displayTitle(
//     film: { titleRu: string; releaseDate: string | null; tags?: readonly string[] },
//     ambiguous: ReadonlySet<string>,
//   ): string;
//
// Форма тайтла живёт тегом: в базе `films.tags` — массив машинных имён тегов
// (`text('tags', { mode: 'json' }).$type<string[]>()`, `notNull`, по умолчанию пустой),
// и ровно одно из них — тег категории `form`: 'film' или 'series'. Никакой отдельной
// колонки «сериал» нет, поэтому `displayTitle` спрашивает про сериальность массив тегов.
// Поле необязательно: вызывающие места, которым форма неизвестна, передают объект без
// него, и такой тайтл ведёт себя как фильм. Данные состояния «тегов нет» допускать
// не должны — ловит это `validateTags`, а не функция показа.
//
// Неоднозначность — свойство базы целиком, поэтому набор считается один раз по всему
// списку и передаётся дальше. `displayTitle` — чистая функция: она ничего не читает
// из базы и ничего не пишет в переданный объект.

import { describe, it, expect } from 'vitest';
import { ambiguousTitles, displayTitle } from '@/lib/titles';

const gits1995 = { titleRu: 'Призрак в доспехах', releaseDate: '1995-11-18' };
const gits2026 = { titleRu: 'Призрак в доспехах', releaseDate: '2026-01-15' };
const matrix = { titleRu: 'Матрица', releaseDate: '1999-03-31' };

// Те же два тайтла, но с формой: полный метр Осии и сериал 2026 года.
const gitsFilm = {
  titleRu: 'Призрак в доспехах',
  releaseDate: '1995-11-18',
  tags: ['film', 'animation', 'sci-fi'],
};
const gitsSeries = {
  titleRu: 'Призрак в доспехах',
  releaseDate: '2026-01-15',
  tags: ['series', 'animation', 'sci-fi'],
};
const severance = {
  titleRu: 'Разделение',
  releaseDate: '2022-02-18',
  tags: ['series', 'live-action', 'thriller'],
};

describe('ambiguousTitles: какие названия в базе неоднозначны', () => {
  it('пустой список — пустой набор', () => {
    expect(ambiguousTitles([])).toEqual(new Set());
  });

  it('единственный тайтл неоднозначным не бывает', () => {
    expect(ambiguousTitles([matrix])).toEqual(new Set());
  });

  it('все названия уникальны — набор пуст', () => {
    expect(ambiguousTitles([gits1995, matrix, { titleRu: 'Авалон' }])).toEqual(new Set());
  });

  it('два одинаковых названия — название попадает в набор', () => {
    expect(ambiguousTitles([gits1995, gits2026])).toEqual(new Set(['Призрак в доспехах']));
  });

  it('три одинаковых названия — название попадает в набор один раз', () => {
    const set = ambiguousTitles([
      gits1995,
      gits2026,
      { titleRu: 'Призрак в доспехах', releaseDate: '2004-03-06' },
    ]);

    expect(set).toEqual(new Set(['Призрак в доспехах']));
    expect(set.size).toBe(1);
  });

  it('неоднозначное и уникальное названия рядом — в наборе только неоднозначное', () => {
    expect(ambiguousTitles([gits1995, matrix, gits2026])).toEqual(
      new Set(['Призрак в доспехах']),
    );
  });

  it('две разные пары одинаковых названий — в наборе оба названия', () => {
    expect(
      ambiguousTitles([gits1995, gits2026, { titleRu: 'Матрица' }, { titleRu: 'Матрица' }]),
    ).toEqual(new Set(['Призрак в доспехах', 'Матрица']));
  });

  it('исходный список не меняется', () => {
    const films = [gits1995, gits2026];

    ambiguousTitles(films);

    expect(films).toEqual([gits1995, gits2026]);
  });
});

describe('displayTitle: название для показа', () => {
  const ambiguous = new Set(['Призрак в доспехах']);

  it('неоднозначное название с датой выхода несёт год в скобках', () => {
    expect(displayTitle(gits1995, ambiguous)).toBe('Призрак в доспехах (1995)');
  });

  it('второй тайтл с тем же названием несёт свой год', () => {
    expect(displayTitle(gits2026, ambiguous)).toBe('Призрак в доспехах (2026)');
  });

  it('неоднозначное название без даты выхода остаётся как есть', () => {
    expect(displayTitle({ titleRu: 'Призрак в доспехах', releaseDate: null }, ambiguous)).toBe(
      'Призрак в доспехах',
    );
  });

  it('уникальное название с датой выхода год не получает', () => {
    expect(displayTitle(matrix, ambiguous)).toBe('Матрица');
  });

  it('уникальное название без даты выхода остаётся как есть', () => {
    expect(displayTitle({ titleRu: 'Авалон', releaseDate: null }, ambiguous)).toBe('Авалон');
  });

  it('пустой набор неоднозначных названий ничего не меняет', () => {
    expect(displayTitle(gits1995, new Set())).toBe('Призрак в доспехах');
  });
});

describe('displayTitle: пометка «сериал» у неоднозначного названия', () => {
  const ambiguous = new Set(['Призрак в доспехах']);

  it('неоднозначное название у сериала несёт пометку и год', () => {
    expect(displayTitle(gitsSeries, ambiguous)).toBe('Призрак в доспехах (сериал, 2026)');
  });

  it('неоднозначное название у фильма несёт только год, без слова «фильм»', () => {
    expect(displayTitle(gitsFilm, ambiguous)).toBe('Призрак в доспехах (1995)');
  });

  it('внутри скобок сначала пометка, потом год', () => {
    expect(displayTitle(gitsSeries, ambiguous)).toMatch(/\(сериал, 2026\)$/);
  });

  it('неоднозначное название у сериала без даты выхода несёт одну пометку', () => {
    expect(
      displayTitle(
        { titleRu: 'Призрак в доспехах', releaseDate: null, tags: ['series', 'animation'] },
        ambiguous,
      ),
    ).toBe('Призрак в доспехах (сериал)');
  });

  it('неоднозначное название у фильма без даты выхода остаётся как есть', () => {
    expect(
      displayTitle(
        { titleRu: 'Призрак в доспехах', releaseDate: null, tags: ['film', 'animation'] },
        ambiguous,
      ),
    ).toBe('Призрак в доспехах');
  });

  it('уникальное название у сериала пометки не получает', () => {
    expect(displayTitle(severance, ambiguous)).toBe('Разделение');
  });

  it('уникальное название у сериала без даты выхода остаётся как есть', () => {
    expect(
      displayTitle({ titleRu: 'Авалон', releaseDate: null, tags: ['series', 'live-action'] }, ambiguous),
    ).toBe('Авалон');
  });

  it('пустой набор неоднозначных названий не даёт пометки и сериалу', () => {
    expect(displayTitle(gitsSeries, new Set())).toBe('Призрак в доспехах');
  });

  it('порядок тегов в массиве на пометку не влияет', () => {
    expect(
      displayTitle(
        { titleRu: 'Призрак в доспехах', releaseDate: '2026-01-15', tags: ['sci-fi', 'animation', 'series'] },
        ambiguous,
      ),
    ).toBe('Призрак в доспехах (сериал, 2026)');
  });

  it('теги без формы вовсе оставляют неоднозначное название с одним годом', () => {
    expect(
      displayTitle(
        { titleRu: 'Призрак в доспехах', releaseDate: '2026-01-15', tags: ['animation', 'sci-fi'] },
        ambiguous,
      ),
    ).toBe('Призрак в доспехах (2026)');
  });

  it('пустой массив тегов оставляет неоднозначное название с одним годом', () => {
    expect(
      displayTitle({ titleRu: 'Призрак в доспехах', releaseDate: '2026-01-15', tags: [] }, ambiguous),
    ).toBe('Призрак в доспехах (2026)');
  });

  it('поле тегов не передано вовсе — неоднозначное название ведёт себя как фильм', () => {
    expect(displayTitle(gits2026, ambiguous)).toBe('Призрак в доспехах (2026)');
  });

  it('теги переданного объекта не меняются', () => {
    const film = {
      titleRu: 'Призрак в доспехах',
      releaseDate: '2026-01-15',
      tags: ['series', 'animation', 'sci-fi'],
    };

    displayTitle(film, ambiguous);

    expect(film.tags).toEqual(['series', 'animation', 'sci-fi']);
  });
});

describe('displayTitle: год не пишется в данные', () => {
  it('переданный объект остаётся нетронутым', () => {
    const film = { titleRu: 'Призрак в доспехах', releaseDate: '1995-11-18' };

    displayTitle(film, new Set(['Призрак в доспехах']));

    expect(film).toEqual({ titleRu: 'Призрак в доспехах', releaseDate: '1995-11-18' });
  });

  it('повторный вызов не наращивает год второй раз', () => {
    const film = { titleRu: 'Призрак в доспехах', releaseDate: '1995-11-18' };
    const ambiguous = new Set(['Призрак в доспехах']);

    displayTitle(film, ambiguous);

    expect(displayTitle(film, ambiguous)).toBe('Призрак в доспехах (1995)');
  });
});

describe('ambiguousTitles и displayTitle вместе', () => {
  it('набор, посчитанный по базе, различает два одноимённых тайтла и не трогает третий', () => {
    const films = [gits1995, gits2026, matrix];
    const ambiguous = ambiguousTitles(films);

    expect(films.map((film) => displayTitle(film, ambiguous))).toEqual([
      'Призрак в доспехах (1995)',
      'Призрак в доспехах (2026)',
      'Матрица',
    ]);
  });

  it('одноимённые фильм и сериал различаются пометкой, а уникальный сериал не трогается', () => {
    const films = [gitsFilm, gitsSeries, severance];
    const ambiguous = ambiguousTitles(films);

    expect(films.map((film) => displayTitle(film, ambiguous))).toEqual([
      'Призрак в доспехах (1995)',
      'Призрак в доспехах (сериал, 2026)',
      'Разделение',
    ]);
  });
});
