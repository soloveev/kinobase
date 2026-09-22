// Критерии приёмки 2–6 версии v2.1 на уровне блока выходных данных карточки фильма:
// 2 — «Дата выхода» показывает полную дату с годом;
// 3 — строка «IMDb» — ссылка на imdb.com/title/<id>/, новая вкладка, без подчёркивания;
// 4 — строка «Кинопоиск» — ссылка на kinopoisk.ru/film/<id>/ с теми же правилами;
// 5 — идентификатор есть, оценки нет → строка показана: ссылка и прочерк вместо оценки;
// 6 — идентификатора нет → строка как раньше, без ссылки.
//
// Контракт: <FilmFacts film={film} /> — default export из '@/components/FilmFacts',
// серверный компонент без хуков и без обращения к базе; страница фильма встраивает его
// вместо собранного вручную списка фактов (саму страницу в jsdom не отрендерить —
// она ходит в базу). Ссылка охватывает строку целиком, поэтому доступное имя ссылки
// содержит и ярлык, и значение — по нему строки и находятся.
// Подчёркивание в проекте задаётся классами Tailwind, поэтому его отсутствие
// проверяется отсутствием класса underline — как обычного, так и с любым
// префиксом состояния (hover:underline и подобные). Класс no-underline,
// наоборот, подчёркивание снимает, поэтому проверяем именно токены классов,
// а не подстроку в общей строке className.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import FilmFacts from '@/components/FilmFacts';
import { makeFilm } from './helpers';

afterEach(() => {
  cleanup();
});

function underlineClasses(element: HTMLElement): string[] {
  return [...element.classList].filter((name) => name.split(':').pop() === 'underline');
}

describe('FilmFacts: дата выхода (критерий 2)', () => {
  it('показывает полную дату с годом', () => {
    render(<FilmFacts film={makeFilm({ id: 1, titleRu: 'Фильм', releaseDate: '2026-09-18' })} />);

    expect(screen.getByText('Дата выхода')).toBeInTheDocument();
    expect(screen.getByText('18 сентября 2026')).toBeInTheDocument();
  });

  it('без даты выхода строки нет', () => {
    render(<FilmFacts film={makeFilm({ id: 1, titleRu: 'Фильм' })} />);

    expect(screen.queryByText('Дата выхода')).toBeNull();
  });
});

describe('FilmFacts: строка IMDb (критерии 3, 5, 6)', () => {
  it('с идентификатором строка — ссылка на imdb.com/title/<id>/', () => {
    render(
      <FilmFacts
        film={makeFilm({ id: 1, titleRu: 'Фильм', imdbId: 'tt1234567', imdbRating: 8.2 })}
      />,
    );

    const link = screen.getByRole('link', { name: /IMDb/ });

    expect(link).toHaveAttribute('href', 'https://www.imdb.com/title/tt1234567/');
  });

  it('ссылка открывается в новой вкладке', () => {
    render(
      <FilmFacts
        film={makeFilm({ id: 1, titleRu: 'Фильм', imdbId: 'tt1234567', imdbRating: 8.2 })}
      />,
    );

    expect(screen.getByRole('link', { name: /IMDb/ })).toHaveAttribute('target', '_blank');
  });

  it('ссылка не подчёркнута — ни в покое, ни при наведении', () => {
    render(
      <FilmFacts
        film={makeFilm({ id: 1, titleRu: 'Фильм', imdbId: 'tt1234567', imdbRating: 8.2 })}
      />,
    );

    expect(underlineClasses(screen.getByRole('link', { name: /IMDb/ }))).toEqual([]);
  });

  it('кликается вся строка: и ярлык, и оценка внутри ссылки', () => {
    render(
      <FilmFacts
        film={makeFilm({ id: 1, titleRu: 'Фильм', imdbId: 'tt1234567', imdbRating: 8.2 })}
      />,
    );

    const link = screen.getByRole('link', { name: /IMDb/ });

    expect(link).toHaveTextContent('IMDb');
    expect(link).toHaveTextContent('8,2');
  });

  it('идентификатор есть, оценки нет — строка со ссылкой и прочерком (критерий 5)', () => {
    render(
      <FilmFacts film={makeFilm({ id: 1, titleRu: 'Фильм', imdbId: 'tt1234567' })} />,
    );

    const link = screen.getByRole('link', { name: /IMDb/ });

    expect(link).toHaveAttribute('href', 'https://www.imdb.com/title/tt1234567/');
    expect(link).toHaveTextContent('—');
  });

  it('идентификатора нет, оценка есть — строка без ссылки (критерий 6)', () => {
    render(<FilmFacts film={makeFilm({ id: 1, titleRu: 'Фильм', imdbRating: 8.2 })} />);

    expect(screen.getByText('IMDb')).toBeInTheDocument();
    expect(screen.getByText('8,2')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /IMDb/ })).toBeNull();
  });

  it('нет ни идентификатора, ни оценки — строки нет вовсе', () => {
    render(<FilmFacts film={makeFilm({ id: 1, titleRu: 'Фильм', releaseDate: '2026-09-18' })} />);

    expect(screen.queryByText('IMDb')).toBeNull();
  });
});

