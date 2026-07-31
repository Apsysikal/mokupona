#!/bin/bash
# Nightly off-provider backup of the Fly.io SQLite database.
#
# Runs on the Synology NAS (DSM 7 Task Scheduler). The NAS reaches
# out to Fly; nothing about the NAS is exposed inbound, and no Fly credential
# lives in GitHub. See ./plan.md for setup and rationale.

set -euo pipefail

CONFIG="/volume1/scripts/mokupona-backup.env"
BIN_DIR="/volume1/scripts/bin"
DEST_DIR="/volume1/backups/mokupona"

FLY_APP="mokupona-stack-b568"
DB_PATH="/data/sqlite.db"
REMOTE_TMP="/data/backup-tmp.db"

# A healthy dump is ~48 MB; anything near-empty means something went wrong
# upstream in a way that still produced a structurally valid file.
MIN_PLAIN_BYTES=1000000

# DSM hands non-root scheduled tasks a minimal environment: no usable HOME and
# a PATH that omits /usr/local/bin. flyctl needs a writable HOME for its agent
# socket and config.
export PATH="$BIN_DIR:/usr/local/bin:/usr/bin:/bin"
export HOME="/volume1/scripts/.flyhome"

# shellcheck source=/dev/null
. "$CONFIG"
: "${FLY_API_TOKEN:?missing in $CONFIG}"
: "${AGE_RECIPIENT:?missing in $CONFIG}"
: "${HC_PING_URL:?missing in $CONFIG}"
export FLY_API_TOKEN

mkdir -p "$HOME" "$DEST_DIR"
WORK="$(mktemp -d)"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

ping_hc() {
	curl -fsS -m 10 --retry 3 -o /dev/null "${HC_PING_URL}${1}" || true
}

cleanup() {
	rc=$?
	fly ssh console -a "$FLY_APP" -q -C "rm -f $REMOTE_TMP" >/dev/null 2>&1 || true
	rm -rf "$WORK"
	exit $rc
}
trap cleanup EXIT

fail() {
	echo "$*" >&2
	exit 1
}

ping_hc /start

# VACUUM INTO refuses to overwrite, so clear any leftover from a killed run.
# `-C` is not passed through a shell, so each call is a single argv vector and
# the two steps cannot be combined with &&.
fly ssh console -a "$FLY_APP" -q -C "rm -f $REMOTE_TMP"
fly ssh console -a "$FLY_APP" -q -C "sqlite3 $DB_PATH \"VACUUM INTO '$REMOTE_TMP'\""
fly ssh sftp get -a "$FLY_APP" -q "$REMOTE_TMP" "$WORK/snapshot.db"

# sqlite3 exits 0 while printing corruption reports, so assert on the output.
integrity="$(sqlite3 "$WORK/snapshot.db" 'PRAGMA integrity_check;')"
[ "$integrity" = "ok" ] || fail "integrity_check failed: $integrity"

foreign_keys="$(sqlite3 "$WORK/snapshot.db" 'PRAGMA foreign_key_check;')"
[ -z "$foreign_keys" ] || fail "foreign_key_check failed: $foreign_keys"

plain_bytes="$(wc -c <"$WORK/snapshot.db")"
[ "$plain_bytes" -ge "$MIN_PLAIN_BYTES" ] ||
	fail "snapshot is only $plain_bytes bytes; refusing to keep it"

# Encrypt to a public key: the private identity is deliberately absent from
# this NAS, so the backup cannot be read back here — and neither can anything
# that compromises the NAS or the offsite copy Hyper Backup pushes onward.
OUT="$DEST_DIR/mokupona-$STAMP.db.gz.age"
gzip -9c "$WORK/snapshot.db" | age -r "$AGE_RECIPIENT" -o "$WORK/out.age"

prev="$(ls -1t "$DEST_DIR"/*.db.gz.age 2>/dev/null | head -1)" || prev=""
out_bytes="$(wc -c <"$WORK/out.age")"
if [ -n "$prev" ]; then
	prev_bytes="$(wc -c <"$prev")"
	[ "$((out_bytes * 100 / prev_bytes))" -ge 50 ] ||
		fail "backup shrank by more than half ($prev_bytes -> $out_bytes bytes)"
fi

mv "$WORK/out.age" "$OUT"
echo "wrote $OUT ($out_bytes bytes, from $plain_bytes bytes uncompressed)"

ping_hc ""
