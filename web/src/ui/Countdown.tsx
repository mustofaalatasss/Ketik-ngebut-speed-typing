import { gsap } from 'gsap';
import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import type { PhaseView } from '../game/raceController';
import type { Store } from '../game/store';

/** TYP-4: angka 3-2-1 di tengah layar selama hitung mundur. */
export function Countdown({ store }: { readonly store: Store<PhaseView> }) {
  const { phase, countdown } = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const tween = gsap.fromTo(el, { scale: 1.8, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2)' });
    return () => {
      tween.kill();
    };
  }, [countdown]);

  if (phase !== 'countdown' || countdown <= 0) return null;
  return (
    <div className="countdown" ref={ref} data-testid="countdown" role="status">
      {countdown}
    </div>
  );
}
