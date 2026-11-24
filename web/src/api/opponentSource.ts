import { createOpponents, opponentsConfigFor, type BotLevel, type GhostRecord, type Opponent } from '../core/bots/opponents';
import type { Api } from './endpoints';

export interface OpponentRequest {
  readonly text: string;
  readonly passageId: string;
  readonly level: BotLevel;
  readonly useGhost: boolean;
}

/**
 * BOT-4: menyiapkan 3 lawan untuk balapan. Bila ghost diminta dan pemain punya nickname,
 * rekor terbaiknya diambil dari server (BOT-3). Gagal mengambil (belum ada rekor, server mati)
 * tidak menghalangi balapan: lawan tetap 3 bot.
 */
export async function loadOpponents(
  api: Pick<Api, 'getGhost' | 'session'>,
  request: OpponentRequest,
  random: () => number = Math.random,
): Promise<Opponent[]> {
  let ghost: GhostRecord | null = null;
  if (request.useGhost && api.session.getSnapshot().playerToken) {
    try {
      const g = await api.getGhost(request.passageId);
      ghost = { text: g.text, log: g.log };
    } catch {
      ghost = null;
    }
  }
  return createOpponents(request.text, opponentsConfigFor(request.level), random, ghost);
}
