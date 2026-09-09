import { requireUser } from "@/lib/auth";
import { leadScopeWhere, dealScopeWhere } from "@/lib/rbac";
import { getEverything } from "@/domain/dashboard/dashboard.service";
import { DashboardClient } from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser();
  const initial = await getEverything(leadScopeWhere(user), dealScopeWhere(user));
  return <DashboardClient initial={initial} />;
}
