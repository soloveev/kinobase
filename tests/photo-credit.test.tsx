// Критерии приёмки 12 и 13 версии v11 на уровне самого блока «Фотография»:
// 12 — блок называет автора снимка ссылкой на страницу описания файла и лицензию
//      ссылкой на её текст; при `modified` дописывает, что снимок изменён и что
//      производное распространяется на тех же условиях;
// 13 — блок раскрыт и элемента сворачивания не имеет.
//
// Контракт компонента (plan.md, работа C):
//   export default function PhotoCredit({ credit }: { credit: PhotoCredit }): ReactElement
// default export из '@/components/PhotoCredit'; тип `PhotoCredit` — из '@/lib/people':
//   { author: string; licence: string; licenceUrl: string; fileUrl: string; modified: boolean }
// Серверный компонент: ни состояния, ни обработчиков.
//
// Почему критерий 13 вообще существует и почему он проверяется тестом. Список
// источников на странице человека свёрнут по умолчанию. Спрятать под тот же кат
// указание автора значило бы формально его иметь, а фактически не показывать, —
// а лицензия CC BY-SA требует, чтобы указание было видно. Отсутствие `<details>`
// и кнопки здесь — не вкус вёрстки, а требование лицензии, и оно должно ломаться
// шумно, если однажды кто-то решит «убрать лишнее под кат».
//
// Имя автора не переводится и не транслитерируется — оно должно совпадать с тем,
// что стоит в описании файла на Викискладе, иначе перестаёт быть указанием.
// Поэтому в образце стоит настоящее написание с диакритикой.
//
// Ни классов, ни расположения подписи и значения здесь нет: Tailwind в jsdom
// не загружен, вид — работа живого прогона.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import PhotoCredit from '@/components/PhotoCredit';
import type { PhotoCredit as PhotoCreditValue } from '@/lib/people';

afterEach(() => {
  cleanup();
});

const CREDIT: PhotoCreditValue = {
  author: 'Niccolò Caranti',
  licence: 'CC BY-SA 4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  fileUrl: 'https://commons.wikimedia.org/wiki/File:Mamoru_Oshii_2017.jpg',
  modified: true,
};

const UNTOUCHED: PhotoCreditValue = {
  author: 'Harald Krichel',
  licence: 'CC BY-SA 3.0',
  licenceUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
  fileUrl: 'https://commons.wikimedia.org/wiki/File:Yorgos_Lanthimos.jpg',
  modified: false,
};

const MODIFIED_NOTE = 'Снимок изменён; производное распространяется на тех же условиях.';

function renderCredit(credit: PhotoCreditValue = CREDIT) {
  return render(<PhotoCredit credit={credit} />);
}

describe('PhotoCredit: заголовок блока (критерий 12)', () => {
  it('блок называется «Фотография»', () => {
    renderCredit();

    expect(screen.getByRole('heading', { name: 'Фотография' })).toBeInTheDocument();
  });
});

describe('PhotoCredit: автор и лицензия (критерий 12)', () => {
  it('автор назван ровно так, как его называет Викисклад', () => {
    const { container } = renderCredit();

    expect(container.textContent).toContain('Niccolò Caranti');
  });

  it('имя автора — ссылка на страницу описания файла', () => {
    renderCredit();

    expect(screen.getByRole('link', { name: 'Niccolò Caranti' })).toHaveAttribute(
      'href',
      CREDIT.fileUrl,
    );
  });

  it('название лицензии показано', () => {
    const { container } = renderCredit();

    expect(container.textContent).toContain('CC BY-SA 4.0');
  });

  it('название лицензии — ссылка на её текст', () => {
    renderCredit();

    expect(screen.getByRole('link', { name: 'CC BY-SA 4.0' })).toHaveAttribute(
      'href',
      CREDIT.licenceUrl,
    );
  });

  it('лицензия другой версии показывается своей, а не подставленной', () => {
    renderCredit(UNTOUCHED);

    expect(screen.getByRole('link', { name: 'CC BY-SA 3.0' })).toHaveAttribute(
      'href',
      UNTOUCHED.licenceUrl,
    );
  });
});

describe('PhotoCredit: пометка об изменении (критерий 12)', () => {
  it('изменённый снимок несёт пометку об изменении и об условиях распространения', () => {
    const { container } = renderCredit(CREDIT);

    expect(container.textContent).toContain(MODIFIED_NOTE);
  });

  it('неизменённый снимок пометки не несёт', () => {
    const { container } = renderCredit(UNTOUCHED);

    expect(container.textContent).not.toContain(MODIFIED_NOTE);
    expect(container.textContent).not.toMatch(/изменён/i);
  });

  it('автор и лицензия у неизменённого снимка на месте', () => {
    const { container } = renderCredit(UNTOUCHED);

    expect(container.textContent).toContain('Harald Krichel');
    expect(container.textContent).toContain('CC BY-SA 3.0');
  });
});

// Требование лицензии, а не вкус вёрстки: указание должно быть видно, а не лежать
// под катом рядом со свёрнутыми источниками.
describe('PhotoCredit: блок не сворачивается (критерий 13)', () => {
  it('в блоке нет <details>', () => {
    const { container } = renderCredit();

    expect(container.querySelector('details')).toBeNull();
  });

  it('в блоке нет кнопки сворачивания', () => {
    const { container } = renderCredit();

    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('[aria-expanded]')).toBeNull();
  });
});
