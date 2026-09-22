// Критерии приёмки 1 и 2 версии v2.1 на уровне форматирования дат:
// 1 — плашке «ждём» нужна дата без года: «18 сентября»;
// 2 — полная дата с годом остаётся на странице фильма и не меняется.
//
// Контракт: formatDayMonthRu(iso) — новый экспорт из '@/lib/format', рядом с formatDateRu.
// Обе функции чистые, разбирают ISO-строку и не зависят от часового пояса и текущей даты.
//
// Дополнение v5, критерий приёмки 5: плашка сериала, у которого известен только месяц
// выхода сезона, читается как «Ждём сезон 3 в марте». Месяц там стоит в предложном
// падеже — третьей форме, которой у модуля до сих пор не было (родительная нужна
// полной дате, именительная — заголовку месяца в таймлайне).
//
// Контракт: formatInMonthRu(iso) — «2027-03» → «в марте».

// Дополнение v7, критерий приёмки 4: дата рождения хранится строкой переменной точности —
// у современного аниматора часто известен только год, и записать вместо этого первое января
// значило бы соврать. Печатать её было нечем: formatDateRu ждёт полную дату,
// formatMonthYearRu — месяц с годом, yearOf отрезает всё до года.
//
// Контракт из plan.md: formatPartialDateRu(iso) печатает ровно ту точность, которая задана —
// «1992», «март 1992», «16 марта 1992». Существующие функции форматирования не меняются.

import { describe, it, expect } from 'vitest';
import {
  formatDayMonthRu,
  formatDateRu,
  formatInMonthRu,
  formatMonthYearRu,
  formatPartialDateRu,
} from '@/lib/format';

describe('formatDayMonthRu: день и месяц без года', () => {
  it('«2026-09-18» — это «18 сентября»', () => {
    expect(formatDayMonthRu('2026-09-18')).toBe('18 сентября');
  });

  it('однозначное число идёт без ведущего нуля', () => {
    expect(formatDayMonthRu('2026-03-05')).toBe('5 марта');
    expect(formatDayMonthRu('2027-01-01')).toBe('1 января');
  });

  it('месяц стоит в родительном падеже для всех двенадцати месяцев', () => {
    expect(formatDayMonthRu('2026-01-11')).toBe('11 января');
    expect(formatDayMonthRu('2026-02-11')).toBe('11 февраля');
    expect(formatDayMonthRu('2026-03-11')).toBe('11 марта');
    expect(formatDayMonthRu('2026-04-11')).toBe('11 апреля');
    expect(formatDayMonthRu('2026-05-11')).toBe('11 мая');
    expect(formatDayMonthRu('2026-06-11')).toBe('11 июня');
    expect(formatDayMonthRu('2026-07-11')).toBe('11 июля');
    expect(formatDayMonthRu('2026-08-11')).toBe('11 августа');
    expect(formatDayMonthRu('2026-09-11')).toBe('11 сентября');
    expect(formatDayMonthRu('2026-10-11')).toBe('11 октября');
    expect(formatDayMonthRu('2026-11-11')).toBe('11 ноября');
    expect(formatDayMonthRu('2026-12-11')).toBe('11 декабря');
  });

  it('года в результате нет ни в каком виде', () => {
    expect(formatDayMonthRu('2026-12-31')).not.toMatch(/\d{4}/);
    expect(formatDayMonthRu('2026-12-31')).not.toMatch(/2026/);
  });

  it('високосное 29 февраля форматируется как обычная дата', () => {
    expect(formatDayMonthRu('2028-02-29')).toBe('29 февраля');
  });
});

describe('formatDateRu: полная дата с годом (критерий 2)', () => {
  it('по-прежнему отдаёт день, месяц и год', () => {
    expect(formatDateRu('2026-09-18')).toBe('18 сентября 2026');
    expect(formatDateRu('2026-03-05')).toBe('5 марта 2026');
  });

  it('начинается с того же дня и месяца, что и краткая форма', () => {
    expect(formatDateRu('2026-09-18').startsWith(formatDayMonthRu('2026-09-18'))).toBe(true);
  });
});

