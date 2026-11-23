# Lumen PMO

Lumen PMO is a web-based enterprise project, portfolio and agile delivery platform for a PMO. It covers Jira-style issues, Scrum and Kanban, Microsoft Project plans, budgets, resources, governance gates, executive dashboards and a gated technical portal for SSH, SFTP and RDP. It also links each person's mailbox so emails can become issues.

It is built with Next.js 15 (App Router), TypeScript, Prisma and PostgreSQL. Every number on screen is calculated from database records; nothing is mocked.

## What is in it

| Area | Highlights |
| --- | --- |
| Sign-in and access | Login, optional TOTP MFA, password policy, lockout, idle and absolute session expiry, password reset. 14 built-in roles (plus custom roles), including **Head of PMO** (super user), Project Manager, Strategy and Data Analyst. Permissions are checked on the server, and each workspace's data is kept separate. |
| Projects, programs, portfolios | Lifecycle stages, templates, archiving, strategic objectives, weighted prioritisation with overrides, scenario planning and a quarter roadmap. |
| Issues and agile | Configurable issue types, workflows (statuses, transitions, rules), hierarchy, links, comments, history, work logs and watchers. Scrum and Kanban boards with drag and drop, backlog, sprints, burndown, velocity, cycle and lead time. Query language (EQL) with saved filters. |
| Planning | Gantt chart with dependencies (FS/SS/FF/SF and lag), critical path, baselines and roll-up. **Microsoft Project XML import and export.** |
| Finance | Budget sheet by fiscal year, CAPEX/OPEX, actuals and commitments in multiple currencies, labour cost, EAC, CPI/SPI, cost-centre report and variance league table. Excel and CSV export. |
| Resources | Capacity heatmap built from the workspace calendar, holidays and leave. Allocations warn about over-allocation. |
| Governance | Stage gates with checklists, role-based approvals, change requests, RAID log and risk matrix. |
| Documents | Versioned project documents with review and approval (you cannot approve your own upload), and requirement traceability. |
| Dashboards | Executive, PMO and project-manager views. Charts cover tasks, open tickets, bugs and show-stoppers. |
| Technical portal | In-browser SSH terminal, SFTP file browser, RDP in the browser through Apache Guacamole's `guacd`, and `.rdp` download. Credentials are encrypted and never sent to the browser. SSH host keys are pinned on first use, connections use one-time tickets, idle sessions are closed and every session is audited. |
| Mail and files | Each person connects their own IMAP mailbox, reads mail as plain text and turns an email into an issue with its attachments. Outgoing notifications go through SMTP. Files are stored on local disk or any S3-compatible store. |
| Administration | Users and invites, roles and permissions, workflow editor, issue types, custom fields, calendars, exchange rates, lifecycle and gates, and a searchable audit log with export. |
| Language | English and Arabic. Arabic switches the layout to right-to-left. |

## Quick start (development)

You need Node.js 22 and PostgreSQL 14 or later (or Docker).

```bash
cp .env.example .env               # then set DATABASE_URL and APP_ENCRYPTION_KEY (openssl rand -base64 48)
docker compose up -d db guacd      # optional: local Postgres and the RDP gateway
npm ci
npx prisma migrate deploy
DEMO_PASSWORD='choose-a-demo-password' npm run db:seed
npm run dev                        # http://localhost:3000
```

The seed creates an "Enterprise Banking Group" workspace. It includes the **Mobile Banking Modernization (MBM)** project, run by Sarah Ahmed, with a budget of EGP 25M for 2027, plus nine other projects, portfolios, sprints, budgets, risks and resources. Every demo user signs in with `DEMO_PASSWORD`. Useful demo accounts:

| Email | Role |
| --- | --- |
| layla.hassan@epm.local | Head of PMO (super user) |
| sarah.ahmed@epm.local | Project Manager |
| karim.nabil@epm.local | Strategy |
| nour.salah@epm.local | Data Analyst |
| tarek.samir@epm.local | Executive |
| hana.mostafa@epm.local | Finance |
| admin@epm.local | Platform Administrator (technical portal) |
| ziad.fathy@epm.local | Team Member |

`npm run dev` starts `server.ts`, which serves Next.js together with the SSH and RDP WebSocket gateways. Use it instead of `next dev`.

## Production

```bash
docker compose up -d --build       # app + Postgres + guacd; reads .env
```

Or, on a host:

```bash
npm ci && npx prisma migrate deploy && npm run build && npm start
```

- Put the app behind HTTPS. Session cookies are `Secure` in production.
- Set `APP_URL` to the public URL. WebSocket connections from any other origin are refused.
- Run reminders every hour with `curl -X POST -H "Authorization: Bearer $CRON_SECRET" $APP_URL/api/jobs/reminders`.
- Load balancers can probe `GET /api/health`, which returns 200 when the app and the database are up and 503 otherwise.
- Back up PostgreSQL (for example nightly with `pg_dump -Fc`) and the storage directory or bucket. Keep `APP_ENCRYPTION_KEY` safe: without it, stored server and mailbox credentials cannot be decrypted.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for deployment topology and scaling notes.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server with the WebSocket gateways |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit and authorization tests (Vitest; needs a seeded database) |
| `npm run typecheck` | TypeScript check |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Reset the database to demo data |

## Documentation

- [docs/BRD.md](docs/BRD.md): the requirements, verbatim, plus the additional requests
- [docs/FRS.md](docs/FRS.md): status of each of the 20 modules and where it lives in the code
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): structure, security model, technical portal and integrations
- [docs/DATABASE.md](docs/DATABASE.md): data model and conventions
- [docs/API.md](docs/API.md): REST endpoints
- [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md): phases, what is done, known limitations and next steps
- [docs/TESTING.md](docs/TESTING.md): how to test and what has been verified

## Known limitations

- Native `.mpp` files are binary and proprietary. In Microsoft Project, use **File → Save As → XML**, then import the `.xml`. Export also produces MS Project XML.
- In-browser RDP was verified up to an established session against an xrdp test server, but that server sent no screen image. It still needs to be checked against a real Windows host. Downloading the `.rdp` file always works.
- SMTP sending is wired to nodemailer but was not tested against a live mail server in development. IMAP reading and email-to-issue were tested against a real Dovecot server.
- Rate limits, WebSocket tickets and RDP tickets are kept in memory, which assumes a single app instance. See ARCHITECTURE.md before scaling out.
- SSO (SAML or OIDC) and a GitHub integration are designed for but not implemented. CSV import of issues is not implemented; export to Excel and CSV is.
