export type NormalizeBoundedNameFailureReason = 'EMPTY' | 'TOO_LONG';

export type NormalizeBoundedNameResult =
  | { ok: true; value: string }
  | { ok: false; reason: NormalizeBoundedNameFailureReason };

export function normalizeBoundedName(
  value: string,
  maxLength: number,
): NormalizeBoundedNameResult {
  const normalized = value.trim();

  if (normalized.length === 0) {
    return { ok: false, reason: 'EMPTY' };
  }

  if (Array.from(normalized).length > maxLength) {
    return { ok: false, reason: 'TOO_LONG' };
  }

  return { ok: true, value: normalized };
}
