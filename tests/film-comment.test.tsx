// Критерии приёмки 4, 5, 7, 8, 9 (готовый вид блока) и 10–17 (правка на месте)
// версии v14 — голос владельца на карточке фильма.
//
// Готовый вид, '@/components/FilmComment' (spec.md, раздел A и B; plan.md, раздел 3):
//   export default function FilmComment({ comment, action }: {
//     comment: string;
//     action?: ReactNode;
//   })
// Серверный компонент без состояния: тот же самый рендерится гостю, и лишнего
// JavaScript читателю доставаться не должно. `action` — слот под кнопку правки;
// у гостя он не передаётся, и кнопки в разметке нет вовсе (критерий 5).
//
// Правка на месте, '@/components/CommentEditor' (plan.md, раздел 4):
//   export default function CommentEditor({ comment, onSave }: {
//     comment: string | null;
//     onSave: (text: string) => Promise<boolean>;   // true — сохранено
//   })
// Клиентский компонент. О базе и о серверном действии он не знает ничего: сохранение
// ему передают. Поэтому здесь проверяется его собственный контракт — что он зовёт
// `onSave` с набранным текстом и как ведёт себя при обоих исходах, — а не путь записи.
// Путь записи один на все личные поля и проверяется в tests/personal-fields.test.tsx.
//
// Что здесь НЕ проверяется. Курсив, hairline-линейка сверху, мера в 65 знаков, размер
// и цвет подписи — это CSS, а в jsdom Tailwind не загружен (правило проекта). Место
// блока на самой карточке — тоже не здесь: критерии 2 и 3 проверяются на странице
// и на секции «Моё», где у блока есть соседи.
//
// Исключение одно и оговорено спекой: критерий 4 назван в ней вместе с классом
// (`whitespace-pre-line`), потому что перенос строки в HTML иначе схлопнется. Проверяются
// обе половины: текст с переносами лежит в разметке целиком одним куском (это разметка,
// а не стиль) и несёт объявленный класс. Что перенос виден глазом — работа живого прогона.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import FilmComment from '@/components/FilmComment';
import CommentEditor from '@/components/CommentEditor';

afterEach(() => {
  cleanup();
});

const COMMENT = 'Смотрел трижды и каждый раз про другое';
// portable 22.09.2026: имя владельца — личное поле из site.config.ts; у отчуждаемой
// копии оно по умолчанию пустое, и подпись — заглушка «Владелец базы». Поведение
// подписи при заданных имени и ссылке проверяет tests/site-config.test.tsx.
const SIGNATURE = 'Владелец базы';

