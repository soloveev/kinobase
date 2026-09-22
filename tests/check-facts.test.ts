// Критерии приёмки версии v9 (specs/v9/spec.md, раздел «`npm run check-facts`»):
// десять кодов ошибок разбора таблицы фактов и счёт, который печатается, когда ошибок нет.
// Тесты написаны отдельным субагентом по спеке, до имплементации: красные сейчас,
// зелёные после.
//
// Контракт модуля '@/lib/check-facts', зафиксированный этими тестами:
//   type FactsErrorCode =
//     | 'bad-status' | 'pseudo-heading' | 'no-sources' | 'weak-confirmed' | 'missing-file'
//     | 'bad-spoiler' | 'spoiler-no-reason' | 'unknown-rubric' | 'quote-no-file'
//     | 'bad-columns';
//   type FactsProblem = { file: string; line: number; code: FactsErrorCode; claim: string };
//   type FactsCount = { rows; confirmed; reported; rumor; reference; unused; withQuote; files };
//   function checkFacts(files: Record<string, string>, archiveFiles: Set<string>):
//     { problems: FactsProblem[]; counts: Record<string, FactsCount> };
//
// Десятая версия добавляет к этому контракту ключ рубрики `написание`, код
// `reference-in-zone` и необязательный третий аргумент — в конце файла, отдельным
// блоком со своим объяснением.
//
// Чтения с диска внутри нет: содержимое таблиц приходит картой «имя файла → текст»,
// список файлов-страниц архива — множеством имён. Приём тот же, что у `checkData`
// с предикатом `exists`: иначе тест перестал бы быть детерминированным (CLAUDE.md,
// «Тесты»: без сети и диска).
//
// Формат таблицы — семь колонок из research/VERIFICATION.md: Утверждение, Статус,
// Оговорка, Источники, Спойлер, Рубрики, Врезка. Фикстуры собираются из корректной
// строки, в которой тест ломает ровно одно поле, — иначе непонятно, на что сработал
// код ошибки.
//
// Спека не говорит, сообщает ли чекер по сломанной строке все нарушения или первое,
// поэтому срабатывание проверяется через `toContain`, а не через равенство списку.
// Там, где строка корректна, проверяется отсутствие ровно этого кода: так тест
// не зависит от прочтения.
//
// Ключи рубрик берутся из `DOSSIER_SECTIONS`, а не переписываются сюда: список,
// переписанный в тест, однажды разойдётся с кодом и разойдётся молча
// (research/VERIFICATION.md, «Рубрики»).

import { describe, it, expect } from 'vitest';
import { checkFacts, type FactsProblem } from '@/lib/check-facts';
import { DOSSIER_SECTIONS } from '@/lib/dossier';

// Шапка и разделитель — ровно те, что стоят в таблицах архива.
const HEAD = '| Утверждение | Статус | Оговорка | Источники | Спойлер | Рубрики | Врезка |';
const RULE = '|---|---|---|---|---|---|---|';

/** Файлы-страницы, лежащие в папке захода. Больше в архиве ничего нет. */
const ARCHIVE = new Set(['ctx-a.md', 'ctx-b.md', 'int-c.md']);

const CLAIM = 'Права на оригинал вела корейская студия с 2018 года';

type Cells = {
  claim?: string;
  status?: string;
  caveat?: string;
  sources?: string;
  spoiler?: string;
  rubrics?: string;
  quote?: string;
};

/** Корректная строка факта; тест переопределяет ровно ту ячейку, которую проверяет. */
const row = (cells: Cells = {}): string => {
  const c = {
    claim: CLAIM,
    status: 'подтверждено',
    caveat: '—',
    sources: '`ctx-a.md`, `ctx-b.md`',
    spoiler: 'нет',
    rubrics: '`why`, `themes`',
    quote: '—',
    ...cells,
  };
  return `| ${c.claim} | ${c.status} | ${c.caveat} | ${c.sources} | ${c.spoiler} | ${c.rubrics} | ${c.quote} |`;
};

const table = (...rows: string[]): string => [HEAD, RULE, ...rows].join('\n');

const run = (text: string, archive: Set<string> = ARCHIVE) =>
  checkFacts({ 'facts.md': text }, archive);

/** Коды проблем одной таблицы — в порядке, в котором их вернул чекер. */
const codes = (text: string, archive: Set<string> = ARCHIVE): string[] =>
  run(text, archive).problems.map((problem: FactsProblem) => problem.code);