// Ради этого блока тест и написан: предложный падеж — единственное место модуля,
// где наивная склейка ломается. Восемь месяцев из двенадцати оканчиваются в
// именительном на мягкий знак, и «в январь» вместо «в январе» правится в один символ,
// а замечается только глазами на живой странице.
describe('formatInMonthRu: месяц в предложном падеже', () => {
  it('«2027-03» — это «в марте»', () => {
    expect(formatInMonthRu('2027-03')).toBe('в марте');
  });

  it('все двенадцать месяцев стоят в предложном падеже', () => {
    expect(formatInMonthRu('2027-01')).toBe('в январе');
    expect(formatInMonthRu('2027-02')).toBe('в феврале');
    expect(formatInMonthRu('2027-03')).toBe('в марте');
    expect(formatInMonthRu('2027-04')).toBe('в апреле');
    expect(formatInMonthRu('2027-05')).toBe('в мае');
    expect(formatInMonthRu('2027-06')).toBe('в июне');
    expect(formatInMonthRu('2027-07')).toBe('в июле');
    expect(formatInMonthRu('2027-08')).toBe('в августе');
    expect(formatInMonthRu('2027-09')).toBe('в сентябре');
    expect(formatInMonthRu('2027-10')).toBe('в октябре');
    expect(formatInMonthRu('2027-11')).toBe('в ноябре');
    expect(formatInMonthRu('2027-12')).toBe('в декабре');
  });

  it('месяцы с мягким знаком в именительном получают окончание «-е», а не «-ь»', () => {
    for (const iso of ['2027-01', '2027-02', '2027-06', '2027-07', '2027-09', '2027-10', '2027-11', '2027-12']) {
      const result = formatInMonthRu(iso);

      expect(result, `«${result}» не должно оканчиваться мягким знаком`).not.toMatch(/ь$/);
      expect(result).toMatch(/е$/);
    }
  });

  it('года в результате нет ни в каком виде', () => {
    expect(formatInMonthRu('2027-03')).not.toMatch(/\d/);
    expect(formatInMonthRu('2027-03')).not.toMatch(/2027/);
  });

  it('результат начинается с предлога «в »', () => {
    for (let month = 1; month <= 12; month += 1) {
      const iso = `2027-${String(month).padStart(2, '0')}`;

      expect(formatInMonthRu(iso).startsWith('в ')).toBe(true);
    }
  });

  it('полная дата на входе тоже принимается и даёт тот же месяц', () => {
    expect(formatInMonthRu('2027-03-12')).toBe('в марте');
    expect(formatInMonthRu('2027-03-01')).toBe(formatInMonthRu('2027-03'));
    expect(formatInMonthRu('2027-12-31')).toBe('в декабре');
  });

  it('день на результат не влияет: форму выбирает вызывающий код в FilmCell', () => {
    expect(formatInMonthRu('2027-09-01')).toBe(formatInMonthRu('2027-09-30'));
  });

  it('год на результат не влияет', () => {
    expect(formatInMonthRu('2026-08')).toBe(formatInMonthRu('2099-08'));
  });
});

describe('formatPartialDateRu: дата известной точности (критерий 4)', () => {
  it('известен только год — печатается год', () => {
    expect(formatPartialDateRu('1992')).toBe('1992');
    expect(formatPartialDateRu('1951')).toBe('1951');
  });

  it('известны год и месяц — печатается месяц с годом', () => {
    expect(formatPartialDateRu('1992-03')).toBe('март 1992');
  });

  it('известна полная дата — печатается день, месяц и год', () => {
    expect(formatPartialDateRu('1992-03-16')).toBe('16 марта 1992');
  });

  it('на точности до месяца совпадает с formatMonthYearRu', () => {
    for (let month = 1; month <= 12; month += 1) {
      const iso = `1992-${String(month).padStart(2, '0')}`;

      expect(formatPartialDateRu(iso), `месяц ${iso}`).toBe(formatMonthYearRu(iso));
    }
  });

  it('на полной дате совпадает с formatDateRu', () => {
    for (const iso of ['1951-08-08', '1992-03-16', '2001-01-20', '2028-02-29']) {
      expect(formatPartialDateRu(iso), `дата ${iso}`).toBe(formatDateRu(iso));
    }
  });

  it('год без месяца не приобретает ни месяца, ни дня', () => {
    const result = formatPartialDateRu('1992');

    expect(result).toBe('1992');
    expect(result).not.toMatch(/январ/);
    expect(result).not.toMatch(/[а-яё]/i);
  });

  it('месяц без дня не приобретает дня', () => {
    expect(formatPartialDateRu('1992-03')).not.toMatch(/\d{1,2}\s/);
    expect(formatPartialDateRu('1992-01')).toBe('январь 1992');
  });

  it('однозначное число идёт без ведущего нуля', () => {
    expect(formatPartialDateRu('1992-03-05')).toBe('5 марта 1992');
  });

  it('во всех трёх точностях год напечатан', () => {
    for (const iso of ['1992', '1992-03', '1992-03-16']) {
      expect(formatPartialDateRu(iso), `дата ${iso}`).toContain('1992');
    }
  });
});

