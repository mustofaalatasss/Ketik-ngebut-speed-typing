/** DTO API backend (lihat src/KetikNgebut.Application). Nama field mengikuti JSON camelCase dari server. */

export interface PlayerDto {
  readonly id: string;
  readonly nickname: string;
}

/** Token pemain hanya dikirim sekali saat nickname diklaim. */
export interface ClaimNicknameResponse {
  readonly player: PlayerDto;
  readonly playerToken: string;
}

export interface PassageDto {
  readonly id: string;
  readonly text: string;
  readonly language: string;
  readonly difficulty: string;
}

export interface SubmitResultRequest {
  readonly passageId: string;
  /** Jenis balapan (model data RaceResult.Mode). Setiap balapan berisi 3 lawan bot (BOT-4), jadi 'bot'. */
  readonly mode: 'bot';
  readonly durationMs: number;
  readonly log: readonly { readonly key: string; readonly t: number }[];
}

export interface ResultResponse {
  readonly id: number;
  readonly passageId: string;
  readonly wpm: number;
  readonly accuracy: number;
  readonly netWpm: number;
  readonly durationMs: number;
  readonly correctChars: number;
  readonly totalKeystrokes: number;
  readonly createdAt: string;
  readonly isValid: boolean;
}

export type LeaderboardPeriod = 'daily' | 'weekly' | 'all';

export interface LeaderboardEntry {
  readonly rank: number;
  readonly nickname: string;
  readonly netWpm: number;
  readonly wpm: number;
  readonly accuracy: number;
  readonly createdAt: string;
}

export interface LeaderboardResponse {
  readonly period: LeaderboardPeriod;
  readonly from: string | null;
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly items: readonly LeaderboardEntry[];
}

export interface StatsPoint {
  readonly createdAt: string;
  readonly wpm: number;
  readonly netWpm: number;
  readonly accuracy: number;
}

export interface StatsResponse {
  readonly totalRaces: number;
  readonly averageWpm: number;
  readonly bestWpm: number;
  readonly averageNetWpm: number;
  readonly bestNetWpm: number;
  readonly averageAccuracy: number;
  readonly history: readonly StatsPoint[];
}

/** BOT-3: rekaman rekor terbaik untuk mode ghost. */
export interface GhostResponse {
  readonly resultId: number;
  readonly passageId: string;
  readonly text: string;
  readonly log: readonly { readonly key: string; readonly t: number }[];
  readonly netWpm: number;
  readonly durationMs: number;
  readonly samePassage: boolean;
}

/** POL-2: ketepatan per huruf. missRate = misses / (hits + misses). */
export interface KeyStatDto {
  readonly character: string;
  readonly hits: number;
  readonly misses: number;
  readonly missRate: number;
}

/** POL-4: pengaturan pemain di server. */
export interface SettingsDto {
  readonly language: string;
  readonly difficulty: string;
  readonly botLevel: string;
  readonly carColor: string;
  readonly useGhost: boolean;
  readonly muted: boolean;
}

/** ProblemDetails (RFC 9457) dari server. */
export interface ProblemDetails {
  readonly status?: number;
  readonly title?: string;
  readonly detail?: string;
  readonly errors?: Readonly<Record<string, readonly string[]>>;
  readonly reason?: string;
}
