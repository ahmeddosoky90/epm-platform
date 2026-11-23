# Testing

## Automated tests

```bash
npm test              # Vitest: unit and integration (needs a migrated and seeded database)
npm run typecheck
```

43 tests, all passing:

| File | Covers |
| --- | --- |
| `tests/unit/calc.test.ts` | BRD 11.4 finance (variances, EAC, EV, CPI, SPI, decimal exactness), labour cost, currency conversion, planned %, risk scoring and bands, weighted prioritisation and overrides, working-day capacity with holidays and leave, over-allocation, workflow transition rules (roles, required fields, blockers, approval, super user), cycle detection, project key generation, burndown with scope change, velocity, cycle and lead time |
| `tests/unit/schedule-mspdi.test.ts` | Critical path (float, SS with lag, summaries excluded), dependency cycles, summary roll-up; MS Project XML parse (outline, links, lag, resources, warnings), export round trip, rejection of DTDs, non-project and empty files; ISO durations |
| `tests/unit/jql-guac.test.ts` | EQL parsing, precedence, functions, ORDER BY, error cases, unsafe sort fields; Guacamole instruction encoding and stream splitting (partial frames, non-ASCII) |
| `tests/integration/authorization.test.ts` | Against the real database: workspace isolation for projects, issues, issue types and the audit log (404 rather than 403); member-only project visibility; PM write access only to their own projects; finance view and edit separation; issue creation by members but not executives; user and role administration restricted; escalation and self role-change guards; technical-portal permissions; credentials never returned |

The integration tests build the same `Ctx` that `getCtx()` builds, then call the service layer that the API routes use. They create one temporary project and one issue and remove them at the end.

## Verified by hand in a real browser (Playwright, Chromium)

- Every page renders for each role with no console or hydration errors. Pages a role cannot open redirect to an access-denied screen.
- MS Project XML exported from one project and imported into another, in both replace and merge modes. `.mpp` and DTD-bearing XML were rejected.
- Document upload and versioning, with executables rejected.
- Admin flows: create a user with an invite link, the escalation guard, the self role-change block, adding a workflow status, adding a holiday, filtering the audit log.
- SSH terminal against a real OpenSSH server (`whoami`), with the session recorded. Bad ticket → 4401, foreign origin → 403, changed host key → refused.
- SFTP list, upload and download.
- RDP through `guacd` to xrdp: the session establishes, but the screen image was not received (see the limitations in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)).
- Mailbox against Dovecot IMAP: a wrong password is refused with a clear message, the inbox lists, a message reads as text, and an issue is created from an email with a text attachment copied and an `.exe` attachment skipped.
- Arabic switches the shell to right-to-left.

## Suggested end-to-end journeys (to automate next)

1. A PMO administrator creates a user. The user signs in, enables MFA, signs out and signs back in.
2. A PM creates a project from a template, adds members, imports an MS Project XML plan and saves a baseline.
3. A team member creates issues, the board moves them through the workflow, a sprint starts and completes, and the burndown reflects it.
4. A PM submits a gate; the approver approves, and the project advances a lifecycle stage.
5. Finance records a budget and actuals; dashboards and exports show the same totals.
6. An auditor can read the audit log but cannot change anything.
