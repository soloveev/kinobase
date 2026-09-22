import Link from 'next/link';
import Collapsible from './Collapsible';
import RichText from './RichText';
import type { Method, WorkNote } from '@/lib/people';

/** Работа с уже разрешённой связью: страница сама искала фильм в базе по оригинальному
 *  названию и передала готовый идентификатор. Компонент от базы не зависит и потому
 *  проверяется без неё. */
export type MethodWork = WorkNote & { filmId: number | null };

function workLabel(work: MethodWork): string {
  return work.year === null ? work.title : `${work.title}, ${work.year}`;
}

/** Раздел «Творческий метод»: тезисы и проявление метода в отдельных произведениях.
 *
 *  Сам раздел и каждый метод целиком не сворачиваются и элемента управления не имеют:
 *  это главный текст страницы, и прятать его за щелчком значило бы прятать предмет.
 *  Сворачиваются только произведения под заголовком «Метод в произведениях» — там
 *  читатель ищет свою картину, а не читает все девять подряд. Правило целиком —
 *  в `research/CREATOR-FORMAT.md`, раздел «Что раскрыто, а что сворачивается». */
export default function MethodZone({
  methods,
  works,
}: {
  methods: Method[];
  works: MethodWork[];
}) {
  if (methods.length === 0 && works.length === 0) return null;

  // Единственный метод показывается под нейтральным «Методом»: собственного заголовка
  // у него нет и не нужно. Два и больше приходят со своими — валидатор этого требует.
  const single = methods.length === 1;

  return (
    <section>
      <h2 className="border-t-2 border-ink pt-5 text-sm font-extrabold uppercase tracking-wide">
        Творческий метод
      </h2>

      {methods.map((method, index) => (
        <div key={index} className="mt-8">
          <h3 className="text-xs uppercase tracking-wide text-ink-soft">
            {single ? 'Метод' : method.title}
          </h3>

          <div className="mt-4 flex flex-col gap-8">
            {method.theses.map((thesis, thesisIndex) => (
              <div key={thesisIndex}>
                {/* Формулировка — заголовок, а не полужирный абзац: она отвечает
                    за навигацию по разделу, и читатель ищет глазами именно её. */}
                <h4 className="text-lg font-extrabold leading-snug">{thesis.title}</h4>
                <div className="mt-2">
                  <RichText nodes={thesis.body} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {works.length > 0 && (
        <div className="mt-12">
          <h3 className="text-xs uppercase tracking-wide text-ink-soft">Метод в произведениях</h3>

          <div className="mt-4 flex flex-col gap-4">
            {works.map((work, index) => (
              <Collapsible key={index} title={workLabel(work)} level={4} minor>
                {/* Ссылка на карточку живёт внутри раскрытой работы, а не в её заголовке.
                    Заголовок теперь стоит в `<summary>`, и ссылка там конфликтовала бы
                    со сворачиванием: один щелчок и раскрывал бы секцию, и уводил
                    со страницы. */}
                {work.filmId !== null && (
                  <Link
                    href={`/films/${work.filmId}`}
                    className="self-start text-sm font-extrabold underline decoration-ink-soft underline-offset-4 transition-colors duration-150 hover:text-vermilion"
                  >
                    Смотреть карточку в базе
                  </Link>
                )}

                <RichText nodes={work.method} />

                {/* Список без заголовка намеренно: рубрики «а знаете ли вы» здесь нет,
                    факты говорят сами за себя. */}
                {work.facts.length > 0 && <RichText nodes={[{ type: 'ul', items: work.facts }]} />}
              </Collapsible>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
