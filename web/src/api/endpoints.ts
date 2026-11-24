import { createHttpClient, type FetchLike, type HttpClient } from './http';
import { createSessionStore, type SessionStore } from './session';
import type {
  ClaimNicknameResponse,
  GhostResponse,
  KeyStatDto,
  SettingsDto,
  LeaderboardPeriod,
  LeaderboardResponse,
  PassageDto,
  PlayerDto,
  ResultResponse,
  StatsResponse,
  SubmitResultRequest,
} from './types';

export interface Api {
  readonly session: SessionStore;
  /** ACC-1: klaim nickname; token pemain disimpan otomatis di browser. */
  claimNickname(nickname: string): Promise<ClaimNicknameResponse>;
  /** Mengecek apakah token pemain di browser ini masih dikenali server (401 -> nickname dilupakan). */
  verifyPlayer(): Promise<PlayerDto>;
  /** Menghapus nickname dari browser ini saja (server tidak diubah). */
  forgetNickname(): void;
  getRandomPassage(language: string, difficulty: string): Promise<PassageDto>;
  submitResult(request: SubmitResultRequest): Promise<ResultResponse>;
  getLeaderboard(period: LeaderboardPeriod, page: number, pageSize: number): Promise<LeaderboardResponse>;
  getStats(): Promise<StatsResponse>;
  /** BOT-3: rekor terbaik untuk teks ini (atau keseluruhan). 404 bila belum ada rekor. */
  getGhost(passageId: string): Promise<GhostResponse>;
  /** POL-2: statistik per huruf, huruf paling sering salah lebih dulu. */
  getKeys(): Promise<KeyStatDto[]>;
  /** POL-4: pengaturan pemain. */
  getSettings(): Promise<SettingsDto>;
  saveSettings(settings: SettingsDto): Promise<SettingsDto>;
}

export function createApi(http: HttpClient, session: SessionStore): Api {
  return {
    session,
    async claimNickname(nickname) {
      const claim = await http.request<ClaimNicknameResponse>('POST', '/players', { body: { nickname } });
      session.setPlayer(claim);
      return claim;
    },
    verifyPlayer: () => http.request<PlayerDto>('GET', '/players/me', { auth: 'player' }),
    forgetNickname: () => session.clearPlayer(),
    getRandomPassage: (language, difficulty) =>
      http.request<PassageDto>(
        'GET',
        `/passages/random?lang=${encodeURIComponent(language)}&difficulty=${encodeURIComponent(difficulty)}`,
      ),
    submitResult: (request) => http.request<ResultResponse>('POST', '/results', { body: request, auth: 'player' }),
    getLeaderboard: (period, page, pageSize) =>
      http.request<LeaderboardResponse>('GET', `/leaderboard?period=${period}&page=${page}&pageSize=${pageSize}`),
    getStats: () => http.request<StatsResponse>('GET', '/me/stats', { auth: 'player' }),
    getGhost: (passageId) =>
      http.request<GhostResponse>('GET', `/me/ghost?passageId=${encodeURIComponent(passageId)}`, { auth: 'player' }),
    getKeys: () => http.request<KeyStatDto[]>('GET', '/me/keys', { auth: 'player' }),
    getSettings: () => http.request<SettingsDto>('GET', '/me/settings', { auth: 'player' }),
    saveSettings: (settings) => http.request<SettingsDto>('PUT', '/me/settings', { body: settings, auth: 'player' }),
  };
}

/** Base URL API: VITE_API_URL saat build produksi, atau '/api' (diproksikan Vite ke backend saat dev). */
const baseUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

const fetchFn: FetchLike = (input, init) => fetch(input, init);
const defaultSession = createSessionStore(browserStorage());

export const api: Api = createApi(createHttpClient(baseUrl, defaultSession, fetchFn), defaultSession);
