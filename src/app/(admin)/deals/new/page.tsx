import { prisma } from "@/lib/prisma";
import { getDealStages } from "@/domain/deals/deal.stage.service";
import { getAssignablePeople } from "@/domain/people/people.service";
import { NewDealClient } from "./new-deal-client";

export const dynamic = "force-dynamic";

export default async function NewDealPage() {
  const [stages, people, accounts] = await Promise.all([
    getDealStages(),
    getAssignablePeople(),
    prisma.account.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 }),
  ]);
  const peopleOpts = people.map((p) => ({ id: p.id, name: p.name, color: p.color }));

  return (
    <>
      <div className="topbar">
        <h1>New Deal</h1>
      </div>
      <div className="card" style={{ maxWidth: 620 }}>
        <NewDealClient
          meta={{
            stages: stages.filter((s) => s.isActive).map((s) => ({ key: s.key, label: s.label })),
            owners: peopleOpts,
            technicalMembers: peopleOpts,
            accounts,
          }}
        />
      </div>
    </>
  );
}
