# Panduan deploy KetikNgebut ke VPS (Ubuntu 24 + aaPanel)

Gambaran akhirnya:

```
Browser ──HTTPS──> Nginx (aaPanel)
                    ├─ /        → frontend (berkas statis di folder situs aaPanel)
                    └─ /api/... → backend .NET (service systemd, 127.0.0.1:5288)
                                     └─ SQLite /var/lib/ketikngebut/ketikngebut.db
```

Frontend dan API ada di domain yang sama, jadi tidak perlu CORS. Backend hanya mendengarkan di
`127.0.0.1`, sehingga dari internet hanya bisa diakses lewat Nginx.

**Pemakaian sumber daya (terukur di laptop, versi Release dengan setelan GC yang sama):**

| Kondisi | Private memory | Working set |
|---|---|---|
| Idle | ~30 MB | ~100 MB |
| 20 pemain, 200 balapan sekaligus | ~55 MB | ~135 MB |

Service dibatasi `MemoryMax=256M`. Paket unggahan sekitar 4 MB, backend terpasang sekitar 9 MB, runtime
ASP.NET Core sekitar 70 MB, dan database bertambah sekitar 25 KB per balapan.

> Ganti `ketik.domainanda.com` di seluruh panduan ini dengan domain atau subdomain Anda.

---

## Langkah A: build di laptop

Dari folder proyek di PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File deploy\publish.ps1
```

Hasilnya `publish\ketikngebut.tar.gz` (sekitar 4 MB): berisi backend, frontend, dan skrip deploy.

---

## Langkah B: pemasangan pertama di VPS

Semua perintah di bawah dijalankan di terminal VPS sebagai root (aaPanel: menu **Terminal**, atau SSH).

### B1. Arahkan domain ke VPS
Di pengelola DNS domain Anda, buat record **A** untuk `ketik.domainanda.com` yang menunjuk ke IP VPS.
Tunggu sampai `ping ketik.domainanda.com` menampilkan IP VPS Anda.

### B2. Unggah paket
aaPanel: menu **Files**, buka folder `/root`, klik **Upload**, pilih `publish\ketikngebut.tar.gz`.

### B3. Pasang runtime ASP.NET Core 10 dan alat bantu

Ubuntu 24.04 menyediakan runtime .NET 10 lewat `apt`, sehingga pembaruan keamanannya ikut `apt upgrade`:

```bash
apt update && apt install -y sqlite3 curl tar libicu74
apt install -y aspnetcore-runtime-10.0 && dotnet --list-runtimes
```

Hasil terakhir harus memuat `Microsoft.AspNetCore.App 10.0.x`. Bila paket `aspnetcore-runtime-10.0`
tidak ditemukan (`apt-cache policy aspnetcore-runtime-10.0` menampilkan `Candidate: (none)`), pakai skrip
resmi Microsoft:

```bash
wget https://dot.net/v1/dotnet-install.sh -O /tmp/dotnet-install.sh
bash /tmp/dotnet-install.sh --channel 10.0 --runtime aspnetcore --install-dir /usr/share/dotnet
ln -sf /usr/share/dotnet/dotnet /usr/bin/dotnet
```

### B4. Buat pengguna sistem dan folder

```bash
useradd --system --no-create-home --shell /usr/sbin/nologin ketikngebut
mkdir -p /opt/ketikngebut /var/lib/ketikngebut /etc/ketikngebut
chown ketikngebut:ketikngebut /var/lib/ketikngebut
chmod 750 /var/lib/ketikngebut
```

### B5. Buat situs di aaPanel
1. **Website** > **Add site**. Domain: `ketik.domainanda.com`. PHP: **Pure static**. Database: tidak usah.
2. Catat folder situs, biasanya `/www/wwwroot/ketik.domainanda.com`.

### B6. Pasang berkas aplikasi

```bash
tar -xzf /root/ketikngebut.tar.gz -C /tmp deploy/update.sh
WEB_ROOT=/www/wwwroot/ketik.domainanda.com bash /tmp/deploy/update.sh /root/ketikngebut.tar.gz
```

Pesan terakhir: `Berkas terpasang. Service belum dipasang...`. Itu normal untuk pemasangan pertama.

### B7. Isi berkas rahasia

```bash
cp /opt/ketikngebut/deploy/ketikngebut.env.example /etc/ketikngebut/ketikngebut.env
chmod 600 /etc/ketikngebut/ketikngebut.env
sed -i "s|^Jwt__SigningKey=.*|Jwt__SigningKey=$(openssl rand -base64 48)|" /etc/ketikngebut/ketikngebut.env
nano /etc/ketikngebut/ketikngebut.env
```

Di `nano`, pastikan `Jwt__SigningKey` sudah berisi string acak panjang. Isi `Seed__AdminEmail` dan
`Seed__AdminPassword` bila ingin akun admin (password minimal 8 karakter dan berisi angka).
Simpan dengan Ctrl+O, Enter, lalu keluar dengan Ctrl+X.

### B8. Pasang dan nyalakan service

```bash
cp /opt/ketikngebut/deploy/ketikngebut.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now ketikngebut
systemctl status ketikngebut --no-pager
curl http://127.0.0.1:5288/health
```

`status` harus menampilkan **active (running)** dan baris `Memory:` sekitar 30–120 MB. `curl` harus
menjawab `Healthy`. Saat start pertama, backend membuat tabel database dulu (bisa 10–20 detik di VPS 1 core);
bila `curl` belum menjawab, tunggu sebentar lalu ulangi. Bila gagal, lihat log:
`journalctl -u ketikngebut -n 50 --no-pager`.

### B9. Setelan Nginx (lewat folder tambahan aaPanel)
Setelan situs aaPanel memuat semua berkas `*.conf` di folder
`/www/server/panel/vhost/nginx/extension/DOMAIN/`. Setelan game ditaruh di sana sebagai berkas terpisah,
jadi setelan utama situs tidak perlu diedit. Perintah ini menguji setelan dulu dan membatalkan sendiri bila
ada kesalahan:

```bash
F=/www/server/panel/vhost/nginx/extension/ketik.domainanda.com/ketikngebut.conf; mkdir -p "$(dirname "$F")" && cp /opt/ketikngebut/deploy/nginx-ketikngebut.conf "$F" && if /www/server/nginx/sbin/nginx -t; then /www/server/nginx/sbin/nginx -s reload && echo "NGINX OK"; else rm -f "$F"; echo "GAGAL: berkas dihapus lagi, tidak ada yang berubah"; fi
```

### B10. HTTPS
Bila saat membuat situs (B5) **Apply for SSL** dicentang dan domain sudah mengarah ke VPS, sertifikat
Let's Encrypt sudah terpasang. Bila belum: **Website** > situs > **Conf** > **SSL** > **Let's Encrypt** >
centang domain > **Apply**. Setelah itu nyalakan **Force HTTPS** di halaman SSL yang sama.

### B11. Coba
Buka `https://ketik.domainanda.com`: pilih nickname, main satu balapan, lalu cek leaderboard.
Dari terminal: `curl https://ketik.domainanda.com/api/health` harus menjawab `Healthy`.

