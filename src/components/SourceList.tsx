import type { DossierSource } from '@/lib/dossier';

/** Список источников. Один и тот же у досье к фильму и у материалов о создателе:
 *  и там и там это отчёт агента о том, откуда он всё взял. */
export default function SourceList({ sources }: { sources: DossierSource[] }) {
  return (
    <div>
      {sources.map((source) => (
        <a
          key={source.url}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col gap-1 border-b border-hairline py-2.5 no-underline transition-colors duration-150 first:border-t hover:text-vermilion sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
        >
          {/* Ниже sm издание и заголовок стоят друг под другом. В строку они там не
              помещаются: издание не сжимается, и пара из длинного издания и длинного
              заголовка выносила страницу за правый край. Перенос заголовка на новую
              строку флексбоксом эту пару чинит, но заодно разносит по двум строкам
              всё длинное и на широком экране — поэтому раскладка меняется по ширине,
              а не по длине содержимого. */}
          <span className="shrink-0 text-xs uppercase tracking-wide text-ink-soft">
            {source.publication}
          </span>
          <span className="font-extrabold sm:text-right">{source.title}</span>
        </a>
      ))}
    </div>
  );
}
