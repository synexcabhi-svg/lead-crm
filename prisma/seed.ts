/**
 * Seed: reference data (statuses, sources, deal stages), the people list
 * (Super Admin / Admin / Manager / Sales), territory routing rules, and - only
 * on a fresh database - sample leads/deals for the dashboard.
 *
 * Run: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const STATUSES = [
  { key: "new", label: "New", sortOrder: 10, color: "#2563eb", isDefault: true },
  { key: "contacted", label: "Contacted", sortOrder: 20, color: "#0891b2" },
  { key: "qualified", label: "Qualified", sortOrder: 30, color: "#7c3aed" },
  { key: "follow_up", label: "Follow-up", sortOrder: 40, color: "#d97706" },
  { key: "converted", label: "Converted", sortOrder: 50, color: "#16a34a", isConverted: true },
  { key: "lost", label: "Lost", sortOrder: 60, color: "#dc2626", isLost: true },
  { key: "unqualified", label: "Unqualified", sortOrder: 70, color: "#6b7280", isLost: true },
];

const SOURCES = [
  { key: "manual", label: "Manual entry", color: "#6b7280" },
  { key: "public_form", label: "Website enquiry form", color: "#2563eb" },
  { key: "website", label: "Property portal", color: "#0891b2" },
  { key: "referral", label: "Referral", color: "#16a34a" },
  { key: "phone", label: "Phone / walk-in", color: "#d97706" },
  { key: "email", label: "Email", color: "#7c3aed" },
  { key: "event", label: "Property expo / site visit", color: "#db2777" },
  { key: "other", label: "Other", color: "#64748b" },
];

const DEAL_STAGES = [
  { key: "qualification", label: "Qualification", sortOrder: 10, probability: 10, isDefault: true },
  { key: "needs_analysis", label: "Needs Analysis", sortOrder: 20, probability: 25 },
  { key: "proposal", label: "Proposal / Quote", sortOrder: 30, probability: 50 },
  { key: "negotiation", label: "Negotiation", sortOrder: 40, probability: 75 },
  { key: "closed_won", label: "Closed Won", sortOrder: 50, probability: 100, isWon: true },
  { key: "closed_lost", label: "Closed Lost", sortOrder: 60, probability: 0, isLost: true },
];

/**
 * The whole people list. Abhishek Jha = Super Admin, Akash Adlakha = Admin,
 * everyone else = Sales. Each gets a login with temp password Welcome@123,
 * changed on first sign-in. This list fills BOTH the Owner and Sales Team
 * pickers.
 */
const ROSTER = [
  { name: "Abhishek Jha", email: "abhishek.jha@synexc.com", role: "SUPER_ADMIN", color: "#111827" },
  { name: "Akash Adlakha", email: "akash.adlakha@synexc.com", role: "ADMIN", color: "#334155" },
  { name: "Tarun Shergill", email: "tarun.shergill@synexc.com", role: "SALES", color: "#d97706" },
  { name: "Manchit", email: "manchit@synexc.com", role: "SALES", color: "#dc2626" },
  { name: "Sambhav Arora", email: "sambhav.arora@synexc.com", role: "SALES", color: "#7c3aed" },
  { name: "Sachin", email: "sachin@synexc.com", role: "SALES", color: "#0891b2" },
  { name: "Tanshiq", email: "tanshiq@synexc.com", role: "SALES", color: "#db2777" },
  { name: "Ishita", email: "ishita@synexc.com", role: "SALES", color: "#65a30d" },
  { name: "Apoorv", email: "apoorv@synexc.com", role: "SALES", color: "#c2410c" },
];

/** Placeholder accounts from earlier seeds - deactivated so they don't show
 *  in the pickers and can't sign in. */
const LEGACY_EMAILS = ["admin@crm.local", "crmadmin@crm.local", "manager@crm.local", "agent@crm.local"];

