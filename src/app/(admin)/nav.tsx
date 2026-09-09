"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/client";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
  return (
    <Link href={href} className={active ? "active" : ""}>
      {children}
    </Link>
  );
}

export function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }
  return (
    <button className="btn sm" style={{ margin: "8px 10px 0" }} onClick={logout}>
      Sign out
    </button>
  );
}
