import { describe, expect, it, vi } from 'vitest';
import type { RaceResult } from '../core/race/raceSession';
import { passages } from '../data/passages';
import { createApi } from './endpoints';
import { ApiError, createHttpClient, PLAYER_TOKEN_HEADER, type FetchLike } from './http';
import { loadPassage } from './passageSource';
import { initialSubmissionState, submitRaceResult, toSubmitRequest } from './resultSubmission';
import { createSessionStore, PLAYER_STORAGE_KEY, type KeyValueStorage } from './session';
import type { ClaimNicknameResponse } from './types';

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const claim: ClaimNicknameResponse = { player: { id: 'p1', nickname: 'rina' }, playerToken: 'token-rahasia' };

const json = (status: number, body?: unknown): Response =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });

/** Fetch palsu: mencatat request dan menjawab sesuai handler. */
function fakeFetch(handler: (path: string, init: RequestInit) => Response) {
  const calls: { path: string; init: RequestInit }[] = [];
  const fn: FetchLike = async (input, init = {}) => {
    const path = input.replace('http://api', '');
    calls.push({ path, init });
    return handler(path, init);
  };
  return { fn, calls };
}

const header = (init: RequestInit, name: string): string | undefined => (init.headers as Record<string, string>)[name];

const finished: RaceResult = {
  passageId: 'id-easy-1',
  status: 'finished',
  wpm: 61,
  accuracy: 0.97,
  netWpm: 59.2,
  durationMs: 21_000,
  correctChars: 100,
  totalChars: 100,
  log: [
    { key: 'P', t: 210 },
    { key: 'a', t: 400 },
  ],
};

describe('Nickname pemain (ACC-1)', () => {
  it('ACC_1_KlaimNickname_TokenDisimpanDiBrowser', async () => {
    const storage = memoryStorage();
    const session = createSessionStore(storage);
    const { fn, calls } = fakeFetch(() => json(201, claim));
    const api = createApi(createHttpClient('http://api', session, fn), session);

    await api.claimNickname('rina');
    const restored = createSessionStore(storage).getSnapshot();

    expect(calls[0]?.path).toBe('/players');
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ nickname: 'rina' });
    expect(restored.player?.nickname).toBe('rina');
    expect(restored.playerToken).toBe('token-rahasia');
  });

  it('ACC_1_NicknameDipakai_409_SesiTidakBerubah', async () => {
    const session = createSessionStore(memoryStorage());
    const { fn } = fakeFetch(() => json(409, { status: 409, title: 'Nickname sudah dipakai' }));
    const api = createApi(createHttpClient('http://api', session, fn), session);

    await expect(api.claimNickname('rina')).rejects.toMatchObject({ status: 409 });
    expect(session.getSnapshot().player).toBeNull();
  });

  it('ACC_1_RequestPemain_MengirimHeaderToken', async () => {
    const session = createSessionStore(memoryStorage());
    session.setPlayer(claim);
    const { fn, calls } = fakeFetch(() => json(200, { totalRaces: 2 }));
    const api = createApi(createHttpClient('http://api', session, fn), session);

    await api.getStats();

    expect(header(calls[0]!.init, PLAYER_TOKEN_HEADER)).toBe('token-rahasia');
    expect(header(calls[0]!.init, 'Authorization')).toBeUndefined();
  });

  it('ACC_1_TokenPemainDitolak401_NicknameDilupakan', async () => {
    const storage = memoryStorage();
    const session = createSessionStore(storage);
    session.setPlayer(claim);
    const { fn } = fakeFetch(() => json(401));
    const api = createApi(createHttpClient('http://api', session, fn), session);

    await expect(api.verifyPlayer()).rejects.toMatchObject({ status: 401 });
    expect(session.getSnapshot().player).toBeNull();
    expect(storage.data.has(PLAYER_STORAGE_KEY)).toBe(false);
  });

  it('ACC_1_ServerMati_NicknameTetapDisimpan', async () => {
    const session = createSessionStore(memoryStorage());
    session.setPlayer(claim);
    const api = createApi(createHttpClient('http://api', session, () => Promise.reject(new Error('offline'))), session);

    await expect(api.verifyPlayer()).rejects.toMatchObject({ status: 0 });
    expect(session.getSnapshot().player?.nickname).toBe('rina');
  });

  it('ACC_1_LupakanNickname_HanyaDiBrowser', () => {
    const storage = memoryStorage();
    const session = createSessionStore(storage);
    session.setPlayer(claim);
    const api = createApi(createHttpClient('http://api', session, () => Promise.reject(new Error('tidak dipanggil'))), session);

    api.forgetNickname();

    expect(session.getSnapshot().playerToken).toBeNull();
    expect(storage.data.has(PLAYER_STORAGE_KEY)).toBe(false);
  });
});

