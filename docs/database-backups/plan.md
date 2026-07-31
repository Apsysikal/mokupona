# Database backups

Nightly off-provider backups of the production SQLite database, driven from the
Synology NAS.

## Architecture

The NAS pulls; nothing pushes to it.

```
Fly volume (ams)  --- fly ssh (outbound WireGuard from the NAS) --->  NAS
     |                                                                 |
     |  daily volume snapshots, 60d retention                          |  Btrfs snapshots
     |  (fast local rollback, same failure domain)                     |  Hyper Backup -> Google Drive
```

GitHub Actions is deliberately not involved. flyctl's WireGuard is a userspace
implementation (`wireguard-go` over gVisor's netstack), so it needs no
`NET_ADMIN`, no `/dev/net/tun`, and no privileged container — only outbound
UDP 51820 and TCP 443. That makes a pull viable, which is preferable because:

- **Nothing new is exposed.** No port forward, no dynamic DNS, and CGNAT would
  not matter. Compare an HTTP backup endpoint: a single request returning 100%
  of the data, with no partial-failure mode, whose safety rests permanently on
  application code being correct.
- **No production database credential sits in GitHub.** A CI token would be
  reachable by every third-party action in the workflow's supply chain.
- **Retries and catch-up are possible.** GitHub Actions has no built-in job
  retry, so one missed scheduled run is a lost night. It also disables
  scheduled workflows in public repos after 60 days of inactivity — precisely
  the failure mode a quiet backup job walks into.

The database holds `Session.token`, `Account.password`, OAuth
access/refresh/id tokens, `Invite.tokenHash`, and `FormSubmission.answers`, so
a leaked dump is credential theft, not only a privacy incident. Hence
public-key encryption at creation, before the file is written anywhere.

## Setup

### 1. Fly access token

```sh
fly tokens create ssh -a mokupona-stack-b568 -x 8760h
```

Grants SSH to that one app and nothing else. Tokens default to a **20-year**
expiry when `-x` is omitted, so always set it; renew annually.

### 2. Volume snapshot retention

In `fly.toml`, under `[mounts]`:

```toml
snapshot_retention = 60   # 1..60, defaults to 5
```

Daily snapshots already run. This is fast local rollback, not a backup — same
account, same failure domain, and no in-place restore (you create a new volume
from a snapshot and reattach).

### 3. Binaries on the NAS

DSM's Task Scheduler environment is minimal, so install static binaries rather
than relying on anything system-wide. Note the official `flyio/flyctl` image is
unusable here: it is `FROM scratch` (no shell) and amd64-only.

```sh
mkdir -p /volume1/scripts/bin && cd /volume1/scripts/bin

case "$(uname -m)" in
  x86_64)  fly_arch=Linux_x86_64; age_arch=linux-amd64 ;;
  aarch64) fly_arch=Linux_arm64;  age_arch=linux-arm64 ;;
esac

curl -fsSL "https://github.com/superfly/flyctl/releases/latest/download/flyctl_${fly_arch}.tar.gz" \
  | tar -xz flyctl
curl -fsSL "https://github.com/FiloSottile/age/releases/latest/download/age-${age_arch}.tar.gz" \
  | tar -xz --strip-components=1 age/age age/age-keygen
chmod +x flyctl age age-keygen
```

`sqlite3` is present on DSM 7. Verify with `sqlite3 -version` (needs ≥ 3.27 for
`VACUUM INTO`); if absent, add it to the download list above.

### 4. Encryption keypair

Generate **off** the NAS — on your laptop:

```sh
age-keygen -o mokupona-backup-identity.txt
```

Store the identity file in your password manager **and** on paper somewhere
physically separate from the NAS. Only the `age1…` public key goes into the
config below. The NAS therefore cannot decrypt its own backups, and neither can
anything that reaches the offsite copy.

An encrypted backup whose identity is lost is not a backup. This is the single
most common way people discover their backups were worthless.

### 5. Config file

`/volume1/scripts/mokupona-backup.env`, `chmod 600`, owned by the task user:

```sh
FLY_API_TOKEN="FlyV1 ..."
AGE_RECIPIENT="age1..."
HC_PING_URL="https://hc-ping.com/<uuid>"
```

### 6. Schedule

`Control Panel > Task Scheduler > Create > Scheduled Task`, type **User-defined
script**, running `/volume1/scripts/nas-backup.sh` daily. Enable both:

- **Send run details by email**
- **Send run details only when the script terminates abnormally**

That option is exit-code driven — DSM treats a zero exit as normal and sends
nothing — which is why the script asserts on `PRAGMA integrity_check` output
rather than trusting sqlite3's exit status.

Also set `Settings > Save output results` to a folder so failures are
inspectable after the fact.

### 7. Heartbeat

Create a healthchecks.io check matching the schedule, grace ≈ 2× expected
runtime. This is not redundant with DSM's email: DSM can only notify you about
a task that _ran_. No NAS scheduler does anacron-style catch-up, so a NAS that
was powered off for three weeks produces silence, not an alert. Absence of
success is the condition worth alarming on.

### 8. Retention and offsite

Rotation is not implemented in the script on purpose. Point a **Btrfs snapshot
schedule** at `/volume1/backups/mokupona` and let the filesystem hold version
history — that removes a whole class of "my rotation script deleted the wrong
thing" bug. On DSM 7.2+ the snapshots can additionally be made immutable, so
even a compromised admin account cannot delete them inside the retention
window.

For the offsite leg, **Hyper Backup** the same folder to Google Drive. Using
Synology's own integration avoids registering an OAuth app, publishing it to
escape the 7-day refresh-token expiry, and the fact that Google's Drive API
policy names "backup of user or app content from a developer's app or project
to Drive" as a prohibited use case. The files are already encrypted, so this
third copy requires no trust in the destination.

## Restore

```sh
age -d -i mokupona-backup-identity.txt mokupona-<stamp>.db.gz.age \
  | gunzip > restored.db
sqlite3 restored.db 'PRAGMA integrity_check;'   # expect: ok
npx prisma migrate status                       # catches schema drift
```

Then boot the app against it and hit `/healthcheck` before trusting it.

Do this once now, and once a year. Verifying the file does not prove the app
can boot on it.

To put it back on Fly, stop the machine, `fly ssh sftp shell` the file into
`/data/`, and restart — never overwrite `sqlite.db` while the app holds it
open, which is a documented corruption vector.

## First-run checks

- Outbound UDP 51820 is not blocked by the router.
- flyctl's `-C` splits its argument shell-style, so the quoted `VACUUM INTO`
  statement arrives as one argv element. If the SQL turns out to be split on
  spaces, wrap it as `-C "sh -c '…'"` instead.
- Confirm production's journal mode. It was `delete` (not WAL) at the time of
  writing, which `VACUUM INTO` handles either way.

## Deliberately not done

- **An HTTP backup endpoint.** GitHub OIDC could authenticate one — verify the
  RS256 JWT against `token.actions.githubusercontent.com`, then check
  `repository_id` and `repository_owner_id`, since name claims are reusable and
  `aud` is attacker-chosen. But a pull needs no new public surface at all.
- **Litestream.** ~1s RPO and point-in-time recovery, and Fly configures it
  automatically for new Prisma+SQLite launches. It needs a WAL migration, an
  entrypoint rewrite, and its own heartbeat monitoring, and it fails _silently_
  where a scheduled job fails loudly. Worth revisiting if a 24-hour RPO stops
  being acceptable.
- **Hand-rolled rotation, object storage, restic/borg.** Filesystem snapshots
  plus Hyper Backup cover retention and offsite with tooling that is already
  maintained.
