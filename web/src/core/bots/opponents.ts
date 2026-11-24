import { gameConfig } from '../../config/gameConfig';
import type { Keystroke } from '../typing/types';
import { createBotSchedule, scheduleWpm, type BotStyle, type Schedule } from './botSchedule';
import { createGhostSchedule } from './ghost';

export type BotLevel = keyof typeof gameConfig.bots.levels;
export const BOT_LEVELS = Object.keys(gameConfig.bots.levels) as BotLevel[];

export interface Opponent {
  readonly id: string;
  readonly name: string;
  readonly color: string;
  readonly kind: 'bot' | 'ghost';
  /** WPM rencana (bot) atau WPM rekaman (ghost). */
  readonly targetWpm: number;
  readonly schedule: Schedule;
}

/** Rekaman rekor yang diputar ulang sebagai ghost. */
export interface GhostRecord {
  readonly text: string;
  readonly log: readonly Keystroke[];
}

export interface OpponentsConfig {
  readonly baseWpm: number;
  readonly spread: readonly number[];
  readonly perRaceVariance: number;
  readonly names: readonly string[];
  readonly colors: readonly string[];
  readonly style: BotStyle;
  readonly ghostReplacesIndex: number;
  readonly ghostName: string;
  readonly ghostColor: string;
}

export function opponentsConfigFor(level: BotLevel): OpponentsConfig {
  const b = gameConfig.bots;
  return {
    baseWpm: b.levels[level].baseWpm,
    spread: b.spread,
    perRaceVariance: b.perRaceVariance,
    names: b.names,
    colors: b.colors,
    style: b.style,
    ghostReplacesIndex: b.ghostReplacesIndex,
    ghostName: b.ghostName,
    ghostColor: b.ghostColor,
  };
}

/**
 * BOT-4: selalu 3 lawan untuk teks ini: lebih lambat, setara, dan lebih cepat dari WPM acuan.
 * BOT-3: bila ada rekaman ghost (yang mencakup teks), bot "setara" diganti ghost.
 */
export function createOpponents(
  text: string,
  config: OpponentsConfig,
  random: () => number,
  ghost?: GhostRecord | null,
): Opponent[] {
  const opponents: Opponent[] = config.spread.map((offset, i) => {
    const variance = 1 + config.perRaceVariance * (2 * random() - 1);
    const targetWpm = config.baseWpm * (1 + offset) * variance;
    return {
      id: `bot-${i}`,
      name: config.names[i] ?? `Bot ${i + 1}`,
      color: config.colors[i] ?? '#888888',
      kind: 'bot',
      targetWpm,
      schedule: createBotSchedule(text, targetWpm, config.style, random),
    };
  });

  if (ghost && ghost.log.length > 0) {
    const schedule = createGhostSchedule(ghost.text, ghost.log, text);
    if (schedule.length === text.length) {
      opponents[config.ghostReplacesIndex] = {
        id: 'ghost',
        name: config.ghostName,
        color: config.ghostColor,
        kind: 'ghost',
        targetWpm: scheduleWpm(schedule),
        schedule,
      };
    }
  }
  return opponents;
}
