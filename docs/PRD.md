# PRD: KetikNgebut (game balap mobil untuk melatih mengetik)

Versi 1.0 | Platform: web (browser) | Backend: C# / .NET 10 | Frontend: React + TypeScript + Three.js

## 1. Ringkasan

KetikNgebut adalah game balap berbasis browser di mana kecepatan mobil pemain ditentukan oleh kecepatan dan ketepatan mengetik. Pemain mengetik sebuah teks; makin cepat dan akurat, makin kencang mobilnya.

**Masalah yang diselesaikan.** Latihan mengetik biasanya membosankan sehingga orang berhenti berlatih. Game balap memberi umpan balik visual langsung (mobil melaju) dan motivasi bersaing (leaderboard dan balapan multiplayer).

**Tujuan produk**
- Pemain bisa langsung bermain satu balapan tanpa daftar akun.
- Kecepatan mobil terasa langsung berhubungan dengan cara pemain mengetik.
- Pemain yang memakai nickname punya riwayat, statistik, dan peringkat, tanpa perlu daftar atau login.
- Setiap balapan berisi 4 mobil: 1 pemain asli dan 3 bot (komputer) dengan kecepatan berbeda.
- Balapan melawan pemain lain secara real-time bersifat opsional (Fase 4), dikerjakan setelah inti game lengkap.

**Tujuan belajar** (alasan proyek ini ada)
- Menguasai C#, ASP.NET Core Minimal API, EF Core, JWT, dan (opsional) SignalR.
- Membangun game loop di browser dengan Three.js tanpa membuat React lambat.
- Menghasilkan proyek portofolio fullstack yang bisa dimainkan langsung.

**Ukuran sukses**
- Satu balapan satu pemain berjalan mulus (target 60 FPS di laptop biasa).
- Hasil balapan, leaderboard, dan statistik tersimpan dan tampil benar.
- Dua pemain atau lebih bisa berbalapan di satu room dengan progres yang sinkron.
- Setiap aturan di dokumen ini punya test otomatis (xUnit untuk backend, Vitest untuk logika mengetik).

## 2. Pengguna

| Peran | Siapa | Boleh |
|---|---|---|
| Tamu | Pengunjung tanpa nickname | Main mode latihan dan balapan 1 lawan 3 bot; hasil tidak disimpan |
| Pemain | Pengunjung yang memilih nickname unik (tanpa email dan password); nickname terikat ke browser lewat token rahasia | Semua fitur tamu, plus simpan hasil, statistik pribadi, dan leaderboard; balapan multiplayer hanya jika Fase 4 dikerjakan |
| Admin | Pengelola dengan akun email dan password (satu-satunya peran yang login) | Kelola teks (passage) dan moderasi leaderboard |

## 3. Scope dan fase

| Fase | Fokus | Hasil yang bisa didemokan |
|---|---|---|
| 0 | Setup | Frontend dan backend berjalan, satu test lulus di tiap sisi |
| 1 | Mesin mengetik dan prototipe satu pemain | Balapan satu pemain di browser, tanpa backend |
| 2 | Backend: nickname, skor, leaderboard | Pilih nickname, hasil tersimpan, leaderboard dan statistik pribadi; login khusus admin |
| 3 | Lawan bot dan tingkat kesulitan | Balapan 4 mobil: 1 pemain melawan 3 bot dengan kecepatan berbeda |
| 4 (opsional) | Multiplayer real-time (SignalR) | Room, hitung mundur, progres sinkron, hasil akhir |
| 5 | Poles dan rilis | Suara, statistik huruf lemah, responsif, deploy |

**Urutan pengerjaan yang disarankan:** 0, 1, 2, 3, 5, lalu 4 (opsional). Dengan begitu game inti (1 pemain + 3 bot) sudah lengkap dan bisa di-deploy sebelum multiplayer dikerjakan.

**Di dalam scope**
- Satu balapan selalu berisi 4 mobil: 1 pemain asli dan 3 bot.
- Teks bahasa Indonesia dan Inggris.
- Satu jenis mobil dengan beberapa warna, satu lintasan yang berulang (endless track).
- Keyboard fisik di desktop atau laptop.

**Di luar scope versi ini**
- Aplikasi mobile dan keyboard layar sentuh.
- Garasi dengan upgrade mobil berbayar, mata uang dalam game, dan pembayaran.
- Turnamen, chat, dan sistem pertemanan.
- Layout keyboard selain QWERTY.

## 4. Aturan inti permainan (dipakai semua fase)

