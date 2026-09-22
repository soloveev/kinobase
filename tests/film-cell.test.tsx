// Критерий приёмки 1 версии v2.1: в ячейке сетки фильм со статусом «ждём»
// показывает «Ждём с 18 сентября» — без года и без точки-разделителя «·».
//
// Дополнение v5, критерий приёмки 5: у сериала плашка «Ждём» уточняет сезон, и уточнение
// составное — сезон, если он есть, плюс дата, если она есть. Три случая:
// «Ждём сезон 3 с 12 марта», «Ждём сезон 3 в марте» (известен только месяц),
// «Ждём сезон 3» (дата неизвестна). У фильмов суффикс прежний — «с 12 марта».
//
// Контракт: <FilmCell film={film} status={status} index={index} /> — default export
// из '@/components/FilmCell'. Статус приходит пропсом, поэтому тесты не зависят
// от сегодняшней даты. Ячейка — элемент списка, поэтому рендерим её внутри <ul>.

// Дополнение: правка от 23.08.2026, критерий приёмки 23 — год у неоднозначного названия.
// Если в базе больше одного тайтла с таким же русским названием, заголовок ячейки несёт
// год в скобках: «Призрак в доспехах (1995)». Уникальное название не меняется.
//
// Как ячейка узнаёт о неоднозначности. Неоднозначность — свойство базы целиком, а не
// отдельной ячейки, но ходить в базу компоненту нельзя: страница ходит, компонент
// остаётся чистым. Поэтому набор неоднозначных названий считает страница и передаёт
// его необязательным пропом:
//
//   <FilmCell film={film} status={status} index={index} ambiguous={set} />
//   ambiguous?: ReadonlySet<string>
//
// Проп необязателен намеренно: ячейка без него ведёт себя как прежде — так же, как если
// бы набор был пуст. Это и держит зелёными все тесты выше, где неоднозначности нет.
// Само правило «название плюс год» живёт в '@/lib/titles' и проверяется отдельно
// в tests/titles.test.ts; здесь проверяется только, что ячейка его применяет.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import FilmCell from '@/components/FilmCell';
import type { FilmStatus } from '@/lib/status';
import { makeFilm } from './helpers';
import type { Film } from '@/db/schema';

afterEach(() => {
  cleanup();
});

function renderCell(film: Film, status: FilmStatus): HTMLElement {
  render(
    <ul>
      <FilmCell film={film} status={status} index={0} />
    </ul>,
  );
  return screen.getByRole('link');
}

const waitingFilm = makeFilm({
  id: 1,
  titleRu: 'Непокой',
  releaseDate: '2026-09-18',
});

describe('FilmCell: плашка «ждём» с датой премьеры', () => {
  it('показывает «Ждём с 18 сентября»', () => {
    const cell = renderCell(waitingFilm, 'waiting');

    expect(within(cell).getByText(/Ждём/)).toHaveTextContent(/^Ждём с 18 сентября$/);
  });

  it('в плашке нет года премьеры', () => {
    const cell = renderCell(waitingFilm, 'waiting');

    expect(within(cell).getByText(/Ждём/)).not.toHaveTextContent(/2026/);
  });

  it('в плашке нет точки-разделителя «·» между словом и датой', () => {
    const cell = renderCell(waitingFilm, 'waiting');

    expect(within(cell).getByText(/Ждём/)).not.toHaveTextContent(/·/);
  });

  it('числовой формат даты 18.09.2026 в ячейке не встречается', () => {
    const cell = renderCell(waitingFilm, 'waiting');

    expect(cell.textContent ?? '').not.toMatch(/18\.09\.2026/);
  });

  it('однозначное число месяца идёт без ведущего нуля', () => {
    const cell = renderCell(
      makeFilm({ id: 2, titleRu: 'Мартовский', releaseDate: '2027-03-05' }),
      'waiting',
    );

    expect(within(cell).getByText(/Ждём/)).toHaveTextContent(/^Ждём с 5 марта$/);
  });

  it('без даты выхода плашка «ждём» показывает только слово', () => {
    const cell = renderCell(makeFilm({ id: 3, titleRu: 'Без даты' }), 'waiting');

    expect(within(cell).getByText(/Ждём/)).toHaveTextContent(/^Ждём$/);
  });
});

