// Критерии приёмки 1, 2 и 3 версии v3 на уровне словаря тегов и валидации набора тегов
// у тайтла: ровно один тег формы и ровно один тег вида, суммарно не больше шести жанров
// и настроений, тег вне словаря записать нельзя.
//
// Контракт из plan.md ('@/lib/tags'):
//   type TagCategory = 'form' | 'kind' | 'genre' | 'mood';
//   type Tag = { slug: string; label: string; category: TagCategory };
//   const TAGS: readonly Tag[];
//   const TAG_BY_SLUG: ReadonlyMap<string, Tag>;
//   function tagsOfCategory(category: TagCategory): Tag[];
//   function sortTags(slugs: string[]): Tag[];              // форма, вид, жанры, настроения
//   type TagsError = 'unknown' | 'form' | 'kind' | 'too-many';
//   function validateTags(slugs: string[]): TagsError | null;
//
// Русские названия тегов заданы спекой дословно и проверяются как есть. Машинные имена
// свободны, кроме тех, что названы в плане и в примерах адресов спеки, — они закреплены
// ниже как FIXED_SLUGS: на них завязаны фильтры, адрес страницы и остальные тесты.

import { describe, it, expect } from 'vitest';
import {
  TAGS,
  TAG_BY_SLUG,
  tagsOfCategory,
  sortTags,
  validateTags,
  type Tag,
} from '@/lib/tags';

const FORM_LABELS = ['фильм', 'сериал'];
const KIND_LABELS = ['игровое', 'анимация', 'документальное'];
const GENRE_LABELS = [
  'боевик',
  'приключения',
  'биография',
  'комедия',
  'криминал',
  'драма',
  'семейный',
  'фэнтези',
  'нуар',
  'исторический',
  'ужасы',
  'музыка',
  'мюзикл',
  'детектив',
  'мелодрама',
  'фантастика',
  'спорт',
  'триллер',
  'военный',
  'вестерн',
];
const MOOD_LABELS = [
  'медитативное',
  'фольк-хоррор',
  'фестивальное',
  'авторское',
  'абсурд',
  'взросление',
  'антиутопия',
  'неловкость',
  'сатира',
  'визионерское',
  'основано на реальных событиях',
  'экранизация',
];

/** Машинные имена, на которые опираются план, примеры адресов из спеки и остальные тесты. */
const FIXED_SLUGS: Record<string, string> = {
  фильм: 'film',
  сериал: 'series',
  игровое: 'live-action',
  анимация: 'animation',
  документальное: 'documentary',
  ужасы: 'horror',
  триллер: 'thriller',
  комедия: 'comedy',
  драма: 'drama',
  'фольк-хоррор': 'folk-horror',
};

const labelsOf = (tags: Tag[]): string[] => tags.map((tag) => tag.label);
const slugsOf = (tags: Tag[]): string[] => tags.map((tag) => tag.slug);

/** Машинное имя тега по его русскому названию — чтобы тесты опирались на спеку, а не на
 *  придуманные реализацией имена. */
function slugOf(label: string): string {
  const tag = TAGS.find((candidate) => candidate.label === label);
  expect(tag, `в словаре нет тега «${label}»`).toBeDefined();
  return tag!.slug;
}

const genreSlugs = (): string[] => GENRE_LABELS.map(slugOf);
const moodSlugs = (): string[] => MOOD_LABELS.map(slugOf);

/** Корректный минимум: ровно одна форма и ровно один вид. */
const minimal = (): string[] => [slugOf('фильм'), slugOf('игровое')];

describe('Словарь тегов: категории', () => {
  it('в категории «форма» ровно два тега — фильм и сериал', () => {
    expect(labelsOf(tagsOfCategory('form'))).toEqual(FORM_LABELS);
  });

  it('в категории «вид» ровно три тега — игровое, анимация, документальное', () => {
    expect(labelsOf(tagsOfCategory('kind'))).toEqual(KIND_LABELS);
  });

  it('жанров ровно двадцать — все жанры IMDb в русских названиях', () => {
    const genres = labelsOf(tagsOfCategory('genre'));

    expect(genres).toHaveLength(20);
    expect([...genres].sort()).toEqual([...GENRE_LABELS].sort());
  });

  it('«анимации» и «документального» среди жанров нет — они в категории «вид»', () => {
    const genres = labelsOf(tagsOfCategory('genre'));

    expect(genres).not.toContain('анимация');
    expect(genres).not.toContain('документальное');
  });

  it('стартовый набор настроений из спеки есть в словаре', () => {
    const moods = labelsOf(tagsOfCategory('mood'));

    for (const label of MOOD_LABELS) {
      expect(moods, `в настроениях нет тега «${label}»`).toContain(label);
    }
  });

  it('каждый тег словаря лежит ровно в одной из четырёх категорий', () => {
    const categories = ['form', 'kind', 'genre', 'mood'] as const;
    const byCategory = categories.flatMap((category) => tagsOfCategory(category));

    expect(byCategory).toHaveLength(TAGS.length);
    for (const tag of TAGS) {
      expect(categories, `у тега «${tag.slug}» неизвестная категория`).toContain(tag.category);
    }
  });
});

