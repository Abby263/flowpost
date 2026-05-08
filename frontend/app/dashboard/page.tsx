import { redirect } from "next/navigation";

// Workflows are the dashboard home — there's no separate overview page.
// Approvals live inside each workflow card so reviewers don't have to
// hop between two surfaces.
export default function DashboardIndex() {
  redirect("/dashboard/workflows");
}
