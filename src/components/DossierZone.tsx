import DossierSection from './DossierSection';
import RichText from './RichText';
import SourceList from './SourceList';
import type { Film } from '@/db/schema';
import {
  DOSSIER_BLOCK_LABELS,
  defaultOpenBlocks,
  dossierFreshness,
  hasDossier,
  sortedSections,
  type DossierBlock,
  type DossierFragment,
  type SortedFragment,
} from '@/lib/dossier';
import { formatDateRu, pluralSources } from '@/lib/format';
import { filmStatus, isReleased } from '@/lib/status';

function Fragments({ items }: { items: SortedFragment[] }) {
  return (
    <>
      {items.map(({ section, body }) => (
        <div key={section.key} className="border-t border-hairline pt-4">
          <h3 className="text-xs uppercase tracking-wide text-ink-soft">{section.label}</h3>
          <div className="mt-3">
            <RichText nodes={body} />
          </div>
        </div>
      ))}
    </>
  );
}

/** Агентская зона карточки: два блока досье и список источников.
 *
 *  Серверный компонент — статус и свежесть считает сам из пропов, в базу не ходит.
 *  Отсюда `today` явным пропом: так зона детерминированна и проверяема. */
export default function DossierZone({ film, today }: { film: Film; today: string }) {
  if (!hasDossier(film)) return null;

  const status = filmStatus(film, today);
  const open = defaultOpenBlocks(status);
  const freshness = dossierFreshness(film, today);

  // У невышедшего фильма разбора не бывает: собрать его было неоткуда, и заглушкой
  // он не заменяется — сообщать на месте секции нечего. Проверяется именно выход,
  // а не статус: с v5 невышедший тайтл без галочки «хочу посмотреть» — «Другое».
  const released = isReleased(film.releaseDate, today);

  const blocks: [DossierBlock, DossierFragment[] | null][] = [
    ['before', film.dossierBefore],
    ['keys', released ? film.dossierKeys : null],
    ['after', released ? film.dossierAfter : null],
  ];

  const sources = film.dossierSources;

  return (
    <>
      {/* Дата поиска сама по себе ни на один вопрос читателя не отвечает и только
          занимала первую строку зоны. Остаётся предупреждение: оно единственный
          способ узнать, что разбора нет и не будет, пока агента не запустят снова. */}
      {freshness === 'stale' && (
        <p className="text-sm text-ink-soft tabular-nums">
          Материалы собраны {formatDateRu(film.dossierSearchedAt!)}, до выхода фильма — пора
          обновить
        </p>
      )}

      {blocks.map(([block, fragments]) => {
        if (fragments === null) return null;
        const items = sortedSections(block, fragments);
        if (items.length === 0) return null;

        // У блока ключей одна рубрика, и её заголовок — это заголовок полосы:
        // печатать его вторым разом незачем, а на месте перечня рубрик стоит
        // предупреждение — оно объясняет, почему полоса закрыта, когда соседняя нет.
        const keys = block === 'keys';

        return (
          <DossierSection
            key={block}
            title={DOSSIER_BLOCK_LABELS[block]}
            hint={keys ? 'есть спойлеры' : items.map(({ section }) => section.label).join(' · ')}
            defaultOpen={open.includes(block)}
            tone={keys ? 'accent' : 'plain'}
          >
            {keys ? <RichText nodes={items[0].body} /> : <Fragments items={items} />}
          </DossierSection>
        );
      })}

      {sources !== null && sources.length > 0 && (
        <DossierSection title="Источники" hint={pluralSources(sources.length)} defaultOpen={false} minor>
          <SourceList sources={sources} />
        </DossierSection>
      )}
    </>
  );
}
