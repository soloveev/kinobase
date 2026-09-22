// Критерии приёмки 7 и 8 версии v3 на уровне чистой фильтрации: несколько выбранных жанров
// работают по правилу «любой из выбранных», а фильтры разных групп сужают выборку совместно.
// Здесь же счётчики жанров для панели фильтров (критерии 6 и 9 в части данных).
//
// Дополнение v5, критерий приёмки 14: фильтр «По моему вкусу» оставляет только тайтлы
// со звёздочкой и сужает выборку совместно с фильтрами по жанру, форме и виду.
//
// Контракт из plan.md ('@/lib/filters'), с поправкой v5:
//   type Filters = { genres: string[]; form: string | null; kind: string | null; taste: boolean };
//   const EMPTY_FILTERS: Filters;
//   function applyFilters(films: Film[], filters: Filters): Film[];
//   function isEmpty(filters: Filters): boolean;
//   function genreCounts(films: Film[]): Map<string, number>;
//
// Фильтрация — чистая функция над полем tags тайтла, без базы и без сети. Порядок тайтлов
// на выходе не меняется: сортировкой занимается отдельный слой.
//
// Дополнение v13 (31.08.2026), критерии приёмки 8, 9, 14, 20, 22, 24 и 25: у фильтров
// появляются две группы — «Оценка» («N и выше» либо «без оценки») и «Разбор» (есть · нет), —
// а вместе с ними счёт применённого для кнопки и перечень плашек для строки применённого.
//
// Контракт из plan.md, раздел 1 ('@/lib/filters'):
//   type RatingFilter = number | 'none' | null;   // число — «N и выше»
//   type DossierFilter = 'yes' | 'no' | null;
//   type Filters = { genres; form; kind; taste; rating: RatingFilter; dossier: DossierFilter };
//   function countFilters(filters: Filters): number;
//   function appliedChips(filters: Filters): { kind: string; label: string; without: Filters }[];
// Разбор считается по «Зачем смотреть» (`dossierBefore`): пустой массив запрещён валидатором,
// поэтому третьего состояния нет и проверки на null достаточно (spec.md, раздел D).

import { describe, it, expect } from 'vitest';
import {
  applyFilters,
  isEmpty,
  genreCounts,
  countFilters,
  appliedChips,
  EMPTY_FILTERS,
  type Filters,
} from '@/lib/filters';
import { makeFilm, type DossierFragment, type FilmWithTags } from './helpers';

const horrorSeries = makeFilm({
  id: 1,
  titleRu: 'Проклятие',
  tags: ['series', 'live-action', 'horror', 'folk-horror'],
  tasteStar: true,
});

const horrorFilm = makeFilm({
  id: 2,
  titleRu: 'Ужас в поле',
  tags: ['film', 'live-action', 'horror', 'drama'],
});

const thrillerFilm = makeFilm({
  id: 3,
  titleRu: 'Погоня',
  tags: ['film', 'live-action', 'thriller'],
  tasteStar: true,
});

const comedySeries = makeFilm({
  id: 4,
  titleRu: 'Мебельная компания',
  tags: ['series', 'live-action', 'comedy'],
});

const animationFilm = makeFilm({
  id: 5,
  titleRu: 'Рисованное',
  tags: ['film', 'animation', 'comedy', 'drama'],
  tasteStar: true,
});

const films: FilmWithTags[] = [
  horrorSeries,
  horrorFilm,
  thrillerFilm,
  comedySeries,
  animationFilm,
];

const titles = (result: { titleRu: string }[]): string[] => result.map((film) => film.titleRu);

/** Фильтры «как из адреса»: перечисляем только то, что проверяем. */
const filters = (overrides: Partial<Filters> = {}): Filters => ({
  ...EMPTY_FILTERS,
  ...overrides,
});

