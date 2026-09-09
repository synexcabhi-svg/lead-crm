/**
 * Lead conversion (Zoho-style): turn a converted lead into an Account +
 * Contact + (optional) Deal, in one transaction. A lead can be converted
 * once; after that the lead detail page links to the records it produced.
 *
 * Preconditions:
 *   - the lead exists and is not archived
 *   - the lead's status has isConverted = true
 *   - the lead has not already been converted
 */
import { prisma } from "@/lib/prisma";
import { emitLeadEvent } from "@/lib/events";
import { badRequest, notFound, conflict } from "@/lib/http";
import { recordAudit, actorLabel, type Actor } from "@/domain/audit/audit.service";
import { getStatuses } from "@/domain/statuses/status.service";
import { createContact, findOrCreateAccountByName } from "@/domain/accounts/account.service";
import { getDefaultDealStageKey, assertDealStageKey, isClosedStage } from "@/domain/deals/deal.stage.service";
import { DEAL_AUDIT_ACTIONS, LEAD_CONVERTED_ACTION, DEFAULT_CURRENCY } from "@/domain/deals/deal.constants";
import type { ConvertLeadInput } from "@/domain/deals/deal.schema";

type LeadRow = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  ownerId: string | null;
};

/** Pure: what to name the account created for this lead. */
export function resolveAccountName(lead: LeadRow, input: { accountName?: string }): string {
  const explicit = (input.accountName ?? "").trim();
  if (explicit) return explicit;
  const company = (lead.company ?? "").trim();
  if (company) return company;
  const person = `${lead.firstName} ${lead.lastName ?? ""}`.trim();
  return person || "Untitled account";
}

/** Pure: what to name the deal created for this lead. */
export function resolveDealName(lead: LeadRow, accountName: string, input: { dealName?: string }): string {
  const explicit = (input.dealName ?? "").trim();
  if (explicit) return explicit;
  const person = `${lead.firstName} ${lead.lastName ?? ""}`.trim();
  return `${accountName}${person ? ` - ${person}` : ""}`.slice(0, 140) || "New opportunity";
}

export async function convertLead(leadId: string, input: ConvertLeadInput, ctx: { actor: Actor }) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw notFound(`Lead ${leadId} not found`);
  if (lead.isArchived) throw badRequest("Archived leads cannot be converted");
  if (lead.convertedAt) throw conflict("This lead has already been converted", { leadId });

  const statuses = await getStatuses();
  const status = statuses.find((s) => s.key === lead.statusKey);
  if (!status?.isConverted) {
    throw badRequest(
      `Lead must be in a "converted" status first (current: ${status?.label ?? lead.statusKey})`,
      { field: "statusKey" },
    );
  }

  const ownerId =
    (input.ownerId ?? "").trim() ||
    lead.ownerId ||
    (ctx.actor.kind === "user" ? ctx.actor.userId : null);
  if (ownerId && !(await prisma.user.findFirst({ where: { id: ownerId, isActive: true } }))) {
    throw badRequest(`Unknown or inactive owner: ${ownerId}`, { field: "ownerId" });
  }

  const wantDeal = input.createDeal !== false;
  let stageKey: string | null = null;
  if (wantDeal) {
    stageKey = (input.stageKey ?? "").trim() || (await getDefaultDealStageKey());
    await assertDealStageKey(stageKey);
  }

  const accountName = resolveAccountName(lead, input);

  // location + technical member carried from the lead onto every record it creates
  const carried = {
    city: lead.city,
    state: lead.state,
    country: lead.country,
    postalCode: lead.postalCode,
    technicalMemberId: lead.technicalMemberId,
  };

  const result = await prisma.$transaction(async (tx) => {
    // ---- Account -----------------------------------------------------
    let accountId: string;
    let accountCreated = false;
    if ((input.accountId ?? "").trim()) {
      const acc = await tx.account.findUnique({ where: { id: input.accountId!.trim() } });
      if (!acc) throw badRequest(`Unknown account: ${input.accountId}`, { field: "accountId" });
      accountId = acc.id;
    } else {
      const { account, created } = await findOrCreateAccountByName(accountName, ctx, ownerId, carried, tx);
      accountId = account.id;
      accountCreated = created;
    }

    // ---- Contact ---------------------------------------------------
    const contact = await createContact(
      {
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        accountId,
        ownerId,
        ...carried,
      },
      tx,
    );

    // ---- Deal (optional) -----------------------------------------
    let deal: { id: string; name: string } | null = null;
    if (wantDeal && stageKey) {
      const created = await tx.deal.create({
        data: {
          name: resolveDealName(lead, accountName, input),
          amount: input.amount ?? null,
          currency: DEFAULT_CURRENCY,
          stageKey,
          accountId,
          primaryContactId: contact.id,
          ownerId,
          technicalMemberId: lead.technicalMemberId,
          city: lead.city,
          state: lead.state,
          country: lead.country,
          postalCode: lead.postalCode,
          expectedCloseDate: (input.expectedCloseDate ?? "").trim()
            ? new Date(input.expectedCloseDate + "T00:00:00")
            : null,
          closedAt: (await isClosedStage(stageKey)) ? new Date() : null,
          sourceLeadId: lead.id,
        },
      });
      // associate the newly created contact with the deal (primary)
      await tx.dealContact.create({
        data: { dealId: created.id, contactId: contact.id, role: "Primary", isPrimary: true },
      });
      deal = { id: created.id, name: created.name };
    }

    // ---- mark the lead converted --------------------------------
    const updatedLead = await tx.lead.update({
      where: { id: lead.id },
      data: {
        convertedAt: new Date(),
        convertedAccountId: accountId,
        convertedContactId: contact.id,
      },
    });

    // ---- audit -------------------------------------------------
    await recordAudit(
      ctx.actor,
      [
        {
          leadId: lead.id,
          action: LEAD_CONVERTED_ACTION,
          newValue: deal ? `deal:${deal.name}` : `account:${accountName}`,
          metadata: { accountId, contactId: contact.id, dealId: deal?.id ?? null, accountCreated },
        },
        ...(deal
          ? [
              {
                dealId: deal.id,
                action: DEAL_AUDIT_ACTIONS.CREATED_FROM_LEAD,
                newValue: deal.name,
                metadata: { fromLeadId: lead.id, accountId },
              },
            ]
          : []),
      ],
      tx,
    );

    return { accountId, accountCreated, contactId: contact.id, deal, lead: updatedLead };
  });

  const at = new Date().toISOString();
  const actor = actorLabel(ctx.actor);
  emitLeadEvent({ type: "lead.converted", leadId: lead.id, dealId: result.deal?.id, accountId: result.accountId, at, actor });
  if (result.deal) {
    emitLeadEvent({ type: "deal.created", dealId: result.deal.id, accountId: result.accountId, at, actor });
  }

  return result;
}
