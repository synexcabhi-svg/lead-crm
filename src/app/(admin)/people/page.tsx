import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { listPeople } from "@/domain/people/people.service";
import { PeopleClient } from "./people-client";

export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const user = await requireUser();
  if (!can.managePeople(user)) redirect("/dashboard");
  const people = await listPeople();
  return <PeopleClient initial={JSON.parse(JSON.stringify(people))} meId={user.id} />;
}
