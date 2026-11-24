import { describe, expect, it } from 'vitest';
import { gameConfig } from '../../config/gameConfig';
import { applyKeystroke, createTypingState } from '../typing/typingEngine';
import { BACKSPACE, type Keystroke } from '../typing/types';
import { seededRandom } from '../util/random';
import { createBotSchedule, finishTime, progressAt, scheduleWpm } from './botSchedule';
import { createGhostSchedule } from './ghost';
import { createOpponents, opponentsConfigFor } from './opponents';
import { computeStandings, livePosition, type Racer } from './standings';

const TEXT =
  'Setiap hari Sabtu, Rina berlatih mengetik selama tiga puluh menit. Ia mencatat kecepatan dan ketepatannya di buku kecil.';
const style = gameConfig.bots.style;

describe('Jadwal bot (BOT-1)', () => {
  it('BOT_1_JadwalBot_BervariasiTidakKonstan', () => {
    const schedule = createBotSchedule(TEXT, 50, style, seededRandom(1));
    expect(schedule).toHaveLength(TEXT.length);
    const intervals = schedule.map((t, i) => t - (i === 0 ? 0 : schedule[i - 1]!));
    expect(intervals.every((d) => d > 0)).toBe(true); // waktu selalu maju
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const sd = Math.sqrt(intervals.reduce((a, d) => a + (d - avg) ** 2, 0) / intervals.length);
    expect(sd / avg).toBeGreaterThan(0.2); // tidak konstan sempurna
    // ...tetapi WPM rata-rata sama dengan target.
    expect(scheduleWpm(schedule)).toBeCloseTo(50, 6);
  });

  it('BOT_1_JadwalBot_DeterministikDenganSeed', () => {
    expect(createBotSchedule(TEXT, 50, style, seededRandom(9))).toEqual(createBotSchedule(TEXT, 50, style, seededRandom(9)));
    expect(createBotSchedule(TEXT, 50, style, seededRandom(9))).not.toEqual(
      createBotSchedule(TEXT, 50, style, seededRandom(10)),
    );
  });

  it('BOT_1_ProgressAt_HalusDanMonoton', () => {
    const schedule = [100, 300, 400];
    expect(progressAt(schedule, 0)).toBe(0);
    expect(progressAt(schedule, 50)).toBeCloseTo(0.5, 10);
    expect(progressAt(schedule, 100)).toBe(1);
    expect(progressAt(schedule, 200)).toBeCloseTo(1.5, 10);
    expect(progressAt(schedule, 1_000)).toBe(3);
    expect(finishTime(schedule, 3)).toBe(400);
    expect(finishTime(schedule, 4)).toBeNull();
  });
});

describe('Tingkat lawan dan tiga bot (BOT-2, BOT-4)', () => {
  it('BOT_4_TigaBot_KecepatanRataRataBerbeda', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const opponents = createOpponents(TEXT, opponentsConfigFor('intermediate'), seededRandom(seed));
      expect(opponents).toHaveLength(3);
      const [slow, equal, fast] = opponents.map((o) => scheduleWpm(o.schedule));
      expect(slow!).toBeLessThan(equal!);
      expect(equal!).toBeLessThan(fast!);
    }
  });

  it('BOT_2_BotPemula_LebihLambatDariMahir_20Simulasi', () => {
    const average = (level: 'beginner' | 'advanced') => {
      let sum = 0;
      for (let race = 0; race < 20; race++) {
        const opponents = createOpponents(TEXT, opponentsConfigFor(level), seededRandom(1_000 + race));
        sum += opponents.reduce((a, o) => a + scheduleWpm(o.schedule), 0) / opponents.length;
      }
      return sum / 20;
    };
    const beginner = average('beginner');
    const advanced = average('advanced');
    expect(beginner).toBeLessThan(advanced);
    // Rata-rata mendekati WPM acuan tiap tingkat (BOT-2).
    expect(beginner).toBeCloseTo(gameConfig.bots.levels.beginner.baseWpm, -1);
    expect(advanced).toBeCloseTo(gameConfig.bots.levels.advanced.baseWpm, -1);
  });
});

/** Merekam ketikan "manusia" dengan satu salah ketik, seperti log yang disimpan server. */
function recordLog(text: string): Keystroke[] {
  let state = createTypingState(text);
  let t = 0;
  const random = seededRandom(77);
  for (let i = 0; i < text.length; i++) {
    t += 120 + Math.round(random() * 140);
    if (i === 10) {
      state = applyKeystroke(state, { key: 'z', t });
      t += 150;
      state = applyKeystroke(state, { key: BACKSPACE, t });
      t += 100;
    }
    state = applyKeystroke(state, { key: text[i]!, t });
  }
  return [...state.log];
}

