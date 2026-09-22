export type PersonalPatch = {
  watched?: boolean;
  wantToWatch?: boolean;
  myRating?: number | null;
  tasteStar?: boolean;
  // `null` означает «комментария нет»: пустую строку валидатор до базы не доводит.
  comment?: string | null;
};

type ValidationResult = { ok: true; patch: PersonalPatch } | { ok: false; error: string };

export function validatePersonalPatch(input: unknown): ValidationResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, error: 'Ожидается объект с личными полями' };
  }
  const source = input as Record<string, unknown>;
  const patch: PersonalPatch = {};

  if ('watched' in source) {
    if (typeof source.watched !== 'boolean') {
      return { ok: false, error: 'Отметка «посмотрел» — да или нет' };
    }
    patch.watched = source.watched;
  }

  if ('wantToWatch' in source) {
    if (typeof source.wantToWatch !== 'boolean') {
      return { ok: false, error: 'Отметка «хочу посмотреть» — да или нет' };
    }
    patch.wantToWatch = source.wantToWatch;
  }

  if ('myRating' in source) {
    const rating = source.myRating;
    const valid =
      rating === null ||
      (typeof rating === 'number' && Number.isInteger(rating) && rating >= 1 && rating <= 10);
    if (!valid) {
      return { ok: false, error: 'Оценка — целое число от 1 до 10' };
    }
    patch.myRating = rating as number | null;
  }

  if ('tasteStar' in source) {
    if (typeof source.tasteStar !== 'boolean') {
      return { ok: false, error: 'Звёздочка вкуса — да или нет' };
    }
    patch.tasteStar = source.tasteStar;
  }

  if ('comment' in source) {
    if (typeof source.comment !== 'string') {
      return { ok: false, error: 'Комментарий — текст' };
    }
    // Пустой комментарий хранится как `null`, а не пустой строкой: с v14 от этой
    // разницы зависит, показывать блок читателю или нет, и два неотличимых состояния
    // «пусто» стали бы двумя ветками там, где нужна одна. Обрезка краёв заодно чинит
    // хвост из переносов, который остаётся, когда абзац стирают не до конца.
    const text = source.comment.trim();
    patch.comment = text === '' ? null : text;
  }

  return { ok: true, patch };
}
