import { useEffect, useState } from 'react';
import type { Api } from '../api/endpoints';
import type { KeyStatDto } from '../api/types';
import { weakCharacters } from '../core/practice/practiceText';
import { formatPercent } from './format';

interface WeakKeysPanelProps {
  readonly api: Pick<Api, 'getKeys'>;
  readonly onPractice: (weak: readonly string[]) => void;
  /** Jumlah baris tabel. */
  readonly limit?: number;
}

const label = (c: string): string => (c === ' ' ? 'spasi' : c);

/** POL-2: huruf yang paling sering salah, dan tombol latihan yang memfokuskan huruf itu. */
export function WeakKeysPanel({ api, onPractice, limit = 10 }: WeakKeysPanelProps) {
  const [keys, setKeys] = useState<KeyStatDto[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.getKeys().then(
      (k) => !cancelled && setKeys(k),
      () => !cancelled && setError(true),
    );
    return () => {
      cancelled = true;
    };
  }, [api]);

  if (error) return <p className="muted">Statistik per huruf tidak bisa dimuat.</p>;
  if (!keys) return null;

  const weak = weakCharacters(keys);
  const rows = keys.filter((k) => k.misses > 0).slice(0, limit);

  return (
    <section className="weak-keys" aria-label="Huruf lemah">
      <h2 className="small-heading">Huruf yang paling sering salah</h2>
      {rows.length === 0 ? (
        <p className="muted small">Belum ada huruf yang sering salah. Mantap!</p>
      ) : (
        <table className="leaderboard compact">
          <thead>
            <tr>
              <th>Huruf</th>
              <th>Salah</th>
              <th>Dicoba</th>
              <th>Rasio salah</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((k) => (
              <tr key={k.character} data-testid="weak-key-row">
                <td>
                  <kbd>{label(k.character)}</kbd>
                </td>
                <td>{k.misses}</td>
                <td>{k.hits + k.misses}</td>
                <td>{formatPercent(k.missRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button type="button" className="primary" disabled={weak.length === 0} onClick={() => onPractice(weak)}>
        Latihan huruf lemah{weak.length > 0 ? ` (${weak.map(label).join(' ')})` : ''}
      </button>
      {weak.length === 0 && (
        <p className="muted small">Mode latihan aktif setelah ada huruf yang cukup sering dicoba dan pernah salah.</p>
      )}
    </section>
  );
}
