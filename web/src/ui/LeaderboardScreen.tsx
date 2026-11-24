import { useEffect, useState } from 'react';
import type { Api } from '../api/endpoints';
import type { LeaderboardPeriod, LeaderboardResponse } from '../api/types';
import { formatPercent, formatWpm } from './format';

interface LeaderboardScreenProps {
  readonly api: Pick<Api, 'getLeaderboard'>;
  readonly pageSize?: number;
  readonly currentNickname?: string;
}

const periods: readonly { readonly value: LeaderboardPeriod; readonly label: string }[] = [
  { value: 'daily', label: 'Hari ini' },
  { value: 'weekly', label: 'Minggu ini' },
  { value: 'all', label: 'Sepanjang masa' },
];

type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ok'; readonly data: LeaderboardResponse }
  | { readonly kind: 'error' };

/** LBD-1: leaderboard publik dengan periode dan paginasi. */
export function LeaderboardScreen({ api, pageSize = 20, currentNickname }: LeaderboardScreenProps) {
  const [period, setPeriod] = useState<LeaderboardPeriod>('daily');
  const [page, setPage] = useState(1);
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    api.getLeaderboard(period, page, pageSize).then(
      (data) => !cancelled && setState({ kind: 'ok', data }),
      () => !cancelled && setState({ kind: 'error' }),
    );
    return () => {
      cancelled = true;
    };
  }, [api, period, page, pageSize]);

  const totalPages = state.kind === 'ok' ? Math.max(1, Math.ceil(state.data.totalCount / pageSize)) : 1;

  return (
    <div className="screen">
      <div className="card wide">
        <h1>Leaderboard</h1>
        <div className="tabs" role="tablist">
          {periods.map((p) => (
            <button
              key={p.value}
              type="button"
              role="tab"
              aria-selected={period === p.value}
              className={period === p.value ? 'tab active' : 'tab'}
              onClick={() => {
                setPeriod(p.value);
                setPage(1);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {state.kind === 'loading' && <p className="muted">Memuat…</p>}
        {state.kind === 'error' && (
          <p className="error" role="alert">
            Leaderboard tidak bisa dimuat. Pastikan server berjalan.
          </p>
        )}
        {state.kind === 'ok' && state.data.items.length === 0 && (
          <p className="muted">Belum ada hasil di periode ini.</p>
        )}
        {state.kind === 'ok' && state.data.items.length > 0 && (
          <table className="leaderboard">
            <thead>
              <tr>
                <th>#</th>
                <th>Pemain</th>
                <th>WPM bersih</th>
                <th>WPM</th>
                <th>Akurasi</th>
              </tr>
            </thead>
            <tbody>
              {state.data.items.map((e) => (
                <tr key={e.rank} className={e.nickname === currentNickname ? 'me' : undefined} data-testid="leaderboard-row">
                  <td>{e.rank}</td>
                  <td>{e.nickname}</td>
                  <td>{formatWpm(e.netWpm)}</td>
                  <td>{formatWpm(e.wpm)}</td>
                  <td>{formatPercent(e.accuracy)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="actions pager">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Sebelumnya
          </button>
          <span className="muted" data-testid="leaderboard-page">
            Halaman {page} dari {totalPages}
          </span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Berikutnya
          </button>
        </div>
      </div>
    </div>
  );
}
