# Functional requirements: status by module

This maps the 20 modules of the BRD/FRS ([BRD.md](BRD.md)) to the running application. **Done** means the feature is usable end to end in the UI, persisted, and authorised on the server. **Partial** lists what is missing.

| # | Module | Status | Where |
| --- | --- | --- | --- |
| 1 | Authentication and user management | **Done.** Login and logout, password reset by emailed or one-time link, activation and deactivation, profiles, departments, job titles, role assignment, project membership, user search, session expiry (idle and absolute), bcrypt hashing, lockout after failed attempts, configurable password policy, optional TOTP MFA. SSO: the session model is provider-neutral, but no SAML or OIDC provider is wired. | `src/lib/auth.ts`, `src/app/login`, `src/app/(app)/profile`, `src/app/(app)/admin/users` |
| 2 | Organization and workspace management | **Done.** Multiple workspaces with switching, departments, teams, calendars (working days, holidays), currency and time zone. | `admin/workspace`, `src/lib/services/admin.ts` |
| 3 | Project management | **Done.** Create with templates, immutable keys, lifecycle stages (Idea to Closed), details, archiving (read-only), members. | `src/lib/services/projects.ts`, `projects/[key]` |
| 4 | Issue and work item management | **Done.** Configurable types with hierarchy levels (Epic, Story/Task/Bug, Sub-task), fields including severity and show-stopper, `KEY-n` generation in a transaction, clone, move, soft delete and restore, links (blocks, relates, duplicates, depends on), comments with mentions, field-level history, work logs, watchers, attachments, bulk edit. | `src/lib/services/issues.ts`, `issues/[key]` |
| 5 | Workflow engine | **Done.** Per-project workflows with statuses, categories and transitions. Rules: allowed roles, required fields, no open blockers, assignee only, reviewer approval. Visual editor in administration; changes are versioned and audited. | `src/lib/calc/workflow.ts`, `admin/workflows` |
| 6 | Agile Scrum | **Done.** Scrum boards, backlog ranking, sprint create, start and complete (with carry-over), story points, burndown from recorded scope events, velocity, sprint report. | `boards`, `backlogs`, `sprints`, `src/lib/calc/agile.ts` |
| 7 | Kanban | **Done.** Drag-and-drop columns mapped to statuses, WIP limits, swimlanes, cumulative flow, cycle and lead time. | `src/components/boards` |
| 8 | Planning and scheduling | **Done.** WBS outline, Gantt, FS/SS/FF/SF dependencies with lag and cycle prevention, critical path, baselines, summary roll-up, milestones. **MS Project XML import (replace or merge by UID) and export.** Native `.mpp` must first be saved as XML. | `src/lib/calc/schedule.ts`, `src/lib/msproject`, `projects/[key]/plan` |
| 9 | Portfolio management | **Done.** Portfolio, program and project structure, portfolio dashboard, weighted prioritisation with justified overrides, quarter roadmap, scenario planning. | `portfolios`, `programs`, `roadmap` |
| 10 | Governance and stage gates | **Done.** Configurable gates and checklists, submission, role-based approvals with comments, compliance and exception view. | `governance`, `src/lib/services/governance.ts` |
| 11 | Financial management | **Done.** Budget sheet by fiscal year, category and cost centre (proposed, approved, forecast), CAPEX/OPEX, actual and committed transactions, multi-currency at dated exchange rates, labour cost from logged hours times rate, BRD 11.4 calculations, workspace finance dashboard, Excel export. All money is `Decimal`. | `src/lib/calc/finance.ts`, `projects/[key]/finance`, `finance` |
| 12 | Resource and capacity | **Done.** Resource profiles (skills, rate, employment type), allocations with over-allocation warnings, leave, capacity heatmap over 6 or 12 months, department utilisation. | `src/lib/calc/capacity.ts`, `resources` |
| 13 | RAID | **Done.** Risks on a 5×5 matrix with bands, issues, assumptions and dependencies, owners and due dates, RAID dashboard. | `projects/[key]/raid` |
| 14 | Change management | **Done.** Change requests with cost, schedule and scope impact, approval routing, and an approved-change log. | `projects/[key]/changes` |
| 15 | Documents and requirements | **Done.** Versioned uploads with validation (allow-list, executable and active-content rejection), review and approval workflow, requirements with traceability to issues. | `src/lib/services/documents.ts` |
| 16 | Reporting and dashboards | **Done.** Executive, PMO and project-manager dashboards, project reports, a report catalogue, and Excel and CSV exports that match the screens. | `dashboards`, `reports`, `src/lib/export` |
| 17 | Search and query | **Done.** Global search, EQL query language (AND/OR/NOT, IN, IS EMPTY, functions, relative dates, ORDER BY), saved and shared filters. | `src/lib/jql`, `search` |
| 18 | Notifications | **Done.** In-app notifications for assignment, mention, transition, approval and due date, deduplicated, with optional email over SMTP and an hourly reminder job. | `src/lib/services/notify.ts`, `reminders.ts` |
| 19 | Audit and compliance | **Done.** An append-only audit log (enforced by a database trigger) covers sign-ins, data changes, permission changes, exports and technical-portal sessions. Searchable, with Excel and CSV export. | `src/lib/audit.ts`, `admin/audit` |
| 20 | Customization and administration | **Done.** Roles and permissions editor with escalation guards, issue types, custom fields, workflows, lifecycle stages, gates and criteria, holidays, exchange rates. | `admin/*` |

## Additional requests

| Request | Status |
| --- | --- |
| Login page | Done |
| Head of PMO (super user), Project Manager, Strategy, Data Analyst roles | Done, alongside the BRD roles (14 built-in) |
| Host MS Project plans | Done for MS Project XML (import and export). `.mpp` must be saved as XML first. |
| Project, program and portfolio management | Done |
| Kanban | Done |
| Graphs for tasks, open tickets, bugs and show-stoppers | Done (home, dashboards, project reports) |
| Budget sheet and control screens | Done |
| Technical portal for RDP and SSH | SSH terminal and SFTP done and verified. RDP works through `guacd`; the session establishes, but screen rendering still needs checking against a real Windows host. `.rdp` download done. |
| Apple-like branding with an original identity | Done ("Lumen PMO": system font stack, frosted glass, original logo) |
| Mail and local or remote files | Personal IMAP mailbox to issue (verified), SMTP notifications, local or S3 storage, SFTP |