---

## Langkah C: backup otomatis

Coba sekali:

```bash
bash /opt/ketikngebut/deploy/backup.sh
ls -lh /var/backups/ketikngebut
```

Jadwalkan setiap hari pukul 03.00: aaPanel **Cron** > **Add Task** > tipe **Shell Script**, jadwal
harian 03:00, isi skrip:

```bash
bash /opt/ketikngebut/deploy/backup.sh
```

Skrip menyimpan 7 backup terakhir (dikompres), memeriksa keutuhannya, dan melewati backup bila sisa
disk di bawah 300 MB.

### Memulihkan dari backup

```bash
systemctl stop ketikngebut
gunzip -c /var/backups/ketikngebut/ketikngebut-YYYYMMDD-HHMMSS.db.gz > /var/lib/ketikngebut/ketikngebut.db
rm -f /var/lib/ketikngebut/ketikngebut.db-wal /var/lib/ketikngebut/ketikngebut.db-shm
chown ketikngebut:ketikngebut /var/lib/ketikngebut/ketikngebut.db
systemctl start ketikngebut
```

---

## Langkah D: swap (cadangan RAM)

Cek dulu apakah sudah ada swap: `swapon --show`. Bila kosong, buat 512 MB (cukup, dan hemat disk):

```bash
fallocate -l 512M /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl vm.swappiness=10
echo 'vm.swappiness=10' > /etc/sysctl.d/99-swappiness.conf
```

---

## Memantau

| Yang dicek | Perintah |
|---|---|
| RAM seluruh VPS | `free -h` |
| RAM service | `systemctl status ketikngebut --no-pager` (baris `Memory:`) |
| Sisa disk | `df -h /` |
| Ukuran database | `du -sh /var/lib/ketikngebut` |
| Log backend | `journalctl -u ketikngebut -n 100 --no-pager` |
| Batasi ukuran log sistem | `journalctl --vacuum-size=100M` |

---

## Update versi baru

1. Laptop: `powershell -ExecutionPolicy Bypass -File deploy\publish.ps1`.
2. Unggah `publish\ketikngebut.tar.gz` ke `/root` di VPS (timpa yang lama).
3. VPS:

```bash
tar -xzf /root/ketikngebut.tar.gz -C /tmp deploy/update.sh
WEB_ROOT=/www/wwwroot/ketik.domainanda.com bash /tmp/deploy/update.sh /root/ketikngebut.tar.gz
```

Skrip membuat backup database, mengganti backend dan frontend, menyalakan ulang service, dan mengecek
`/health`. Database tidak tersentuh; migration baru berjalan otomatis.

### Rollback bila versi baru bermasalah

```bash
systemctl stop ketikngebut
rm -rf /opt/ketikngebut/api && mv /opt/ketikngebut/api.old /opt/ketikngebut/api
systemctl start ketikngebut
```

---

## Catatan keamanan

- Berkas `/etc/ketikngebut/ketikngebut.env` berisi secret: izin `600`, jangan disalin ke tempat lain.
- Port 5288 tidak perlu (dan jangan) dibuka di firewall aaPanel; backend hanya untuk Nginx.
- Header keamanan (CSP, X-Frame-Options, dan lainnya) dipasang di setelan Nginx pada langkah B9.
- IP asli pemain diteruskan Nginx lewat `X-Forwarded-For`, sehingga rate limiting per IP tetap berjalan.