describe('FilmCell: плашки прочих статусов без даты', () => {
  it('«Посмотрел» — плашка без даты выхода', () => {
    const cell = renderCell(
      makeFilm({ id: 4, titleRu: 'Просмотренный', releaseDate: '2001-04-11', watched: true }),
      'watched',
    );

    expect(within(cell).getByText(/Посмотрел/)).toHaveTextContent(/^Посмотрел$/);
  });

  it('«Буду смотреть» — плашка без даты выхода', () => {
    const cell = renderCell(
      makeFilm({ id: 5, titleRu: 'В планах', releaseDate: '2001-04-11' }),
      'will-watch',
    );

    expect(within(cell).getByText(/Буду смотреть/)).toHaveTextContent(/^Буду смотреть$/);
  });
});

describe('FilmCell: год остаётся в строке фактов', () => {
  it('строка фактов ячейки показывает год премьеры', () => {
    const cell = renderCell(waitingFilm, 'waiting');

    expect(within(cell).getByText(/2026/)).toBeInTheDocument();
  });
});

// Критерий приёмки 5: сериал в таймлайне «Ждём» показывает, какого сезона мы ждём.
describe('FilmCell: плашка «ждём» у сериала с объявленным сезоном', () => {
  const series = (overrides: Partial<Film>): Film =>
    makeFilm({
      id: 10,
      titleRu: 'Проклятие',
      releaseDate: '2023-11-10',
      tags: ['series'],
      seasonsReleased: 2,
      nextSeasonNumber: 3,
      ...overrides,
    });

  it('с полной датой сезона — «Ждём сезон 3 с 12 марта»', () => {
    const cell = renderCell(series({ nextSeasonDate: '2027-03-12' }), 'waiting');

    expect(within(cell).getByText(/Ждём/)).toHaveTextContent(/^Ждём сезон 3 с 12 марта$/);
  });

  it('с датой точностью до месяца — «Ждём сезон 3 в марте»', () => {
    const cell = renderCell(series({ nextSeasonDate: '2027-03' }), 'waiting');

    expect(within(cell).getByText(/Ждём/)).toHaveTextContent(/^Ждём сезон 3 в марте$/);
  });

  it('без даты сезона — «Ждём сезон 3»', () => {
    const cell = renderCell(series({ nextSeasonDate: null }), 'waiting');

    expect(within(cell).getByText(/Ждём/)).toHaveTextContent(/^Ждём сезон 3$/);
  });

  it('в плашке сезона нет года и нет даты выхода первого сезона', () => {
    const cell = renderCell(series({ nextSeasonDate: '2027-03-12' }), 'waiting');
    const plaque = within(cell).getByText(/Ждём/);

    expect(plaque).not.toHaveTextContent(/2027/);
    expect(plaque).not.toHaveTextContent(/ноября/);
  });

  it('у сериала без объявленного сезона суффикс прежний — дата выхода', () => {
    const cell = renderCell(
      makeFilm({
        id: 11,
        titleRu: 'Новый сериал',
        releaseDate: '2027-03-12',
        tags: ['series'],
      }),
      'waiting',
    );

    expect(within(cell).getByText(/Ждём/)).toHaveTextContent(/^Ждём с 12 марта$/);
  });

  it('у фильма сезон в плашке не появляется', () => {
    const cell = renderCell(
      makeFilm({ id: 12, titleRu: 'Фильм', releaseDate: '2027-03-12', tags: ['film'] }),
      'waiting',
    );

    expect(within(cell).getByText(/Ждём/)).not.toHaveTextContent(/сезон/i);
  });
});

// Критерий приёмки 10: четвёртый статус — «Другое», плашка описывает один тайтл.
describe('FilmCell: плашка «другое»', () => {
  it('показывает слово «Другое» без даты', () => {
    const cell = renderCell(
      makeFilm({ id: 13, titleRu: 'Ссылка из рецензии', releaseDate: '2001-04-11' }),
      'other',
    );

    expect(within(cell).getByText(/Другое/)).toHaveTextContent(/^Другое$/);
  });

  it('невышедший тайтл в «Другом» датой премьеры не хвастается', () => {
    const cell = renderCell(
      makeFilm({ id: 14, titleRu: 'Невышедший чужой', releaseDate: '2030-01-01' }),
      'other',
    );

    expect(within(cell).getByText(/Другое/)).toHaveTextContent(/^Другое$/);
  });
});

