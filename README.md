# Lead CRM

A standalone Lead Management System (real-estate). **One lead database, one
lead service, one source of truth** — with two input methods (admin UI + public
form) and a dashboard that keeps itself in sync automatically.

> **Terminology:** the roster of people leads are assigned to is called the
> **Sales Team** in the UI. Internally the field is still `technicalMemberId`
> (a label change) but it now references the `User` table.

## Roles & permissions (Zoho-style)

There is **one people list** (`User`) — it fills both the **Owner** and the
**Sales Team** pickers, and every person has a role:

| Role | Can |
| --- | --- |
| **Super Admin** | everything, incl. **People & Roles** (add users, set roles, reset passwords) |
| **Admin** | all records + config (statuses/sources/stages), **permanently delete** leads, reassign Owner |
| **Manager** | see & edit **all** records, assign/convert, manage **Territories**, delete deals, reassign Owner |
| **Sales** | only records they **own or are the Sales Team member for**; create & work them, convert; **cannot** change Owner, delete, or see others' records |

Enforced in `src/lib/rbac.ts` — route handlers scope every list query
(`leadScopeWhere` / `dealScopeWhere`), check record ownership, and gate
owner-reassignment, hard-delete, territory and people management. The dashboard
is scoped the same way. New people log in with a temporary password and are
forced to `/change-password` on first sign-in.

**Everyone logs in with `Welcome@123` and is forced to set a new password on
first sign-in:**

| Person | Email | Role |
| --- | --- | --- |
| Abhishek Jha | `abhishek.jha@synexc.com` | Super Admin |
| Akash Adlakha | `akash.adlakha@synexc.com` | Admin |
| Tarun Shergill, Manchit, Sambhav Arora, Sachin, Tanshiq, Ishita, Apoorv | `<name>@synexc.com` | Sales |

A new lead's **Owner defaults to whoever created it** (leave the Owner field
blank on the Add Lead form). Only Super Admin / Admin see everyone's records;
Sales users see only leads/deals they own or are the Sales Team member for.

Built with Next.js 14 (App Router) · TypeScript · PostgreSQL · Prisma · Zod.
No external CRM, no message queue, no microservices — a clean modular monolith.

---

## Quick start

Prerequisites: **Node.js 20+**, **PostgreSQL 14+** running locally (or a
connection string to one), and npm.

```bash
# 1. install
npm install

# 2. configure
cp .env.example .env            # then edit DATABASE_URL + JWT_SECRET

# 3. create the schema + seed data (statuses, sources, 3 users, ~45 leads)
npm run db:migrate              # creates tables via a real migration
npm run db:seed

# 4. run
npm run dev                     # http://localhost:3000
```

Sign in at `http://localhost:3000/login`:

| Role    | Email              | Password       |
| ------- | ------------------ | -------------- |
| Admin   | `admin@crm.local`  | `Admin@12345`  |
| Manager | `manager@crm.local`| `Manager@123`  |
| Agent   | `agent@crm.local`  | `Agent@1234`   |

Public lead form (no login): `http://localhost:3000/public/lead-form`

---

## Scripts

| Command              | What it does                                       |
| -------------------- | ------------------------------------------------- |
| `npm run dev`        | Start the dev server                              |
| `npm run build`      | `prisma generate` + production build              |
| `npm start`          | Run the production build                          |
| `npm run db:migrate` | Create/apply a dev migration                      |
| `npm run db:deploy`  | Apply migrations in production (no prompts)       |
| `npm run db:seed`    | Seed statuses, sources, users, sample leads       |
| `npm run db:reset`   | Drop, re-migrate and re-seed (destructive)        |
| `npm run db:studio`  | Open Prisma Studio                                |
| `npm test`           | Run unit tests (no database required)             |
| `npm run typecheck`  | `tsc --noEmit`                                    |

---

## How the "one source of truth" rule is enforced

```
Admin "Add Lead"  ──►  POST /api/leads ───────┐
                                              ├──►  LeadService.createLead()  ──►  Prisma  ──►  ONE "Lead" table
Public form       ──►  POST /api/public/leads ┘            │
                                                           ├─►  AuditService  (AuditLog row)
                                                           └─►  Event bus  ──►  GET /api/events (SSE)  ──►  Dashboard refetches
```

- `/api/public/leads` and `/api/leads` **call the same `LeadService`** — the
  public route only differs by: no auth, rate limiting, honeypot check, a
  restricted field set, and `source` forced to `public_form`.
- The public form **never touches the database** — it only does `fetch()`.
- Every dashboard number is a **live aggregate query** against that one table
  (see `src/domain/dashboard`). Nothing is hard-coded or cached beyond a 15s
  status-list cache.

## Dashboard auto-sync (three layers)

1. **SSE** (`/api/events`) pushes `lead.*` events the instant a lead changes →
   the dashboard refetches.
2. If SSE is unavailable or drops, the client **polls** every
   `NEXT_PUBLIC_DASHBOARD_POLL_MS` (default 30s).
