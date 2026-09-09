import { listAccounts } from "@/domain/accounts/account.service";
import { AccountsClient } from "./accounts-client";

export const dynamic = "force-dynamic";

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const result = await listAccounts({
    q: searchParams.q,
    page: Number(searchParams.page ?? 1),
    pageSize: 25,
  });
  return <AccountsClient initial={JSON.parse(JSON.stringify(result))} q={searchParams.q ?? ""} />;
}
