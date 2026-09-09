import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can, ROLE_LABELS, isRole } from "@/lib/rbac";
import { ThemeControl } from "@/components/ThemeControl";
import { LogoutButton, NavLink } from "./nav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");

  const color = user.color;
  const roleLabel = isRole(user.role) ? ROLE_LABELS[user.role] : user.role;
  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="brand">Lead CRM</div>
        <NavLink href="/dashboard">Dashboard</NavLink>
        <NavLink href="/leads">Leads</NavLink>
        <NavLink href="/leads/new">Add Lead</NavLink>
        <NavLink href="/deals">Deals</NavLink>
        <NavLink href="/accounts">Accounts</NavLink>
        {can.manageTerritories(user) ? <NavLink href="/territories">Territories</NavLink> : null}
        {can.managePeople(user) ? <NavLink href="/people">People &amp; Roles</NavLink> : null}
        <a href="/public/lead-form" target="_blank" rel="noreferrer">
          Public form &#8599;
        </a>
        <div className="spacer" />
        <LogoutButton />
      </nav>
      <main className="main">
        <header className="app-header">
          <ThemeControl />
          <div className="who">
            <span className="who-dot" style={{ background: color }}>
              {initials}
            </span>
            <span>
              <b>{user.name}</b> <span className="muted">· {roleLabel}</span>
              <br />
              <span className="muted" style={{ fontSize: "0.75rem" }}>{user.email}</span>
            </span>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
