import { applyKeystroke, createTypingState, type TypingOptions } from './typingEngine';
import type { Keystroke, TypingState } from './types';

/** Memutar ulang log keystroke dari awal (TYP-2). Algoritma ini yang nanti di-port ke server (RES-2). */
export function replay(
  text: string,
  log: readonly Keystroke[],
  options?: TypingOptions,
): TypingState {
  return log.reduce((state, ks) => applyKeystroke(state, ks, options), createTypingState(text));
}
