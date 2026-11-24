import { useState } from 'react';
import type { Api } from '../api/endpoints';
import { ApiError } from '../api/http';
import type { PlayerDto } from '../api/types';

interface NicknamePanelProps {
  readonly player: PlayerDto | null;
  readonly api: Pick<Api, 'claimNickname' | 'forgetNickname'>;
}

function errorText(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return 'Server tidak bisa dihubungi. Kamu tetap bisa bermain sebagai tamu.';
    if (e.status === 409) return 'Nickname sudah dipakai orang lain. Coba nickname lain.';
    if (e.status === 429) return 'Terlalu banyak percobaan. Coba lagi nanti.';
    const fieldErrors = Object.values(e.problem.errors ?? {}).flat();
    if (fieldErrors.length > 0) return fieldErrors.join(' ');
    return e.problem.title ?? e.message;
  }
  return 'Terjadi kesalahan.';
}

/**
 * ACC-1: pemain cukup memasukkan nickname (tanpa daftar atau login). Nickname pertama yang dipakai
 * menjadi milik browser ini. Tanpa nickname, pemain tetap bisa main sebagai tamu (hasil tidak disimpan).
 */
export function NicknamePanel({ player, api }: NicknamePanelProps) {
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (player) {
    return (
      <div className="nickname-panel" data-testid="nickname-current">
        <p className="muted">
          Main sebagai <strong className="nickname">{player.nickname}</strong>. Hasilmu tersimpan dan masuk leaderboard.
        </p>
        <button
          type="button"
          className="link-button"
          onClick={() => {
            if (window.confirm('Lupakan nickname di browser ini? Nickname dan riwayatnya tidak bisa dipakai lagi dari browser ini.')) {
              api.forgetNickname();
            }
          }}
        >
          Lupakan nickname
        </button>
      </div>
    );
  }

  const submit = async () => {
    if (busy || nickname.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      await api.claimNickname(nickname.trim());
      setNickname('');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="nickname-panel">
      <label>
        Nickname (opsional, agar hasil tersimpan)
        <span className="inline-field">
          <input
            type="text"
            value={nickname}
            minLength={3}
            maxLength={24}
            placeholder="misalnya rina_ngebut"
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault(); // jangan memicu "Mulai balapan"
              void submit();
            }}
          />
          <button type="button" disabled={busy || nickname.trim().length < 3} onClick={() => void submit()}>
            Pakai
          </button>
        </span>
      </label>
      <p className="muted small">
        Tanpa daftar atau password. Nickname terikat ke browser ini; ganti browser atau hapus data browser berarti
        nickname hilang.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
