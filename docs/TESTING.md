# Testing

## Automated (no database needed)

```bash
npm test
```

| File                            | Covers                                                       |
| ------------------------------- | ---------------------------------------------------------- |
| `tests/dedupe.test.ts`          | duplicate resolver — all 4 strategies, phone/email matching |
| `tests/lead-schema.test.ts`     | shared Zod validation (public / admin / update)             |
| `tests/dashboard-math.test.ts`  | conversion-rate + open-count math                           |

These exercise the pure business logic that the API and both forms depend on.

## Manual / integration checklist

Run against a seeded dev database (`npm run db:reset`). Note the "Total leads"
number on the dashboard before each scenario.

### 1. Manual lead → dashboard
1. Sign in as admin. Dashboard shows total = **N**.
2. Leads → Add Lead → fill firstName + email → Create.
3. `GET /api/dashboard/summary` (or watch the dashboard tab): total = **N+1**
   within a second (SSE) — no manual refresh.
4. Prisma Studio / `GET /api/leads/:id`: the row exists with `source = manual`,
   `status = new`, and an `AuditLog` row `LEAD_CREATED`.

### 2. Public form → same DB → dashboard
1. Open `/public/lead-form` in a **logged-out** browser. Submit name + email.
2. Success message shown; no DB error.
3. Admin dashboard total → **+1** automatically.
4. The new lead has `source = public_form`, `ipAddress` set, and appears in the
   **same** `/leads` list as manual leads.

### 3. Lead update sync
1. Open the dashboard in tab A, a lead in tab B.
2. In tab B change status `New → Qualified`.
3. Tab A: "Leads by status" and the KPIs update within ~1s.
4. The lead's audit trail shows `LEAD_STATUS_CHANGED  statusKey: new → qualified`.

### 4. Duplicate handling
- `DUPLICATE_STRATEGY=flag` (default): submit the same email twice → two rows,
  the second has `isDuplicate=true` and links to the first (shown on the detail
  page).
- Set `reject`, restart, resubmit → `409` with the existing lead id.
- Set `update`, restart, resubmit with a new phone → no new row; the original
  lead gains the phone; audit shows `LEAD_MERGED`.

### 5. Multi-user realtime
1. Dashboard open as admin (browser 1) and as agent (browser 2).
2. Browser 2 creates a lead.
3. Browser 1 updates automatically.

### 6. Realtime failure fallback
1. Open the dashboard, confirm the indicator says **Live**.
2. Block `/api/events` (DevTools → Network → block request URL) and reload.
3. Indicator shows **Auto-refresh**; create a lead elsewhere.
4. The lead is still saved (check `/leads`), and the dashboard catches up on
   the next poll (≤ `NEXT_PUBLIC_DASHBOARD_POLL_MS`).

### 7. Security
- `curl -i localhost:3000/api/leads` (no cookie) → `401`.
- `curl -i localhost:3000/api/dashboard/summary` (no cookie) → `401`.
- Hard delete as a non-admin: `DELETE /api/leads/:id?hard=true` while signed in
  as the agent → `403`.
- Hammer `POST /api/public/leads` > `PUBLIC_RATE_LIMIT` times from one IP →
  `429`.
- Submit the public form with the hidden `website` field populated (simulating
  a bot) → request is accepted with `201` but **no lead is created**.
