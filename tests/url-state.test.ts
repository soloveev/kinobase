// Критерий приёмки 8: таб и сортировка отражаются в query-параметрах; прямой заход по адресу
// с параметрами открывает соответствующее состояние; неизвестные значения параметров не ломают
// страницу (трактуются как значения по умолчанию). Также критерий 3 (по умолчанию открыт «Все»)
// и критерий 6 (сортировка по дате — режим по умолчанию) в части адреса страницы.

// Дополнение v3, критерий приёмки 11: фильтры (жанры, форма, вид) отражаются в адресе,
// прямой заход по адресу открывает то же состояние, неизвестные значения не ломают страницу.
//
// Контракт из plan.md:
//   function parseFilters(params: Record<string, string | string[] | undefined>): Filters;
//   function gridHref(status: StatusFilter, sort: SortMode, filters?: Filters): string;
// Жанры в адресе перечисляются через запятую: /?genre=horror,thriller&form=series&kind=animation.
// Третий аргумент gridHref необязателен — старые вызовы (SortSwitch, табы) продолжают работать.
//
// Дополнение v5, критерии приёмки 10 и 14: у табов появляется пятый — «Другие» (status=other),
// а у фильтров пятая группа — вкус (?taste=star). Значение по умолчанию — «все» —
// в адрес не пишется, мусорные значения отбрасываются.

// Дополнение v7, критерии приёмки 3 и 13: у указателя персоналий своё состояние в адресе —
// `?role=director` или `?role=director,screenwriter`. Разбор устроен как разбор жанров:
// список через запятую, ключи вне словаря ролей молча отбрасываются, повторный параметр
// адреса (массив значений) считается отсутствующим — общая конвенция модуля.
//
// Контракт из plan.md:
//   function parseRoles(value: string | string[] | undefined): string[];
//   function peopleHref(roles: string[]): string;   // peopleHref([]) === '/people'
//
// Дополнение v13 (31.08.2026), критерии приёмки 10, 11, 15 и 16: в адресе появляются
// два параметра — `rating` (целое от 1 до 10 либо `none`) и `dossier` (`yes` либо `no`).
// Разбираются они по общей конвенции модуля: всё, что не из списка допустимого, — включая
// ноль, одиннадцать, дробь, «08», буквы, пустую строку и повторный параметр (массив
// значений), — молча означает «фильтр не применён» (spec.md, разделы C и D).
//
// Контракт из plan.md, раздел 2: порядок параметров в адресе — status, sort, genre, form,
// kind, taste, rating, dossier: новые дописываются в хвост, чтобы уже разосланные ссылки
// не переставляли параметры.

import { describe, it, expect } from 'vitest';
import {
  parseStatus,
  parseSort,
  gridHref,
  parseFilters,
  parseRoles,
  peopleHref,
} from '@/lib/url-state';
import type { Filters } from '@/lib/filters';

/** Пустые фильтры — состояние по умолчанию; в адрес не пишутся.
 *
 *  Правка v13 от 31.08.2026: ~~четыре поля — genres, form, kind, taste~~. Спека v13,
 *  разделы C и D, добавила «Оценку» и «Разбор», и пустое состояние теперь шестиполе. */
const NO_FILTERS: Filters = {
  genres: [],
  form: null,
  kind: null,
  taste: false,
  rating: null,
  dossier: null,
};

/** Разбираем href как адрес, чтобы проверять смысл, а не порядок параметров. */
function query(href: string) {
  const url = new URL(href, 'http://localhost');
  return { pathname: url.pathname, params: url.searchParams };
}

