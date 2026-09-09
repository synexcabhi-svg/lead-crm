import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, ok, unauthorized } from "@/lib/http";
import { COOKIE_NAME, signSession, verifyPassword, sessionCookieOptions, type Role } from "@/lib/auth";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  return handle(async () => {
    const { email, password } = bodySchema.parse(await req.json());

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
      throw unauthorized("Invalid email or password");
    }

    const token = await signSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
      color: user.color,
      mustChangePassword: user.mustChangePassword,
    });
    cookies().set(COOKIE_NAME, token, sessionCookieOptions());

    return ok({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    });
  });
}
