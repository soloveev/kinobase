// Критерий приёмки 16 (сервер отклоняет оценку вне диапазона 1–10 и нецелые значения)
// и раздел спеки «Валидация на границе»: «посмотрел» и звёздочка вкуса — только логические
// значения; ~~комментарий — любой текст, включая пустой~~ (правка 31.08.2026 по критерию
// приёмки 6 версии v14: пустой и состоящий из пробелов комментарий приводится к `null`,
// у непустого обрезаются края); пустая оценка (null) допустима.
// Правило «посмотрел только вышедшим» проверяется не здесь, а в репозитории (films-repo.test.ts).
//
// Дополнение v5, критерий приёмки 9: у патча появляется пятое личное поле — `wantToWatch`,
// логическое, как «посмотрел» и звёздочка. Без ветки в валидаторе патч молча не долетел бы
// до базы, поэтому здесь проверяется и приём верного значения, и отказ на неверном.

import { describe, it, expect } from 'vitest';
import { validatePersonalPatch } from '@/lib/validate';

/** Разворачивает успешный результат, иначе валит тест с текстом ошибки. */
function accepted(input: unknown) {
  const result = validatePersonalPatch(input);
  if (!result.ok) throw new Error(`ожидался приём патча, получена ошибка: ${result.error}`);
  return result.patch;
}

function rejected(input: unknown) {
  const result = validatePersonalPatch(input);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('ожидался отказ');
  expect(typeof result.error).toBe('string');
  expect(result.error.length).toBeGreaterThan(0);
  return result.error;
}

describe('validatePersonalPatch: моя оценка', () => {
  it('принимает целые значения от 1 до 10', () => {
    for (let rating = 1; rating <= 10; rating++) {
      expect(accepted({ myRating: rating })).toEqual({ myRating: rating });
    }
  });

  it('принимает null — снятие оценки', () => {
    expect(accepted({ myRating: null })).toEqual({ myRating: null });
  });

  it('отклоняет оценку вне диапазона 1–10', () => {
    rejected({ myRating: 0 });
    rejected({ myRating: 11 });
    rejected({ myRating: -3 });
    rejected({ myRating: 100 });
  });

  it('отклоняет нецелые оценки', () => {
    rejected({ myRating: 7.5 });
    rejected({ myRating: 9.9 });
  });

  it('отклоняет нечисловые оценки', () => {
    rejected({ myRating: '7' });
    rejected({ myRating: true });
    rejected({ myRating: NaN });
    rejected({ myRating: Infinity });
    rejected({ myRating: {} });
  });
});

describe('validatePersonalPatch: отметка «посмотрел» и звёздочка вкуса', () => {
  it('принимают логические значения', () => {
    expect(accepted({ watched: true })).toEqual({ watched: true });
    expect(accepted({ watched: false })).toEqual({ watched: false });
    expect(accepted({ tasteStar: true })).toEqual({ tasteStar: true });
    expect(accepted({ tasteStar: false })).toEqual({ tasteStar: false });
  });

  it('отклоняют всё, что не «да/нет»', () => {
    rejected({ watched: 'true' });
    rejected({ watched: 1 });
    rejected({ watched: null });
    rejected({ tasteStar: 'yes' });
    rejected({ tasteStar: 0 });
    rejected({ tasteStar: null });
  });
});

// Критерий приёмки 9: «хочу посмотреть» — личное поле наравне с остальными.
describe('validatePersonalPatch: отметка «хочу посмотреть»', () => {
  it('принимает логические значения', () => {
    expect(accepted({ wantToWatch: true })).toEqual({ wantToWatch: true });
    expect(accepted({ wantToWatch: false })).toEqual({ wantToWatch: false });
  });

  it('отклоняет всё, что не «да/нет»', () => {
    rejected({ wantToWatch: 'true' });
    rejected({ wantToWatch: 1 });
    rejected({ wantToWatch: 0 });
    rejected({ wantToWatch: null });
    rejected({ wantToWatch: {} });
  });

  // Прежде здесь стоял тест «обе отметки могут стоять разом»: правка спеки
  // от 23.08.2026 сделала галочки взаимоисключающими, и такой патч сервер отклоняет
  // (критерий 24). Отказ и неизменность базы проверяются на updatePersonal
  // в films-repo.test.ts — сюда он не переносится, потому что слой проверки
  // спекой не задан, а требование сформулировано как «в базу не доехало».
});

// Правка 31.08.2026 по критерию приёмки 6 версии v14. Прежняя редакция этого блока:
// ~~«принимает любой текст, включая пустой»: `{ comment: '' }` доезжало до базы пустой
// строкой, а края у непустого текста оставались нетронутыми («  многострочный\nтекст  »
// сохранялся вместе с пробелами).~~ Пока комментарий видел один владелец, разницы между
// `null` и `''` не было. В v14 комментарий становится частью карточки, и от этой разницы
// зависит, показывать блок или нет: два неотличимых состояния «пусто» дали бы две ветки
// там, где нужна одна. Это решение спеки, а не регрессия.
describe('validatePersonalPatch: комментарий', () => {
  it('принимает обычный текст (критерий 6)', () => {
    expect(accepted({ comment: 'Отличный фильм' })).toEqual({ comment: 'Отличный фильм' });
  });

  it('приводит пустой комментарий к null (критерий 6)', () => {
    expect(accepted({ comment: '' })).toEqual({ comment: null });
  });

  it('приводит комментарий из одних пробелов к null (критерий 6)', () => {
    expect(accepted({ comment: '   ' })).toEqual({ comment: null });
    expect(accepted({ comment: '\n\n' })).toEqual({ comment: null });
    expect(accepted({ comment: ' \t\r\n ' })).toEqual({ comment: null });
  });

  // Обрезка краёв заодно чинит хвост из переносов, который остаётся, когда абзац
  // стирают не до конца.
  it('обрезает края у непустого комментария (критерий 6)', () => {
    expect(accepted({ comment: '  многострочный\nтекст  ' })).toEqual({
      comment: 'многострочный\nтекст',
    });
    expect(accepted({ comment: 'первый абзац\n\n' })).toEqual({ comment: 'первый абзац' });
  });

  it('переносы внутри текста обрезка не трогает (критерий 6)', () => {
    expect(accepted({ comment: 'первый\n\nвторой' })).toEqual({ comment: 'первый\n\nвторой' });
  });

  it('отклоняет нетекстовый комментарий', () => {
    rejected({ comment: 42 });
    rejected({ comment: ['a'] });
    // План, раздел 1: комментарий приходит с клиента текстом, и `null` — это результат
    // приведения, а не допустимый вход. Иначе «пусто» снова оказалось бы двумя путями.
    rejected({ comment: null });
  });
});

describe('validatePersonalPatch: форма патча', () => {
  it('принимает патч сразу со всеми пятью личными полями', () => {
    const patch = {
      watched: true,
      wantToWatch: false,
      myRating: 8,
      tasteStar: true,
      comment: 'да',
    };
    expect(accepted(patch)).toEqual(patch);
  });

  it('отклоняет то, что вообще не объект-патч', () => {
    rejected(null);
    rejected(undefined);
    rejected('watched');
    rejected(42);
    rejected(true);
    rejected([{ watched: true }]);
  });

  it('одно неверное поле отменяет весь патч, даже если остальные корректны', () => {
    rejected({ watched: true, myRating: 42 });
    rejected({ wantToWatch: true, myRating: 42 });
    rejected({ myRating: 8, wantToWatch: 'да' });
  });
});