describe('EMPTY_FILTERS и isEmpty', () => {
  // Правка v13 от 31.08.2026. Прежняя редакция: ~~«пустые фильтры — ни жанров, ни формы,
  // ни вида, ни вкуса», EMPTY_FILTERS равен объекту из четырёх ключей~~. Отменена спекой v13,
  // разделы C и D (критерии 8–16): у фильтров появились «Оценка» и «Разбор», и пустое
  // состояние описывается шестью полями. Проверка не ослаблена, а дополнена: перечисление
  // всех полей и есть её смысл — новое поле не должно завестись молча.
  it('пустые фильтры — ни жанров, ни формы, ни вида, ни вкуса, ни оценки, ни разбора', () => {
    expect(EMPTY_FILTERS).toEqual({
      genres: [],
      form: null,
      kind: null,
      taste: false,
      rating: null,
      dossier: null,
    });
  });

  it('isEmpty различает пустые и непустые фильтры', () => {
    expect(isEmpty(EMPTY_FILTERS)).toBe(true);
    expect(isEmpty(filters({ genres: ['horror'] }))).toBe(false);
    expect(isEmpty(filters({ form: 'series' }))).toBe(false);
    expect(isEmpty(filters({ kind: 'animation' }))).toBe(false);
    expect(isEmpty(filters({ taste: true }))).toBe(false);
    expect(isEmpty(filters({ genres: ['horror'], form: 'film', kind: 'live-action' }))).toBe(false);
  });

  // Критерии 8, 9 и 14: новые группы — такие же фильтры, как остальные пять.
  it('оценка и разбор тоже делают фильтры непустыми (критерии 8, 9 и 14)', () => {
    expect(isEmpty(filters({ rating: 8 }))).toBe(false);
    expect(isEmpty(filters({ rating: 'none' }))).toBe(false);
    expect(isEmpty(filters({ dossier: 'yes' }))).toBe(false);
    expect(isEmpty(filters({ dossier: 'no' }))).toBe(false);
  });
});

describe('applyFilters: пустые фильтры', () => {
  it('возвращает исходный список в исходном порядке', () => {
    expect(titles(applyFilters(films, EMPTY_FILTERS))).toEqual(titles(films));
  });

  it('исходный список не меняет', () => {
    const before = titles(films);
    applyFilters(films, filters({ genres: ['horror'] }));

    expect(titles(films)).toEqual(before);
  });

  it('на пустом списке даёт пустой список', () => {
    expect(applyFilters([], filters({ genres: ['horror'] }))).toEqual([]);
  });
});

describe('applyFilters: жанры (критерий 7)', () => {
  it('один жанр отбирает тайтлы с этим жанром', () => {
    expect(titles(applyFilters(films, filters({ genres: ['horror'] })))).toEqual([
      'Проклятие',
      'Ужас в поле',
    ]);
  });

  it('два жанра работают по правилу «любой из выбранных»', () => {
    const result = titles(applyFilters(films, filters({ genres: ['horror', 'thriller'] })));

    expect(result).toEqual(['Проклятие', 'Ужас в поле', 'Погоня']);
  });

  it('тайтл с обоими выбранными жанрами показан один раз', () => {
    const result = applyFilters(films, filters({ genres: ['horror', 'drama'] }));

    expect(titles(result)).toEqual(['Проклятие', 'Ужас в поле', 'Рисованное']);
  });

  it('жанр, которого нет ни у одного тайтла, даёт пустую выборку', () => {
    expect(applyFilters(films, filters({ genres: ['western'] }))).toEqual([]);
  });

  it('тайтл без тегов не проходит фильтр по жанру', () => {
    const untagged = makeFilm({ id: 6, titleRu: 'Без тегов' });

    expect(applyFilters([untagged], filters({ genres: ['horror'] }))).toEqual([]);
  });
});

