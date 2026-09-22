// Критерии приёмки 11–15 и 17 на уровне интерфейса карточки фильма:
// 11 — клик по значению шкалы 1–10 сохраняет оценку, повторный клик по текущему значению снимает её;
// 12 — переключатели «посмотрел» и звёздочки вкуса сохраняются по клику;
// 13 — после успешного сохранения серверная часть страницы перерисовывается (router.refresh),
//      чтобы статус и принадлежность табам обновились;
// ~~14 — комментарий сохраняется при уходе фокуса и только если текст изменился;~~
//      Отменено 31.08.2026 спекой v14, раздел C: поле с автосохранением по `blur` уступило
//      место блоку с двумя видами — готовым и правкой. Сохранение теперь происходит по явной
//      кнопке «Сохранить», а не по уходу фокуса, и подтверждается перерисовкой блока.
//      Это решение владельца, а не регрессия: комментарий стал виден читателю, и «сохранилось
//      само, когда я кликнул мимо» перестало быть безобидным;
// 15 — для фильма со статусом «ждём» отметка «посмотрел» недоступна, показано пояснение с датой выхода;
// 17 — при неудаче показывается сообщение об ошибке, а поле возвращается к прежнему значению;
// 20 — звёздочка вкуса доступна и фильму со статусом «ждём»: статуса она не меняет;
// 21 — для фильма со статусом «ждём» недоступна и шкала оценки.
//
// Дополнение v5, критерии приёмки 9, 10 и 11: рядом с галочкой «Посмотрел» встаёт вторая —
// «Хочу посмотреть». Она ставится и снимается свободно, в любом статусе, у вышедшего
// и невышедшего тайтла, и сохраняется тем же способом, что остальные личные поля.
//
// Правка v5 от 23.08.2026, критерии 21–23: галочки взаимоисключающи, но приведение полей
// делает сервер, а не интерфейс. Контракт компонента от этого не меняется — он и прежде
// переключал ровно одно поле, — и здесь проверяется именно это: щелчок шлёт патч с одним
// полем (противоречивый патч сервер бы отклонил), а показывает компонент то, что вернул
// сервер. Обе галочки при этом остаются доступными: интерфейс ничего не запрещает.
//
// Контракт компонента, зафиксированный этими тестами (спека и план его не детализируют):
//   <PersonalFields film={film} today={string} />, default export
//   из '@/components/PersonalFields'; сохранение идёт через
//   updatePersonalAction(film.id, patch) из '@/app/actions'.
// Даты в тестах заведомо давние ('2001-04-11') или заведомо будущие ('2999-01-01') —
// результат не зависит от того, какой сегодня день.
//
// Проп `today` добавлен 15.09.2026 (рефакторинг, находка 15): секция объявлена
// `'use client'` и до этой правки вызывала `todayIso()` внутри себя. Правило обратного
// записано и обосновано в `DossierSection.tsx` — «сегодня», посчитанное в клиентском
// компоненте, даёт расхождение гидратации около полуночи и зависимость от часового
// пояса клиента, — и `DossierZone` ему следует. Теперь дату считает страница фильма
// на сервере и передаёт обоим одну и ту же.
//
// Дополнение v14 (31.08.2026), критерии приёмки 3, 10, 13, 15 и 17 — комментарий уходит
// из секции полем и возвращается в неё блоком:
//  3 — блок стоит последним в секции «Моё», после звёздочки вкуса;
// 10 — у фильма без комментария поле раскрыто, «Сохранить» недоступна на пустом;
// 13 — «Сохранить» идёт через тот же `updatePersonalAction` с полем `comment`, и после
//      успеха блок показывает новый текст — тот самый, который увидит читатель;
// 15 — сохранение пустого поля снимает комментарий, и блок возвращается к полю;
// 17 — при отказе поле правки остаётся открытым и набранное в нём цело.
//
// Здесь проверяется шов между секцией и блоком: что путь записи один и тот же и что
// исход сохранения доезжает до редактора. Собственное поведение редактора — переходы
// между видами, клавиатура, доступность кнопок — живёт в tests/film-comment.test.tsx.
//
// Дополнение v13 (31.08.2026), критерий приёмки 30: знак выбранной ступени отделяется
// от заливки. У прежней рампы выбор читался заливкой — невыбранные ступени стояли на
// hairline-контуре, выбранная заливалась чернилами; на светлой рампе так больше нельзя:
// выбранная единица залита бумагой и от невыбранной не отличалась бы. Теперь выбранная
// ступень несёт чернильный контур (ratingPickStyle), невыбранная — hairline.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import PersonalFields from '@/components/PersonalFields';
import { ratingPickStyle, ratingStyle } from '@/components/plaques';
import { updatePersonalAction } from '@/app/actions';
import { makeFilm } from './helpers';
import type { Film } from '@/db/schema';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock('@/app/actions', () => ({
  updatePersonalAction: vi.fn(),
}));

