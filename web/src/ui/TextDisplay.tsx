import { gsap } from 'gsap';
import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import type { TypingView } from '../game/raceController';
import type { Store } from '../game/store';

interface TextDisplayProps {
  readonly store: Store<TypingView>;
}

/** Teks balapan: hijau = benar, merah = salah (harus di-Backspace), garis bawah = karakter berikutnya. */
export function TextDisplay({ store }: TextDisplayProps) {
  const view = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const boxRef = useRef<HTMLDivElement>(null);

  // GAM-2: umpan balik visual salah ketik (getar + kilat merah) memakai GSAP.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el || view.typoCount === 0) return;
    gsap.fromTo(el, { x: -8 }, { x: 0, duration: 0.35, ease: 'elastic.out(1, 0.3)' });
    gsap.fromTo(el, { boxShadow: '0 0 0 3px rgba(230,57,70,0.9)' }, { boxShadow: '0 0 0 0px rgba(230,57,70,0)', duration: 0.4 });
  }, [view.typoCount]);

  useLayoutEffect(() => {
    const el = boxRef.current;
    return () => {
      if (el) gsap.killTweensOf(el);
    };
  }, []);

  const { text, cursor, errorCount, finished } = view;
  const errorEnd = Math.min(text.length, cursor + errorCount);
  const hasCurrent = !finished && errorCount === 0 && cursor < text.length;

  return (
    <div className="text-display" ref={boxRef} data-testid="text-display">
      <span className="char-correct">{text.slice(0, cursor)}</span>
      <span className="char-incorrect">{text.slice(cursor, errorEnd)}</span>
      {errorCount > 0 && <span className="caret" aria-hidden="true" />}
      {hasCurrent && <span className="char-current">{text[cursor]}</span>}
      <span className="char-pending">{text.slice(hasCurrent ? cursor + 1 : errorEnd)}</span>
    </div>
  );
}
