# Business Requirements (BRD / FRS)

This is the requirements document the platform is built against, kept verbatim below.

## Additions requested on top of the BRD

- A login page.
- Role-based access with **Head of PMO (super user)**, **Project Manager**, **Strategy** and **Data Analyst**, alongside the BRD roles.
- Hosting Microsoft Project plans.
- Project, program and portfolio management.
- A Kanban interface.
- Graphs for tasks, open tickets, bugs and show-stoppers.
- Budget sheet and control screens.
- A technical portal for RDP and SSH.
- Apple-like look and feel with an original identity (no Apple names, logos or assets).
- Connection to the user's mail and to local and remote files, using real integrations only.

How each item is met is described in [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

---

ENTERPRISE PROJECT MANAGEMENT PLATFORM
Business Requirements Document (BRD), Functional Requirements Specification (FRS), and Technical Implementation Brief
Project Name: Enterprise Project Management Platform (EPM Platform)
Product Type: Enterprise Project Management, Project Portfolio Management, and Agile Delivery Platform
Reference Platform: Jira Software, Jira Work Management, and Jira Align
Target Users: Enterprise PMO, Project Managers, Product Owners, Business Analysts, Developers, Project Teams, Department Heads, Executives, and Portfolio Managers
Development Environment: Claude Code
Document Version: 1.0
Document Status: Approved for Development

1. ROLE AND MISSION
Act as a senior enterprise software architect, principal full-stack engineer, product manager, UX/UI designer, database architect, DevOps engineer, and enterprise project management consultant.
Your mission is to design, architect, develop, test, and deliver a production-ready enterprise project management platform that provides functionality comparable to Jira while introducing additional capabilities specifically designed for Enterprise Project Management Offices (EPMOs).
This is not a request to create a simple task management application, a static dashboard, a UI prototype, or a basic CRUD application.
I want you to build a complete, functional, scalable, secure, and maintainable enterprise software product.
The platform must support the entire project management lifecycle, from project initiation and business case approval through planning, execution, monitoring, governance, financial tracking, and project closure.
It must also support Agile delivery methodologies, traditional waterfall project management, and hybrid delivery models.
The platform should provide:
2. A comprehensive Jira-like issue and work management system.
3. Agile Scrum and Kanban capabilities.
4. Enterprise project and portfolio management.
5. Project governance and stage-gate management.
6. Project financial management.
7. Resource and capacity management.
8. Executive reporting and dashboards.
9. Enterprise PMO oversight and controls.
10. Configurable workflows and approval processes.
11. Integration capabilities with enterprise systems.

The final product should be suitable for deployment within a medium-to-large enterprise, including a banking environment with strict requirements for security, auditability, access control, and operational resilience.
1.1 Development Instructions
Before writing any code:

* Inspect the existing repository and understand its structure.
* Identify the existing technology stack, installed dependencies, available services, and development conventions.
* Determine whether an existing application can be extended or whether a new application must be created.
* Review existing documentation, environment variables, database configuration, and deployment setup.
* Do not overwrite existing work without understanding its purpose.
* Do not replace an existing technology stack unnecessarily.
* Create a clear implementation plan and technical architecture.

If the repository is empty, establish a suitable architecture and technology stack.
If requirements are ambiguous, make reasonable enterprise-grade assumptions and document them.
Do not stop after producing a plan.
Your responsibility is to implement the actual application, not merely describe how it should be built.
Work iteratively, maintain a functional application throughout development, and verify the functionality of every major feature.
Do not mark a feature as completed if it is only represented by a button, placeholder, static chart, or non-functional UI element.
2. BUSINESS CONTEXT
The platform will serve as a centralized enterprise project management and governance solution.
It should enable an organization to manage projects, programs, portfolios, resources, financials, delivery activities, risks, issues, dependencies, and strategic initiatives through one integrated system.
The application must support three interconnected operational levels:
Level 1: Enterprise Portfolio Management
This level is primarily used by the Enterprise PMO, executive management, portfolio managers, and finance stakeholders.
It includes:

* Strategic initiative management.
* Enterprise project portfolio.
* Project prioritization.
* Business case management.
* Investment planning.
* CAPEX and OPEX tracking.
* Portfolio financial performance.
* Resource capacity planning.
* Project governance.
* Executive dashboards.
* Portfolio risks and dependencies.
* Benefits realization.

Level 2: Project Management
This level is primarily used by project managers, PMO delivery teams, and project sponsors.
It includes:

* Project initiation.
* Project charter.
* Scope management.
* Project planning.
* Milestone management.
* Project schedules.
* Work breakdown structures.
* Project budgets.
* Resource assignments.
* Risk and issue management.
* Project reporting.
* Status reporting.
* Change control.
* Stage-gate approvals.
* Project closure.

Level 3: Agile and Operational Delivery
This level is primarily used by product owners, scrum masters, business analysts, developers, testers, and delivery teams.
It includes:

* Epics.
* Stories.
* Tasks.
* Subtasks.
* Bugs.
* Sprints.
* Backlogs.
* Scrum boards.
* Kanban boards.
* Workflows.
* Issue assignments.
* Comments.
* Attachments.
* Time tracking.
* Dependencies.
* Releases.
* Versions.
* Agile metrics.

All three levels must be connected.
For example, an executive should be able to navigate from a portfolio-level strategic initiative to a project, then to a milestone, then to an epic, and finally to the individual tasks and issues being delivered.
The system must maintain traceability throughout this hierarchy.
3. PRODUCT OBJECTIVES
The application must achieve the following business objectives.
3.1 Centralized Project Management
Provide one centralized system for managing projects, programs, portfolios, delivery activities, governance, and reporting.
3.2 Standardized Governance
Establish consistent project management processes, approval workflows, stage gates, reporting standards, and governance controls across the enterprise.
3.3 Improved Project Visibility
Enable management to understand the status, health, risks, financial performance, resource utilization, and delivery progress of every project.
3.4 Improved Delivery Efficiency
Provide teams with modern Agile and traditional project management tools that reduce manual reporting and improve delivery execution.
3.5 Financial Transparency
Provide visibility into approved budgets, actual expenditures, forecast costs, CAPEX, OPEX, and financial variances.
3.6 Resource Optimization
Enable the PMO to understand resource availability, capacity, utilization, allocation, and demand across projects.
3.7 Executive Decision Support
Provide management with accurate, consolidated, and actionable information for prioritization, investment decisions, and portfolio optimization.
3.8 Auditability and Accountability
Maintain a complete record of important project decisions, approvals, changes, and activities.
4. TARGET USERS AND USER ROLES
Implement a comprehensive role-based access control system.
The following roles must be supported.
4.1 Platform Administrator
Responsibilities:

* Manage platform configuration.
* Manage users and groups.
* Configure global settings.
* Manage roles and permissions.
* Configure authentication.
* Configure integrations.
* Manage global issue types.
* Configure workflow templates.
* Configure custom fields.
* Manage system-level settings.

4.2 Enterprise PMO Administrator
Responsibilities:

* Configure project governance standards.
* Manage project templates.
* Manage portfolio structures.
* Configure project lifecycle stages.
* Configure reporting requirements.
* Manage enterprise-level project classifications.
* Configure PMO approval processes.
* Manage portfolio reporting.

4.3 Portfolio Manager
Responsibilities:

* Create and manage portfolios.
* Create and manage programs.
* Evaluate business cases.
* Prioritize projects.
* Review financial performance.
* Review resource demand.
* Monitor project health.
* Manage portfolio risks.
* Generate portfolio reports.

4.4 Project Manager
Responsibilities:

* Create and manage projects.
* Build project plans.
* Manage milestones.
* Assign tasks.
* Manage project resources.
* Track project budgets.
* Manage risks and issues.
* Submit status reports.
* Manage project changes.
* Manage project closure.

4.5 Product Owner
Responsibilities:

* Manage product backlogs.
* Create and prioritize epics and stories.
* Manage sprint scope.
* Define acceptance criteria.
* Approve completed work.
* Manage product releases.

4.6 Scrum Master
Responsibilities:

* Manage sprints.
* Facilitate sprint planning.
* Manage team boards.
* Track blockers.
* Monitor sprint progress.
* Manage sprint retrospectives.
* Monitor Agile metrics.

4.7 Team Member
Responsibilities:

* View assigned work.
* Update issue status.
* Record work logs.
* Add comments.
* Upload attachments.
* Manage assigned tasks.
* View project documentation.

4.8 Business Analyst
Responsibilities:

* Create requirements.
* Manage business requirements.
* Link requirements to stories.
* Maintain acceptance criteria.
* Manage requirement traceability.
* Participate in change management.

4.9 Executive / Senior Management
Responsibilities:

* View portfolio dashboards.
* Review project health.
* Review strategic alignment.
* Review financial performance.
* Review major risks and dependencies.
* Approve designated business cases and stage gates.
* Access executive reports.

4.10 Finance User
Responsibilities:

* Review project budgets.
* Review actual expenditures.
* Review financial forecasts.
* Validate financial data.
* Review CAPEX and OPEX allocations.
* Access financial reports.

4.11 Auditor / Read-Only User
Responsibilities:

* View authorized projects and records.
* Access audit logs.
* Review approval history.
* Export permitted reports.
* Cannot modify project data.

The permission model must support custom roles and permissions beyond these predefined roles.
5. FUNCTIONAL REQUIREMENTS
MODULE 1: AUTHENTICATION AND USER MANAGEMENT
Implement a complete authentication and authorization module.
Requirements:

1. User registration must be restricted to authorized users or administrators.
2. Support secure login and logout.
3. Support password reset.
4. Support account activation and deactivation.
5. Support user profiles.
6. Support profile pictures and user avatars.
7. Support organizational departments.
8. Support teams and groups.
9. Support job titles and reporting lines.
10. Support role assignment.
11. Support project-level membership.
12. Support user search.
13. Support user activity history.
14. Support session expiration.
15. Support secure password hashing.
16. Support account lockout or throttling after repeated failed login attempts.
17. Support configurable password policies.
18. Support optional MFA.
19. Design the authentication architecture to support future enterprise SSO integration.

Use secure session management or an appropriately implemented token-based authentication architecture.
Never store plaintext passwords.
All authorization decisions must be enforced by the backend, not merely by hiding UI elements.
MODULE 2: ORGANIZATION AND WORKSPACE MANAGEMENT
The system must support multiple organizational workspaces.
Each workspace represents an organization, business unit, department, or other administrative boundary.
Requirements:

* Create and manage workspaces.
* Configure workspace name and description.
* Configure workspace branding.
* Configure timezone.
* Configure default language.
* Configure fiscal year.
* Configure working days.
* Configure working hours.
* Configure public holidays.
* Manage workspace users.
* Manage workspace groups.
* Configure workspace permissions.
* Configure workspace-level settings.
* Configure default project templates.

A workspace must have isolated data and permissions.
The architecture must support future multi-tenant deployment.
MODULE 3: PROJECT MANAGEMENT
This is a core module.
Implement a comprehensive project management capability.
3.1 Project Creation
A project must include the following fields:

* Project ID.
* Project name.
* Project key.
* Project description.
* Project type.
* Project category.
* Project sponsor.
* Project manager.
* Project owner.
* Business owner.
* Delivery team.
* Business unit.
* Department.
* Strategic objective.
* Project methodology.
* Project priority.
* Project status.
* Project health.
* Project start date.
* Planned end date.
* Actual start date.
* Actual end date.
* Approved budget.
* CAPEX budget.
* OPEX budget.
* Project currency.
* Project classification.
* Project complexity.
* Project dependencies.
* Project risks.
* Project tags.
* Project documentation.

Generate a unique project key automatically.
Example:
Project Name: Mobile Banking Transformation
Project Key: MBT
Issue Key: MBT-101
Project keys must be unique within the appropriate workspace.
3.2 Project Lifecycle
Support the following configurable lifecycle stages:

1. Idea.
2. Initial Assessment.
3. Business Case Development.
4. Business Case Approval.
5. Initiation.
6. Planning.
7. Execution.
8. Monitoring and Control.
9. Closure.
10. Closed.

The lifecycle must be configurable.
Administrators must be able to add, remove, rename, or reorder lifecycle stages.
Certain transitions must require approvals.
3.3 Project Details
Each project must have a dedicated overview page containing:

* Project summary.
* Project health.
* Project status.
* Overall progress.
* Planned versus actual dates.
* Budget versus actual costs.
* Upcoming milestones.
* Overdue milestones.
* Open risks.
* Open issues.
* Key dependencies.
* Resource allocation.
* Recent activity.
* Project team.
* Linked portfolio.
* Linked program.

3.4 Project Templates
Allow administrators to create reusable project templates.
A template may include:

* Project structure.
* Default issue types.
* Default workflows.
* Milestones.
* Tasks.
* Project roles.
* Required documents.
* Project governance stages.
* Reporting requirements.
* Default dashboards.

Users should be able to create a project from a template.
3.5 Project Archiving
Support project archiving.
Archived projects must become read-only by default.
Only authorized administrators may restore archived projects.
MODULE 4: ISSUE AND WORK ITEM MANAGEMENT
Implement a comprehensive issue management engine comparable to Jira.
This is one of the highest-priority modules.
4.1 Issue Types
Support the following issue types:

* Epic.
* Story.
* Task.
* Subtask.
* Bug.
* Feature.
* Requirement.
* Change Request.
* Risk.
* Issue.
* Milestone.
* Deliverable.

Allow administrators to create custom issue types.
4.2 Issue Hierarchy
Support hierarchical relationships.
Example:
Portfolio
└── Program
└── Project
└── Epic
└── Story
└── Subtask
The hierarchy must be configurable.
Users must be able to navigate between parent and child issues.
4.3 Issue Fields
Each issue must support:

* Issue ID.
* Issue key.
* Summary.
* Description.
* Issue type.
* Project.
* Parent issue.
* Assignee.
* Reporter.
* Priority.
* Status.
* Resolution.
* Created date.
* Updated date.
* Due date.
* Start date.
* Estimated effort.
* Remaining effort.
* Logged effort.
* Story points.
* Sprint.
* Fix version.
* Affected version.
* Labels.
* Components.
* Watchers.
* Attachments.
* Comments.
* Linked issues.
* Custom fields.

4.4 Issue Key Generation
Generate unique issue keys using the project key and sequential number.
Example:
MBT-1001
Issue keys must be immutable.
Issue numbers must not be reused after deletion.
Use soft deletion or an equivalent strategy to preserve historical references.
4.5 Issue Operations
Users must be able to:

* Create issues.
* Edit issues.
* Clone issues.
* Move issues between projects.
* Assign issues.
* Reassign issues.
* Delete issues subject to permissions.
* Restore deleted issues when permitted.
* Watch and unwatch issues.
* Add labels.
* Add comments.
* Upload attachments.
* Link related issues.
* Create subtasks.
* Convert issue types when permitted.
* Change issue priorities.
* Update due dates.
* Log work.
* View issue history.

4.6 Issue Relationships
Support:

* Blocks.
* Is blocked by.
* Relates to.
* Duplicates.
* Is duplicated by.
* Parent of.
* Child of.
* Depends on.
* Is required by.

Support dependency visualization.
Prevent invalid circular dependency relationships where applicable.
4.7 Issue Activity History
Every important change must be recorded.
Examples:

* Status changed.
* Assignee changed.
* Priority changed.
* Description updated.
* Due date changed.
* Estimate updated.
* Comment added.
* Attachment added.
* Parent changed.

The history must include:

* User.
* Timestamp.
* Field changed.
* Previous value.
* New value.

Users must be able to view the issue activity timeline.
MODULE 5: WORKFLOW ENGINE
Implement a configurable workflow engine.
Do not hardcode all workflows into application logic.
Administrators must be able to create and manage workflows.
5.1 Workflow Components
A workflow consists of:

* Statuses.
* Transitions.
* Transition permissions.
* Transition conditions.
* Validators.
* Post-functions.
* Approval requirements.

5.2 Default Workflow
Implement a default workflow:
Open
→ To Do
→ In Progress
→ In Review
→ Testing
→ Done
Also support:

* Blocked.
* On Hold.
* Reopened.
* Cancelled.

5.3 Workflow Rules
Support:

* Required fields during transitions.
* Role-based transition permissions.
* Assignee restrictions.
* Approval requirements.
* Conditional transitions.
* Automatic assignment.
* Automatic notifications.
* Automatic field updates.

Example:
An issue cannot transition to Done unless:

* All mandatory fields are completed.
* The issue has no unresolved mandatory blockers.
* The required reviewer has approved the work.

5.4 Workflow Administration
Allow administrators to:

* Create workflows.
* Edit workflows.
* Duplicate workflows.
* Assign workflows to projects.
* Assign workflows to issue types.
* Configure workflow schemes.
* Publish workflow changes.

Implement workflow versioning.
Changes to a workflow must not silently invalidate existing issues.
MODULE 6: AGILE SCRUM MANAGEMENT
Implement a complete Scrum module.
6.1 Scrum Boards
Users must be able to:

* Create Scrum boards.
* Configure board filters.
* Configure columns.
* Map statuses to columns.
* Configure swimlanes.
* Configure quick filters.
* View assigned work.
* View unassigned work.

6.2 Product Backlog
Support:

* Backlog creation.
* Issue prioritization.
* Drag-and-drop ordering.
* Epic grouping.
* Story point estimation.
* Backlog filtering.
* Bulk issue updates.
* Backlog search.

6.3 Sprint Management
Support:

* Sprint creation.
* Sprint naming.
* Sprint goals.
* Sprint start dates.
* Sprint end dates.
* Sprint planning.
* Sprint completion.
* Sprint cancellation.
* Sprint scope changes.
* Sprint history.

6.4 Sprint Planning
Users must be able to:

* Select backlog items.
* Add items to a sprint.
* Remove items from a sprint.
* Estimate sprint capacity.
* Assign work.
* Set sprint goals.
* Review committed story points.

6.5 Sprint Execution
Support:

* Active sprint boards.
* Drag-and-drop issue movement.
* Sprint progress tracking.
* Sprint burndown.
* Sprint completion percentage.
* Blocked work identification.
* Scope change tracking.

6.6 Agile Reports
Implement:

* Sprint Burndown Chart.
* Sprint Burnup Chart.
* Velocity Chart.
* Cumulative Flow Diagram.
* Control Chart.
* Epic Burndown.
* Release Burndown.
* Sprint Report.

Charts must be generated from actual application data.
Do not use fabricated or hardcoded chart values.
MODULE 7: KANBAN MANAGEMENT
Implement a flexible Kanban system.
Requirements:

* Create Kanban boards.
* Configure board columns.
* Configure WIP limits.
* Drag and drop issues.
* Configure swimlanes.
* Configure quick filters.
* Configure card layouts.
* Configure board filters.
* Highlight blocked work.
* Highlight overdue work.
* Track cycle time.
* Track lead time.
* Track throughput.
* Generate cumulative flow diagrams.

The system must prevent unauthorized users from bypassing workflow restrictions through drag-and-drop operations.
MODULE 8: PROJECT PLANNING AND SCHEDULING
Implement a project planning module.
8.1 Work Breakdown Structure
Support hierarchical work breakdown structures.
Users must be able to:

* Create work packages.
* Create activities.
* Define task dependencies.
* Assign resources.
* Define effort estimates.
* Define start and finish dates.
* Track progress.

8.2 Project Schedule
Provide:

* Gantt chart.
* Timeline view.
* Milestone view.
* Dependency view.
* Critical path visualization where feasible.
* Planned versus actual dates.
* Baseline schedule comparison.

8.3 Dependencies
Support:

* Finish-to-Start.
* Start-to-Start.
* Finish-to-Finish.
* Start-to-Finish.

Allow users to configure dependency lag and lead times.
8.4 Schedule Management
Support:

* Baseline creation.
* Baseline comparison.
* Schedule variance.
* Overdue task identification.
* Milestone slippage.
* Dependency impact analysis.

MODULE 9: PROJECT PORTFOLIO MANAGEMENT
Implement an enterprise portfolio management module.
9.1 Portfolio Structure
Support:
Portfolio
└── Program
└── Project
Projects may belong to multiple strategic initiatives where authorized.
The system must maintain clear ownership and reporting relationships.
9.2 Portfolio Dashboard
Display:

* Total projects.
* Active projects.
* Projects completed.
* Projects on track.
* Projects at risk.
* Projects delayed.
* Projects on hold.
* Total approved investment.
* Total actual expenditure.
* Total forecast expenditure.
* CAPEX versus OPEX.
* Portfolio resource demand.
* Resource capacity.
* Strategic alignment.
* Portfolio risk exposure.

9.3 Project Prioritization
Support configurable prioritization criteria.
Examples:

* Strategic alignment.
* Business value.
* Regulatory importance.
* Customer impact.
* Financial return.
* Risk reduction.
* Resource availability.
* Delivery complexity.
* Time criticality.

Allow administrators to configure weighted scoring models.
Example:
Strategic Alignment: 25%
Business Value: 25%
Regulatory Importance: 20%
Financial Return: 15%
Delivery Feasibility: 15%
Calculate project priority scores automatically.
Allow authorized users to override calculated rankings with a mandatory justification.
9.4 Portfolio Roadmap
Provide a portfolio roadmap showing:

* Strategic initiatives.
* Programs.
* Projects.
* Key milestones.
* Project start and end dates.
* Dependencies.
* Delivery timelines.

Users must be able to filter by:

* Business unit.
* Project manager.
* Portfolio.
* Program.
* Project status.
* Strategic objective.
* Project type.

9.5 Portfolio Scenario Planning
Support future scenario planning.
Users should be able to:

* Create portfolio scenarios.
* Add or remove proposed projects.
* Adjust project priorities.
* Change resource assumptions.
* Change investment assumptions.
* Compare scenarios.

Scenario changes must not modify approved live project data unless explicitly committed by an authorized user.
MODULE 10: PROJECT GOVERNANCE AND STAGE-GATE MANAGEMENT
This module is particularly important.
Implement a configurable governance framework suitable for an Enterprise PMO.
10.1 Project Governance Stages
Support configurable governance stages, including:

1. Idea Assessment.
2. Business Case Approval.
3. Project Initiation.
4. Planning Approval.
5. Execution Authorization.
6. Mid-Project Review.
7. Closure Approval.
8. Benefits Realization Review.

10.2 Governance Checklists
Each stage must have configurable requirements.
Examples:

* Approved business case.
* Approved project charter.
* Approved budget.
* Defined scope.
* Defined project team.
* Approved project plan.
* Defined milestones.
* Risk assessment.
* Compliance assessment.
* Security assessment.
* Architecture approval.
* Procurement approval.

10.3 Approval Workflow
Support:

* Single approver.
* Multiple approvers.
* Sequential approvals.
* Parallel approvals.
* Conditional approvals.
* Rejection.
* Resubmission.
* Delegation.
* Approval history.

Every approval must capture:

* Approver.
* Decision.
* Date and time.
* Comments.
* Supporting documents.

10.4 Governance Compliance
The system must identify:

* Missing mandatory documents.
* Overdue approvals.
* Projects bypassing mandatory governance stages.
* Projects operating without approved budgets.
* Projects with expired approvals.
* Projects with overdue governance actions.

Provide an enterprise governance compliance dashboard.
MODULE 11: PROJECT FINANCIAL MANAGEMENT
Implement comprehensive project financial tracking.
Financial data must be stored using appropriate decimal precision.
Do not use floating-point arithmetic for financial calculations.
11.1 Project Budget
Support:

* Initial proposed budget.
* Approved budget.
* Revised approved budget.
* Actual expenditure.
* Committed expenditure.
* Forecast expenditure.
* Estimate at Completion.
* Budget variance.
* Forecast variance.

11.2 CAPEX and OPEX
Track separately:

* Approved CAPEX.
* Actual CAPEX.
* Forecast CAPEX.
* Approved OPEX.
* Actual OPEX.
* Forecast OPEX.

Support financial categorization by:

* Project.
* Department.
* Cost center.
* Vendor.
* Resource.
* Financial year.
* Cost category.

11.3 Resource Cost Tracking
Support:

* Resource hourly rate.
* Resource daily rate.
* Planned effort.
* Actual effort.
* Forecast effort.
* Calculated labor cost.

Example:
A developer works 80 hours on a project.
Hourly cost: 500 EGP.
Calculated labor cost: 40,000 EGP.
The application must calculate labor costs automatically.
Support different currencies and configurable exchange rates.
11.4 Financial Calculations
Implement:
Budget Variance = Approved Budget - Actual Expenditure
Forecast Variance = Approved Budget - Forecast Expenditure
Estimate at Completion = Actual Expenditure + Remaining Forecast Cost
Cost Performance Index = Earned Value / Actual Cost
Schedule Performance Index = Earned Value / Planned Value
Earned Value calculations must be configurable according to the selected project management methodology.
11.5 Financial Reporting
Provide:

* Project budget dashboard.
* Portfolio financial dashboard.
* CAPEX versus OPEX dashboard.
* Budget versus actual report.
* Forecast versus approved budget report.
* Project cost breakdown.
* Financial year comparison.
* Cost center reporting.

MODULE 12: RESOURCE AND CAPACITY MANAGEMENT
Implement a resource management module.
12.1 Resource Profiles
Each resource must include:

* Resource ID.
* Name.
* Department.
* Job title.
* Skills.
* Grade.
* Standard hourly cost.
* Standard daily cost.
* Employment type.
* Available working hours.
* Working calendar.
* Manager.

12.2 Resource Allocation
Support:

* Assigning resources to projects.
* Assigning resources to tasks.
* Allocation percentage.
* Planned start and end dates.
* Planned effort.
* Actual effort.
* Forecast effort.

12.3 Capacity Planning
Calculate resource capacity based on:

* Working days.
* Working hours.
* Holidays.
* Leave.
* Existing assignments.
* Allocation percentage.

Example:
A resource has 160 available hours in a month.
The resource is allocated 50% to Project A.
The resource is allocated 30% to Project B.
Remaining capacity: 20%.
12.4 Resource Dashboards
Provide:

* Resource utilization.
* Resource availability.
* Overallocated resources.
* Underutilized resources.
* Department capacity.
* Project resource demand.
* Resource allocation timeline.

MODULE 13: RISK, ISSUE, ASSUMPTION, AND DEPENDENCY MANAGEMENT
Implement an integrated RAID management module.
13.1 Risk Management
Each risk must support:

* Risk ID.
* Risk title.
* Risk description.
* Risk category.
* Risk owner.
* Probability.
* Impact.
* Risk score.
* Risk response.
* Mitigation plan.
* Target date.
* Status.

Calculate risk score automatically.
Support configurable risk matrices.
13.2 Issue Management
Support:

* Issue identification.
* Issue severity.
* Issue owner.
* Resolution plan.
* Target resolution date.
* Escalation status.

13.3 Assumptions
Support:

* Assumption description.
* Assumption owner.
* Validation date.
* Validation status.
* Impact if invalid.

13.4 Dependencies
Support:

* Internal dependencies.
* External dependencies.
* Cross-project dependencies.
* Dependency owner.
* Dependency due date.
* Dependency status.
* Dependency impact.

13.5 RAID Dashboard
Provide:

* Open risks.
* High risks.
* Overdue risks.
* Open issues.
* Critical issues.
* Overdue actions.
* Unresolved dependencies.

MODULE 14: PROJECT CHANGE MANAGEMENT
Implement a formal change management module.
Users must be able to create change requests.
Each change request must include:

* Change ID.
* Change title.
* Change description.
* Requester.
* Request date.
* Change category.
* Business justification.
* Scope impact.
* Schedule impact.
* Financial impact.
* Resource impact.
* Risk impact.
* Required approvals.
* Decision.
* Decision date.

Support:

* Change request submission.
* Change assessment.
* Change approval.
* Change rejection.
* Change implementation.
* Change closure.

Approved changes must update the appropriate project baselines only after authorization.
Maintain a full audit trail.
MODULE 15: DOCUMENT AND REQUIREMENT MANAGEMENT
Implement a document management capability.
Support:

* Document upload.
* Document download.
* Document metadata.
* Document categorization.
* Document versioning.
* Document access control.
* Document approval.
* Document linking to projects.
* Document linking to issues.
* Document linking to governance stages.

Support document categories such as:

* Business Case.
* Project Charter.
* Project Plan.
* Requirements.
* Architecture Documents.
* Test Plans.
* Risk Assessments.
* Approval Documents.
* Closure Reports.

Implement a requirement traceability matrix.
Requirements must be linkable to:

* Business objectives.
* Projects.
* Epics.
* Stories.
* Test cases.
* Deliverables.

MODULE 16: REPORTING AND EXECUTIVE DASHBOARDS
Build a comprehensive reporting engine.
All reports must be based on actual persisted application data.
Do not use static mock data in production dashboards.
16.1 Executive Dashboard
Display:

* Total active projects.
* Total completed projects.
* Projects on track.
* Projects at risk.
* Projects delayed.
* Portfolio investment.
* CAPEX and OPEX.
* Budget variance.
* Resource utilization.
* Major risks.
* Strategic initiative progress.

16.2 PMO Dashboard
Display:

* Projects by status.
* Projects by business unit.
* Projects by project manager.
* Projects by methodology.
* Governance compliance.
* Overdue milestones.
* Overdue actions.
* Projects without updated status reports.
* Budget overruns.
* Resource conflicts.
* High-risk projects.

16.3 Project Manager Dashboard
Display:

* My projects.
* My tasks.
* Upcoming milestones.
* Overdue tasks.
* Project progress.
* Project risks.
* Project financials.
* Resource allocation.

16.4 Reporting Features
Support:

* Date filters.
* Project filters.
* Portfolio filters.
* Business unit filters.
* Department filters.
* Project manager filters.
* Status filters.
* Saved reports.
* Export to CSV.
* Export to Excel.
* PDF export where appropriate.

Support scheduled reporting as a future extension.
MODULE 17: SEARCH AND QUERY ENGINE
Implement a comprehensive search capability.
Users must be able to search:

* Projects.
* Issues.
* Users.
* Portfolios.
* Programs.
* Milestones.
* Risks.
* Documents.

Provide advanced filters.
Implement a Jira-inspired query language.
Example:
project = "MBT" AND status = "In Progress"
assignee = currentUser() AND status != Done
project = "MBT" AND priority = High
status = "Blocked" AND assignee = currentUser()
dueDate < today() AND status != Done
Support:

* AND.
* OR.
* NOT.
* Parentheses.
* Comparison operators.
* Sorting.
* Field-based filtering.

Implement saved filters.
Users must be able to share filters according to permissions.
Do not attempt to implement the entire Jira Query Language in the first iteration.
Implement a well-defined and extensible subset.
MODULE 18: NOTIFICATIONS AND COMMUNICATION
Implement an in-app notification system.
Notify users when:

* They are assigned an issue.
* An issue is assigned to them.
* An issue is mentioned to them.
* An approval requires their action.
* An approval is completed.
* A project milestone is approaching.
* A task becomes overdue.
* A project is at risk.
* A project status report is overdue.
* A comment mentions them.
* A dependency becomes blocked.

Support:

* Notification center.
* Read and unread notifications.
* Notification preferences.
* Email notification architecture.
* Configurable notification rules.

Avoid sending duplicate notifications.
MODULE 19: AUDIT AND COMPLIANCE
Implement a comprehensive audit logging system.
Record important activities, including:

* User authentication events.
* User creation.
* Permission changes.
* Project creation.
* Project updates.
* Issue creation.
* Issue updates.
* Workflow transitions.
* Financial changes.
* Approval decisions.
* Document uploads.
* Administrative changes.

Audit records must include:

* Event ID.
* User ID.
* Timestamp.
* Event type.
* Entity type.
* Entity ID.
* Previous value.
* New value.
* Source information where appropriate.

Audit records must not be editable through ordinary application interfaces.
Implement appropriate retention and access controls.
MODULE 20: CUSTOMIZATION AND ADMINISTRATION
Build a centralized administration console.
Administrators must be able to configure:

* Workspaces.
* Users.
* Roles.
* Permissions.
* Project templates.
* Issue types.
* Statuses.
* Workflows.
* Custom fields.
* Priorities.
* Project categories.
* Portfolio structures.
* Governance stages.
* Approval rules.
* Notification rules.
* Financial settings.
* Working calendars.
* Reporting configurations.

Custom fields must support appropriate field types, including:

* Text.
* Number.
* Date.
* Date and time.
* Dropdown.
* Multi-select.
* Checkbox.
* User picker.
* URL.
* Currency.
* Percentage.

Custom fields must support configuration at the appropriate workspace, project, or issue-type level.
6. USER EXPERIENCE AND INTERFACE REQUIREMENTS
The application must have a polished, professional, modern enterprise SaaS interface.
It should feel like a mature enterprise product, not a generic admin dashboard.
6.1 General Design Principles

* Clean and professional.
* Modern enterprise SaaS appearance.
* High information density without visual clutter.
* Clear visual hierarchy.
* Consistent spacing.
* Consistent typography.
* Responsive layouts.
* Accessible colors.
* Clear navigation.
* Fast interaction patterns.

Use Jira as a reference for interaction patterns and project management functionality.
Do not copy Jira's branding, logo, proprietary assets, or exact visual identity.
Create an original product identity.
6.2 Main Application Layout
Implement a persistent application shell with:
Left Sidebar

* Home.
* My Work.
* Projects.
* Portfolios.
* Programs.
* Boards.
* Backlogs.
* Sprints.
* Roadmaps.
* Reports.
* Dashboards.
* Resource Management.
* Financial Management.
* Governance.
* Administration.

Allow users to collapse the sidebar.
Support contextual navigation based on the selected project.
Top Navigation Bar
Include:

* Global search.
* Create button.
* Notifications.
* Help.
* User profile.
* Workspace selector.

Main Content Area
Support:

* Breadcrumb navigation.
* Page titles.
* Contextual actions.
* Filters.
* Tabs.
* Tables.
* Charts.
* Forms.
* Modals.
* Side panels.

6.3 Issue Detail Experience
Issue detail pages must provide:

* Summary.
* Description.
* Status.
* Priority.
* Assignee.
* Reporter.
* Due date.
* Parent issue.
* Subtasks.
* Linked issues.
* Comments.
* Attachments.
* Activity history.
* Work log.
* Custom fields.

Use a side-panel or full-page experience where appropriate.
6.4 User Experience Expectations
Support:

* Drag and drop.
* Inline editing.
* Keyboard navigation.
* Keyboard shortcuts where appropriate.
* Searchable dropdowns.
* Multi-select filters.
* Bulk actions.
* Loading indicators.
* Empty states.
* Error states.
* Confirmation dialogs.
* Toast notifications.
* Form validation.
* Unsaved-change warnings.

Do not use browser alerts for routine interactions.
Do not use native browser prompts as a substitute for application forms.
7. TECHNICAL ARCHITECTURE
Before implementation, inspect the repository and choose the architecture that best fits the existing environment.
If there is no existing application, use the following reference architecture.
7.1 Frontend
Preferred stack:

* React.
* TypeScript.
* Next.js.
* Tailwind CSS.
* A professional component library such as shadcn/ui.
* React Hook Form.
* Zod.
* TanStack Query.
* TanStack Table.
* A suitable charting library.

Use a consistent design system.
Separate:

* UI components.
* Pages.
* Business logic.
* API clients.
* Validation.
* State management.
* Shared utilities.

7.2 Backend
Preferred stack:

* TypeScript.
* Node.js.
* NestJS or a well-structured Next.js backend architecture.
* REST API.
* OpenAPI documentation.

Choose the backend architecture based on the complexity and deployment requirements of the existing project.
Use a modular architecture.
Suggested backend modules:

* Authentication.
* Users.
* Workspaces.
* Projects.
* Issues.
* Workflows.
* Boards.
* Sprints.
* Portfolios.
* Governance.
* Financials.
* Resources.
* Risks.
* Documents.
* Notifications.
* Reporting.
* Administration.

7.3 Database
Preferred database:
PostgreSQL.
Use a robust ORM such as Prisma if appropriate for the chosen architecture.
Requirements:

* Proper relational data modeling.
* Foreign key constraints.
* Appropriate indexes.
* Database migrations.
* Transaction management.
* Soft deletion where required.
* Audit history.
* Data isolation.
* Referential integrity.

Avoid storing the entire application in browser local storage.
The database must be the authoritative source of truth.
7.4 File Storage
Implement a storage abstraction.
Support local development storage and a production-ready object storage integration.
Store file metadata in the database.
Store file contents in the appropriate storage layer.
Do not store uploaded binary files directly in database records unless there is a specific architectural reason.
7.5 API Design
Implement consistent REST endpoints.
Examples:
GET /api/projects
POST /api/projects
GET /api/projects/:projectId
PATCH /api/projects/:projectId
DELETE /api/projects/:projectId
GET /api/projects/:projectId/issues
POST /api/projects/:projectId/issues
GET /api/issues/:issueId
PATCH /api/issues/:issueId
POST /api/issues/:issueId/transitions
GET /api/portfolios
POST /api/portfolios
GET /api/dashboards/portfolio
Use:

* Consistent response structures.
* Proper HTTP status codes.
* Request validation.
* Pagination.
* Filtering.
* Sorting.
* Authentication.
* Authorization.
* Error handling.
* Rate limiting where appropriate.

Generate API documentation.
8. DATA MODEL REQUIREMENTS
Design a normalized and extensible relational database schema.
The schema must support the complete application lifecycle.
At a minimum, consider the following entities:

* Workspace.
* User.
* UserProfile.
* Role.
* Permission.
* UserRole.
* Group.
* GroupMembership.
* Department.
* Project.
* ProjectMembership.
* ProjectTemplate.
* Portfolio.
* PortfolioMembership.
* Program.
* StrategicObjective.
* Issue.
* IssueType.
* IssueLink.
* IssueComment.
* IssueAttachment.
* IssueWorkLog.
* IssueWatcher.
* IssueHistory.
* Workflow.
* WorkflowStatus.
* WorkflowTransition.
* WorkflowScheme.
* Board.
* BoardColumn.
* Sprint.
* SprintIssue.
* ProjectMilestone.
* ProjectBaseline.
* ProjectDependency.
* ProjectRisk.
* ProjectIssue.
* ProjectAssumption.
* ProjectChangeRequest.
* ProjectApproval.
* GovernanceStage.
* GovernanceChecklist.
* ProjectFinancial.
* FinancialTransaction.
* FinancialForecast.
* Resource.
* ResourceAllocation.
* ResourceCalendar.
* CustomField.
* CustomFieldValue.
* Document.
* DocumentVersion.
* Notification.
* SavedFilter.
* Dashboard.
* AuditLog.

Add additional entities where required.
8.1 Data Modeling Rules

1. Use UUIDs or another appropriate immutable internal identifier.
2. Use human-readable project and issue keys where required.
3. Enforce referential integrity.
4. Define appropriate unique constraints.
5. Add indexes for common query patterns.
6. Use database transactions for multi-step business operations.
7. Maintain audit history.
8. Use appropriate decimal types for financial values.
9. Store timestamps consistently.
10. Support workspace-level data isolation.

Do not create one enormous generic table containing every type of application data.
Use a relational design that is understandable and maintainable.
9. SECURITY REQUIREMENTS
The application must follow enterprise security principles.
Implement:

* Secure authentication.
* Role-based access control.
* Object-level authorization.
* Workspace isolation.
* Input validation.
* SQL injection prevention.
* XSS prevention.
* CSRF protection where applicable.
* Secure file upload validation.
* Secure password hashing.
* Secure session management.
* Rate limiting.
* Appropriate security headers.
* Sensitive data protection.
* Audit logging.

Ensure that users cannot access unauthorized data by changing an ID in the URL or API request.
Example:
A user belonging to Workspace A must not be able to retrieve data from Workspace B by modifying a project ID.
Validate permissions on every protected backend operation.
Never expose secrets in frontend code.
Never commit credentials to the repository.
Use environment variables for configuration.
Create a comprehensive `.env.example` file.
10. NON-FUNCTIONAL REQUIREMENTS
10.1 Performance
Target performance:

* Common page loads should feel responsive.
* Common API operations should generally complete within 500 ms under normal development conditions.
* Complex reporting operations should use optimized queries and appropriate loading states.
* Large tables must support pagination or virtualization.
* Avoid loading an entire enterprise portfolio into the browser.

10.2 Scalability
The architecture must support future growth in:

* Users.
* Workspaces.
* Projects.
* Issues.
* Attachments.
* Audit records.
* Reports.

10.3 Reliability
Implement:

* Proper error handling.
* Database transaction management.
* Reliable persistence.
* Graceful failure states.
* Logging.
* Health checks.

10.4 Maintainability
Requirements:

* Modular code.
* Clear naming conventions.
* Reusable components.
* Type safety.
* Separation of concerns.
* Database migrations.
* Automated tests.
* Developer documentation.

10.5 Accessibility
Target WCAG 2.1 AA where practical.
Support:

* Keyboard navigation.
* Accessible labels.
* Appropriate contrast.
* Screen reader semantics.
* Focus management.
* Accessible form validation.

10.6 Internationalization
Support:

* Configurable date formats.
* Configurable timezones.
* Multiple currencies.
* Unicode.
* Arabic and English.
* Right-to-left layouts for Arabic.

Do not hardcode currency symbols, date formats, or timezone assumptions throughout the application.
11. INTEGRATION REQUIREMENTS
Design the platform to support future integrations with:

* Microsoft Teams.
* Microsoft Outlook.
* Microsoft Entra ID.
* Google Workspace.
* GitHub.
* GitLab.
* Bitbucket.
* Slack.
* Jira import.
* Microsoft Excel.
* Power BI.
* Enterprise ERP systems.
* HR systems.
* Financial systems.

Prioritize the following initial integrations:

1. CSV and Excel import/export.
2. Email notifications.
3. GitHub integration architecture.
4. SSO integration architecture.

For integrations not implemented in the initial release, provide clean interfaces and document the integration approach.
Do not create fake integrations that appear functional but do not communicate with an actual external system.
12. IMPLEMENTATION STRATEGY
Build the application incrementally.
Do not attempt to implement every advanced feature simultaneously.
The implementation must proceed through controlled development phases.
However, the final architecture must accommodate all requirements described in this document.
PHASE 0: REPOSITORY ASSESSMENT AND ARCHITECTURE
Tasks:

1. Inspect the existing repository.
2. Identify the technology stack.
3. Review dependencies.
4. Review existing application functionality.
5. Identify missing infrastructure.
6. Design the architecture.
7. Define the database schema.
8. Define the authentication approach.
9. Define the API conventions.
10. Create the implementation roadmap.

Deliverables:

* Architecture document.
* Database design.
* Module breakdown.
* Implementation plan.
* Development environment configuration.

PHASE 1: FOUNDATION AND AUTHENTICATION
Implement:

* Application shell.
* Navigation.
* Database setup.
* Authentication.
* User management.
* Workspace management.
* Role-based access control.
* Initial administration console.
* Audit logging foundation.

Acceptance criteria:

* Users can log in and log out.
* Users can be created and assigned roles.
* Workspace access is enforced.
* Unauthorized access is blocked.
* Database migrations work.
* Application runs locally.

PHASE 2: CORE PROJECT AND ISSUE MANAGEMENT
Implement:

* Project creation.
* Project details.
* Project templates.
* Issue types.
* Issue creation.
* Issue editing.
* Issue assignment.
* Issue relationships.
* Issue comments.
* Issue history.
* Workflow engine.
* Project members.

Acceptance criteria:

* Users can create a project.
* Users can create issues within the project.
* Issues receive unique keys.
* Issues can be assigned.
* Issues can move through configured workflows.
* Issue history is persisted.
* Permissions are enforced.

PHASE 3: AGILE DELIVERY
Implement:

* Scrum boards.
* Product backlog.
* Sprint planning.
* Active sprint board.
* Kanban boards.
* Story points.
* Work logging.
* Agile reporting.

Acceptance criteria:

* Users can create a sprint.
* Users can add issues to a sprint.
* Users can start and complete a sprint.
* Users can update issues through boards.
* Agile metrics are calculated from actual data.

PHASE 4: PROJECT GOVERNANCE AND PORTFOLIO MANAGEMENT
Implement:

* Portfolio management.
* Program management.
* Strategic objectives.
* Governance stages.
* Approval workflows.
* Governance checklists.
* Portfolio dashboard.
* Portfolio roadmap.
* Project status reporting.

Acceptance criteria:

* Projects can be linked to portfolios.
* Projects can progress through governance stages.
* Approvals are recorded.
* Portfolio dashboards aggregate actual project data.
* Governance exceptions are visible.

PHASE 5: FINANCIAL AND RESOURCE MANAGEMENT
Implement:

* Project budgets.
* CAPEX and OPEX.
* Actual expenditure.
* Financial forecasts.
* Resource profiles.
* Resource allocation.
* Resource capacity.
* Resource utilization.
* Financial dashboards.

Acceptance criteria:

* Users can create project budgets.
* Financial values are persisted.
* Budget variances are calculated correctly.
* Resource allocations affect capacity calculations.
* Financial and resource dashboards reflect actual records.

PHASE 6: REPORTING, SEARCH, AND ADVANCED FEATURES
Implement:

* Global search.
* Advanced issue filters.
* Saved filters.
* Executive dashboards.
* PMO dashboards.
* Project reporting.
* Excel and CSV export.
* Notifications.
* Advanced risk management.
* Change management.
* Document management.

Acceptance criteria:

* Users can find authorized projects and issues.
* Filters return accurate results.
* Reports reflect database values.
* Exported data matches the application.
* Notifications are delivered according to configured rules.

PHASE 7: HARDENING AND PRODUCTION READINESS
Implement:

* Automated testing.
* Security testing.
* Performance optimization.
* Error handling improvements.
* Database indexing.
* Deployment documentation.
* Backup and recovery guidance.
* Monitoring.
* Health checks.
* Final UX improvements.

Acceptance criteria:

* Critical workflows pass automated tests.
* Authorization tests pass.
* Database migrations work from a clean database.
* Application can be deployed using documented instructions.
* No critical functionality depends on mock data.

13. TESTING REQUIREMENTS
Implement a comprehensive automated testing strategy.
13.1 Unit Testing
Test:

* Business rules.
* Financial calculations.
* Workflow transitions.
* Permission checks.
* Issue key generation.
* Risk scoring.
* Resource capacity calculations.
* Portfolio prioritization.
* Sprint calculations.

13.2 Integration Testing
Test:

* Authentication.
* Project creation.
* Issue creation.
* Workflow transitions.
* Financial persistence.
* Resource allocation.
* Approval workflows.
* Reporting endpoints.

13.3 End-to-End Testing
Test complete user journeys.
Example:
A PMO administrator creates a workspace.
A project manager creates a project.
The project manager creates a project plan.
The project manager creates issues.
A team member completes assigned work.
The project manager updates project status.
The PMO reviews project health.
The executive views the portfolio dashboard.
Verify that the data is consistent across all relevant screens.
13.4 Security Testing
Test:

* Unauthorized project access.
* Unauthorized issue access.
* Cross-workspace data access.
* Unauthorized financial data access.
* Unauthorized approval actions.
* Invalid workflow transitions.
* Malicious file uploads.
* Invalid API requests.

14. DEVELOPMENT STANDARDS
Follow these standards throughout development.
15. Use TypeScript wherever applicable.
16. Prefer strongly typed interfaces.
17. Avoid unnecessary use of `any`.
18. Use reusable components.
19. Avoid duplicated business logic.
20. Keep business logic outside presentation components.
21. Validate data on the backend.
22. Use database transactions where necessary.
23. Implement proper loading and error states.
24. Write meaningful automated tests.
25. Maintain consistent naming conventions.
26. Keep the codebase modular.
27. Document complex business logic.
28. Avoid premature microservice architecture.
29. Avoid unnecessary dependencies.
30. Do not use hardcoded mock data in production functionality.
31. Do not leave critical features as placeholders.
32. Do not silently swallow errors.
33. Do not create non-functional buttons.
34. Do not bypass authentication for convenience.

Use seed data only for development, testing, and demonstration.
All production functionality must operate on persisted application data.
15. REQUIRED DELIVERABLES
The completed project must include:

1. Fully functional application.
2. Complete source code.
3. Database schema.
4. Database migrations.
5. Seed data for development.
6. Authentication and authorization.
7. API documentation.
8. Unit tests.
9. Integration tests.
10. End-to-end tests for critical workflows.
11. `.env.example`.
12. README.
13. Installation instructions.
14. Local development instructions.
15. Deployment instructions.
16. Database setup instructions.
17. Architecture documentation.
18. Known limitations.
19. Future enhancement roadmap.

The README must explain:

* What the application does.
* Technology stack.
* Architecture.
* Prerequisites.
* Installation.
* Environment configuration.
* Database setup.
* Migration commands.
* Seed commands.
* Development commands.
* Test commands.
* Production build commands.
* Deployment approach.

16. DEMONSTRATION SCENARIO
Create a realistic demonstration environment.
Use the following example organization:
Organization: Enterprise Banking Group
Workspace: Enterprise PMO
Portfolio: Digital Transformation Portfolio
Program: Digital Banking Transformation
Project: Mobile Banking Modernization
Project Key: MBM
Project Manager: Sarah Ahmed
Project Sponsor: Chief Digital Officer
Business Owner: Head of Digital Banking
Project Budget: EGP 25,000,000
Project Methodology: Hybrid
Project Start Date: January 1, 2027
Project End Date: December 31, 2027
Create realistic sample data covering:

* Three portfolios.
* Five programs.
* Ten projects.
* Multiple project managers.
* Multiple business units.
* Multiple Agile teams.
* Several epics.
* Stories and tasks.
* Sprints.
* Milestones.
* Risks.
* Dependencies.
* Financial transactions.
* Resource allocations.
* Governance approvals.

Use this data to demonstrate how the application works.
The demonstration data must be created through database seed scripts.
Do not hardcode the demonstration data directly into dashboard components.
The application must remain fully functional when the demonstration data is removed.
17. PRIORITIZATION RULES
The following priorities are mandatory.
P0 — Critical Foundation

* Authentication.
* Authorization.
* Workspace management.
* Database architecture.
* Project management.
* Issue management.
* Workflow engine.
* Core UI.
* Data persistence.
* Audit logging.

P1 — Essential Product Functionality

* Scrum.
* Kanban.
* Project planning.
* Portfolio management.
* Governance.
* Approvals.
* Dashboards.
* Notifications.

P2 — Enterprise PMO Capabilities

* Financial management.
* Resource management.
* Advanced reporting.
* Risk management.
* Change management.
* Document management.
* Advanced search.

P3 — Advanced Capabilities

* Portfolio scenario planning.
* Advanced analytics.
* External integrations.
* Advanced workflow automation.
* Advanced financial forecasting.
* AI-assisted project management.

Do not implement P3 features at the expense of completing P0 functionality.
18. AI-ASSISTED PROJECT MANAGEMENT — FUTURE EXTENSION
Design the architecture so that AI capabilities can be added in the future.
Potential capabilities:

* Automated project status summaries.
* Risk identification.
* Schedule slippage prediction.
* Financial variance analysis.
* Resource allocation recommendations.
* Portfolio prioritization recommendations.
* Meeting minutes to action items.
* Project documentation summarization.
* Natural language project search.

Do not build an AI feature that invents project information.
Any AI-generated insight must be based on actual application data and must be clearly identified as AI-generated.
AI functionality is not a substitute for the core project management modules.
19. CLAUDE CODE EXECUTION INSTRUCTIONS
Follow these instructions throughout the development process.
19.1 Work Directly in the Repository
Use the current repository as the source of truth.
Create and modify actual project files.
Do not merely provide code snippets in the conversation.
19.2 Work Incrementally
Implement one coherent module at a time.
After each module:

1. Review the implementation.
2. Run relevant tests.
3. Fix errors.
4. Verify the module works.
5. Update the implementation checklist.
6. Continue to the next module.

19.3 Maintain a Development Backlog
Create a development backlog containing:

* Feature ID.
* Feature name.
* Description.
* Priority.
* Dependencies.
* Implementation status.
* Testing status.

Track completed, in-progress, blocked, and pending work.
19.4 Maintain Documentation
Create and maintain:

* `docs/BRD.md`
* `docs/FRS.md`
* `docs/ARCHITECTURE.md`
* `docs/DATABASE.md`
* `docs/API.md`
* `docs/IMPLEMENTATION_PLAN.md`
* `docs/TESTING.md`

19.5 Do Not Stop After Planning
After reviewing the repository and defining the architecture, proceed with implementation.
Do not stop after creating the documentation.
Do not stop after creating the UI.
Do not stop after creating the database schema.
Do not stop after implementing authentication.
Continue through the implementation phases in priority order.
If the entire scope cannot be completed in one development session, leave the repository in a working state and provide a precise continuation plan.
19.6 Be Transparent About Limitations
If a feature cannot be completed:

* Explain why.
* Identify the missing dependency.
* Describe what has been implemented.
* Identify what remains.
* Do not claim that the feature is functional if it is not.

20. DEFINITION OF DONE
A feature is considered complete only when:
21. The feature has a working user interface.
22. The feature has appropriate backend functionality.
23. The feature persists data correctly.
24. The feature enforces authorization.
25. The feature handles validation.
26. The feature handles errors.
27. The feature has appropriate automated tests.
28. The feature integrates with related modules.
29. The feature has been verified in the running application.
30. The feature is documented where necessary.

The application is considered ready for its first production-oriented release when:

* Users can authenticate securely.
* Users can create and manage projects.
* Users can create and manage issues.
* Issues can progress through configured workflows.
* Agile teams can use Scrum and Kanban boards.
* Project managers can manage plans, milestones, risks, and dependencies.
* PMO users can manage portfolios and governance.
* Financial and resource data can be managed.
* Dashboards reflect actual persisted data.
* Authorization is enforced across the application.
* Critical workflows pass automated tests.
* The application can be deployed using documented instructions.

21. YOUR FIRST ACTION
Start by inspecting the current repository.
Then provide a concise assessment containing:
22. Current application structure.
23. Existing technology stack.
24. Existing functionality.
25. Architectural gaps.
26. Recommended implementation approach.
27. Proposed database structure.
28. Development phases.

After that, immediately begin implementing Phase 1.
Do not ask me to approve every small technical decision.
Use your professional judgment, document important assumptions, and proceed.
The ultimate objective is to deliver a complete, enterprise-grade project management platform that combines Jira's issue management and Agile delivery capabilities with the governance, financial management, resource planning, and executive reporting capabilities required by a modern Enterprise PMO.
Build it as a real software product with a maintainable architecture, professional user experience, reliable data persistence, and a clear path to enterprise deployment.