const action = vi.mocked(updatePersonalAction);

const RELEASED = '2001-04-11';
const NOT_RELEASED = '2999-01-01';

/** «Сегодня» приходит пропом со страницы фильма, а не из системных часов. */
const TODAY = '2026-09-15';

function releasedFilm(overrides: Partial<Film> = {}): Film {
  return makeFilm({ id: 1, titleRu: 'Фильм', releaseDate: RELEASED, ...overrides });
}

/** Экшен отвечает успехом, возвращая фильм с применённым патчем. */
function respondOk(film: Film, patch: Partial<Film> = {}) {
  action.mockResolvedValue({ ok: true, film: { ...film, ...patch } });
}

function respondFail(error: string) {
  action.mockResolvedValue({ ok: false, error });
}

/** Кнопка шкалы оценок: имя может быть как «7», так и «Оценка 7» — но не «10» для семёрки. */
function ratingButton(value: number): HTMLElement {
  const pattern = new RegExp(`(^|\\D)${value}($|\\D)`);
  const found = screen.getAllByRole('button', { name: pattern });
  expect(found.length).toBeGreaterThan(0);
  return found[0];
}

/** Все кнопки шкалы 1–10, какие нашлись; служебные переключатели отфильтрованы.
 *  Пустой массив означает, что шкалы на странице нет вовсе. */
function ratingButtons(): HTMLElement[] {
  const found = new Set<HTMLElement>();
  for (let value = 1; value <= 10; value += 1) {
    const pattern = new RegExp(`(^|\\D)${value}($|\\D)`);
    for (const element of screen.queryAllByRole('button', { name: pattern })) {
      const name = element.getAttribute('aria-label') ?? element.textContent ?? '';
      if (/посмотрел|зв[её]зд/i.test(name)) continue;
      found.add(element);
    }
  }
  return [...found];
}

/** Отмеченность контрола — как её видит экранный диктор: у флажка это `checked`,
 *  у переключателя и кнопки — aria-checked или aria-pressed. */
function isChecked(element: HTMLElement): boolean {
  if (element instanceof HTMLInputElement) return element.checked;
  return (
    element.getAttribute('aria-checked') === 'true' ||
    element.getAttribute('aria-pressed') === 'true'
  );
}

/** Выбранное значение шкалы оценок или null, если шкала пуста. */
function selectedRating(): number | null {
  for (const button of ratingButtons()) {
    if (!isChecked(button)) continue;
    const name = button.getAttribute('aria-label') ?? button.textContent ?? '';
    const digits = name.match(/\d+/);
    if (digits) return Number(digits[0]);
  }
  return null;
}

/** Контрол недоступен, если он отключён атрибутом или помечен aria-disabled. */
function isDisabled(element: HTMLElement): boolean {
  return element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true';
}

/** Переключатель — что бы это ни было: switch, checkbox или кнопка с нужным именем. */
function findControl(name: RegExp): HTMLElement | null {
  for (const role of ['switch', 'checkbox', 'button'] as const) {
    const found = screen.queryAllByRole(role, { name });
    if (found.length > 0) return found[0];
  }
  return null;
}

function watchedControl(): HTMLElement | null {
  return findControl(/^посмотрел$/i);
}

/** Вторая галочка: «Хочу посмотреть». Отличается от «Посмотрел» словом целиком,
 *  поэтому ищется по своему имени, а не по общему корню. */
function wantToWatchControl(): HTMLElement | null {
  return findControl(/хочу посмотреть/i);
}

function tasteStarControl(): HTMLElement | null {
  return findControl(/зв[её]зд/i);
}

function commentField(): HTMLTextAreaElement | HTMLInputElement {
  return screen.getByRole('textbox') as HTMLTextAreaElement;
}

/** Поле правки комментария, если оно открыто. С v14 у блока два вида, и у фильма
 *  с комментарием поля в разметке нет вовсе — есть кнопка «Редактировать». */
function queryCommentField(): HTMLTextAreaElement | null {
  return screen.queryByRole('textbox') as HTMLTextAreaElement | null;
}

const editButton = () => screen.queryByRole('button', { name: /Редактировать/i });
const saveButton = () => screen.queryByRole('button', { name: /Сохранить/i });
const cancelButton = () => screen.queryByRole('button', { name: /Отмена/i });

/** Готовый вид блока опознаётся по подписи под комментарием — больше нигде в секции
 *  «Моё» она не стоит. portable 22.09.2026: имя владельца — личное поле site.config.ts,
 *  пустое по умолчанию, поэтому подпись — текст-заглушка «Владелец базы», а не ссылка. */
function commentSignature(): HTMLElement | null {
  return screen.queryByText('Владелец базы');
}

/** Порядок элемента в разметке: чем меньше число, тем выше по документу. */
function documentOrder(container: HTMLElement, element: Element): number {
  return [...container.querySelectorAll('*')].indexOf(element);
}