describe('applyFilters: форма и вид (критерий 8)', () => {
  it('форма отбирает только сериалы', () => {
    expect(titles(applyFilters(films, filters({ form: 'series' })))).toEqual([
      'Проклятие',
      'Мебельная компания',
    ]);
  });

  it('вид отбирает только анимацию', () => {
    expect(titles(applyFilters(films, filters({ kind: 'animation' })))).toEqual(['Рисованное']);
  });

  it('«сериалы» + «комедия» показывает только комедийные сериалы', () => {
    const result = applyFilters(films, filters({ form: 'series', genres: ['comedy'] }));

    expect(titles(result)).toEqual(['Мебельная компания']);
  });

  it('вид сужает выборку вместе с жанром', () => {
    const result = applyFilters(films, filters({ kind: 'animation', genres: ['comedy'] }));

    expect(titles(result)).toEqual(['Рисованное']);
  });

  it('форма, вид и два жанра работают вместе', () => {
    const result = applyFilters(
      films,
      filters({ form: 'film', kind: 'live-action', genres: ['horror', 'thriller'] }),
    );

    expect(titles(result)).toEqual(['Ужас в поле', 'Погоня']);
  });

  it('несовместимые фильтры дают пустую выборку', () => {
    const result = applyFilters(films, filters({ form: 'series', kind: 'animation' }));

    expect(result).toEqual([]);
  });
});

describe('genreCounts', () => {
  it('считает количество тайтлов по каждому жанру переданной выборки', () => {
    const counts = genreCounts(films);

    expect(counts.get('horror')).toBe(2);
    expect(counts.get('drama')).toBe(2);
    expect(counts.get('comedy')).toBe(2);
    expect(counts.get('thriller')).toBe(1);
  });

  it('жанр без тайтлов в выборке даёт ноль или отсутствует', () => {
    expect(genreCounts(films).get('western') ?? 0).toBe(0);
  });

  it('форму, вид и настроения за жанры не считает', () => {
    const counts = genreCounts(films);

    expect(counts.get('series') ?? 0).toBe(0);
    expect(counts.get('live-action') ?? 0).toBe(0);
    expect(counts.get('folk-horror') ?? 0).toBe(0);
  });

  it('считает по той выборке, которую дали, а не по всей базе', () => {
    const counts = genreCounts(applyFilters(films, filters({ form: 'series' })));

    expect(counts.get('horror')).toBe(1);
    expect(counts.get('comedy')).toBe(1);
    expect(counts.get('thriller') ?? 0).toBe(0);
  });

  it('на пустой выборке счётчиков нет', () => {
    expect(genreCounts([]).get('horror') ?? 0).toBe(0);
  });
});

// Критерий приёмки 14: звёздочка вкуса становится фильтром.
describe('applyFilters: вкус (критерий 14)', () => {
  it('по умолчанию вкус выборку не сужает', () => {
    expect(titles(applyFilters(films, filters({ taste: false })))).toEqual(titles(films));
  });

  it('«по моему вкусу» оставляет только тайтлы со звёздочкой', () => {
    expect(titles(applyFilters(films, filters({ taste: true })))).toEqual([
      'Проклятие',
      'Погоня',
      'Рисованное',
    ]);
  });

  it('вкус сужает выборку вместе с жанром', () => {
    const result = applyFilters(films, filters({ taste: true, genres: ['horror'] }));

    expect(titles(result)).toEqual(['Проклятие']);
  });

  it('вкус работает вместе с формой, видом и жанрами', () => {
    const result = applyFilters(
      films,
      filters({ taste: true, form: 'film', kind: 'animation', genres: ['comedy'] }),
    );

    expect(titles(result)).toEqual(['Рисованное']);
  });

  it('несовместимые вкус и жанр дают пустую выборку', () => {
    expect(applyFilters(films, filters({ taste: true, genres: ['thriller'], form: 'series' }))).toEqual(
      [],
    );
  });

  it('если звёздочек в выборке нет, результат пустой', () => {
    const plain = makeFilm({ id: 7, titleRu: 'Без звёздочки', tags: ['film'] });

    expect(applyFilters([plain], filters({ taste: true }))).toEqual([]);
  });

  it('порядок тайтлов не меняется', () => {
    const result = applyFilters(films, filters({ taste: true }));

    expect(result.map((film) => film.id)).toEqual([1, 3, 5]);
  });
});

// ─── v13 «Отбор» ────────────────────────────────────────────────────────────────
// Две новые группы фильтров, счёт применённого и перечень плашек.

