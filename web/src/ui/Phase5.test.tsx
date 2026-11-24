// @vitest-environment jsdom
import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine, type AudioContextLike, type SoundSink } from '../audio/audioEngine';
import { initialSubmissionState } from '../api/resultSubmission';
import { createSessionStore, type KeyValueStorage } from '../api/session';
import { DEFAULT_SETTINGS, loadSettings, normalizeSettings, saveSettings, SETTINGS_STORAGE_KEY } from '../api/settingsSource';
import type { SettingsDto } from '../api/types';
import { blipVoice, engineVoice } from '../core/audio/soundModel';
import { isTouchOnly } from '../core/device';
import { buildPracticeText, weakCharacters, wordPool } from '../core/practice/practiceText';
import type { RaceResult } from '../core/race/raceSession';
import { seededRandom } from '../core/util/random';
import { passages } from '../data/passages';
import { ManualScheduler } from '../game/testing/manualScheduler';
import type { RaceSceneLike } from '../scene/sceneTypes';
import { HelpScreen } from './HelpScreen';
import { RacePage } from './RacePage';
import { StartScreen } from './StartScreen';
import { WeakKeysPanel } from './WeakKeysPanel';

afterEach(() => cleanup());

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

/** AudioContext palsu: mencatat oscillator yang dibuat. */
function fakeAudioContext() {
  const param = () => ({ value: 0, setTargetAtTime: vi.fn(), setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
  const node = () => ({ connect: vi.fn((n: unknown) => n), disconnect: vi.fn() });
  const oscillators: { start: ReturnType<typeof vi.fn> }[] = [];
  const ctx = {
    currentTime: 0,
    state: 'running',
    destination: node(),
    createOscillator: vi.fn(() => {
      const o = { ...node(), type: 'sine', frequency: param(), start: vi.fn(), stop: vi.fn(), onended: null };
      oscillators.push(o);
      return o;
    }),
    createGain: vi.fn(() => ({ ...node(), gain: param() })),
    close: vi.fn(() => Promise.resolve()),
    resume: vi.fn(() => Promise.resolve()),
  };
  return { ctx: ctx as unknown as AudioContextLike, oscillators, close: ctx.close };
}

describe('Suara (POL-1)', () => {
  it('POL_1_FrekuensiMesinNaikDenganKecepatan', () => {
    const slow = engineVoice(0.1, true, false);
    const fast = engineVoice(0.9, true, false);

    expect(fast.frequency).toBeGreaterThan(slow.frequency);
    expect(fast.gain).toBeGreaterThan(slow.gain);
    expect(engineVoice(5, true, false).frequency).toBe(engineVoice(1, true, false).frequency); // dibatasi
  });

  it('POL_1_Bisukan_TidakAdaSuara', () => {
    expect(engineVoice(0.8, true, true).gain).toBe(0);
    expect(blipVoice('key', true)).toBeNull();
    expect(blipVoice('typo', true)).toBeNull();

    const fake = fakeAudioContext();
    const muted = new AudioEngine(true, () => fake.ctx);
    muted.blip('key');
    muted.blip('typo');
    muted.engine(0.9, true);
    expect(fake.oscillators).toHaveLength(0);
  });

  it('POL_1_TidakBisu_KetikanDanSalahKetikBerbunyi_LaluDibersihkan', () => {
    const fake = fakeAudioContext();
    const engine = new AudioEngine(false, () => fake.ctx);

    engine.blip('key');
    engine.blip('typo');
    engine.engine(0.5, true);
    engine.dispose();

    expect(fake.oscillators).toHaveLength(3);
    expect(fake.close).toHaveBeenCalledTimes(1);
  });

  it('POL_1_RacePage_KetikanMemanggilSuaraDanTombolBisukan', () => {
    const scheduler = new ManualScheduler();
    const sound: SoundSink = { engine: vi.fn(), blip: vi.fn(), setMuted: vi.fn(), dispose: vi.fn() };
    const scene: RaceSceneLike = { update: vi.fn(), resize: vi.fn(), dispose: vi.fn() };
    const onToggleMute = vi.fn();
    const { unmount } = render(
      <RacePage
        passage={{ id: 't1', language: 'id', difficulty: 'easy', text: 'ab' }}
        carColor="#ff0000"
        onFinish={vi.fn()}
        createScene={() => scene}
        scheduler={scheduler}
        clock={() => scheduler.nowMs}
        createSound={() => sound}
        muted={false}
        onToggleMute={onToggleMute}
      />,
    );

    act(() => scheduler.runFrames(200, 1000 / 60)); // lewati hitung mundur
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Bisukan suara' }));
    unmount();

    expect(sound.blip).toHaveBeenCalledWith('typo');
    expect(sound.blip).toHaveBeenCalledWith('key');
    expect(sound.engine).toHaveBeenCalled();
    expect(onToggleMute).toHaveBeenCalledTimes(1);
    expect(sound.dispose).toHaveBeenCalledTimes(1);
  });
});

describe('Suara di React StrictMode (POL-1, regresi)', () => {
  it('POL_1_StrictMode_SuaraTetapHidupSetelahPasangBongkarPasang', () => {
    const scheduler = new ManualScheduler();
    const created: { sink: SoundSink; disposed: boolean }[] = [];
    const createSound = (): SoundSink => {
      const entry = { disposed: false, sink: null as unknown as SoundSink };
      entry.sink = { engine: vi.fn(), blip: vi.fn(), setMuted: vi.fn(), dispose: () => void (entry.disposed = true) };
      created.push(entry);
      return entry.sink;
    };
    const scene: RaceSceneLike = { update: vi.fn(), resize: vi.fn(), dispose: vi.fn() };
    render(
      <StrictMode>
        <RacePage
          passage={{ id: 't1', language: 'id', difficulty: 'easy', text: 'ab' }}
          carColor="#ff0000"
          onFinish={vi.fn()}
          createScene={() => scene}
          scheduler={scheduler}
          clock={() => scheduler.nowMs}
          createSound={createSound}
        />
      </StrictMode>,
    );

    act(() => scheduler.runFrames(200, 1000 / 60));
    act(() => void window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' })));

    const live = created.filter((c) => !c.disposed);
    expect(live).toHaveLength(1);
    expect(live[0]!.sink.blip).toHaveBeenCalledWith('key');
  });
});

describe('Huruf lemah dan latihan (POL-2)', () => {
  const stats = [
    { character: 'k', hits: 6, misses: 4 },
    { character: 'q', hits: 0, misses: 1 }, // terlalu jarang dicoba
    { character: 'z', hits: 3, misses: 1 },
    { character: ' ', hits: 5, misses: 5 }, // spasi tidak dilatih
    { character: 'a', hits: 30, misses: 0 },
  ];

  it('POL_2_HurufLemah_UrutRasioSalah', () => {
    expect(weakCharacters(stats, 5, 3)).toEqual(['k', 'z']);
  });

  it('POL_2_LatihanMemuatHurufLemah', () => {
    const words = wordPool(passages.filter((p) => p.language === 'id').map((p) => p.text));

    const text = buildPracticeText(['k', 'z'], words, seededRandom(1), 140);

    expect(text.length).toBeGreaterThanOrEqual(140);
    expect(text).toMatch(/^[\x20-\x7e]+$/);
    expect(text).not.toMatch(/ {2}/);
    for (const word of text.split(' ')) expect(word.toLowerCase()).toMatch(/[kz]/);
  });

  it('POL_2_LatihanDeterministikDenganSeed', () => {
    const words = wordPool(passages.map((p) => p.text));

    expect(buildPracticeText(['k'], words, seededRandom(9))).toBe(buildPracticeText(['k'], words, seededRandom(9)));
    expect(buildPracticeText(['k'], words, seededRandom(9))).not.toBe(buildPracticeText(['k'], words, seededRandom(10)));
  });

  it('POL_2_LatihanTidakMengirimHasil', () => {
    const result = { status: 'finished' } as RaceResult;

    expect(initialSubmissionState(result, true, true)).toEqual({ kind: 'practice' });
    expect(initialSubmissionState(result, true, false)).toEqual({ kind: 'sending' });
  });

  it('POL_2_PanelHurufLemah_TampilDanMulaiLatihan', async () => {
    const onPractice = vi.fn();
    const getKeys = () =>
      Promise.resolve(stats.map((s) => ({ ...s, missRate: s.hits + s.misses === 0 ? 0 : s.misses / (s.hits + s.misses) })));
    render(<WeakKeysPanel api={{ getKeys }} onPractice={onPractice} />);

    expect(await screen.findAllByTestId('weak-key-row')).toHaveLength(4); // a tidak pernah salah
    fireEvent.click(screen.getByRole('button', { name: /Latihan huruf lemah/ }));
    expect(onPractice).toHaveBeenCalledWith(['k', 'z']);
  });
});

describe('Layar sentuh (POL-3)', () => {
  it('POL_3_DeteksiLayarSentuhSaja', () => {
    const phone = (q: string) => q === '(pointer: coarse)';
    const laptopTouch = (q: string) => q === '(pointer: coarse)' || q === '(any-pointer: fine)';
    const desktop = (q: string) => q === '(any-pointer: fine)';

    expect(isTouchOnly(phone)).toBe(true);
    expect(isTouchOnly(laptopTouch)).toBe(false);
    expect(isTouchOnly(desktop)).toBe(false);
  });

  it('POL_3_LayarSentuh_TampilkanPesanDanTombolMulaiNonaktif', () => {
    render(<StartScreen settings={DEFAULT_SETTINGS} onChange={() => {}} onStart={() => {}} touchOnly />);

    expect(screen.getByTestId('touch-notice').textContent).toContain('keyboard fisik');
    expect((screen.getByRole('button', { name: 'Mulai balapan' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Pengaturan (POL-4)', () => {
  const serverSettings: SettingsDto = {
    language: 'en',
    difficulty: 'hard',
    botLevel: 'advanced',
    carColor: '#1d7ff2',
    useGhost: true,
    muted: true,
  };

  const playerSession = () => {
    const session = createSessionStore(memoryStorage());
    session.setPlayer({ player: { id: 'p1', nickname: 'rina' }, playerToken: 'tok' });
    return session;
  };

  it('POL_4_PengaturanDimuatDariServer', async () => {
    const storage = memoryStorage();
    const getSettings = vi.fn().mockResolvedValue(serverSettings);

    const loaded = await loadSettings({ session: playerSession(), getSettings }, storage);

    expect(loaded).toEqual(serverSettings);
    expect(JSON.parse(storage.data.get(SETTINGS_STORAGE_KEY)!)).toEqual(serverSettings);
  });

  it('POL_4_TamuPakaiLocalStorage_TidakMemanggilServer', async () => {
    const storage = memoryStorage();
    const session = createSessionStore(memoryStorage());
    const saveSettingsApi = vi.fn();
    const getSettings = vi.fn();

    await saveSettings({ session, saveSettings: saveSettingsApi }, storage, { ...DEFAULT_SETTINGS, language: 'en', muted: true });
    const loaded = await loadSettings({ session, getSettings }, storage);

    expect(saveSettingsApi).not.toHaveBeenCalled();
    expect(getSettings).not.toHaveBeenCalled();
    expect(loaded.language).toBe('en');
    expect(loaded.muted).toBe(true);
  });

  it('POL_4_PemainMenyimpanKeServer', async () => {
    const saveSettingsApi = vi.fn().mockResolvedValue(serverSettings);

    await saveSettings({ session: playerSession(), saveSettings: saveSettingsApi }, memoryStorage(), normalizeSettings(serverSettings));

    expect(saveSettingsApi).toHaveBeenCalledWith(serverSettings);
  });

  it('POL_4_ServerMati_PakaiSalinanLokal', async () => {
    const storage = memoryStorage();
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, difficulty: 'medium' }));

    const loaded = await loadSettings({ session: playerSession(), getSettings: () => Promise.reject(new Error('offline')) }, storage);

    expect(loaded.difficulty).toBe('medium');
  });

  it('POL_4_NilaiTidakDikenal_DigantiDefault', () => {
    expect(normalizeSettings({ language: 'jp', difficulty: 'ekstrem', botLevel: 'dewa', carColor: '#123456', muted: 'ya' })).toEqual(
      DEFAULT_SETTINGS,
    );
  });

  it('POL_4_UbahSuaraDiLayarMain', async () => {
    const onChange = vi.fn();
    render(<StartScreen settings={DEFAULT_SETTINGS} onChange={onChange} onStart={() => {}} />);

    fireEvent.click(screen.getByLabelText(/Suara/));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_SETTINGS, muted: true }));
  });
});

describe('Halaman petunjuk (POL-5)', () => {
  it('POL_5_HalamanPetunjuk_Tampil', () => {
    const onStart = vi.fn();
    render(<HelpScreen onStart={onStart} />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Cara bermain');
    expect(screen.getAllByText(/Backspace/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/WPM bersih/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Ayo main' }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});
