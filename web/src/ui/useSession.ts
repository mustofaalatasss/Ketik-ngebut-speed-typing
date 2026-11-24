import { useSyncExternalStore } from 'react';
import type { SessionSnapshot, SessionStore } from '../api/session';

/** Membaca sesi login dari store di luar React; komponen re-render hanya saat sesi berubah. */
export function useSession(store: SessionStore): SessionSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
