#!/usr/bin/env bash
# Pasang versi baru KetikNgebut dari arsip hasil deploy/publish.ps1.
# Database tidak disentuh (migration berjalan otomatis saat backend start). Versi lama disimpan
# di /opt/ketikngebut/api.old untuk rollback.
# Pakai:  sudo WEB_ROOT=/www/wwwroot/DOMAIN_ANDA bash update.sh /root/ketikngebut.tar.gz
set -euo pipefail

ARCHIVE="${1:?Pakai: sudo WEB_ROOT=/www/wwwroot/DOMAIN_ANDA bash update.sh /root/ketikngebut.tar.gz}"
WEB_ROOT="${WEB_ROOT:?Isi WEB_ROOT dengan folder situs di aaPanel, mis. /www/wwwroot/ketik.domainanda.com}"
APP=/opt/ketikngebut

if [ ! -d "$WEB_ROOT" ]; then
  echo "Folder situs tidak ada: $WEB_ROOT" >&2
  exit 1
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
tar -xzf "$ARCHIVE" -C "$tmp"
test -f "$tmp/api/KetikNgebut.Api.dll" || { echo "Arsip tidak berisi backend." >&2; exit 1; }
test -f "$tmp/web/index.html" || { echo "Arsip tidak berisi frontend." >&2; exit 1; }

# Backup database dulu (bila sudah ada).
if [ -f /var/lib/ketikngebut/ketikngebut.db ]; then
  bash "$tmp/deploy/backup.sh" || echo "Peringatan: backup gagal, update tetap dilanjutkan." >&2
fi

echo "Memasang backend..."
mkdir -p "$APP"
if systemctl is-active --quiet ketikngebut; then systemctl stop ketikngebut; fi
rm -rf "$APP/api.old"
if [ -d "$APP/api" ]; then mv "$APP/api" "$APP/api.old"; fi
mv "$tmp/api" "$APP/api"
rm -rf "$APP/deploy"
mv "$tmp/deploy" "$APP/deploy"
chown -R root:root "$APP"
chmod -R a+rX "$APP"

echo "Memasang frontend ke $WEB_ROOT..."
rm -rf "$WEB_ROOT/assets" "$WEB_ROOT/brand"
cp -r "$tmp/web/." "$WEB_ROOT/"

if [ -f /etc/systemd/system/ketikngebut.service ]; then
  systemctl start ketikngebut
  for _ in $(seq 1 15); do
    if curl -fsS http://127.0.0.1:5288/health >/dev/null 2>&1; then
      echo "Backend sehat. Update selesai."
      exit 0
    fi
    sleep 1
  done
  echo "Backend belum sehat setelah 15 detik. Cek: journalctl -u ketikngebut -n 50" >&2
  echo "Rollback: sudo systemctl stop ketikngebut && sudo rm -rf $APP/api && sudo mv $APP/api.old $APP/api && sudo systemctl start ketikngebut" >&2
  exit 1
fi
echo "Berkas terpasang. Service belum dipasang; lanjutkan langkah di docs/DEPLOY.md."
