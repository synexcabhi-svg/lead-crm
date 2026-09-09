import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok, unauthorized, badRequest } from "@/lib/http";
import {
  COOKIE_NAME,
  requireUser,
  signSession,
  hashPassword,
  verifyPassword,
  sessionCookieOptions,
  type Role,
} from "@/lib/auth";

export const runtime = "nodejs";

const bodySchema = z.object({
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8, "At least 8 characters").max(200),
});

export async function POST(req: Request) {
  return handle(async () => {
    const session = await requireUser();
    const { currentPassword, newPassword } = bodySchema.parse(await req.json());

    const user = await prisma.user.findUnique({ where: { id: session.id } });
    if (!user || !user.isActive) throw unauthorized();

    // Skip the current-password check only for a forced first-login change.
    if (!user.mustChangePassword) {
      if (!currentPassword || !(await verifyPassword(currentPassword, user.passwordHash))) {
        throw badRequest("Current password is incorrect", { field: "currentPassword" });
      }
    }
    if (currentPassword && (await verifyPassword(newPassword, user.passwordHash))) {
      throw badRequest("New password must be different", { field: "newPassword" });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
    });

    const token = await signSession({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role as Role,
      color: updated.color,
      mustChangePassword: false,
    });
    cookies().set(COOKIE_NAME, token, sessionCookieOptions());

    return ok({ ok: true });
  });
}
