import { BACKSPACE } from '../core/typing/types';

export interface KeyLike {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
  readonly repeat?: boolean;
}

/**
 * Menerjemahkan KeyboardEvent menjadi kunci mesin mengetik.
 * Hasil: satu karakter, 'Backspace', atau null (abaikan: Shift, F1, Ctrl+C, auto-repeat, dll.).
 */
export function toTypingKey(e: KeyLike): string | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (e.key === BACKSPACE) return BACKSPACE;
  if (e.repeat) return null;
  return [...e.key].length === 1 ? e.key : null;
}
