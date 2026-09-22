const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

export function formatDateRu(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return `${day} ${MONTHS_GENITIVE[month - 1]} ${year}`;
}

/** «2026-09-18» → «18 сентября». Без года: рядом он и так есть — в заголовке
 *  месяца таймлайна и в строке фактов ячейки. */
export function formatDayMonthRu(iso: string): string {
  const [, month, day] = iso.split('-').map(Number);
  return `${day} ${MONTHS_GENITIVE[month - 1]}`;
}

export function formatDateShort(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}.${month}.${year}`;
}

export function formatRating(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

export function yearOf(iso: string | null): string | null {
  return iso ? iso.slice(0, 4) : null;
}

const MONTHS_NOMINATIVE = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
];

export function formatMonthYearRu(iso: string): string {
  const [year, month] = iso.split('-').map(Number);
  return `${MONTHS_NOMINATIVE[month - 1]} ${year}`;
}

/** Дата той точности, которой она задана: «1992», «март 1992», «16 марта 1992».
 *  Нужна датам жизни: источник о создателе часто называет только год, и печатать
 *  вместо этого первое января значило бы соврать. */
export function formatPartialDateRu(iso: string): string {
  const parts = iso.split('-');
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return formatMonthYearRu(iso);
  return formatDateRu(iso);
}

const MONTHS_PREPOSITIONAL = [
  'январе',
  'феврале',
  'марте',
  'апреле',
  'мае',
  'июне',
  'июле',
  'августе',
  'сентябре',
  'октябре',
  'ноябре',
  'декабре',
];

/** «2027-03» → «в марте». Для плашки сериала, у которого известен только месяц
 *  выхода сезона: год рядом не нужен, а падеж требуется предложный. */
export function formatInMonthRu(iso: string): string {
  const month = Number(iso.split('-')[1]);
  return `в ${MONTHS_PREPOSITIONAL[month - 1]}`;
}

/** Число со словом в нужной форме. Формы перечисляются в порядке «один — два — пять»:
 *  `['источник', 'источника', 'источников']`. Третья достаётся не только пятёрке, но
 *  и одиннадцати—четырнадцати, а двадцать один снова берёт первую — это всё правило.
 *
 *  Словоформы — дело вызывающего, арифметика — дело функции. До 15.09.2026 правило
 *  стояло четырьмя копиями: тремя здесь и четвёртой, урезанной, в `plaques.tsx`. */
export function plural(count: number, forms: [string, string, string]): string {
  return `${count} ${pluralForm(count, forms)}`;
}

/** То же согласование, но без числа: нужно там, где слово стоит перед числом,
 *  а не после него, — «вышло 2» в имени сезонного ряда. Арифметика одна и та же,
 *  и живёт она здесь. */
export function pluralForm(count: number, forms: [string, string, string]): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

export function pluralSources(count: number): string {
  return plural(count, ['источник', 'источника', 'источников']);
}

/** Подсказка свёрнутых «Основных работ»: свёрнутая секция не прячет содержимое
 *  вслепую — видно, сколько внутри. */
export function pluralWorks(count: number): string {
  return plural(count, ['работа', 'работы', 'работ']);
}

export function pluralFilms(count: number): string {
  return plural(count, ['фильм', 'фильма', 'фильмов']);
}