beforeEach(() => {
  action.mockReset();
  refresh.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('шкала «моя оценка»', () => {
  it('клик по значению шкалы сохраняет эту оценку', async () => {
    const film = releasedFilm({ myRating: null });
    respondOk(film, { myRating: 7 });
    render(<PersonalFields film={film} today={TODAY} />);

    fireEvent.click(ratingButton(7));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action).toHaveBeenCalledWith(film.id, expect.objectContaining({ myRating: 7 }));
  });

  it('крайние значения шкалы — 1 и 10 — тоже сохраняются', async () => {
    const film = releasedFilm({ myRating: null });
    respondOk(film, { myRating: 1 });
    render(<PersonalFields film={film} today={TODAY} />);

    fireEvent.click(ratingButton(1));
    await waitFor(() =>
      expect(action).toHaveBeenCalledWith(film.id, expect.objectContaining({ myRating: 1 })),
    );

    respondOk(film, { myRating: 10 });
    fireEvent.click(ratingButton(10));
    await waitFor(() =>
      expect(action).toHaveBeenCalledWith(film.id, expect.objectContaining({ myRating: 10 })),
    );
  });

  it('повторный клик по текущему значению снимает оценку', async () => {
    const film = releasedFilm({ myRating: 7 });
    respondOk(film, { myRating: null });
    render(<PersonalFields film={film} today={TODAY} />);

    fireEvent.click(ratingButton(7));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action).toHaveBeenCalledWith(film.id, expect.objectContaining({ myRating: null }));
  });

  it('клик по другому значению меняет оценку, а не снимает её', async () => {
    const film = releasedFilm({ myRating: 7 });
    respondOk(film, { myRating: 4 });
    render(<PersonalFields film={film} today={TODAY} />);

    fireEvent.click(ratingButton(4));

    await waitFor(() =>
      expect(action).toHaveBeenCalledWith(film.id, expect.objectContaining({ myRating: 4 })),
    );
  });

  it('после неудачи оценка возвращается к прежней: повторный клик по ней снова снимает её', async () => {
    const film = releasedFilm({ myRating: 5 });
    respondFail('Не удалось сохранить');
    render(<PersonalFields film={film} today={TODAY} />);

    fireEvent.click(ratingButton(8));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));

    // Откат: текущей осталась пятёрка, поэтому клик по ней трактуется как снятие оценки.
    respondOk(film, { myRating: null });
    fireEvent.click(ratingButton(5));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    expect(action).toHaveBeenLastCalledWith(film.id, expect.objectContaining({ myRating: null }));
  });
});

describe('переключатели «посмотрел» и «звёздочка вкуса»', () => {
  it('клик по «посмотрел» сохраняет отметку', async () => {
    const film = releasedFilm({ watched: false });
    respondOk(film, { watched: true });
    render(<PersonalFields film={film} today={TODAY} />);

    const control = watchedControl();
    expect(control).not.toBeNull();
    fireEvent.click(control!);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action).toHaveBeenCalledWith(film.id, expect.objectContaining({ watched: true }));
  });

  it('повторный клик по «посмотрел» снимает отметку', async () => {
    const film = releasedFilm({ watched: true });
    respondOk(film, { watched: false });
    render(<PersonalFields film={film} today={TODAY} />);

    fireEvent.click(watchedControl()!);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action).toHaveBeenCalledWith(film.id, expect.objectContaining({ watched: false }));
  });

  it('клик по звёздочке вкуса сохраняет её', async () => {
    const film = releasedFilm({ tasteStar: false });
    respondOk(film, { tasteStar: true });
    render(<PersonalFields film={film} today={TODAY} />);

    const star = tasteStarControl();
    expect(star).not.toBeNull();
    fireEvent.click(star!);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action).toHaveBeenCalledWith(film.id, expect.objectContaining({ tasteStar: true }));
  });

  it('повторный клик снимает звёздочку вкуса', async () => {
    const film = releasedFilm({ tasteStar: true });
    respondOk(film, { tasteStar: false });
    render(<PersonalFields film={film} today={TODAY} />);

    fireEvent.click(tasteStarControl()!);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action).toHaveBeenCalledWith(film.id, expect.objectContaining({ tasteStar: false }));
  });
});

