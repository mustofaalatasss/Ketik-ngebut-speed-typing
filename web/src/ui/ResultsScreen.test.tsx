// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Standing } from '../core/bots/standings';
import type { RaceResult } from '../core/race/raceSession';
import { ResultsScreen } from './ResultsScreen';

afterEach(() => cleanup());

const base: RaceResult = {
  passageId: 'p1',
  status: 'finished',
  wpm: 54.6,
  accuracy: 0.92,
  netWpm: 50.2,
  durationMs: 45_300,
  correctChars: 206,
  totalChars: 206,
  log: [],
};

describe('Layar hasil: peringkat (BOT-5)', () => {
  it('BOT_5_LayarHasil_TampilkanPeringkat4Mobil', () => {
    const standings: Standing[] = [
      { id: 'bot-2', name: 'Bot Kilat', kind: 'bot', color: '#f00', finishMs: 30_000, correctChars: 206, totalChars: 206, position: 1, finished: true, wpm: 82 },
      { id: 'player', name: 'rina', kind: 'player', color: '#0f0', finishMs: 45_300, correctChars: 206, totalChars: 206, position: 2, finished: true, wpm: 55 },
      { id: 'ghost', name: 'Ghost (rekormu)', kind: 'ghost', color: '#00f', finishMs: 50_000, correctChars: 206, totalChars: 206, position: 3, finished: true, wpm: 49 },
      { id: 'bot-0', name: 'Bot Santai', kind: 'bot', color: '#999', finishMs: null, correctChars: 150, totalChars: 206, position: 4, finished: false, wpm: 10 },
    ];
    render(<ResultsScreen result={base} standings={standings} onPlayAgain={() => {}} onChangeSettings={() => {}} />);

    const rows = screen.getByTestId('standings').querySelectorAll('tbody tr');
    expect(rows).toHaveLength(4);
    expect([...rows].map((r) => r.children[1]!.textContent)).toEqual(['Bot Kilat', 'rina', 'Ghost (rekormu)', 'Bot Santai']);
    expect(rows[1]!.className).toBe('me');
    expect(rows[3]!.children[3]!.textContent).toBe('Tidak selesai');
    expect(screen.getByTestId('result-place').textContent).toContain('Posisi 2/4');
  });
});

describe('Layar hasil (GAM-4)', () => {
  it('GAM_4_LayarHasil_TampilkanWpmAkurasiDurasi', () => {
    render(<ResultsScreen result={base} onPlayAgain={() => {}} onChangeSettings={() => {}} />);
    expect(screen.getByTestId('result-wpm').textContent).toBe('55');
    expect(screen.getByTestId('result-accuracy').textContent).toBe('92%');
    expect(screen.getByTestId('result-net-wpm').textContent).toBe('50');
    expect(screen.getByTestId('result-duration').textContent).toBe('0:45.3');
    expect(screen.queryByTestId('result-dnf')).toBeNull();
  });

  it('GAM_4_TombolMainLagi_MemanggilOnPlayAgain', () => {
    const onPlayAgain = vi.fn();
    render(<ResultsScreen result={base} onPlayAgain={onPlayAgain} onChangeSettings={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Main lagi' }));
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
  });

  it('GAM_4_TidakSelesai_TampilkanLabel', () => {
    render(
      <ResultsScreen
        result={{ ...base, status: 'timeout', correctChars: 120 }}
        onPlayAgain={() => {}}
        onChangeSettings={() => {}}
      />,
    );
    expect(screen.getByRole('heading').textContent).toBe('Tidak selesai');
    expect(screen.getByTestId('result-dnf').textContent).toContain('120 dari 206');
  });
});
