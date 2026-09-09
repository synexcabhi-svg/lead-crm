# API reference

All responses are JSON. Success: `{ "data": ... }`. Error:
`{ "error": { "message": string, "details"?: any } }`.
Validation failures return **422** with `details.fieldErrors`.

Auth is via the `crm_session` httpOnly cookie (set by `POST /api/auth/login`).

---

## Auth

### `POST /api/auth/login`
Body `{ email, password }` → `200 { data: { id, email, name, role } }` and sets
the session cookie. `401` on bad credentials.

### `POST /api/auth/logout`
Clears the cookie. `200`.

### `GET /api/auth/me`
`200 { data: { id, email, name, role } }` or `401`.

---

## Leads (authenticated)

### `GET /api/leads`
Query params (all optional):

| param      | default    | notes                                                        |
| ---------- | ---------- | ----------------------------------------------------------- |
| `page`     | `1`        |                                                            |
| `pageSize` | `20`       | max `100`                                                   |
| `q`        | —          | matches firstName / lastName / email / phone / company     |
| `status`   | —          | status key                                                 |
| `source`   | —          | source key                                                 |
| `owner`    | —          | user id, or `unassigned`                                    |
| `tech`     | —          | technical member id, or `unassigned`                       |
| `priority` | —          | `LOW`\|`MEDIUM`\|`HIGH`\|`URGENT`                           |
| `archived` | `false`    | `false` \| `true` \| `all`                                  |
| `sortBy`   | `createdAt`| `createdAt`,`updatedAt`,`firstName`,`lastName`,`company`,`statusKey`,`priority` |
| `sortDir`  | `desc`     | `asc` \| `desc`                                             |

→ `200 { data: { items, total, page, pageSize, totalPages } }`

### `POST /api/leads`
Body = `leadAdminSchema` (`firstName` required; `email` **or** `phone`
required; optional `lastName, company, message, notes, priority, statusKey,
sourceKey, ownerId, technicalMemberId`). → `201 { data: { lead, deduped: "created"|"flagged"|"merged" } }`.
`409` if `DUPLICATE_STRATEGY=reject` and a match exists.

### `GET /api/leads/:id`
→ `200 { data: { lead, audit } }` · `404` if not found.

### `PUT` / `PATCH /api/leads/:id`
Body = `leadUpdateSchema` (any subset of the writable fields, plus
`isArchived`). Each changed field is written to the audit trail and emits a
realtime event. → `200 { data: { lead } }`.

### `DELETE /api/leads/:id`
Default: **archive** (`isArchived=true`) → `200 { data: { archived, lead } }`.
`?hard=true`: permanent delete, **ADMIN only** → `200 { data: { deleted, id } }`.

### `GET /api/leads/export`
Same query params as the list. Returns `text/csv` (max 5000 rows).

---

