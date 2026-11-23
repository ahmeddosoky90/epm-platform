# Architecture

## Overview

```
Browser (React 19, Next.js App Router pages, xterm.js, guacamole-common-js)
   │ HTTPS: pages and /api/*                 │ WSS: /ws/ssh, /ws/rdp (one-time ticket)
   ▼                                         ▼
server.ts: one Node process
   ├── Next.js request handler (server components and route handlers)
   ├── SSH gateway: ws ⇄ ssh2 (host-key pinning, idle timeout, byte counters)
   └── RDP gateway: ws ⇄ guacd (Guacamole protocol) ⇄ RDP server
   │
   ├── PostgreSQL (Prisma): all data, sessions and the audit log
   ├── Storage: local disk or S3-compatible bucket (attachments, documents)
   ├── SMTP relay (optional): notification email
   └── IMAP servers: each user's own mailbox, connected on demand
```

The UI is rendered on the server. Pages are server components that read through the service layer with the caller's context. Interactive parts (boards, Gantt, editors, terminal) are client components that call the JSON API.

## Code layout

| Path | Contents |
| --- | --- |
| `server.ts` | Custom HTTP server: Next.js plus the WebSocket gateways |
| `src/app/(app)` | Authenticated pages (shell, projects, boards, admin and others) |
| `src/app/api` | Route handlers; all use the `api()` wrapper |
| `src/lib/auth.ts` | Sessions, login, MFA, `Ctx`, `requirePermission`, `pagePermission` |
| `src/lib/rbac` | Permission catalogue and built-in role templates |
| `src/lib/services` | Business logic; every function takes a `Ctx` and enforces access |
| `src/lib/calc` | Pure calculations (finance, risk, capacity, schedule/CPM, agile, workflow), unit-tested |
| `src/lib/jql` | EQL tokenizer, parser and compiler to Prisma filters |
| `src/lib/msproject` | MS Project XML (MSPDI) parser and writer |
| `src/lib/tech` | SSH connector, Guacamole protocol, one-time tickets |
| `src/lib/integrations`, `src/lib/storage` | SMTP transport, storage drivers |
| `src/components` | UI components, grouped by feature |
| `prisma/` | Schema, migrations and the demo seed |

## Request handling and security

- **Authentication.** Opaque random session tokens live in an `HttpOnly`, `SameSite=Lax` cookie that is `Secure` in production. Only the SHA-256 of a token is stored. Sessions expire on idle and absolute timeouts. Optional TOTP MFA puts the session in an `mfaPending` state until verified. Failed sign-ins lead to a lockout.
- **Authorization.** All authorization happens on the server. `api()` resolves the context and turns errors into JSON with the right status. Services call `requirePermission(ctx, perm)` for actions, and use `projectScope(ctx)` and `loadProject` for object-level access: members see their projects, while `project:view_all` sees all of them. Pages use `pagePermission`, which redirects to `/denied`. Hiding a button is only for convenience; it is never the check.
- **Workspace isolation.** Every query is filtered by `ctx.workspaceId`. Objects from another workspace return 404 so their IDs are not disclosed. This is covered by `tests/integration/authorization.test.ts`.
- **CSRF.** Mutating API calls that carry a foreign `Origin` header are rejected, and bodies must be JSON. Together with `SameSite=Lax` cookies, a cross-site page cannot act for a signed-in user.
- **Input validation.** Every body is checked with zod, and EQL compiles to parameterised Prisma filters.
- **Uploads.** Size limit, extension allow-list, executable and active-content signatures rejected, magic-byte checks for images and PDF. Downloads are served with `Content-Disposition: attachment` and a sandbox CSP.
- **Secrets.** Server, RDP and mailbox credentials are encrypted with AES-256-GCM under `APP_ENCRYPTION_KEY`. They are never returned by the API: responses contain `hasSecret` only.
- **Audit.** `audit()` writes to `AuditLog`. A database trigger rejects `UPDATE` and `DELETE` on that table.

## Technical portal

1. The browser asks `POST /api/tech/connections/:id/ticket`. The server checks `tech:access` and issues a random ticket that is valid once, for 30 seconds, for that user and connection.
2. The browser opens `wss://…/ws/ssh?ticket=…` or `/ws/rdp`. `server.ts` checks the `Origin` against `APP_URL`, consumes the ticket, re-validates the user's session and permission, and opens the upstream connection with the decrypted credential. Credentials never reach the browser.
3. **SSH.** On first connect the server's host key fingerprint is pinned. Later mismatches are refused, protecting against man-in-the-middle attacks. Terminal bytes are relayed; the session closes after `TECH_IDLE_MINUTES`.
4. **RDP.** `server.ts` performs the Guacamole handshake with `guacd`, sets host, credentials and security mode itself, then relays Guacamole instructions. The browser cannot inject connection parameters.
5. **SFTP.** List, download and upload (100 MB limit) go through REST endpoints. Each is audited.
6. Every session is recorded in `TechSession` (start, end, bytes, outcome) and in the audit log.

## Mail and files

- **Personal mailbox (IMAP).** Each user stores their own server, user name and encrypted password in `IntegrationAccount`. Sign-in is checked before saving. Messages are fetched on demand and never cached. HTML mail is converted to text, never rendered, so mail cannot run script in the app. "Create issue" copies the subject, sender header, body and validated attachments into a new issue and labels it `email`.
- **Outgoing mail (SMTP).** nodemailer with `SMTP_*`. If it is not configured, email is off and the UI says so; nothing is simulated.
- **Storage.** `STORAGE_DRIVER=local|s3`. Object keys carry the driver prefix, so the driver can change without breaking old files.

## Scaling and operations

- The app is stateless apart from **in-memory rate limits and WebSocket tickets**. For more than one instance, either use sticky sessions for `/ws/*` together with the ticket endpoint, or move tickets and rate limits to Redis (the interfaces in `src/lib/tech/tickets.ts` and `src/lib/rate-limit.ts` are small).
- Long-lived WebSockets need the proxy idle timeout set above `TECH_IDLE_MINUTES`.
- Health check: `GET /api/health`. Logs go to stdout.
- Scheduled job: `POST /api/jobs/reminders`, hourly, with `Authorization: Bearer $CRON_SECRET`.
- Backups: PostgreSQL (`pg_dump`, or point-in-time recovery with WAL archiving) plus the storage directory or bucket. Keep `APP_ENCRYPTION_KEY` in a secrets manager.

## Extension points

- **SSO.** Add an OIDC or SAML callback that finds or creates the `User` and calls the same `createSession()` used by password login. Roles and workspaces are unchanged.
- **GitHub and other systems.** Add a provider in `src/lib/integrations` and an `IntegrationAccount.kind`, then link issues through `IssueLink` or a custom field.