// ── Дополнение v11, критерий приёмки 21 ──────────────────────────────────────
// Номер критерия — версии v11, а не версий v2.1, v5 и v7, которыми пронумерована
// шапка файла.
//
// Секция «Основные работы» на странице персоналии свёрнута по умолчанию и обязана
// в свёрнутом виде сказать, сколько внутри работ: свёрнутая секция не прячет
// содержимое вслепую. Значит, число надо просклонять, и склонение живёт рядом
// с pluralSources и pluralFilms — тем же русским правилом, а не своим.
//
// Контракт из plan.md: pluralWorks(count: number): string — «1 работа», «2 работы»,
// «5 работ». Отдельно проверяются одиннадцать — четырнадцать: на них ломается
// наивное правило «оканчивается на единицу — единственное число», и восемь работ
// у Мамору Осии показывают, что этот диапазон для страницы персоналии не
// теоретический.

import { pluralFilms, pluralWorks } from '@/lib/format';

describe('pluralWorks: склонение числа работ (критерий 21 версии v11)', () => {
  it('единственное число: «работа»', () => {
    expect(pluralWorks(1)).toBe('1 работа');
    expect(pluralWorks(21)).toBe('21 работа');
    expect(pluralWorks(101)).toBe('101 работа');
    expect(pluralWorks(121)).toBe('121 работа');
  });

  it('от двух до четырёх: «работы»', () => {
    expect(pluralWorks(2)).toBe('2 работы');
    expect(pluralWorks(3)).toBe('3 работы');
    expect(pluralWorks(4)).toBe('4 работы');
    expect(pluralWorks(22)).toBe('22 работы');
    expect(pluralWorks(103)).toBe('103 работы');
  });

  it('от пяти до двадцати: «работ»', () => {
    expect(pluralWorks(5)).toBe('5 работ');
    expect(pluralWorks(8)).toBe('8 работ');
    expect(pluralWorks(9)).toBe('9 работ');
    expect(pluralWorks(10)).toBe('10 работ');
    expect(pluralWorks(20)).toBe('20 работ');
    expect(pluralWorks(25)).toBe('25 работ');
  });

  // Ради этого блока тест и написан: наивное правило по последней цифре даёт здесь
  // «11 работа», «12 работы», «13 работы», «14 работы» — все четыре неверны.
  it('одиннадцать — четырнадцать: «работ», несмотря на последнюю цифру', () => {
    expect(pluralWorks(11)).toBe('11 работ');
    expect(pluralWorks(12)).toBe('12 работ');
    expect(pluralWorks(13)).toBe('13 работ');
    expect(pluralWorks(14)).toBe('14 работ');
    expect(pluralWorks(111)).toBe('111 работ');
    expect(pluralWorks(112)).toBe('112 работ');
    expect(pluralWorks(113)).toBe('113 работ');
    expect(pluralWorks(114)).toBe('114 работ');
  });

  it('ноль работ — «работ»', () => {
    expect(pluralWorks(0)).toBe('0 работ');
    expect(pluralWorks(100)).toBe('100 работ');
  });

  it('число стоит первым и печатается как есть', () => {
    for (const count of [0, 1, 5, 13, 21, 112]) {
      expect(pluralWorks(count), `число ${count}`).toMatch(new RegExp(`^${count} `));
    }
  });

  it('никаких форм, кроме трёх ожидаемых', () => {
    for (let count = 0; count <= 200; count += 1) {
      expect(pluralWorks(count), `число ${count}`).toMatch(/^\d+ работ(а|ы)?$/);
    }
  });

  // Правило одно на весь модуль: если склонение работ разойдётся со склонением
  // фильмов, значит, одно из двух написано мимо русского языка.
  it('на всех числах до двухсот подчиняется тому же правилу, что pluralFilms', () => {
    const form = (text: string) => text.replace(/^\d+ /, '');
    const same: Record<string, string> = {
      фильм: 'работа',
      фильма: 'работы',
      фильмов: 'работ',
    };

    for (let count = 0; count <= 200; count += 1) {
      expect(form(pluralWorks(count)), `число ${count}`).toBe(same[form(pluralFilms(count))]);
    }
  });
});