/** Коды одной строки факта, поставленной под корректную шапку. */
const rowCodes = (cells: Cells, archive: Set<string> = ARCHIVE): string[] =>
  codes(table(row(cells)), archive);

describe('checkFacts: таблица без изъянов', () => {
  it('корректная строка не даёт ни одной проблемы', () => {
    expect(run(table(row())).problems).toEqual([]);
  });

  it('пустой ввод — ноль проблем: скрипт проверяет то, что есть', () => {
    expect(checkFacts({}, new Set()).problems).toEqual([]);
  });

  it('файл без таблицы — ноль проблем и ноль строк', () => {
    const result = run('# «Фильм» — сводная таблица\n\nТаблица ещё не сведена.\n');
    expect(result.problems).toEqual([]);
    expect(Object.values(result.counts).every((count) => count.rows === 0)).toBe(true);
  });
});

describe('checkFacts: что считается строкой факта', () => {
  it('шапка и разделитель фактами не считаются', () => {
    const result = run(table(row(), row({ status: 'сообщается' })));
    expect(result.problems).toEqual([]);
    expect(result.counts['facts.md'].rows).toBe(2);
  });

  it('шапка каждого раздела считается заново и в счёт строк не идёт', () => {
    const text = [
      '## Происхождение проекта',
      '',
      table(row()),
      '',
      '## Деньги',
      '',
      table(row({ status: 'сообщается' })),
      '',
    ].join('\n');
    expect(run(text).problems).toEqual([]);
    expect(run(text).counts['facts.md'].rows).toBe(2);
  });

  // Спека, «Что считается строкой факта»: раздел, набранный строкой таблицы,
  // — нарушение, а не факт. Тринадцать таких «фактов» на «Бугонии» и есть причина
  // правила (research/VERIFICATION.md).
  it('раздел строкой таблицы — pseudo-heading', () => {
    const heading = '| **Происхождение проекта** |  |  |  |  |  |  |';
    expect(codes(table(heading))).toContain('pseudo-heading');
  });

  it('псевдозаголовок не разбирается как факт: ни статуса, ни источников с него не спрашивают', () => {
    const heading = '| **Происхождение проекта** |  |  |  |  |  |  |';
    const result = codes(table(heading));
    expect(result).not.toContain('bad-status');
    expect(result).not.toContain('no-sources');
  });

  it('псевдозаголовок не попадает в счёт строк', () => {
    const heading = '| **Происхождение проекта** |  |  |  |  |  |  |';
    expect(run(table(heading, row())).counts['facts.md'].rows).toBe(1);
  });

  it('утверждение, начинающееся с полужирного, — обычный факт, а не заголовок', () => {
    // Живой случай из `research/bugonia/facts.md`: «**О бюджете надёжного знания нет.**
    // Deadline в ноябре называет 45 млн…» — остальные ячейки заполнены.
    const claim = '**О бюджете надёжного знания нет.** Deadline называет 45 млн, Collider — 55';
    expect(rowCodes({ claim, status: 'сообщается' })).toEqual([]);
  });
});

describe('checkFacts: bad-status', () => {
  it.each(['подтверждено', 'сообщается', 'слух'])('статус «%s» законен', (status) => {
    expect(rowCodes({ status })).not.toContain('bad-status');
  });

  it('статус не из закрытого списка — bad-status', () => {
    expect(rowCodes({ status: 'факт' })).toContain('bad-status');
  });

  // Спека, критерий 1: составные статусы ловятся этим же правилом.
  it('составной статус — bad-status', () => {
    expect(rowCodes({ status: 'подтверждено (даты) / сообщается' })).toContain('bad-status');
    expect(rowCodes({ status: 'подтверждено у критиков, сообщается у зрителей' })).toContain(
      'bad-status',
    );
  });

  it('пустой статус — bad-status', () => {
    expect(rowCodes({ status: '—' })).toContain('bad-status');
  });
});

describe('checkFacts: no-sources', () => {
  it('имена файлов в бэктиках — источники на месте', () => {
    expect(rowCodes({ sources: '`ctx-a.md`, `ctx-b.md`' })).not.toContain('no-sources');
  });

  it('пустая колонка источников — no-sources', () => {
    // Статус берётся «сообщается», чтобы не задеть заодно weak-confirmed.
    expect(rowCodes({ status: 'сообщается', sources: '—' })).toContain('no-sources');
    expect(rowCodes({ status: 'сообщается', sources: '' })).toContain('no-sources');
  });

  it('названия изданий вместо имён файлов — no-sources', () => {
    expect(rowCodes({ status: 'сообщается', sources: 'Variety, The Hollywood Reporter' })).toContain(
      'no-sources',
    );
  });
});

