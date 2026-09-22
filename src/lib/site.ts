import type { Metadata } from 'next';
import { siteConfig } from '@/site.config';

/** Значения — из `src/site.config.ts`; здесь только имена, которыми пользуется код. */
export const SITE_URL = siteConfig.url;
export const SITE_TITLE = siteConfig.title;
/** Имя владельца в именительном падеже; пустое — подпись «Владелец базы». */
export const SITE_AUTHOR = siteConfig.author;
/** Блог или канал владельца. Стоит в подвале и в подписи под комментарием — два места,
 *  значит один дом. `null` — имя набирается без ссылки. */
export const AUTHOR_LINK: string | null = siteConfig.authorLink;
export const SITE_DESCRIPTION = siteConfig.description;

/** Превью ссылки для мессенджеров и соцсетей. До одиннадцатой версии Open Graph был
 *  один на весь сайт, и ссылка на карточку разворачивалась в чате общим описанием —
 *  то есть не говорила, какой фильм послали.
 *
 *  Адреса остаются относительными: корневой layout объявляет `metadataBase`, и Next
 *  разворачивает их сам. Склеивать адрес руками не надо ни здесь, ни на страницах.
 *
 *  Пустого описания не бывает, и правило это живёт здесь, в одном месте, а не в трёх
 *  страницах: тайтл без аннотации получает описание сайта.
 *
 *  Картинки может не быть вовсе — и тогда ключа `images` нет, а не стоит заглушка.
 *  Пустое превью честнее одинаковой картинки у половины базы: мессенджер покажет
 *  обычную текстовую карточку. По той же причине без картинки не объявляется
 *  и `twitter`: `summary_large_image` обещает крупное изображение, которого нет. */
export function pageMetadata(input: {
  title: string;
  description: string | null;
  image: string | null;
  path: string;
}): Metadata {
  const description =
    input.description !== null && input.description.trim() !== ''
      ? input.description
      : SITE_DESCRIPTION;

  return {
    // Заголовок вкладки несёт имя сайта, а `og:title` — нет: в превью имя сайта
    // мессенджер печатает отдельной строкой из `og:site_name`, и приписка удвоилась бы.
    title: `${input.title} — ${SITE_TITLE}`,
    description,
    openGraph: {
      title: input.title,
      description,
      siteName: SITE_TITLE,
      url: input.path,
      type: 'article',
      locale: 'ru_RU',
      ...(input.image !== null ? { images: [input.image] } : {}),
    },
    ...(input.image !== null
      ? { twitter: { card: 'summary_large_image' as const, title: input.title, description } }
      : {}),
  };
}
