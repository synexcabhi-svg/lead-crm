/**
 * GET /api/leads/export - CSV of the current filtered lead set (max 5000 rows).
 * Uses the same query schema as the list endpoint.
 */
import { handle } from "@/lib/http";
import { requireUser } from "@/lib/auth";
import { leadScopeWhere } from "@/lib/rbac";
import { leadListQuerySchema } from "@/domain/leads/lead.schema";
import { listLeads } from "@/domain/leads/lead.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COLUMNS = [
  "id",
  "firstName",
  "lastName",
  "email",
  "phone",
  "company",
  "city",
  "state",
  "country",
  "postalCode",
  "source",
  "status",
  "priority",
  "owner",
  "technicalMember",
  "isDuplicate",
  "isArchived",
  "createdAt",
  "updatedAt",
] as const;

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const url = new URL(req.url);
    const query = leadListQuerySchema.parse(Object.fromEntries(url.searchParams));
    const { items } = await listLeads({ ...query, page: 1, pageSize: 5000 }, leadScopeWhere(user));

    const rows = items.map((l) =>
      [
        l.id,
        l.firstName,
        l.lastName,
        l.email,
        l.phone,
        l.company,
        l.city,
        l.state,
        l.country,
        l.postalCode,
        l.source.label,
        l.status.label,
        l.priority,
        l.owner?.name ?? "",
        l.technicalMember?.name ?? "",
        l.isDuplicate,
        l.isArchived,
        l.createdAt.toISOString(),
        l.updatedAt.toISOString(),
      ]
        .map(csvCell)
        .join(","),
    );

    const body = [COLUMNS.join(","), ...rows].join("\n");
    return new Response(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  });
}