describe('checkFacts: weak-confirmed', () => {
  it('два независимых источника — подтверждено законно', () => {
    expect(rowCodes({ status: 'подтверждено', sources: '`ctx-a.md`, `ctx-b.md`' })).not.toContain(
      'weak-confirmed',
    );
  });

  it('один первичный источник с оговоркой — подтверждено законно', () => {
    expect(
      rowCodes({ status: 'подтверждено', caveat: 'первичный', sources: '`int-c.md`' }),
    ).not.toContain('weak-confirmed');
  });

  it('один источник без оговорки «первичный» — weak-confirmed', () => {
    expect(rowCodes({ status: 'подтверждено', caveat: '—', sources: '`int-c.md`' })).toContain(
      'weak-confirmed',
    );
  });

  it('один источник с посторонней оговоркой — weak-confirmed', () => {
    expect(
      rowCodes({ status: 'подтверждено', caveat: 'наградная кампания', sources: '`int-c.md`' }),
    ).toContain('weak-confirmed');
  });

  it('одного источника «сообщается» и «слуху» довольно', () => {
    expect(rowCodes({ status: 'сообщается', sources: '`int-c.md`' })).not.toContain(
      'weak-confirmed',
    );
    expect(rowCodes({ status: 'слух', sources: '`int-c.md`', rubrics: 'не использовать' })).not.toContain(
      'weak-confirmed',
    );
  });
});

describe('checkFacts: missing-file', () => {
  it('названный файл лежит в папке захода — молчит', () => {
    expect(rowCodes({ sources: '`ctx-a.md`, `int-c.md`' })).not.toContain('missing-file');
  });

  it('названного файла в папке нет — missing-file', () => {
    expect(rowCodes({ sources: '`ctx-a.md`, `ctx-zzz.md`' })).toContain('missing-file');
  });

  // Спека, критерий 5: путь через `../` разрешается относительно папки захода —
  // файл соседнего архива пропавшим не считается.
  it('путь через «../» пропавшим файлом не считается', () => {
    expect(
      rowCodes({ sources: '`ctx-a.md`, `../ghost-in-the-shell-1995/int-x.md`' }),
    ).not.toContain('missing-file');
  });
});

describe('checkFacts: bad-spoiler и spoiler-no-reason', () => {
  it('«нет» — законное значение', () => {
    expect(rowCodes({ spoiler: 'нет' })).not.toContain('bad-spoiler');
  });

  it('«да» с припиской — законное значение', () => {
    const cells = { spoiler: 'да (называет развязку)', rubrics: '`theses`' };
    expect(rowCodes(cells)).not.toContain('bad-spoiler');
    expect(rowCodes(cells)).not.toContain('spoiler-no-reason');
  });

  it('значение мимо «нет» и «да» — bad-spoiler', () => {
    expect(rowCodes({ spoiler: 'возможно' })).toContain('bad-spoiler');
    expect(rowCodes({ spoiler: '—' })).toContain('bad-spoiler');
  });

  it('«да» без приписки, чем опасно, — spoiler-no-reason', () => {
    expect(rowCodes({ spoiler: 'да', rubrics: '`theses`' })).toContain('spoiler-no-reason');
  });

  it('«да» без приписки — это не bad-spoiler: значение опознано, не хватает причины', () => {
    expect(rowCodes({ spoiler: 'да', rubrics: '`theses`' })).not.toContain('bad-spoiler');
  });
});