describe('parseStatus', () => {
  it('без параметра выбран таб «Все»', () => {
    expect(parseStatus(undefined)).toBe('all');
  });

  it('распознаёт все пять табов, включая «Другие»', () => {
    expect(parseStatus('all')).toBe('all');
    expect(parseStatus('watched')).toBe('watched');
    expect(parseStatus('will-watch')).toBe('will-watch');
    expect(parseStatus('waiting')).toBe('waiting');
    expect(parseStatus('other')).toBe('other');
  });

  it('неизвестное значение трактуется как «Все»', () => {
    expect(parseStatus('несуществующий-статус')).toBe('all');
    expect(parseStatus('')).toBe('all');
    expect(parseStatus('WATCHED')).toBe('all');
  });

  it('повторённый в адресе параметр (массив значений) трактуется как «Все»', () => {
    expect(parseStatus(['watched', 'waiting'])).toBe('all');
    expect(parseStatus([])).toBe('all');
  });
});

describe('parseSort', () => {
  it('без параметра сортировка по дате выхода', () => {
    expect(parseSort(undefined)).toBe('date');
  });

  it('распознаёт оба режима', () => {
    expect(parseSort('date')).toBe('date');
    expect(parseSort('rating')).toBe('rating');
  });

  it('неизвестное значение трактуется как сортировка по дате', () => {
    expect(parseSort('по-оценке')).toBe('date');
    expect(parseSort('')).toBe('date');
    expect(parseSort('Rating')).toBe('date');
  });

  it('повторённый в адресе параметр (массив значений) трактуется как сортировка по дате', () => {
    expect(parseSort(['rating', 'date'])).toBe('date');
    expect(parseSort([])).toBe('date');
  });
});

describe('gridHref', () => {
  it('состояние по умолчанию — чистый адрес без query-параметров', () => {
    expect(gridHref('all', 'date')).toBe('/');
  });

  it('в адрес попадает только отличный от умолчания таб', () => {
    const { pathname, params } = query(gridHref('watched', 'date'));
    expect(pathname).toBe('/');
    expect(params.get('status')).toBe('watched');
    expect(params.has('sort')).toBe(false);
  });

  it('в адрес попадает только отличная от умолчания сортировка', () => {
    const { pathname, params } = query(gridHref('all', 'rating'));
    expect(pathname).toBe('/');
    expect(params.has('status')).toBe(false);
    expect(params.get('sort')).toBe('rating');
  });

  it('оба неумолчальных значения попадают в адрес', () => {
    const { pathname, params } = query(gridHref('waiting', 'rating'));
    expect(pathname).toBe('/');
    expect(params.get('status')).toBe('waiting');
    expect(params.get('sort')).toBe('rating');
  });

  it('адрес читается обратно в то же состояние', () => {
    for (const status of ['all', 'watched', 'will-watch', 'waiting', 'other'] as const) {
      for (const sort of ['date', 'rating'] as const) {
        const { params } = query(gridHref(status, sort));
        expect(parseStatus(params.get('status') ?? undefined)).toBe(status);
        expect(parseSort(params.get('sort') ?? undefined)).toBe(sort);
      }
    }
  });
});

describe('parseFilters: разбор фильтров из адреса (критерий 11)', () => {
  it('без параметров фильтры пустые', () => {
    expect(parseFilters({})).toEqual(NO_FILTERS);
  });

  it('несколько жанров перечислены через запятую', () => {
    expect(parseFilters({ genre: 'horror,thriller' }).genres).toEqual(['horror', 'thriller']);
  });

  it('один жанр тоже разбирается', () => {
    expect(parseFilters({ genre: 'horror' }).genres).toEqual(['horror']);
  });

  it('форма разбирается', () => {
    expect(parseFilters({ form: 'series' }).form).toBe('series');
    expect(parseFilters({ form: 'film' }).form).toBe('film');
  });

  it('вид разбирается', () => {
    expect(parseFilters({ kind: 'animation' }).kind).toBe('animation');
    expect(parseFilters({ kind: 'live-action' }).kind).toBe('live-action');
    expect(parseFilters({ kind: 'documentary' }).kind).toBe('documentary');
  });

  it('вкус разбирается', () => {
    expect(parseFilters({ taste: 'star' }).taste).toBe(true);
  });

  // Правка v13 от 31.08.2026: ~~«все четыре группы разбираются вместе»~~ — групп стало
  // шесть (спека v13, разделы C и D, критерии 10 и 15). Смысл проверки прежний: разбор
  // групп независим, и адрес со всеми параметрами сразу читается целиком.
  it('все шесть групп разбираются вместе', () => {
    expect(
      parseFilters({
        genre: 'horror,thriller',
        form: 'series',
        kind: 'animation',
        taste: 'star',
        rating: '8',
        dossier: 'yes',
      }),
    ).toEqual({
      genres: ['horror', 'thriller'],
      form: 'series',
      kind: 'animation',
      taste: true,
      rating: 8,
      dossier: 'yes',
    });
  });

  it('лишние параметры адреса разбор не трогают', () => {
    expect(parseFilters({ status: 'watched', sort: 'rating', genre: 'horror' })).toEqual({
      ...NO_FILTERS,
      genres: ['horror'],
    });
  });
});

