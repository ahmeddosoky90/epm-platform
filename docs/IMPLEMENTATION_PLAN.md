# Implementation plan and status

The BRD asks for phased delivery with a working repository at every step. This is where each phase stands.

| Phase | Scope | Status |
| --- | --- | --- |
| 0. Assessment and architecture | Stack, schema, authentication approach, API conventions | Done: [ARCHITECTURE.md](ARCHITECTURE.md), [DATABASE.md](DATABASE.md), [API.md](API.md) |
| 1. Foundation and authentication | Shell, navigation, auth, users, workspaces, RBAC, admin console, audit | Done |
| 2. Core projects and issues | Projects, templates, issue types, issues, links, comments, history, workflow engine, members | Done |
| 3. Agile delivery | Scrum and Kanban boards, backlog, sprints, story points, work logs, agile reports | Done |
| 4. Governance and portfolio | Portfolios, programs, objectives, stage gates, approvals, checklists, roadmap, status reports | Done |
| 5. Finance and resources | Budgets, CAPEX/OPEX, actuals, forecasts, resources, allocation, capacity, dashboards | Done |
| 6. Reporting, search, advanced | Global search, EQL, saved filters, dashboards, exports, notifications, risks, changes, documents | Done |
| 7. Hardening | Tests, security, indexes, deployment docs, health check | Mostly done. See "Next steps". |
| Additional requests | MS Project, technical portal, mail and files, branding, Arabic and RTL | Done, with the limitations below |

## How the additional requests were met

- **MS Project.** MSPDI XML (what MS Project writes with *Save As → XML*) is parsed and written by `src/lib/msproject/mspdi.ts`. Tasks, outline, WBS, durations, progress, milestones, baselines, resources and FS/SS/FF/SF links with lag are carried over. Import can replace the plan or merge by task UID, keeping links to issues. XML with DTDs or entities is rejected (XXE protection).
- **Technical portal.** SSH and SFTP run natively (`ssh2`). RDP runs through Apache Guacamole's `guacd` daemon, which is the standard, maintained way to render RDP in a browser; the protocol tunnel is implemented in `server.ts`. Access needs `tech:access` (Head of PMO and Platform Administrator by default), and every session is audited.
- **Mail.** Per-user IMAP works with Exchange or Outlook (IMAP enabled), Gmail (app password) or any IMAP server. Microsoft Graph or Gmail OAuth can be added as further providers using the same `IntegrationAccount` model.
- **Branding.** "Lumen PMO", with an original logo, system font stack, frosted-glass surfaces, soft shadows, generous spacing and light and dark support. No Apple names or assets.

## Known limitations (honest status)

1. **`.mpp` binary files** are not parsed. Users save as XML in MS Project first; the import dialog says so, and `.mpp` uploads are rejected with that instruction.
2. **In-browser RDP rendering** needs confirming against a Windows host. With the xrdp test server, the Guacamole handshake, sign-in and session start succeeded and input reached the session, but xrdp sent only cursor updates and no screen image. `.rdp` download is the fallback and always works.
3. **SMTP** sending was not exercised against a live server here (none was available). Set `SMTP_*` and use *Mail & files → Send test email* to confirm. IMAP was verified against Dovecot.
4. **Single-instance state.** Rate limits and WebSocket tickets are kept in memory. Run one instance, or add Redis and sticky sessions for `/ws/*` before scaling out.
5. **Not implemented:** SSO (SAML or OIDC), GitHub integration, CSV import of issues, and translation of page bodies into Arabic (navigation and shell are translated, and the layout switches to RTL).

## Next steps (suggested order)

1. Confirm RDP against a Windows server, and SMTP against your relay.
2. Add OIDC single sign-on (Azure AD / Entra ID), reusing `createSession()`.
3. Add Playwright end-to-end tests for the main journeys (see [TESTING.md](TESTING.md)) to CI.
4. Add Redis for tickets and rate limits if more than one app instance is needed.
5. Translate page content into Arabic.
6. Add CSV import for issues and budget lines.