describe('checkFacts: unknown-rubric', () => {
  it.each(DOSSIER_SECTIONS.map((section) => section.key))('ключ рубрики «%s» законен', (key) => {
    expect(rowCodes({ rubrics: `\`${key}\`` })).not.toContain('unknown-rubric');
  });

  it.each(['справка', 'не использовать', 'метод'])('служебный ключ «%s» законен', (rubric) => {
    expect(rowCodes({ rubrics: rubric })).not.toContain('unknown-rubric');
  });

  it('ключ работы персоналии законен', () => {
    expect(rowCodes({ rubrics: 'работа: «Лобстер»' })).not.toContain('unknown-rubric');
  });

  // research/VERIFICATION.md, «Рубрики»: ключ при надобности несёт подзаголовок
  // через косую черту — `themes/Контекст`. Ключом остаётся то, что слева от черты.
  it('ключ с подзаголовком через косую черту законен', () => {
    expect(rowCodes({ rubrics: '`themes/Контекст`' })).not.toContain('unknown-rubric');
  });

  it('бэктики вокруг ключа необязательны', () => {
    expect(rowCodes({ rubrics: 'why, themes' })).not.toContain('unknown-rubric');
  });

  it('ключ вне словаря — unknown-rubric', () => {
    expect(rowCodes({ rubrics: '`plot`' })).toContain('unknown-rubric');
  });

  it('неизвестный ключ рядом с известным всё равно ловится', () => {
    expect(rowCodes({ rubrics: '`why`, `trivia`' })).toContain('unknown-rubric');
  });

  it('вольная приписка вместо ключа — unknown-rubric', () => {
    expect(rowCodes({ rubrics: 'где применимо: везде' })).toContain('unknown-rubric');
  });
});

describe('checkFacts: quote-no-file', () => {
  it('прочерк — строка во врезку не метит', () => {
    expect(rowCodes({ quote: '—' })).not.toContain('quote-no-file');
  });

  it('файл архива и фраза на языке оригинала — врезка в порядке', () => {
    expect(
      rowCodes({ quote: '`int-c.md` · «the protagonist has to lose»' }),
    ).not.toContain('quote-no-file');
  });

  it('врезка без имени файла — quote-no-file', () => {
    expect(rowCodes({ quote: '«the protagonist has to lose»' })).toContain('quote-no-file');
  });

  it('врезка называет файл, которого в архиве нет, — quote-no-file', () => {
    expect(rowCodes({ quote: '`int-zzz.md` · «the protagonist has to lose»' })).toContain(
      'quote-no-file',
    );
  });
});

describe('checkFacts: bad-columns', () => {
  it('семь ячеек — норма', () => {
    expect(rowCodes({})).not.toContain('bad-columns');
  });

  it('строка старого формата в пять ячеек — bad-columns', () => {
    const old = `| ${CLAIM} | подтверждено | \`ctx-a.md\`, \`ctx-b.md\` | нет | \`why\` |`;
    expect(codes(table(old))).toContain('bad-columns');
  });

  it('лишняя ячейка — bad-columns', () => {
    const wide = `${row()} лишнее |`;
    expect(codes(table(wide))).toContain('bad-columns');
  });
});

describe('checkFacts: как сообщается о проблеме', () => {
  it('называет файл, в котором лежит сломанная строка', () => {
    const result = checkFacts(
      { 'facts-production.md': table(row()), 'facts-audience.md': table(row({ status: 'факт' })) },
      ARCHIVE,
    );
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0].file).toBe('facts-audience.md');
    expect(result.problems[0].code).toBe('bad-status');
  });

  it('называет номер строки в файле, считая с первой', () => {
    const text = ['# Сводная таблица', '', HEAD, RULE, row(), row({ status: 'факт' })].join('\n');
    const problems = run(text).problems;
    expect(problems).toHaveLength(1);
    expect(problems[0].line).toBe(6);
  });

  it('несёт первые семьдесят знаков утверждения', () => {
    const long =
      'Ремейк придумал не режиссёр и не Голливуд: проект с 2018 года вела корейская студия, владелец прав на оригинал';
    expect(long.length).toBeGreaterThan(70);
    const problems = run(table(row({ claim: long, status: 'факт' }))).problems;
    expect(problems[0].claim).toBe(long.slice(0, 70));
  });

  it('короткое утверждение приходит целиком', () => {
    const short = 'Бюджет неизвестен';
    const problems = run(table(row({ claim: short, status: 'факт' }))).problems;
    expect(problems[0].claim).toBe(short);
  });

  it('сообщает о каждой сломанной строке, а не останавливается на первой', () => {
    const problems = run(
      table(row({ status: 'факт' }), row({ status: 'слух', spoiler: 'возможно' })),
    ).problems;
    expect(problems).toHaveLength(2);
    expect(problems.map((problem: FactsProblem) => problem.code).sort()).toEqual(
      ['bad-spoiler', 'bad-status'].sort(),
    );
  });
});

