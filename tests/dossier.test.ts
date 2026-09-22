// Критерии приёмки 3, 5, 6, 7, 8, 9, 10, 11 и 12 версии v4 на уровне чистой логики досье:
// 6, 7 — словарь задаёт состав блоков и порядок рубрик, а разметка внутри строки —
//        ровно полужирный и ссылка;
// 8 — рубрику вне словаря, рубрику чужого блока и абзац с испорченной разметкой
//     записать нельзя;
// 9, 10 — дата последнего поиска и признак устаревания материалов;
// 3, 5 — какой блок раскрыт при каком статусе и какие блоки вообще существуют;
// 11, 12 — источник без издания, заголовка или внешнего адреса не проходит, а фильм
//     без досье отличается от фильма с досье.
//
// Контракт модуля '@/lib/dossier', зафиксированный этими тестами:
//   type DossierBlock = 'before' | 'keys' | 'after';
//   type DossierNode = { type: 'p'; text } | { type: 'h'; text } | { type: 'ul'; items }
//                    | { type: 'quote'; text; author };
//   type DossierFragment = { key: string; body: DossierNode[] };
//   type DossierSpan = { kind: 'text' | 'bold' | 'link'; … };
//   const DOSSIER_SECTIONS: readonly { key; label; block }[];
//   const SECTION_BY_KEY: ReadonlyMap<string, DossierSection>;
//   function sectionsOfBlock(block): DossierSection[];
//   function sortFragments(block, fragments): DossierFragment[];
//   function sortedSections(block, fragments): { section, body }[];
//   function parseInline(text): DossierSpan[];
//   function validateDossierBlock(block, fragments): DossierError | null;
//   function validateSources(sources): DossierSourcesError | null;
//   function dossierFreshness(film, today): 'none' | 'fresh' | 'stale';
//   function defaultOpenBlocks(status): DossierBlock[];
//   function hasDossier(film): boolean;
//
// Дополнение v7 (spec.md, раздел «Валидация»): проверка узлов выделяется из
// `validateDossierBlock` в отдельную экспортируемую функцию — её переиспользует валидатор
// персоналии, где то же тело есть у тезиса метода и у разбора работы. Второй копии правил
// разметки в проекте быть не должно: она разъедется с первой на третьем фильме.
//
//   function validateNodes(nodes: DossierNode[]): DossierError | null;
//
// Коды те же, что возвращал блочный валидатор: 'no-body' на пустом теле, 'blank-text',
// 'blank-item', 'no-author', 'markup', 'link'. Снаружи `validateDossierBlock` не меняется,
// поэтому тесты выше остаются как есть — они же и доказывают, что правка ничего не сдвинула.
//
// Дополнение v9 (specs/v9/spec.md, раздел «Валидатор досье»): к `validateNodes`
// добавляется правило `quote-after-heading` — узел `quote` не может идти
// непосредственно после узла `h`. Врезка вплотную к подзаголовку читается как эпиграф
// к рубрике, а не как голос внутри рассуждения (research/DOSSIER-FORMAT.md). Правило
// общее для досье и страницы персоналии: тело у них одно, поэтому и живёт оно
// в `validateNodes`, а не в блочном валидаторе.
//
// Обе функции валидации устроены как `validateTags` в v3: `null` — набор корректен,
// иначе код ошибки. Коды перечислены спекой и планом поимённо, поэтому проверяется
// не только факт отказа, но и его причина: перепутанные коды означают, что скрипт
// наполнения сообщит агенту не о том.
//
// Дополнение v15 (specs/v15/spec.md, разделы A и C, критерии приёмки 1—4): рубрика
// «Фильм в пяти тезисах» (`theses`) вынимается из блока «После просмотра» в
// самостоятельный третий блок `keys` — «Важные вещи о фильме», и меняет задачу
// с резюме разбора на ключи к фильму. Отсюда правки существующих тестов:
//
//   — `DossierBlock` перестал быть парой: значение `keys` стоит между `before`
//     и `after` и в типе, и в словаре, и в порядке показа;
//   — рубрики `theses` в словаре больше нет, поэтому тесты порядка блока «После
//     просмотра» переписаны на восемь рубрик вместо девяти;
//   — правило «раскрыт ровно один блок» отменено: у просмотренного раскрыты
//     `keys` и `after`, у всех прочих — `before`;
//   — `hasDossier` спрашивает и про третий блок.
//
// Блок ключей устроен жёстче прочих: в нём ровно одна рубрика, а её тело — ровно
// один узел `ul`. Отсюда коды отказа:
//
//   'keys-shape' — тело устроено не одним списком (вводка, проза, два списка);
//   'keys-count' — пунктов не ровно семь;
//   'keys-length' — блок длиннее потолка.
//
// ~~«пунктов меньше пяти или больше семи»~~ — вилка валидатора отменена 15.09.2026
// (рефакторинг, находка 6). Она была шире правила письма нарочно: девятнадцать досье
// прежней формы жили в базе рядом с новыми, и прогон покраснел бы на них. Повод исчез —
// все 38 записей с блоком ключей несут ровно семь пунктов, — а поблажка осталась
// охранять несуществующий случай. Это тот самый признак из CLAUDE.md: правило письма
// («ровно семь вещей, до 6000 знаков», research/DOSSIER-FORMAT.md, редакция 15.09.2026)
// записано, а на пути в базу его ничто не сторожит: сторожил только
// `scripts/keys-check.py`, который агент запускает по своему файлу порции.
// Числа сведены: KEYS_MIN = KEYS_MAX = 7, потолок объёма — 6059 знаков.
//
// Объём считается так, как его видит читатель: сумма знаков всех пунктов списка
// с пробелами, без разметки полужирного (`**`). Вводка и врезка в счёт не идут —
// счёт ведётся по пунктам, как в `keys-check.py`. Это не регрессия: критерий изменён
// осознанно, решением владельца, прежняя формулировка оставлена зачёркнутой.
//
// «Интересность» пункта валидатором не проверяется намеренно (спека, «Что не
// входит»): код проверяет число пунктов и устройство тела, потому что это
// единственное, что он способен проверить не соврав.