/** Блок «Зачем смотреть» — ровно то, по чему считается фильтр «Разбор» (spec.md, раздел D). */
const BEFORE: DossierFragment[] = [
  { key: 'why', body: [{ type: 'p', text: 'Зачем это смотреть.' }] },
];

const ratedTen = makeFilm({ id: 11, titleRu: 'Десятка', tags: ['film'], myRating: 10, watched: true });
const ratedEight = makeFilm({ id: 12, titleRu: 'Восьмёрка', tags: ['film'], myRating: 8, watched: true });
const ratedSeven = makeFilm({ id: 13, titleRu: 'Семёрка', tags: ['series'], myRating: 7, watched: true });
const ratedOne = makeFilm({ id: 14, titleRu: 'Единица', tags: ['film'], myRating: 1, watched: true });
const unrated = makeFilm({ id: 15, titleRu: 'Без оценки', tags: ['film'] });

const rated: FilmWithTags[] = [ratedTen, ratedEight, ratedSeven, ratedOne, unrated];

describe('applyFilters: моя оценка (критерии 8 и 9)', () => {
  it('«8 и выше» оставляет тайтлы с оценкой не меньше восьми', () => {
    expect(titles(applyFilters(rated, filters({ rating: 8 })))).toEqual(['Десятка', 'Восьмёрка']);
  });

  it('порог включает сам себя: восьмёрка при пороге 8 остаётся', () => {
    expect(titles(applyFilters([ratedEight], filters({ rating: 8 })))).toEqual(['Восьмёрка']);
  });

  it('тайтл без оценки под порог не подходит ни при каком пороге', () => {
    expect(applyFilters([unrated], filters({ rating: 1 }))).toEqual([]);
    expect(applyFilters([unrated], filters({ rating: 10 }))).toEqual([]);
  });

  it('порог 1 оставляет все оценённые тайтлы и только их', () => {
    expect(titles(applyFilters(rated, filters({ rating: 1 })))).toEqual([
      'Десятка',
      'Восьмёрка',
      'Семёрка',
      'Единица',
    ]);
  });

  it('порог 10 оставляет только десятки', () => {
    expect(titles(applyFilters(rated, filters({ rating: 10 })))).toEqual(['Десятка']);
  });

  it('«без оценки» оставляет тайтлы, которым оценка не поставлена вовсе (критерий 9)', () => {
    expect(titles(applyFilters(rated, filters({ rating: 'none' })))).toEqual(['Без оценки']);
  });

  it('оценка сужает выборку вместе с другими группами', () => {
    const result = applyFilters(rated, filters({ rating: 7, form: 'series' }));

    expect(titles(result)).toEqual(['Семёрка']);
  });

  it('порядок тайтлов не меняется', () => {
    expect(applyFilters(rated, filters({ rating: 1 })).map((film) => film.id)).toEqual([
      11, 12, 13, 14,
    ]);
  });
});

describe('applyFilters: разбор (критерий 14)', () => {
  const withDossier = makeFilm({ id: 21, titleRu: 'С разбором', tags: ['film'], dossierBefore: BEFORE });
  const withoutDossier = makeFilm({ id: 22, titleRu: 'Без разбора', tags: ['film'] });
  // «После просмотра» без «Зачем смотреть» — состояние возможное, и фильтр про него
  // ничего не знает: он спрашивает ровно про блок «Зачем смотреть» (spec.md, раздел D).
  const onlyAfter = makeFilm({
    id: 23,
    titleRu: 'Только после',
    tags: ['film'],
    dossierAfter: BEFORE,
  });
  const set: FilmWithTags[] = [withDossier, withoutDossier, onlyAfter];

  it('«есть» оставляет тайтлы с непустым блоком «Зачем смотреть»', () => {
    expect(titles(applyFilters(set, filters({ dossier: 'yes' })))).toEqual(['С разбором']);
  });

  it('«нет» оставляет тайтлы, у которых этот блок пуст', () => {
    expect(titles(applyFilters(set, filters({ dossier: 'no' })))).toEqual([
      'Без разбора',
      'Только после',
    ]);
  });

  it('две половины в сумме дают всю выборку', () => {
    const yes = applyFilters(set, filters({ dossier: 'yes' })).length;
    const no = applyFilters(set, filters({ dossier: 'no' })).length;

    expect(yes + no).toBe(set.length);
  });

  it('разбор сужает выборку вместе с другими группами', () => {
    const result = applyFilters(set, filters({ dossier: 'yes', genres: ['horror'] }));

    expect(result).toEqual([]);
  });

  it('оценка и разбор работают вместе', () => {
    const both = makeFilm({
      id: 24,
      titleRu: 'И то и то',
      tags: ['film'],
      myRating: 9,
      watched: true,
      dossierBefore: BEFORE,
    });
    const result = applyFilters([...set, both], filters({ dossier: 'yes', rating: 9 }));

    expect(titles(result)).toEqual(['И то и то']);
  });
});