describe('checkFacts: счёт', () => {
  // Таблица из двух разделов: четыре строки, все статусы, служебные ключи, одна врезка.
  const SPREAD = [
    '# «Фильм» — сводная таблица фактов',
    '',
    '## Происхождение проекта',
    '',
    HEAD,
    RULE,
    row({ status: 'подтверждено', sources: '`ctx-a.md`, `ctx-b.md`', rubrics: '`why`' }),
    row({ status: 'сообщается', sources: '`int-c.md`', rubrics: 'справка' }),
    '',
    '## Критика',
    '',
    HEAD,
    RULE,
    row({ status: 'слух', sources: '`ctx-a.md`', rubrics: 'не использовать' }),
    row({
      status: 'подтверждено',
      caveat: 'первичный',
      sources: '`int-c.md`',
      spoiler: 'да (называет развязку)',
      rubrics: '`keys`',
      quote: '`int-c.md` · «the protagonist has to lose»',
    }),
    '',
  ].join('\n');

  it('таблица из нескольких разделов проходит без проблем', () => {
    expect(run(SPREAD).problems).toEqual([]);
  });

  // Рубрика переехала в блок ключей пятнадцатой версией, а таблицы прежних заходов
  // ссылаются на неё поимённо: новое требование задним числом не предъявляется.
  it('историческая рубрика `theses` в архивной таблице ошибкой не считается', () => {
    const archival = table(
      row({ status: 'подтверждено', sources: '`ctx-a.md`, `ctx-b.md`', rubrics: '`theses`' }),
    );
    expect(run(archival).problems).toEqual([]);
  });

  it('считает строки, статусы, служебные ключи, врезки и файлы архива', () => {
    expect(run(SPREAD).counts['facts.md']).toEqual({
      rows: 4,
      confirmed: 2,
      reported: 1,
      rumor: 1,
      reference: 1,
      unused: 1,
      withQuote: 1,
      files: 3,
    });
  });

  it('счёт ведётся по каждому файлу отдельно', () => {
    const counts = checkFacts(
      { 'facts-production.md': table(row()), 'facts-audience.md': SPREAD },
      ARCHIVE,
    ).counts;
    expect(counts['facts-production.md'].rows).toBe(1);
    expect(counts['facts-audience.md'].rows).toBe(4);
  });

  it('один и тот же файл архива, названный дважды, считается один раз', () => {
    const text = table(
      row({ sources: '`ctx-a.md`, `ctx-b.md`' }),
      row({ status: 'сообщается', sources: '`ctx-a.md`' }),
    );
    expect(run(text).counts['facts.md'].files).toBe(2);
  });
});

// Добавлено при имплементации: контракт семи колонок введён девятой версией
// и задним числом не применяется. Без этого скрипт засыпал бы ошибками девять
// архивов, собранных по прежним правилам, и перестал бы работать как ворота.
// Решение осознанное и записано в specs/v9/spec.md, раздел «Старые таблицы».
describe('checkFacts: таблица старого формата', () => {
  const OLD_HEAD = '| Утверждение | Статус | Источники | Спойлер | Где применимо |';
  const OLD_RULE = '|---|---|---|---|---|';
  const OLD_ROW = '| Права вела корейская студия | подтверждено | `ctx-a.md` | нет | `why` |';
  const OLD = [OLD_HEAD, OLD_RULE, OLD_ROW].join('\n');

  it('пятиколоночная шапка отменяет проверку файла целиком', () => {
    expect(run(OLD).problems).toEqual([]);
  });

  it('такой файл помечен как старый и в счёт строк не идёт', () => {
    const count = run(OLD).counts['facts.md'];
    expect(count.legacy).toBe(true);
    expect(count.rows).toBe(0);
  });

  it('старый формат в одном файле не отменяет проверку соседнего', () => {
    const result = checkFacts(
      { 'facts-old.md': OLD, 'facts-new.md': table(row({ status: 'выдумано' })) },
      ARCHIVE,
    );
    expect(result.problems.map((problem) => problem.code)).toEqual(['bad-status']);
  });
});

