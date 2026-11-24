/** Kunci khusus untuk menghapus karakter salah. */
export const BACKSPACE = 'Backspace';

/** Satu penekanan tombol: karakter (1 huruf) atau 'Backspace', dan waktu dalam ms sejak balapan mulai. */
export interface Keystroke {
  readonly key: string;
  readonly t: number;
}

export type KeyResult = 'correct' | 'incorrect' | 'backspace' | 'ignored';

export interface TypingState {
  readonly text: string;
  /** Jumlah karakter benar yang sudah terkunci (indeks karakter berikutnya). */
  readonly cursor: number;
  /** Karakter salah yang belum dihapus; selama tidak kosong kursor tidak maju. */
  readonly errorBuffer: string;
  readonly correctKeystrokes: number;
  /** Total penekanan tombol karakter (Backspace tidak dihitung). */
  readonly totalKeystrokes: number;
  /** Waktu (ms) setiap kali kursor maju; dipakai WPM jendela geser. */
  readonly correctCharTimes: readonly number[];
  /** Semua keystroke yang diterima mesin, berurutan. */
  readonly log: readonly Keystroke[];
  readonly finishedAtMs: number | null;
  readonly lastResult: KeyResult;
}

export interface TypingStats {
  readonly correctChars: number;
  readonly wpm: number;
  /** 0..1 */
  readonly accuracy: number;
  readonly netWpm: number;
  /** 0..1, persentase teks yang sudah benar. */
  readonly progress: number;
  readonly elapsedMs: number;
}

export type CharStatus = 'correct' | 'incorrect' | 'current' | 'pending';