// Sales-Team member name -> territory rule(s)
const TERRITORIES: Record<string, { state?: string; city?: string; country?: string }[]> = {
  "Abhishek Jha": [{ state: "Maharashtra", country: "India" }],
  "Akash Adlakha": [
    { state: "Delhi", country: "India" },
    { state: "National Capital Territory of Delhi", country: "India" },
  ],
  "Tarun Shergill": [{ state: "Punjab", country: "India" }],
  Manchit: [{ state: "Haryana", country: "India" }],
  "Sambhav Arora": [
    { state: "Karnataka", country: "India" },
    { city: "Bengaluru", country: "India" },
  ],
  Sachin: [{ state: "Uttar Pradesh", country: "India" }],
  Tanshiq: [{ state: "Gujarat", country: "India" }],
  Ishita: [{ state: "West Bengal", country: "India" }],
  Apoorv: [{ state: "Rajasthan", country: "India" }],
};

// Restore the Sales-Team member on the leads kept during the data cleanup
// (matched by the lead's email).
const KEPT_LEAD_SALES: Record<string, string> = {
  "abhishek.jha@synexc.com": "Abhishek Jha",
  "apoorv.saxena@synexc.com": "Akash Adlakha",
  "gautam@gmail.com": "Sambhav Arora",
  "sachin@gmail.com": "Sambhav Arora",
};

const FIRST = ["Aarav", "Diya", "Vivaan", "Ananya", "Kabir", "Isha", "Rohan", "Meera", "Arjun", "Sara", "Dev", "Nisha", "Ved", "Tara", "Reyansh", "Kiara", "Aditya", "Riya", "Krish", "Anvi"];
const LAST = ["Sharma", "Verma", "Iyer", "Nair", "Patel", "Reddy", "Gupta", "Bose", "Khan", "Mehta"];
const COMPANIES = ["Northwind Estates", "Acme Realty", "Blue Ocean Homes", "Zenith Properties", "Pinnacle Realtors", "Vertex Estates", "Harbor Homes", "Orbit Realty", null, null];
const PRIORITIES = ["LOW", "MEDIUM", "MEDIUM", "MEDIUM", "HIGH", "HIGH", "URGENT"];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 60), 0, 0);
  return d;
}