// Критерии приёмки 9, 10 и 11: явный признак намерения.
describe('галочка «хочу посмотреть»', () => {
  it('на странице фильма она есть', () => {
    render(<PersonalFields film={releasedFilm()} today={TODAY} />);

    expect(wantToWatchControl()).not.toBeNull();
  });

  it('клик сохраняет отметку', async () => {
    const film = releasedFilm({ wantToWatch: false });
    respondOk(film, { wantToWatch: true });
    render(<PersonalFields film={film} today={TODAY} />);

    fireEvent.click(wantToWatchControl()!);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action).toHaveBeenCalledWith(film.id, expect.objectContaining({ wantToWatch: true }));
  });

  it('повторный клик снимает отметку', async () => {
    const film = releasedFilm({ wantToWatch: true });
    respondOk(film, { wantToWatch: false });
    render(<PersonalFields film={film} today={TODAY} />);

    fireEvent.click(wantToWatchControl()!);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action).toHaveBeenCalledWith(film.id, expect.objectContaining({ wantToWatch: false }));
  });

  it('после сохранения появляется тот же штамп «Сохранено»', async () => {
    const film = releasedFilm({ wantToWatch: false });
    respondOk(film, { wantToWatch: true });
    render(<PersonalFields film={film} today={TODAY} />);

    fireEvent.click(wantToWatchControl()!);

    expect(await screen.findByText(/сохранено/i)).toBeInTheDocument();
  });

  it('галочка доступна невышедшему тайтлу — намерение можно заявить заранее', () => {
    const film = releasedFilm({ releaseDate: NOT_RELEASED, wantToWatch: false });
    render(<PersonalFields film={film} today={TODAY} />);

    const control = wantToWatchControl();
    expect(control).not.toBeNull();
    expect(isDisabled(control!)).toBe(false);
  });

  it('клик по галочке невышедшего тайтла сохраняется', async () => {
    const film = releasedFilm({ releaseDate: NOT_RELEASED, wantToWatch: false });
    respondOk(film, { wantToWatch: true });
    render(<PersonalFields film={film} today={TODAY} />);

    fireEvent.click(wantToWatchControl()!);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action).toHaveBeenCalledWith(film.id, expect.objectContaining({ wantToWatch: true }));
  });

  it('галочка доступна и просмотренному тайтлу — интерфейс ничего не запрещает', () => {
    const film = releasedFilm({ watched: true, wantToWatch: false });
    render(<PersonalFields film={film} today={TODAY} />);

    const control = wantToWatchControl();
    expect(control).not.toBeNull();
    expect(isDisabled(control!)).toBe(false);
  });

  it('патч несёт только «хочу посмотреть» — остальные поля приводит сервер', async () => {
    const film = releasedFilm({ watched: true, wantToWatch: false });
    respondOk(film, { wantToWatch: true });
    render(<PersonalFields film={film} today={TODAY} />);

    fireEvent.click(wantToWatchControl()!);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action).toHaveBeenCalledWith(film.id, { wantToWatch: true });
  });
});

// Правка v5 от 23.08.2026, критерии приёмки 21–23 и 25 на уровне интерфейса.
// Приведение полей — дело сервера, поэтому здесь проверяются две вещи: что компонент
// отправляет ровно одно поле (противоречивый патч сервер отклонил бы по критерию 24)
// и что показывает он результат, который вернул сервер, а не своё представление о нём.
describe('взаимоисключающие отметки', () => {
  it('щелчок по «хочу посмотреть» у просмотренного фильма с оценкой шлёт ровно один патч (критерий 21)', async () => {
    const film = releasedFilm({ watched: true, wantToWatch: false, myRating: 7 });
    respondOk(film, { watched: false, wantToWatch: true, myRating: null });
    render(<PersonalFields film={film} today={TODAY} />);

    fireEvent.click(wantToWatchControl()!);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action).toHaveBeenCalledWith(film.id, { wantToWatch: true });
  });

  it('после ответа сервера шкала оценки пуста, а «посмотрел» снят (критерий 21)', async () => {
    const film = releasedFilm({ watched: true, wantToWatch: false, myRating: 7 });
    respondOk(film, { watched: false, wantToWatch: true, myRating: null });
    render(<PersonalFields film={film} today={TODAY} />);

    expect(selectedRating()).toBe(7);

    fireEvent.click(wantToWatchControl()!);

    await waitFor(() => expect(selectedRating()).toBeNull());
    expect(isChecked(watchedControl()!)).toBe(false);
    expect(isChecked(wantToWatchControl()!)).toBe(true);
  });

  it('щелчок по «посмотрел» у фильма с намерением шлёт ровно один патч (критерий 22)', async () => {
    const film = releasedFilm({ watched: false, wantToWatch: true });
    respondOk(film, { watched: true, wantToWatch: false });
    render(<PersonalFields film={film} today={TODAY} />);

    fireEvent.click(watchedControl()!);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action).toHaveBeenCalledWith(film.id, { watched: true });
    await waitFor(() => expect(isChecked(wantToWatchControl()!)).toBe(false));
  });

  it('щелчок по шкале у фильма с намерением шлёт ровно один патч (критерий 22)', async () => {
    const film = releasedFilm({ watched: false, wantToWatch: true, myRating: null });
    respondOk(film, { watched: true, wantToWatch: false, myRating: 8 });
    render(<PersonalFields film={film} today={TODAY} />);

    fireEvent.click(ratingButton(8));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action).toHaveBeenCalledWith(film.id, { myRating: 8 });
    await waitFor(() => expect(isChecked(wantToWatchControl()!)).toBe(false));
  });

  it('щелчок по снятию «посмотрел» у фильма с оценкой шлёт ровно один патч (критерий 25)', async () => {
    const film = releasedFilm({ watched: true, wantToWatch: false, myRating: 9 });
    respondOk(film, { watched: false, myRating: null });
    render(<PersonalFields film={film} today={TODAY} />);

    fireEvent.click(watchedControl()!);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action).toHaveBeenCalledWith(film.id, { watched: false });
  });

  it('после снятия «посмотрел» шкала оценки пуста (критерий 25)', async () => {
    const film = releasedFilm({ watched: true, wantToWatch: false, myRating: 9 });
    respondOk(film, { watched: false, myRating: null });
    render(<PersonalFields film={film} today={TODAY} />);

    expect(selectedRating()).toBe(9);

    fireEvent.click(watchedControl()!);

    await waitFor(() => expect(selectedRating()).toBeNull());
    expect(isChecked(watchedControl()!)).toBe(false);
    expect(isChecked(wantToWatchControl()!)).toBe(false);
  });

  it('обе галочки доступны и у фильма с намерением: запретов интерфейс не ставит (критерий 23)', () => {
    const film = releasedFilm({ watched: false, wantToWatch: true });
    render(<PersonalFields film={film} today={TODAY} />);

    expect(isDisabled(watchedControl()!)).toBe(false);
    expect(isDisabled(wantToWatchControl()!)).toBe(false);
  });
});