// Критерии 24 и 25: число на кнопке «Фильтры». Одна функция на кнопку и на строку
// применённого, чтобы счёт не разошёлся между ними (plan.md, раздел 1).
describe('countFilters: счёт применённого (критерии 24 и 25)', () => {
  it('при пустом отборе счёт нулевой (критерий 23)', () => {
    expect(countFilters(EMPTY_FILTERS)).toBe(0);
  });

  it('каждый выбранный жанр — единица', () => {
    expect(countFilters(filters({ genres: ['horror'] }))).toBe(1);
    expect(countFilters(filters({ genres: ['horror', 'thriller'] }))).toBe(2);
    expect(countFilters(filters({ genres: ['horror', 'thriller', 'comedy'] }))).toBe(3);
  });

  it('каждый одиночный фильтр — единица', () => {
    expect(countFilters(filters({ form: 'series' }))).toBe(1);
    expect(countFilters(filters({ kind: 'animation' }))).toBe(1);
    expect(countFilters(filters({ taste: true }))).toBe(1);
    expect(countFilters(filters({ rating: 8 }))).toBe(1);
    expect(countFilters(filters({ rating: 'none' }))).toBe(1);
    expect(countFilters(filters({ dossier: 'yes' }))).toBe(1);
    expect(countFilters(filters({ dossier: 'no' }))).toBe(1);
  });

  it('счёт — сумма жанров и применённых одиночных фильтров', () => {
    const all = filters({
      genres: ['horror', 'thriller'],
      form: 'series',
      kind: 'animation',
      taste: true,
      rating: 8,
      dossier: 'yes',
    });

    expect(countFilters(all)).toBe(7);
  });

  it('невыбранные группы в счёт не идут', () => {
    expect(countFilters(filters({ form: null, kind: null, taste: false }))).toBe(0);
  });

  // Критерий 25: сортировка — не отбор, и в счёт попасть не может. Держится не проверкой,
  // а типом: сортировки в Filters нет, countFilters её и не видит.
  it('сортировка счёта не касается: её нет среди аргументов (критерий 25)', () => {
    expect(countFilters(EMPTY_FILTERS)).toBe(0);
    expect(countFilters).toHaveLength(1);
  });

  it('счёт совпадает с числом плашек строки применённого', () => {
    const all = filters({
      genres: ['horror', 'comedy'],
      form: 'film',
      taste: true,
      rating: 'none',
      dossier: 'no',
    });

    expect(appliedChips(all)).toHaveLength(countFilters(all));
  });
});

