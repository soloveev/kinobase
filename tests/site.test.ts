// Критерии приёмки 30, 32, 33 и 36 версии v11 на уровне чистой логики метаданных:
// 30 — адрес сайта задан в одном месте и годится в `metadataBase` корневого layout;
//      следствие для этой функции — путь страницы остаётся относительным, адрес
//      руками нигде не склеивается;
// 32 — у тайтла без аннотации описание превью — общее описание сайта, а не пустая
//      строка: правило «пустого описания не бывает» живёт здесь, в одном месте,
//      а не в трёх страницах;
// 33 — у тайтла без постера ключа картинки нет вовсе. Это осознанный выбор против
//      запасной заглушки: пустое превью честнее, чем одинаковая картинка у половины
//      базы, и мессенджер в этом случае показывает обычную текстовую карточку.
//      Поэтому проверяется отсутствие самого ключа, а не пустое значение под ним:
//      `images: undefined` и `images: []` — это уже другой договор;
// 36 — где есть картинка, там объявлен `twitter:card` со значением
//      `summary_large_image`; где картинки нет, там и раздела `twitter` нет.
//
// Контракт модуля '@/lib/site', зафиксированный этими тестами (plan.md, раздел G):
//   const SITE_URL: string;
//   const SITE_TITLE: string;
//   const SITE_DESCRIPTION: string;
//   function pageMetadata(input: {
//     title: string;
//     description: string | null;
//     image: string | null;
//     path: string;
//   }): Metadata;
//
// Тесты не трогают Next: `pageMetadata` — чистая функция, и проверять её сборкой
// страницы значило бы проверять фреймворк. То, что корневой layout действительно
// объявляет `metadataBase`, и то, что страницы зовут эту функцию с нужными
// аргументами, проверяется живым прогоном — разметкой превью в исходном коде
// страницы, как записано в плане.

import { describe, it, expect } from 'vitest';
import type { Metadata } from 'next';
import { SITE_URL, SITE_TITLE, SITE_DESCRIPTION, pageMetadata } from '@/lib/site';

/** Форма, в которой тесту нужен раздел Open Graph. Собственный тип Next — union
 *  из десятка вариантов по `type`, и разбирать его здесь незачем: тест читает
 *  готовый объект, а не строит его. */
type OpenGraphShape = {
  title?: unknown;
  siteName?: unknown;
  description?: unknown;
  url?: unknown;
  type?: unknown;
  locale?: unknown;
  images?: unknown;
};

type TwitterShape = {
  card?: unknown;
  title?: unknown;
  description?: unknown;
};

function openGraph(meta: Metadata): OpenGraphShape {
  expect(meta.openGraph, 'раздел openGraph').toBeDefined();
  return meta.openGraph as unknown as OpenGraphShape;
}

function twitter(meta: Metadata): TwitterShape {
  expect(meta.twitter, 'раздел twitter').toBeDefined();
  return meta.twitter as unknown as TwitterShape;
}

/** Ключ отсутствует, а не лежит со значением undefined: критерий 33 требует
 *  именно этого. `'ключ' in объект` находит и ключ со значением undefined. */