// Критерий 4 уточнён после первого прогона по новым правилам: строки русских написаний
// и строки рифм стоят на одном источнике по природе, а не по недосмотру, и требовать
// от них двух значит требовать невозможного. Правка внесена в specs/v9/spec.md
// и в research/VERIFICATION.md, а не подогнана под данные.
describe('checkFacts: weak-confirmed — чем ещё оправдан один источник', () => {
  it.each(['первичный', 'написание', 'рифма', 'промо'])('оговорка «%s» снимает требование двух источников', (caveat) => {
    expect(rowCodes({ sources: '`ctx-a.md`', caveat })).not.toContain('weak-confirmed');
  });

  it('оговорка внутри более длинной фразы тоже засчитывается', () => {
    expect(
      rowCodes({ sources: '`ctx-a.md`', caveat: 'первичный, наградная кампания' }),
    ).not.toContain('weak-confirmed');
  });

  it('посторонняя оговорка при одном источнике по-прежнему weak-confirmed', () => {
    expect(rowCodes({ sources: '`ctx-a.md`', caveat: 'по памяти' })).toContain('weak-confirmed');
  });
});

// —————————————————————————————————————————————————————————————————————————————
// Десятая версия (specs/v10/spec.md, «Что меняется в правилах»). Два дополнения
// к контракту `checkFacts`, написанные до имплементации:
//
//   1. `написание` — законный служебный ключ рубрики наравне со `справка`,
//      `не использовать` и `метод`. Строка русского написания имени или названия
//      заводится именно с ним (research/VERIFICATION.md, «Строки русских написаний
//      — исключение и в сводную переносятся»).
//
//   2. Новый код `reference-in-zone`: рубрика `справка` в зональной таблице
//      (`facts-<зона>.md`) — ошибка; в сводной `facts.md` она законна.
//
// Правило вводится десятой версией и задним числом не применяется, поэтому
// у `checkFacts` появляется третий, необязательный аргумент:
//
//   type FactsOptions = { legacyRules?: boolean };
//   function checkFacts(files, archiveFiles, options?: FactsOptions): { problems; counts };
//
// `legacyRules: true` означает «этот архив собран по правилам до десятой версии»:
// `reference-in-zone` для него молчит, остальные проверки работают как обычно.
// Умолчание — правило действует: новый архив не должен получать поблажку молча.
// Какие папки объявить старыми, решает `scripts/check-facts.ts`, а не этот модуль:
// чтения с диска здесь по-прежнему нет.

const ZONE = 'facts-production.md';

/** Коды одной строки, поставленной в зональную таблицу `facts-<зона>.md`. */
const zoneCodes = (cells: Cells, options?: { legacyRules?: boolean }): string[] =>
  checkFacts({ [ZONE]: table(row(cells)) }, ARCHIVE, options).problems.map(
    (problem: FactsProblem) => problem.code,
  );

/** Коды одной строки, поставленной в сводную таблицу `facts.md`. */
const summaryCodes = (cells: Cells, options?: { legacyRules?: boolean }): string[] =>
  checkFacts({ 'facts.md': table(row(cells)) }, ARCHIVE, options).problems.map(
    (problem: FactsProblem) => problem.code,
  );

describe('checkFacts: «написание» — служебный ключ рубрики', () => {
  it('ключ «написание» в сводной таблице законен', () => {
    expect(
      summaryCodes({ status: 'сообщается', caveat: 'написание', rubrics: 'написание' }),
    ).not.toContain('unknown-rubric');
  });

  it('ключ «написание» законен и в зональной таблице', () => {
    expect(
      zoneCodes({ status: 'сообщается', caveat: 'написание', rubrics: 'написание' }),
    ).not.toContain('unknown-rubric');
  });

  it('строка написания в зональной таблице не даёт ни одной проблемы', () => {
    // Единственный способ завести такую строку в зоне, где `справка` запрещена
    // (research/VERIFICATION.md).
    const cells = {
      claim: 'Chan Joon-hwan — Чан Джун-хван (режиссёр первоисточника)',
      status: 'сообщается',
      caveat: 'написание, прецедента нет',
      sources: '`ctx-a.md`',
      rubrics: 'написание',
    };
    expect(zoneCodes(cells)).toEqual([]);
  });

  it('«написание» рядом с ключом рубрики досье законно', () => {
    expect(
      zoneCodes({ status: 'сообщается', caveat: 'написание', rubrics: 'написание, `place`' }),
    ).not.toContain('unknown-rubric');
  });

  it('ключ вне словаря по-прежнему unknown-rubric: список служебных ключей закрыт', () => {
    expect(zoneCodes({ rubrics: 'написания' })).toContain('unknown-rubric');
    expect(zoneCodes({ rubrics: 'орфография' })).toContain('unknown-rubric');
  });
});