import { describe, it, expect } from 'vitest';
import {
  DOSSIER_BLOCK_LABELS,
  DOSSIER_SECTIONS,
  SECTION_BY_KEY,
  sectionsOfBlock,
  sortFragments,
  sortedSections,
  parseInline,
  validateDossierBlock,
  validateNodes,
  validateSources,
  dossierFreshness,
  defaultOpenBlocks,
  hasDossier,
} from '@/lib/dossier';
import { makeFilm } from './helpers';
import type { DossierFragment, DossierNode, DossierSource } from './helpers';

/** Ключи в порядке словаря — он же порядок показа. */
const BEFORE_KEYS = ['why', 'experience'];
/** v15: в блоке ключей ровно одна рубрика, и названа она заголовком блока. */
const KEYS_KEYS = ['keys'];
const AFTER_KEYS = [
  'reading',
  'context',
  'themes',
  'form',
  'characters',
  'critique',
  'reception',
  'place',
];

/** Русские названия рубрик заданы спекой дословно. */
const LABELS: Record<string, string> = {
  why: 'Почему это может быть интересно',
  experience: 'Какого опыта ждать',
  keys: 'Важные вещи о фильме',
  reading: 'Важные статьи',
  context: 'Контекст',
  themes: 'Смыслы и темы',
  form: 'Форма',
  characters: 'Персонажи',
  critique: 'Критика',
  reception: 'Как приняли',
  place: 'Место фильма',
};

const p = (text: string): DossierNode => ({ type: 'p', text });
const h = (text: string): DossierNode => ({ type: 'h', text });
const ul = (...items: string[]): DossierNode => ({ type: 'ul', items });
/** Врезка — голос создателя фильма: режиссёра, актёра, оператора, монтажёра.
 *  Критиков во врезки не выносят, их цитируют внутри абзаца. */
const quote = (text: string, author: string): DossierNode => ({ type: 'quote', text, author });

/** Фрагмент с телом по умолчанию — чтобы тест задавал только то, что проверяет. */
const frag = (key: string, ...body: DossierNode[]): DossierFragment => ({
  key,
  body: body.length > 0 ? body : [p(`Абзац рубрики «${key}».`)],
});

const keysOf = (fragments: DossierFragment[]): string[] => fragments.map((f) => f.key);

/** v15: рубрика ключей с заданным числом пунктов. Тело у неё своё — ровно один
 *  список, — поэтому `frag` с абзацем по умолчанию для неё не годится. */
const keysFragment = (count: number): DossierFragment => ({
  key: 'keys',
  body: [
    {
      type: 'ul',
      items: Array.from({ length: count }, (_, i) => `**Ключ ${i + 1}.** Раскрытие мысли.`),
    },
  ],
});

const validSource = (): DossierSource => ({
  publication: 'Variety',
  title: 'Обзор фильма',
  url: 'https://variety.com/review',
});

describe('Словарь рубрик: состав и принадлежность блокам', () => {
  it('в словаре одиннадцать рубрик, ключи не повторяются', () => {
    expect(DOSSIER_SECTIONS).toHaveLength(
      BEFORE_KEYS.length + KEYS_KEYS.length + AFTER_KEYS.length,
    );
    expect(SECTION_BY_KEY.size).toBe(DOSSIER_SECTIONS.length);
  });

  it('каждая рубрика принадлежит ровно одному блоку — тому, что назван спекой', () => {
    const expected: [string, string][] = [
      ...BEFORE_KEYS.map((key): [string, string] => [key, 'before']),
      ...KEYS_KEYS.map((key): [string, string] => [key, 'keys']),
      ...AFTER_KEYS.map((key): [string, string] => [key, 'after']),
    ];

    for (const [key, block] of expected) {
      const section = SECTION_BY_KEY.get(key);
      expect(section, `в словаре нет рубрики «${key}»`).toBeDefined();
      expect(section!.key).toBe(key);
      expect(section!.block, `рубрика «${key}» должна лежать в блоке ${block}`).toBe(block);
    }
  });

  // v15: блок ключей встаёт между двумя прежними — и в типе, и в словаре, и в показе.
  it('блоков ровно три, и все названы спекой', () => {
    expect(DOSSIER_BLOCK_LABELS.before).toBe('Зачем смотреть');
    expect(DOSSIER_BLOCK_LABELS.keys).toBe('Важные вещи о фильме');
    expect(DOSSIER_BLOCK_LABELS.after).toBe('После просмотра');
    expect(Object.keys(DOSSIER_BLOCK_LABELS)).toEqual(['before', 'keys', 'after']);
  });

  it('sectionsOfBlock отдаёт рубрики блока в порядке словаря', () => {
    expect(sectionsOfBlock('before')).toHaveLength(2);
    expect(sectionsOfBlock('before').map((s) => s.key)).toEqual(BEFORE_KEYS);
    expect(sectionsOfBlock('keys').map((s) => s.key)).toEqual(KEYS_KEYS);
    expect(sectionsOfBlock('after').map((s) => s.key)).toEqual(AFTER_KEYS);
  });

  // Порядок словаря — он же порядок полос на карточке: подготовка, ключи, разбор.
  it('рубрика ключей стоит между «Какого опыта ждать» и «Важными статьями»', () => {
    const order = DOSSIER_SECTIONS.map((section) => section.key);

    expect(order.indexOf('keys')).toBe(order.indexOf('experience') + 1);
    expect(order.indexOf('reading')).toBe(order.indexOf('keys') + 1);
  });

  it('русские названия рубрик заданы спекой', () => {
    for (const [key, label] of Object.entries(LABELS)) {
      expect(SECTION_BY_KEY.get(key)?.label, `рубрика «${key}» должна называться «${label}»`).toBe(
        label,
      );
    }
  });

  it('рубрик прежней структуры в словаре нет', () => {
    for (const key of ['pitch', 'analysis', 'narrative', 'camera', 'такой-рубрики-нет']) {
      expect(SECTION_BY_KEY.get(key), `рубрики «${key}» в словаре быть не должно`).toBeUndefined();
    }
  });

  it('русское название вместо ключа рубрикой не считается', () => {
    expect(SECTION_BY_KEY.get('Форма')).toBeUndefined();
  });
});

