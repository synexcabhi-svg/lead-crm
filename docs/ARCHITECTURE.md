# Architecture

## Style

A **modular monolith**. One Next.js process serves the admin UI, the public
form, and every API route. No queue, no worker, no second service.

```
src/
  config/       env.ts               centralized env + parsed config
  lib/          prisma, auth, http, events, rate-limit, cors, client
  domain/                            business logic (framework-agnostic)
    leads/      schema (zod) · repository (prisma) · service · dedupe · constants · errors
    statuses/   status.service       configurable status/source lists (DB-backed, cached 15s)
    audit/      audit.service        append-only AuditLog writer
    dashboard/  dashboard.service    live aggregate queries  ·  dashboard.math (pure)
  app/
    api/                             thin HTTP handlers -> domain services
    (admin)/                         authenticated UI (dashboard, leads)
    public/lead-form/                anonymous UI
    login/
  middleware.ts                      edge auth gate
```

### Layering (strict, one direction)

```
route handler / server component
        │  (parse input, auth)
        ▼
   domain service        LeadService, DashboardService, StatusService, AuditService
        │
        ▼
   repository             LeadRepository  ── the only place Prisma queries the Lead table
        │
        ▼
   Prisma / PostgreSQL
```

UI and routes never import Prisma for leads directly — they go through
`LeadService` / `LeadRepository`. This is what guarantees a single write path.

## Request flows

### Create a lead (both entry points)

```
POST /api/leads            (admin, authed)          POST /api/public/leads   (anonymous)
   │  zod: leadAdminSchema                             │  rate limit + honeypot
   │                                                   │  zod: leadPublicSchema, source = public_form
   └───────────────┬───────────────────────────────────┘
                   ▼
        LeadService.createLead(input, { actor, origin })
                   │  resolve defaults (status/source/priority)
                   │  assert FK refs exist (status, source, owner)
                   │  DUPLICATE_STRATEGY -> resolveDuplicateAction()
                   │      allow  -> create
                   │      flag   -> create, isDuplicate=true, duplicateOfId=<original>
                   │      reject -> throw 409 DuplicateLeadError
                   │      update -> merge new non-empty fields into original, no new row
                   ▼
        LeadRepository.createLead()  ──►  INSERT into "Lead"
                   ▼
        AuditService.recordAudit(LEAD_CREATED)
                   ▼
        emitLeadEvent("lead.created")  ──►  bus  ──►  /api/events SSE  ──►  dashboards refetch
```

### Update a lead

`PATCH /api/leads/:id` → `LeadService.updateLead()` diffs every field, writes
one `AuditLog` row per change (status change → `LEAD_STATUS_CHANGED`, owner
change → `LEAD_ASSIGNED`), and emits the most specific event type.

### Dashboard sync

```
Dashboard (client component)
   ├─ SSR first paint from DashboardService.getEverything()  (correct on load, no matter how stale)
   ├─ EventSource /api/events   -> on any lead.* -> refetch the 5 dashboard endpoints
   ├─ setInterval poll (NEXT_PUBLIC_DASHBOARD_POLL_MS)  -> used whenever SSE is down
   └─ visibilitychange / focus  -> refetch
```

`src/lib/events.ts` is a single-process `EventEmitter` kept on `globalThis`
(survives HMR). To scale horizontally, replace that module with Redis pub/sub —
nothing else changes.

### Email notifications

`src/domain/notifications/` is a second subscriber on the same bus.
`register.ts` (imported for its side effect by `LeadService`, so it only loads
in the Node runtime — nodemailer never reaches the Edge bundle) attaches
`notifyOnLeadEvent`, which on `lead.tech_assigned` / `lead.created` looks up the
assigned `TechnicalMember` and emails them via `src/lib/mailer.ts`
(`MAIL_TRANSPORT` = `console` | `smtp` | `off`). A `globalThis` dedupe map makes
each event send at most one mail; failures are logged, never re-thrown.

## Auth & RBAC

