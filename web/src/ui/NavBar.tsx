import type { PlayerDto } from '../api/types';

export type NavTarget = 'start' | 'leaderboard' | 'stats' | 'help';

interface NavBarProps {
  readonly player: PlayerDto | null;
  readonly current: NavTarget | null;
  readonly onNavigate: (target: NavTarget) => void;
}

export function NavBar({ player, current, onNavigate }: NavBarProps) {
  const link = (target: NavTarget, label: string, className = 'nav-link') => (
    <button
      type="button"
      className={current === target ? `${className} active` : className}
      aria-current={current === target ? 'page' : undefined}
      onClick={() => onNavigate(target)}
    >
      {label}
    </button>
  );

  return (
    <nav className="navbar" aria-label="Navigasi utama">
      <span className="nav-brand">
        <img src="/brand/logo-mark.png" alt="" width="34" height="34" />
        KetikNgebut
      </span>
      {link('start', 'Main')}
      {link('leaderboard', 'Leaderboard')}
      {player && link('stats', 'Statistik')}
      {link('help', 'Cara bermain')}
      <span className="nav-spacer" />
      {player ? (
        <span className="nav-user" data-testid="nav-player">
          {player.nickname}
        </span>
      ) : (
        <span className="nav-user">Tamu</span>
      )}
    </nav>
  );
}