describe('sortFragments: порядок показа задаёт словарь (критерий 6)', () => {
  it('фрагменты блока «Зачем смотреть» идут в порядке словаря независимо от порядка на входе', () => {
    const shuffled = [frag('experience'), frag('why')];

    expect(keysOf(sortFragments('before', shuffled))).toEqual(BEFORE_KEYS);
  });

  it('восемь рубрик блока «После просмотра» идут в фиксированном порядке', () => {
    const shuffled = [...AFTER_KEYS].reverse().map((key) => frag(key));

    expect(keysOf(sortFragments('after', shuffled))).toEqual(AFTER_KEYS);
  });

  it('«Контекст» стоит перед темами: обстановка объясняется до смыслов', () => {
    const shuffled = [frag('form'), frag('themes'), frag('context')];

    expect(keysOf(sortFragments('after', shuffled))).toEqual(['context', 'themes', 'form']);
  });

  it('«Важные статьи» открывают блок: читателя сначала отправляют к первоисточникам', () => {
    const shuffled = [frag('themes'), frag('context'), frag('reading')];

    expect(keysOf(sortFragments('after', shuffled))).toEqual(['reading', 'context', 'themes']);
  });

  // v15: единый механизм фрагментов сохраняется — блок ключей в данных не особый случай.
  it('фрагменты блока ключей проходят тот же порядок показа', () => {
    expect(keysOf(sortFragments('keys', [keysFragment(7)]))).toEqual(['keys']);
    expect(keysOf(sortFragments('keys', [frag('themes'), keysFragment(7)]))).toEqual(['keys']);
  });

  it('рубрика ключей в блоке «После просмотра» до показа не доходит', () => {
    expect(keysOf(sortFragments('after', [keysFragment(7), frag('context')]))).toEqual(['context']);
  });

  it('неизвестные ключи молча отбрасываются', () => {
    const withJunk = [frag('why'), frag('такой-рубрики-нет'), frag('experience')];

    expect(keysOf(sortFragments('before', withJunk))).toEqual(['why', 'experience']);
  });

  it('ключи чужого блока молча отбрасываются', () => {
    expect(keysOf(sortFragments('before', [frag('why'), frag('themes')]))).toEqual(['why']);
  });

  it('пустой набор даёт пустой список', () => {
    expect(sortFragments('before', [])).toEqual([]);
  });

  it('тело фрагмента доходит до результата в исходном виде', () => {
    const body = [h('Тема'), p('Абзац.'), ul('Первый пункт.', 'Второй пункт.')];

    const [first] = sortFragments('after', [{ key: 'themes', body }]);

    expect(first.body).toEqual(body);
  });

  it('врезка доходит до результата вместе с автором и без разбора текста', () => {
    const body = [
      p('Абзац.'),
      quote('Я снимал это как сон, а не как сюжет.', 'Даррен Аронофски, режиссёр'),
    ];

    const [first] = sortFragments('after', [{ key: 'form', body }]);

    expect(first.body).toEqual(body);
    expect(first.body[1]).toEqual({
      type: 'quote',
      text: 'Я снимал это как сон, а не как сюжет.',
      author: 'Даррен Аронофски, режиссёр',
    });
  });
});

describe('sortedSections: рубрика словаря приходит вместе с телом', () => {
  it('каждая запись несёт рубрику словаря и тело фрагмента', () => {
    const items = sortedSections('before', [
      frag('experience', p('Опыт.')),
      frag('why', p('Ставка.')),
    ]);

    expect(items.map((item) => item.section.key)).toEqual(['why', 'experience']);
    expect(items.map((item) => item.section.label)).toEqual([LABELS.why, LABELS.experience]);
    expect(items[0].body).toEqual([p('Ставка.')]);
  });

  it('чужие и неизвестные ключи до вёрстки не доходят', () => {
    const items = sortedSections('after', [frag('why'), frag('такой-рубрики-нет'), frag('form')]);

    expect(items.map((item) => item.section.key)).toEqual(['form']);
  });

  it('пустой набор даёт пустой список', () => {
    expect(sortedSections('after', [])).toEqual([]);
  });

  it('врезка доходит до вёрстки без изменений', () => {
    const node = quote('Монтаж — это ритм дыхания.', 'Джей Рабинович, монтажёр');

    const items = sortedSections('after', [{ key: 'form', body: [p('Абзац.'), node] }]);

    expect(items[0].body).toEqual([p('Абзац.'), node]);
  });
});

