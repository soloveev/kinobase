import type { PhotoCredit as PhotoCreditValue } from '@/lib/people';

const LINK =
  'font-extrabold underline decoration-ink-soft underline-offset-4 transition-colors duration-150 hover:text-vermilion';

/** Указание автора и лицензии у фотографии создателя. Правовое требование, а не
 *  оформление: снимки идут под CC BY или CC BY-SA, и показ разрешён только вместе
 *  с именем автора, ссылкой на текст лицензии и пометкой об изменении.
 *
 *  **Блок не сворачивается, и это тоже требование лицензии.** Список источников рядом
 *  свёрнут по умолчанию; спрятать под тот же кат указание автора значило бы формально
 *  его иметь, а фактически не показывать. Если однажды захочется «убрать лишнее под
 *  кат» — сюда нельзя, и тест на отсутствие `<details>` сломается шумно.
 *
 *  Требование целиком — в `research/LEGAL.md`. */
export default function PhotoCredit({ credit }: { credit: PhotoCreditValue }) {
  return (
    <section className="border-t border-hairline pt-4">
      <h2 className="text-sm font-extrabold uppercase tracking-wide">Фотография</h2>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        Автор —{' '}
        <a href={credit.fileUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
          {credit.author}
        </a>
        , лицензия{' '}
        <a href={credit.licenceUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
          {credit.licence}
        </a>
        .{credit.modified && ' Снимок изменён; производное распространяется на тех же условиях.'}
      </p>
    </section>
  );
}