describe('Pengiriman hasil (RES-1, RES-2, RES-3)', () => {
  it('RES_1_TamuTidakMengirimHasil', () => {
    expect(initialSubmissionState(finished, false)).toEqual({ kind: 'guest' });
  });

  it('RES_1_PemainLogin_HasilSelesaiDikirim', async () => {
    expect(initialSubmissionState(finished, true)).toEqual({ kind: 'sending' });
    const submitResult = vi.fn().mockResolvedValue({ id: 1, netWpm: 59.2, isValid: true });

    const state = await submitRaceResult({ submitResult }, finished);

    expect(submitResult).toHaveBeenCalledWith({ passageId: 'id-easy-1', mode: 'bot', durationMs: 21_000, log: finished.log });
    expect(state.kind).toBe('saved');
  });

  it('RES_1_BalapanTimeout_TidakDikirim', () => {
    expect(initialSubmissionState({ ...finished, status: 'timeout' }, true)).toEqual({ kind: 'not-submitted' });
  });

  it('RES_2_RequestTidakMengirimAngkaKlien', () => {
    const request = toSubmitRequest(finished);

    expect(Object.keys(request).sort()).toEqual(['durationMs', 'log', 'mode', 'passageId']);
    expect(request.mode).toBe('bot');
  });

  it('RES_3_HasilDitolak_AlasanDiterjemahkan', async () => {
    const submitResult = vi.fn().mockRejectedValue(
      new ApiError(400, { title: 'Hasil ditolak', reason: 'WpmTooHigh', detail: 'WPM melebihi batas kewajaran.' }),
    );

    const state = await submitRaceResult({ submitResult }, finished);

    expect(state).toEqual({ kind: 'rejected', reason: 'WpmTooHigh', message: 'Kecepatan melebihi batas wajar.' });
  });
});

describe('Sumber teks (PAS-1)', () => {
  it('PAS_1_PakaiTeksDariApi', async () => {
    const getRandomPassage = vi.fn().mockResolvedValue({
      id: 'id-easy-abc12345',
      text: 'Teks baru dari admin.',
      language: 'id',
      difficulty: 'easy',
    });

    const passage = await loadPassage({ getRandomPassage }, 'id', 'easy');

    expect(getRandomPassage).toHaveBeenCalledWith('id', 'easy');
    expect(passage.id).toBe('id-easy-abc12345');
  });

  it('PAS_1_ApiGagal_PakaiTeksLokal', async () => {
    const getRandomPassage = vi.fn().mockRejectedValue(new ApiError(0, { title: 'offline' }));

    const passage = await loadPassage({ getRandomPassage }, 'en', 'hard', undefined, () => 0);

    expect(passages).toContainEqual(passage);
    expect(passage.language).toBe('en');
    expect(passage.difficulty).toBe('hard');
  });

  it('PAS_1_JawabanApiTidakValid_PakaiTeksLokal', async () => {
    const getRandomPassage = vi.fn().mockResolvedValue({ id: 'x', text: 'kopi ☕', language: 'id', difficulty: 'easy' });

    const passage = await loadPassage({ getRandomPassage }, 'id', 'easy');

    expect(passages).toContainEqual(passage);
  });
});
