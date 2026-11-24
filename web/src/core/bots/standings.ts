import { computeWpm } from '../typing/metrics';

export type RacerKind = 'player' | 'bot' | 'ghost';

export interface Racer {
  readonly id: string;
  readonly name: string;
  readonly kind: RacerKind;
  readonly color: string;
  /** Waktu selesai (ms sejak mulai), atau null bila tidak selesai. */
  readonly finishMs: number | null;
  /** Karakter benar yang tercapai (dipakai untuk mengurutkan yang tidak selesai). */
  readonly correctChars: number;
  readonly totalChars: number;
}

export interface Standing extends Racer {
  readonly position: number;
  readonly finished: boolean;
  readonly wpm: number;
}

/**
 * BOT-5: peringkat akhir mengikuti urutan finis. Yang tidak selesai (atau lewat batas waktu)
 * di belakang semua yang selesai, diurutkan menurut progres; pemain yang tidak selesai selalu terakhir.
 */
export function computeStandings(racers: readonly Racer[], timeLimitMs: number): Standing[] {
  const isFinished = (r: Racer): boolean => r.finishMs !== null && r.finishMs <= timeLimitMs;
  const rankKey = (r: Racer): [number, number] => {
    if (isFinished(r)) return [0, r.finishMs!];
    if (r.kind === 'player') return [2, 0];
    return [1, -r.correctChars];
  };

  return [...racers]
    .sort((a, b) => {
      const ka = rankKey(a);
      const kb = rankKey(b);
      return ka[0] - kb[0] || ka[1] - kb[1];
    })
    .map((r, i) => {
      const finished = isFinished(r);
      return {
        ...r,
        position: i + 1,
        finished,
        wpm: finished ? computeWpm(r.totalChars, r.finishMs!) : computeWpm(r.correctChars, timeLimitMs),
      };
    });
}

/** Posisi pemain saat ini (1 = terdepan) dibanding karakter yang dicapai lawan. */
export function livePosition(playerChars: number, opponentChars: readonly number[]): number {
  return 1 + opponentChars.filter((c) => c > playerChars + 1e-9).length;
}
