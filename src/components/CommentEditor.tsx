'use client';

import { useEffect, useRef, useState } from 'react';
import { hasComment } from '@/lib/comment';
import FilmComment from './FilmComment';

/** Комментарий владельца с правкой на месте.
 *
 *  О базе и о серверном действии не знает ничего: сохранение приходит пропсом
 *  и отвечает только «сохранилось или нет». Путь записи личных полей один, и он
 *  живёт там же, где остальные, — в секции «Моё».
 *
 *  Комментария нет — поле открыто всегда, отдельного состояния для этого
 *  не нужно: отменять там нечего, и кнопки «Отмена» нет. */
export default function CommentEditor({
  comment,
  onSave,
}: {
  comment: string | null;
  onSave: (text: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);

  const written = hasComment(comment);
  const open = !written || editing;

  // Щёлкнув «Редактировать», человек уже сказал, что хочет писать: второе движение
  // мышью в само поле было бы данью механике. На первом показе фокус не трогаем —
  // поле у тайтла без комментария открыто само, и утаскивать в него страницу нельзя.
  useEffect(() => {
    if (editing) field.current?.focus();
  }, [editing]);

  function startEditing() {
    setDraft(comment ?? '');
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
  }

  async function save() {
    if (await onSave(draft)) setEditing(false);
    // При отказе поле остаётся открытым, а набранное — в нём: это то, что человек
    // только что написал и ещё не отдал.
  }

  if (!open) {
    return (
      <FilmComment
        comment={comment}
        action={
          <button
            type="button"
            onClick={startEditing}
            className="shrink-0 px-2.5 py-1 text-xs font-extrabold uppercase tracking-wide shadow-[inset_0_0_0_1px_var(--ink)] transition-colors duration-150 hover:text-vermilion"
          >
            Редактировать
          </button>
        }
      />
    );
  }

  // Пустоту поверх пустоты сохранять нечего; поверх написанного — можно, это и есть
  // единственный способ снять комментарий.
  const nothingToSave = draft.trim() === '' && !written;

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="comment" className="text-sm text-ink-soft">
        Комментарий
      </label>
      <textarea
        id="comment"
        ref={field}
        rows={4}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && written) {
            cancel();
            return;
          }
          // Одиночный Enter переносит строку: комментарий бывает в несколько абзацев,
          // и сохранение по нему закрыло бы поле на первом же.
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !nothingToSave) {
            void save();
          }
        }}
        className="w-full max-w-[65ch] resize-y border border-hairline bg-paper p-3 leading-relaxed focus:border-ink focus:outline-none"
      />
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => void save()}
          disabled={nothingToSave}
          className="px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide shadow-[inset_0_0_0_1px_var(--ink)] transition-colors duration-150 enabled:hover:text-vermilion disabled:cursor-not-allowed disabled:text-ink-soft/50 disabled:shadow-[inset_0_0_0_1px_var(--hairline)]"
        >
          Сохранить
        </button>
        {written && (
          <button
            type="button"
            onClick={cancel}
            className="text-xs font-extrabold uppercase tracking-wide text-ink-soft transition-colors duration-150 hover:text-vermilion"
          >
            Отмена
          </button>
        )}
      </div>
    </div>
  );
}