describe('parseFilters: неизвестные значения игнорируются (критерий 11)', () => {
  it('неизвестный жанр отбрасывается, известный остаётся', () => {
    expect(parseFilters({ genre: 'horror,такого-жанра-нет' }).genres).toEqual(['horror']);
  });

  it('жанром считается только тег из категории «жанр»', () => {
    expect(parseFilters({ genre: 'series' }).genres).toEqual([]);
    expect(parseFilters({ genre: 'animation' }).genres).toEqual([]);
  });

  it('пустое значение жанра даёт пустой список', () => {
    expect(parseFilters({ genre: '' }).genres).toEqual([]);
    expect(parseFilters({ genre: ',,' }).genres).toEqual([]);
  });

  it('формой считается только тег формы', () => {
    expect(parseFilters({ form: 'сериал' }).form).toBeNull();
    expect(parseFilters({ form: 'animation' }).form).toBeNull();
    expect(parseFilters({ form: '' }).form).toBeNull();
  });

  it('видом считается только тег вида', () => {
    expect(parseFilters({ kind: 'мультик' }).kind).toBeNull();
    expect(parseFilters({ kind: 'series' }).kind).toBeNull();
  });

  it('вкусом считается только значение «star»', () => {
    expect(parseFilters({ taste: 'вкус' }).taste).toBe(false);
    expect(parseFilters({ taste: 'true' }).taste).toBe(false);
    expect(parseFilters({ taste: '1' }).taste).toBe(false);
    expect(parseFilters({ taste: 'Star' }).taste).toBe(false);
    expect(parseFilters({ taste: '' }).taste).toBe(false);
  });

  it('повторённые в адресе параметры (массив значений) игнорируются', () => {
    expect(
      parseFilters({
        genre: ['horror', 'thriller'],
        form: ['film'],
        kind: ['animation'],
        taste: ['star'],
      }),
    ).toEqual(NO_FILTERS);
  });

  it('адрес целиком из мусора даёт пустые фильтры, а не ошибку', () => {
    expect(
      parseFilters({ genre: 'ужасы', form: 'кино', kind: 'рисовано', taste: 'мой' }),
    ).toEqual(NO_FILTERS);
  });
});