// Дополнение: правка от 23.08.2026, критерий приёмки 23.
describe('FilmCell: год у неоднозначного названия', () => {
  const gits = makeFilm({
    id: 20,
    titleRu: 'Призрак в доспехах',
    releaseDate: '1995-11-18',
  });

  function renderAmbiguous(film: Film, ambiguous?: ReadonlySet<string>): HTMLElement {
    render(
      <ul>
        <FilmCell film={film} status="watched" index={0} ambiguous={ambiguous} />
      </ul>,
    );
    return screen.getByRole('link');
  }

  it('заголовок неоднозначного тайтла несёт год в скобках', () => {
    const cell = renderAmbiguous(gits, new Set(['Призрак в доспехах']));

    expect(within(cell).getByRole('heading')).toHaveTextContent('Призрак в доспехах (1995)');
  });

  it('второй тайтл с тем же названием несёт свой год', () => {
    const series = makeFilm({
      id: 21,
      titleRu: 'Призрак в доспехах',
      releaseDate: '2026-01-15',
    });

    const cell = renderAmbiguous(series, new Set(['Призрак в доспехах']));

    expect(within(cell).getByRole('heading')).toHaveTextContent('Призрак в доспехах (2026)');
  });

  it('заголовок уникального названия года не получает', () => {
    const cell = renderAmbiguous(
      makeFilm({ id: 22, titleRu: 'Матрица', releaseDate: '1999-03-31' }),
      new Set(['Призрак в доспехах']),
    );

    expect(within(cell).getByRole('heading')).toHaveTextContent(/^Матрица$/);
  });

  it('неоднозначное название без даты выхода остаётся без года', () => {
    const cell = renderAmbiguous(
      makeFilm({ id: 23, titleRu: 'Призрак в доспехах' }),
      new Set(['Призрак в доспехах']),
    );

    expect(within(cell).getByRole('heading')).toHaveTextContent(/^Призрак в доспехах$/);
  });

  it('без пропа ячейка ведёт себя как прежде: заголовок без года', () => {
    const cell = renderAmbiguous(gits);

    expect(within(cell).getByRole('heading')).toHaveTextContent(/^Призрак в доспехах$/);
  });

  it('пустой набор ничего не меняет', () => {
    const cell = renderAmbiguous(gits, new Set());

    expect(within(cell).getByRole('heading')).toHaveTextContent(/^Призрак в доспехах$/);
  });
});

// ---------------------------------------------------------------------------
// Дополнение v14 (31.08.2026), раздел «Что не входит»: в сетке комментарий
// не показывается.
//
// Четырнадцатая версия открывает комментарий владельца читателю, но только в карточке.
// Витрина отвечает на вопрос «что здесь есть», и абзац текста под постером сломал бы
// плотность, ради которой сетка и собрана. Комментарий читается там же, где читается
// разбор.
//
// Не-требование стережётся тестом ровно потому, что не-требование: ни один критерий
// приёмки его не проверяет, и без этого блока оно продержится до первой правки ячейки.
// Ячейка получает `film` целиком — комментарий в ней есть всегда, и не показывать его
// приходится осознанно.

describe('FilmCell: комментарий владельца в сетку не попадает (v14)', () => {
  const COMMENT = 'Смотрел трижды и каждый раз про другое';

  const commented = makeFilm({
    id: 42,
    titleRu: 'Малхолланд Драйв',
    releaseDate: '2001-04-11',
    watched: true,
    myRating: 9,
    tasteStar: true,
    comment: COMMENT,
  });

  it('текста комментария в разметке ячейки нет', () => {
    const cell = renderCell(commented, 'watched');

    expect(cell.textContent ?? '').not.toContain(COMMENT);
  });

  it('текста комментария нет и в исходном коде ячейки', () => {
    render(
      <ul>
        <FilmCell film={commented} status="watched" index={0} />
      </ul>,
    );

    expect(document.body.innerHTML).not.toContain(COMMENT);
  });

  // portable 22.09.2026: подпись под комментарием при пустом имени в конфиге —
  // «Владелец базы»; проверяем отсутствие и её, и старой формулировки.
  it('подписи под комментарием в ячейке нет', () => {
    const cell = renderCell(commented, 'watched');

    expect(cell.textContent ?? '').not.toMatch(/автор блога/i);
    expect(cell.textContent ?? '').not.toMatch(/Владелец базы/i);
  });

  it('ссылки на блог владельца в ячейке нет: единственная ссылка — сама карточка', () => {
    render(
      <ul>
        <FilmCell film={commented} status="watched" index={0} />
      </ul>,
    );
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href') ?? '');

    expect(hrefs).toEqual([`/films/${commented.id}`]);
  });

  // Плашка оценки и звёздочка в сетке остаются: спека их не трогает, и проверка нужна,
  // чтобы «комментария нет» не превратилось однажды в «личного нет вовсе».
  it('оценка и звёздочка вкуса в ячейке по-прежнему показаны', () => {
    const cell = renderCell(commented, 'watched');

    expect(within(cell).getAllByText('9').length).toBeGreaterThan(0);
    expect(cell.querySelector('svg')).not.toBeNull();
  });
});
