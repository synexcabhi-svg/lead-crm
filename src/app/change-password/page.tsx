import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ChangePasswordForm } from "./change-password-form";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="center-page">
      <div className="card auth-card">
        <h1>{user.mustChangePassword ? "Set your password" : "Change password"}</h1>
        <p className="muted" style={{ marginTop: -4 }}>
          {user.mustChangePassword
            ? "This is your first sign-in. Choose a new password to continue."
            : `Signed in as ${user.email}`}
        </p>
        <ChangePasswordForm forced={user.mustChangePassword} />
      </div>
    </div>
  );
}
