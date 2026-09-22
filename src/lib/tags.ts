export type TagCategory = 'form' | 'kind' | 'genre' | 'mood';

export type Tag = {
  slug: string;
  label: string;
  category: TagCategory;
};

export type TagsError = 'unknown' | 'form' | 'kind' | 'too-many';

/** Сколько жанров и настроений суммарно допустимо у одного тайтла. Форма и вид
 *  в счёт не идут: они обязательны и есть у каждой записи. */
export const MAX_DESCRIPTIVE_TAGS = 6;

/** Единый словарь тегов — источник правды. Тег, которого здесь нет, записать нельзя.
 *  Пополняется осознанно: агент, не найдя нужного, сначала ищет близкий существующий. */
export const TAGS: readonly Tag[] = [
  { slug: 'film', label: 'фильм', category: 'form' },
  { slug: 'series', label: 'сериал', category: 'form' },

  { slug: 'live-action', label: 'игровое', category: 'kind' },
  { slug: 'animation', label: 'анимация', category: 'kind' },
  { slug: 'documentary', label: 'документальное', category: 'kind' },

  { slug: 'action', label: 'боевик', category: 'genre' },
  { slug: 'adventure', label: 'приключения', category: 'genre' },
  { slug: 'biography', label: 'биография', category: 'genre' },
  { slug: 'comedy', label: 'комедия', category: 'genre' },
  { slug: 'crime', label: 'криминал', category: 'genre' },
  { slug: 'drama', label: 'драма', category: 'genre' },
  { slug: 'family', label: 'семейный', category: 'genre' },
  { slug: 'fantasy', label: 'фэнтези', category: 'genre' },
  { slug: 'film-noir', label: 'нуар', category: 'genre' },
  { slug: 'history', label: 'исторический', category: 'genre' },
  { slug: 'horror', label: 'ужасы', category: 'genre' },
  { slug: 'music', label: 'музыка', category: 'genre' },
  { slug: 'musical', label: 'мюзикл', category: 'genre' },
  { slug: 'mystery', label: 'детектив', category: 'genre' },
  { slug: 'romance', label: 'мелодрама', category: 'genre' },
  { slug: 'sci-fi', label: 'фантастика', category: 'genre' },
  { slug: 'sport', label: 'спорт', category: 'genre' },
  { slug: 'thriller', label: 'триллер', category: 'genre' },
  { slug: 'war', label: 'военный', category: 'genre' },
  { slug: 'western', label: 'вестерн', category: 'genre' },

  { slug: 'meditative', label: 'медитативное', category: 'mood' },
  { slug: 'folk-horror', label: 'фольк-хоррор', category: 'mood' },
  { slug: 'festival', label: 'фестивальное', category: 'mood' },
  { slug: 'auteur', label: 'авторское', category: 'mood' },
  { slug: 'absurd', label: 'абсурд', category: 'mood' },
  { slug: 'coming-of-age', label: 'взросление', category: 'mood' },
  { slug: 'dystopia', label: 'антиутопия', category: 'mood' },
  { slug: 'cringe', label: 'неловкость', category: 'mood' },
  { slug: 'satire', label: 'сатира', category: 'mood' },
  { slug: 'visionary', label: 'визионерское', category: 'mood' },
  { slug: 'true-story', label: 'основано на реальных событиях', category: 'mood' },
  { slug: 'adaptation', label: 'экранизация', category: 'mood' },
  { slug: 'liminal', label: 'лиминальное', category: 'mood' },
];

export const TAG_BY_SLUG: ReadonlyMap<string, Tag> = new Map(TAGS.map((tag) => [tag.slug, tag]));

const CATEGORY_ORDER: TagCategory[] = ['form', 'kind', 'genre', 'mood'];

export function tagsOfCategory(category: TagCategory): Tag[] {
  return TAGS.filter((tag) => tag.category === category);
}

/** Теги в порядке показа: форма, вид, жанры, настроения. Внутри категории —
 *  в порядке словаря. Неизвестные машинные имена отбрасываются. */
export function sortTags(slugs: string[]): Tag[] {
  const known = slugs
    .map((slug) => TAG_BY_SLUG.get(slug))
    .filter((tag): tag is Tag => tag !== undefined);

  return [...known].sort((a, b) => {
    const byCategory =
      CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    return byCategory !== 0 ? byCategory : TAGS.indexOf(a) - TAGS.indexOf(b);
  });
}

/** Правила спеки: ровно один тег формы, ровно один тег вида, все теги из словаря,
 *  жанров и настроений суммарно не больше шести. */
export function validateTags(slugs: string[]): TagsError | null {
  const tags: Tag[] = [];
  let hasUnknown = false;
  for (const slug of slugs) {
    const tag = TAG_BY_SLUG.get(slug);
    if (tag) tags.push(tag);
    else hasUnknown = true;
  }

  const count = (category: TagCategory) => tags.filter((tag) => tag.category === category).length;

  if (count('form') !== 1) return 'form';
  if (count('kind') !== 1) return 'kind';
  if (hasUnknown) return 'unknown';
  if (count('genre') + count('mood') > MAX_DESCRIPTIVE_TAGS) return 'too-many';
  return null;
}
