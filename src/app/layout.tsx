import type { Metadata } from "next";
import { Golos_Text, PT_Serif } from "next/font/google";
import ScrollTop from "@/components/ScrollTop";
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "@/lib/site";
import "./globals.css";

const golos = Golos_Text({
  variable: "--font-golos",
  subsets: ["cyrillic", "latin"],
  weight: ["400", "800"],
});

// Антиква нужна ровно в одном месте — во врезке-цитате. Голос человека звучит
// в другом регистре, чем текст разбора, и раньше эту разницу держал полужирный:
// он спорил с подзаголовком и сам читался заголовком. Курсива у Golos Text нет
// вовсе, поэтому регистр даёт вторая гарнитура. PT Serif выбрана как русская
// антиква с настоящим, а не наклонённым браузером курсивом.
const ptSerif = PT_Serif({
  variable: "--font-pt-serif",
  subsets: ["cyrillic", "latin"],
  weight: ["400"],
  style: ["italic"],
});

// Open Graph прописан явно: без него мессенджеры собирают карточку ссылки сами —
// кто из `title` и `description`, кто из первого попавшегося текста страницы.
//
// `metadataBase` объявлен здесь и только здесь: после него страницы отдают пути
// к картинкам относительными, а Next разворачивает их в абсолютные сам. Склеивать
// адрес руками не надо больше нигде.
//
// Картинки у превью главной нет: страница со своим разделом (карточка фильма,
// персоналия) заменяет этот `openGraph` целиком, а не сливает — так у тайтла без
// постера превью остаётся без картинки, как и задумано в `pageMetadata`.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    type: "website",
    locale: "ru_RU",
    siteName: SITE_TITLE,
    url: SITE_URL,
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${golos.variable} ${ptSerif.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        {/* Кнопка возврата общая для всего сайта и от данных не зависит, поэтому
            живёт здесь, а не в каждой странице по отдельности. */}
        <ScrollTop />
      </body>
    </html>
  );
}
