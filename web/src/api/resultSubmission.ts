import type { RaceResult } from '../core/race/raceSession';
import type { Api } from './endpoints';
import { ApiError } from './http';
import type { ResultResponse, SubmitResultRequest } from './types';

/** Status pengiriman hasil untuk layar hasil. */
export type SubmissionState =
  | { readonly kind: 'guest' }
  | { readonly kind: 'not-submitted' }
  /** POL-2: hasil mode latihan tidak dikirim (teksnya bukan passage di server). */
  | { readonly kind: 'practice' }
  | { readonly kind: 'sending' }
  | { readonly kind: 'saved'; readonly result: ResultResponse }
  | { readonly kind: 'rejected'; readonly reason: string; readonly message: string }
  | { readonly kind: 'error'; readonly message: string };

/** Pesan penolakan (RES-3) dalam bahasa Indonesia, berdasarkan kode alasan dari server. */
export const rejectMessages: Readonly<Record<string, string>> = {
  NotFinished: 'Log ketikan tidak menghasilkan teks yang sama sampai selesai.',
  TimeNotMonotonic: 'Urutan waktu ketikan tidak wajar.',
  TimeLimitExceeded: 'Waktu ketikan melewati batas waktu balapan.',
  DurationMismatch: 'Durasi tidak cocok dengan log ketikan.',
  WpmTooHigh: 'Kecepatan melebihi batas wajar.',
  InhumanRhythm: 'Ritme ketikan tidak wajar untuk manusia.',
};

/**
 * RES-1: hanya pemain dengan nickname yang menyelesaikan teks yang mengirim hasil. Tamu tetap bisa bermain
 * tetapi hasilnya tidak dikirim. Balapan yang kena batas waktu tidak dikirim (server akan menolaknya).
 */
export function initialSubmissionState(result: RaceResult, hasNickname: boolean, practice = false): SubmissionState {
  if (practice) return { kind: 'practice' };
  if (!hasNickname) return { kind: 'guest' };
  if (result.status !== 'finished') return { kind: 'not-submitted' };
  return { kind: 'sending' };
}

/** RES-2: yang dikirim hanya id teks, mode, durasi, dan log. WPM/akurasi dihitung ulang server. */
export function toSubmitRequest(result: RaceResult): SubmitResultRequest {
  return {
    passageId: result.passageId,
    mode: 'bot',
    durationMs: result.durationMs,
    log: result.log.map((k) => ({ key: k.key, t: k.t })),
  };
}

export async function submitRaceResult(api: Pick<Api, 'submitResult'>, result: RaceResult): Promise<SubmissionState> {
  try {
    const saved = await api.submitResult(toSubmitRequest(result));
    return { kind: 'saved', result: saved };
  } catch (e) {
    if (e instanceof ApiError && e.status === 400 && e.problem.reason) {
      const reason = e.problem.reason;
      return { kind: 'rejected', reason, message: rejectMessages[reason] ?? e.message };
    }
    if (e instanceof ApiError && e.status === 401) {
      return { kind: 'error', message: 'Nickname tidak dikenali server lagi. Pilih nickname baru untuk menyimpan hasil berikutnya.' };
    }
    return { kind: 'error', message: e instanceof Error ? e.message : 'Gagal mengirim hasil.' };
  }
}
