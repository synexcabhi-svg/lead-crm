/**
 * Authentication: password hashing (bcrypt) + stateless JWT sessions in an
 * httpOnly cookie (jose, so the same verify works in Edge middleware).
 *
 * The JWT only proves *identity* (its `sub`). `getCurrentUser` re-reads the
 * User row so a rename / role change / deactivation takes effect immediately,
 * without waiting for the token to expire.
 */
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";
import { unauthorized, forbidden } from "@/lib/http";

export const COOKIE_NAME = "crm_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const secret = new TextEncoder().encode(env.jwtSecret);

export type Role = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "SALES";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  color: string;
  mustChangePassword: boolean;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}
export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
    clr: user.color,
    mcp: user.mustChangePassword,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret);
}

/** Decode + signature-check only (no DB). Used by /api/auth/me. */
export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      email: String(payload.email),
      name: String(payload.name),
      role: payload.role as Role,
      color: typeof payload.clr === "string" ? payload.clr : "#2563eb",
      mustChangePassword: payload.mcp === true,
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.isProd,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

/**
 * The current user, re-hydrated from the database. Returns null if the token is
 * missing/invalid OR the account no longer exists / has been deactivated.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  const claims = await verifySession(token);
  if (!claims) return null;

  const u = await prisma.user.findUnique({
    where: { id: claims.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      color: true,
      isActive: true,
      mustChangePassword: true,
    },
  });
  if (!u || !u.isActive) return null;

  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as Role,
    color: u.color,
    mustChangePassword: u.mustChangePassword,
  };
}

/** Throw 401 if not signed in (or the account was deactivated). */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}

/** Throw 403 if the user's role is not in `roles`. */
export function requireRole(user: SessionUser, roles: Role[]): void {
  if (!roles.includes(user.role)) throw forbidden();
}
