import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api as defaultApi, type Api } from '../api/endpoints';
import { loadOpponents } from '../api/opponentSource';
import { loadPassage } from '../api/passageSource';
import { initialSubmissionState, submitRaceResult, type SubmissionState } from '../api/resultSubmission';
import type { KeyValueStorage } from '../api/session';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '../api/settingsSource';
import type { Opponent } from '../core/bots/opponents';
import type { Standing } from '../core/bots/standings';
import { browserMatcher, isTouchOnly, type MediaMatcher } from '../core/device';
import { buildPracticeText, wordPool } from '../core/practice/practiceText';
import type { RaceResult } from '../core/race/raceSession';
import { passages as localPassages, type Passage } from '../data/passages';
import { HelpScreen } from './HelpScreen';
import { LeaderboardScreen } from './LeaderboardScreen';
import { NavBar, type NavTarget } from './NavBar';
import { NicknamePanel } from './NicknamePanel';
import { RacePage } from './RacePage';
import { ResultsScreen } from './ResultsScreen';
import { StartScreen, type RaceSettings } from './StartScreen';
import { StatsScreen } from './StatsScreen';
import { useSession } from './useSession';

/** POL-2: balapan latihan; `weak` = huruf yang dilatih (untuk "Main lagi"). */
interface PracticeInfo {
  readonly weak: readonly string[];
}

type Screen =
  | { readonly kind: 'start' }
  | { readonly kind: 'loading' }
  | {
      readonly kind: 'race';
      readonly passage: Passage;
      readonly raceNo: number;
      readonly opponents: readonly Opponent[];
      readonly practice: PracticeInfo | null;
    }
  | {
      readonly kind: 'results';
      readonly passage: Passage;
      readonly result: RaceResult;
      readonly submission: SubmissionState;
      readonly standings: readonly Standing[];
      readonly practice: PracticeInfo | null;
    }
  | { readonly kind: 'leaderboard' }
  | { readonly kind: 'stats' }
  | { readonly kind: 'help' };

const showFps = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');

function browserStorage(): KeyValueStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

interface AppProps {
  /** Bisa diganti di test. */
  readonly api?: Api;
  readonly storage?: KeyValueStorage | null;
  readonly matchMedia?: MediaMatcher;
}

/**
 * Alur layar: Start -> Race -> Results, plus Leaderboard, Statistik (huruf lemah dan latihan),
 * dan Cara bermain. Game ini untuk semua orang: tidak ada login, cukup nickname (opsional).
 */