async function main() {
  console.log("Seeding statuses / sources / deal stages...");
  for (const s of STATUSES) await prisma.leadStatus.upsert({ where: { key: s.key }, update: s, create: s });
  for (const s of SOURCES) await prisma.leadSource.upsert({ where: { key: s.key }, update: s, create: s });
  for (const s of DEAL_STAGES) await prisma.dealStage.upsert({ where: { key: s.key }, update: s, create: s });

  console.log("Seeding people (Abhishek Jha = Super Admin, Akash Adlakha = Admin, rest = Sales)...");
  const userIdByName = new Map<string, string>();
  const welcomeHash = await bcrypt.hash("Welcome@123", 10);

  for (let i = 0; i < ROSTER.length; i++) {
    const p = ROSTER[i];
    const rec = await prisma.user.upsert({
      where: { email: p.email },
      // roles/colour/active always synced; password + forced-change only on create
      update: { name: p.name, role: p.role, color: p.color, sortOrder: i, isActive: true },
      create: {
        email: p.email,
        name: p.name,
        role: p.role,
        color: p.color,
        sortOrder: i,
        passwordHash: welcomeHash,
        mustChangePassword: true,
      },
    });
    userIdByName.set(p.name, rec.id);
  }

  // Deactivate the old placeholder accounts.
  await prisma.user.updateMany({
    where: { email: { in: LEGACY_EMAILS } },
    data: { isActive: false },
  });

  if ((await prisma.territory.count()) === 0) {
    console.log("Seeding territory routing rules...");
    let n = 0;
    for (const [name, rules] of Object.entries(TERRITORIES)) {
      const uid = userIdByName.get(name);
      if (!uid) continue;
      for (let i = 0; i < rules.length; i++) {
        await prisma.territory.create({ data: { technicalMemberId: uid, ...rules[i], sortOrder: i } });
        n++;
      }
    }
    console.log(`Created ${n} territory rules.`);
  }

  const leadCount = await prisma.lead.count();

  if (leadCount === 0) {
    console.log("Fresh database - seeding ~45 sample leads + deals...");
    const salesIds = ROSTER.filter((p) => p.role === "SALES").map((p) => userIdByName.get(p.name)!);
    const staffIds = ROSTER.filter((p) => p.role !== "SALES").map((p) => userIdByName.get(p.name)!);
    const statusKeys = STATUSES.map((s) => s.key);
    const sourceKeys = SOURCES.map((s) => s.key);
    const stageKeys = DEAL_STAGES.map((s) => s.key);
    const spread = [0, 0, 1, 1, 2, 3, 4, 5, 6, 7, 9, 11, 14, 18, 21, 25, 30, 35, 40, 44];

    for (let i = 0; i < 45; i++) {
      const first = pick(FIRST);
      const last = pick(LAST);
      const when = daysAgo(pick(spread));
      const salesId = Math.random() > 0.4 ? pick(salesIds) : null;
      await prisma.lead.create({
        data: {
          firstName: first,
          lastName: last,
          email: `${first}.${last}${i}`.toLowerCase() + "@example.com",
          phone: "+9198" + String(10000000 + Math.floor(Math.random() * 89999999)),
          company: pick(COMPANIES),
          sourceKey: pick(sourceKeys),
          statusKey: pick(statusKeys),
          priority: pick(PRIORITIES),
          ownerId: Math.random() > 0.3 ? salesId ?? pick([...salesIds, ...staffIds]) : null,
          technicalMemberId: salesId,
          message: Math.random() > 0.6 ? "Interested in a site visit and pricing." : null,
          consent: true,
          createdAt: when,
          updatedAt: when,
        },
      });
    }

    const convertible = await prisma.lead.findMany({
      where: { statusKey: "converted", convertedAt: null },
      take: 10,
    });
    let made = 0;
    for (const lead of convertible) {
      const accountName = (lead.company ?? "").trim() || `${lead.firstName} ${lead.lastName ?? ""}`.trim();
      const carried = {
        city: lead.city,
        state: lead.state,
        country: lead.country,
        postalCode: lead.postalCode,
        technicalMemberId: lead.technicalMemberId,
      };
      const account = await prisma.account.create({
        data: { name: accountName, ownerId: lead.ownerId, phone: lead.phone, ...carried },
      });
      const contact = await prisma.contact.create({
        data: {
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          phone: lead.phone,
          accountId: account.id,
          ownerId: lead.ownerId,
          ...carried,
        },
      });
      const stageKey = pick(stageKeys);
      const closed = stageKey === "closed_won" || stageKey === "closed_lost";
      const dealRec = await prisma.deal.create({
        data: {
          name: `${accountName} - ${lead.firstName}`,
          amount: (1 + Math.floor(Math.random() * 20)) * 250000,
          currency: "INR",
          stageKey,
          accountId: account.id,
          primaryContactId: contact.id,
          ownerId: lead.ownerId,
          ...carried,
          expectedCloseDate: daysAgo(-1 * (5 + Math.floor(Math.random() * 40))),
          closedAt: closed ? new Date() : null,
          sourceLeadId: lead.id,
        },
      });
      await prisma.dealContact.create({
        data: { dealId: dealRec.id, contactId: contact.id, role: "Primary", isPrimary: true },
      });
      await prisma.lead.update({
        where: { id: lead.id },
        data: { convertedAt: new Date(), convertedAccountId: account.id, convertedContactId: contact.id },
      });
      made++;
    }
    console.log(`Created 45 leads and ${made} deals.`);
  } else {
    console.log(`Leads already present (${leadCount}) - restoring Sales Team on kept leads only.`);
    for (const [email, salesName] of Object.entries(KEPT_LEAD_SALES)) {
      const uid = userIdByName.get(salesName);
      if (!uid) continue;
      await prisma.lead.updateMany({ where: { email }, data: { technicalMemberId: uid } });
    }
  }

  const [leads, deals, accounts, people] = await Promise.all([
    prisma.lead.count(),
    prisma.deal.count(),
    prisma.account.count(),
    prisma.user.count(),
  ]);
  console.log(`\nDone. ${people} people, ${leads} leads, ${accounts} accounts, ${deals} deals.`);
  console.log("Everyone logs in at <email> / Welcome@123 (forced change on first sign-in):");
  console.log("  Super Admin: abhishek.jha@synexc.com");
  console.log("  Admin:       akash.adlakha@synexc.com");
  console.log("  Sales:       tarun.shergill / manchit / sambhav.arora / sachin / tanshiq / ishita / apoorv @synexc.com");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
