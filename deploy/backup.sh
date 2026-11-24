#!/usr/bin/env bash
# Backup database KetikNgebut: salinan aman SQLite (aman walau service sedang berjalan),
# dicek keutuhannya, dikompres, dan hanya KEEP salinan terakhir yang disimpan.
# Pakai:  sudo bash /opt/ketikngebut/deploy/backup.sh
set -euo pipefail

DB="${DB:-/var/lib/ketikngebut/ketikngebut.db}"
DIR="${BACKUP_DIR:-/var/backups/ketikngebut}"
KEEP="${KEEP:-7}"
MIN_FREE_MB="${MIN_FREE_MB:-300}"

if [ ! -f "$DB" ]; then
  echo "Database tidak ditemukan: $DB" >&2
  exit 1
fi
mkdir -p "$DIR"
chmod 700 "$DIR"

# Disk VPS sempit: jangan sampai backup menghabiskan sisa ruang.
free_mb=$(df -Pm "$DIR" | awk 'NR==2 {print $4}')
if [ "$free_mb" -lt "$MIN_FREE_MB" ]; then
  echo "Sisa disk tinggal ${free_mb} MB (< ${MIN_FREE_MB} MB); backup dilewati." >&2
  exit 1
fi

stamp=$(date +%Y%m%d-%H%M%S)
tmp="$DIR/.tmp-$stamp.db"
trap 'rm -f "$tmp"' EXIT

# .backup memakai API backup SQLite: konsisten walau ada penulisan bersamaan (mode WAL).
sqlite3 "$DB" ".backup '$tmp'"
if [ "$(sqlite3 "$tmp" 'PRAGMA integrity_check;')" != "ok" ]; then
  echo "Pemeriksaan keutuhan backup gagal; backup tidak disimpan." >&2
  exit 1
fi

out="$DIR/ketikngebut-$stamp.db.gz"
gzip -9 -c "$tmp" > "$out"
chmod 600 "$out"

# Simpan hanya KEEP backup terbaru.
ls -1t "$DIR"/ketikngebut-*.db.gz 2>/dev/null | tail -n +"$((KEEP + 1))" | xargs -r rm -f

echo "Backup selesai: $out ($(du -h "$out" | cut -f1))"