describe('gridHref с фильтрами (критерий 11)', () => {
  it('пустые фильтры в адрес не пишутся', () => {
    expect(gridHref('all', 'date', NO_FILTERS)).toBe('/');
  });

  it('без третьего аргумента адрес прежний', () => {
    expect(gridHref('all', 'date')).toBe('/');
    expect(query(gridHref('watched', 'date')).params.get('status')).toBe('watched');
  });

  it('выбранные жанры пишутся через запятую', () => {
    const { params } = query(
      gridHref('all', 'date', { ...NO_FILTERS, genres: ['horror', 'thriller'] }),
    );

    expect(params.get('genre')).toBe('horror,thriller');
    expect(params.has('form')).toBe(false);
    expect(params.has('kind')).toBe(false);
  });

  it('форма и вид пишутся отдельными параметрами', () => {
    const { params } = query(
      gridHref('all', 'date', { ...NO_FILTERS, form: 'series', kind: 'animation' }),
    );

    expect(params.get('form')).toBe('series');
    expect(params.get('kind')).toBe('animation');
    expect(params.has('genre')).toBe(false);
  });

  it('вкус пишется значением «star», а выключенный вкус в адрес не попадает', () => {
    expect(query(gridHref('all', 'date', { ...NO_FILTERS, taste: true })).params.get('taste')).toBe(
      'star',
    );
    expect(query(gridHref('all', 'date', { ...NO_FILTERS, taste: false })).params.has('taste')).toBe(
      false,
    );
  });

  it('фильтры соседствуют с табом и сортировкой', () => {
    const { pathname, params } = query(
      gridHref('watched', 'rating', { ...NO_FILTERS, genres: ['horror'], form: 'series' }),
    );

    expect(pathname).toBe('/');
    expect(params.get('status')).toBe('watched');
    expect(params.get('sort')).toBe('rating');
    expect(params.get('genre')).toBe('horror');
    expect(params.get('form')).toBe('series');
  });

  // Правка v13 от 31.08.2026: ~~набор из четырёх групп~~. Круговая проверка обязана
  // перечислять все группы, иначе новая уедет в адрес и не вернётся оттуда незамеченной
  // (спека v13, критерии 10, 11, 15 и 16).
  it('адрес с фильтрами читается обратно в то же состояние', () => {
    const filters: Filters = {
      genres: ['horror', 'thriller'],
      form: 'series',
      kind: 'animation',
      taste: true,
      rating: 8,
      dossier: 'yes',
    };
    const { params } = query(gridHref('other', 'rating', filters));

    expect(parseStatus(params.get('status') ?? undefined)).toBe('other');
    expect(parseSort(params.get('sort') ?? undefined)).toBe('rating');
    expect(
      parseFilters({
        genre: params.get('genre') ?? undefined,
        form: params.get('form') ?? undefined,
        kind: params.get('kind') ?? undefined,
        taste: params.get('taste') ?? undefined,
        rating: params.get('rating') ?? undefined,
        dossier: params.get('dossier') ?? undefined,
      }),
    ).toEqual(filters);
  });
});

describe('parseRoles: роли из адреса указателя (критерий 13)', () => {
  it('без параметра ролей не выбрано', () => {
    expect(parseRoles(undefined)).toEqual([]);
  });

  it('одна роль разбирается', () => {
    expect(parseRoles('director')).toEqual(['director']);
  });

  it('несколько ролей перечислены через запятую', () => {
    expect(parseRoles('director,screenwriter')).toEqual(['director', 'screenwriter']);
  });

  it('разбираются все роли словаря', () => {
    const all = [
      'director',
      'screenwriter',
      'producer',
      'cinematographer',
      'composer',
      'sound',
      'editor',
      'designer',
      'animator',
      'actor',
      'author',
    ];

    expect(parseRoles(all.join(','))).toEqual(all);
  });

  it('неизвестный ключ молча отбрасывается, известные остаются', () => {
    expect(parseRoles('director,гримёр')).toEqual(['director']);
    expect(parseRoles('гримёр')).toEqual([]);
    expect(parseRoles('Director')).toEqual([]);
  });

  it('ролью считается только ключ словаря, а не подпись', () => {
    expect(parseRoles('режиссёр')).toEqual([]);
  });

  it('повтор отбрасывается: роль в выборке одна', () => {
    expect(parseRoles('director,director')).toEqual(['director']);
    expect(parseRoles('director,composer,director')).toEqual(['director', 'composer']);
  });

  it('пустое значение даёт пустой список', () => {
    expect(parseRoles('')).toEqual([]);
    expect(parseRoles(',,')).toEqual([]);
  });

  it('повторённый в адресе параметр (массив значений) игнорируется', () => {
    expect(parseRoles(['director', 'composer'])).toEqual([]);
    expect(parseRoles([])).toEqual([]);
  });

  it('адрес целиком из мусора даёт пустой список, а не ошибку', () => {
    expect(parseRoles('всё,что,угодно')).toEqual([]);
  });
});

