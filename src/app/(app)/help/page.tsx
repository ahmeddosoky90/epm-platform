import Link from "next/link";
import { requireCtx } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui/bits";

export const metadata = { title: "Help" };
const EQL = [
  ["project = DOB AND status = \"In Progress\"", "Work in progress in one project"],
  ["assignee = currentUser() AND statusCategory != Done ORDER BY dueDate", "My open work by due date"],
  ["type = Bug AND severity IN (S1, S2) AND resolution IS EMPTY", "Serious unresolved bugs"],
  ["showStopper = true", "All show-stoppers"],
  ["sprint IN openSprints() AND storyPoints IS EMPTY", "Unestimated items in active sprints"],
  ["created >= -7d", "Created in the last 7 days"],
  ["summary ~ \"login\" OR text ~ \"timeout\"", "Text search"],
];
export default async function Help() {
  await requireCtx();
  return (<>
    <PageHeader title="Help" subtitle="How Lumen PMO works and where to find things" />
    <div className="grid lg:grid-cols-2 gap-4">
      <Card title="Keyboard shortcuts"><table className="table"><tbody>
        <tr><td><kbd className="chip">/</kbd></td><td>Focus search</td></tr><tr><td><kbd className="chip">c</kbd></td><td>Create an issue</td></tr><tr><td><kbd className="chip">Esc</kbd></td><td>Close a dialog</td></tr>
      </tbody></table></Card>
      <Card title="Search language (EQL)"><p className="text-sm muted mb-2">Use it in <Link className="text-accent" href="/search">Issues &amp; filters</Link>. Fields: project, status, statusCategory, assignee, reporter, priority, type, labels, sprint, dueDate, created, updated, resolved, summary, text, storyPoints, showStopper, severity, parent, component, resolution.</p>
        <table className="table"><tbody>{EQL.map(([q, d]) => <tr key={q}><td><code className="text-xs"><Link href={`/search?jql=${encodeURIComponent(q)}`} className="text-accent">{q}</Link></code></td><td className="text-xs">{d}</td></tr>)}</tbody></table></Card>
      <Card title="Workflow and boards"><ul className="list-disc ps-5 text-sm space-y-1">
        <li>Moving a card on a board performs a workflow transition. If the transition needs fields (for example an assignee) or has conditions (no open blockers), the move is refused with the reason.</li>
        <li>Done requires no open “blocked by” links and sets a resolution.</li>
        <li>Sprint scope changes after start are recorded and shown in the sprint report and burndown.</li>
      </ul></Card>
      <Card title="Governance"><ul className="list-disc ps-5 text-sm space-y-1">
        <li>Stage gates need their checklist complete before they can be submitted. Approvers decide in order; you cannot approve your own submission.</li>
        <li>Moving a project into a stage that requires approval needs governance approval rights.</li>
        <li>Approved change requests update the project end date, budget and milestone baselines when implemented.</li>
      </ul></Card>
      <Card title="Microsoft Project"><ul className="list-disc ps-5 text-sm space-y-1">
        <li>Open a project → Schedule → Import MS Project. Upload the plan saved as <b>XML</b> (File → Save As → XML Format).</li>
        <li>Native <code>.mpp</code> files are a closed binary format and are not read directly. Save as XML first.</li>
        <li>Export MS Project XML gives a file MS Project opens directly, including dependencies and baseline.</li>
      </ul></Card>
      <Card title="Security"><ul className="list-disc ps-5 text-sm space-y-1">
        <li>Turn on two-step verification in <Link className="text-accent" href="/profile">Profile &amp; security</Link>.</li>
        <li>Every important change is written to an append-only audit log that administrators and auditors can review.</li>
        <li>Sessions expire after inactivity. Passwords lock after five failed attempts for 15 minutes.</li>
      </ul></Card>
    </div>
  </>);
}