describe('FilmFacts: строка Кинопоиска (критерии 4, 5, 6)', () => {
  it('с идентификатором строка — ссылка на kinopoisk.ru/film/<id>/', () => {
    render(
      <FilmFacts
        film={makeFilm({ id: 1, titleRu: 'Фильм', kinopoiskId: 301, kinopoiskRating: 7.5 })}
      />,
    );

    const link = screen.getByRole('link', { name: /Кинопоиск/ });

    expect(link).toHaveAttribute('href', 'https://www.kinopoisk.ru/film/301/');
  });

  it('ссылка открывается в новой вкладке и не подчёркнута', () => {
    render(
      <FilmFacts
        film={makeFilm({ id: 1, titleRu: 'Фильм', kinopoiskId: 301, kinopoiskRating: 7.5 })}
      />,
    );

    const link = screen.getByRole('link', { name: /Кинопоиск/ });

    expect(link).toHaveAttribute('target', '_blank');
    expect(underlineClasses(link)).toEqual([]);
  });

  it('идентификатор есть, оценки нет — строка со ссылкой и прочерком (критерий 5)', () => {
    render(<FilmFacts film={makeFilm({ id: 1, titleRu: 'Фильм', kinopoiskId: 301 })} />);

    const link = screen.getByRole('link', { name: /Кинопоиск/ });

    expect(link).toHaveAttribute('href', 'https://www.kinopoisk.ru/film/301/');
    expect(link).toHaveTextContent('—');
  });

  it('идентификатора нет, оценка есть — строка без ссылки (критерий 6)', () => {
    render(<FilmFacts film={makeFilm({ id: 1, titleRu: 'Фильм', kinopoiskRating: 7.5 })} />);

    expect(screen.getByText('Кинопоиск')).toBeInTheDocument();
    expect(screen.getByText('7,5')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Кинопоиск/ })).toBeNull();
  });

  it('нет ни идентификатора, ни оценки — строки нет вовсе', () => {
    render(<FilmFacts film={makeFilm({ id: 1, titleRu: 'Фильм', releaseDate: '2026-09-18' })} />);

    expect(screen.queryByText('Кинопоиск')).toBeNull();
  });
});

describe('FilmFacts: блок целиком', () => {
  it('у фильма совсем без справочных данных блок пустой — ни строк, ни ссылок', () => {
    render(<FilmFacts film={makeFilm({ id: 1, titleRu: 'Фильм' })} />);

    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryByText('Дата выхода')).toBeNull();
    expect(screen.queryByText('IMDb')).toBeNull();
    expect(screen.queryByText('Кинопоиск')).toBeNull();
  });

  it('обе ссылки соседствуют, когда есть оба идентификатора', () => {
    render(
      <FilmFacts
        film={makeFilm({
          id: 1,
          titleRu: 'Фильм',
          releaseDate: '2026-09-18',
          imdbId: 'tt1234567',
          imdbRating: 8.2,
          kinopoiskId: 301,
          kinopoiskRating: 7.5,
        })}
      />,
    );

    expect(screen.getAllByRole('link')).toHaveLength(2);
    expect(screen.getByText('18 сентября 2026')).toBeInTheDocument();
  });
});