function hasKey(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

/** Карточка фильма с постером и аннотацией — полный случай. */
const FILM = {
  title: 'Призрак в доспехах (1995)',
  description: 'Майор Кусанаги ищет хакера, который взламывает людей.',
  image: '/posters/ghost-in-the-shell.jpg',
  path: '/films/12',
};

describe('SITE_URL, SITE_TITLE, SITE_DESCRIPTION (критерий 30)', () => {
  // portable 22.09.2026: конкретный боевой домен из отчуждаемой копии не проверяем —
  // адрес задаёт владелец сайта в site.config.ts, важно лишь что это разбираемый URL.
  it('адрес сайта — абсолютный URL', () => {
    expect(() => new URL(SITE_URL)).not.toThrow();
  });

  it('имя сайта и общее описание заданы непустыми строками', () => {
    expect(SITE_TITLE).toBe('Кино База');
    expect(SITE_DESCRIPTION).toBe(
      'Личная база фильмов: что посмотрел, чего жду, разбор творческих методов',
    );
  });
});

describe('pageMetadata: заголовки (общая форма превью для критериев 31, 34 и 35 версии v11)', () => {
  it('заголовок вкладки — название с приписанным именем сайта', () => {
    expect(pageMetadata(FILM).title).toBe('Призрак в доспехах (1995) — Кино База');
  });

  it('форма заголовка вкладки собирается из констант, а не из литерала', () => {
    const meta = pageMetadata({ ...FILM, title: 'Мамору Осии' });

    expect(meta.title).toBe(`Мамору Осии — ${SITE_TITLE}`);
  });

  it('og:title — название без приписки: имя сайта мессенджер берёт отдельной строкой', () => {
    const og = openGraph(pageMetadata(FILM));

    expect(og.title).toBe('Призрак в доспехах (1995)');
    expect(String(og.title)).not.toContain(SITE_TITLE);
  });

  it('og:site_name — имя сайта', () => {
    expect(openGraph(pageMetadata(FILM)).siteName).toBe(SITE_TITLE);
  });
});

describe('pageMetadata: описание (критерий 32)', () => {
  it('аннотация становится описанием и наверху, и в Open Graph', () => {
    const meta = pageMetadata(FILM);

    expect(meta.description).toBe(FILM.description);
    expect(openGraph(meta).description).toBe(FILM.description);
  });

  it('без аннотации описание — общее описание сайта, а не пустая строка', () => {
    const meta = pageMetadata({ ...FILM, description: null });

    expect(meta.description).toBe(SITE_DESCRIPTION);
    expect(openGraph(meta).description).toBe(SITE_DESCRIPTION);
  });

  it('пустая аннотация и аннотация из одних пробелов подменяются так же', () => {
    for (const description of ['', '   ', '\n\t ']) {
      const meta = pageMetadata({ ...FILM, description });

      expect(meta.description, `описание «${description}»`).toBe(SITE_DESCRIPTION);
      expect(openGraph(meta).description, `описание «${description}»`).toBe(SITE_DESCRIPTION);
    }
  });

  it('описание наверху и в Open Graph всегда одно и то же', () => {
    for (const description of [FILM.description, null, '', '  ']) {
      const meta = pageMetadata({ ...FILM, description });

      expect(openGraph(meta).description, `описание «${description}»`).toBe(meta.description);
    }
  });

  it('непустая аннотация не подменяется и не обрезается', () => {
    const description = 'Один абзац аннотации, в котором есть и точка, и запятая.';

    expect(pageMetadata({ ...FILM, description }).description).toBe(description);
  });
});

describe('pageMetadata: адрес и тип страницы (критерий 30)', () => {
  it('og:url — путь страницы как передан, относительным', () => {
    expect(openGraph(pageMetadata(FILM)).url).toBe('/films/12');
    expect(openGraph(pageMetadata({ ...FILM, path: '/people/mamoru-oshii' })).url).toBe(
      '/people/mamoru-oshii',
    );
    expect(openGraph(pageMetadata({ ...FILM, path: '/about' })).url).toBe('/about');
  });

  it('адрес сайта в og:url не подставляется: его развернёт metadataBase', () => {
    const url = String(openGraph(pageMetadata(FILM)).url);

    expect(url).not.toContain(SITE_URL);
    expect(url).not.toMatch(/^https?:\/\//);
    expect(url.startsWith('/')).toBe(true);
  });

  it('тип страницы — article', () => {
    expect(openGraph(pageMetadata(FILM)).type).toBe('article');
  });

  it('язык страницы — ru_RU', () => {
    expect(openGraph(pageMetadata(FILM)).locale).toBe('ru_RU');
  });
});

describe('pageMetadata: картинка есть (критерии 31 и 36)', () => {
  it('og:image — переданный путь, тоже относительный', () => {
    const og = openGraph(pageMetadata(FILM));

    expect(og.images).toEqual(['/posters/ghost-in-the-shell.jpg']);
    expect(JSON.stringify(og.images)).not.toContain(SITE_URL);
  });

  it('фотография персоналии кладётся тем же полем', () => {
    const og = openGraph(
      pageMetadata({
        title: 'Мамору Осии',
        description: 'Тридцать лет снимает про то, что у кино нет реальности.',
        image: '/people/mamoru-oshii.jpg',
        path: '/people/mamoru-oshii',
      }),
    );

    expect(og.images).toEqual(['/people/mamoru-oshii.jpg']);
  });

  it('объявлен twitter:card со значением summary_large_image', () => {
    expect(twitter(pageMetadata(FILM)).card).toBe('summary_large_image');
  });

  it('заголовок и описание в twitter те же, что в Open Graph', () => {
    const meta = pageMetadata(FILM);

    expect(twitter(meta).title).toBe(FILM.title);
    expect(twitter(meta).description).toBe(FILM.description);
  });

  it('в twitter описание подменяется тем же общим описанием сайта', () => {
    const meta = pageMetadata({ ...FILM, description: null });

    expect(twitter(meta).description).toBe(SITE_DESCRIPTION);
  });
});

describe('pageMetadata: картинки нет (критерий 33)', () => {
  const noImage = () => pageMetadata({ ...FILM, image: null });

  it('ключа images в openGraph нет вовсе — ни undefined, ни пустого массива', () => {
    const og = openGraph(noImage());

    expect(hasKey(og, 'images')).toBe(false);
    expect(og.images).toBeUndefined();
  });

  it('заглушки вместо картинки не появляется нигде в метаданных', () => {
    expect(JSON.stringify(noImage())).not.toMatch(/\.(jpe?g|png|webp|svg)/i);
  });

  it('раздела twitter нет: карточке с большой картинкой нечего показывать', () => {
    expect(hasKey(noImage(), 'twitter')).toBe(false);
    expect(noImage().twitter).toBeUndefined();
  });

  it('всё остальное на месте: заголовок, описание, адрес и тип', () => {
    const og = openGraph(noImage());

    expect(noImage().title).toBe(`${FILM.title} — ${SITE_TITLE}`);
    expect(noImage().description).toBe(FILM.description);
    expect(og.title).toBe(FILM.title);
    expect(og.siteName).toBe(SITE_TITLE);
    expect(og.url).toBe(FILM.path);
    expect(og.type).toBe('article');
  });

  it('тайтл без постера и без аннотации разом: описание общее, картинки нет', () => {
    const meta = pageMetadata({ ...FILM, description: null, image: null });

    expect(meta.description).toBe(SITE_DESCRIPTION);
    expect(hasKey(openGraph(meta), 'images')).toBe(false);
    expect(hasKey(meta, 'twitter')).toBe(false);
  });
});