**Mengetik**
- Pemain mengetik teks yang tampil. Karakter benar ditandai hijau, salah ditandai merah.
- Kursor tidak maju sampai karakter yang salah dihapus dengan Backspace (gaya TypeRacer), sehingga hasil akhir selalu teks yang benar.
- Setiap penekanan tombol dicatat: karakter yang ditekan dan waktu (milidetik sejak balapan mulai).

**Rumus**
- Kata standar = 5 karakter.
- WPM = (jumlah karakter benar / 5) / menit berlalu.
- Akurasi = penekanan tombol benar / total penekanan tombol (Backspace tidak dihitung).
- WPM bersih untuk skor = WPM x akurasi.

**Kecepatan mobil**
- Kecepatan target dihitung dari WPM pada jendela geser beberapa detik terakhir, bukan WPM kumulatif, supaya mobil bereaksi cepat ketika pemain mempercepat atau melambat.
- Kecepatan dipetakan dari WPM ke satuan kecepatan mobil dengan batas atas, dan diperhalus (easing) agar tidak patah-patah.
- Salah ketik memberi penalti singkat: kecepatan turun sesaat.
- Berhenti mengetik membuat mobil melambat bertahap sampai berhenti.
- Nilai jendela waktu, batas kecepatan, dan besar penalti disimpan di satu berkas konfigurasi agar mudah disetel.

**Balapan**
- Lintasan punya garis finis di akhir teks; posisi mobil = persentase teks yang sudah benar.
- Balapan dimulai setelah hitung mundur 3-2-1; mengetik sebelum mulai diabaikan.
- Balapan berakhir saat teks selesai. Ada batas waktu per balapan; pemain yang melewatinya dihitung tidak selesai.

## 5. Fase 1: Mesin mengetik dan prototipe satu pemain (frontend saja)

**User stories**
- Sebagai tamu, saya ingin langsung bermain tanpa daftar.
- Sebagai pemain, saya ingin melihat mobil melaju sesuai cara saya mengetik.
- Sebagai pemain, saya ingin melihat WPM dan akurasi langsung selama balapan.
- Sebagai pemain, saya ingin melihat ringkasan hasil di akhir dan bisa mengulang.

**Requirement**

| Kode | Requirement |
|---|---|
| TYP-1 | Modul mesin mengetik murni (tanpa React dan Three.js) yang menerima keystroke dan menghasilkan: karakter benar atau salah, posisi kursor, WPM, akurasi, dan status selesai |
| TYP-2 | Mesin mengetik bisa diputar ulang dari log keystroke dan menghasilkan hasil yang sama (deterministik) |
| TYP-3 | Backspace menghapus kesalahan; kursor tidak maju melewati karakter salah |
| TYP-4 | Hitung mundur 3-2-1 sebelum balapan; input diabaikan selama hitung mundur |
| GAM-1 | Mobil 3D di lintasan (Three.js), kecepatan mengikuti WPM jendela geser dan diperhalus |
| GAM-2 | Salah ketik memberi penalti kecepatan singkat dan umpan balik visual (misalnya getar) |
| GAM-3 | HUD: WPM, akurasi, persen progres, dan waktu |
| GAM-4 | Layar hasil: WPM, akurasi, durasi, dan tombol main lagi |
| GAM-5 | Game loop berjalan dengan requestAnimationFrame dan tidak memicu render ulang React di setiap frame |
| GAM-6 | Kumpulan teks awal tersimpan sebagai berkas JSON di frontend (Indonesia dan Inggris, beberapa tingkat kesulitan) |

**Acceptance criteria**
- [ ] Mengetik teks "abc" dengan benar menghasilkan 3 karakter benar, akurasi 100%, dan status selesai.
- [ ] Mengetik karakter salah tidak memajukan kursor; setelah Backspace dan karakter benar, kursor maju.
- [ ] Log keystroke yang sama diputar ulang menghasilkan WPM dan akurasi yang identik.
- [ ] WPM dihitung benar pada contoh: 50 karakter benar dalam 12 detik menghasilkan 50 WPM.
- [ ] Berhenti mengetik membuat kecepatan mobil turun sampai berhenti dalam beberapa detik.
- [ ] Mobil tidak pernah melebihi batas kecepatan maksimum walau pemain mengetik sangat cepat.
- [ ] Input saat hitung mundur tidak tercatat.
- [ ] Rata-rata frame time tetap stabil (target 60 FPS) di laptop biasa.

## 6. Fase 2: Backend, akun, skor, dan leaderboard

