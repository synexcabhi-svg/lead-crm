import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  if (await getCurrentUser()) redirect(searchParams.next || "/dashboard");
  return (
    <div className="center-page">
      <div className="card auth-card">
        <h1>Lead CRM</h1>
        <p className="muted" style={{ marginTop: -4 }}>
          Sign in to continue
        </p>
        <LoginForm next={searchParams.next} />
        <p className="hint" style={{ marginTop: 14 }}>
          Seed login: <code>admin@crm.local</code> / <code>Admin@12345</code>
        </p>
      </div>
    </div>
  );
}
