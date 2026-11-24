import { describe, expect, it, vi } from 'vitest';
import { seededRandom } from '../core/util/random';
import { createSessionStore } from './session';
import { loadOpponents } from './opponentSource';
import type { GhostResponse } from './types';

const TEXT = 'aku suka kopi';
const ghost: GhostResponse = {
  resultId: 1,
  passageId: 'p1',
  text: TEXT,
  log: [...TEXT].map((key, i) => ({ key, t: (i + 1) * 150 })),
  netWpm: 80,
  durationMs: 1950,
  samePassage: true,
};

function sessionWithPlayer(hasPlayer: boolean) {
  const session = createSessionStore(null);
  if (hasPlayer) session.setPlayer({ player: { id: 'u1', nickname: 'rina' }, playerToken: 'tok' });
  return session;
}

describe('Menyiapkan lawan (BOT-3, BOT-4)', () => {
  it('BOT_3_Ghost_DiambilDariServerSaatDiminta', async () => {
    const getGhost = vi.fn(() => Promise.resolve(ghost));
    const opponents = await loadOpponents(
      { getGhost, session: sessionWithPlayer(true) },
      { text: TEXT, passageId: 'p1', level: 'intermediate', useGhost: true },
      seededRandom(1),
    );
    expect(getGhost).toHaveBeenCalledWith('p1');
    expect(opponents.map((o) => o.kind)).toEqual(['bot', 'ghost', 'bot']);
    expect(opponents[1]!.schedule.at(-1)).toBe(1950);
  });

  it('BOT_3_Ghost_GagalAtauTamu_TetapTigaBot', async () => {
    const failing = vi.fn(() => Promise.reject(new Error('404')));
    const viaError = await loadOpponents(
      { getGhost: failing, session: sessionWithPlayer(true) },
      { text: TEXT, passageId: 'p1', level: 'advanced', useGhost: true },
    );
    expect(viaError.map((o) => o.kind)).toEqual(['bot', 'bot', 'bot']);

    const neverCalled = vi.fn(() => Promise.resolve(ghost));
    const guest = await loadOpponents(
      { getGhost: neverCalled, session: sessionWithPlayer(false) },
      { text: TEXT, passageId: 'p1', level: 'advanced', useGhost: true },
    );
    expect(neverCalled).not.toHaveBeenCalled();
    expect(guest).toHaveLength(3);
  });
});