**User stories**
- Sebagai pemain, saya ingin cukup memasukkan nickname (tanpa daftar atau login) agar hasil saya tersimpan.
- Sebagai pemain, saya ingin melihat riwayat dan statistik saya (WPM rata-rata, terbaik, akurasi, jumlah balapan).
- Sebagai pemain, saya ingin melihat leaderboard.
- Sebagai admin, saya ingin login dengan akun admin lalu menambah dan menonaktifkan teks.

**Requirement**

| Kode | Requirement |
|---|---|
| ACC-1 | Pemain memilih nickname unik (3 sampai 24 karakter, huruf besar dan kecil dianggap sama) tanpa email atau password. Server mengembalikan token pemain rahasia acak yang disimpan otomatis di browser (localStorage) dan dipakai untuk mengirim hasil serta melihat statistik. Nickname yang sudah dipakai tidak bisa diklaim browser lain |
| ACC-2 | Server hanya menyimpan hash token pemain. Admin login dengan email dan password (password disimpan sebagai hash oleh ASP.NET Core Identity) dan mendapat access token JWT berumur pendek dan refresh token; pesan error login tidak membedakan email salah dan password salah |
| ACC-3 | Role Pemain (lewat token nickname) dan Admin (lewat JWT); endpoint admin hanya bisa diakses Admin, role dicek di server |
| ACC-4 | Pembatasan percobaan (rate limiting) untuk login admin dan klaim nickname |
| RES-1 | Pemain dengan nickname mengirim hasil balapan: id teks, log keystroke, dan durasi |
| RES-2 | Server menghitung ulang WPM dan akurasi dari log keystroke; angka dari klien tidak dipercaya |
| RES-3 | Server menolak hasil yang tidak masuk akal: WPM di atas batas yang dikonfigurasi, jeda antar keystroke tidak manusiawi secara konsisten, atau log yang tidak menghasilkan teks yang sama |
| RES-4 | Hasil yang ditolak tidak masuk leaderboard dan statistik |
| LBD-1 | Leaderboard WPM bersih terbaik: harian, mingguan, sepanjang masa, dengan paginasi |
| LBD-2 | Satu pemain hanya muncul sekali per periode (hasil terbaiknya) |
| STA-1 | Statistik pribadi: balapan total, WPM rata-rata, WPM terbaik, akurasi rata-rata, dan grafik WPM per waktu |
| PAS-1 | Endpoint teks acak berdasarkan bahasa dan tingkat kesulitan |
| PAS-2 | Admin bisa menambah, mengubah, dan menonaktifkan teks; teks yang pernah dipakai hanya dinonaktifkan |

**Aturan bisnis**
- Tamu (tanpa nickname) tetap bisa bermain tetapi hasilnya tidak dikirim.
- Nickname terikat ke browser: ganti browser atau hapus data browser berarti kehilangan nickname dan riwayatnya.
- Token kedaluwarsa atau tidak dikenal ditolak; tanpa token 401, token valid tetapi role tidak berhak 403 (misalnya token pemain ke endpoint admin).
- Secret JWT dan connection string tidak ada di kode.

**Acceptance criteria**
- [ ] Hasil dengan WPM 400 ditolak dan tidak masuk leaderboard.
- [ ] Log keystroke yang dimanipulasi (waktu diperkecil) menghasilkan penolakan atau WPM yang dihitung ulang, bukan angka klaim klien.
- [ ] Pemain yang sama dengan dua hasil dalam sehari hanya muncul sekali di leaderboard harian, dengan hasil terbaiknya.
- [ ] Pemain (token nickname) yang memanggil endpoint admin menerima 403.
- [ ] Nickname yang sudah dipakai tidak bisa diklaim lagi oleh browser lain (409), termasuk beda huruf besar dan kecil.
- [ ] Statistik rata-rata WPM sesuai perhitungan manual pada data uji.
- [ ] Setelah admin logout, refresh token yang sama tidak bisa dipakai lagi.

## 7. Fase 3: Lawan bot dan tingkat kesulitan

| Kode | Requirement |
|---|---|
| BOT-1 | Bot punya WPM target dan variasi acak kecil agar terasa hidup, tidak konstan sempurna |
| BOT-2 | Tingkat kesulitan: Pemula, Menengah, Mahir, dengan rentang WPM bot masing-masing |
| BOT-3 | Mode "ghost": salah satu dari tiga bot diganti bayangan rekor terbaik pemain sendiri (diputar ulang dari log keystroke) |
| BOT-4 | Setiap balapan selalu berisi 4 mobil: 1 pemain asli dan 3 bot. Ketiga bot punya WPM berbeda berdasarkan tingkat kesulitan yang dipilih (misalnya satu lebih lambat, satu setara, dan satu lebih cepat daripada WPM acuan tingkat itu; selisihnya ada di berkas konfigurasi) |
| BOT-5 | Layar hasil menampilkan peringkat semua mobil |