describe('checkFacts: reference-in-zone', () => {
  const reference = { status: 'сообщается', sources: '`ctx-a.md`', rubrics: 'справка' };

  it('«справка» в зональной таблице — reference-in-zone', () => {
    expect(zoneCodes(reference)).toContain('reference-in-zone');
  });

  it('правило действует и в другой зоне: имя файла узнаётся по образцу facts-<зона>.md', () => {
    const codesOf = (file: string) =>
      checkFacts({ [file]: table(row(reference)) }, ARCHIVE).problems.map((problem) => problem.code);
    expect(codesOf('facts-audience.md')).toContain('reference-in-zone');
    expect(codesOf('facts-criticism.md')).toContain('reference-in-zone');
  });

  it('«справка» в сводной таблице законна', () => {
    expect(summaryCodes(reference)).not.toContain('reference-in-zone');
  });

  it('«справка» остаётся известным ключом: unknown-rubric на неё не срабатывает', () => {
    expect(zoneCodes(reference)).not.toContain('unknown-rubric');
  });

  it('прочие служебные ключи в зоне законны', () => {
    expect(zoneCodes({ rubrics: 'не использовать' })).not.toContain('reference-in-zone');
    expect(zoneCodes({ rubrics: 'метод' })).not.toContain('reference-in-zone');
    expect(zoneCodes({ rubrics: 'работа: «Лобстер»' })).not.toContain('reference-in-zone');
  });

  it('ключ рубрики досье в зоне законен', () => {
    expect(zoneCodes({ rubrics: '`why`, `themes`' })).not.toContain('reference-in-zone');
  });

  it('«справка» рядом с ключом рубрики в зоне всё равно ловится', () => {
    expect(zoneCodes({ ...reference, rubrics: '`themes`, справка' })).toContain('reference-in-zone');
  });

  it('строка написания справкой не считается', () => {
    // Ровно то различие, ради которого заведён ключ `написание`.
    expect(
      zoneCodes({ status: 'сообщается', caveat: 'написание', rubrics: 'написание' }),
    ).not.toContain('reference-in-zone');
  });

  it('сообщает файл и строку, как остальные проблемы', () => {
    const problems = checkFacts({ [ZONE]: table(row(reference)) }, ARCHIVE).problems;
    const found = problems.find((problem) => problem.code === 'reference-in-zone');
    expect(found?.file).toBe(ZONE);
    expect(found?.line).toBe(3);
  });
});

describe('checkFacts: архив по правилам до десятой версии', () => {
  const reference = { status: 'сообщается', sources: '`ctx-a.md`', rubrics: 'справка' };

  it('без третьего аргумента правило действует', () => {
    expect(zoneCodes(reference)).toContain('reference-in-zone');
  });

  it('пустой набор настроек правило не отменяет', () => {
    expect(zoneCodes(reference, {})).toContain('reference-in-zone');
  });

  it('объявленный старым архив о «справке» в зоне молчит', () => {
    expect(zoneCodes(reference, { legacyRules: true })).not.toContain('reference-in-zone');
  });

  it('в старом архиве строка написания под ключом «справка» тоже молчит', () => {
    // Так написаны все девять архивов до десятой версии: заголовок «Русские
    // написания имён» и рубрика `справка` в каждой строке.
    const cells = {
      claim: 'Noah Hawley — Ноа Хоули (шоураннер)',
      status: 'подтверждено',
      caveat: 'написание',
      sources: '`ctx-a.md`',
      rubrics: 'справка',
    };
    expect(zoneCodes(cells, { legacyRules: true })).toEqual([]);
  });

  it('поблажка касается только reference-in-zone: остальные проверки работают', () => {
    expect(zoneCodes({ ...reference, status: 'факт' }, { legacyRules: true })).toContain(
      'bad-status',
    );
    expect(zoneCodes({ ...reference, sources: 'Variety' }, { legacyRules: true })).toContain(
      'no-sources',
    );
    expect(zoneCodes({ rubrics: '`plot`' }, { legacyRules: true })).toContain('unknown-rubric');
  });

  it('поблажка не отменяет счёт: строки старого архива считаются', () => {
    const counts = checkFacts({ [ZONE]: table(row(reference)) }, ARCHIVE, {
      legacyRules: true,
    }).counts;
    expect(counts[ZONE].rows).toBe(1);
    expect(counts[ZONE].reference).toBe(1);
  });
});