describe('Словарь тегов: машинные имена', () => {
  it('машинные имена уникальны', () => {
    const slugs = slugsOf([...TAGS]);

    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('ни одно машинное имя не встречается в двух категориях', () => {
    const seen = new Map<string, string>();

    for (const tag of TAGS) {
      const previous = seen.get(tag.slug);
      expect(previous, `тег «${tag.slug}» повторяется в категориях ${previous} и ${tag.category}`)
        .toBeUndefined();
      seen.set(tag.slug, tag.category);
    }
  });

  it('русские названия тоже не повторяются', () => {
    const labels = labelsOf([...TAGS]);

    expect(new Set(labels).size).toBe(labels.length);
  });

  it('все машинные имена — латиница без пробелов, годятся для адреса страницы', () => {
    for (const tag of TAGS) {
      expect(tag.slug, `машинное имя «${tag.slug}» не годится для адреса`).toMatch(
        /^[a-z0-9]+(-[a-z0-9]+)*$/,
      );
      expect(encodeURIComponent(tag.slug)).toBe(tag.slug);
    }
  });

  it('имена, на которые опираются план и адреса из спеки, закреплены', () => {
    for (const [label, slug] of Object.entries(FIXED_SLUGS)) {
      expect(slugOf(label), `тег «${label}» должен называться «${slug}»`).toBe(slug);
    }
  });

  it('TAG_BY_SLUG находит каждый тег словаря по машинному имени', () => {
    for (const tag of TAGS) {
      expect(TAG_BY_SLUG.get(tag.slug)).toEqual(tag);
    }
    expect(TAG_BY_SLUG.size).toBe(TAGS.length);
    expect(TAG_BY_SLUG.get('такого-тега-нет')).toBeUndefined();
  });
});

describe('sortTags: порядок показа', () => {
  it('порядок — форма, вид, жанры, настроения', () => {
    const shuffled = [
      slugOf('фольк-хоррор'),
      slugOf('ужасы'),
      slugOf('анимация'),
      slugOf('сериал'),
    ];

    expect(labelsOf(sortTags(shuffled))).toEqual([
      'сериал',
      'анимация',
      'ужасы',
      'фольк-хоррор',
    ]);
  });

  it('несколько жанров идут после вида и до настроений', () => {
    const slugs = [
      slugOf('медитативное'),
      slugOf('драма'),
      slugOf('игровое'),
      slugOf('комедия'),
      slugOf('фильм'),
    ];
    const categories = sortTags(slugs).map((tag) => tag.category);

    expect(categories).toEqual(['form', 'kind', 'genre', 'genre', 'mood']);
  });

  it('пустой набор даёт пустой список', () => {
    expect(sortTags([])).toEqual([]);
  });

  it('возвращает теги словаря целиком — с русским названием и категорией', () => {
    const [tag] = sortTags([slugOf('сериал')]);

    expect(tag).toEqual({ slug: 'series', label: 'сериал', category: 'form' });
  });
});

describe('validateTags: форма и вид (критерий 1)', () => {
  it('корректный минимум — ровно одна форма и ровно один вид — ошибки не даёт', () => {
    expect(validateTags(minimal())).toBeNull();
  });

  it('без формы — ошибка form', () => {
    expect(validateTags([slugOf('игровое')])).toBe('form');
  });

  it('две формы — ошибка form', () => {
    expect(validateTags([slugOf('фильм'), slugOf('сериал'), slugOf('игровое')])).toBe('form');
  });

  it('без вида — ошибка kind', () => {
    expect(validateTags([slugOf('фильм')])).toBe('kind');
  });

  it('два вида — ошибка kind', () => {
    expect(validateTags([slugOf('фильм'), slugOf('игровое'), slugOf('анимация')])).toBe('kind');
  });

  it('пустой набор тегов — тоже ошибка: формы нет', () => {
    expect(validateTags([])).toBe('form');
  });
});

describe('validateTags: словарь (критерий 3)', () => {
  it('тега вне словаря нет — ошибка unknown', () => {
    expect(validateTags([...minimal(), 'такого-тега-нет'])).toBe('unknown');
  });

  it('русское название вместо машинного имени — тоже неизвестный тег', () => {
    expect(validateTags([...minimal(), 'ужасы'])).toBe('unknown');
  });
});

describe('validateTags: не больше шести жанров и настроений (критерий 2)', () => {
  it('шесть жанров и настроений суммарно — допустимо', () => {
    const extra = [...genreSlugs().slice(0, 4), ...moodSlugs().slice(0, 2)];

    expect(extra).toHaveLength(6);
    expect(validateTags([...minimal(), ...extra])).toBeNull();
  });

  it('шесть жанров без настроений — допустимо', () => {
    expect(validateTags([...minimal(), ...genreSlugs().slice(0, 6)])).toBeNull();
  });

  it('семь жанров и настроений суммарно — ошибка too-many', () => {
    const extra = [...genreSlugs().slice(0, 4), ...moodSlugs().slice(0, 3)];

    expect(extra).toHaveLength(7);
    expect(validateTags([...minimal(), ...extra])).toBe('too-many');
  });

  it('форма и вид в шестёрку не входят', () => {
    const extra = genreSlugs().slice(0, 6);

    expect(validateTags([slugOf('сериал'), slugOf('анимация'), ...extra])).toBeNull();
  });
});
