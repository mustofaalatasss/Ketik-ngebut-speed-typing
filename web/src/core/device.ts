/** Fungsi media query; di browser = (q) => window.matchMedia(q).matches. */
export type MediaMatcher = (query: string) => boolean;

/**
 * POL-3: perangkat hanya layar sentuh (HP/tablet) = penunjuk utama kasar dan tidak ada penunjuk halus
 * sama sekali. Laptop dengan layar sentuh masih punya touchpad/mouse, jadi tidak dianggap layar sentuh saja.
 */
export function isTouchOnly(matches: MediaMatcher): boolean {
  return matches('(pointer: coarse)') && !matches('(any-pointer: fine)');
}

export function browserMatcher(): MediaMatcher {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => false;
  return (q) => window.matchMedia(q).matches;
}
