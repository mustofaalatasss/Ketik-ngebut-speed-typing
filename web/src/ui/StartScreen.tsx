import type { ReactNode } from 'react';
import { gameConfig } from '../config/gameConfig';
import { BOT_LEVELS, type BotLevel } from '../core/bots/opponents';
import { DIFFICULTIES, LANGUAGES, type Difficulty, type Language } from '../data/passages';

export interface RaceSettings {
  readonly language: Language;
  readonly difficulty: Difficulty;
  readonly carColor: string;
  /** BOT-2: tingkat lawan. Default Menengah. */
  readonly botLevel?: BotLevel;
  /** BOT-3: ganti satu bot dengan ghost rekor terbaik (hanya pemain ber-nickname). */
  readonly useGhost?: boolean;
  /** POL-1: suara dibisukan. */
  readonly muted?: boolean;
}

const languageLabel: Record<Language, string> = { id: 'Indonesia', en: 'Inggris' };
const difficultyLabel: Record<Difficulty, string> = { easy: 'Mudah', medium: 'Sedang', hard: 'Sulit' };

interface StartScreenProps {
  readonly settings: RaceSettings;
  readonly onChange: (settings: RaceSettings) => void;
  readonly onStart: () => void;
  /** Panel nickname (Fase 2); opsional agar test lama tetap jalan. */
  readonly nicknameSlot?: ReactNode;
  /** BOT-3: pilihan ghost hanya tampil bila pemain punya nickname. */
  readonly canUseGhost?: boolean;
  /** POL-3: perangkat tanpa keyboard fisik (layar sentuh saja). */
  readonly touchOnly?: boolean;
}

export function StartScreen({
  settings,
  onChange,
  onStart,
  nicknameSlot,
  canUseGhost = false,
  touchOnly = false,
}: StartScreenProps) {
  return (
    <div className="screen">
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          onStart();
        }}
      >
        <h1 className="brand-title">
          <img className="brand-logo" src="/brand/logo.png" alt="KetikNgebut: mahir mengetik, jadi cepat!" width="720" height="490" />
        </h1>
        <p className="muted">Makin cepat dan tepat kamu mengetik, makin kencang mobilmu.</p>
        {touchOnly && (
          <p className="notice" role="alert" data-testid="touch-notice">
            KetikNgebut butuh <strong>keyboard fisik</strong>. Sepertinya kamu memakai layar sentuh saja (HP atau
            tablet). Buka di laptop atau komputer untuk bermain; leaderboard tetap bisa dilihat di sini.
          </p>
        )}
        {nicknameSlot}

        <label>
          Bahasa teks
          <select
            value={settings.language}
            onChange={(e) => onChange({ ...settings, language: e.target.value as Language })}
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {languageLabel[l]}
              </option>
            ))}
          </select>
        </label>

        <label>
          Tingkat kesulitan
          <select
            value={settings.difficulty}
            onChange={(e) => onChange({ ...settings, difficulty: e.target.value as Difficulty })}
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {difficultyLabel[d]}
              </option>
            ))}
          </select>
        </label>

        <label>
          Tingkat lawan
          <select
            value={settings.botLevel ?? 'intermediate'}
            onChange={(e) => onChange({ ...settings, botLevel: e.target.value as BotLevel })}
          >
            {BOT_LEVELS.map((level) => (
              <option key={level} value={level}>
                {gameConfig.bots.levels[level].label} (~{gameConfig.bots.levels[level].baseWpm} WPM)
              </option>
            ))}
          </select>
        </label>

        {canUseGhost && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={settings.useGhost ?? false}
              onChange={(e) => onChange({ ...settings, useGhost: e.target.checked })}
            />
            Lawan ghost rekor terbaikmu
          </label>
        )}

        <label className="checkbox">
          <input
            type="checkbox"
            checked={!(settings.muted ?? false)}
            onChange={(e) => onChange({ ...settings, muted: !e.target.checked })}
          />
          Suara (mesin, ketikan, salah ketik)
        </label>

        <fieldset className="colors">
          <legend>Warna mobil</legend>
          {gameConfig.carColors.map((c) => (
            <button
              key={c}
              type="button"
              className={c === settings.carColor ? 'swatch selected' : 'swatch'}
              style={{ background: c }}
              aria-label={`Warna ${c}`}
              aria-pressed={c === settings.carColor}
              onClick={() => onChange({ ...settings, carColor: c })}
            />
          ))}
        </fieldset>

        <button type="submit" className="primary" disabled={touchOnly}>
          Mulai balapan
        </button>
      </form>
    </div>
  );
}
