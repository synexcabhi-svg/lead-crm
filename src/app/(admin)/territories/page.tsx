import { listTerritories } from "@/domain/team/territory.service";
import { getTechnicalMembers } from "@/domain/team/team.service";
import { TerritoriesClient } from "./territories-client";

export const dynamic = "force-dynamic";

export default async function TerritoriesPage() {
  const [territories, members] = await Promise.all([listTerritories(), getTechnicalMembers()]);
  return (
    <TerritoriesClient
      initial={JSON.parse(JSON.stringify(territories))}
      members={members.filter((m) => m.isActive).map((m) => ({ id: m.id, name: m.name, color: m.color }))}
    />
  );
}