**Acceptance criteria**
- [ ] Setiap balapan menampilkan tepat 4 mobil: 1 pemain dan 3 bot, dan ketiga bot punya kecepatan rata-rata yang berbeda.
- [ ] Bot Pemula rata-rata lebih lambat daripada bot Mahir pada 20 balapan simulasi.
- [ ] Mode ghost menghasilkan lintasan yang sama dengan rekaman asli.
- [ ] Peringkat akhir mengikuti urutan finis, dengan pemain yang tidak selesai di posisi terakhir.

## 8. Fase 4 (opsional): Multiplayer real-time

Fase ini opsional dan dikerjakan setelah Fase 5. Inti game (1 pemain + 3 bot) sudah lengkap tanpa fase ini, dan backend tidak membutuhkan SignalR untuk itu, sehingga lebih ringan untuk VPS dengan RAM terbatas. Jika dikerjakan, balapan tetap berisi 4 mobil: slot yang tidak diisi pemain asli diisi bot.

**User stories**
- Sebagai pemain, saya ingin membuat room dan mengundang teman lewat kode atau tautan.
- Sebagai pemain, saya ingin bergabung ke room yang terbuka.
- Sebagai pemain, saya ingin melihat mobil lawan bergerak secara real-time.

**Requirement**

| Kode | Requirement |
|---|---|
| MUL-1 | Komunikasi real-time memakai SignalR (hub di backend .NET) |
| MUL-2 | Pemain membuat room dengan kode unik; pemain lain bergabung dengan kode |
| MUL-3 | Room berisi 4 mobil: 2 sampai 4 pemain asli, dan slot yang kosong diisi bot; host memulai balapan |
| MUL-4 | Server memilih satu teks yang sama untuk semua pemain dan memulai hitung mundur serentak |
| MUL-5 | Setiap pemain mengirim progres (jumlah karakter benar) secara berkala; server menyebarkannya ke pemain lain |
| MUL-6 | Server menyimpan keadaan room di memori dan menjadi sumber kebenaran urutan finis |
| MUL-7 | Pemain yang terputus ditandai terputus dan tidak menghalangi balapan berakhir |
| MUL-8 | Hasil balapan multiplayer divalidasi seperti RES-2 dan RES-3 sebelum masuk leaderboard |
| MUL-9 | Pemain wajib punya nickname (token pemain) untuk multiplayer |

**Acceptance criteria**
- [ ] Dua klien di satu room melihat teks yang sama dan hitung mundur yang sinkron.
- [ ] Progres satu pemain muncul di layar pemain lain dalam waktu yang terasa langsung.
- [ ] Urutan finis di semua klien sama dengan keputusan server.
- [ ] Pemain yang menutup tab di tengah balapan tidak membuat balapan menggantung.
- [ ] Pemain tidak bisa bergabung ke room yang sudah penuh atau sedang berlangsung.

## 9. Fase 5: Poles dan rilis

| Kode | Requirement |
|---|---|
| POL-1 | Efek suara mesin, ketikan, dan salah ketik, dengan tombol bisukan |
| POL-2 | Statistik per huruf: huruf yang paling sering salah, dan mode latihan yang memfokuskan huruf lemah |
| POL-3 | Tampilan responsif untuk layar laptop dan monitor besar; pesan yang jelas jika dibuka di layar sentuh |
| POL-4 | Pengaturan: bahasa teks, tingkat kesulitan, dan warna mobil, tersimpan per akun |
| POL-5 | Halaman petunjuk singkat cara bermain |
| POL-6 | Deploy ke VPS Ubuntu 24 yang dikelola aaPanel (RAM total sekitar 1 GB dengan sekitar 560 MB bebas, 1 core CPU, disk bebas sekitar 3 GB): backend satu instance sebagai service di belakang Nginx yang sudah ada (reverse proxy lewat aaPanel) dengan HTTPS dari aaPanel, frontend sebagai situs statis di aaPanel, database SQLite mode WAL dengan backup berkala, README lengkap |
| POL-7 | Batas sumber daya: pemakaian RAM backend diukur (idle dan saat satu balapan berjalan; jika Fase 4 dikerjakan, juga dengan beberapa koneksi SignalR) dan dicatat di README; layanan berjalan sebagai service systemd dengan batas memori dan pengaturan GC yang hemat memori; swap ditambahkan secukupnya; tidak memakai Docker; build frontend dan publish backend dilakukan di luar VPS; pemakaian disk dipantau karena disk sudah terpakai sekitar 84% |

