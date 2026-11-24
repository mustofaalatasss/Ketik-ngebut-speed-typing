import { gsap } from 'gsap';
import { useLayoutEffect, useRef } from 'react';
import type { SubmissionState } from '../api/resultSubmission';
import type { Standing } from '../core/bots/standings';
import type { RaceResult } from '../core/race/raceSession';
import { formatDuration, formatPercent, formatWpm } from './format';

interface ResultsScreenProps {
  readonly result: RaceResult;
  readonly onPlayAgain: () => void;
  readonly onChangeSettings: () => void;
  /** Status pengiriman hasil ke server (Fase 2). Tidak ada = tidak ditampilkan. */
  readonly submission?: SubmissionState;
  readonly onChooseNickname?: () => void;
  /** BOT-5: peringkat semua mobil (Fase 3). */
  readonly standings?: readonly Standing[];
}

/** GAM-4: ringkasan hasil dan tombol main lagi. */
export function ResultsScreen({
  result,
  onPlayAgain,
  onChangeSettings,
  submission,
  onChooseNickname,
  standings,
}: ResultsScreenProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const tween = gsap.from(ref.current, { y: 24, opacity: 0, duration: 0.4, ease: 'power2.out' });
    return () => {
      tween.revert();
    };
  }, []);

  const finished = result.status === 'finished';
  const playerPlace = standings?.find((s) => s.kind === 'player')?.position;
  return (
    <div className="screen" ref={ref}>
      <div className="card">
        <h1>
          {finished ? 'Selesai!' : 'Tidak selesai'}
          {playerPlace !== undefined && standings && standings.length > 1 && (
            <span className="place" data-testid="result-place">
              {' '}
              Posisi {playerPlace}/{standings.length}
            </span>
          )}
        </h1>
        {!finished && (
          <p className="muted" data-testid="result-dnf">
            Batas waktu habis ({result.correctChars} dari {result.totalChars} karakter).
          </p>
        )}
        <dl className="result-grid">
          <div>
            <dt>WPM</dt>
            <dd data-testid="result-wpm">{formatWpm(result.wpm)}</dd>
          </div>
          <div>
            <dt>Akurasi</dt>
            <dd data-testid="result-accuracy">{formatPercent(result.accuracy)}</dd>
          </div>
          <div>
            <dt>WPM bersih</dt>
            <dd data-testid="result-net-wpm">{formatWpm(result.netWpm)}</dd>
          </div>
          <div>
            <dt>Durasi</dt>
            <dd data-testid="result-duration">{formatDuration(result.durationMs)}</dd>
          </div>
        </dl>
        {standings && standings.length > 1 && <StandingsTable standings={standings} />}
        {submission && <SubmissionNote submission={submission} onChooseNickname={onChooseNickname} />}
        <div className="actions">
          <button type="button" className="primary" onClick={onPlayAgain}>
            Main lagi
          </button>
          <button type="button" onClick={onChangeSettings}>
            Ganti pengaturan
          </button>
        </div>
      </div>
    </div>
  );
}

/** BOT-5: peringkat semua mobil sesuai urutan finis. */
function StandingsTable({ standings }: { readonly standings: readonly Standing[] }) {
  return (
    <table className="standings" data-testid="standings">
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">Mobil</th>
          <th scope="col">WPM</th>
          <th scope="col">Waktu</th>
        </tr>
      </thead>
      <tbody>
        {standings.map((s) => (
          <tr key={s.id} className={s.kind === 'player' ? 'me' : undefined}>
            <td>{s.position}</td>
            <td>
              <span className="dot" style={{ background: s.color }} aria-hidden="true" />
              {s.name}
            </td>
            <td>{formatWpm(s.wpm)}</td>
            <td>{s.finished && s.finishMs !== null ? formatDuration(s.finishMs) : 'Tidak selesai'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SubmissionNote({
  submission,
  onChooseNickname,
}: {
  readonly submission: SubmissionState;
  readonly onChooseNickname?: () => void;
}) {
  switch (submission.kind) {
    case 'guest':
      return (
        <p className="muted" data-testid="submission">
          Main sebagai tamu: hasil tidak disimpan.{' '}
          {onChooseNickname && (
            <button type="button" className="link-button" onClick={onChooseNickname}>
              Pilih nickname untuk menyimpan hasil
            </button>
          )}
        </p>
      );
    case 'practice':
      return (
        <p className="muted" data-testid="submission">
          Mode latihan: hasil tidak dikirim dan tidak masuk leaderboard.
        </p>
      );
    case 'not-submitted':
      return (
        <p className="muted" data-testid="submission">
          Balapan tidak selesai, jadi hasil tidak dikirim.
        </p>
      );
    case 'sending':
      return (
        <p className="muted" data-testid="submission">
          Mengirim hasil…
        </p>
      );
    case 'saved':
      return (
        <p className="success" data-testid="submission">
          Tersimpan. WPM bersih menurut server: {formatWpm(submission.result.netWpm)}
        </p>
      );
    case 'rejected':
      return (
        <p className="error" role="alert" data-testid="submission">
          Hasil ditolak server: {submission.message}
        </p>
      );
    case 'error':
      return (
        <p className="error" role="alert" data-testid="submission">
          {submission.message}
        </p>
      );
  }
}
