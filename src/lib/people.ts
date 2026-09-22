import { validateNodes, validateSources, type DossierError, type DossierNode, type DossierSource } from './dossier';

export type PersonRole = { slug: string; label: string };

/** Единый словарь ролей — источник правды. Роль, которой здесь нет, записать нельзя.
 *  Порядок словаря задаёт порядок показа: и тегов на странице персоналии, и групп
 *  в указателе. Подписи не склоняются по роду — это обозначение профессии, а не
 *  человека. */
export const PERSON_ROLES: readonly PersonRole[] = [
  { slug: 'director', label: 'режиссёр' },
  { slug: 'screenwriter', label: 'сценарист' },
  { slug: 'producer', label: 'продюсер' },
  { slug: 'cinematographer', label: 'оператор' },
  { slug: 'composer', label: 'композитор' },
  { slug: 'sound', label: 'звукорежиссёр' },
  { slug: 'editor', label: 'монтажёр' },
  { slug: 'designer', label: 'художник' },
  { slug: 'animator', label: 'аниматор' },
  { slug: 'actor', label: 'актёр' },
  // Автор первоисточника: манги, романа, пьесы. Нужен с первого дня — у обоих
  // «Призраков в доспехах» первоисточник один и тот же.
  { slug: 'author', label: 'автор оригинала' },
];

export const ROLE_BY_SLUG: ReadonlyMap<string, PersonRole> = new Map(
  PERSON_ROLES.map((role) => [role.slug, role]),
);

/** Роли в порядке словаря. Неизвестные машинные имена отбрасываются молча — как
 *  `sortTags`: показ не должен падать из-за данных, которые не прошли валидатор. */
export function sortRoles(slugs: string[]): PersonRole[] {
  const known = slugs
    .map((slug) => ROLE_BY_SLUG.get(slug))
    .filter((role): role is PersonRole => role !== undefined);

  return [...new Set(known)].sort(
    (a, b) => PERSON_ROLES.indexOf(a) - PERSON_ROLES.indexOf(b),
  );
}

/** Тезис метода: короткая формулировка, которая станет заголовком, и тело, которое
 *  её раскрывает. Тело — те же узлы, что в досье: второй модели текста в проекте нет. */
export type MethodThesis = { title: string; body: DossierNode[] };

/** Обычно метод один, и тогда `title` пуст. Два метода заводятся, только когда роли
 *  человека расходятся принципиально и не сводятся к одному целому, — и тогда у каждого
 *  обязан быть заголовок, иначе на странице они неразличимы. */
export type Method = { title: string | null; theses: MethodThesis[] };

/** Проявление метода в отдельном произведении. `titleOriginal` нужен ровно для одного:
 *  если фильм с таким оригинальным названием есть в базе, заголовок работы становится
 *  ссылкой на его карточку. Работы вне базы — норма и большинство. */
export type WorkNote = {
  title: string;
  year: number | null;
  titleOriginal: string | null;
  method: DossierNode[];
  facts: string[];
};

export type PersonLink = { label: string; url: string };
export type NotableWork = { title: string; year: number | null };

/** Указание автора и лицензии у фотографии. Правовое требование, а не оформление:
 *  снимки создателей идут под CC BY или CC BY-SA, и обе лицензии разрешают показ
 *  только вместе с именем автора, ссылкой на текст лицензии и пометкой об изменении.
 *  Требование целиком — в `research/LEGAL.md`.
 *
 *  `author` не переводится и не транслитерируется: общее правило проекта требует
 *  русских написаний в текстах о людях, но здесь не текст о человеке, а юридическое
 *  указание авторства — оно обязано совпадать с описанием файла.
 *
 *  `modified` — признак, а не текст: изменение у нас всегда одно и то же (кадрирование
 *  под нужную пропорцию и уменьшение до 640), и описание его словами каждый раз
 *  плодило бы разные формулировки одного факта. */
export type PhotoCredit = {
  author: string;
  licence: string;
  licenceUrl: string;
  fileUrl: string;
  modified: boolean;
};

export type PersonError =
  | 'slug'
  | 'name'
  | 'roles'
  | 'unknown-role'
  | 'duplicate-role'
  | 'date-format'
  | 'death-before-birth'
  | 'method-empty'
  | 'thesis-title'
  | 'unnamed-methods'
  | 'work-title'
  | 'link'
  | 'photo-credit'
  | 'photo-orphan'
  | 'photo-credit-field'
  | DossierError;

/** То, что валидатор обязан уметь проверить. Шире записи в базе на связи с фильмами:
 *  скрипт наполнения проверяет их отдельно, потому что для этого нужна сама база. */
export type PersonInput = {
  slug: string;
  nameRu: string;
  birthDate?: string | null;
  deathDate?: string | null;
  roles: string[];
  links?: PersonLink[] | null;
  method?: Method[] | null;
  workNotes?: WorkNote[] | null;
  sources?: DossierSource[] | null;
  // Путь к снимку валидатору нужен ради одной проверки — что снимок не стоит
  // без указания автора. В остальном показ фотографии его не касается.
  photoPath?: string | null;
  photoCredit?: PhotoCredit | null;
};

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const PARTIAL_DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/;
const HTTP_URL = /^https?:\/\//;