## 10. Arsitektur dan tech stack

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Frontend | React, TypeScript, Vite | Sudah dikuasai pemilik proyek |
| Grafis game | Three.js | Sudah dikuasai; cocok untuk lintasan 3D |
| Animasi UI | GSAP | Transisi dan efek antarmuka |
| Logika mengetik | Modul TypeScript murni | Mudah dites tanpa browser |
| Test frontend | Vitest | Cocok dengan Vite |
| Backend | C# 14, .NET 10 (LTS), ASP.NET Core Minimal API | Target belajar utama |
| Data | Entity Framework Core; SQLite (mode WAL) saat belajar dan di VPS dengan RAM sekitar 1 GB | Hemat RAM karena tidak ada proses database terpisah; EF Core memudahkan pindah ke PostgreSQL bila pemain bertambah |
| Auth | Token nickname untuk pemain; ASP.NET Core Identity dan JWT Bearer untuk admin | Pemain tidak perlu daftar; hash password dan manajemen akun admin siap pakai |
| Real-time | SignalR (hanya Fase 4, opsional) | Standar real-time di .NET |
| Test backend | xUnit dan WebApplicationFactory | Unit dan integration test |

**Struktur repositori**
```
src/
  KetikNgebut.Api              endpoint, hub SignalR, auth, middleware
  KetikNgebut.Application      service, validasi hasil, DTO
  KetikNgebut.Domain           entitas dan aturan inti
  KetikNgebut.Infrastructure   DbContext, migrations
tests/
  KetikNgebut.Tests
web/                           React + TypeScript + Three.js
docs/PRD.md
```

**Non-functional**
- Performa: game loop terpisah dari state React; target 60 FPS di laptop biasa.
- Keamanan: HTTPS, CORS hanya untuk origin frontend, input divalidasi di server, tidak ada secret di repositori.
- Keadilan: hasil leaderboard selalu dihitung ulang di server dari log keystroke.
- Keandalan: room multiplayer tahan terhadap pemain yang terputus.
- Pemeliharaan: error API memakai ProblemDetails yang seragam; migrations disimpan di repositori.

## 11. Model data

| Entitas | Field utama | Catatan |
|---|---|---|
| Player | Id, Nickname, TokenHash, CreatedAt, IsActive | Pemain; nickname unik, token hanya disimpan sebagai hash |
| User | Id, Email, PasswordHash, Role, DisplayName, IsActive | Hanya akun admin; dikelola ASP.NET Core Identity |
| Passage | Id, Text, Language, Difficulty, IsActive | Teks balapan |
| RaceResult | Id, PlayerId, PassageId, Mode (Solo, Bot, Multiplayer), Wpm, Accuracy, NetWpm, DurationMs, KeystrokeLog, CreatedAt, IsValid | Angka dihitung ulang server |
| KeyStat | PlayerId, Character, Hits, Misses | Agregat untuk statistik huruf lemah |
| PlayerSettings | PlayerId, Language, Difficulty, CarColor | Pengaturan pemain |
| Room | Kode, Pemain, Status, PassageId | Disimpan di memori server, tidak di database |

## 12. Endpoint dan hub

| Area | Method dan path | Fungsi | Akses |
|---|---|---|---|
| Pemain | POST /players; GET /players/me | Klaim nickname, cek token | Publik (klaim), lalu pemain |
| Auth admin | POST /auth/login, /auth/refresh, /auth/logout | Sesi admin | Publik (hanya akun admin yang berhasil), lalu admin |
| Passage | GET /passages/random?lang=&difficulty= | Teks acak | Publik |
| Passage (admin) | GET, POST /passages; PUT, DELETE /passages/{id} | Kelola teks | Admin |
| Result | POST /results | Kirim hasil, divalidasi server | Pemain |
| Leaderboard | GET /leaderboard?period=daily, weekly, all | Peringkat | Publik |
| Stats | GET /me/stats; GET /me/keys | Statistik pribadi dan per huruf | Pemain |
| Ghost | GET /me/ghost?passageId= | Rekaman rekor terbaik sendiri (teks sama, atau terbaik keseluruhan) untuk mode ghost (BOT-3) | Pemain |
| Settings | GET, PUT /me/settings | Pengaturan | Pemain |
| Hub /hubs/race | CreateRoom, JoinRoom, StartRace, ReportProgress, LeaveRoom | Multiplayer | Pemain |