describe('validateDossierBlock: корректный набор', () => {
  it('блок «Зачем смотреть» с обязательной первой рубрикой проходит', () => {
    expect(
      validateDossierBlock('before', [frag('why', p('Ставка фильма.')), frag('experience')]),
    ).toBeNull();
  });

  it('блок «После просмотра» без обязательных рубрик проходит', () => {
    expect(validateDossierBlock('after', [frag('reception')])).toBeNull();
  });

  it('полный блок «После просмотра» — все восемь рубрик — проходит', () => {
    expect(validateDossierBlock('after', AFTER_KEYS.map((key) => frag(key)))).toBeNull();
  });

  it('порядок фрагментов на входе на проверку не влияет', () => {
    const shuffled = [frag('experience'), frag('why')];

    expect(validateDossierBlock('before', shuffled)).toBeNull();
  });

  it('подзаголовки, абзацы и списки в одном теле уживаются', () => {
    const body = [
      h('Вера возникает там, где заканчивается знание'),
      p('Тезис темы.'),
      ul('Первая деталь.', 'Вторая деталь.'),
      p('Развитие темы.'),
    ];

    expect(validateDossierBlock('after', [{ key: 'themes', body }])).toBeNull();
  });

  it('полужирный и ссылка проходят и в абзаце, и в пункте списка', () => {
    const body = [
      p('О замысле — [интервью режиссёра](https://example.com/i), так пишет **Variety**.'),
      ul('**Свет.** Открытое пространство становится страшным.', '[Разбор](http://example.com/s).'),
    ];

    expect(validateDossierBlock('after', [{ key: 'form', body }])).toBeNull();
  });

  it('звёздочка и квадратная скобка сами по себе разметкой не считаются', () => {
    const body = [p('Формат 4*3, ремарка [в скобках] и одинокая * посреди строки.')];

    expect(validateDossierBlock('after', [{ key: 'form', body }])).toBeNull();
  });

  it('в подзаголовке разметка не проверяется — он и так набран отдельно', () => {
    const body = [h('Тема со ** звёздочками и [скобкой](не-адрес)'), p('Абзац.')];

    expect(validateDossierBlock('after', [{ key: 'themes', body }])).toBeNull();
  });

  it('врезка голосом создателя фильма проходит', () => {
    const body = [
      p('О работе с камерой автор говорил сам.'),
      quote('Мы искали не красоту, а неудобство.', 'Мэттью Либатик, оператор'),
      p('Дальше — как это видно в кадре.'),
    ];

    expect(validateDossierBlock('after', [{ key: 'form', body }])).toBeNull();
  });

  it('врезка уживается с подзаголовками, абзацами и списками в одном теле', () => {
    const body = [
      h('Вера возникает там, где заканчивается знание'),
      p('Тезис темы.'),
      quote('Я не объясняю финал, потому что объяснения у меня нет.', 'Режиссёр фильма'),
      ul('Первая деталь.', 'Вторая деталь.'),
    ];

    expect(validateDossierBlock('after', [{ key: 'themes', body }])).toBeNull();
  });

  it('во врезке разметка не проверяется и не разбирается — как в подзаголовке', () => {
    const body = [
      quote('Тут ** звёздочки и [скобка](не-адрес) остаются текстом.', 'Постановщик трюков'),
    ];

    expect(validateDossierBlock('after', [{ key: 'form', body }])).toBeNull();
  });
});

describe('validateDossierBlock: коды отказов (критерий 8)', () => {
  it('пустой массив фрагментов — «блока нет» означает null, а не пустоту', () => {
    expect(validateDossierBlock('before', [])).toBe('empty');
    expect(validateDossierBlock('after', [])).toBe('empty');
  });

  it('рубрика вне словаря', () => {
    expect(validateDossierBlock('before', [frag('why'), frag('такой-рубрики-нет')])).toBe(
      'unknown',
    );
  });

  it('русское название вместо ключа — тоже рубрика вне словаря', () => {
    expect(validateDossierBlock('after', [frag('Форма')])).toBe('unknown');
  });

  // v15: рубрика «keys» в словаре появилась, но принадлежит своему блоку. В блоке
  // «Зачем смотреть» её по-прежнему быть не может — только код отказа сменился
  // с «рубрики нет в словаре» на «рубрика чужого блока».
  it('в блоке «Зачем смотреть» словарных рубрик ровно две, «keys» среди них нет', () => {
    expect(sectionsOfBlock('before').map((section) => section.key)).toEqual(['why', 'experience']);
    expect(SECTION_BY_KEY.get('keys')?.block).toBe('keys');
    expect(validateDossierBlock('before', [frag('why'), keysFragment(7)])).toBe('foreign');
  });

  it('рубрика чужого блока', () => {
    expect(validateDossierBlock('before', [frag('why'), frag('themes')])).toBe('foreign');
    expect(validateDossierBlock('after', [frag('experience')])).toBe('foreign');
  });

  it('дубль ключа', () => {
    expect(
      validateDossierBlock('before', [frag('why'), frag('experience'), frag('experience')]),
    ).toBe('duplicate');
  });

  it('фрагмент с пустым телом', () => {
    expect(validateDossierBlock('before', [{ key: 'why', body: [] }])).toBe('no-body');
  });

  it('абзац или подзаголовок из одних пробелов', () => {
    expect(validateDossierBlock('before', [{ key: 'why', body: [p('   ')] }])).toBe('blank-text');
    expect(validateDossierBlock('before', [{ key: 'why', body: [p('Есть текст.'), h('')] }])).toBe(
      'blank-text',
    );
  });

  it('врезка из одних пробелов — тот же код, что у пустого абзаца', () => {
    expect(
      validateDossierBlock('after', [{ key: 'form', body: [quote('', 'Режиссёр')] }]),
    ).toBe('blank-text');
    expect(
      validateDossierBlock('after', [{ key: 'form', body: [quote('   ', 'Режиссёр')] }]),
    ).toBe('blank-text');
  });

  it('ссылка внутри полужирного — своя ошибка: вложенной разметки не существует', () => {
    const nested = '**[The Chinese Cinema](https://example.com/x) — самый подробный разбор.** Дальше.';

    expect(validateDossierBlock('after', [{ key: 'reading', body: [{ type: 'ul', items: [nested] }] }])).toBe(
      'link-in-bold',
    );
  });

  it('ссылка рядом с полужирным, а не внутри него, — законно', () => {
    const flat = '**Самый подробный разбор.** Читать: [The Chinese Cinema](https://example.com/x).';

    expect(
      validateDossierBlock('after', [{ key: 'reading', body: [{ type: 'ul', items: [flat] }] }]),
    ).toBeNull();
  });

  it('справка-врезка разбирает разметку внутри строки: ей нужны ссылки', () => {
    const note: DossierNode = {
      type: 'note',
      text: '**Город-крепость** снесли в 1994 году, [подробнее](https://example.com/kwc).',
    };

    expect(validateDossierBlock('after', [{ key: 'context', body: [note] }])).toBeNull();
  });

  it('справка-врезка с незакрытой разметкой отклоняется, как абзац', () => {
    const broken: DossierNode = { type: 'note', text: '**Город-крепость снесли в 1994 году.' };

    expect(validateDossierBlock('after', [{ key: 'context', body: [broken] }])).toBe('markup');
  });

  it('справка-врезка из одних пробелов — пустой текст', () => {
    expect(
      validateDossierBlock('after', [{ key: 'context', body: [{ type: 'note', text: '  ' }] }]),
    ).toBe('blank-text');
  });

  it('врезка без автора — своя ошибка: без голоса цитата читается как лозунг', () => {
    expect(
      validateDossierBlock('after', [{ key: 'form', body: [quote('Есть текст врезки.', '')] }]),
    ).toBe('no-author');
    expect(
      validateDossierBlock('after', [{ key: 'form', body: [quote('Есть текст врезки.', '  ')] }]),
    ).toBe('no-author');
  });

  it('пустой список и пустой пункт списка', () => {
    expect(validateDossierBlock('before', [{ key: 'why', body: [ul()] }])).toBe('blank-item');
    expect(
      validateDossierBlock('before', [{ key: 'why', body: [ul('Есть пункт.', '  ')] }]),
    ).toBe('blank-item');
  });

  it('незакрытое выделение полужирным', () => {
    expect(
      validateDossierBlock('before', [{ key: 'why', body: [p('Тут **незакрытое выделение.')] }]),
    ).toBe('markup');
    expect(
      validateDossierBlock('before', [{ key: 'why', body: [ul('Пункт с **обрывом.')] }]),
    ).toBe('markup');
  });

  it('ссылка не на http', () => {
    expect(
      validateDossierBlock('before', [{ key: 'why', body: [p('Смотри [разбор](/local).')] }]),
    ).toBe('link');
    expect(
      validateDossierBlock('before', [{ key: 'why', body: [ul('[Файл](ftp://example.com/f).')] }]),
    ).toBe('link');
  });

  it('блок «Зачем смотреть» без обязательной первой рубрики', () => {
    expect(validateDossierBlock('before', [frag('experience')])).toBe('incomplete');
  });
});

