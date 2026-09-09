/**
 * People = the single user list. Populates the Owner and Sales Team pickers,
 * and carries each person's role for RBAC.
 */
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { badRequest, notFound } from "@/lib/http";
import { ROLES, isRole } from "@/lib/rbac";

const orderBy = [{ sortOrder: "asc" as const }, { name: "asc" as const }];

/** Everyone, for the People admin screen. */
export function listPeople() {
  return prisma.user.findMany({
    orderBy,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      color: true,
      isActive: true,
      mustChangePassword: true,
      createdAt: true,
    },
  });
}

/** Active users only - the Owner / Sales Team dropdown options. */
export function getAssignablePeople() {
  return prisma.user.findMany({
    where: { isActive: true },
    orderBy,
    select: { id: true, name: true, color: true, role: true },
  });
}

export async function createPerson(input: {
  name: string;
  email: string;
  role: string;
  color?: string;
  tempPassword: string;
}) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!name) throw badRequest("Name is required", { field: "name" });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw badRequest("Valid email required", { field: "email" });
  if (!isRole(input.role)) throw badRequest(`Role must be one of ${ROLES.join(", ")}`, { field: "role" });
  if (input.tempPassword.length < 8) throw badRequest("Temp password must be 8+ characters", { field: "tempPassword" });
  if (await prisma.user.findUnique({ where: { email } })) {
    throw badRequest("A person with this email already exists", { field: "email" });
  }

  const max = await prisma.user.aggregate({ _max: { sortOrder: true } });
  return prisma.user.create({
    data: {
      name,
      email,
      role: input.role,
      color: input.color?.trim() || "#6b7280",
      sortOrder: (max._max.sortOrder ?? 0) + 1,
      passwordHash: await hashPassword(input.tempPassword),
      mustChangePassword: true,
    },
    select: { id: true, name: true, email: true, role: true, color: true, isActive: true },
  });
}

export async function updatePerson(
  id: string,
  input: Partial<{ name: string; role: string; color: string; isActive: boolean }>,
  actingUserId: string,
) {
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) throw notFound("Person not found");

  const data: Record<string, unknown> = {};
  if (input.name !== undefined && input.name.trim()) data.name = input.name.trim();
  if (input.color !== undefined) data.color = input.color.trim() || "#6b7280";
  if (input.role !== undefined) {
    if (!isRole(input.role)) throw badRequest(`Role must be one of ${ROLES.join(", ")}`, { field: "role" });
    if (id === actingUserId && input.role !== "SUPER_ADMIN") {
      throw badRequest("You cannot remove your own Super Admin role");
    }
    data.role = input.role;
  }
  if (input.isActive !== undefined) {
    if (id === actingUserId && !input.isActive) throw badRequest("You cannot deactivate yourself");
    data.isActive = input.isActive;
  }

  return prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, color: true, isActive: true },
  });
}

export async function resetPassword(id: string, tempPassword: string) {
  if (tempPassword.length < 8) throw badRequest("Temp password must be 8+ characters", { field: "tempPassword" });
  if (!(await prisma.user.findUnique({ where: { id } }))) throw notFound("Person not found");
  await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true },
  });
}
