<p align="center">
  <img src="docs/banner.gif" alt="KetikNgebut: mahir mengetik, jadi cepat!" width="640" />
</p>

# KetikNgebut

Game balap mobil di browser: kecepatan mobil mengikuti kecepatan dan ketepatan mengetik.
Setiap balapan berisi 4 mobil (kamu + 3 bot, atau 2 bot + ghost rekor terbaikmu).
Spesifikasi lengkap ada di [docs/PRD.md](docs/PRD.md).

## Fitur

- Mesin mengetik gaya TypeRacer: kursor tidak maju sampai salah ketik dihapus dengan Backspace.
- Mobil 3D (Three.js); kecepatan mengikuti WPM beberapa detik terakhir.
- Lawan bot (Pemula, Menengah, Mahir) dan mode ghost.
- Tanpa daftar atau login: cukup nickname (opsional). Tamu tetap bisa main, tetapi hasilnya tidak disimpan.
- Server menghitung ulang WPM dan akurasi dari log keystroke dan menolak hasil yang tidak wajar.
- Leaderboard harian, mingguan, dan sepanjang masa; statistik pribadi dengan grafik.
- Statistik huruf lemah dan mode latihan yang memfokuskan huruf itu.
- Suara mesin, ketikan, dan salah ketik (Web Audio API), dengan tombol bisukan.
- Pengaturan tersimpan per nickname (atau di browser untuk tamu).
- Login khusus admin untuk mengelola teks lewat API.

## Struktur

```
src/KetikNgebut.Api              endpoint Minimal API, autentikasi, rate limiting
src/KetikNgebut.Application      service, validasi hasil, DTO
src/KetikNgebut.Domain           entitas dan mesin mengetik (port C#)
src/KetikNgebut.Infrastructure   DbContext EF Core (SQLite), migrations, Identity (admin)
tests/KetikNgebut.Tests          xUnit + WebApplicationFactory
web/                             React + TypeScript + Vite + Three.js
shared/fixtures/                 fixture bersama: mesin mengetik TypeScript == C#
```

## Kebutuhan

- .NET 10 SDK
- Node.js LTS

## Menjalankan di lokal

1. Kunci JWT untuk development (sekali saja; disimpan di user-secrets, tidak masuk repositori):

   ```powershell
   dotnet user-secrets set "Jwt:SigningKey" "<string acak minimal 32 karakter>" --project src/KetikNgebut.Api
   ```

2. (Opsional) akun admin. Tanpa ini, game tetap jalan tetapi tidak ada admin:

   ```powershell
   dotnet user-secrets set "Seed:AdminEmail" "admin@contoh.test" --project src/KetikNgebut.Api
   dotnet user-secrets set "Seed:AdminPassword" "<password minimal 8 karakter, berisi angka>" --project src/KetikNgebut.Api
   ```

3. Backend (port 5288). Saat start, migration dijalankan otomatis dan 24 teks di-seed dari
   `web/src/data/passages.json`. Database development ada di `src/KetikNgebut.Api/App_Data/` (tidak masuk repositori).

   ```powershell
   dotnet run --project src/KetikNgebut.Api --launch-profile http
   ```

4. Frontend (port 5173). Vite meneruskan `/api/*` ke backend, jadi tidak perlu pengaturan CORS saat development.

   ```powershell
   npm --prefix web install
   npm --prefix web run dev
   ```

5. Buka http://localhost:5173. Tambahkan `?debug` di URL untuk menampilkan FPS.

Tanpa backend, frontend tetap bisa dimainkan sebagai tamu memakai teks lokal.

## Menjalankan test

```powershell
dotnet build
dotnet test
npm --prefix web test
npm --prefix web run build
```

Nama test memuat kode requirement PRD (misalnya `RES_3_Wpm400_DitolakDanTidakMasukLeaderboard`,
`POL_2_LatihanMemuatHurufLemah`).

## Konfigurasi

| Bagian | Berkas | Isi |
|---|---|---|
| Penyetelan game | `web/src/config/gameConfig.ts` | kecepatan, penalti, bot, suara, latihan |
| Aturan server | `src/KetikNgebut.Api/appsettings.json` | batas kewajaran hasil, rate limit, leaderboard |
| Secret | user-secrets / environment variable | `Jwt__SigningKey`, `Seed__AdminEmail`, `Seed__AdminPassword`, `ConnectionStrings__Default` |

Nilai `Typing` di `appsettings.json` harus sama dengan `gameConfig.ts`; ini dicek oleh test
`RES_2_KonfigurasiTypingSamaDenganBackend`.

## Endpoint

| Endpoint | Akses |
|---|---|
| `POST /players`, `GET /players/me` | klaim nickname (publik, dibatasi per IP); cek token pemain |
| `POST /results` | pemain (header `X-Player-Token`) |
| `GET /me/stats`, `/me/keys`, `/me/ghost`; `GET`/`PUT /me/settings` | pemain |
| `GET /leaderboard`, `GET /passages/random`, `GET /health` | publik |
| `POST /auth/login`, `/auth/refresh`, `/auth/logout` | admin |
| `GET`, `POST /passages`; `PUT`, `DELETE /passages/{id}` | admin |

## Deploy

Panduan deploy ke VPS (aaPanel, Nginx, systemd, backup) belum dibuat; dikerjakan setelah domain dan hosting siap.