/** Граница системы: записи приходят из JSON, который пишет агент. `null` — запись
 *  корректна, иначе код ошибки. Конвенция проекта — та же, что у `validateTags`
 *  и `validateDossierBlock`. */
export function validatePerson(person: PersonInput): PersonError | null {
  if (!SLUG.test(person.slug)) return 'slug';
  if (person.nameRu.trim() === '') return 'name';

  if (person.roles.length === 0) return 'roles';
  const seenRoles = new Set<string>();
  for (const slug of person.roles) {
    if (!ROLE_BY_SLUG.has(slug)) return 'unknown-role';
    if (seenRoles.has(slug)) return 'duplicate-role';
    seenRoles.add(slug);
  }

  for (const date of [person.birthDate, person.deathDate]) {
    if (date !== null && date !== undefined && !PARTIAL_DATE.test(date)) return 'date-format';
  }
  // Сравнение лексикографическое: для дат такого вида оно совпадает с хронологическим
  // при равной точности и не хуже при разной — '1951' < '1951-08-08'.
  if (person.birthDate && person.deathDate && person.deathDate < person.birthDate) {
    return 'death-before-birth';
  }

  for (const link of person.links ?? []) {
    if (link.label.trim() === '') return 'link';
    if (!HTTP_URL.test(link.url)) return 'link';
  }

  // Снимок и указание автора существуют только вместе, и проверка идёт в обе стороны.
  // Главное здесь — первая ветка: поставить фотографию без имени автора нельзя.
  // Договорённость, которую можно обойти правкой шаблона, тут не годится — портрет
  // Мамору Осии простоял без указания три версии именно потому, что запрет был
  // словесным. Вторая ветка ловит недоделанный перенос файла: кредит без снимка
  // ничего не описывает.
  const credit = person.photoCredit ?? null;
  const hasPhoto = (person.photoPath ?? '') !== '';
  if (hasPhoto && credit === null) return 'photo-credit';
  if (!hasPhoto && credit !== null) return 'photo-orphan';
  if (credit !== null) {
    if (credit.author.trim() === '') return 'photo-credit-field';
    if (credit.licence.trim() === '') return 'photo-credit-field';
    if (!HTTP_URL.test(credit.licenceUrl)) return 'photo-credit-field';
    if (!HTTP_URL.test(credit.fileUrl)) return 'photo-credit-field';
  }

  const methods = person.method ?? [];
  for (const method of methods) {
    if (method.theses.length === 0) return 'method-empty';
    // Два безымянных метода на странице неразличимы; один безымянный — норма,
    // его заголовок и не показывается.
    if (methods.length > 1 && (method.title ?? '').trim() === '') return 'unnamed-methods';

    for (const thesis of method.theses) {
      if (thesis.title.trim() === '') return 'thesis-title';
      const error = validateNodes(thesis.body);
      if (error) return error;
    }
  }

  for (const work of person.workNotes ?? []) {
    if (work.title.trim() === '') return 'work-title';
    const error = validateNodes(work.method);
    if (error) return error;
    // Факты — те же пункты списка, что `ul` в досье, и правила разметки у них те же.
    // Их может не быть вовсе: разбор работы обязателен, а список фактов — довесок,
    // и пустой список означает «нечего добавить», а не порчу данных.
    if (work.facts.length > 0) {
      const factsError = validateNodes([{ type: 'ul', items: work.facts }]);
      if (factsError) return factsError;
    }
  }

  if (person.sources && person.sources.length > 0) {
    const error = validateSources(person.sources);
    if (error) return 'link';
  }

  return null;
}

export type NamePart = { text: string; slug: string | null };

/** Разбирает поле создателей на куски и помечает те, у которых есть персоналия.
 *  Совпадение точное, а не похожее: «Кэндзи Каваи» и «Кэндзи Кавай» — вопрос,
 *  на который машина ответит неправильно молча, и лучше не дать ссылку, чем дать
 *  не ту. Разделители остаются кусками без slug, поэтому склейка всех кусков
 *  дословно равна исходному полю. */
export function linkNames(field: string, byName: ReadonlyMap<string, string>): NamePart[] {
  const parts: NamePart[] = [];

  for (const chunk of field.split(/(,)/)) {
    if (chunk === '') continue;
    const name = chunk.trim();
    const slug = name === '' ? undefined : byName.get(name);
    if (slug === undefined) {
      parts.push({ text: chunk, slug: null });
      continue;
    }

    // Пробелы вокруг имени — часть поля, а не часть ссылки: подчёркнутый пробел
    // перед именем выглядит опечаткой.
    const start = chunk.indexOf(name);
    if (start > 0) parts.push({ text: chunk.slice(0, start), slug: null });
    parts.push({ text: name, slug });
    const rest = chunk.slice(start + name.length);
    if (rest !== '') parts.push({ text: rest, slug: null });
  }

  return parts;
}