- `POST /api/auth/login` verifies against `User` (bcrypt), issues a JWT
  (`jose`, HS256, 7d) in an **httpOnly, SameSite=Lax** cookie. The token also
  carries `mcp` (mustChangePassword); middleware redirects such users to
  `/change-password` until they set a new one.
- **One `User` table** is the whole people list - it feeds the Owner and Sales
  Team pickers (`/api/meta` returns the same array for both) and carries the
  role. `TechnicalMember` was merged into it (migration
  `20260909090000_unify_people_rbac`).
- `src/lib/rbac.ts`: roles `SUPER_ADMIN > ADMIN > MANAGER > SALES` with a rank
  helper and `can.*` capability checks. `leadScopeWhere(user)` /
  `dealScopeWhere(user)` return a Prisma `where` fragment (`{}` for Manager+,
  `{ OR: [{ownerId: me}, {technicalMemberId: me}] }` for Sales) that the list
  repositories `AND` into their query; `ownsRecord` / `assertOwnsRecord` guard
  single-record reads and writes. Route handlers own the checks - services stay
  role-agnostic. `permissionFlags(user)` is handed to client components so the
  UI hides what the role can't do.
- `src/middleware.ts` (Edge) verifies the cookie for `/dashboard`, `/leads`,
  `/api/leads*`, `/api/dashboard*`, `/api/events`, `/api/meta` — redirect to
  `/login` for pages, `401 JSON` for APIs.
- Route handlers call `requireUser()` / `requireRole()` as defence in depth.
- Roles: `ADMIN` (hard delete), `MANAGER`, `AGENT`.

## Lead → Deal conversion

`src/domain/leads/lead.convert.ts` runs one `prisma.$transaction`:
find-or-create **Account** (by name, case-insensitive) → create **Contact**
(the lead's person) → optionally create **Deal** (`Deal.sourceLeadId` links it
back) → stamp `Lead.convertedAt` + `convertedAccountId` / `convertedContactId`
→ write `LEAD_CONVERTED` + `DEAL_CREATED_FROM_LEAD` audit rows. The lead's
`ownerId`, `technicalMemberId` and location (`city/state/country/postalCode`)
are copied onto all three records (Account, Contact, Deal) - a freshly created
account only; an existing one the caller selects is not modified. After commit it
emits `lead.converted` and `deal.created`. Guards: lead not archived, status
`isConverted`, not already converted (`409`). The pure name-resolution helpers
(`resolveAccountName`, `resolveDealName`) are unit-tested.

## Territory auto-assignment

`Territory` rows map a `TechnicalMember` to a `city`/`state`/`country`.
`src/domain/team/territory.match.ts` is a pure function: score each matching
rule (`city 4 + state 2 + country 1`), highest wins, ties broken by
`sortOrder`. `LeadService.createLead` calls it when the caller set no
`technicalMemberId` and the lead has a location; `updateLead` calls it when the
location changes and the lead is still unassigned. The resulting assignment
flows through the normal `lead.created` / `LEAD_TECH_ASSIGNED` path, so the
member gets the existing assignment email for free.

`DealStage` is the Deal analogue of `LeadStatus` — configurable rows with
`isWon` / `isLost` / `isDefault` flags; `DealService` reads those, never a
hard-coded key. Moving a deal into a won/lost stage sets `closedAt`.

## Data model

`User`, `Lead`, `LeadStatus`, `LeadSource`, `TechnicalMember`, `Account`,
`Contact`, `DealStage`, `Deal`, `AuditLog` — see `prisma/schema.prisma`.
`AuditLog` rows carry an optional `leadId` **or** `dealId`. Key points:

- `Lead.id` is a `cuid()` primary key — globally unique.
- Indexes on `statusKey, sourceKey, ownerId, email, phone, createdAt,
  isArchived` and a composite `(isArchived, statusKey)` for the common list
  and dashboard filters.
- `email` is **not** unique — duplicates are a business decision
  (`DUPLICATE_STRATEGY`), not a DB constraint.
- Archived leads (`isArchived=true`) are excluded from every dashboard metric
  and from the default list view.
- `AuditLog` rows survive lead deletion (`leadId` set to null).
