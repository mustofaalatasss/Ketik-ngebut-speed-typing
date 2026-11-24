// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/http';
import type { LeaderboardPeriod, LeaderboardResponse, StatsResponse } from '../api/types';
import type { RaceResult } from '../core/race/raceSession';
import { NicknamePanel } from './NicknamePanel';
import { chartPoints } from './chart';
import { LeaderboardScreen } from './LeaderboardScreen';
import { ResultsScreen } from './ResultsScreen';
import { StatsScreen } from './StatsScreen';

afterEach(() => cleanup());

const result: RaceResult = {
  passageId: 'id-easy-1',
  status: 'finished',
  wpm: 61,
  accuracy: 0.97,
  netWpm: 59.2,
  durationMs: 21_000,
  correctChars: 100,
  totalChars: 100,
  log: [],
};

function board(period: LeaderboardPeriod, page: number, total: number, names: string[]): LeaderboardResponse {
  return {
    period,
    from: null,
    page,
    pageSize: 2,
    totalCount: total,
    items: names.map((nickname, i) => ({
      rank: (page - 1) * 2 + i + 1,
      nickname,
      netWpm: 80 - i,
      wpm: 82 - i,
      accuracy: 0.98,
      createdAt: '2030-01-15T02:00:00Z',
    })),
  };
}

describe('Layar hasil dengan status pengiriman (RES-1, RES-3)', () => {
  it('RES_1_Tamu_TampilkanAjakanPilihNickname', () => {
    const onChooseNickname = vi.fn();
    render(<ResultsScreen result={result} submission={{ kind: 'guest' }} onChooseNickname={onChooseNickname} onPlayAgain={() => {}} onChangeSettings={() => {}} />);

    expect(screen.getByTestId('submission').textContent).toContain('tidak disimpan');
    fireEvent.click(screen.getByRole('button', { name: 'Pilih nickname untuk menyimpan hasil' }));
    expect(onChooseNickname).toHaveBeenCalledTimes(1);
  });

  it('RES_1_Tersimpan_TampilkanAngkaServer', () => {
    const saved = { id: 1, passageId: 'id-easy-1', wpm: 61, accuracy: 0.97, netWpm: 59.2, durationMs: 21_000, correctChars: 100, totalKeystrokes: 103, createdAt: '', isValid: true };
    render(<ResultsScreen result={result} submission={{ kind: 'saved', result: saved }} onPlayAgain={() => {}} onChangeSettings={() => {}} />);

    expect(screen.getByTestId('submission').textContent).toContain('Tersimpan');
    expect(screen.getByTestId('submission').textContent).toContain('59');
  });

  it('RES_3_HasilDitolak_TampilkanAlasan', () => {
    render(
      <ResultsScreen
        result={result}
        submission={{ kind: 'rejected', reason: 'InhumanRhythm', message: 'Ritme ketikan tidak wajar untuk manusia.' }}
        onPlayAgain={() => {}}
        onChangeSettings={() => {}}
      />,
    );

    expect(screen.getByRole('alert').textContent).toContain('Ritme ketikan tidak wajar');
  });
});

describe('Nickname di layar Start (ACC-1)', () => {
  it('ACC_1_StartScreen_KlaimNickname', async () => {
    const claimNickname = vi.fn().mockResolvedValue({});
    render(<NicknamePanel player={null} api={{ claimNickname, forgetNickname: vi.fn() }} />);

    fireEvent.change(screen.getByLabelText(/Nickname/), { target: { value: '  rina_ngebut ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pakai' }));

    await waitFor(() => expect(claimNickname).toHaveBeenCalledWith('rina_ngebut'));
  });

  it('ACC_1_NicknameDipakai_TampilkanPesan', async () => {
    const claimNickname = vi.fn().mockRejectedValue(new ApiError(409, { title: 'Nickname sudah dipakai' }));
    render(<NicknamePanel player={null} api={{ claimNickname, forgetNickname: vi.fn() }} />);

    fireEvent.change(screen.getByLabelText(/Nickname/), { target: { value: 'rina' } });
    fireEvent.keyDown(screen.getByLabelText(/Nickname/), { key: 'Enter' });

    expect((await screen.findByRole('alert')).textContent).toContain('sudah dipakai');
  });

  it('ACC_1_SudahPunyaNickname_TampilkanNamaDanBisaDilupakan', () => {
    const forgetNickname = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<NicknamePanel player={{ id: 'p1', nickname: 'rina' }} api={{ claimNickname: vi.fn(), forgetNickname }} />);

    expect(screen.getByTestId('nickname-current').textContent).toContain('rina');
    fireEvent.click(screen.getByRole('button', { name: 'Lupakan nickname' }));
    expect(forgetNickname).toHaveBeenCalledTimes(1);
  });
});