// ---------------------------------------------------------------------------
// Рефакторинг 15.09.2026, находка 2 (specs/refactor-2026-09-15/audit-code.md).
//
// Русское согласование числительного стояло в модуле тремя дословными копиями
// (`pluralSources`, `pluralWorks`, `pluralFilms`) плюс четвёртой, урезанной, в
// `src/components/plaques.tsx` — для выбора «вышел / вышло». Правило при этом
// арифметически одно, и отличаются копии только тремя словоформами.
//
// Контракт:
//   export function plural(count: number, forms: [string, string, string]): string
//   из '@/lib/format'; возвращает `${count} ${форма}`.
//
// Формы перечисляются в порядке «один — два — пять»: `['источник', 'источника',
// 'источников']`. Третья форма достаётся не только пятёрке, но и одиннадцати—
// четырнадцати (11 источников, а не «11 источник»), а двадцать один снова берёт
// первую — это и есть всё правило.
//
// Три прежние функции остаются и становятся однострочными обёртками: их зовут
// по всему проекту, и переписывать вызовы ради переезда правила незачем. Строки,
// которые они дают, не меняются ни на одном числе — это здесь и закрепляется.

import { plural, pluralSources } from '@/lib/format';

describe('plural: одно правило согласования на весь модуль', () => {
  const SOURCES: [string, string, string] = ['источник', 'источника', 'источников'];

  it('единица берёт первую форму', () => {
    expect(plural(1, SOURCES)).toBe('1 источник');
  });

  it('два, три и четыре берут вторую', () => {
    expect(plural(2, SOURCES)).toBe('2 источника');
    expect(plural(4, SOURCES)).toBe('4 источника');
  });

  it('пять берёт третью', () => {
    expect(plural(5, SOURCES)).toBe('5 источников');
  });

  // Десятки от одиннадцати до четырнадцати — исключение русского языка: по последней
  // цифре они просились бы в первую и вторую форму, а берут третью.
  it('одиннадцать, двенадцать и четырнадцать берут третью, а не первую и вторую', () => {
    expect(plural(11, SOURCES)).toBe('11 источников');
    expect(plural(12, SOURCES)).toBe('12 источников');
    expect(plural(14, SOURCES)).toBe('14 источников');
  });

  it('двадцать один снова берёт первую, двадцать два — вторую, двадцать пять — третью', () => {
    expect(plural(21, SOURCES)).toBe('21 источник');
    expect(plural(22, SOURCES)).toBe('22 источника');
    expect(plural(25, SOURCES)).toBe('25 источников');
  });

  it('сотня берёт третью, сто один — первую, сто одиннадцать — снова третью', () => {
    expect(plural(100, SOURCES)).toBe('100 источников');
    expect(plural(101, SOURCES)).toBe('101 источник');
    expect(plural(111, SOURCES)).toBe('111 источников');
  });

  it('ноль берёт третью форму', () => {
    expect(plural(0, SOURCES)).toBe('0 источников');
  });

  it('число стоит первым и печатается как есть', () => {
    for (const count of [0, 1, 5, 13, 21, 112]) {
      expect(plural(count, SOURCES), `число ${count}`).toMatch(new RegExp(`^${count} `));
    }
  });

  // Формы подставляются те, что дали, и никак не изменяются: словоформы — дело
  // вызывающего, арифметика — дело функции.
  it('подставляются ровно те формы, что переданы', () => {
    const released: [string, string, string] = ['вышел', 'вышло', 'вышло'];

    expect(plural(1, released)).toBe('1 вышел');
    expect(plural(2, released)).toBe('2 вышло');
    expect(plural(5, released)).toBe('5 вышло');
  });
});

// Прежние три функции — то же правило с уже подставленными словами. Строки, которые
// они возвращают, после переезда обязаны совпасть до буквы: их читает интерфейс,
// а не только тест.
describe('прежние обёртки дают ровно то же, что plural', () => {
  it('pluralSources — «источник / источника / источников»', () => {
    expect(pluralSources(1)).toBe('1 источник');
    expect(pluralSources(2)).toBe('2 источника');
    expect(pluralSources(5)).toBe('5 источников');
    expect(pluralSources(11)).toBe('11 источников');
    expect(pluralSources(21)).toBe('21 источник');
  });

  it('на всех числах до двухсот три обёртки совпадают с plural', () => {
    const cases: [(count: number) => string, [string, string, string]][] = [
      [pluralSources, ['источник', 'источника', 'источников']],
      [pluralWorks, ['работа', 'работы', 'работ']],
      [pluralFilms, ['фильм', 'фильма', 'фильмов']],
    ];

    for (const [fn, forms] of cases) {
      for (let count = 0; count <= 200; count += 1) {
        expect(fn(count), `${forms[0]}, число ${count}`).toBe(plural(count, forms));
      }
    }
  });
});