// Критерии 20 и 22: перечень плашек строки применённого. Подписи собираются здесь,
// а не в вёрстке: их читают и строка применённого, и пустое состояние страницы.
describe('appliedChips: перечень выбранного (критерии 20 и 22)', () => {
  it('при пустом отборе плашек нет', () => {
    expect(appliedChips(EMPTY_FILTERS)).toEqual([]);
  });

  it('порядок плашек: жанры, форма, вид, вкус, оценка, разбор (критерий 22)', () => {
    const chips = appliedChips(
      filters({
        genres: ['horror', 'comedy'],
        form: 'series',
        kind: 'animation',
        taste: true,
        rating: 8,
        dossier: 'yes',
      }),
    );

    expect(chips.map((chip) => chip.kind)).toEqual([
      'genre',
      'genre',
      'form',
      'kind',
      'taste',
      'rating',
      'dossier',
    ]);
  });

  it('жанры идут в том порядке, в каком стоят в адресе', () => {
    const chips = appliedChips(filters({ genres: ['thriller', 'horror'] }));

    expect(chips.map((chip) => chip.label)).toEqual(['триллер', 'ужасы']);
  });

  it('форма подписана «фильмы» и «сериалы»', () => {
    expect(appliedChips(filters({ form: 'film' }))[0].label).toBe('фильмы');
    expect(appliedChips(filters({ form: 'series' }))[0].label).toBe('сериалы');
  });

  it('вид подписан именем тега', () => {
    expect(appliedChips(filters({ kind: 'animation' }))[0].label).toBe('анимация');
    expect(appliedChips(filters({ kind: 'documentary' }))[0].label).toBe('документальное');
  });

  it('вкус подписан «по вкусу»', () => {
    expect(appliedChips(filters({ taste: true }))[0].label).toBe('по вкусу');
  });

  it('оценка подписана «оценка N+» или «без оценки»', () => {
    expect(appliedChips(filters({ rating: 8 }))[0].label).toBe('оценка 8+');
    expect(appliedChips(filters({ rating: 10 }))[0].label).toBe('оценка 10+');
    expect(appliedChips(filters({ rating: 'none' }))[0].label).toBe('без оценки');
  });

  it('разбор подписан «с разбором» или «без разбора»', () => {
    expect(appliedChips(filters({ dossier: 'yes' }))[0].label).toBe('с разбором');
    expect(appliedChips(filters({ dossier: 'no' }))[0].label).toBe('без разбора');
  });

  // Критерий 20: снятие плашки убирает только её фильтр и сохраняет остальные.
  it('снятие жанра убирает только его, остальные жанры остаются', () => {
    const chips = appliedChips(filters({ genres: ['horror', 'comedy', 'drama'] }));
    const comedy = chips.find((chip) => chip.label === 'комедия')!;

    expect(comedy.without.genres).toEqual(['horror', 'drama']);
  });

  it('снятие одиночного фильтра возвращает его в пустое значение', () => {
    const all = filters({
      genres: ['horror'],
      form: 'series',
      kind: 'animation',
      taste: true,
      rating: 8,
      dossier: 'yes',
    });
    const chips = appliedChips(all);
    const without = (kind: string) => chips.find((chip) => chip.kind === kind)!.without;

    expect(without('form').form).toBeNull();
    expect(without('kind').kind).toBeNull();
    expect(without('taste').taste).toBe(false);
    expect(without('rating').rating).toBeNull();
    expect(without('dossier').dossier).toBeNull();
  });

  it('снятие одного фильтра остальные не трогает', () => {
    const all = filters({
      genres: ['horror'],
      form: 'series',
      kind: 'animation',
      taste: true,
      rating: 8,
      dossier: 'yes',
    });
    const rating = appliedChips(all).find((chip) => chip.kind === 'rating')!;

    expect(rating.without).toEqual({ ...all, rating: null });
  });

  it('снятие плашки уменьшает счёт ровно на единицу', () => {
    const all = filters({ genres: ['horror', 'comedy'], form: 'film', rating: 'none' });

    for (const chip of appliedChips(all)) {
      expect(countFilters(chip.without), `плашка «${chip.label}»`).toBe(countFilters(all) - 1);
    }
  });

  it('исходные фильтры не меняются', () => {
    const all = filters({ genres: ['horror', 'comedy'], form: 'film' });
    const before = JSON.stringify(all);

    appliedChips(all);

    expect(JSON.stringify(all)).toBe(before);
  });

  it('снятие единственной плашки даёт пустые фильтры', () => {
    expect(appliedChips(filters({ rating: 'none' }))[0].without).toEqual(EMPTY_FILTERS);
  });
});