Konvensi: error memakai ProblemDetails (400 validasi, 401 tanpa token atau token tidak valid, 403 tidak berhak, 404 tidak ada, 409 konflik).

## 13. Milestone, risiko, dan pertanyaan terbuka

| Fase | Gerbang (selesai jika) |
|---|---|
| 0 | Frontend dan backend berjalan; satu test hijau di tiap sisi |
| 1 | Semua acceptance criteria TYP dan GAM lolos; balapan satu pemain mulus |
| 2 | Semua acceptance criteria ACC, RES, LBD, STA lolos; hasil palsu ditolak |
| 3 | Semua acceptance criteria BOT lolos |
| 4 (opsional) | Dua klien nyata bisa berbalapan; semua acceptance criteria MUL lolos |
| 5 | Berjalan di VPS dengan HTTPS, pemakaian RAM terukur dan di bawah batas, backup database berjalan; README dengan cara menjalankan |

**Risiko**

| Risiko | Dampak | Penanganan |
|---|---|---|
| Game loop lambat karena render ulang React | Gerak patah-patah | Game loop dan state di luar React (GAM-5), diukur sejak Fase 1 |
| Kecurangan lewat skrip atau manipulasi log | Leaderboard tidak adil | Hitung ulang di server, batas kewajaran, penandaan IsValid |
| Latensi jaringan membuat posisi mobil lawan tersendat | Multiplayer terasa buruk | Interpolasi posisi di klien; server hanya mengirim progres ringkas |
| Nickname terikat browser; token di localStorage | Pemain kehilangan nickname bila ganti browser; token bisa dicuri lewat XSS | Disampaikan di UI; tidak ada data pribadi (email/password) yang bisa bocor; CSP di Fase 5 |
| Penimbunan nickname (banyak klaim) | Nickname bagus habis | Rate limiting klaim nickname per IP |
| Lingkup melebar (garasi, turnamen, mobile) | Proyek tidak selesai | Daftar di luar scope dijaga; ide baru masuk backlog |
| Kode hasil AI tidak dipahami atau tidak aman | Bug dan celah sulit ditelusuri | Review manual bagian auth, validasi hasil, dan SignalR; aturan dijaga lewat test |
| RAM VPS sangat terbatas (total sekitar 1 GB, bebas sekitar 560 MB, berbagi dengan 2 situs dan 1 database yang sudah berjalan) | Layanan mati karena kehabisan memori | Pakai SQLite, tanpa Docker, ukur pemakaian RAM, batas memori di systemd, swap, build di luar VPS; jika tidak muat, naikkan paket VPS atau pindahkan game ke VPS terpisah |
| Disk VPS hampir penuh (terpakai sekitar 84%, bebas sekitar 3 GB) | Deploy atau backup gagal karena disk habis | Publish ringkas, hapus berkas build lama, backup database dikompres dan dibatasi jumlahnya, dan pantau ruang disk |
| Jika Fase 4 dikerjakan: room multiplayer hanya di memori satu instance | Tidak bisa skala ke banyak server, dan room hilang saat restart | Diterima untuk versi ini; restart dilakukan di luar jam ramai, dan klien menampilkan pesan koneksi putus |

**Keputusan** (sudah ditetapkan pemilik proyek)
- Sumber teks: ditulis sendiri atau dibuat AI (teks asli, bukan salinan), sekitar 30 sampai 50 teks per bahasa; ditambah lewat fitur admin.
- Tamu boleh melihat leaderboard tanpa nickname.
- Pemain tidak daftar atau login; cukup nickname unik yang terikat ke browser. Hanya admin yang login.
- Deploy ke VPS pribadi (Ubuntu 24 dengan aaPanel; RAM total sekitar 1 GB, bebas sekitar 560 MB; lihat POL-6, POL-7, dan risiko RAM dan disk).
- Target waktu per fase ditentukan pemilik proyek sendiri; dokumen ini sengaja tidak memberi tanggal.

**Pertanyaan terbuka**
- Apakah RAM VPS bisa dinaikkan, atau game dipindah ke VPS terpisah jika ternyata tidak muat setelah diukur di Fase 5?
- Apakah sudah ada domain atau subdomain untuk game ini?
