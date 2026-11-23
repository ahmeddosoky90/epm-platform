# Database

PostgreSQL 14 or later, accessed through Prisma. The schema is in `prisma/schema.prisma`, with 65 models and migrations in `prisma/migrations`.

## Conventions

- **Identifiers.** UUID primary keys everywhere. People-facing keys are separate and immutable: the project `key` (unique per workspace) and the issue `key` (`MBM-42`). Issue numbers come from `Project.issueCounter`, incremented inside the same transaction that creates the issue.
- **Workspace isolation.** Every top-level entity has a `workspaceId`. Child rows (issues, budget lines, tasks and so on) reach it through their project. Services always filter by the caller's workspace.
- **Money.** `Decimal(18,2)` for amounts, `Decimal(18,6)` for exchange rates, and `Prisma.Decimal` in code. Floating point is never used for money. Transactions store the original amount and currency plus `amountBase`, converted at the rate effective on the transaction date.
- **Time.** All timestamps are stored in UTC (Prisma `DateTime`, `timestamp(3)`). Display converts to the workspace time zone.
- **History.** Issues keep field-level `IssueHistory`. Business actions write `AuditLog`, which a trigger makes append-only (migration `audit_immutable`). Issues and documents use soft delete (`deletedAt`) where history must survive.
- **Integrity.** Foreign keys with explicit `onDelete` rules, unique constraints on natural keys (project key, issue key, role key, workflow status names and so on), and indexes on common filters (project and status, assignee, sprint, due date, audit time and entity).

## Main areas

| Area | Models |
| --- | --- |
| Identity and access | `Workspace`, `User`, `Session`, `PasswordResetToken`, `Role`, `WorkspaceMember`, `Department`, `Team`, `TeamMember` |
| Strategy and portfolio | `StrategicObjective`, `Portfolio`, `Program`, `PriorityCriterion`, `ProjectScore`, `Scenario` |
| Projects | `Project`, `ProjectTemplate`, `LifecycleStage`, `ProjectObjective`, `ProjectMember`, `ProjectDependency`, `StatusReport` |
| Work items | `IssueType`, `Issue`, `IssueLink`, `IssueComment`, `IssueHistory`, `WorkLog`, `IssueWatcher`, `Attachment`, `CustomField`, `SavedFilter` |
| Workflow | `Workflow`, `WorkflowStatus`, `WorkflowTransition` (rules held as JSON conditions plus `allowedRoles` and `requiredFields`) |
| Agile | `Board`, `BoardColumn`, `Sprint`, `SprintIssueEvent` (scope and completion events feed burndown), `Version` |
| Planning | `PlanTask` (MS Project UID, outline, baseline), `TaskDependency`, `Baseline`, `Milestone` |
| Governance | `GovernanceStageDef`, `ProjectGate`, `Approval`, `ChangeRequest`, `Risk`, `RaidItem` |
| Finance | `BudgetLine`, `FinancialTransaction`, `ExchangeRate`, `Holiday` |
| Resources | `Resource`, `ResourceAllocation`, `ResourceLeave` |
| Documents | `Document`, `DocumentVersion`, `Requirement` |
| Platform | `Notification`, `AuditLog`, `TechConnection`, `TechSession`, `IntegrationAccount` |

## Sensitive columns

| Column | Protection |
| --- | --- |
| `User.passwordHash` | bcrypt |
| `User.mfaSecret` | Encrypted, AES-256-GCM |
| `Session.id` | SHA-256 of the cookie token |
| `PasswordResetToken.id` | SHA-256 of the emailed token; single use; expires |
| `TechConnection.secretEnc`, `IntegrationAccount.secretEnc` | AES-256-GCM under `APP_ENCRYPTION_KEY`; never returned by the API |

## Migrations and seed

```bash
npx prisma migrate deploy     # apply migrations (production and CI)
npx prisma migrate dev        # create a new migration in development
npm run db:seed               # wipe and load demo data (development only)
```

The seed builds an "Enterprise Banking Group" workspace through the same bootstrap code used in production (roles, workflows, boards). It also adds a second, empty "Retail Operations" workspace for isolation checks. Demo users get `DEMO_PASSWORD`; if it is unset, a random password is generated and printed once.
