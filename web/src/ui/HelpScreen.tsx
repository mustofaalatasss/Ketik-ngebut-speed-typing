import { gameConfig } from '../config/gameConfig';

const levels = Object.values(gameConfig.bots.levels);

/** POL-5: petunjuk singkat cara bermain. */
export function HelpScreen({ onStart }: { readonly onStart?: () => void }) {
  return (
    <div className="screen">
      <article className="card wide help" aria-labelledby="help-title">
        <h1 id="help-title">Cara bermain</h1>

        <h2 className="small-heading">1. Mengetik = menyetir</h2>
        <p>
          Ketik teks yang muncul di bawah layar. Makin cepat dan tepat kamu mengetik, makin kencang mobilmu. Berhenti
          mengetik membuat mobil melambat sampai berhenti.
        </p>

        <h2 className="small-heading">2. Salah ketik</h2>
        <p>
          Karakter salah ditandai merah dan kursor tidak maju sampai kamu menghapusnya dengan <kbd>Backspace</kbd>.
          Setiap salah ketik juga membuat mobil melambat sesaat.
        </p>

        <h2 className="small-heading">3. Skor</h2>
        <ul>
          <li>
            <strong>WPM</strong> = (karakter benar ÷ {gameConfig.charsPerWord}) ÷ menit.
          </li>
          <li>
            <strong>Akurasi</strong> = ketikan benar ÷ semua ketikan (Backspace tidak dihitung).
          </li>
          <li>
            <strong>WPM bersih</strong> = WPM × akurasi. Leaderboard memakai angka ini, dihitung ulang oleh server.
          </li>
          <li>Batas waktu tiap balapan {gameConfig.raceTimeLimitMs / 60_000} menit.</li>
        </ul>

        <h2 className="small-heading">4. Lawan</h2>
        <p>
          Kamu selalu balapan melawan 3 bot: satu lebih lambat, satu setara, dan satu lebih cepat dari tingkat lawan
          yang dipilih ({levels.map((l) => `${l.label} ~${l.baseWpm} WPM`).join(', ')}). Dengan nickname, kamu bisa
          melawan <em>ghost</em>: rekaman rekor terbaikmu sendiri.
        </p>

        <h2 className="small-heading">5. Nickname dan peringkat</h2>
        <p>
          Tanpa nickname kamu tetap bisa main sebagai tamu, tetapi hasil tidak disimpan. Masukkan nickname di halaman
          Main agar hasil, statistik, dan huruf lemahmu tersimpan. Nickname terikat ke browser ini.
        </p>

        <h2 className="small-heading">6. Latihan huruf lemah</h2>
        <p>
          Di halaman Statistik ada daftar huruf yang paling sering salah dan tombol latihan yang membuat teks khusus
          dari kata-kata berisi huruf itu. Hasil latihan tidak masuk leaderboard.
        </p>

        <p className="muted small">Butuh keyboard fisik. Suara bisa dibisukan di halaman Main atau saat balapan.</p>
        {onStart && (
          <button type="button" className="primary" onClick={onStart}>
            Ayo main
          </button>
        )}
      </article>
    </div>
  );
}