describe('Leaderboard (LBD-1)', () => {
  it('LBD_1_LeaderboardTampilPeriodeDanPaginasi', async () => {
    const getLeaderboard = vi.fn((period: LeaderboardPeriod, page: number) =>
      Promise.resolve(page === 1 ? board(period, 1, 3, ['rina', 'budi']) : board(period, 2, 3, ['sari'])),
    );
    render(<LeaderboardScreen api={{ getLeaderboard }} pageSize={2} currentNickname="budi" />);

    await screen.findByText('rina');
    expect(screen.getAllByTestId('leaderboard-row')).toHaveLength(2);
    expect(screen.getByTestId('leaderboard-page').textContent).toBe('Halaman 1 dari 2');
    expect(getLeaderboard).toHaveBeenLastCalledWith('daily', 1, 2);

    fireEvent.click(screen.getByRole('button', { name: 'Berikutnya' }));
    await screen.findByText('sari');
    expect(getLeaderboard).toHaveBeenLastCalledWith('daily', 2, 2);

    fireEvent.click(screen.getByRole('tab', { name: 'Sepanjang masa' }));
    await screen.findByText('rina');
    expect(getLeaderboard).toHaveBeenLastCalledWith('all', 1, 2);
  });

  it('LBD_1_ServerMati_TampilkanPesan', async () => {
    render(<LeaderboardScreen api={{ getLeaderboard: () => Promise.reject(new Error('offline')) }} />);

    expect((await screen.findByRole('alert')).textContent).toContain('tidak bisa dimuat');
  });
});

describe('Statistik pribadi (STA-1)', () => {
  const stats: StatsResponse = {
    totalRaces: 3,
    averageWpm: 60,
    bestWpm: 80,
    averageNetWpm: 57.67,
    bestNetWpm: 80,
    averageAccuracy: 0.95,
    history: [
      { createdAt: '2030-01-15T00:00:00Z', wpm: 40, netWpm: 36, accuracy: 0.9 },
      { createdAt: '2030-01-15T01:00:00Z', wpm: 60, netWpm: 57, accuracy: 0.95 },
      { createdAt: '2030-01-15T02:00:00Z', wpm: 80, netWpm: 80, accuracy: 1 },
    ],
  };

  it('STA_1_StatistikDanGrafikTampil', async () => {
    render(<StatsScreen api={{ getStats: () => Promise.resolve(stats), getKeys: () => Promise.resolve([]) }} />);

    expect((await screen.findByTestId('stats-total')).textContent).toBe('3');
    expect(screen.getByTestId('stats-avg-wpm').textContent).toBe('60');
    expect(screen.getByTestId('stats-best-wpm').textContent).toBe('80');
    expect(screen.getByTestId('stats-avg-accuracy').textContent).toBe('95%');
    expect(screen.getByTestId('chart-net').getAttribute('points')?.split(' ')).toHaveLength(3);
  });

  it('STA_1_GrafikNilaiTertinggiDiAtas', () => {
    const points = chartPoints([40, 80, 0], 100, 50);

    expect(points.map((p) => p.x)).toEqual([0, 50, 100]);
    expect(points.map((p) => p.y)).toEqual([25, 0, 50]);
    expect(chartPoints([], 100, 50)).toEqual([]);
  });
});