// Правка 31.08.2026 по спеке v14, раздел C. Прежняя редакция этого блока проверяла поле
// с автосохранением:
// ~~«сохраняется при уходе фокуса, если текст изменился»; «пустой комментарий тоже
// сохраняется — это удаление заметки»; «уход фокуса без изменения текста ничего
// не сохраняет»; «уход фокуса из пустого нетронутого поля ничего не сохраняет».~~
// Автосохранения по `blur` больше нет: комментарий стал виден читателю, и публикация
// по случайному щелчку мимо поля перестала быть безобидной. Сохранение идёт по кнопке,
// путь записи при этом прежний и единственный — `updatePersonalAction`.
describe('комментарий: блок вместо поля (критерии 10, 13, 15 и 17)', () => {
  it('у фильма без комментария поле раскрыто и пустое (критерий 10)', () => {
    render(<PersonalFields film={releasedFilm({ comment: null })} today={TODAY} />);

    expect(queryCommentField()).not.toBeNull();
    expect(queryCommentField()).toHaveValue('');
  });

  it('у фильма без комментария «Сохранить» недоступна на пустом поле (критерий 10)', () => {
    render(<PersonalFields film={releasedFilm({ comment: null })} today={TODAY} />);

    expect(saveButton()).not.toBeNull();
    expect(isDisabled(saveButton()!)).toBe(true);
  });

  it('у фильма с комментарием поля ввода нет, есть «Редактировать» (критерий 11)', () => {
    render(<PersonalFields film={releasedFilm({ comment: 'старая заметка' })} today={TODAY} />);

    expect(queryCommentField()).toBeNull();
    expect(editButton()).not.toBeNull();
    expect(commentSignature()).not.toBeNull();
  });

  it('сохранение идёт через updatePersonalAction с полем comment (критерий 13)', async () => {
    const film = releasedFilm({ comment: 'старая заметка' });
    respondOk(film, { comment: 'новая заметка' });
    render(<PersonalFields film={film} today={TODAY} />);

    fireEvent.click(editButton()!);
    fireEvent.change(commentField(), { target: { value: 'новая заметка' } });
    fireEvent.click(saveButton()!);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action).toHaveBeenCalledWith(film.id, { comment: 'новая заметка' });
  });

  it('после успеха блок показывает новый текст и закрывает поле (критерий 13)', async () => {
    const film = releasedFilm({ comment: 'старая заметка' });
    respondOk(film, { comment: 'новая заметка' });
    const { container } = render(<PersonalFields film={film} today={TODAY} />);

    fireEvent.click(editButton()!);
    fireEvent.change(commentField(), { target: { value: 'новая заметка' } });
    fireEvent.click(saveButton()!);

    await waitFor(() => expect(queryCommentField()).toBeNull());
    expect(container.textContent ?? '').toContain('новая заметка');
    expect(container.textContent ?? '').not.toContain('старая заметка');
  });

  it('после успеха ставится общая плашка «Сохранено» (спека, раздел C)', async () => {
    const film = releasedFilm({ comment: 'старая заметка' });
    respondOk(film, { comment: 'новая заметка' });
    render(<PersonalFields film={film} today={TODAY} />);

    fireEvent.click(editButton()!);
    fireEvent.change(commentField(), { target: { value: 'новая заметка' } });
    fireEvent.click(saveButton()!);

    expect(await screen.findByText(/сохранено/i)).toBeInTheDocument();
  });

  it('после успеха серверная часть страницы перерисовывается (критерий 13)', async () => {
    const film = releasedFilm({ comment: 'старая заметка' });
    respondOk(film, { comment: 'новая заметка' });
    render(<PersonalFields film={film} today={TODAY} />);

    fireEvent.click(editButton()!);
    fireEvent.change(commentField(), { target: { value: 'новая заметка' } });
    fireEvent.click(saveButton()!);

    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('первый комментарий сохраняется из раскрытого поля (критерий 10)', async () => {
    const film = releasedFilm({ comment: null });
    respondOk(film, { comment: 'первая заметка' });
    render(<PersonalFields film={film} today={TODAY} />);

    fireEvent.change(commentField(), { target: { value: 'первая заметка' } });
    fireEvent.click(saveButton()!);

    await waitFor(() => expect(action).toHaveBeenCalledWith(film.id, { comment: 'первая заметка' }));
  });

  it('пустое поле снимает комментарий, и блок возвращается к полю (критерий 15)', async () => {
    const film = releasedFilm({ comment: 'было' });
    respondOk(film, { comment: null });
    render(<PersonalFields film={film} today={TODAY} />);

    fireEvent.click(editButton()!);
    fireEvent.change(commentField(), { target: { value: '' } });
    fireEvent.click(saveButton()!);

    await waitFor(() => expect(action).toHaveBeenCalledWith(film.id, { comment: '' }));
    await waitFor(() => expect(queryCommentField()).not.toBeNull());
    expect(editButton()).toBeNull();
    expect(commentSignature()).toBeNull();
  });

  it('«Отмена» ничего не отправляет (критерий 14)', () => {
    render(<PersonalFields film={releasedFilm({ comment: 'было' })} today={TODAY} />);

    fireEvent.click(editButton()!);
    fireEvent.change(commentField(), { target: { value: 'черновик' } });
    fireEvent.click(cancelButton()!);

    expect(action).not.toHaveBeenCalled();
    expect(queryCommentField()).toBeNull();
  });
});

// Критерий приёмки 3: блок стоит последним в личной зоне владельца — после отметок,
// оценки и звёздочки вкуса. Проверяется порядок в разметке, а не отступы: где именно
// проходит hairline-линейка, видно только в браузере.
describe('комментарий: место в секции «Моё» (критерий 3)', () => {
  it('готовый блок стоит после звёздочки вкуса', () => {
    const { container } = render(<PersonalFields film={releasedFilm({ comment: 'заметка' })} today={TODAY} />);

    expect(documentOrder(container, commentSignature()!)).toBeGreaterThan(
      documentOrder(container, tasteStarControl()!),
    );
  });

  it('раскрытое поле правки — тоже после звёздочки вкуса', () => {
    const { container } = render(<PersonalFields film={releasedFilm({ comment: null })} today={TODAY} />);

    expect(documentOrder(container, queryCommentField()!)).toBeGreaterThan(
      documentOrder(container, tasteStarControl()!),
    );
  });

  it('блок стоит после отметок и после шкалы оценки', () => {
    const { container } = render(
      <PersonalFields film={releasedFilm({ comment: 'заметка', myRating: 7, watched: true })} today={TODAY} />,
    );
    const place = documentOrder(container, commentSignature()!);

    expect(place).toBeGreaterThan(documentOrder(container, watchedControl()!));
    expect(place).toBeGreaterThan(documentOrder(container, wantToWatchControl()!));
    for (const button of ratingButtons()) {
      expect(place).toBeGreaterThan(documentOrder(container, button));
    }
  });

  it('блок лежит внутри секции «Моё», а не рядом с ней', () => {
    render(<PersonalFields film={releasedFilm({ comment: 'заметка' })} today={TODAY} />);
    const section = screen.getByRole('heading', { name: 'Моё' }).closest('section');

    expect(section).not.toBeNull();
    expect(section!.contains(commentSignature()!)).toBe(true);
  });
});

describe('индикация сохранения и обработка ошибки', () => {
  it('после успешного сохранения появляется надпись «Сохранено»', async () => {
    const film = releasedFilm({ myRating: null });
    respondOk(film, { myRating: 9 });
    render(<PersonalFields film={film} today={TODAY} />);

    fireEvent.click(ratingButton(9));

    expect(await screen.findByText(/сохранено/i)).toBeInTheDocument();
  });

  it('после успешного сохранения серверная часть страницы перерисовывается', async () => {
    const film = releasedFilm({ watched: false });
    respondOk(film, { watched: true });
    render(<PersonalFields film={film} today={TODAY} />);

    fireEvent.click(watchedControl()!);

    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('при отказе показывается сообщение об ошибке', async () => {
    const film = releasedFilm({ myRating: null });
    respondFail('Оценка должна быть целым числом от 1 до 10');
    render(<PersonalFields film={film} today={TODAY} />);

    fireEvent.click(ratingButton(6));

    expect(
      await screen.findByText(/Оценка должна быть целым числом от 1 до 10/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/сохранено/i)).toBeNull();
  });

  // Правка 31.08.2026 по критерию приёмки 17 версии v14. Прежняя редакция:
  // ~~«при отказе комментарий возвращается к последнему сохранённому значению»: поле
  // затиралось прежним текстом, и набранное пропадало.~~ Для поля с автосохранением
  // по `blur` это было терпимо — терялось несколько слов, набранных мимоходом. Для
  // явной кнопки «Сохранить» это потеря того, что человек только что написал и не
  // отдал: спека требует обратного — поле остаётся открытым, набранное цело.
  it('при отказе поле правки остаётся открытым, набранное цело (критерий 17)', async () => {
    const film = releasedFilm({ comment: 'сохранённый текст' });
    respondFail('Не удалось сохранить комментарий');
    render(<PersonalFields film={film} today={TODAY} />);

    fireEvent.click(editButton()!);
    fireEvent.change(commentField(), { target: { value: 'черновик, который не доехал' } });
    fireEvent.click(saveButton()!);

    expect(await screen.findByText(/Не удалось сохранить комментарий/i)).toBeInTheDocument();
    await waitFor(() => expect(commentField()).toHaveValue('черновик, который не доехал'));
    expect(editButton()).toBeNull();
  });

  it('при отказе ошибка показана тем же красным текстом секции (критерий 17)', async () => {
    const film = releasedFilm({ comment: null });
    respondFail('Сессия истекла, войдите заново, чтобы менять личные поля');
    render(<PersonalFields film={film} today={TODAY} />);

    fireEvent.change(commentField(), { target: { value: 'первая заметка' } });
    fireEvent.click(saveButton()!);

    expect(await screen.findByText(/Сессия истекла/i)).toBeInTheDocument();
    expect(screen.queryByText(/сохранено/i)).toBeNull();
  });
});

describe('фильм со статусом «ждём»', () => {
  // Клик по недоступному переключателю здесь не эмулируем: в jsdom событие click
  // доходит до обработчика даже на disabled-элементе, а в браузере — нет. Спека требует
  // именно недоступности переключателя; отказ сервера проверяется в films-repo.test.ts.
  it('переключатель «посмотрел» недоступен — либо отключён, либо вовсе не показан', () => {
    const film = releasedFilm({ releaseDate: NOT_RELEASED, watched: false });
    render(<PersonalFields film={film} today={TODAY} />);

    const control = watchedControl();
    if (control === null) return;
    expect(isDisabled(control)).toBe(true);
  });

  it('вместо переключателя показано пояснение с датой выхода', () => {
    const film = releasedFilm({ releaseDate: NOT_RELEASED });
    render(<PersonalFields film={film} today={TODAY} />);

    expect(screen.getAllByText(/2999/).length).toBeGreaterThan(0);
  });

  // Исправлено по спеке (раздел «Оценка означает просмотр», критерий 21): прежняя редакция
  // теста кликала по шкале оценки невышедшего фильма и ждала сохранения. Теперь шкала для
  // такого фильма недоступна, и тест проверяет только звёздочку с комментарием.
  it('звёздочку и комментарий невышедшему фильму ставить можно', () => {
    const film = releasedFilm({ releaseDate: NOT_RELEASED, myRating: null });
    render(<PersonalFields film={film} today={TODAY} />);

    expect(tasteStarControl()).not.toBeNull();
    expect(commentField()).toBeInTheDocument();
  });

  // Критерии приёмки 20 и 21 на уровне интерфейса:
  // 21 — шкала оценки недоступна наравне с переключателем «посмотрел»;
  // 20 — звёздочка вкуса, наоборот, доступна: статуса она не меняет.
  // Клик по недоступной кнопке не эмулируем по той же причине, что и выше.
  it('шкала оценки недоступна — её кнопки отключены либо шкалы нет вовсе', () => {
    const film = releasedFilm({ releaseDate: NOT_RELEASED, myRating: null });
    render(<PersonalFields film={film} today={TODAY} />);

    for (const button of ratingButtons()) {
      expect(isDisabled(button)).toBe(true);
    }
  });

  it('переключатель звёздочки вкуса доступен, и клик по нему сохраняет звёздочку', async () => {
    const film = releasedFilm({ releaseDate: NOT_RELEASED, tasteStar: false });
    respondOk(film, { tasteStar: true });
    render(<PersonalFields film={film} today={TODAY} />);

    const star = tasteStarControl();
    expect(star).not.toBeNull();
    expect(isDisabled(star!)).toBe(false);

    fireEvent.click(star!);

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(action).toHaveBeenCalledWith(film.id, expect.objectContaining({ tasteStar: true }));
  });
});

// Критерий приёмки 30 версии v13: выбранная ступень шкалы помечается чернильным контуром.
// Проверяется вычисленный стиль, а не класс: знак выбора и есть стиль, и берётся он из
// общего ratingPickStyle, чтобы карточка, админка и рампа фильтра не разошлись.
describe('шкала «моя оценка»: знак выбора (критерий 30)', () => {
  const outlineOf = (element: HTMLElement): string =>
    element.style.boxShadow || (element.getAttribute('class') ?? '');

  it('выбранная ступень несёт чернильный контур', () => {
    render(<PersonalFields film={releasedFilm({ myRating: 8, watched: true })} today={TODAY} />);

    expect(ratingButton(8).style.boxShadow).toBe(ratingPickStyle(8).boxShadow);
  });

  it('чернильный контур работает по всей шкале, от единицы до десятки', () => {
    for (const value of [1, 5, 10]) {
      const { unmount } = render(
        <PersonalFields film={releasedFilm({ myRating: value, watched: true })} today={TODAY} />,
      );

      expect(ratingButton(value).style.boxShadow, `ступень ${value}`).toBe(
        ratingPickStyle(value).boxShadow,
      );
      unmount();
    }
  });

  it('невыбранная ступень остаётся на hairline и чернильного контура не несёт', () => {
    render(<PersonalFields film={releasedFilm({ myRating: 8, watched: true })} today={TODAY} />);

    for (const value of [1, 7, 9, 10]) {
      const outline = outlineOf(ratingButton(value));

      expect(outline, `ступень ${value}`).toContain('hairline');
      expect(outline, `ступень ${value}`).not.toBe(ratingPickStyle(value).boxShadow);
    }
  });

  it('выбор виден не заливкой: заливка выбранной ступени та же, что у невыбранной', () => {
    render(<PersonalFields film={releasedFilm({ myRating: 1, watched: true })} today={TODAY} />);

    expect(ratingButton(1).style.background).toBe(String(ratingStyle(1).background));
  });

  it('без оценки чернильного контура нет ни у одной ступени', () => {
    render(<PersonalFields film={releasedFilm({ myRating: null })} today={TODAY} />);

    for (const button of ratingButtons()) {
      expect(button.style.boxShadow).not.toBe('inset 0 0 0 1px var(--ink)');
    }
  });
});

// Рефакторинг 15.09.2026, находка 15 (specs/refactor-2026-09-15/audit-code.md).
// «Сегодня» перестало считаться внутри клиентского компонента и приходит пропом
// со страницы фильма — той же дорогой, которой оно давно приходит в `DossierZone`.
// Тесту это даёт то, чего требует раздел «Тесты» в CLAUDE.md: «сегодня» — аргумент,
// а не системные часы, и подменять таймеры не нужно.
describe('PersonalFields: «сегодня» приходит пропом (находка 15)', () => {
  const RELEASE = '2026-09-20';

  it('фильм, выходящий позже переданной даты, оценить нельзя', () => {
    render(<PersonalFields film={releasedFilm({ releaseDate: RELEASE, myRating: null })} today="2026-09-15" />);

    const buttons = ratingButtons();
    expect(buttons.length).toBe(10);
    for (const button of buttons) {
      expect(isDisabled(button)).toBe(true);
    }
    expect(isDisabled(watchedControl()!)).toBe(true);
  });

  it('тот же фильм при более поздней переданной дате уже вышел', () => {
    render(<PersonalFields film={releasedFilm({ releaseDate: RELEASE, myRating: null })} today="2026-09-25" />);

    for (const button of ratingButtons()) {
      expect(isDisabled(button)).toBe(false);
    }
    expect(isDisabled(watchedControl()!)).toBe(false);
  });

  it('в день премьеры фильм считается вышедшим', () => {
    render(<PersonalFields film={releasedFilm({ releaseDate: RELEASE, myRating: null })} today={RELEASE} />);

    for (const button of ratingButtons()) {
      expect(isDisabled(button)).toBe(false);
    }
  });

  // Звёздочка вкуса невышедшему доступна была и остаётся: дата на неё не влияет
  // ни при каком значении — она про вкус, а не про просмотр.
  it('звёздочка вкуса от переданной даты не зависит', () => {
    const { unmount } = render(
      <PersonalFields film={releasedFilm({ releaseDate: RELEASE, tasteStar: false })} today="2026-09-15" />,
    );
    expect(isDisabled(tasteStarControl()!)).toBe(false);
    unmount();

    render(<PersonalFields film={releasedFilm({ releaseDate: RELEASE, tasteStar: false })} today="2026-09-25" />);
    expect(isDisabled(tasteStarControl()!)).toBe(false);
  });
});
