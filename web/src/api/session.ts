import type { ClaimNicknameResponse, PlayerDto } from './types';

/**
 * Sesi pemain di browser (ACC-1): nickname + token pemain rahasia, disimpan di localStorage. Token inilah
 * "kunci" nickname; bila hilang (ganti browser / hapus data), nickname tidak bisa dipakai lagi.
 * Risiko: script jahat (XSS) di halaman bisa membaca localStorage. Lihat catatan keamanan Fase 2.
 */
export interface SessionSnapshot {
  readonly player: PlayerDto | null;
  readonly playerToken: string | null;
}

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SessionStore {
  getSnapshot(): SessionSnapshot;
  subscribe(listener: () => void): () => void;
  setPlayer(claim: ClaimNicknameResponse): void;
  clearPlayer(): void;
}

export const PLAYER_STORAGE_KEY = 'ketikngebut.player';

/** Kunci lama dari versi yang masih punya login admin di frontend; dihapus agar tidak ada token tersisa. */
const LEGACY_ADMIN_STORAGE_KEY = 'ketikngebut.admin';

const empty: SessionSnapshot = { player: null, playerToken: null };

function load(storage: KeyValueStorage | null): SessionSnapshot {
  try {
    const raw = storage?.getItem(PLAYER_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<{ player: PlayerDto; playerToken: string }>;
    if (typeof parsed.playerToken !== 'string' || typeof parsed.player?.nickname !== 'string') return empty;
    return { player: parsed.player, playerToken: parsed.playerToken };
  } catch {
    return empty;
  }
}

export function createSessionStore(storage: KeyValueStorage | null): SessionStore {
  try {
    storage?.removeItem(LEGACY_ADMIN_STORAGE_KEY);
  } catch {
    // storage tidak bisa ditulis: abaikan
  }
  let snapshot = load(storage);
  const listeners = new Set<() => void>();

  const set = (next: SessionSnapshot): void => {
    snapshot = next;
    if (next.player && next.playerToken) {
      storage?.setItem(PLAYER_STORAGE_KEY, JSON.stringify({ player: next.player, playerToken: next.playerToken }));
    } else {
      storage?.removeItem(PLAYER_STORAGE_KEY);
    }
    listeners.forEach((l) => l());
  };

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setPlayer: (claim) => set({ player: claim.player, playerToken: claim.playerToken }),
    clearPlayer: () => set(empty),
  };
}
