// Критерии приёмки 6 и 7.
// 6: по умолчанию (режим 'date') фильмы отсортированы по дате выхода, новые сверху;
//    при равных датах — по алфавиту русского названия; фильмы без даты — в конце.
// 7: в режиме 'rating' фильмы идут от высокой оценки к низкой; при равных оценках —
//    по дате выхода, новые сверху; фильмы без оценки — в конце, между собой по дате выхода.

import { describe, it, expect } from 'vitest';
import { sortFilms } from '@/lib/sort';
import { makeFilm } from './helpers';

const titles = (films: { titleRu: string }[]) => films.map((f) => f.titleRu);

describe('sortFilms, режим «по дате выхода»', () => {
  const films = [
    makeFilm({ id: 1, titleRu: 'Бета', releaseDate: '2024-05-05' }),
    makeFilm({ id: 2, titleRu: 'Ящерица', releaseDate: '2025-01-01' }),
    makeFilm({ id: 3, titleRu: 'Дельта', releaseDate: null }),
    makeFilm({ id: 4, titleRu: 'Альфа', releaseDate: '2025-01-01' }),
    makeFilm({ id: 5, titleRu: 'Эпсилон', releaseDate: '2026-12-31' }),
  ];

  it('новые и будущие фильмы идут сверху, фильмы без даты — в самом конце', () => {
    expect(titles(sortFilms(films, 'date'))).toEqual([
      'Эпсилон',
      'Альфа',
      'Ящерица',
      'Бета',
      'Дельта',
    ]);
  });

  it('фильмы с одинаковой датой упорядочены по алфавиту русского названия', () => {
    const sameDate = [
      makeFilm({ id: 1, titleRu: 'Яблоко', releaseDate: '2025-01-01' }),
      makeFilm({ id: 2, titleRu: 'Берег', releaseDate: '2025-01-01' }),
      makeFilm({ id: 3, titleRu: 'Автобус', releaseDate: '2025-01-01' }),
    ];
    expect(titles(sortFilms(sameDate, 'date'))).toEqual(['Автобус', 'Берег', 'Яблоко']);
  });

  it('несколько фильмов без даты оказываются после всех датированных', () => {
    const withGaps = [
      makeFilm({ id: 1, titleRu: 'Без даты один', releaseDate: null }),
      makeFilm({ id: 2, titleRu: 'С датой', releaseDate: '2010-01-01' }),
      makeFilm({ id: 3, titleRu: 'Без даты два', releaseDate: null }),
    ];
    expect(titles(sortFilms(withGaps, 'date'))[0]).toBe('С датой');
    expect(titles(sortFilms(withGaps, 'date')).slice(1).sort()).toEqual([
      'Без даты два',
      'Без даты один',
    ]);
  });

  it('пустой список остаётся пустым', () => {
    expect(sortFilms([], 'date')).toEqual([]);
  });
});

describe('sortFilms, режим «по моей оценке»', () => {
  const films = [
    makeFilm({ id: 1, titleRu: 'Без оценки старый', releaseDate: '2022-01-01', myRating: null }),
    makeFilm({ id: 2, titleRu: 'Семёрка ранняя', releaseDate: '2019-01-01', myRating: 7 }),
    makeFilm({ id: 3, titleRu: 'Девятка', releaseDate: '2020-01-01', myRating: 9 }),
    makeFilm({ id: 4, titleRu: 'Без оценки новый', releaseDate: '2023-01-01', myRating: null }),
    makeFilm({ id: 5, titleRu: 'Семёрка поздняя', releaseDate: '2021-01-01', myRating: 7 }),
  ];

  it('высокие оценки сверху, равные оценки — по дате (новые сверху), без оценки — в конце', () => {
    expect(titles(sortFilms(films, 'rating'))).toEqual([
      'Девятка',
      'Семёрка поздняя',
      'Семёрка ранняя',
      'Без оценки новый',
      'Без оценки старый',
    ]);
  });

  it('фильмы без оценки идут после любого фильма с оценкой, даже с оценкой 1', () => {
    const list = [
      makeFilm({ id: 1, titleRu: 'Без оценки', releaseDate: '2030-01-01', myRating: null }),
      makeFilm({ id: 2, titleRu: 'Единица', releaseDate: '1990-01-01', myRating: 1 }),
    ];
    expect(titles(sortFilms(list, 'rating'))).toEqual(['Единица', 'Без оценки']);
  });

  it('вся шкала оценок выстраивается от 10 к 1', () => {
    const list = [3, 10, 1, 7].map((r, i) =>
      makeFilm({ id: i + 1, titleRu: `Оценка ${r}`, myRating: r }),
    );
    expect(titles(sortFilms(list, 'rating'))).toEqual([
      'Оценка 10',
      'Оценка 7',
      'Оценка 3',
      'Оценка 1',
    ]);
  });

  it('пустой список остаётся пустым', () => {
    expect(sortFilms([], 'rating')).toEqual([]);
  });
});
