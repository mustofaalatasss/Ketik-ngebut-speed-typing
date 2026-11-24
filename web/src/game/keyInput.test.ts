import { describe, expect, it } from 'vitest';
import { toTypingKey } from './keyInput';

const ev = (key: string, extra: Partial<{ ctrlKey: boolean; altKey: boolean; metaKey: boolean; repeat: boolean }> = {}) => ({
  key,
  ctrlKey: false,
  altKey: false,
  metaKey: false,
  ...extra,
});

describe('Penerjemah tombol (TYP-1)', () => {
  it('TYP_1_KeyInput_KarakterDanBackspaceDiterima', () => {
    expect(toTypingKey(ev('a'))).toBe('a');
    expect(toTypingKey(ev('A'))).toBe('A');
    expect(toTypingKey(ev(' '))).toBe(' ');
    expect(toTypingKey(ev('Backspace'))).toBe('Backspace');
    expect(toTypingKey(ev('Backspace', { repeat: true }))).toBe('Backspace');
  });

  it('TYP_1_KeyInput_TombolKhususDanPintasanDiabaikan', () => {
    expect(toTypingKey(ev('Shift'))).toBeNull();
    expect(toTypingKey(ev('F5'))).toBeNull();
    expect(toTypingKey(ev('Enter'))).toBeNull();
    expect(toTypingKey(ev('c', { ctrlKey: true }))).toBeNull();
    expect(toTypingKey(ev('a', { repeat: true }))).toBeNull();
  });
});
