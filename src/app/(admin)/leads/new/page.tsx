import { getStatuses, getSources } from "@/domain/statuses/status.service";
import { getAssignablePeople } from "@/domain/people/people.service";
import { getPropertyTypes } from "@/domain/property/property-type.service";
import { NewLeadClient } from "./new-lead-client";

export const dynamic = "force-dynamic";

export default async function NewLeadPage() {
  const [statuses, sources, people, propertyTypes] = await Promise.all([
    getStatuses(),
    getSources(),
    getAssignablePeople(),
    getPropertyTypes(),
  ]);
  const peopleOpts = people.map((p) => ({ id: p.id, name: p.name, color: p.color }));

  return (
    <>
      <div className="topbar">
        <h1>Add Lead</h1>
      </div>
      <div className="card" style={{ maxWidth: 640 }}>
        <NewLeadClient
          meta={{
            statuses: statuses.filter((s) => s.isActive).map((s) => ({ key: s.key, label: s.label })),
            sources: sources
              .filter((s) => s.isActive)
              .map((s) => ({ key: s.key, label: s.label, color: s.color })),
            owners: peopleOpts,
            technicalMembers: peopleOpts,
            propertyTypes: propertyTypes
              .filter((p) => p.isActive)
              .map((p) => ({ key: p.key, label: p.label, category: p.category })),
          }}
        />
      </div>
    </>
  );
}