3. It also refetches on **tab focus / visibility change**, and immediately
   **after any mutation the user performs**.

A lead is never lost if the realtime channel fails — it is committed to the
database first; the event is fire-and-forget.

## Territory-based auto-assignment

**Territories** (`/territories`, admin/manager) map a technical member to a
`city` / `state` / `country`. When a lead is created (public form *or* admin)
**with no technical member picked**, its location is matched against the rules
and the lead is auto-assigned to the covering member — who then gets the
"lead assigned to you" email automatically.

- Most specific rule wins: **city (4) > state (2) > country (1)**; ties broken
  by a per-rule priority number.
- An explicitly chosen technical member is never overridden.
- Also runs on **update** if a lead's location changes while it has no member.
- Every auto-assignment is in the audit trail (`LEAD_TECH_ASSIGNED`,
  `metadata.auto = true`, `by = territory`).
- Pure matcher (`src/domain/team/territory.match.ts`) is unit-tested.

Seed ships one rule per member (Indian states) plus a Bengaluru city rule.

## Public form: automatic location capture

When the public form opens, it calls `GET /api/public/geo`, which looks up the
visitor's IP address with a geo-IP provider (`ipwho.is` by default — free, no
API key) and returns an approximate `{ city, state, country, postalCode }`. The
form pre-fills those fields; the visitor can edit or clear them. The values are
stored on the lead (`Lead.city/state/country/postalCode`) and shown in the
Leads list ("Location" column), the lead detail page, and the CSV export.

- No browser permission prompt (it's IP-based, not GPS).
- **Approximate** — city/state is right ~50–75% of the time; VPNs/mobile skew it.
- Localhost / private IPs return nothing. In dev, force one with
  `GET /api/public/geo?ip=8.8.8.8` (query param ignored in production).
- Toggle with `GEOIP_ENABLED`; change provider with `GEOIP_PROVIDER_URL`
  (response parser expects the `ipwho.is` field names).

## Lead → Deal conversion (Account + Contact + Deal)

Once a lead's status is a **converted** status (`LeadStatus.isConverted`), the
lead detail page shows a **Convert to deal** panel. Converting (one-way, once):

1. finds or creates an **Account** (from the lead's company, or a name you pick,
   or an existing account),
2. creates a **Contact** for the lead's person under that account,
3. optionally creates a **Deal** (amount, pipeline stage, expected close date,
   owner) linked back to the lead (`Deal.sourceLead`),
4. stamps `Lead.convertedAt` and links the account / contact / deal; the panel
   then shows those links instead of the form.

The lead's **owner**, **technical member**, and **location**
(`city / state / country / postalCode`) are copied onto the new Account,
Contact **and** Deal. (An *existing* account you pick is left untouched.)

All of this happens in one transaction (`src/domain/leads/lead.convert.ts`).
Deal stages are configurable (`DealStage` table, seeded: Qualification →
Needs Analysis → Proposal → Negotiation → Closed Won / Closed Lost).

The **Deals** and **Accounts** modules (list / detail / edit, inline stage
change, pipeline value) live at `/deals` and `/accounts`. The dashboard gains a
**Deal pipeline** card (value per stage, open vs won, win rate).

## Email notifications (technical-team assignment)

When a lead is assigned (or reassigned) to a technical member, that member is
emailed at the address on their `TechnicalMember` record. This is a subscriber
on the same event bus the dashboard uses — it never blocks or breaks the lead
write.

| `MAIL_TRANSPORT` | Behaviour |
| ---------------- | --------- |
| `console` (default) | prints the email to the server console — no setup, good for dev |
| `smtp`            | real delivery via `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` |
| `off`             | notifications disabled |

Set member emails in `prisma/seed.ts` (then `npm run db:seed`) or live in
`npm run db:studio`. A member with no email is skipped with a console warning.
For a real inbox, use any SMTP provider (e.g. a Gmail app password, SendGrid,
Mailgun, Amazon SES) — set `MAIL_TRANSPORT=smtp` and the `SMTP_*` vars.

## Configurable behaviour (`.env`)

| Var                     | Purpose                                                        |
| ----------------------- | ------------------------------------------------------------- |
| `DUPLICATE_STRATEGY`    | `allow` \| `flag` (default) \| `reject` \| `update`          |
| `DUPLICATE_MATCH_FIELDS`| `email,phone` — which fields identify a duplicate            |
| `PUBLIC_RATE_LIMIT` / `PUBLIC_RATE_WINDOW_MS` | Public endpoint throttle per IP        |
| `REQUIRE_CONSENT`       | Force the consent checkbox on the public form                |
| `CORS_ORIGIN`           | Origins allowed to call `/api/public/leads`                  |

Statuses and sources are **data, not code** — edit the `LeadStatus` /
`LeadSource` tables (or `prisma/seed.ts`). Logic reads the `isDefault`,
`isConverted`, `isLost` flags; no status string is hard-coded anywhere.

---

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/API.md`](docs/API.md),
and [`docs/TESTING.md`](docs/TESTING.md).