// Дополнение v15 (spec.md, раздел A, критерии приёмки 1—3): третий блок досье.
describe('блок ключей: словарь, состав и форма тела', () => {
  it('рубрика ключей — единственная в блоке и названа заголовком блока', () => {
    const sections = sectionsOfBlock('keys');

    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe('keys');
    expect(sections[0].label).toBe('Важные вещи о фильме');
    expect(DOSSIER_BLOCK_LABELS.keys).toBe('Важные вещи о фильме');
  });

  // Рубрика уехала в свой блок и сменила задачу: не резюме разбора, а ключи к фильму.
  it('рубрики «Фильм в пяти тезисах» в словаре больше нет', () => {
    expect(SECTION_BY_KEY.has('theses')).toBe(false);
    expect(sectionsOfBlock('after').map((section) => section.key)).not.toContain('theses');
    expect(validateDossierBlock('after', [frag('theses')])).toBe('unknown');
  });

  it('принимает ровно семь пунктов', () => {
    expect(validateDossierBlock('keys', [keysFragment(7)])).toBeNull();
  });

  // Правка 15.09.2026: вилка «пять—семь» сведена к точному числу. Шесть пунктов —
  // отказ ровно такой же, как восемь: правило письма говорит «ровно семь вещей»,
  // и на пути в базу оно теперь стоит.
  it('отклоняет шесть пунктов так же, как четыре и восемь', () => {
    expect(validateDossierBlock('keys', [keysFragment(4)])).toBe('keys-count');
    expect(validateDossierBlock('keys', [keysFragment(5)])).toBe('keys-count');
    expect(validateDossierBlock('keys', [keysFragment(6)])).toBe('keys-count');
    expect(validateDossierBlock('keys', [keysFragment(8)])).toBe('keys-count');
  });

  // Потолок объёма (правка 15.09.2026, находка 6). До неё валидатор объём не считал
  // вовсе: сторожил его только `scripts/keys-check.py` по файлу порции, то есть
  // на одном из пяти путей в базу. Правило письма — «до 6000 знаков, в допуске до 6059»
  // (research/DOSSIER-FORMAT.md, редакция 15.09.2026); валидатор стоит на допуске:
  // норма — дело пишущего, потолок — дело кода.
  //
  // Считается то же, что считает `keys-check.py`: сумма знаков всех пунктов с пробелами,
  // без разметки полужирного. Разметка не видна читателю, и звёздочки не должны съедать
  // у него по четыре знака с пункта.

  /** Блок ключей заданного объёма: семь пунктов, сумма видимых знаков — ровно `total`. */
  const keysOfLength = (total: number): DossierFragment => {
    const lead = '**Л.** ';
    const visibleLead = 3; // «Л. » — звёздочки в счёт не идут
    const rest = total - visibleLead * 7;
    const each = Math.floor(rest / 7);
    const extra = rest % 7;

    return {
      key: 'keys',
      body: [
        {
          type: 'ul',
          items: Array.from(
            { length: 7 },
            (_, index) => `${lead}${'а'.repeat(each + (index === 0 ? extra : 0))}`,
          ),
        },
      ],
    };
  };

  // Фикстура сама должна быть верной, иначе следующие два теста проверяют не то,
  // что думают: счёт ведётся по видимым знакам, и звёздочки в него не входят.
  it('фикстура объёма даёт ровно столько видимых знаков, сколько заказано', () => {
    const [list] = keysOfLength(6059).body;
    const visible = (list as { items: string[] }).items
      .map((item) => item.replaceAll('**', '').length)
      .reduce((sum, length) => sum + length, 0);

    expect(visible).toBe(6059);
  });

  it('семь пунктов на 6059 знаков — норма', () => {
    expect(validateDossierBlock('keys', [keysOfLength(6059)])).toBeNull();
  });

  it('семь пунктов на 6100 знаков — keys-length', () => {
    expect(validateDossierBlock('keys', [keysOfLength(6100)])).toBe('keys-length');
  });

  it('знак сверх потолка уже нарушение, знак под ним — ещё нет', () => {
    expect(validateDossierBlock('keys', [keysOfLength(6060)])).toBe('keys-length');
    expect(validateDossierBlock('keys', [keysOfLength(6058)])).toBeNull();
  });

  // Звёздочки полужирного читателю не видны, и на объём они не влияют: блок ровно
  // на потолке остаётся нормой, сколько бы в нём ни было выделений.
  it('разметка полужирного в объём не засчитывается', () => {
    const [list] = keysOfLength(6059).body;
    // Ещё одна пара звёздочек в каждом пункте — плюс четыре знака разметки
    // и ни одного видимого. Блок ровно на потолке нормой и остаётся.
    const bolder: DossierFragment = {
      key: 'keys',
      body: [
        {
          type: 'ul',
          items: (list as { items: string[] }).items.map((item) =>
            item.replace(/^(\*\*Л\.\*\* )(.{10})/, '$1**$2**'),
          ),
        },
      ],
    };

    expect(validateDossierBlock('keys', [bolder])).toBeNull();
  });

  // Форма важнее объёма только там, где объём ещё не с чем сравнивать: шесть пунктов
  // на 6100 знаков — нарушение обоих правил, и код возвращается один. Какой именно,
  // решает порядок проверок в валидаторе; здесь закрепляется то, что отказ есть.
  it('нарушение и числа, и объёма даёт отказ, а не молчание', () => {
    const [list] = keysOfLength(6100).body;
    const items = (list as { items: string[] }).items.slice(0, 6);

    expect(validateDossierBlock('keys', [{ key: 'keys', body: [{ type: 'ul', items }] }])).not.toBeNull();
  });

  // Блок короткий, и всё, что не пункт, в нём лишнее: ни вводки, ни подзаголовка,
  // ни врезки. Тело — ровно один узел `ul`.
  it('отклоняет тело без списка, с двумя списками и с подзаголовком', () => {
    expect(validateDossierBlock('keys', [{ key: 'keys', body: [p('Проза.')] }])).toBe('keys-shape');
    expect(
      validateDossierBlock('keys', [
        { key: 'keys', body: [h('Подзаголовок'), ...keysFragment(6).body] },
      ]),
    ).toBe('keys-shape');
    expect(
      validateDossierBlock('keys', [
        { key: 'keys', body: [...keysFragment(3).body, ...keysFragment(4).body] },
      ]),
    ).toBe('keys-shape');
  });

  // Правка спеки 07.09.2026 по живому материалу переноса: строгая форма отвергла
  // два досье из тридцати четырёх — оговорку о неполном сезоне у «Призрака
  // в доспехах» и врезку голосом создателя у «Человека-паука».
  it('принимает вводку перед списком и врезку после него', () => {
    expect(
      validateDossierBlock('keys', [
        { key: 'keys', body: [p('Разбор написан по семи вышедшим сериям.'), ...keysFragment(7).body] },
      ]),
    ).toBeNull();
    expect(
      validateDossierBlock('keys', [
        {
          key: 'keys',
          body: [
            ...keysFragment(7).body,
            { type: 'quote', text: 'Довольно большой замах.', author: 'Режиссёр' },
          ],
        },
      ]),
    ).toBeNull();
  });

  it('требует рубрику ключей и не пускает чужую', () => {
    expect(validateDossierBlock('keys', [])).toBe('empty');
    expect(validateDossierBlock('keys', [{ key: 'themes', body: keysFragment(7).body }])).toBe(
      'foreign',
    );
    expect(
      validateDossierBlock('keys', [{ key: 'такой-рубрики-нет', body: keysFragment(7).body }]),
    ).toBe('unknown');
  });

  // Правила тела действуют и здесь: проверка формы блока их не подменяет.
  it('общие правила тела в блоке ключей остаются в силе', () => {
    const broken: DossierFragment = {
      key: 'keys',
      body: [ul('**Ключ.** Раскрытие.', 'Пункт с **обрывом.')],
    };

    expect(validateDossierBlock('keys', [broken])).toBe('markup');
  });

  // Число пунктов — правило одного блока: в прочих блоках список какой угодно длины.
  it('в других блоках длина списка по-прежнему не ограничена', () => {
    expect(
      validateDossierBlock('after', [{ key: 'themes', body: [ul('Один пункт.')] }]),
    ).toBeNull();
    expect(
      validateDossierBlock('after', [
        { key: 'themes', body: [p('Абзац.'), ul(...Array.from({ length: 9 }, (_, i) => `Пункт ${i + 1}.`))] },
      ]),
    ).toBeNull();
  });
});

