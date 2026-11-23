# REST API

Every endpoint is under `/api`, accepts and returns JSON, and authenticates with the session cookie set by `POST /api/auth/login`.

## Conventions

- **Success:** `{ "data": … }`. List endpoints that page also return `total`, `page` and `pageSize`.
- **Errors:** `{ "error": { "code": "FORBIDDEN", "message": "…" } }` with the matching status:

| Status | Meaning |
| --- | --- |
| 400 | Validation error (zod messages included) |
| 401 | Not signed in |
| 403 | Missing permission, or the object is read-only |
| 404 | Not found, or outside your workspace or project scope |
| 409 | Conflict |
| 429 | Rate limited |
| 502 | Upstream system failed (SSH, IMAP, SMTP) |

- **CSRF:** mutations sent with a foreign `Origin` are rejected.
- **Identifiers:** `[id]` in project routes accepts the UUID or the project key (`MBM`). Issue routes accept the UUID or the issue key (`MBM-42`).
- **Exports:** `?format=xlsx|csv`.
- **Permissions:** the names below are the keys from `src/lib/rbac/permissions.ts`. Object-level checks (project membership, project manager) apply as well.

## Authentication and profile

| Method and path | Purpose |
| --- | --- |
| `POST /auth/login` | `{email, password}`. Returns `{mfaRequired}`. Lockout after repeated failures. |
| `POST /auth/mfa` | Verify a TOTP code to finish sign-in |
| `PUT /auth/mfa`, `PATCH /auth/mfa`, `DELETE /auth/mfa` | Start enrolment (returns otpauth URL), confirm, disable |
| `POST /auth/logout` | End the session |
| `POST /auth/reset`, `PATCH /auth/reset` | Request a reset email; set a new password with a token |
| `PUT /auth/password` | Change password (signs out other sessions) |
| `POST /auth/workspace` | Switch the active workspace |
| `PATCH /me`, `DELETE /me` | Update profile and language; revoke other sessions |
| `GET /meta` | Issue types, priorities, users and statuses for forms |
| `GET /health` | Health probe, no authentication |

## Projects, portfolios and governance

| Method and path | Permission | Purpose |
| --- | --- | --- |
| `GET`, `POST /projects` | `project:create` to create | List (scoped) and create |
| `GET`, `PATCH`, `DELETE /projects/[id]` | Manager or `project:edit_all`; `project:archive` | Details, update, archive or restore |
| `PUT /projects/[id]/members` | Manager | Add, change or remove a member |
| `PUT /projects/[id]/scores` | `portfolio:manage` | Prioritisation scores and override with justification |
| `GET`, `POST /projects/[id]/status-reports` | Manager | Status reports |
| `GET`, `POST /portfolios`, `GET`, `POST /programs` | `portfolio:view`, `portfolio:manage` | Portfolio structure |
| `GET`, `POST /portfolios/[id]/scenarios` | `portfolio:view`, `portfolio:manage` | Scenario planning |
| `PATCH /gates/[id]` | `governance:manage` | Checklist and gate submission |
| `POST /approvals/[id]` | `governance:approve` (role of the approval step) | Approve or reject with a comment |
| `GET`, `POST /projects/[id]/changes`, `POST /changes/[id]` | `change:create`, approvers | Change requests |
| `GET`, `POST`, `PATCH /projects/[id]/risks`, `POST`, `PATCH /projects/[id]/raid` | `raid:manage` | Risks and RAID items |
| `GET`, `POST /projects/[id]/documents`, `GET`, `PATCH`, `DELETE /documents/[id]` | `document:manage` | Versioned documents (multipart upload), download, review status |
| `GET`, `POST`, `PATCH /projects/[id]/requirements` | `document:manage` | Requirements and traceability |

## Issues, agile and search

| Method and path | Permission | Purpose |
| --- | --- | --- |
| `GET`, `POST /projects/[id]/issues` | `issue:create` | List and create |
| `GET`, `PATCH`, `DELETE /issues/[id]` | `issue:edit`, `issue:delete` | Detail, update, soft delete |
| `POST /issues/[id]/restore`, `/clone`, `/move` | `issue:delete`, `issue:create` | Restore, clone, move to another project |
| `GET`, `POST /issues/[id]/transitions` | `issue:transition` | Available transitions; run one (workflow rules apply) |
| `POST /issues/[id]/comments`, `/worklogs` | `issue:comment` | Comment (mentions notify), log work |
| `POST`, `DELETE /issues/[id]/links` | `issue:edit` | Issue links (cycle-checked for blocks and depends-on) |
| `GET`, `POST /issues/[id]/attachments` | `issue:comment` | Attachments (validated) |
| `POST /issues/[id]/watch`, `/review` | Member | Watch or unwatch; reviewer decision |
| `POST /issues/bulk` | `issue:edit` | Bulk update |
| `POST /projects/[id]/rank` | `issue:edit` | Backlog ranking |
| `GET`, `POST /boards`, `GET`, `PATCH /boards/[id]`, `POST /boards/[id]/move` | `agile:manage` for configuration | Boards, columns, WIP, swimlanes; drag to transition |
| `GET`, `POST /projects/[id]/sprints`, `PATCH /sprints/[id]` | `agile:manage` | Create, start and complete sprints (with carry-over) |
| `GET /search?jql=…` | Scoped | EQL search |
| `GET`, `POST`, `DELETE /filters` | Owner | Saved and shared filters |

