import { useEffect, useState } from 'react';
import type { Api } from '../api/endpoints';
import type { StatsResponse } from '../api/types';
import { chartPoints, toPolyline } from './chart';
import { formatPercent, formatWpm } from './format';
import { WeakKeysPanel } from './WeakKeysPanel';

interface StatsScreenProps {
  readonly api: Pick<Api, 'getStats' | 'getKeys'>;
  /** POL-2: mulai latihan huruf lemah. */
  readonly onPractice?: (weak: readonly string[]) => void;
}

const CHART_W = 400;
const CHART_H = 160;
const CHART_PAD = 8;

/** Grafik WPM per waktu (SVG sederhana, tanpa library). */
export function WpmChart({ stats }: { readonly stats: StatsResponse }) {
  const net = chartPoints(stats.history.map((h) => h.netWpm), CHART_W, CHART_H, CHART_PAD);
  const gross = chartPoints(stats.history.map((h) => h.wpm), CHART_W, CHART_H, CHART_PAD);
  return (
    <svg className="wpm-chart" viewBox={`0 0 ${CHART_W} ${CHART_H}`} role="img" aria-label="Grafik WPM per balapan">
      <polyline className="line-gross" fill="none" points={toPolyline(gross)} />
      <polyline className="line-net" fill="none" points={toPolyline(net)} data-testid="chart-net" />
      {net.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} className="dot-net" />
      ))}
    </svg>
  );
}

/** STA-1: statistik pribadi. */
export function StatsScreen({ api, onPractice }: StatsScreenProps) {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.getStats().then(
      (s) => !cancelled && setStats(s),
      () => !cancelled && setError(true),
    );
    return () => {
      cancelled = true;
    };
  }, [api]);

  return (
    <div className="screen">
      <div className="card wide">
        <h1>Statistik saya</h1>
        {error && (
          <p className="error" role="alert">
            Statistik tidak bisa dimuat.
          </p>
        )}
        {!error && !stats && <p className="muted">Memuat…</p>}
        {stats && stats.totalRaces === 0 && <p className="muted">Belum ada balapan tersimpan. Ayo main!</p>}
        {stats && stats.totalRaces > 0 && (
          <>
            <dl className="result-grid">
              <div>
                <dt>Balapan</dt>
                <dd data-testid="stats-total">{stats.totalRaces}</dd>
              </div>
              <div>
                <dt>WPM rata-rata</dt>
                <dd data-testid="stats-avg-wpm">{formatWpm(stats.averageWpm)}</dd>
              </div>
              <div>
                <dt>WPM terbaik</dt>
                <dd data-testid="stats-best-wpm">{formatWpm(stats.bestWpm)}</dd>
              </div>
              <div>
                <dt>Akurasi rata-rata</dt>
                <dd data-testid="stats-avg-accuracy">{formatPercent(stats.averageAccuracy)}</dd>
              </div>
            </dl>
            <h2 className="small-heading">WPM per balapan ({stats.history.length} terakhir)</h2>
            <WpmChart stats={stats} />
            <p className="muted small">
              <span className="legend-net">■</span> WPM bersih <span className="legend-gross">■</span> WPM
            </p>
          </>
        )}
        {onPractice && stats && stats.totalRaces > 0 && <WeakKeysPanel api={api} onPractice={onPractice} />}
      </div>
    </div>
  );
}