export function App({ api = defaultApi, storage = browserStorage(), matchMedia = browserMatcher() }: AppProps) {
  const session = useSession(api.session);
  const [settings, setSettings] = useState<RaceSettings>(DEFAULT_SETTINGS);
  const [screen, setScreen] = useState<Screen>({ kind: 'start' });
  const raceNo = useRef(0);
  const touchOnly = useMemo(() => isTouchOnly(matchMedia), [matchMedia]);
  const playerToken = session.playerToken;

  // Saat halaman dimuat: pastikan token nickname di browser ini masih dikenali server.
  // Bila 401, http client menghapusnya; bila server mati, nickname tetap disimpan.
  useEffect(() => {
    if (api.session.getSnapshot().playerToken) api.verifyPlayer().catch(() => undefined);
  }, [api]);

  // POL-4: muat pengaturan (server untuk pemain ber-nickname, localStorage untuk tamu).
  useEffect(() => {
    let cancelled = false;
    void loadSettings(api, storage).then((s) => !cancelled && setSettings(s));
    return () => {
      cancelled = true;
    };
  }, [api, storage, playerToken]);

  const changeSettings = useCallback(
    (next: RaceSettings) => {
      setSettings(next);
      void saveSettings(api, storage, next);
    },
    [api, storage],
  );

  const toggleMute = useCallback(() => {
    setSettings((s) => {
      const next = { ...s, muted: !(s.muted ?? false) };
      void saveSettings(api, storage, next);
      return next;
    });
  }, [api, storage]);

  const beginRace = async (passage: Passage, practice: PracticeInfo | null): Promise<void> => {
    const opponents = await loadOpponents(api, {
      text: passage.text,
      passageId: passage.id,
      level: settings.botLevel ?? 'intermediate',
      useGhost: practice === null && (settings.useGhost ?? false),
    });
    raceNo.current += 1;
    setScreen({ kind: 'race', passage, raceNo: raceNo.current, opponents, practice });
  };

  const startRace = async (previousId?: string): Promise<void> => {
    setScreen({ kind: 'loading' });
    await beginRace(await loadPassage(api, settings.language, settings.difficulty, previousId), null);
  };

  /** POL-2: teks latihan dari kata-kata (bahasa yang dipilih) yang memuat huruf lemah. */
  const startPractice = async (weak: readonly string[]): Promise<void> => {
    setScreen({ kind: 'loading' });
    const language = settings.language ?? 'id';
    const words = wordPool(localPassages.filter((p) => p.language === language).map((p) => p.text));
    const text = buildPracticeText(weak, words, Math.random);
    const passage: Passage = { id: 'practice', language, difficulty: settings.difficulty ?? 'easy', text };
    await beginRace(passage, { weak });
  };

  // Layar terkini dibaca lewat ref agar efek samping (kirim hasil) tidak berada di dalam updater setState,
  // yang bisa dijalankan dua kali oleh React StrictMode.
  const screenRef = useRef(screen);
  screenRef.current = screen;

  const handleFinish = useCallback(
    (result: RaceResult, standings: readonly Standing[]) => {
      const s = screenRef.current;
      if (s.kind !== 'race') return;
      const submission = initialSubmissionState(result, api.session.getSnapshot().playerToken !== null, s.practice !== null);
      setScreen({ kind: 'results', passage: s.passage, result, submission, standings, practice: s.practice });
      if (submission.kind !== 'sending') return;

      // RES-1: pemain dengan nickname mengirim hasil; server menghitung ulang dan bisa menolak (RES-3).
      void submitRaceResult(api, result).then((next) =>
        setScreen((cur) => (cur.kind === 'results' && cur.result === result ? { ...cur, submission: next } : cur)),
      );
    },
    [api],
  );

  const navigate = (target: NavTarget): void => {
    if (target === 'stats' && !session.player) setScreen({ kind: 'start' });
    else setScreen({ kind: target });
  };

  const navCurrent: NavTarget | null =
    screen.kind === 'start' ||
    screen.kind === 'leaderboard' ||
    screen.kind === 'stats' ||
    screen.kind === 'help'
      ? screen.kind
      : null;
  const nav =
    screen.kind === 'race' || screen.kind === 'loading' ? null : (
      <NavBar player={session.player} current={navCurrent} onNavigate={navigate} />
    );

  const content = (() => {
    switch (screen.kind) {
      case 'start':
        return (
          <StartScreen
            settings={settings}
            onChange={changeSettings}
            onStart={() => void startRace()}
            nicknameSlot={<NicknamePanel player={session.player} api={api} />}
            canUseGhost={session.player !== null}
            touchOnly={touchOnly}
          />
        );
      case 'loading':
        return (
          <div className="screen">
            <p className="muted">Menyiapkan teks…</p>
          </div>
        );
      case 'race':
        return (
          <RacePage
            key={screen.raceNo}
            passage={screen.passage}
            carColor={settings.carColor}
            opponents={screen.opponents}
            playerName={session.player?.nickname ?? 'Kamu'}
            onFinish={handleFinish}
            showFps={showFps}
            muted={settings.muted ?? false}
            onToggleMute={toggleMute}
          />
        );
      case 'results': {
        const practice = screen.practice;
        return (
          <ResultsScreen
            result={screen.result}
            submission={screen.submission}
            standings={screen.standings}
            onChooseNickname={() => setScreen({ kind: 'start' })}
            onPlayAgain={() => void (practice ? startPractice(practice.weak) : startRace(screen.passage.id))}
            onChangeSettings={() => setScreen({ kind: 'start' })}
          />
        );
      }
      case 'leaderboard':
        return <LeaderboardScreen api={api} currentNickname={session.player?.nickname} />;
      case 'stats':
        return <StatsScreen api={api} onPractice={touchOnly ? undefined : (weak) => void startPractice(weak)} />;
      case 'help':
        return <HelpScreen onStart={() => setScreen({ kind: 'start' })} />;
    }
  })();

  return (
    <div className="app">
      {nav}
      <main className="app-main">{content}</main>
    </div>
  );
}