describe('peopleHref: адрес указателя персоналий (критерий 3)', () => {
  it('без выбранных ролей — чистый адрес раздела', () => {
    expect(peopleHref([])).toBe('/people');
  });

  it('одна роль попадает в адрес', () => {
    const { pathname, params } = query(peopleHref(['director']));

    expect(pathname).toBe('/people');
    expect(params.get('role')).toBe('director');
  });

  it('несколько ролей пишутся через запятую', () => {
    expect(query(peopleHref(['director', 'screenwriter'])).params.get('role')).toBe(
      'director,screenwriter',
    );
  });

  it('адрес читается обратно в тот же набор ролей', () => {
    for (const roles of [[], ['director'], ['composer', 'sound'], ['director', 'actor', 'author']]) {
      const { params } = query(peopleHref(roles));

      expect(parseRoles(params.get('role') ?? undefined), `роли «${roles.join(',')}»`).toEqual(roles);
    }
  });
});

// ─── v13 «Отбор» ────────────────────────────────────────────────────────────────

describe('parseFilters: моя оценка в адресе (критерий 10)', () => {
  it('принимает каждое целое от 1 до 10 и отдаёт его числом', () => {
    for (let value = 1; value <= 10; value += 1) {
      expect(parseFilters({ rating: String(value) }).rating, `rating=${value}`).toBe(value);
    }
  });

  it('принимает «none» — «без оценки»', () => {
    expect(parseFilters({ rating: 'none' }).rating).toBe('none');
  });

  it('ноль и одиннадцать — фильтр не применён', () => {
    expect(parseFilters({ rating: '0' }).rating).toBeNull();
    expect(parseFilters({ rating: '11' }).rating).toBeNull();
    expect(parseFilters({ rating: '-3' }).rating).toBeNull();
    expect(parseFilters({ rating: '100' }).rating).toBeNull();
  });

  it('дробное значение отбрасывается', () => {
    expect(parseFilters({ rating: '8.5' }).rating).toBeNull();
    expect(parseFilters({ rating: '8,5' }).rating).toBeNull();
  });

  it('буквы, пустая строка и пробел отбрасываются', () => {
    expect(parseFilters({ rating: 'abc' }).rating).toBeNull();
    expect(parseFilters({ rating: '' }).rating).toBeNull();
    expect(parseFilters({ rating: ' ' }).rating).toBeNull();
    expect(parseFilters({ rating: 'NONE' }).rating).toBeNull();
    expect(parseFilters({ rating: 'без оценки' }).rating).toBeNull();
  });

  it('повторённый в адресе параметр (массив значений) отбрасывается', () => {
    expect(parseFilters({ rating: ['8', '9'] }).rating).toBeNull();
    expect(parseFilters({ rating: ['8'] }).rating).toBeNull();
    expect(parseFilters({ rating: [] }).rating).toBeNull();
  });

  it('мусор в оценке остальные группы не портит', () => {
    expect(parseFilters({ rating: '11', genre: 'horror' })).toEqual({
      ...NO_FILTERS,
      genres: ['horror'],
    });
  });
});