/** Текст разметки без оглядки на то, как он разбит по элементам. */
const textOf = (container: HTMLElement): string =>
  (container.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Лист разметки, в котором лежит ровно этот текст — с переносами строк как есть.
 *  `getByText` нормализует пробелы и для проверки переносов не годится. */
function leafWithText(container: HTMLElement, text: string): HTMLElement {
  const found = [...container.querySelectorAll('*')].find(
    (element) => element.children.length === 0 && element.textContent === text,
  );
  if (!found) throw new Error(`в разметке нет элемента с текстом ${JSON.stringify(text)}`);
  return found as HTMLElement;
}

/** Контрол недоступен, если он отключён атрибутом или помечен aria-disabled. */
function isDisabled(element: HTMLElement): boolean {
  return element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true';
}

const editButton = () => screen.queryByRole('button', { name: /Редактировать/i });
const saveButton = () => screen.queryByRole('button', { name: /Сохранить/i });
const cancelButton = () => screen.queryByRole('button', { name: /Отмена/i });
const field = () => screen.queryByRole('textbox') as HTMLTextAreaElement | null;

/** Поле правки, когда оно обязано быть открытым. */
function openField(): HTMLTextAreaElement {
  const found = field();
  if (found === null) throw new Error('поле правки комментария не открыто');
  return found;
}

function makeSave(result: boolean) {
  const onSave = vi.fn<(text: string) => Promise<boolean>>();
  onSave.mockResolvedValue(result);
  return onSave;
}

// ---------------------------------------------------------------------------
// Готовый вид блока

describe('FilmComment: текст комментария (критерий 1)', () => {
  it('текст показан как есть', () => {
    const { container } = render(<FilmComment comment={COMMENT} />);

    expect(textOf(container)).toContain(COMMENT);
  });
});

describe('FilmComment: переносы строк (критерий 4)', () => {
  const MULTILINE = 'Первый абзац про финал.\n\nВторой абзац про музыку.';

  it('текст с переносами лежит в разметке целиком, одним куском', () => {
    const { container } = render(<FilmComment comment={MULTILINE} />);

    expect(leafWithText(container, MULTILINE).textContent).toBe(MULTILINE);
  });

  it('перенос не заменяется пробелом и не выбрасывается', () => {
    const { container } = render(<FilmComment comment={MULTILINE} />);

    expect(leafWithText(container, MULTILINE).textContent).toContain('\n\n');
  });

  // Единственная проверка класса во всём файле, и она названа самим критерием:
  // без `whitespace-pre-line` перенос строки в HTML схлопнется в пробел, то есть
  // это разметка смысла, а не оформление.
  it('текст несёт объявленный спекой whitespace-pre-line', () => {
    const { container } = render(<FilmComment comment={MULTILINE} />);

    expect(leafWithText(container, MULTILINE).className).toContain('whitespace-pre-line');
  });
});

describe('FilmComment: подпись (критерии 7, 8 и 9)', () => {
  it('под текстом стоит подпись владельца (критерий 7)', () => {
    const { container } = render(<FilmComment comment={COMMENT} />);

    expect(textOf(container)).toContain(SIGNATURE);
  });

  it('подпись стоит после текста комментария, а не над ним (критерий 7)', () => {
    const { container } = render(<FilmComment comment={COMMENT} />);
    const text = textOf(container);

    expect(text.indexOf(SIGNATURE)).toBeGreaterThan(text.indexOf(COMMENT));
  });

  // portable 22.09.2026: кейсы про ссылку на блог владельца (имя-ссылка, новая
  // вкладка, rel, единственность ссылки, константы SITE_AUTHOR/AUTHOR_BLOG) снят —
  // адрес личный сайт автора и константа AUTHOR_BLOG были личными и вшитыми, теперь имя
  // и ссылка приходят из site.config.ts (пустые по умолчанию), а поведение подписи
  // в зависимости от конфига проверяет tests/site-config.test.tsx.

  it('подпись видна и без слота действия — то есть гостю (критерий 9)', () => {
    const { container } = render(<FilmComment comment={COMMENT} />);

    expect(textOf(container)).toContain(SIGNATURE);
  });

  it('подпись видна и со слотом действия — то есть владельцу (критерий 9)', () => {
    const { container } = render(
      <FilmComment comment={COMMENT} action={<button type="button">Редактировать</button>} />,
    );

    expect(textOf(container)).toContain(SIGNATURE);
  });
});

describe('FilmComment: разметка гостя (критерий 5)', () => {
  it('без слота действия кнопок в разметке нет вовсе', () => {
    const { container } = render(<FilmComment comment={COMMENT} />);

    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('без слота действия нет и поля ввода', () => {
    const { container } = render(<FilmComment comment={COMMENT} />);

    expect(container.querySelector('textarea')).toBeNull();
    expect(container.querySelector('input')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('слова «Редактировать» в разметке гостя нет', () => {
    const { container } = render(<FilmComment comment={COMMENT} />);

    expect(container.innerHTML).not.toContain('Редактировать');
  });

  it('переданный слот действия отрисовывается', () => {
    render(
      <FilmComment comment={COMMENT} action={<button type="button">Редактировать</button>} />,
    );

    expect(screen.getByRole('button', { name: 'Редактировать' })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Правка на месте

describe('CommentEditor: комментария ещё нет (критерий 10)', () => {
  it('поле ввода стоит раскрытым', () => {
    render(<CommentEditor comment={null} onSave={makeSave(true)} />);

    expect(field()).toBeInTheDocument();
  });

  it('поле пустое', () => {
    render(<CommentEditor comment={null} onSave={makeSave(true)} />);

    expect(openField()).toHaveValue('');
  });

  it('под полем стоит кнопка «Сохранить»', () => {
    render(<CommentEditor comment={null} onSave={makeSave(true)} />);

    expect(saveButton()).toBeInTheDocument();
  });

  it('«Сохранить» недоступна, пока поле пусто', () => {
    render(<CommentEditor comment={null} onSave={makeSave(true)} />);

    expect(isDisabled(saveButton()!)).toBe(true);
  });

  it('«Сохранить» недоступна, если в поле одни пробелы', () => {
    render(<CommentEditor comment={null} onSave={makeSave(true)} />);

    fireEvent.change(openField(), { target: { value: '   \n  ' } });

    expect(isDisabled(saveButton()!)).toBe(true);
  });

  it('с непустым текстом «Сохранить» становится доступной', () => {
    render(<CommentEditor comment={null} onSave={makeSave(true)} />);

    fireEvent.change(openField(), { target: { value: 'Первое слово' } });

    expect(isDisabled(saveButton()!)).toBe(false);
  });

  it('кнопки «Отмена» здесь нет: отменять нечего', () => {
    render(<CommentEditor comment={null} onSave={makeSave(true)} />);

    expect(cancelButton()).toBeNull();
  });

  it('кнопки «Редактировать» здесь нет: поле и так открыто', () => {
    render(<CommentEditor comment={null} onSave={makeSave(true)} />);

    expect(editButton()).toBeNull();
  });

  it('пустой комментарий строкой — то же самое, что null: поле открыто', () => {
    render(<CommentEditor comment="" onSave={makeSave(true)} />);

    expect(field()).toBeInTheDocument();
    expect(editButton()).toBeNull();
  });

  it('комментарий из одних пробелов открывает поле, а не готовый вид', () => {
    render(<CommentEditor comment="   " onSave={makeSave(true)} />);

    expect(field()).toBeInTheDocument();
    expect(editButton()).toBeNull();
  });

  it('набранный текст уходит в onSave как есть', async () => {
    const onSave = makeSave(true);
    render(<CommentEditor comment={null} onSave={onSave} />);

    fireEvent.change(openField(), { target: { value: 'Первая заметка' } });
    fireEvent.click(saveButton()!);

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('Первая заметка'));
  });
});

describe('CommentEditor: комментарий есть (критерий 11)', () => {
  it('показан готовый вид с текстом', () => {
    const { container } = render(<CommentEditor comment={COMMENT} onSave={makeSave(true)} />);

    expect(textOf(container)).toContain(COMMENT);
  });

  it('под подписью стоит кнопка «Редактировать»', () => {
    render(<CommentEditor comment={COMMENT} onSave={makeSave(true)} />);

    expect(editButton()).toBeInTheDocument();
  });

  it('поля ввода в разметке нет', () => {
    const { container } = render(<CommentEditor comment={COMMENT} onSave={makeSave(true)} />);

    expect(field()).toBeNull();
    expect(container.querySelector('textarea')).toBeNull();
  });

  it('кнопок «Сохранить» и «Отмена» в готовом виде нет', () => {
    render(<CommentEditor comment={COMMENT} onSave={makeSave(true)} />);

    expect(saveButton()).toBeNull();
    expect(cancelButton()).toBeNull();
  });

  // portable 22.09.2026: проверка ссылки на блог снята вместе с остальными кейсами
  // про личный сайт автора — от исходного критерия остаётся то, что подпись у готового вида
  // та же, что у гостя.
  it('готовый вид несёт ту же подпись, что у гостя (критерий 9)', () => {
    const { container } = render(<CommentEditor comment={COMMENT} onSave={makeSave(true)} />);

    expect(textOf(container)).toContain(SIGNATURE);
  });
});

describe('CommentEditor: переход в правку (критерий 12)', () => {
  it('щелчок по «Редактировать» открывает поле', () => {
    render(<CommentEditor comment={COMMENT} onSave={makeSave(true)} />);

    fireEvent.click(editButton()!);

    expect(field()).toBeInTheDocument();
  });

  it('в поле стоит текущий текст', () => {
    render(<CommentEditor comment={COMMENT} onSave={makeSave(true)} />);

    fireEvent.click(editButton()!);

    expect(openField()).toHaveValue(COMMENT);
  });

  it('под полем стоят «Сохранить» и «Отмена»', () => {
    render(<CommentEditor comment={COMMENT} onSave={makeSave(true)} />);

    fireEvent.click(editButton()!);

    expect(saveButton()).toBeInTheDocument();
    expect(cancelButton()).toBeInTheDocument();
  });

  it('кнопки «Редактировать» в режиме правки больше нет', () => {
    render(<CommentEditor comment={COMMENT} onSave={makeSave(true)} />);

    fireEvent.click(editButton()!);

    expect(editButton()).toBeNull();
  });

  it('«Сохранить» доступна сразу: текст в поле непустой', () => {
    render(<CommentEditor comment={COMMENT} onSave={makeSave(true)} />);

    fireEvent.click(editButton()!);

    expect(isDisabled(saveButton()!)).toBe(false);
  });

  // План, раздел 4: фокус ставится в поле. Иначе после щелчка по «Редактировать»
  // пришлось бы вторым движением щёлкать в само поле — а больше в этот момент делать
  // в нём нечего.
  it('фокус переходит в поле', () => {
    render(<CommentEditor comment={COMMENT} onSave={makeSave(true)} />);

    fireEvent.click(editButton()!);

    expect(document.activeElement).toBe(openField());
  });

  it('сохранения при одном открытии поля не происходит', () => {
    const onSave = makeSave(true);
    render(<CommentEditor comment={COMMENT} onSave={onSave} />);

    fireEvent.click(editButton()!);

    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('CommentEditor: сохранение (критерий 13)', () => {
  it('«Сохранить» отдаёт набранный текст', async () => {
    const onSave = makeSave(true);
    render(<CommentEditor comment={COMMENT} onSave={onSave} />);

    fireEvent.click(editButton()!);
    fireEvent.change(openField(), { target: { value: 'Пересмотрел и передумал' } });
    fireEvent.click(saveButton()!);

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith('Пересмотрел и передумал');
  });

  it('после успеха поле правки закрывается', async () => {
    render(<CommentEditor comment={COMMENT} onSave={makeSave(true)} />);

    fireEvent.click(editButton()!);
    fireEvent.change(openField(), { target: { value: 'Пересмотрел и передумал' } });
    fireEvent.click(saveButton()!);

    await waitFor(() => expect(field()).toBeNull());
  });

  it('после успеха снова показан готовый вид с кнопкой «Редактировать»', async () => {
    render(<CommentEditor comment={COMMENT} onSave={makeSave(true)} />);

    fireEvent.click(editButton()!);
    fireEvent.change(openField(), { target: { value: 'Пересмотрел и передумал' } });
    fireEvent.click(saveButton()!);

    await waitFor(() => expect(editButton()).toBeInTheDocument());
  });

  it('готовый вид показывает текст, пришедший сверху после сохранения', async () => {
    const onSave = makeSave(true);
    const { rerender, container } = render(<CommentEditor comment={COMMENT} onSave={onSave} />);

    fireEvent.click(editButton()!);
    fireEvent.change(openField(), { target: { value: 'Пересмотрел и передумал' } });
    fireEvent.click(saveButton()!);
    await waitFor(() => expect(field()).toBeNull());

    rerender(<CommentEditor comment="Пересмотрел и передумал" onSave={onSave} />);

    expect(textOf(container)).toContain('Пересмотрел и передумал');
  });
});

describe('CommentEditor: отмена (критерий 14)', () => {
  it('«Отмена» возвращает готовый вид', () => {
    render(<CommentEditor comment={COMMENT} onSave={makeSave(true)} />);

    fireEvent.click(editButton()!);
    fireEvent.change(openField(), { target: { value: 'черновик, который не доедет' } });
    fireEvent.click(cancelButton()!);

    expect(field()).toBeNull();
    expect(editButton()).toBeInTheDocument();
  });

  it('в готовом виде стоит прежний текст', () => {
    const { container } = render(<CommentEditor comment={COMMENT} onSave={makeSave(true)} />);

    fireEvent.click(editButton()!);
    fireEvent.change(openField(), { target: { value: 'черновик, который не доедет' } });
    fireEvent.click(cancelButton()!);

    expect(textOf(container)).toContain(COMMENT);
    expect(textOf(container)).not.toContain('черновик, который не доедет');
  });

  it('набранное не сохраняется', () => {
    const onSave = makeSave(true);
    render(<CommentEditor comment={COMMENT} onSave={onSave} />);

    fireEvent.click(editButton()!);
    fireEvent.change(openField(), { target: { value: 'черновик, который не доедет' } });
    fireEvent.click(cancelButton()!);

    expect(onSave).not.toHaveBeenCalled();
  });

  it('набранное теряется: следующее открытие поля показывает прежний текст', () => {
    render(<CommentEditor comment={COMMENT} onSave={makeSave(true)} />);

    fireEvent.click(editButton()!);
    fireEvent.change(openField(), { target: { value: 'черновик, который не доедет' } });
    fireEvent.click(cancelButton()!);
    fireEvent.click(editButton()!);

    expect(openField()).toHaveValue(COMMENT);
  });
});

describe('CommentEditor: снятие комментария (критерий 15)', () => {
  it('при существующем комментарии «Сохранить» доступна и с пустым полем', () => {
    render(<CommentEditor comment={COMMENT} onSave={makeSave(true)} />);

    fireEvent.click(editButton()!);
    fireEvent.change(openField(), { target: { value: '' } });

    expect(isDisabled(saveButton()!)).toBe(false);
  });

  it('пустое поле уходит в onSave — это и есть снятие', async () => {
    const onSave = makeSave(true);
    render(<CommentEditor comment={COMMENT} onSave={onSave} />);

    fireEvent.click(editButton()!);
    fireEvent.change(openField(), { target: { value: '' } });
    fireEvent.click(saveButton()!);

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(''));
  });

  it('поле из одних пробелов тоже снимает комментарий', async () => {
    const onSave = makeSave(true);
    render(<CommentEditor comment={COMMENT} onSave={onSave} />);

    fireEvent.click(editButton()!);
    fireEvent.change(openField(), { target: { value: '   ' } });

    expect(isDisabled(saveButton()!)).toBe(false);

    fireEvent.click(saveButton()!);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  });

  it('после снятия блок возвращается к раскрытому пустому полю', async () => {
    const onSave = makeSave(true);
    const { rerender } = render(<CommentEditor comment={COMMENT} onSave={onSave} />);

    fireEvent.click(editButton()!);
    fireEvent.change(openField(), { target: { value: '' } });
    fireEvent.click(saveButton()!);
    await waitFor(() => expect(onSave).toHaveBeenCalled());

    rerender(<CommentEditor comment={null} onSave={onSave} />);

    expect(field()).toBeInTheDocument();
    expect(openField()).toHaveValue('');
    expect(editButton()).toBeNull();
  });

  it('отдельной кнопки «Удалить» у блока нет', () => {
    render(<CommentEditor comment={COMMENT} onSave={makeSave(true)} />);

    fireEvent.click(editButton()!);

    expect(screen.queryByRole('button', { name: /удалить|убрать|стереть/i })).toBeNull();
  });
});

describe('CommentEditor: клавиатура (критерий 16)', () => {
  it('Escape равнозначен «Отмене»: поле закрывается', () => {
    render(<CommentEditor comment={COMMENT} onSave={makeSave(true)} />);

    fireEvent.click(editButton()!);
    fireEvent.change(openField(), { target: { value: 'черновик' } });
    fireEvent.keyDown(openField(), { key: 'Escape' });

    expect(field()).toBeNull();
    expect(editButton()).toBeInTheDocument();
  });

  it('Escape ничего не сохраняет', () => {
    const onSave = makeSave(true);
    render(<CommentEditor comment={COMMENT} onSave={onSave} />);

    fireEvent.click(editButton()!);
    fireEvent.change(openField(), { target: { value: 'черновик' } });
    fireEvent.keyDown(openField(), { key: 'Escape' });

    expect(onSave).not.toHaveBeenCalled();
  });

  it('⌘ + Enter сохраняет', async () => {
    const onSave = makeSave(true);
    render(<CommentEditor comment={COMMENT} onSave={onSave} />);

    fireEvent.click(editButton()!);
    fireEvent.change(openField(), { target: { value: 'сохрани с клавиатуры' } });
    fireEvent.keyDown(openField(), { key: 'Enter', metaKey: true });

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('сохрани с клавиатуры'));
  });

  it('Ctrl + Enter сохраняет', async () => {
    const onSave = makeSave(true);
    render(<CommentEditor comment={COMMENT} onSave={onSave} />);

    fireEvent.click(editButton()!);
    fireEvent.change(openField(), { target: { value: 'сохрани с клавиатуры' } });
    fireEvent.keyDown(openField(), { key: 'Enter', ctrlKey: true });

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('сохрани с клавиатуры'));
  });

  // Текст в несколько абзацев набирается с Enter, поэтому одиночный Enter сохранять
  // не может — иначе первый же абзац закрыл бы поле.
  it('одиночный Enter не сохраняет и поля не закрывает', () => {
    const onSave = makeSave(true);
    render(<CommentEditor comment={COMMENT} onSave={onSave} />);

    fireEvent.click(editButton()!);
    fireEvent.change(openField(), { target: { value: 'первый абзац' } });
    fireEvent.keyDown(openField(), { key: 'Enter' });

    expect(onSave).not.toHaveBeenCalled();
    expect(field()).toBeInTheDocument();
  });

  it('⌘ + Enter в поле у фильма без комментария тоже сохраняет', async () => {
    const onSave = makeSave(true);
    render(<CommentEditor comment={null} onSave={onSave} />);

    fireEvent.change(openField(), { target: { value: 'первая заметка' } });
    fireEvent.keyDown(openField(), { key: 'Enter', metaKey: true });

    await waitFor(() => expect(onSave).toHaveBeenCalledWith('первая заметка'));
  });
});

describe('CommentEditor: отказ сервера (критерий 17)', () => {
  it('поле правки остаётся открытым', async () => {
    const onSave = makeSave(false);
    render(<CommentEditor comment={COMMENT} onSave={onSave} />);

    fireEvent.click(editButton()!);
    fireEvent.change(openField(), { target: { value: 'набранное, которое жалко' } });
    fireEvent.click(saveButton()!);

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(field()).toBeInTheDocument();
  });

  it('набранное остаётся в поле', async () => {
    const onSave = makeSave(false);
    render(<CommentEditor comment={COMMENT} onSave={onSave} />);

    fireEvent.click(editButton()!);
    fireEvent.change(openField(), { target: { value: 'набранное, которое жалко' } });
    fireEvent.click(saveButton()!);

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(openField()).toHaveValue('набранное, которое жалко');
  });

  it('готовый вид при отказе не подменяет набранное прежним текстом', async () => {
    const onSave = makeSave(false);
    render(<CommentEditor comment={COMMENT} onSave={onSave} />);

    fireEvent.click(editButton()!);
    fireEvent.change(openField(), { target: { value: 'набранное, которое жалко' } });
    fireEvent.click(saveButton()!);

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(editButton()).toBeNull();
  });

  it('повторная попытка возможна: второй щелчок снова зовёт сохранение', async () => {
    const onSave = vi.fn<(text: string) => Promise<boolean>>();
    onSave.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    render(<CommentEditor comment={COMMENT} onSave={onSave} />);

    fireEvent.click(editButton()!);
    fireEvent.change(openField(), { target: { value: 'набранное, которое жалко' } });
    fireEvent.click(saveButton()!);
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    fireEvent.click(saveButton()!);

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(field()).toBeNull());
  });
});
