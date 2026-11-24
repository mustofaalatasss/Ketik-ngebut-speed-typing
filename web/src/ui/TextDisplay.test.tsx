// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { TypingView } from '../game/raceController';
import { createStore, shallowEqual } from '../game/store';
import { TextDisplay } from './TextDisplay';

afterEach(() => cleanup());

describe('Tampilan teks (TYP-1)', () => {
  it('TYP_1_TextDisplay_BenarHijauSalahMerah', () => {
    const store = createStore<TypingView>(
      { text: 'halo dunia', cursor: 0, errorCount: 0, typoCount: 0, finished: false },
      shallowEqual,
    );
    const { container } = render(<TextDisplay store={store} />);

    act(() => store.publish({ text: 'halo dunia', cursor: 3, errorCount: 2, typoCount: 1, finished: false }));

    expect(container.querySelector('.char-correct')?.textContent).toBe('hal');
    expect(container.querySelector('.char-incorrect')?.textContent).toBe('o ');
    expect(container.querySelector('.char-current')).toBeNull();
    expect(container.querySelector('.char-pending')?.textContent).toBe('dunia');
    expect(screen.getByTestId('text-display').textContent).toBe('halo dunia');

    act(() => store.publish({ text: 'halo dunia', cursor: 3, errorCount: 0, typoCount: 1, finished: false }));
    expect(container.querySelector('.char-current')?.textContent).toBe('o');
    expect(container.querySelector('.char-pending')?.textContent).toBe(' dunia');
  });
});