## Planning, finance and resources

| Method and path | Permission | Purpose |
| --- | --- | --- |
| `GET`, `POST /projects/[id]/plan` | `plan:edit` to change | Plan with critical path; create task |
| `PATCH`, `DELETE /plan-tasks/[id]`, `POST`, `DELETE /plan-tasks/[id]/deps` | `plan:edit` | Edit tasks and dependencies |
| `POST /projects/[id]/plan/baseline` | `plan:edit` | Save baseline |
| `POST /projects/[id]/plan/import` | `plan:edit` | Multipart MS Project XML, `mode=replace|merge` |
| `GET /projects/[id]/plan/export` | View | MS Project XML download |
| `GET`, `POST`, `DELETE /projects/[id]/budget` | `finance:view`, `finance:edit` | Budget sheet lines |
| `GET`, `POST /projects/[id]/transactions` | `finance:view`, `finance:edit` | Actual and committed spend (multi-currency) |
| `GET`, `POST /resources`, `PATCH`, `POST`, `DELETE /resources/[id]` | `resource:view`, `resource:manage` (leave: self) | Profiles, allocations, leave |
| `GET /export/projects`, `/export/budget`, `/export/issues` | `report:export` | Excel or CSV |

## Administration

| Method and path | Permission | Purpose |
| --- | --- | --- |
| `GET`, `POST /admin/users`, `PATCH /admin/users/[id]` | `admin:users` | Users, invites, role, activate, unlock, reset link |
| `GET`, `POST /admin/roles`, `PATCH`, `DELETE /admin/roles/[id]` | `admin:roles` | Roles (escalation-guarded) |
| `GET`, `PATCH /admin/workflows/[id]` | `admin:workflows` | Workflow editor operations |
| `PATCH /admin/settings` | `admin:workspace` | Workspace settings and calendar |
| `POST /admin/config` | `admin:workspace` or `admin:workflows` | Holidays, rates, lifecycle, gates, criteria, issue types, custom fields, departments |
| `GET /admin/audit` | `audit:view` (`report:export` for files) | Audit search and export |
| `GET`, `PATCH /notifications` | Self | List; mark read |
| `POST /jobs/reminders` | `Authorization: Bearer $CRON_SECRET` or an admin session | Due-date reminders |

## Technical portal and integrations

| Method and path | Permission | Purpose |
| --- | --- | --- |
| `GET`, `POST /tech/connections`, `PATCH`, `DELETE /tech/connections/[id]` | `tech:access`, `tech:manage` | Registered servers (secrets write-only) |
| `POST /tech/connections/[id]/ticket` | `tech:access` | One-time 30-second WebSocket ticket (`{password}` optional for RDP) |
| `POST /tech/connections/[id]/test` | `tech:access` | Reachability and sign-in test |
| `GET /tech/connections/[id]/rdp` | `tech:access` | `.rdp` file (no password inside) |
| `GET`, `POST /tech/connections/[id]/sftp` | `tech:access` | `?path=` list or `?file=` download; multipart upload |
| `GET`, `PUT`, `DELETE /integrations/mail` | Self | Your IMAP mailbox: status, connect (verified), disconnect |
| `GET /integrations/mail/messages` | Self | `?q=` search, `?uid=` read as text |
| `POST /integrations/mail/to-issue` | `issue:create` | `{uid, projectKey, typeId, priority, includeAttachments}` |
| `POST /integrations/smtp-test` | `integration:manage` | Send a test email to yourself |

## WebSockets

| Path | Protocol |
| --- | --- |
| `wss://host/ws/ssh?ticket=…&cols=…&rows=…` | Server sends terminal output as binary frames. The client sends JSON `{"type":"data","data":"…"}` for keystrokes and `{"type":"resize","cols":…,"rows":…}`. |
| `wss://host/ws/rdp?ticket=…&width=…&height=…&dpi=…` | Guacamole protocol (subprotocol `guacamole`) |

Both close with code 4401 for a bad or used ticket, and 4403 when the user or permission is no longer valid. An upgrade from a foreign origin is refused with HTTP 403.