describe('parseFilters: разбор в адресе (критерий 15)', () => {
  it('принимает «yes» и «no»', () => {
    expect(parseFilters({ dossier: 'yes' }).dossier).toBe('yes');
    expect(parseFilters({ dossier: 'no' }).dossier).toBe('no');
  });

  it('всё прочее — фильтр не применён', () => {
    expect(parseFilters({ dossier: 'all' }).dossier).toBeNull();
    expect(parseFilters({ dossier: 'есть' }).dossier).toBeNull();
    expect(parseFilters({ dossier: 'true' }).dossier).toBeNull();
    expect(parseFilters({ dossier: '1' }).dossier).toBeNull();
    expect(parseFilters({ dossier: 'Yes' }).dossier).toBeNull();
    expect(parseFilters({ dossier: '' }).dossier).toBeNull();
  });

  it('повторённый в адресе параметр (массив значений) отбрасывается', () => {
    expect(parseFilters({ dossier: ['yes', 'no'] }).dossier).toBeNull();
    expect(parseFilters({ dossier: [] }).dossier).toBeNull();
  });
});

describe('gridHref: оценка и разбор в адресе (критерии 11 и 16)', () => {
  it('неприменённые фильтры в адрес не пишутся', () => {
    const { params } = query(gridHref('all', 'date', NO_FILTERS));

    expect(params.has('rating')).toBe(false);
    expect(params.has('dossier')).toBe(false);
  });

  it('порог оценки пишется числом', () => {
    expect(query(gridHref('all', 'date', { ...NO_FILTERS, rating: 8 })).params.get('rating')).toBe(
      '8',
    );
    expect(query(gridHref('all', 'date', { ...NO_FILTERS, rating: 1 })).params.get('rating')).toBe(
      '1',
    );
    expect(query(gridHref('all', 'date', { ...NO_FILTERS, rating: 10 })).params.get('rating')).toBe(
      '10',
    );
  });

  it('«без оценки» пишется словом none', () => {
    expect(
      query(gridHref('all', 'date', { ...NO_FILTERS, rating: 'none' })).params.get('rating'),
    ).toBe('none');
  });

  it('разбор пишется значениями yes и no', () => {
    expect(
      query(gridHref('all', 'date', { ...NO_FILTERS, dossier: 'yes' })).params.get('dossier'),
    ).toBe('yes');
    expect(
      query(gridHref('all', 'date', { ...NO_FILTERS, dossier: 'no' })).params.get('dossier'),
    ).toBe('no');
  });

  it('новые фильтры соседствуют с табом, сортировкой и старыми группами', () => {
    const { pathname, params } = query(
      gridHref('watched', 'rating', {
        genres: ['horror'],
        form: 'series',
        kind: 'animation',
        taste: true,
        rating: 9,
        dossier: 'no',
      }),
    );

    expect(pathname).toBe('/');
    expect(params.get('status')).toBe('watched');
    expect(params.get('sort')).toBe('rating');
    expect(params.get('genre')).toBe('horror');
    expect(params.get('form')).toBe('series');
    expect(params.get('kind')).toBe('animation');
    expect(params.get('taste')).toBe('star');
    expect(params.get('rating')).toBe('9');
    expect(params.get('dossier')).toBe('no');
  });

  // plan.md, раздел 2: новые параметры дописываются в хвост, чтобы уже разосланные
  // ссылки не переставляли параметры местами.
  it('порядок параметров прежний, новые — в хвосте', () => {
    const href = gridHref('watched', 'rating', {
      genres: ['horror'],
      form: 'series',
      kind: 'animation',
      taste: true,
      rating: 9,
      dossier: 'no',
    });
    const keys = [...new URL(href, 'http://localhost').searchParams.keys()];

    expect(keys).toEqual(['status', 'sort', 'genre', 'form', 'kind', 'taste', 'rating', 'dossier']);
  });

  it('каждый порог оценки читается обратно в то же состояние', () => {
    for (const rating of [1, 5, 10, 'none'] as const) {
      const { params } = query(gridHref('all', 'date', { ...NO_FILTERS, rating }));

      expect(parseFilters({ rating: params.get('rating') ?? undefined }).rating).toBe(rating);
    }
  });
});

