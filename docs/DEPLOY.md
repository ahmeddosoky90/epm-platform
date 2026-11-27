# Free hosting: Render + Supabase + Brevo, run from GitHub Actions

The app runs as one Docker container on Render's free web service. Supabase holds the database and uploaded files, Brevo sends email, and GitHub Actions builds, deploys and operates everything. No service in this setup needs a credit card.

```
Browser ──HTTPS/WSS──▶ Render free web service (server.ts: Next.js + SSH gateway)
                          ├──▶ Supabase Postgres (session pooler)
                          ├──▶ Supabase Storage (S3 API, bucket "epm-files")
                          └──▶ Brevo email API (HTTPS)
GitHub Actions ──▶ migrations, Render API (create, configure, deploy, logs), health ping, reminders, backups
```

## Secrets

Add these under **Settings → Secrets and variables → Actions**. They are the only values anyone types.

| Secret | Value |
| --- | --- |
| `RENDER_API_KEY` | Render → Account Settings → API Keys |
| `SUPABASE_DB_URL` | Supabase → Connect → **Session pooler** string (port 5432), with the database password filled in |
| `STORAGE_S3_ACCESS_KEY` / `STORAGE_S3_SECRET_KEY` | Supabase → Project Settings → Storage → S3 Connection → New access key |
| `BREVO_API_KEY` | Brevo → SMTP & API → API Keys |
| `MAIL_FROM` | A sender address verified in Brevo (the sign-up address already is) |
| `ADMIN_EMAIL` | The first administrator's email. On the first deploy they are emailed a link to set their password |

The first deploy generates `APP_ENCRYPTION_KEY`, `CRON_SECRET` and `BACKUP_PASSPHRASE` and stores them only as Render environment variables. Later deploys never change them. Copy `BACKUP_PASSPHRASE` and `APP_ENCRYPTION_KEY` somewhere safe outside Render: you need them to restore a backup.

The S3 endpoint, region and project are worked out from `SUPABASE_DB_URL`, so they need no secrets.

## Workflows

| Workflow | When | What it does |
| --- | --- | --- |
| `ci.yml` | Every pull request and push to `main` | Typecheck, migrate and seed a throwaway Postgres, tests, build |
| `deploy.yml` | Push to `main`, or run by hand | Migrate Supabase → create the bucket if needed → create or update the Render service and its settings → deploy this commit and wait for `/api/health` → create the first administrator if there are no users yet |
| `cron.yml` | Every 10 minutes; reminders at minute 7 of each hour | Health ping (keeps the free service awake and the Supabase project active), `POST /api/jobs/reminders` |
| `ops.yml` | By hand | `status`, `logs` (redacted), `restart`, `rollback`, `migrate`, `sync-settings`, `send-admin-link` |
| `backup.yml` | Nightly 01:40 UTC, or by hand | `pg_dump` encrypted with `BACKUP_PASSPHRASE`, kept 30 days as an artifact |

The repository is public, so Actions logs are public. The scripts mask every secret, never print set-password links, and redact emails, IP addresses and tokens from app logs.

`scripts/render.mjs` holds all Render API calls; run it with no arguments to see its commands.

## Free-tier limits

- **Sleep:** Render stops a free service after 15 minutes without traffic, and it takes about a minute to wake. The 10-minute ping usually prevents this, but GitHub can delay scheduled runs.
- **Memory:** 512 MB. The app idles at about 270 MB; `NODE_OPTIONS=--max-old-space-size=384` is set.
- **No SMTP:** Render's free tier blocks ports 25, 465 and 587, so email goes through Brevo's HTTPS API (300 emails a day).
- **No RDP in the browser:** that needs an always-on `guacd` service. `.rdp` download and SSH work.
- **Supabase:** 500 MB database and 1 GB files. A project with no activity for 7 days is paused; the health ping prevents that.
- **Disk:** Render's disk is wiped on every deploy, which is why files live in Supabase Storage.
- **Builds:** Render builds the Dockerfile itself; free accounts have a monthly build-minute allowance.

## Restore a backup

```bash
gpg --batch --passphrase "$BACKUP_PASSPHRASE" -d epm-YYYYMMDD-HHMM.dump.gpg > epm.dump
pg_restore --clean --if-exists --no-owner -d "$SUPABASE_DB_URL" epm.dump
```

## Upgrading off the free tier

Render's paid instance removes sleep and unblocks SMTP, and Supabase Pro adds daily backups. Neither needs code changes. To run in-browser RDP, add a `guacd` private service and set `GUACD_HOST`.