describe('parseInline: разметки ровно две (критерий 7)', () => {
  it('текст без разметки — один простой кусок', () => {
    expect(parseInline('Обычный абзац без разметки.')).toEqual([
      { kind: 'text', text: 'Обычный абзац без разметки.' },
    ]);
  });

  it('полужирный', () => {
    expect(parseInline('**Свет.** Дальше обычный текст.')).toEqual([
      { kind: 'bold', text: 'Свет.' },
      { kind: 'text', text: ' Дальше обычный текст.' },
    ]);
  });

  it('ссылка отдаёт и текст, и адрес', () => {
    expect(parseInline('Смотри [разбор приёма](https://example.com/sound).')).toEqual([
      { kind: 'text', text: 'Смотри ' },
      { kind: 'link', text: 'разбор приёма', href: 'https://example.com/sound' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('полужирный и ссылка в одной строке', () => {
    const spans = parseInline('**Variety** назвала это [лучшим фильмом](http://example.com/r) года.');

    expect(spans).toEqual([
      { kind: 'bold', text: 'Variety' },
      { kind: 'text', text: ' назвала это ' },
      { kind: 'link', text: 'лучшим фильмом', href: 'http://example.com/r' },
      { kind: 'text', text: ' года.' },
    ]);
  });

  it('звёздочка в середине слова разметку не открывает', () => {
    const text = 'Формат 4*3 и сноска * в середине строки.';

    expect(parseInline(text)).toEqual([{ kind: 'text', text }]);
  });

  it('незакрытая разметка остаётся простым текстом', () => {
    const text = 'Тут **незакрытое выделение и [скобка](не-адрес).';

    expect(parseInline(text)).toEqual([{ kind: 'text', text }]);
  });

  it('пустая строка не даёт кусков', () => {
    expect(parseInline('')).toEqual([]);
  });

  it('видимый текст кусков складывается в исходную строку без служебных символов', () => {
    const spans = parseInline('**Жирно**, потом [ссылка](https://example.com/a), потом текст.');

    expect(spans.map((span) => span.text).join('')).toBe('Жирно, потом ссылка, потом текст.');
  });
});

describe('validateSources (критерий 11)', () => {
  it('корректный список источников проходит', () => {
    expect(
      validateSources([
        validSource(),
        { publication: 'The Guardian', title: 'Интервью', url: 'http://theguardian.com/i' },
      ]),
    ).toBeNull();
  });

  it('пустой список отклоняется', () => {
    expect(validateSources([])).toBe('empty');
  });

  it('источник без издания отклоняется', () => {
    expect(validateSources([{ ...validSource(), publication: '' }])).toBe('publication');
    expect(validateSources([{ ...validSource(), publication: '   ' }])).toBe('publication');
  });

  it('источник без заголовка отклоняется', () => {
    expect(validateSources([{ ...validSource(), title: '' }])).toBe('title');
  });

  it('адрес не на http отклоняется', () => {
    expect(validateSources([{ ...validSource(), url: 'variety.com/review' }])).toBe('url');
    expect(validateSources([{ ...validSource(), url: '/review' }])).toBe('url');
    expect(validateSources([{ ...validSource(), url: '' }])).toBe('url');
  });
});

describe('dossierFreshness: дата последнего поиска (критерии 9 и 10)', () => {
  const TODAY = '2026-08-22';

  it('даты поиска нет — свежесть не определена', () => {
    const film = makeFilm({
      id: 1,
      titleRu: 'Фильм',
      releaseDate: '2026-01-15',
      dossierSearchedAt: null,
    });

    expect(dossierFreshness(film, TODAY)).toBe('none');
  });

  it('даты выхода нет — сравнивать не с чем, материалы свежие', () => {
    const film = makeFilm({
      id: 1,
      titleRu: 'Без даты выхода',
      releaseDate: null,
      dossierSearchedAt: '2024-03-01',
    });

    expect(dossierFreshness(film, TODAY)).toBe('fresh');
  });

  it('фильм ещё не вышел — материалы не устарели, даже если поиск был давно', () => {
    const film = makeFilm({
      id: 1,
      titleRu: 'Ждём',
      releaseDate: '2030-01-01',
      dossierSearchedAt: '2026-02-10',
    });

    expect(dossierFreshness(film, TODAY)).toBe('fresh');
  });

  it('фильм вышел, поиск шёл после выхода — материалы свежие', () => {
    const film = makeFilm({
      id: 1,
      titleRu: 'Фильм',
      releaseDate: '2026-01-15',
      dossierSearchedAt: '2026-08-01',
    });

    expect(dossierFreshness(film, TODAY)).toBe('fresh');
  });

  it('фильм вышел, а поиск был раньше выхода — материалы устарели', () => {
    const film = makeFilm({
      id: 1,
      titleRu: 'Фильм',
      releaseDate: '2026-01-15',
      dossierSearchedAt: '2025-11-01',
    });

    expect(dossierFreshness(film, TODAY)).toBe('stale');
  });

  it('поиск в день выхода устаревшим не считается', () => {
    const film = makeFilm({
      id: 1,
      titleRu: 'Фильм',
      releaseDate: '2026-01-15',
      dossierSearchedAt: '2026-01-15',
    });

    expect(dossierFreshness(film, TODAY)).toBe('fresh');
  });
});

// v15 (spec.md, раздел C, критерий приёмки 4): правило «раскрыт ровно один блок»
// отменено. У просмотренного раскрыты ключи и разбор — вернувшийся из зала хочет
// разобраться, и нужны они ему оба сразу. У всех прочих раскрыта только подготовка,
// и довод тут про спойлеры: тот, кто ещё выбирает, не должен получить финал фильма
// первым же экраном.
describe('defaultOpenBlocks: что раскрыто при каком статусе (критерий 4)', () => {
  it('«ждём» — раскрыт блок «Зачем смотреть»', () => {
    expect(defaultOpenBlocks('waiting')).toEqual(['before']);
  });

  it('«буду смотреть» — раскрыт блок «Зачем смотреть»', () => {
    expect(defaultOpenBlocks('will-watch')).toEqual(['before']);
  });

  it('«другое» — раскрыт блок «Зачем смотреть»', () => {
    expect(defaultOpenBlocks('other')).toEqual(['before']);
  });

  it('«посмотрел» — раскрыты «Важные вещи о фильме» и «После просмотра»', () => {
    expect(defaultOpenBlocks('watched')).toEqual(['keys', 'after']);
  });

  it('у непросмотренного ключи закрыты: в них спойлеры', () => {
    for (const status of ['will-watch', 'waiting', 'other'] as const) {
      expect(defaultOpenBlocks(status), `статус ${status}`).toEqual(['before']);
    }
  });
});

describe('hasDossier: есть ли что показывать (критерий 12)', () => {
  it('фильм без досье — нечего показывать', () => {
    expect(hasDossier(makeFilm({ id: 1, titleRu: 'Пусто' }))).toBe(false);
  });

  it('есть блок «Зачем смотреть» — есть что показывать', () => {
    expect(hasDossier(makeFilm({ id: 1, titleRu: 'Фильм', dossierBefore: [frag('why')] }))).toBe(
      true,
    );
  });

  it('есть блок «После просмотра» — есть что показывать', () => {
    expect(hasDossier(makeFilm({ id: 1, titleRu: 'Фильм', dossierAfter: [frag('themes')] }))).toBe(
      true,
    );
  });

  // v15: третий блок в этот вопрос входит наравне с двумя прежними.
  it('есть только блок ключей — есть что показывать', () => {
    expect(
      hasDossier(makeFilm({ id: 1, titleRu: 'Фильм', dossierKeys: [keysFragment(7)] })),
    ).toBe(true);
  });

  it('есть только источники — тоже есть что показывать', () => {
    expect(
      hasDossier(makeFilm({ id: 1, titleRu: 'Фильм', dossierSources: [validSource()] })),
    ).toBe(true);
  });
});

// Дополнение v7: тот же набор правил, вынутый наружу отдельной функцией.
describe('validateNodes: правила тела, вынутые из блочного валидатора', () => {
  it('корректное тело проходит', () => {
    expect(
      validateNodes([
        h('Подзаголовок'),
        p('Абзац с **выделением** и [ссылкой](https://example.com/a).'),
        ul('Пункт', 'Пункт со [ссылкой](https://example.com/b)'),
        quote('Реплика создателя фильма', 'Дэррен Аронофски'),
      ]),
    ).toBeNull();
  });

  it('пустое тело — «no-body»', () => {
    expect(validateNodes([])).toBe('no-body');
  });

  it('абзац, подзаголовок и цитата из пробелов — «blank-text»', () => {
    expect(validateNodes([p('   ')])).toBe('blank-text');
    expect(validateNodes([h('')])).toBe('blank-text');
    expect(validateNodes([quote('  ', 'Автор')])).toBe('blank-text');
  });

  it('список без пунктов и пустой пункт — «blank-item»', () => {
    expect(validateNodes([ul()])).toBe('blank-item');
    expect(validateNodes([ul('Пункт', '   ')])).toBe('blank-item');
  });

  it('цитата без автора — «no-author»', () => {
    expect(validateNodes([quote('Реплика', '')])).toBe('no-author');
    expect(validateNodes([quote('Реплика', '   ')])).toBe('no-author');
  });

  it('незакрытая пара звёздочек — «markup»', () => {
    expect(validateNodes([p('Первый фильм **Аронофски за десять лет.')])).toBe('markup');
    expect(validateNodes([ul('Пункт с **незакрытым выделением')])).toBe('markup');
  });

  it('ссылка не на http — «link»', () => {
    expect(validateNodes([p('Смотри [разбор](ftp://example.com).')])).toBe('link');
    expect(validateNodes([ul('Пункт со [ссылкой](/local/path)')])).toBe('link');
  });

  it('код возвращает первая же неисправность в порядке узлов', () => {
    expect(validateNodes([p('   '), quote('Реплика', '')])).toBe('blank-text');
  });
});

// Ради этого блока извлечение и делалось: правила остаются в одном месте, и блочный
// валидатор обязан отвечать ровно то же, что отдельная функция, на том же теле.
describe('validateDossierBlock зовёт validateNodes и снаружи не меняется', () => {
  const BODIES: [string, DossierNode[]][] = [
    ['пустое тело', []],
    ['абзац из пробелов', [p('   ')]],
    ['список без пунктов', [ul()]],
    ['пустой пункт списка', [ul('Пункт', ' ')]],
    ['цитата без автора', [quote('Реплика', '')]],
    ['незакрытое выделение', [p('Фильм **Аронофски')]],
    ['ссылка не на http', [p('Смотри [разбор](не-адрес).')]],
    ['врезка сразу после подзаголовка', [h('Подзаголовок'), quote('Реплика', 'Автор')]],
    ['корректное тело', [p('Абзац с **выделением**.')]],
  ];

  it.each(BODIES)('на теле «%s» коды совпадают', (_name, body) => {
    expect(validateDossierBlock('before', [{ key: 'why', body }])).toBe(validateNodes(body));
  });
});

// Дополнение v9: врезка не стоит вплотную к подзаголовку.
describe('validateNodes: правило «quote-after-heading»', () => {
  it('врезка сразу после подзаголовка — «quote-after-heading»', () => {
    expect(validateNodes([h('Как это снято'), quote('Реплика', 'Йоргос Лантимос')])).toBe(
      'quote-after-heading',
    );
  });

  it('правило действует и в середине тела, а не только на первой паре узлов', () => {
    expect(
      validateNodes([
        p('Первый абзац рубрики.'),
        h('Как это снято'),
        quote('Реплика', 'Йоргос Лантимос'),
        p('Последний абзац.'),
      ]),
    ).toBe('quote-after-heading');
  });

  it('врезка после абзаца законна', () => {
    expect(
      validateNodes([
        h('Как это снято'),
        p('Абзац, к которому врезка и относится.'),
        quote('Реплика', 'Йоргос Лантимос'),
      ]),
    ).toBeNull();
  });

  it('врезка первым узлом тела законна: перед ней нет подзаголовка', () => {
    expect(
      validateNodes([quote('Реплика', 'Йоргос Лантимос'), p('Абзац после врезки.')]),
    ).toBeNull();
  });

  it('две врезки подряд после абзаца законны', () => {
    expect(
      validateNodes([
        p('Абзац рубрики.'),
        quote('Первая реплика', 'Йоргос Лантимос'),
        quote('Вторая реплика', 'Эмма Стоун'),
      ]),
    ).toBeNull();
  });

  it('врезка после списка законна: правило спрашивает про подзаголовок', () => {
    expect(
      validateNodes([ul('Пункт', 'Другой пункт'), quote('Реплика', 'Йоргос Лантимос')]),
    ).toBeNull();
  });

  it('подзаголовок с абзацем и без врезки ничего не нарушает', () => {
    expect(validateNodes([h('Как это снято'), p('Абзац рубрики.')])).toBeNull();
  });
});