describe('Mode ghost (BOT-3)', () => {
  it('BOT_3_Ghost_LintasanSamaDenganRekaman', () => {
    const log = recordLog(TEXT);
    const schedule = createGhostSchedule(TEXT, log, TEXT);

    // Posisi ghost pada setiap waktu = posisi kursor rekaman asli pada waktu itu.
    let state = createTypingState(TEXT);
    for (const ks of log) {
      state = applyKeystroke(state, ks);
      expect(Math.floor(progressAt(schedule, ks.t))).toBe(state.cursor);
    }
    expect(finishTime(schedule, TEXT.length)).toBe(log.at(-1)!.t);
  });

  it('BOT_3_Ghost_TeksBeda_ProgresDinormalisasi', () => {
    const log = recordLog(TEXT);
    const other = 'Teks lain yang panjangnya berbeda sekali.';
    const schedule = createGhostSchedule(TEXT, log, other);
    expect(schedule).toHaveLength(other.length);
    // Selesai bersamaan dengan rekaman, dan separuh teks dicapai saat rekaman separuh jalan.
    expect(finishTime(schedule, other.length)).toBeCloseTo(log.at(-1)!.t, 6);
    const original = createGhostSchedule(TEXT, log, TEXT);
    const halfTime = schedule[Math.ceil(other.length / 2) - 1]!;
    expect(progressAt(original, halfTime) / TEXT.length).toBeCloseTo(Math.ceil(other.length / 2) / other.length, 2);
  });

  it('BOT_3_Ghost_MenggantikanBotSetara', () => {
    const log = recordLog(TEXT);
    const opponents = createOpponents(TEXT, opponentsConfigFor('intermediate'), seededRandom(3), { text: TEXT, log });
    expect(opponents).toHaveLength(3);
    expect(opponents.map((o) => o.kind)).toEqual(['bot', 'ghost', 'bot']);
    expect(opponents[1]!.schedule).toEqual(createGhostSchedule(TEXT, log, TEXT));
  });

  it('BOT_3_Ghost_RekamanTidakLengkap_TetapTigaBot', () => {
    const partial = recordLog(TEXT).slice(0, 20);
    const opponents = createOpponents(TEXT, opponentsConfigFor('intermediate'), seededRandom(3), {
      text: TEXT,
      log: partial,
    });
    expect(opponents.every((o) => o.kind === 'bot')).toBe(true);
  });
});

describe('Peringkat (BOT-5)', () => {
  const racer = (id: string, kind: Racer['kind'], finishMs: number | null, correctChars = 100): Racer => ({
    id,
    name: id,
    kind,
    color: '#fff',
    finishMs,
    correctChars,
    totalChars: 100,
  });

  it('BOT_5_Peringkat_MengikutiUrutanFinis', () => {
    const standings = computeStandings(
      [racer('player', 'player', 30_000), racer('a', 'bot', 25_000), racer('b', 'bot', 40_000), racer('g', 'ghost', 28_000)],
      180_000,
    );
    expect(standings.map((s) => s.id)).toEqual(['a', 'g', 'player', 'b']);
    expect(standings.map((s) => s.position)).toEqual([1, 2, 3, 4]);
    expect(standings[0]!.wpm).toBeCloseTo(100 / 5 / (25_000 / 60_000), 10);
  });

  it('BOT_5_PemainTidakSelesai_PosisiTerakhir', () => {
    const standings = computeStandings(
      [
        racer('player', 'player', null, 90),
        racer('slow', 'bot', null, 40), // bot juga tidak selesai, progres lebih kecil
        racer('late', 'bot', 200_000), // lewat batas waktu -> tidak selesai
        racer('fast', 'bot', 60_000),
      ],
      180_000,
    );
    expect(standings.map((s) => s.id)).toEqual(['fast', 'late', 'slow', 'player']);
    expect(standings.find((s) => s.id === 'late')!.finished).toBe(false);
    expect(standings.at(-1)!.finished).toBe(false);
  });

  it('BOT_5_PosisiLangsung_SelamaBalapan', () => {
    expect(livePosition(50, [10, 20, 30])).toBe(1);
    expect(livePosition(50, [60, 20, 70])).toBe(3);
    expect(livePosition(50, [50, 50, 50])).toBe(1); // seri dihitung untuk pemain
  });
});