// ---------------------------------------------------------------------------
// Рефакторинг 15.09.2026, находка 8 (specs/refactor-2026-09-15/audit-code.md).
//
// `single` и `oneOf` решают задачу разбора адреса, ту же, что решают вручную
// написанные `parseStatus` и `parseSort`, каждая своим текстом. Помощники живут
// в `url-state.ts` одним домом, а не расходятся по модулям, которые их используют:
// один факт — один дом.
// portable 22.09.2026: пример модуля-потребителя (`src/lib/admin.ts`) снят из
// формулировки — админки в отчуждаемой копии нет; довод про общий дом помощников
// от этого не меняется.
//
// Контракт:
//   export function single(value: string | string[] | undefined): string | undefined
//   export function oneOf<T extends string>(
//     value: string | string[] | undefined, values: readonly T[], fallback: T): T
//   из '@/lib/url-state'.
//
// Поведение `parseStatus` и `parseSort` при этом не меняется ни на один случай —
// его сторожат тесты выше, написанные до переезда.

import { single, oneOf } from '@/lib/url-state';

describe('single: одно значение параметра адреса', () => {
  it('строка проходит как есть', () => {
    expect(single('watched')).toBe('watched');
    expect(single('')).toBe('');
  });

  // Повторный параметр (`?status=watched&status=waiting`) Next отдаёт массивом.
  // Выбирать за человека, какое из двух значений он имел в виду, нельзя — значит,
  // параметра нет. Конвенция общая для всего модуля.
  it('массив считается отсутствующим значением', () => {
    expect(single(['watched', 'waiting'])).toBeUndefined();
    expect(single(['watched'])).toBeUndefined();
    expect(single([])).toBeUndefined();
  });

  it('отсутствующий параметр остаётся отсутствующим', () => {
    expect(single(undefined)).toBeUndefined();
  });
});

describe('oneOf: значение из перечня либо умолчание', () => {
  const VALUES = ['date', 'rating'] as const;

  it('значение из перечня проходит', () => {
    expect(oneOf('date', VALUES, 'date')).toBe('date');
    expect(oneOf('rating', VALUES, 'date')).toBe('rating');
  });

  it('значение вне перечня даёт умолчание', () => {
    expect(oneOf('весовое', VALUES, 'date')).toBe('date');
    expect(oneOf('', VALUES, 'date')).toBe('date');
    expect(oneOf('Rating', VALUES, 'date')).toBe('date');
  });

  it('отсутствующий и повторный параметр дают умолчание', () => {
    expect(oneOf(undefined, VALUES, 'rating')).toBe('rating');
    expect(oneOf(['date', 'rating'], VALUES, 'rating')).toBe('rating');
  });

  // Умолчание своё у каждого вызова: перечень описывает то, что принимается
  // из адреса, а чем отвечать на непринятое — решает вызывающий.
  it('умолчание берётся из аргумента, а не из первого значения перечня', () => {
    expect(oneOf('мусор', VALUES, 'rating')).toBe('rating');
    expect(oneOf(undefined, VALUES, 'rating')).toBe('rating');
  });

  // Ровно то, что делают `parseStatus` и `parseSort`: перечень значений и умолчание.
  // После переезда они пишутся через `oneOf`, и ответы обязаны совпасть до буквы.
  it('на разборе статуса и сортировки совпадает с parseStatus и parseSort', () => {
    const STATUSES = ['all', 'watched', 'will-watch', 'waiting', 'other'] as const;
    const SORTS = ['date', 'rating'] as const;

    for (const value of [...STATUSES, 'мусор', '', 'Watched', undefined]) {
      expect(oneOf(value, STATUSES, 'all'), `статус ${String(value)}`).toBe(parseStatus(value));
    }
    for (const value of [...SORTS, 'мусор', '', 'Date', undefined]) {
      expect(oneOf(value, SORTS, 'date'), `сортировка ${String(value)}`).toBe(parseSort(value));
    }
    expect(oneOf(['watched', 'waiting'], STATUSES, 'all')).toBe(parseStatus(['watched', 'waiting']));
  });
});