### `POST /api/leads/:id/convert`
Convert a lead (must be in an `isConverted` status, not already converted) into
an Account + Contact + optional Deal. Body (`convertLeadSchema`, all optional):
`accountId` (use existing) **or** `accountName` (create new; defaults to the
lead's company / name), `createDeal` (default `true`), `dealName`, `amount`
(int), `stageKey`, `expectedCloseDate` (YYYY-MM-DD), `ownerId` (defaults to the
lead's owner). → `200 { data: { accountId, accountCreated, contactId, deal } }`.
`409` if already converted, `400` if the lead's status is not a converted one.

---

## Deals (authenticated)

| Method & path | Purpose |
| ------------- | ------- |
| `GET /api/deals` | list — `page,pageSize,q,stage,account,owner,tech,open(true\|false\|all),sortBy,sortDir`; response includes `totalAmount` |
| `POST /api/deals` | create (`dealCreateSchema`: `name`,`accountId` required) |
| `GET /api/deals/:id` | deal + audit trail |
| `PUT` / `PATCH /api/deals/:id` | update (any subset; moving to a won/lost stage sets `closedAt`) |
| `DELETE /api/deals/:id` | delete — ADMIN / MANAGER only |
| `POST /api/deals/:id/contacts` | link a contact to the deal — `{ contactId, role? }` (contact must belong to the deal's account) |
| `DELETE /api/deals/:id/contacts/:contactId` | unlink a contact from the deal |

On conversion the new Contact is auto-linked to the Deal as `isPrimary` with
role `"Primary"`. `city/state/country/postalCode` are valid fields on
`POST/PATCH /api/deals`.

## People / roles (Super Admin only)

| Method & path | Purpose |
| ------------- | ------- |
| `GET /api/users` | list all people (name, email, role, colour, active) |
| `POST /api/users` | add a person — `{ name, email, role, color?, tempPassword }`; forced to change password on first login |
| `PATCH /api/users/:id` | change `name` / `role` / `color` / `isActive`, or `{ resetPassword }` |

### `POST /api/auth/change-password`
`{ newPassword }` (plus `currentPassword` unless it's a forced first-login
change). Re-issues the session cookie.

## RBAC on the other endpoints

- `GET /api/leads`, `/api/deals`, `/api/leads/export`, and every
  `/api/dashboard/*` are **scoped**: Sales users get only records they own or
  are the Sales Team member for; Manager and above get everything.
- `GET/PATCH/PUT /api/leads/:id` and `/api/deals/:id` return `403` for a Sales
  user who is not on the record; changing `ownerId` needs Manager+.
- `DELETE /api/leads/:id?hard=true` needs Admin+. `DELETE /api/deals/:id` needs
  Manager+.
- `/api/territories*` needs Manager+.

## Territories (authenticated)

| Method & path | Purpose |
| ------------- | ------- |
| `GET /api/territories` | list all routing rules (with member) |
| `POST /api/territories` | add a rule — `technicalMemberId` + at least one of `city`/`state`/`country`, optional `sortOrder`. ADMIN / MANAGER only |
| `DELETE /api/territories/:id` | remove a rule. ADMIN / MANAGER only |

Rules are applied by `LeadService` on lead create/update when no technical
member is set — see the Territory-based auto-assignment section in the README.

## Accounts (authenticated)

| Method & path | Purpose |
| ------------- | ------- |
| `GET /api/accounts` | list — `q,page,pageSize` |
| `POST /api/accounts` | create (`name` required) |
| `GET /api/accounts/:id` | account + its contacts + deals |
| `PATCH /api/accounts/:id` | update |

## Public (no auth)

### `POST /api/public/leads`
CORS-enabled (`CORS_ORIGIN`). Rate-limited per IP
(`PUBLIC_RATE_LIMIT` / `PUBLIC_RATE_WINDOW_MS`). Body = `leadPublicSchema`
(`firstName` + (`email` | `phone`); optional `lastName, company, message,
consent`; hidden honeypot `website` must be empty).

→ `201 { data: { ok: true, id } }` · `422` validation · `429` rate limited.

Internally calls the **same** `LeadService.createLead` as `POST /api/leads`,
with `source = public_form` and `actor = public-form`. The body may also carry
`city`, `state`, `country`, `postalCode` (the form pre-fills these from
`/api/public/geo`).

### `GET /api/public/geo`
No auth, CORS-enabled, rate-limited (30 / 5 min / IP). Looks up the caller's IP
and returns `{ data: { geo: { city, state, country, postalCode } | null } }`.
`null` for localhost / private IPs or on any provider error. Dev-only:
`?ip=<addr>` overrides the source IP.

---

## Dashboard (authenticated) — every value is a live query

| Endpoint                             | Returns                                                        |
| ------------------------------------ | ------------------------------------------------------------- |
| `GET /api/dashboard/summary`         | totals, open/converted/lost, today/week/month, conversionRate, byStatus[] |
| `GET /api/dashboard/leads-by-status` | `[{ key, label, color, count }]`                              |
| `GET /api/dashboard/leads-by-source` | `[{ key, label, count }]`                                     |
| `GET /api/dashboard/leads-by-owner`  | `[{ ownerId, name, count, pct }]`                             |
| `GET /api/dashboard/leads-by-technical-member` | `{ total, unassigned, members: [{ technicalMemberId, name, count, pct }] }` |
| `GET /api/dashboard/recent-leads?limit=` | latest leads with status/source/owner                     |
| `GET /api/dashboard/conversion`      | converted/lost/open/total, conversionRate, `byMonth[]` (6 mo) |
| `GET /api/dashboard/pipeline`        | deal value + count per stage, openValue, wonValue, winRate    |

## Realtime

### `GET /api/events` (authenticated, `text/event-stream`)
Emits `data: {"type":"connected",...}` on open, then
`data: {"type":"lead.created"|"lead.updated"|"lead.status_changed"|"lead.assigned"|"lead.archived"|"lead.deleted", "leadId", "at", "actor", "changed"?}`
per change, plus `: ping` heartbeats every 25s.

## Meta

### `GET /api/meta` (authenticated)
`{ statuses, sources, owners, technicalMembers, priorities }` for form
dropdowns and filters.
