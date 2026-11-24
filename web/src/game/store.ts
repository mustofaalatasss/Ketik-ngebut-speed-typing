/**
 * Store kecil di luar React, cocok dengan useSyncExternalStore.
 * Komponen hanya render ulang saat publish() memberi snapshot yang berbeda.
 */
export interface Store<T> {
  getSnapshot(): T;
  subscribe(listener: () => void): () => void;
  publish(next: T): void;
}

export function createStore<T>(initial: T, isEqual: (a: T, b: T) => boolean = Object.is): Store<T> {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    publish(next) {
      if (isEqual(current, next)) return;
      current = next;
      listeners.forEach((l) => l());
    },
  };
}

/** Membandingkan objek datar (satu tingkat). */
export function shallowEqual<T extends object>(a: T, b: T): boolean {
  const ka = Object.keys(a) as (keyof T)[];
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => Object.is(a[k], b[k]));
}
