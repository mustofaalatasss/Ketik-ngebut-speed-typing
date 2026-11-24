import { gameConfig } from '../config/gameConfig';
import { BOT_LEVELS, type BotLevel } from '../core/bots/opponents';
import { DIFFICULTIES, LANGUAGES, type Difficulty, type Language } from '../data/passages';
import type { RaceSettings } from '../ui/StartScreen';
import type { Api } from './endpoints';
import type { KeyValueStorage } from './session';
import type { SettingsDto } from './types';

export const SETTINGS_STORAGE_KEY = 'ketikngebut.settings';

export const DEFAULT_SETTINGS: Required<RaceSettings> = {
  language: 'id',
  difficulty: 'easy',
  carColor: gameConfig.carColors[0],
  botLevel: 'intermediate',
  useGhost: false,
  muted: false,
};

const isOneOf = <T extends string>(values: readonly T[], v: unknown): v is T =>
  typeof v === 'string' && (values as readonly string[]).includes(v);

/** Nilai yang tidak dikenal (data lama/rusak) diganti default, agar game tidak pernah gagal dimulai. */
export function normalizeSettings(raw: Partial<Record<keyof SettingsDto, unknown>> | null | undefined): Required<RaceSettings> {
  const r = raw ?? {};
  const color = typeof r.carColor === 'string' ? r.carColor.toLowerCase() : '';
  return {
    language: isOneOf<Language>(LANGUAGES, r.language) ? r.language : DEFAULT_SETTINGS.language,
    difficulty: isOneOf<Difficulty>(DIFFICULTIES, r.difficulty) ? r.difficulty : DEFAULT_SETTINGS.difficulty,
    botLevel: isOneOf<BotLevel>(BOT_LEVELS, r.botLevel) ? r.botLevel : DEFAULT_SETTINGS.botLevel,
    carColor: (gameConfig.carColors as readonly string[]).includes(color) ? color : DEFAULT_SETTINGS.carColor,
    useGhost: r.useGhost === true,
    muted: r.muted === true,
  };
}

export function toSettingsDto(s: RaceSettings): SettingsDto {
  const n = normalizeSettings(s);
  return { ...n };
}

function readLocal(storage: KeyValueStorage | null): Required<RaceSettings> {
  try {
    const raw = storage?.getItem(SETTINGS_STORAGE_KEY);
    return normalizeSettings(raw ? (JSON.parse(raw) as Record<string, unknown>) : null);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * POL-4: pemain ber-nickname memakai pengaturan di server; tamu (atau saat server tidak bisa dihubungi)
 * memakai salinan di localStorage.
 */
export async function loadSettings(
  api: Pick<Api, 'getSettings' | 'session'>,
  storage: KeyValueStorage | null,
): Promise<Required<RaceSettings>> {
  if (api.session.getSnapshot().playerToken) {
    try {
      const fromServer = normalizeSettings(await api.getSettings());
      storage?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(fromServer));
      return fromServer;
    } catch {
      // jatuh ke salinan lokal
    }
  }
  return readLocal(storage);
}

/** Selalu disimpan lokal; untuk pemain ber-nickname juga dikirim ke server (gagal kirim diabaikan). */
export async function saveSettings(
  api: Pick<Api, 'saveSettings' | 'session'>,
  storage: KeyValueStorage | null,
  settings: RaceSettings,
): Promise<void> {
  const dto = toSettingsDto(settings);
  storage?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(dto));
  if (!api.session.getSnapshot().playerToken) return;
  try {
    await api.saveSettings(dto);
  } catch {
    // tetap tersimpan lokal; dicoba lagi saat pengaturan berubah berikutnya
  }
}
