import { parseInline, type DossierNode } from '@/lib/dossier';

/** Разметка внутри строки: полужирный и ссылка. Разбор живёт в словаре, здесь
 *  только вёрстка — вариантов ровно три, и новый без правки словаря не появится. */
export function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((span, index) => {
        if (span.kind === 'bold') return <strong key={index}>{span.text}</strong>;
        if (span.kind === 'link')
          return (
            <a
              key={index}
              href={span.href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-ink-soft underline-offset-2 transition-colors duration-150 hover:text-vermilion"
            >
              {span.text}
            </a>
          );
        return <span key={index}>{span.text}</span>;
      })}
    </>
  );
}

/** Тело из узлов. Живёт отдельно от досье, потому что теми же узлами набраны тезисы
 *  метода и разборы работ на странице персоналии: вторая копия этой вёрстки разошлась
 *  бы с первой на третьем фильме. */
export default function RichText({ nodes }: { nodes: DossierNode[] }) {
  return (
    <>
      {nodes.map((node, index) => {
        if (node.type === 'h')
          return (
            <h4 key={index} className="mt-10 text-lg font-extrabold leading-snug first:mt-0">
              {node.text}
            </h4>
          );

        if (node.type === 'quote')
          // Врезка ломает колонку намеренно: голос создателя фильма — единственное
          // место, где говорят от первого лица, и читается он как остановка.
          //
          // Регистр держит антиква в курсиве, а не полужирный: полужирный спорил
          // с подзаголовком рубрики и сам читался заголовком, хотя цитата — речь,
          // а не рубрика.
          return (
            <blockquote key={index} className="my-10 text-center first:mt-0">
              <p className="font-serif text-[1.375rem] italic leading-snug">{node.text}</p>
              <footer className="mt-3 text-xs uppercase tracking-wide text-ink-soft">
                {node.author}
              </footer>
            </blockquote>
          );

        if (node.type === 'note')
          // Справка вводит в предмет того, кто ничего о нём не знает. Она не пункт
          // и не абзац: её читают до разбора, и потому она отбита фоном. Углы прямые —
          // как у плашек статуса. Линейки слева нет: фона довольно, а линейка добавляла
          // блоку голос, которого у справки нет — она говорит тем же тоном, что разбор.
          return (
            <aside
              key={index}
              data-note
              className="my-6 bg-sand px-5 py-4 leading-relaxed first:mt-0"
            >
              <Inline text={node.text} />
            </aside>
          );

        if (node.type === 'ul')
          return (
            <ul key={index} className="mt-3 flex flex-col gap-2 first:mt-0">
              {node.items.map((item, itemIndex) => (
                // Маркер — чернильный квадрат в 3px, а не глиф: углы прямые,
                // иконок из шрифта в этом мире нет.
                <li
                  key={itemIndex}
                  className="relative pl-5 leading-relaxed before:absolute before:left-0 before:top-[0.7em] before:h-[3px] before:w-[3px] before:bg-ink"
                >
                  <Inline text={item} />
                </li>
              ))}
            </ul>
          );

        return (
          <p key={index} className="mt-3 leading-relaxed first:mt-0">
            <Inline text={node.text} />
          </p>
        );
      })}
    </>
  );
}
