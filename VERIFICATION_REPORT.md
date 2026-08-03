# VERIFICATION_REPORT.md — full-app E2E verification

**Date:** 2026-07-30 · live API `https://euroflowers.api.cognilabs.org`
**Status:** Phase 1 (seed) + Phase 3 (chart audit) complete — **PAUSED for review before page-by-page (Phase 2/4/5)**.

---

## PHASE 1 — SEEDED DATASET (all `ZZZ_TEST_` prefixed)

### ⚠️ API back-dating capability (discovered first — it shapes everything)
A 14-day spread is only **partially possible** — most "activity" timestamps are server-stamped to *now* and are **not writable**:

| Field | Endpoint | Back-datable? | Effect on charts |
|---|---|---|---|
| `received_at` | stock-batches | ✅ yes | batch age / wilt alerts span days |
| `paid_at` | supplier-payments | ✅ yes | payment dates span days |
| `work_date` | florist-salary | ✅ yes | **FloristStats by_day spans days** |
| `check_in_at`/`work_date` | florist-attendance | ✅ yes | attendance spans days |
| `sold_at` | catalog `/sell/` | ❌ **ignored** (stamped today) | daily revenue = today only |
| `created_at` | stock-movements (waste) | ❌ **ignored** (stamped today) | waste trend = today only |
| `created_at` | leads | ❌ not writable | daily activity = today only |

**Consequence:** the daily **revenue / activity / conversion / AOV / waste** charts **cannot be spread across days by seeding** — seeded sales/waste/leads all land on 2026-07-30. Only **FloristStats `by_day`** (work_date) can be proven multi-day. Real historical trends need real historical data.

Other API limits found: **`/api/material-movements/` is read-only (POST → 405)** — material movements can't be seeded (materials carry an initial `quantity` only); florist-attendance enforces `unique(florist, work_date)`.

### Created records (ids)
- **Suppliers (3):** #17 `ZZZ_TEST Gul Import` (fully paid), #18 `ZZZ_TEST Flora Optom` (partial), #19 `ZZZ_TEST Dala Savdo` (unpaid).
- **Payments (5):** A → 8 000 000 (transfer, -12d) + 7 000 000 (card, -8d) + 6 800 000 (cash, -3d) = **21 800 000** (= purchase, outstanding 0). B → 3 000 000 (cash, -9d) + 2 000 000 (transfer, -4d) = 5 000 000 (partial). C → none.
- **Batches (7):** #43 B1 (Atirgul Jumila, -2d, 400st), #44 B2 (Gortenziya Kolumbia, **-10d wilt**, 300st), #45 B3 (sprey oq, -5d, 225st), #46 B4 (Gortenziya Golland, **-12d wilt, bunches-only** 8×30=240st), #47 B5 (Atirgul prut, -1d, **10st low-stock** min 8), #48 B6 (sprey puwti, -7d, 150st), #49 B7 (Atirgul Jumila, today, 500st).
- **Materials (4):** #26 wrap, #27 basket, #28 box, #29 other (movements NOT seeded — endpoint read-only).
- **Customers (3):** #199 Dilnoza, #200 Sardor, #201 Malika (repeat — 2 leads).
- **Leads (4):** instagram / mini_app / manual / instagram; 2 with `desired_date`=today. (created_at=today — not spreadable.)
- **Catalog (4):** #54 Klassik Buket (std, qty3, 2 flowers + wrap, sold 2), #55 Katta Savat (std, qty1, 2 flowers + basket, sold 1 **discounted 2.2M→2.0M**), #56 Maxsus Kichik (**custom**, auto-sold 1), #57 Quti Nafis (std, qty2, 2 flowers + box, unsold).
- **Salary (6):** 2 florists × {daily -11d, manual -7d, daily -3d}. **Attendance (9):** 2 florists × 5 days (1 dup skipped).
- Full ids + payloads: `scratchpad/seed_ids.json`.

### Live reconciliation of the seed (accounting, range 07-16…07-30 inclusive)
```
total_sales 6 700 000  (Katta Savat 2.0M + Klassik 1.8M + Maxsus 0.6M + ProbeCat 0.8M + mm 1.5M)
cost split  flower 2 474 000 + material 50 000 + fee 260 000 = 2 784 000  === cost_total
net_profit  6 700 000 − 2 784 000 = 3 916 000  ✓ matches server
```
Supplier A rollup: purchase 21 800 000, paid 21 800 000, **outstanding 0** ✓. FloristStats Σ by_day = **224 000 == salary_total** ✓.

---

## PHASE 3 — CHART AUDIT

Legend: **REAL-BE** = backend returns the daily series · **CLIENT** = frontend derives per-day · gap-fill = point for every day in range.

| # | Chart (page) | Series source (endpoint.field) | Daily = real or derived | Gap-fills empty days? | Σ points == headline? | Verdict |
|---|---|---|---|---|---|---|
| 1 | **Kunlik daromad** (Analitika) | `analytics.daily_stats[].revenue` | REAL-BE | ✅ every day | Σ=0 == summary.revenue 0 — **but neither reflects catalog sales** | ❌ **wrong metric** |
| 2 | Kunlik faollik (Analitika) | `daily_stats[].{leads,conversations,orders}` | REAL-BE | ✅ | Σ leads 4 == summary.leads 4 ✓ | ✅ (trailing-day caveat) |
| 3 | Konversiya trendi (Analitika) | CLIENT: `daily orders/leads` | CLIENT-derived | ✅ (inherits daily_stats) | orders=0 → flat 0 | ⚠️ meaningless (orders always 0) |
| 4 | O'rtacha chek trendi / AOV (Analitika) | CLIENT: `daily revenue/orders` | CLIENT-derived | ✅ | revenue=0 & orders=0 → flat 0 | ❌ meaningless (built on the dead revenue series) |
| 5 | Chiqit foizi trend (Analitika) | CLIENT: `stock-movements.cost_value` bucketed by `created_at` | CLIENT-bucketed | ❌ only days with waste | server cost_value sums OK | ⚠️ **can't span days** (movement created_at=today) |
| 6 | Kunlik faollik / revenue share HBars, top flowers/catalog, arrangement, volume, conv-sources, revenue-by-source (Analitika) | various `analytics.*[]` aggregates | REAL-BE (not daily) | n/a | — | ⚠️ `top_catalog_items` & `revenue_by_source` **empty despite 6.7M sales** (won-lead based) |
| 7 | Buyurtmalar oqimi (Dashboard) | `dashboard.lead_pipeline[].count` | REAL-BE | n/a | — | ✅ |
| 8 | Yangi vs qaytgan (Dashboard) | CLIENT: period leads `customer_detail.leads_count` | CLIENT | n/a | — | ✅ |
| 9 | Manba bo'yicha (Dashboard) | CLIENT: period leads `source` | CLIENT | n/a | — | ✅ |
| 10 | Xarajatlar COGS bar (Hisob-kitob §4) | `accounting.summary.{flower,material,fee}_cost_total` | REAL-BE | n/a | flower+mat+fee == cost_total ✓ | ✅ |
| 11 | **FloristStats by_day** (Floristlar detail) | `florists/{id}/stats.by_day[]` (work_date) | REAL-BE, **multi-day works** | ❌ **active days only** | Σ amount == salary_total ✓ | ⚠️ **DailyChart plots by index → sparse dates mis-spaced** |
| 12 | FloristStats by_source bars / by_volume / by_arrangement | `stats.by_*` | REAL-BE | n/a | — | ✅ |

### Chart-audit answers to your 7 questions
1. **Sources:** table above (exact field paths).
2. **Real vs invented:** #3/#4 (conversion, AOV) and #5 (waste) are **client-derived**; the client invents the per-day AOV/conversion by dividing daily_stats fields, and buckets waste by movement `created_at`. #1/#2/#7/#10/#11/#12 are backend series.
3. **Missing days:** `analytics.daily_stats` **gap-fills every day** (verified: 15 contiguous rows 07-16…07-30) — no x-axis compression. **FloristStats `by_day` does NOT gap-fill** (returns only active days) and `DailyChart` positions points by array index, so 07-19→07-23→07-24 render at equal spacing — **the line lies about time gaps**. (Fixable frontend-side: gap-fill by_day to the full range before charting.)
4. **Sums:** FloristStats Σ by_day == salary_total ✓. analytics Σ daily leads == summary.leads ✓. **Σ daily revenue (0) ≠ real sales (6.7M)** — because daily revenue is lead-order revenue, not catalog sales (see BUG-1).
5. **Timezone:** sale timestamps return UTC (`…Z`); a Tashkent-midnight boundary **could not be seeded** (sold_at/created_at not writable) → flagged for backend verification, untestable client-side.
6. **Range / inclusive-exclusive:** analytics `date_to` is **EXCLUSIVE** (07-30 sales dropped at `date_to=07-30`, appear at 07-31) — frontend correctly sends `+1`. **Side effect:** daily_stats then returns a row through `to+1` → charts show a **trailing empty future day** at the right edge (BUG-3). accounting `date_to` is inclusive.
7. **Deltas:** previous-period fetch uses an equal-length window (verified in code); with 0 revenue both periods it shows "yangi"/"— oldingi davr yo'q"; waste delta uses `goodUp=false`. Not re-exercisable with money here (daily revenue is 0).

---

## CRITICAL FINDINGS (money-first)

**BUG-1 (SEV-1, wrong money on the most-seen screens).** Dashboard **"Bugungi savdo" `revenue_today` = 0** and Analitika **"Daromad" `summary.revenue` = 0** while **6.7M was actually sold today** (accounting `total_sales`). These use **lead-pipeline revenue** (won leads' `estimated_price`), not catalog sales. So the owner's headline sales number reads **zero on 2 of 3 pages** for a catalog business.
- *Frontend fix (partial):* switch Dashboard/Analitika headline "savdo" to `catalog_revenue` (both endpoints already return it, period-scoped). Cross-checks then match Hisob-kitob.
- *Backend needed:* a **daily catalog-sales series** (there's none) to make the "Kunlik daromad" chart (#1) and AOV (#4) meaningful, and per-day granularity for "today's sales".

**BUG-2 (SEV-2).** Analitika `top_catalog_items` and `revenue_by_source` are **empty despite real sales** — they're computed from won-leads, not catalog sales. Product-mix and channel-revenue charts under-report. *Backend request: base these on catalog sales, or expose a catalog-sales product breakdown.*

**BUG-3 (SEV-2, chart off-by-one).** Because the frontend sends `date_to+1` (correct for the exclusive summary), `daily_stats` returns a row for `to+1` → every Analitika daily chart shows **one extra empty day at the right edge** (e.g. selecting through 07-30 plots an empty 07-31). *Frontend fix: trim the trailing `to+1` day from `daily_stats` before charting, or stop sending +1 to daily_stats and only +1 the summary.*

**BUG-4 (SEV-3, chart spacing).** FloristStats `by_day` returns only active days; `DailyChart` spaces points by index → non-adjacent dates look adjacent. *Frontend fix: gap-fill by_day across the selected range before passing to DailyChart (same treatment the backend already gives analytics daily_stats).*

**Data limits (not bugs, for the report):** material-movements read-only; sold_at/waste/lead timestamps not back-datable (so daily revenue/waste/activity charts are inherently single-day for any fresh data).

---

## FIXES APPLIED (2026-07-30, frontend)

- **BUG-1 (revenue) — FIXED.** Dashboard headline tile → `catalog_revenue` (label "Savdo (davr)", real catalog sales), with the lead-pipeline number kept as a labeled secondary in the sub ("kutilayotgan: … so'm"). Analitika: "Daromad" tile split into **"Savdo"** (`summary.catalog_revenue`, "haqiqiy katalog sotuvi") + **"Kutilayotgan buyurtmalar"** (`summary.revenue`, "won leadlar summasi"); AOV recomputed as `catalog_revenue / accounting.total_quantity`. **Acceptance test:** Dashboard `catalog_revenue` == Analitika `catalog_revenue` == Hisob-kitob `total_sales` — verified equal (consistent by construction; earlier live data reconciled all three at 6.7M; now all 0 after the seed was externally cleared).
- **Daily revenue chart (#1) + AOV (#4) — FIXED via client derivation.** "Kunlik daromad" renamed **"Kunlik savdo"**; the series is now derived client-side from `accounting.history[]` bucketed by `sold_at` in **Asia/Tashkent (+5)** and gap-filled across the range, and it is **reconcile-gated**: rendered only when `Σ daily == accounting.total_sales` (else "Kunlik savdo ma'lumoti mavjud emas"). AOV trend uses the same reconciled per-day data (else "Ma'lumot mavjud emas"). No more flat-zero line pretending to be revenue while real sales exist. *Reconcile verified true (0==0 now; when sales existed earlier, Σ per-day == total_sales).*
- **BUG-3 (trailing +1 day) — FIXED.** Analitika daily charts now filter `daily_stats` to `date <= to` (the inclusive end), dropping the extra `to+1` future day. Verified: x-axis now ends at 30-iyl, not 31-iyl.
- **BUG-4 (FloristStats by_day spacing) — FIXED.** `FloristStats` now gap-fills `by_day` across `period.date_from…date_to` (0 for empty days) before charting, so `DailyChart` spaces points by real calendar day.
- tsc clean · 17 Vitest pass · no console errors · empty-state render verified (no NaN, honest flat-zero when sales are genuinely zero).

## BUG-1/2/3 RESOLVED BY BACKEND FIELDS (2026-07-30, second pass)

Backend shipped the catalog-sales fields (spec file `FRONTEND_DASHBOARD_CATALOG_REVENUE.md` was **NOT in the repo** — proceeded from the task description + live GET verification).

- **BUG-1 CLOSED.** The earlier fix used `catalog_revenue` (quantity_sold-based). Switched everything to the **accounting-consistent** field: Dashboard "Savdo" → `period_catalog_sales_revenue` (secondary "Kutilayotgan" → `period_lead_revenue`); Analitika "Savdo" → `summary.catalog_sales_revenue`, "Kutilayotgan" → `summary.lead_revenue`; **AOV** → `catalog_sales_revenue / catalog_sales_quantity`. *Note on the trap:* on current live data `catalog_revenue`, `catalog_sales_revenue`, and accounting `total_sales` all equal **5 900 000** (they coincide when items are fully sold and lead revenue is 0), but the semantics differ per spec — switched regardless. Also audited `revenue`/`orders`: they now mean **lead+catalog combined**; every headline uses `catalog_sales_*` (sales) or `lead_*` (pipeline), never the combined field ambiguously.
  **ACCEPTANCE TEST (live):** Dashboard `period_catalog_sales_revenue` = **5 900 000** == Analitika `catalog_sales_revenue` = **5 900 000** == Hisob-kitob `total_sales` = **5 900 000.00** ✓.
- **Daily charts — client derivation DELETED.** Removed the `accounting.history[].sold_at` Tashkent-bucketing and the reconcile-gate. "Kunlik savdo" now plots server `daily_stats[].catalog_revenue` + `lead_revenue` as **two lines**; conversion trend = `catalog_orders / leads`; AOV trend = `catalog_revenue / catalog_quantity`; each chart's sub states the fields. **Σ daily `catalog_revenue` == summary `catalog_sales_revenue` = 5 900 000 ✓.**
- **BUG-2 CLOSED.** `top_catalog_items` populated (6 items) — rebuilt as a rich clickable list (image thumb, name, Standart/Maxsus badge from `catalog_kind`, quantity + `orders` + revenue + "oxirgi: `last_sold_at`", links to `/katalog?item=<catalog_item_id>`). `revenue_by_source` now carries the `catalog` row ("Katalogdan sotuv") — switched to server `source_label`.
- **BUG-3 verdict — trim STILL needed, kept.** Verified live: we send `date_to = to+1` (correct for the exclusive summary), and `daily_stats` then returns a row for `to+1` (last date = 08-01 when we send 08-01; raw `date_to=07-31` → last = 07-31). So the client `date <= to` trim is still required and remains; x-axis correctly ends at the selected end (screenshot confirms 30-iyl, not 08-01).
- **BUG-4 unchanged** (FloristStats `by_day` gap-fill) — endpoint untouched, still works.
- **Section 5** — material writes already use the action endpoint `POST /api/materials/{id}/movement/`; reads use `/api/material-movements/` (200). Correct, no fix.
- tsc clean · Vitest green · no console errors · lib/finance.ts unchanged (the deleted bucketing lived in the page, not finance.ts).

### Untested / deferred under the read-only constraint
- **Section 4 (writable historical timestamps) — NOT implemented this pass.** The SELL-dialog "Sotuv sanasi" belongs to the catalog-customer sell dialog (never built); the movement-drawer "Harakat sanasi" (BatchMovementModal) date input was not added. These are additive; flagged for a follow-up. **Timezone correctness (a 23:30 sale landing on the right day) is now testable — please verify manually once.**
- `top_catalog_items` row → `/katalog?item=<id>`: the Katalog page's deep-link handling for `?item=` is **not wired/verified** — the link lands on the catalog list if unsupported.
- `revenue_by_source`: used `source_label` (correct); a distinct SourceBadge tint for the `catalog` source was not added (HBars doesn't use SourceBadge). Minor.
- Material movement `cost_value`/`sale_value` surfacing in the journal: not added (additive).

## BACKEND REQUEST (ready to forward)

**REQ-1 — daily catalog-sales series.** `/api/analytics/` `daily_stats[]` `revenue`/`orders` track **lead-pipeline** (won-lead `estimated_price`), not catalog sales — so the daily revenue chart has no real backend source and we derive it client-side from `accounting.history[]`. Please add a **per-day catalog-sales series** (e.g. `daily_stats[].catalog_revenue` + `catalog_orders`, bucketed by `sold_at` in Asia/Tashkent, gap-filled to the range) so revenue/AOV charts have an authoritative source. Also: `top_catalog_items` and `revenue_by_source` are won-lead based and read **empty despite real catalog sales** (BUG-2) — please base them on catalog sales (or add catalog-sales variants). Nice-to-have: make `sold_at` writable on `/catalog/{id}/sell/` so historical data can be seeded/imported.

## NEXT (after your review)
Phase 2 (page-by-page field checks), Phase 4 (cross-page consistency — starting from BUG-1), Phase 5 (order-flow/edge/exports/empty-state/themes), Phase 6 (fixes + `ZZZ_TEST_` cleanup in reverse order + baseline restore). I'll fix BUG-1/3/4 (frontend) and forward BUG-1(backend)/BUG-2 as backend requests.

## CUSTOMER ATTACHMENT + LEFTOVERS CLOSED (2026-07-30, third pass)

Spec file `FRONTEND_CATALOG_CUSTOMER_API.md` was **NOT in the repo** (third time a named spec was missing) — proceeded from the OpenAPI schema (`GET /api/schema/?format=json`) + live GET, per the user's explicit allowance. **Strict read-only: no POST/PATCH/DELETE issued against production; all write paths implemented per contract and listed below for manual testing.**

### Contract verified (OpenAPI + GET)
- `CatalogSellRequest` = `[quantity, sale_price, discount_reason, payment_type, sold_at]` — **NO customer fields.** → **Path taken: PATCH `/api/catalog/{id}/` (customer) THEN POST `/sell/`.** PATCH-first so a PATCH failure aborts the sale (no orphaned sale record); a sell failure after a successful PATCH leaves the customer attached and is retryable.
- `CatalogItem` carries `customer`, `customer_name`, `customer_phone`, `customer_detail{id,name,masked_phone}` (read-only detail). Added to `lib/types.ts`.
- Catalog list filters `?customer=`, `?catalog_kind=`, `?florist=`, `search` (name/phone server-side) all exist. **Note:** the old code comment claiming `?florist=` doesn't exist was wrong — florist filter moved from client-side to server-side.
- `sold_at` writable on `/sell/`; `created_at` writable on stock `MovementRequest` and `PackagingMovementRequest`.
- **`cost_value`/`sale_value` live on `StockMovement` (gul batches), NOT on `PackagingMovement` (materials).** The leftover said "material movements journal" but the fields only exist on stock movements — surfaced them in the **gul (stock) movements journal** accordingly.

### Implemented
- **`components/CustomerPicker.tsx`** (new, shared) — 3 modes: Biriktirmayman / Mavjud mijoz (debounced `GET /api/customers/?search=`, name + masked_phone) / Yangi mijoz (Ism + Telefon, sent as typed — no client-side dedup). Exports `customerPayload(pick, hadCustomer)` → `{customer:id}` | `{customer_name,customer_phone}` | `{customer:null}` (clear only when one existed) | null.
- **Sell dialog** (`KatalogSellModal`) — CustomerPicker (pre-selects `customer_detail`), PATCH-then-sell, single busy state, success toast names `customer_detail` (so the operator sees when the backend matched an existing customer by phone). Optional "Boshqa sotuv sanasi" (`sold_at`, only sent when toggled+set).
- **Composer** (`KatalogModal`) — CustomerPicker in a "Mijoz" section; customer merged into create/update payload.
- **Surfacing** — customer chip on catalog cards (click → filter by that customer), in the detail view modal (Mijoz row), and Hisob-kitob §2 (new "Mijoz" column, colspan 8→9). Katalog page: added `catalog_kind` + server-side `florist` + URL-driven `?customer=` filters (with a clearable banner that fetches the customer name), search placeholder → "Nomi, mijoz ismi yoki telefoni…". `?item=<id>` deep link was already wired (confirmed). Customer detail page (`ClientModal`): new "Katalog xaridlari" list (`GET /api/catalog/?customer=<id>`) with "Katalogda ochish" → `/katalog?customer=<id>` and per-item → `/katalog?item=<id>`.
- **Stock movements journal** (`app/sklad/page.tsx`) — surfaced `cost_value`/`sale_value` (Tannarx/Sotuv) in each row's meta line.
- **BatchMovementModal** — optional "Boshqa harakat sanasi" (`created_at`, only sent when toggled+set); added `created_at?` to `api.batchMovement`.
- **Revenue-by-source** (Analitika) — catalog source row now gets a distinct tint (`var(--primary)`) via per-row HBar `color`.

### WRITE PATHS TO TEST MANUALLY (none exercised — read-only)
1. **Sell + existing customer:** open a catalog item → Sotish → "Mavjud mijoz" → search+pick → sell. Expect: PATCH `{customer:<id>}` then POST `/sell/`; toast shows the customer name; chip appears on the card/detail; item shows under that customer's "Katalog xaridlari".
2. **Sell + new customer (phone dedup):** "Yangi mijoz" → type Ism + a phone that ALREADY exists → sell. Expect: backend links the existing customer; toast names that existing customer (masked_phone). Then repeat with a brand-new phone → new customer created + linked.
3. **Sell + clear customer:** on an item that already has a customer → "Biriktirmayman" → sell. Expect PATCH `{customer:null}`; chip disappears.
4. **PATCH-fail isolation:** (hard to force) if the customer PATCH 4xx's, the sale must NOT be sent — verify no quantity_sold change.
5. **Composer create with customer:** new custom item (immediately sold) with a customer → verify the sale is attributed to that customer in Hisob-kitob §2 and the customer page.
6. **Sotuv sanasi / Harakat sanasi:** back-date a sale and a stock movement; verify daily charts and the movement journal place them on the chosen day (Asia/Tashkent).
7. **Filters:** `?customer=`, `?catalog_kind=`, `?florist=`, and name/phone search — confirm server results.

### Verification
- `tsc --noEmit` clean · 17/17 Vitest pass · no new console usage. Screenshots (dark+light) pending manual UI run. Changes uncommitted.

═══════════════════════════════════════════════════════════════════
# BRANCH / PARKENT + FLORIST-STOCK + PER-FLORIST-RATES (Stages 1–4, 2026-07-31)
═══════════════════════════════════════════════════════════════════

Three backend features integrated in 4 staged passes. Specs (FRONTEND_BRANCH_PARKENT.md,
FRONTEND_FLORIST_VOLUME_RATES.md, FRONTEND_FLORIST_STOCK_ISSUE.md) verified against the
live OpenAPI + GET only — **zero writes to production**. All write paths implemented per
contract and listed below for manual testing.

## §0 VERDICTS (verified, not doc-trusted)
- **BRANCH REVERSAL** — restored branch ONLY for: users (`profile.branch`, written top-level
  via `UserWrite.branch`), catalog (`branch_name`/`source_price`), the transfer flow,
  catalog-transfers, branch-report, and nav/route gating. **Deliberately stayed removed**:
  sklad, florists, leads, customers, suppliers — the spec keeps those unified.
- **VOLUME** — API uses `small`/`medium`/`large` (6 live catalog items). The doc's `S/M/L`
  is illustrative only; the field is a free string. Stored value stays small/medium/large
  everywhere (one `VOLUMES` const; a Vitest fails if a rename makes `"M"` match `"medium"`).
- **florist_fee vs florist_salary_amount** — BOTH exist, distinct (5/6 live items differ).
  `florist_fee` = floristika service charged to customer (price/profit). `florist_salary_amount`
  = what the florist earns (salary, × quantity_total). The RATE's `florist_fee` fills the
  CATALOG's `florist_salary_amount` (naming trap — one mapper, `rateToCatalogSalary`).
- **TRANSFER IS IRREVERSIBLE** — OpenAPI: catalog-transfers is GET-only, `/transfer/` is
  POST-only. **No cancel/return/reverse path exists.** Confirm text states "qaytarib bo'lmaydi".
- **UserModal branch safety** — `updateUser` is PATCH; today UserModal omits `branch`, so
  edits never touched it (safe). New `buildUserBranchPayload` sends `branch` ONLY when changed
  (Vitested: new-with/without, edit-unchanged, main→branch, branch→main) — never silently
  moves a Parkent user to main.
- **§4 discount enforcement** — KatalogSellModal already enforces `discount_reason` when
  sale_price < price (client pre-submit) AND renders the server 400. Applies to branch sells
  (same dialog). No change needed.

## §3 COST MATH AFTER A PARTIAL TRANSFER (audit)
Composition/materials are copied to the branch copy and cost split proportionally.
| Site | Derives | Correct after partial transfer? |
|---|---|---|
| Hisob-kitob money (net/cost/COGS) | server `net_profit`/`cost_total` per sale | ✅ server-authoritative, branch-scoped |
| Hisob-kitob variant/supplier attribution | `saleLineAllocations` over MAIN sold items | ✅ for main sales — ⚠️ see hole below |
| BatchSarfiPanel | server `batch_inventory_stats` | ✅ frontend (backend double-count = flag) |
| Composer preview | recompute from composition | N/A — per-unit, create/edit only, not a report |
| Branch report | server `branch-report` | ✅ transferred markup/sales live here |
**⚠️ REPORTING HOLE (flagged, not patched):** a transferred item's stems were consumed from
the MAIN warehouse at catalog-creation time, but its sale happens under Parkent's separate
accounting scope. So on the MAIN branch those stems appear as warehouse consumption with **no
corresponding sale attribution** — they vanish from main's variant/supplier "sold stems", and
the markup earned in Parkent is invisible to main COGS (it lives in the branch report instead).
Inherent to server-side branch isolation; needs a backend decision, not a client patch.

## STOCK MATH (Stage 2A recap)
No frontend double-count (each stem leaves the warehouse once, as a `florist_issue` OUT).
`florist_issue` movements now carry a "Floristga chiqarildi" label. Florist-hand **waste is
SHOWN separately, never summed** into warehouse chiqit ("Sklad chiqiti bilan qo'shilmagan" +
TODO) — correct whether or not the backend also writes a warehouse waste movement.

## SCREENSHOTS — ALL used MOCKED GET DATA unless noted
The live API has 0 issued stock, 0 rates, 0 transfers, and only a main-branch admin account,
so populated states were shot with in-browser GET mocks (read-only; no writes). **Mock-data
screenshots (not yet seen with live data):** every Stage 2 shot; Stage 3 matrix filled/apprentice;
Stage 4 branch report populated, transfer drawer, branch-user shell (mocked `profile.branch`).
**Real-data shots:** Stage 1 composer split; Stage 3 matrix empty; Stage 4 branch report empty state.
Grep confirms **no mock/fixture/intercept code in app/lib/components** — mocks live only in the
puppeteer scratchpad; the mock payloads are typed fixtures under test.

═══════════════════════════════════════════════════════════════════
# CONSOLIDATED HANDOVER — LIST 1: MANUAL TEST CHECKLIST (all 4 stages)
# Uzbek, numbered, sequenced so earlier steps create data later steps need.
# READ-ONLY constraint was mine (build-time); these are YOUR writes to run.
═══════════════════════════════════════════════════════════════════
1.  TARIF: Floristlar → florist kartasi → drawer pastida «Hajm tariflari» → 6 katakni
    to'ldiring (fee + dona) → Saqlash. ✅ Drawer'ni yopib qayta oching — qiymatlar turibdi
    (matritsa har ochilganda yangi GET qiladi).
2.  BITTA KATAK: bitta katakni bo'shatib Saqlash. ✅ O'sha hajm nofaol bo'ladi, qolganlari qoladi.
3.  BO'SH GRID: barcha kataklarni bo'shatib Saqlash → «Barcha tariflar o'chiriladi» tasdiqi
    chiqadi → Ha. ✅ Hammasi nofaol (ataylab tasdiq bilan himoyalangan).
4.  NUSXALASH: «Boshqa floristdan» → manba floristni tanlang → Nusxalash → grid to'ladi (dirty)
    → Saqlash. ✅ MANBA florist o'zgarmaydi; joriy florist tariflari to'ldi.
5.  CHIQARISH (2 xil gul — qizil/oq keysi uchun): Floristlarga chiqarilgan → Florist + Partiya
    QIZIL (skladdan) + 200 dona → Chiqarish; yana Florist + Partiya OQ + 300 dona → Chiqarish.
    ✅ Sklad partiyalari −200/−300; balansda qizil +200, oq +300; jurnalda «Floristga chiqarildi».
6.  KATALOG (florist qo'lidan — GUL TANLANADI, SONI YO'Q): Katalog → +Katalog → shu florist +
    Turi + Hajm (majburiy, salary «Tarifdan olindi» bilan to'ladi) + GUL tanlang (florist
    balansidan — QIZIL) + narx → Qo'shish. ⚠️ Gul SONI kiritilmaydi; qoldiq faqat READ-ONLY
    kontekst. Qizildan 2 ta buket, oqdan 3 ta buket yasang (oqni «Yana gul»siz alohida item).
    ✅ Karta «Gul taqsimlanmagan» chipi bilan chiqadi (soni hali 0); FLORIST balansi HOZIRCHA
    O'ZGARMAYDI (son chiqim yopilganda hisoblanadi); SKLAD ham o'zgarmadi.
    ✅ Salaryни qo'lda o'zgartiring → tarif bosib o'tmaydi; «Tarifdan qayta olish» → qayta oladi.
    ✅ Gulsiz saqlashga urinsangiz → «Floristga chiqarilgan qaysi guldan yasalganini tanlang»;
       hajmsiz → «Florist katalogida hajmni tanlash kerak — gul shu bo'yicha taqsimlanadi».
7.  BALANSSIZ FLORIST: gul chiqarilmagan floristni tanlang → «Bu floristga hali gul
    chiqarilmagan» + «Floristga gul chiqarish» yorlig'i. ✅ Yorliq to'g'ri floristga olib boradi.
    ✅ FLORIST ALMASHTIRISH: gul tanlagach floristni boshqasiga o'zgartiring → tanlov TOZALANADI
       (yangi floristda o'sha gul yo'q — jimgina saqlanmaydi).
8.  CHIQIMNI YOPISH (QIZIL): Floristlarga chiqarilgan → qizil balans qatori → «Chiqimni yopish»
    → skladga qaytariladigan sonni kiriting (masalan 0) → jonli preview faqat QIZILDAN yasalgan
    (soni 0) kataloglarni ko'rsatadi, OQ kataloglarga TEGMAYDI → Yopish.
    ✅ Qizil buketlar 100/100 to'ldi; oq buketlar 0/0/0 QOLDI → oq itemlar HALI «kutayapti»
       (some(q===0) → partial ≠ done); qizil balans 0 ga tushdi.
    ✅ NOMZOD YO'Q keysi: hech qizil-katalog qolmagan holatda yopmoqchi bo'lsangiz → serverning
       aniq 400 matni AYNAN ko'rinadi («…bu guldan yasalgan, soni yozilmagan katalog yo'q. Qolgan
       N dona gulni skladga qaytaring yoki chiqitga yozing»); «Skladga qaytariladi» yo'li ko'rinadi.
9.  CHIQIMNI YOPISH (OQ): oq balans qatori → «Chiqimni yopish» → preview endi OQ kataloglarni
    ko'rsatadi → Yopish. ✅ Oq buketlar 100/100/100 to'ldi; qizillar o'zgarmadi; oq balans 0.
    ✅ Endi ikkala item ham «Gul taqsimlanmagan» chipisiz (yopilgan); tannarx/foyda haqiqiy.
10. TO'G'RILASH (adjust): Floristlarga chiqarilgan → «Kimda qancha gul bor» → To'g'rilash.
    ✅ Yopilgan katalog tahririda tarkib READ-ONLY + «To'g'rilash (adjust)» maslahati ko'rinadi.
11. QAYTARISH: Floristlarga chiqarilgan → balans qatori → Qaytarish → 10 dona. ✅ Balans −10;
    SKLAD partiyasi +10 tiklandi (OCHIQ SAVOL a).
12. CHIQIT: balans → Chiqit → 2 dona → tasdiq → Ha. ✅ Balans −2; SKLAD partiyasi O'ZGARMADI;
    «Florist qo'lidagi chiqit» bloki (Hisob-kitob + Sklad jurnal xulosasi) 2 dona ko'rsatadi;
    sklad «Chiqit» JAMIGA qo'shilmagan (OCHIQ SAVOL b).
13. O'CHIRISH (ikki holat):
    ✅ KUTAYOTGAN item (soni 0) → o'chirishda «gul soni hali yozilmagan — floristga hech narsa
       qaytmaydi, faqat yozuv o'chadi» (halol: chindan hech narsa qaytmaydi).
    ✅ YOPILGAN item (soni > 0) → «gullar floristning qo'liga qaytadi» (stemlar balansga qaytadi).
14. MIJOZ: Katalog → item → Sotish → Mavjud/Yangi mijoz → soting. ✅ Mijoz chipi kartada/detalda.
15. YUBORISH: Katalog → asosiy item → «Filialga yuborish» → Filial + Soni (maks = sotilmagan) +
    narx (bo'sh = asl) → «5 tadan 2 tasi ketadi, 3 qoladi» + ustama ko'rinadi → yuboring.
    ✅ «Qaytarib bo'lmaydi» ogohlantirishi ko'rinadi; asosiy filialda soni kamaydi; agar
    ko'p so'rasangiz «Yuborish uchun atigi N dona bor» 400 chiqadi.
16. FILIAL HISOBOTI: Filial hisoboti → davr tanlang. ✅ Har filial qatori (yuborilgan/sotilgan/
    ustama), «ustama vs asl» stacked bar, «Yuborilganlar tarixi» (target — oddiy matn, link EMAS),
    Excel eksport. Bo'sh davr → chiroyli empty state.
17. XODIM FILIALI: Xodimlar → yangi/tahrir → «Filial» select. ✅ Parkent tanlab saqlang →
    o'sha user faqat Dashboard·Hisob·Katalog ko'radi. Mavjud Parkent userni tahrirlab filialга
    TEGMASDAN saqlang → filiali O'ZGARMAYDI (asosiyга ko'chib ketmaydi).
18. (Parkent akkaunt bo'lsa) Parkent user: menyu faqat 3 ta; /sklad'ga URL → Dashboard'ga
    yo'naltiriladi; +Katalog tugmasi YO'Q; item'da «asl narx» muted; chegirma bilan sotuvda
    discount_reason MAJBURIY.

═══════════════════════════════════════════════════════════════════
# CONSOLIDATED HANDOVER — LIST 2: OPEN QUESTIONS FOR BACKEND
═══════════════════════════════════════════════════════════════════
a. FLORIST RETURN → warehouse restore: does `return` write a warehouse IN StockMovement, and
   with what `reference_type`? (Frontend has a defensive `florist_return` label.) SETTLE:
   run checklist #11, watch the sklad journal for a new entry.
b. FLORIST WASTE → warehouse totals: does florist `waste` write a warehouse `waste`
   StockMovement? If YES, our separate block must NOT be summed (already isn't); if NO, our
   separate block is the only place the loss shows. Either way we're correct, but you need to
   KNOW so loss numbers are trusted. SETTLE: run #12, check whether sklad «Chiqit» total moves.
c. MULTIPLE FLOWERS PER FLORIST CATALOG: OpenAPI confirms `composition` is an array with
   `stock_batch` required + `quantity_stems` OPTIONAL — so a single florist buket MAY carry
   several stock_batch rows (qizil + oq), and the frontend now sends `composition:
   [{stock_batch}, …]` (no quantity_stems). CONFIRM the close-issue distributor fills ONLY the
   rows matching the closed batch and leaves the other-flower rows at 0 (item stays «kutayapti»
   until every batch is closed). SETTLE: run checklist #6+#8+#9 with the qizil/oq case.
d. APPRENTICE reactivation: after apprentice→florist, do the old rates reactivate or stay
   `is_active:false`? UI is honest ("tariflari nofaol — qayta saqlang"). SETTLE: set a florist
   apprentice, revert, open the matrix.
e. TRANSFER reversibility: CONFIRMED no cancel/return path exists (OpenAPI). If operators need
   to undo a mis-transfer, backend must add one; today it's irreversible from the UI.
f. TRANSFERRED-STEM ATTRIBUTION HOLE: stems consumed on the main branch but sold in Parkent
   vanish from main's variant/supplier sale attribution (see §3). Decide whether to expose
   cross-branch attribution or accept it as intended isolation.
g. isBranchUser assumption: main-branch users must have `profile.branch = null` (verified for
   admin/developer). Confirm no main user is assigned `branch = <main id>` — that would wrongly
   restrict them. SETTLE: check a main user's `profile.branch`.

═══════════════════════════════════════════════════════════════════
# PRE-FLIGHT: RISK-ANNOTATED RUN SHEET (supersedes LIST 1 ordering)
# Reordered so destructive steps come LAST within dependency limits.
# Risk: READ (no change) · REV (reversible) · IRREV (permanent — data lost).
═══════════════════════════════════════════════════════════════════
| # | Step | Risk | Min-damage / note |
|---|---|---|---|
| 1 | Rate save: florist → «Hajm tariflari» → fill 6 → Saqlash | REV | re-editable; needed for step 6 salary autofill |
| 2 | Rate: empty ONE cell → Saqlash (that size deactivates) | REV | just re-add the cell + save |
| 3 | Copy-from-florist → Nusxalash (source untouched) | READ src / REV target | discard by closing without save |
| 4 | Balanceless florist → composer empty state + shortcut | READ | do this BEFORE any issue |
| 5 | Branch report → date range → table/bar/history/Excel | READ | — |
| 6 | ISSUE: florist + batch + N → Chiqarish | REV (via return) | **old, cheap, near-depleted batch; issue ~8** (enough for steps 7/10/13) |
| 7 | Catalog from florist balance (salary «Tarifdan olindi») | REV (via delete) | **1 dona**, low-value; this is your throwaway test item |
| 8 | User branch: Xodimlar → assign a user to Parkent | REV | pick a NON-critical user; revert to Asosiy after |
| 9 | User branch: edit that user WITHOUT touching Filial → save | READ-ish | proves branch not silently reset (the §0.1 risk) |
| 10 | Customer on sale: sell the step-7 item, 1 dona, Mavjud/Yangi | IRREV (records a sale) | **1 dona**; revenue + inventory move is permanent |
| 11 | RETURN: return part of what you issued | REV (restores warehouse) | return e.g. 2 — reverses step 6 partially |
| 12 | TRANSFER: main catalog item → Filialga yuborish | **IRREV — no reverse path exists** | **1 dona to Parkent, cheapest item**; can't undo from UI (open q e) |
| 13 | DELETE the step-7 florist catalog | IRREV (record + its history gone) | flowers return to florist; the catalog record does NOT |
| 14 | WASTE: florist balance → Chiqit | **IRREV — stems gone for good** | **1 dona**; smallest that proves it |
| 15 | Branch-user experience (needs a Parkent login) | READ | nav=3, /sklad→redirect, no +Katalog, discount_reason mandatory |

### SKIP-UNLESS-YOU-WANT-THE-DAMAGE (open-question-only steps)
- **All-empty rate save** (was LIST 1 #3): deactivates a florist's ENTIRE grid — pointless right
  after you hand-entered rates. Only run to SEE the «Barcha tariflar o'chiriladi» confirm guard;
  if you do, re-enter + save immediately. Otherwise skip — the guard is unit-tested.
- **Edit catalog composition over-balance** (was LIST 1 #10, open q c): its ONLY purpose is to
  learn whether PATCH re-validates against the florist's balance. **Recommend asking the backend
  dev instead of damaging a real item** — the UI is already conservative either way.

═══════════════════════════════════════════════════════════════════
# ACCOUNTING BRANCH SPLIT (HISOB_KITOB_FILIAL_AJRATMA, 2026-08-01)
# READ-ONLY: verified vs live OpenAPI + GET. Same feature branch.
═══════════════════════════════════════════════════════════════════

## §0 — THE DEFAULT SCOPE CHANGED (live numbers, range 2026-07-01…07-31)
- `?branch=main` → `summary.total_sales` = **7 700 000** (mode "main")
- `?branch=all` / default → `summary.total_sales` = **7 700 000** (mode "all")
- `?branch=2` (Parkent) → **0** (mode "branch", branch_name "Parkent filiali")
- **The jump is currently ZERO** — Parkent has 0 sales this range, so all == main. The
  structure (by_branch, share_percent, history branch tags) is live and correct; the size
  of the jump will appear once branch sales exist.
- **DECISION: default to `all`** (the truthful all-branch picture) — but the header ALWAYS
  reads the branch label from server `branch_filter.mode`/`branch_name`, never local state,
  so a screen can't be misread. Selector: Hammasi / Toshkent / <filial> (built from
  /api/branches/, hidden for branch users).

## §1a — ATTRIBUTION COLLISION (verdict)
`accounting.history[]` now includes branch sales (`is_main_branch`, `branch_id`,
`branch_name`, `flower_stems`). `saleLineAllocations(sale, catalogById.get(catalog_id))`:
for a branch sale the item isn't in the (main-only) catalog map → `composition = []` →
returns `[]`. **So NOTHING is double-counted and branch sales are NOT attributed onto main
batches.** The output was already SAFE; I made it EXPLICIT by scoping the variant/supplier
attribution to `is_main_branch` sales (`mainSales`) and LABELLING both panels ("faqat asosiy
filial — filiallarda sklad yo'q"). Trade-off: in `all` mode the summary/table show all-branch
money while the attribution panels show main only — that's correct (branches have no
warehouse) and now stated in the UI.
**Stage 4 §3 hole: PARTIALLY closed.** The *money* of branch sales is now visible (summary +
by_branch + history), so revenue no longer vanishes. The *flower-level attribution* of branch
sales still can't be derived client-side (no branch warehouse/composition) — unchanged, and
now labelled rather than silent.

## §1b — DASHBOARD ↔ HISOB-KITOB PARITY (CORRECTED — the rule was RIGHT)
⚠️ My first pass wrongly called this a "metric difference" and changed the rule. That was an
AUDIT ERROR, not a real discrepancy. Reconciled precisely:
- The 1.8M gap = **one sale, history #54 "standart", sold_at 2026-07-31, 1 800 000**.
- Dashboard treats `date_to` as **exclusive** (start-of-day); accounting treats it as
  **inclusive**. Comparing the same raw `date_to=2026-07-31` misaligned the ranges by one day
  (the old trailing-+1 territory) — dashboard dropped Jul 31, accounting kept it.
- **Like-with-like** (dashboard `date_to=2026-08-01` vs accounting main `date_to=2026-07-31`):
  Dashboard `period_catalog_sales_revenue` = **7 700 000** == accounting main `total_sales`
  = **7 700 000**. **They match EXACTLY.** (`7 700 000 − 1 800 000 = 5 900 000` = the misaligned
  dashboard figure.)
- **Verdict: (i) NOT a metric difference, NOT a regression, NOT a backend change** — an
  audit-time date misalignment. `period_catalog_sales_revenue` IS the field matching
  `total_sales`; the three-way acceptance test still holds. The app itself sends aligned ranges
  (api.dashboard adds +1, api.accounting inclusive), so Dashboard == Hisob-kitob(main) in the UI.
- **ACCEPTANCE RULE STANDS** (not revised): Dashboard `period_catalog_sales_revenue` ==
  Analitika `catalog_sales_revenue` == Hisob-kitob **`?branch=main`** `total_sales`, EXACTLY,
  for aligned ranges. The only branch-split addition: Hisob-kitob's DEFAULT is `all`, which is
  ≥ Dashboard's own-branch figure once branches have sales — that all-branch figure is labelled
  "Barcha filiallar" and is NOT the parity anchor; `?branch=main` is.
  (Note: dashboard's `catalog_revenue` = 5 750 000 at the misaligned range is the older
  quantity_sold-based field — BUG-1 — not the parity field; ignore it for parity.)

## §1c — BRANCH-REPORT vs ACCOUNTING (they answer different questions)
Same range: branch-report Parkent `sold_revenue` = **0** == accounting by_branch Parkent
`total_sales` = **0** (agree today). They are **complementary**: `/branch-report/` = how many
catalogs were sent to a branch and the markup; `/accounting/` by_branch = the money flow.
Made the distinction visible with a one-line subtitle + cross-link on BOTH pages. Not
reconciled client-side.

## §1d — DISCOUNT SANITY (it's ONE outlier, base is correct)
`discount_total` 4 700 000 comes from only **3 discounted sales** (of 9). **ONE dominates:**
- `#47 "huhu"`: listed_total **7 600 000**, sold **3 000 000**, discount **4 600 000** (61% off,
  reason "opamga") — **98% of the whole discount total**.
- `#53` and `#41`: 50 000 each (25% off).
**Base is correct:** `listed_total − sale_total == discount_amount` for all three — measured
against the catalog/listed price, NOT `source_price` or a wrong base. So the headline "61%" is
not across-the-board; it's one heavy personal/test discount on a 7.6M item. Real data, correct
math — Skidka stays a normal card (not a hero); nothing adjusted.

## §4 — ⚠️ SPLIT NEVER OBSERVED WITH NON-ZERO BRANCH DATA
Parkent currently has **0 sales**, so live `?branch=all` == `?branch=main` (7 700 000) and
`by_branch` Parkent is all zeros. **Every branch-split screen (split lines, by_branch Parkent
row, history Filial column/filter, branch-mode waste empty state) was screenshotted on MOCKED
accounting responses — the split has NEVER been seen with real non-zero branch data.** First
thing to re-verify after your first real transfer + branch sale: that `summary.total_sales`
jumps above `?branch=main`, the split lines render, and by_branch sums equal summary.

## Built
Branch selector (server-driven, hidden for branch users, combines with date range, doesn't
leak to other pages); header title from `branch_filter`; 8 summary cards incl. new
`sales_count`/`flower_stems` with per-branch split lines (all mode only, truncate+tooltip);
ONE `BranchRow` renderer for by_branch + summary "Jami" footer (Tannarx breakdown in tooltip,
`florist_fee_cost_total` labelled "Floristika xizmati" per the Stage-1 fee/salary split);
history Filial column + filter + per-sale `flower_stems` (hidden in main/single mode); branch-
mode waste empty state ("Filiallarda gul saqlanmaydi"); florist-waste block hidden in branch
mode; Excel "Filiallar" sheet + branch in filename (client-side, so export == screen).
Totals NEVER recomputed client-side — server values shown, share_percent displayed as given.

## Untested write paths
None new — this spec is read-only reporting. (All prior write paths still stand.)

═══════════════════════════════════════════════════════════════════
# FINAL TEST PACK (2026-08-01) — supersedes earlier LIST 1 / LIST 2
═══════════════════════════════════════════════════════════════════

## TEST DATA IN PRODUCTION (found during discount audit)
The ENTIRE live catalog is dev/test data (nonsense names, no ZZZ_TEST_ prefix so the guard
misses them). All current sales history derives from these. Decide whether to purge before
go-live:
- catalog #64 "standart" (200k) · #62 "huhu" (3M, custom) · #61 "gdrgdr" (400k) ·
  #60 "xxxxx" (1M, custom) · #59 "Mix" (200k)
- The 61% discount driver: sale #47, catalog_id 62 ("huhu"), sold_at 2026-07-30,
  listed 7.6M → sold 3.0M, discount 4.6M, reason "opamga".

## LIST 1 — MANUAL CHECKLIST (risk: READ / REV / IRREV; run in order)
### ⚠️ FLORIST OQIMI YANA TUZATILDI (2026-08-01, gul-picker QAYTDI): tartib RATES → ISSUE →
### KATALOG (florist + GUL + Turi + Hajm, SONI YO'Q) → CHIQIMNI YOPISH (har gulga alohida) →
### ADJUST. Gul-picker QAYTARILDI (FloristCompositionPicker) — faqat SON kiritish olib tashlandi;
### gul florist balansidan tanlanadi, miqdor chiqim yopilganda hisoblanadi.
### ⚠️⚠️ KATALOG_TAHRIR (2026-08-01, keyingi): (§3) STANDART composerdan «Florist ish haqi» input,
### «Floristika xizmati» va «Mijoz» OLIB TASHLANDI — standartda haq faqat HAJM TARIFIDAN, read-only
### matn («Tarifdan: X»). CUSTOM'da uchalasi ham QOLADI. (§1) Son tahriri: kutayotgan katalogda
### bemalol; YOPILGANDA oshirish gul talab qiladi (400 AYNAN + «gul chiqarish»/«adjust» yo'llari).
### (§4) Tarix qatoriga ✏️Tuzatish · 🗑Bekor qilish — issue/return/waste ENDI QAYTMAS EMAS (cancel bilan
### orqaga qaytadi, stem ishlatilmagan bo'lsa). Risk annotatsiyalari SHUNGA QARAB yangilandi (pastda).
1.  Rate save: florist → «Hajm tariflari» → 6 katak → HAR katakda ish haqi VA «standart dona»
    (default_stems) — endi u TAQSIMOT OG'IRLIGI. Fee bor, dona yo'q katak OGOHLANTIRILADI. Saqlash. REV.
2.  Empty ONE rate cell → Saqlash (o'sha hajm nofaol). REV — katakni qaytaring.
3.  Copy-from-florist → Nusxalash (manba tegilmaydi). READ src / REV target.
4.  Tarif enum: florist katalogida Turi FAQAT Buket/Savat (QUTI yo'q — rate enum box'ni qabul
    qilmaydi; box florist katalogi yopilmaydi, LIST 2 a). Warehouse katalogida uchtasi ham bor. READ.
5.  Branch report → davr tanlang. IKKI CHIP (florist-stock sahifasidagi bilan bir xil): «Hisobot»
    (default) va «Yuborilganlar tarixi». `?tab=` da saqlanadi; chipni almashtiring — filtrlar
    aralashmaydi. «Hisobot» = filial jadvali (Ustama ustuni ajratilgan) + JAMI satri + ustama-vs-asl
    stacked bar. «Yuborilganlar tarixi» = transfer ro'yxati, filial filtri, target PLAIN TEXT
    («filial yozuvi #N» — link EMAS, admin filial itemida 404). Sarlavha + sana + Excel HAMISHA
    chiplardan yuqorida. Excel = HISOBOT (filiallar + JAMI); transfer tarixi faylga KIRMAYDI.
    Transfer tabida «Butun davr — sana filtri qo'llanmaydi» satri (backend date filtri yo'q — LIST 2 j).
    Ikkala tab ham hozir bo'sh (0 transfer, 0 filial sotuvi) — har biri nimadan to'lishini tushuntiradi. READ.
6.  ISSUE florist + batch + ~8 → Chiqarish. REV (cancel YOKI return orqali — §0d: cancel yozuvni
    o'chirib IKKALA balansni asl holiga qaytaradi, gul ishlatilmagan bo'lsa). Eski, arzon partiya.
7.  FLORIST KATALOGI (gul TANLANADI, soni yo'q): +Katalog → STANDART → florist tanlang → «Gullar
    (florist qo'lidan)» (FloristCompositionPicker): balansdan GUL, «Yana gul» bilan ko'p xil gul;
    SON kiritilmaydi (qoldiq read-only kontekst). Turi + Hajm (majburiy). Gulsiz → «Floristga
    chiqarilgan qaysi guldan yasalganini tanlang»; hajmsiz → volume 400.
    ✅ §3: «Florist ish haqi» INPUT YO'Q — o'rniga read-only «Tarifdan: X so'm» (florist+hajm tanlangach)
       + «Florist oyligiga: X × N = …» satri. «Floristika xizmati» va «Mijoz» bo'limlari HAM YO'Q.
    ✅ §0b: tarifsiz florist (masalan Abror) + hajm → «{Florist} uchun {Hajm} tarifi belgilanmagan —
       katalog saqlanmaydi» + «Tarif qo'shish →» (→ /floristlar?rateFor=<id>). 10 floristdan 9 tasi
       hozir TARIFSIZ (faqat Fatxulloh #8 da 6 tarif bor) — bulardan katalog yaratib bo'lmaydi (LIST 2 e).
    ✅ §2: «Materiallar» — son HAR BITTA DONAGA (× soni server), «har bitta dona» izohi ko'rinadi;
       material tanlab sonini bo'sh qoldiring → «Material sonini kiriting» (guldan farqli MAJBURIY).
    Kartada «Gul taqsimlanmagan» chip (material+haq allaqachon hisobda, faqat gul tannarxi kutilmoqda).
    Gul tanlab floristni almashtiring → tanlov TOZALANADI. IRREV (yoziladi) — arzon test item.
7c. CUSTOM composer solishtirish: +Katalog → MAXSUS → florist → ✅ «Floristika xizmati», «Florist ish
    haqi» (EDITABLE input, tarifdan prefill) va «Mijoz» bo'limlari HAMMASI QOLADI (standartdan farqi). READ.
7d. §1 SON TAHRIRI: 7-qadam katalogini (KUTAYOTGAN — hali yopilmagan) tahrirlang → sonni 1→3 qiling,
    gulni ham o'zgartiring → Saqlash. ✅ Bemalol saqlanadi (backend bug tuzatilgan); forma «bemalol
    o'zgartirasiz» deб yozadi. Chiqim yopgandan KEYIN sonni oshiring → 400 «… qo'lida yetarli gul yo'q»
    AYNAN chiqadi + «Floristga gul chiqarish» va «Hisobni to'g'rilash (adjust)» yo'llari ko'rinadi. IRREV-ish.
7a. CHIQIMNI YOPISH (birinchi taqsimot): Floristlarga chiqarilgan → Kimda qancha gul bor →
    qatordagi «Chiqimni yopish ⌄» menyusi (adjust ham shu yerda, yopish DOMINANT). Skladga
    qaytariladi kiriting → preview jadvali (Katalog·Hajm·Standart·Tushadi, per-item VA jami).
    return==balans → «Hammasi skladga qaytadi» (calm). missing_rates → Yopish O'CHADI + matritsa
    havolasi. Yopish. IRREV — katalog tannarxi endi PAYDO bo'ladi, «taqsimlanmagan» chip yo'qoladi.
7b. ADJUST (keyingi tuzatish): shu qatorda «To'g'rilash» — close'dan KEYIN kam/ko'p ishlatilgan
    bo'lsa. Modal bir qatorli izoh bilan tartibni aytadi. IRREV (audit'da bosilmadi).
7e. §4 CHIQIMNI TUZATISH/BEKOR (Tarix tabi): Floristlarga chiqarilgan → Tarix → qatordagi «⋮» →
    ✅ «Tuzatish» → faqat SON + IZOH (florist/gul o'zgarmas — modal buni aytadi); sonni o'zgartiring →
       DELTA preview «Skladda: X → Y · Floristda: X → Y» ko'rinadi (issue→sklad−/florist+; return→sklad+/
       florist−; waste→faqat florist−). Saqlash → sklad+florist qoldig'i siljiydi.
    ✅ «Bekor qilish» → kind bo'yicha aniq matn (issue→skladga qaytadi; return→floristga qaytadi;
       waste→floristga qaytadi) + «butunlay o'chadi, orqaga qaytarib bo'lmaydi». Ha bosing → yozuv o'chadi.
    ✅ Ishlatilgan chiqimni bekor qiling → 400 «… qo'lida atigi 0 dona bor, N donalik chiqimni bekor
       qilib bo'lmaydi» AYNAN chiqadi (UI: ishlatilgan gul orqaga qaytmaydi). Muvaffaqiyatda balanslar+
       tarix qayta yuklanadi, hisobot keshi yangilanadi. REV natijasi (bekor = asl holatga qaytish).
8.  User branch: Xodimlar → NON-kritik userni Parkentga biriktiring. REV — keyin Asosiyga qaytaring.
9.  User branch: o'sha userni Filialga TEGMASDAN saqlang. READ-ish — filiali o'zgarmasligini tekshiring.
10. Customer on sale: 7-qadam item, 1 dona, Mavjud/Yangi mijoz. IRREV (sotuv yoziladi).
11. RETURN: issue'ning bir qismini qaytaring. REV — sklad tiklanadi; qaytarish yozuvi ham endi
    Tarixdan TUZATILADI/BEKOR qilinadi (§4).
12. TRANSFER: asosiy katalog item → Filialga yuborish, 1 dona, eng arzon. IRREV — QAYTARIB BO'LMAYDI.
13. DELETE floristli katalog. IRREV. ⚠️ KUTAYOTGAN katalogda gul tanlangan lekin soni 0 (composition
    bor, quantity_stems=0) → floristga HECH NARSA qaytmaydi (delete-confirm matni shuni HALOL aytadi:
    «gul soni hali yozilmagan…»); YOPILGAN katalogda (soni>0) stemlar florist balansiga qaytadi.
14. WASTE: florist balansi → Chiqit, 1 dona. ⚠️ ENDI REV (§0d): Tarix → «⋮» → «Bekor qilish» chiqitni
    bekor qiladi, 1 dona floristga qaytadi (gul katalogda ishlatilmagan bo'lsa). Ishlatilgach → 400, o'shanda IRREV.
15. Branch-user tajribasi (Parkent login kerak). READ — menyu 3 ta, /sklad→redirect, +Katalog yo'q,
    chegirmada discount_reason majburiy.
### SKIP (faqat ochiq savolni tekshiradi — zarar arziydimi o'zingiz hal qiling)
- All-empty rate save (butun grid o'chadi) — guard unit-tested, backend dev'ga aytish yetarli.
- Florist katalogida gul-soni endi FORMADAN kiritilmaydi (chiqim yopishda hisoblanadi) — eski
  «balansdan oshirib tahrirlash» validatsiyasi endi TATBIQ ETILMAYDI; ochiq savol (c) → multiple-
  composition close taqsimotiga o'zgardi. Backend dev qizil/oq keysini tasdiqlasin.

### ⚠️ ACCOUNTING BRANCH SPLIT — NEVER OBSERVED WITH REAL DATA (run LAST)
Parkent=0 today, so `all`==`main` and every split screen was mocked. After step 12 (transfer):
16. Parkent nusxasini Parkent user sifatida SOTING (admin Parkent itemni ocholmaydi — 404).
    Bu IRREV (real sotuv), 1 dona. Sotgach:
17. Hisob-kitob → Hammasi: ✅ `summary.total_sales` `?branch=main`dan OShDI; pul kartochkalari
    ostida ajratma satri paydo bo'ldi; `by_branch` Parkent qatori NOLDAN CHIQDI; §2 «Filial»
    ustuni paydo bo'ldi; by_branch yig'indisi summary'ga teng. Filial hisoboti «Hisobot» tabida
    ham shu Parkent qatori JAMI bilan chiqishini kesib-tekshiring (bar + jadval NOLDAN chiqadi).
18. Parkent rejimi: ✅ chiqit bo'sh holati («Filiallarda gul saqlanmaydi»), ajratma satri yo'q,
    sarlavha «Parkent filiali». Filial hisoboti «Yuborilganlar tarixi» tabi endi bo'sh emas —
    transfer qatori chiqadi (target PLAIN TEXT, link emas); filial filtri bitta filialda ko'rinmaydi.
19. Dashboard(o'z filiali) == Hisob-kitob `?branch=main`, AYNIY oralig'da — hali ham teng ekanini
    tasdiqlang (parity qoidasi). Excel: joriy filial + davr fayl nomida. Filial hisoboti Excel tugmasi
    esa (chiplardan yuqorida) HISOBOT tabini eksport qiladi — «Yuborilganlar tarixi» faylga KIRMAYDI.

### ⚠️⚠️ ADJUST — GUL HISOBINI TO'G'RILASH (ENG OXIRIDA — DESTRUKTIV, TARIXIY TANNARXNI QAYTA YOZADI)
Bu amal SOTILGAN kataloglar tarkibi va tannarxini ham qayta yozadi → hisob-kitobdagi sof foyda
(shu jumladan o'tgan sotuvlarniki) siljiydi. QAYTARIB BO'LMAYDI (LIST 2 l). Shuning uchun HAMMA
narsadan keyin, va faqat atayin. Kirish: Floristlarga chiqarilgan → «Kimda qancha gul bor».
Kirish nuqtalari `inventory` BOSHQARISH huquqiga bog'langan (faqat ko'rish — tugmalar chiqmaydi).
20. PREVIEW (READ — bazaga tegmaydi, erkin): florist qatorida «To'g'rilash» → modal. Yo'nalish
    «Florist ko'proq ishlatgan» (to_catalog) da preview jadvali chiqadi: Katalog · Dona ·
    hozir→keyin · O'zgarish (per-item VA total ALOHIDA — 2 dona da +8/dona = +16 jami). Yo'nalishni
    almashtiring/son kiriting → preview DEBOUNCE bilan qayta chaqiriladi. «Floristda qoladi: N»
    preview'dan. Majburiy OGOHLANTIRISH ("Sotilgan buketlar tannarxi ham o'zgaradi") ko'rinadi.
21. PER-FLORIST guruh sarlavhasidagi «Hisobni to'g'rilash» → batch YUBORILMAYDI, faqat to_catalog
    (to_florist o'chirilgan, sabab ko'rsatiladi). Agar preview biror partiyani `blocked` desa —
    Tasdiqlash O'CHADI (all-or-nothing), qaysi partiya + sabab ko'rsatiladi, bloklanmaganini
    bittalab bajarish chipi taklif etiladi. `unplaced_stems > 0` bo'lsa alohida sarg'ish ogoh.
22. BAJARISH (IRREV — READ-ONLY audit'da BOSILMADI): Tasdiqlash → POST /adjust/. Muvaffaqiyatda
    natija (moved_stems, unplaced_stems, stems_before→after) ko'rinadi; balanslar + katalog +
    hisob-kitob/dashboard/analitika keshi (accounting:*, stock-batches:active) invalidate qilinadi.
    IKKI MARTA bosishdan himoyalangan (busy + result guard). Bajarilgach: Hisob-kitob §1/§2 sof
    foyda VA gul-nav/yetkazib-beruvchi (client-recompute) raqamlari siljiganini kesib-tekshiring;
    to'g'rilangan buket katalogining «Tarkib»idagi dona/tannarx yangilanganini ko'ring.

## LIST 2 — OPEN BACKEND QUESTIONS (paste-ready)
a. Florist RETURN — does it write a warehouse IN StockMovement, and with what reference_type?
   SETTLE: run #11, watch the sklad journal for a new entry.
b. Florist WASTE — does it write a warehouse `waste` StockMovement (would our separate block
   then double-show)? SETTLE: run #14, check if the sklad «Chiqit» total moves.
c. PATCH /catalog/{id}/ — does it re-validate composition against the florist's balance?
   ✅ RESOLVED by the adjust spec's side-fix: when a florist is selected, the backend now checks
   the FLORIST'S BALANCE (not the warehouse), and its 400 is the new multi-line block
   ("Katalogni saqlash uchun floristdagi gul yetarli emas. Gul … / Kerak / Bor / Yetmayapti").
   Our composer already validates client-side against `balanceRemaining` (florist mode) — the two
   now AGREE, no duplication/contradiction. Florist-unselected catalogs still check the warehouse.
   Composer hardened so the readable server block renders on ANY 400 (never gated on a phrase match).
d. Apprentice→florist — do the old rates reactivate or stay is_active:false?
   SETTLE: set a florist apprentice, revert, open the matrix.
e. Transfer reversibility — CONFIRMED no cancel/return path exists; do operators need one?
   SETTLE: your call — today a mis-transfer is irreversible from the UI.
f. Transferred-stem attribution — stems consumed on main but sold in Parkent vanish from main's
   variant/supplier attribution; expose cross-branch attribution or accept as isolation?
   SETTLE: backend decision.
g. isBranchUser — main users must have profile.branch = null (verified for admin/developer);
   confirm no main user is assigned branch=<main id>. SETTLE: check one main user's profile.branch.
h. date_to asymmetry — /api/dashboard/ + /api/analytics/ treat date_to EXCLUSIVE, /api/accounting/
   treats it INCLUSIVE. Intentional? Documented anywhere? SETTLE: confirm and document, so nobody
   "fixes" the +1 and silently drops a day of dashboard revenue.
i. Test data — the whole live catalog (#59–#64) is dev data without the ZZZ_TEST_ prefix, skewing
   real reports (esp. the 61% discount). Purge before go-live? SETTLE: your call.
j. GET /api/catalog-transfers/ has NO date filter — OpenAPI params are only branch, ordering, page,
   page_size, search, source_item, target_item (verified in /api/schema/). So the branch-report
   «Yuborilganlar tarixi» tab is ALL-TIME regardless of the page's date range (UI says so:
   «Butun davr — sana filtri qo'llanmaydi»). Add `created_at_after`/`created_at_before` (or
   date_from/date_to) so the transfers tab can honour the same range as «Hisobot»? SETTLE: backend.
k. ADJUST — does POST /api/florist-stock-balances/adjust/ write any StockMovement (warehouse or
   florist), or is it a PURE reallocation of catalog composition + cost with no journal entry?
   Matters because our sklad journal / waste blocks must not double-count it. SETTLE: run the adjust
   E2E (spec confirms it rewrote a SOLD buket's tannarx 300k→390k) and watch the sklad movement log.
l. ADJUST undo — is there any reverse? Running the OPPOSITE direction (to_florist after to_catalog)
   does NOT obviously restore the exact prior composition (rounding 8/8/9 is not symmetric with an
   arbitrary return quantity). Is to_catalog effectively ONE-WAY? A second identical run 400s
   ("bo'linadigan qoldiq yo'q"), but that's not a restore. SETTLE: backend — document reversibility.
m. ADJUST vs closed periods — adjust rewrites cost on ALREADY-SOLD catalogs, so `net_profit`/
   `cost_total` for past sales move. Does it touch already-CLOSED accounting periods / historical
   reports (i.e. can a finalized month's profit shift retroactively)? SETTLE: backend policy.

═══════════════════════════════════════════════════════════════════
# FLORIST GUL HISOBINI TO'G'RILASH (adjust) — BUILD + AUDIT (2026-08-01)
═══════════════════════════════════════════════════════════════════

## §0a — THE 400 MESSAGE SHAPE CHANGED (audit + fix)
Only ONE place in the app coupled to the old shortage wording: `components/KatalogModal.tsx` save
`catch`. `lib/api.ts` (statusMessage/flattenErrors) and `FloristStockIssueModal` only render `detail`
verbatim — no phrase coupling. The old matcher used `/(qo'lida|yetarli gul)/i`; the NEW multi-line
message ("… floristdagi gul yetarli emas. Gul Abror qo'lida. / Gul: / Partiya: / Kerak: / Bor: /
Yetmayapti:") still contains "qo'lida", so it did NOT no-op TODAY — but the readable block was GATED
on that match, the exact fragility to remove. FIX: the readable block now renders on ANY 400 with a
`detail` (multi-line preserved, labelled lines shown), independent of the phrase match; the phrase
match only drives the title + affordance (florist-shortcut / partiya). If wording drifts again, the
server text still shows verbatim instead of a silent toast. Title falls back to "Saqlab bo'lmadi"
when unclassified. `extractFieldErrors` already handles field-keyed bodies ({"batch":[…]},
{"quantity_stems":[…]}) — verified, no change needed. (Live note: the adjust endpoint actually
returns these as top-level `detail`, not field-keyed — both paths render.)

## §0b — CLIENT VALIDATION vs BACKEND SIDE-FIX
Composer florist-mode validation uses `balanceRemaining` (the florist's hand), which is exactly what
the backend now checks. They AGREE; no duplication/contradiction. Closes LIST 2 (c) — see there.

## §5 — REPORTING IMPACT (audit, not patched) — what shifts after an adjust
Adjust rewrites catalog composition + per-item cost on SOLD items. Client sites that would change:

| Site | Derives | Reads comp/cost | Affected |
|---|---|---|---|
| `lib/finance.ts` `saleLineAllocations` (159-172) | per-line stems, cost, cost-weighted revenue split | comp + `batch_detail.cost_per_stem` | YES |
| `lib/finance.ts` `allocateByCost` (64-77) | distributes sale_total by line cost | line costs | YES |
| `app/hisob-kitob` supplier rollup (216-238) | revenue−cost **profit** (client arithmetic) | via saleLineAllocations | YES |
| `app/hisob-kitob` variant rollup (241-250) | revenue−cost **profit** (client arithmetic) | via saleLineAllocations | YES |
| `app/hisob-kitob` CatalogDetail «Tarkib» (853-857) | per-stem line qty×cost (informational) | comp + cost | YES |
| `components/BatchSarfiPanel.tsx` | batch consumption bars (stems only) | NO (batch_inventory_stats) | NO |
| `app/hisob-kitob` KPI «Sof foyda» / per-sale / §4 breakdown | server `net_profit`/`cost_total`/`flower_cost` | NO (server fields) | value moves (server recompute), not our math |
| waste/purchase values (191/246/248, analitika 149) | Σ stems×`batch_detail.cost_per_stem` (StockBatch/Movement) | BATCH cost, not catalog | NO |

`net_profit` is SERVER-COMPUTED (a field on AccountingSale/AccountingFigures), not our arithmetic:
`saleProfit` reads `num(s.net_profit)`; `sale − cost` is computed only for a `reconcile()` console
cross-check, never displayed. So the KPI/per-sale/breakdown profit just MOVES when the server
recomputes — we can't disagree there. The ONLY client-recomputed money that shifts are the supplier
+ variant profit tables (revenue−cost from `saleLineAllocations`); those read the SAME composition
the server does, so they stay consistent with it after an adjust.

## §4 — REFETCH after a successful adjust (implemented, not tested — read-only)
`onAdjustDone` (florist-stock page): `invalidateReportCache()` → clears keys `accounting:<from>:<to>:
<branch>` (Hisob-kitob §1/§2/§4 + Analitika) and `stock-batches:active` (Dashboard alerts +
Analitika BatchSarfiPanel); then dispatches `ef:stock-changed` (mounted Hisob-kitob/Sklad reload,
Hisob-kitob also re-fetches `api.catalog()`); then `loadBalances()` + `loadIssues()` (this page's
florist-stock-balances + issues). ⚠️ Found latent gap: `invalidateReportCache()` was defined but
NEVER called anywhere — so the pre-existing `ef:stock-changed → load()` path read STALE cached
accounting for up to 30s. This flow invalidates BEFORE dispatching, so mounted listeners re-fetch
fresh. Double-submit guarded client-side (busy + result), not relying on the server's 400.

## Built
`FloristStockAdjustModal` (reuses Modal/GlassCard/StockLine/formatStemsAndBunches); two entry points
on the balances tab gated on `canControl("inventory")` (MANAGE, not view): per-florist header
«Hisobni to'g'rilash» (to_catalog only, all batches) and per-row «To'g'rilash» (both directions).
Preview-driven (debounced adjust-preview GET on open + on direction/qty change); grouped preview
table showing change_per_item AND change_total separately; increase=sage / decrease=rose tints
(existing tokens, none invented); unplaced_stems + blocked (confirm disabled, all-or-nothing,
per-batch fallback) surfaced; mandatory bordered sold-cost warning; footer «Floristda qoladi/
qaytadi» from preview; success result view. Pure logic in `lib/floristStock.ts`
(buildAdjustRequest / previewBlocked / blockedBatches / totalUnplaced / floristRemainsAfter /
formatChange), 17 new Vitest cases (88 total, all green). tsc clean.

## Untested write paths (added)
- POST /api/florist-stock-balances/adjust/ — DESTRUCTIVE (rewrites composition + cost incl. sold).
  Wired to the modal's Tasdiqlash; NEVER fired in this audit (read-only). adjust-preview (GET) was
  called live: 0 florists hold stock today (balances count=0), so the modal is MOCK-VERIFIED only.
  Live probe confirmed the endpoint + top-level shape ({florist, florist_name, direction, batches:[],
  total_florist_stems, blocked_count}) and the request contract (FloristLeftoverRequest: florist req,
  batch nullable, direction enum default to_catalog, quantity_stems min 1).

═══════════════════════════════════════════════════════════════════
# YUK (delivery) + POCHKA→DONA NARX (rounding) — BUILD + AUDIT (2026-08-01)
═══════════════════════════════════════════════════════════════════

## §0 — CACHE-INVALIDATION TRACE (closed out)
`invalidateReportCache` was added in `fe6d280` (finance module) with a doc-comment promising it'd be
called on `ef:stock-changed` — but NO call site ever existed until my adjust commit `51e6f76`. So
every report-mutating action except adjust left numbers STALE for up to the 30s TTL. Fix: a
centralized `notifyReportDataChanged()` (invalidate + dispatch `ef:stock-changed`) — both are needed:
invalidate covers a report page opened LATER (unmounted at mutation time), the event reloads a
MOUNTED one. Wired into every handler below; the two listeners (sklad, hisob-kitob) also invalidate
on the event so the WebSocket `supplier_stock` push is covered.

| Action | Before | After |
|---|---|---|
| Sell (incl. discounted) | stale | ✅ notify |
| Catalog create / edit | dispatched event but never cleared cache → stale | ✅ notify (in KatalogModal) |
| Catalog delete / deduct-stock | stale | ✅ notify |
| Catalog transfer to branch | stale | ✅ notify |
| Florist issue / return / waste | stale | ✅ notify |
| Florist adjust | ✅ (already) | ✅ |
| Batch create | stale | ✅ notify |
| Batch edit / delete / waste / movement (BatchDrawer) | stale | ✅ notify |
| Material create/edit / movement | stale | ✅ notify |
| Supplier payment create/edit/delete | stale | ✅ invalidate (on-page refreshSuppliers kept) |
| WebSocket supplier_stock push | dispatched, no invalidate | ✅ listeners invalidate |

## §1 — AUDITS (live data)
- **a) Terminology:** batch stays "Partiya" (backend error strings say it). Delivery = **"Yuk"**
  (user-approved) — native Uzbek, and the spec's own note says "Chorshanba yuki". Labels centralized
  in `lib/inventory.ts` `DELIVERY` (never scattered literals): Yuklar / Yangi yuk / "Yuk 7 · 01.08.2026".
- **b) Rounding cliff (GET /stock-batches/):** only 2 batches; lowest cost_per_stem = **3000**, other
  **5333**. ZERO under 150, ZERO under 50 — the round-to-0 cliff isn't hit by today's data, but the
  form warns anyway (screenshot: bunch 1000 ÷ 25 = 40 → "0 ga yaxlitlanadi, aniq hisob 40"). LIST 2.
- **c) Parity:** one helper `perStemFromBunch = round(bunch/stems/100)*100` — divides THEN rounds,
  half-up. Vitest passes EVERY spec row (998→1000, 996→1000, 1004→1000, 1052→1100, 1060→1100) + exact
  halves (1050→1100, 950→1000, 50→100) + sub-50 (49→0). **What we send:** per-stem is preview-only —
  default payload sends the BUNCH value only; a "qo'lda kiritish" override sends both knowingly.
- **d) Migration state (GET /stock-deliveries/):** 1 delivery (id 1, number "01:00", note
  "Avtomatik ko'chirildi") groups BOTH existing batches; every batch carries a delivery (2/2). No
  repeated numbers yet. The auto-number "01:00" is quirky (time-derived) — usable on day one.

## §3 — WHAT THE BATCH FORM SENT TODAY (before the rework)
`StockBatchModal` posted ALL THREE fields the spec wants gone: `batch_number` (auto `EF-…`),
`supplier` (when set), `received_at` (when set) — plus BOTH `sale_price_per_stem` AND
`sale_price_per_bunch` (the "never send both" violation). After: delivery-bound payloads omit the
three fields (shown read-only) and send the bunch price only unless overridden — `buildBatchPayload`,
Vitest-covered (bunch-only / stem-only / override / delivery-bound omitting the three).

## §5 — REPORTING IMPACT (audit, not patched)
Which client derivations read `cost_per_stem` and are moved by the round-to-100 rule:

| Site | Reads | Affected by rounding? |
|---|---|---|
| `lib/finance.ts` allocateByCost / saleLineAllocations | composition `batch_detail.cost_per_stem` | YES (weights use the rounded per-stem) |
| `app/hisob-kitob` supplier + variant profit tables | revenue − cost (via saleLineAllocations) | YES |
| florist balance value-at-cost (`floristlarga-chiqarilgan` chips.value, BatchDrawer) | `remaining_stems × cost_per_stem` | YES |
| adjust preview (server) | catalog composition cost | YES (server computes from the rounded basis; we display) |
| StockBatchCard / BatchDrawer cost display | `cost_per_stem`, now also `cost_per_bunch` | shows the rounded per-stem verbatim |
| server `net_profit` / `cost_total` / `stock_value` | server fields | move on server recompute (not our math) |

**Mixed basis (reported, NOT normalized):** a NEW batch created via `cost_per_bunch` stores a
`cost_per_stem` that is a multiple of 100. OLD batches entered per-stem directly are NOT — LIVE
EXAMPLE: batch #61 `cost_per_stem=5333` (79995/15, not a multiple of 100) sits next to #62 `=3000`.
Any report summing both mixes a rounded-to-100 basis with an exact one. Left as-is per instructions.

## Built
- `lib/inventory.ts`: `DELIVERY` copy, `roundToHundred`/`perStemFromBunch`/`exactPerStem`/
  `roundingNote`, `buildBatchPayload`, `batchDeliveryTag`.
- `lib/types.ts`: `StockDelivery`/`StockDeliveryInput`/`DeliveryBrief`; `cost_per_bunch` + `delivery`
  + `delivery_detail` on `StockBatch`. `lib/api.ts`: stockDeliveries/stockDelivery/deliveryBatches/
  create/update/delete.
- Components: `DeliveryModal` (create/edit), `DeliveryDrawer` (header text + batches + «Gul qo'shish»
  + archive/edit), reworked `StockBatchModal` (delivery-bound: drops the 3 fields, pochka pricing
  with rounded per-stem preview + "(yaxlitlandi, aniq hisob N)" + loud 0-warning + "qo'lda kiritish"
  override). Sklad page: new "Yuklar" tab (columns number·date·supplier·batch_count·total_stems·
  remaining·total_cost, server-computed; row key = id, number shown with date since number REPEATS).
- §4 pickers keep working; delivery context added to composer (warehouse) + issue-modal option subs
  ("Yuk 7 · 01.08"); adjust/waste operate on already-selected batches (unchanged). cost_per_bunch
  shown alongside per-stem on StockBatchCard + BatchDrawer.
- 17 new Vitest cases (delivery.test.ts): rounding table + payload rules. 105 total, green.

## Untested write paths (added — READ-ONLY, none fired)
- POST /api/stock-deliveries/ — create a Yuk (DeliveryModal).
- PATCH /api/stock-deliveries/{id}/ — edit a Yuk.
- DELETE /api/stock-deliveries/{id}/ — ⚠️ if it contains flowers the server ARCHIVES (is_active=false),
  does not delete; the confirm text says exactly that.
- POST /api/stock-batches/ with `delivery` + `cost_per_bunch` (delivery-bound, no batch_number/
  received_at/supplier) — new create path. Live GETs only (deliveries, one /batches/, batch list)
  were called; the deliveries UI is otherwise MOCK-verified in screenshots (only 1 real delivery).

## LIST 1 — DELIVERY (YUK) BLOCK (append after everything; risk-annotated)
D1. Yangi yuk: Sklad → Yuklar → «Yangi yuk» → raqam (masalan 7) + sana + postavshik + izoh → ochish.
    REV (yuk bo'sh — o'chirsa bo'ladi). IRREV EMAS.
D2. Ichiga 2 gul: yuk detali → «Gul qo'shish» ×2 (har xil nav). Har birida Pochka tannarxi kiriting;
    «→ dona tannarxi» YAXLITLANGANini + "(yaxlitlandi, aniq hisob N)" izohini ko'ring. IRREV
    (StockBatch yoziladi) — arzon, tashlab yuboriladigan gul.
D3. Totallar: yuk qatorida Xil gul=2, Kelgan/Qolgan/Tannarx server hisobidan chiqqanini tasdiqlang.
    READ.
D4. Yukdan olindi: qo'shilgan partiyani BatchDrawer'da oching — batch_number/sana/postavshik YUKKA
    mos (siz formada kiritmadingiz); «Yuk» meta ko'rinadi. Saqlangan dona tannarxi = formadagi
    preview bilan AYNAN teng (rounding parity). READ.
D5. Arxiv: gulli yukni «Arxivlash» → tasdiq matni "ARXIVLANADI (is_active=false)" deydi. REV-ish
    (arxiv, o'chmaydi). Ehtiyot: keyin ro'yxatdan yo'qoladi.
D6. Yuk select LOCK bug (tuzatildi): «Yangi partiya» → Yukni tanlang → BOSHQA yukka almashtiring.
    Select butun modal davomida ochiladi; ostidagi «raqam·sana·postavshik shu yukdan» satri darhol
    yangilanadi. READ. (ilgari birinchi tanlovdan keyin qulflanib qolardi.)
D7. PARTIYA TAHRIRLASH: partiya kartasidagi ✎ ikonka (yoki detaldagi «Tahrirlash») → BatchEditModal.
    ⚠️ TANNARX / pochka-dona / dona-tannarx o'zgartirsa RETROAKTIV ogoh chiqadi («avval yasalgan
    kataloglar tannarxiga ta'sir»). IRREV bo'lmasa ham TARIXIY sonlarga DESTRUKTIV: sotilgan
    kataloglar COGS/foydasi siljiydi (adjust bilan bir xil). FAQAT o'zgargan maydon PATCH qilinadi;
    hech narsa o'zgarmasa Saqlash o'chiq. Provenance (Yuk/nav/qoldiq/qabul) o'zgartirilmaydi.
    RISK: tannarx tegmasa REV-ish (tavsifiy); tannarx tegsa — ISTORIK RAQAMLARGA DESTRUKTIV, ehtiyot.

## LIST 2 — ROUNDING QUESTION (append)
n. Pochka→dona yaxlitlash 100 ga — arzon gullar uchun to'g'rimi? cost_per_stem = cost_per_bunch ÷
   stems_per_bunch, nearest 100. Har qanday <50/dona → 0 (tannarx asosi yo'qoladi → cheksiz foyda),
   50–149 → 100. Bugungi ma'lumotda eng arzoni 3000/dona (xavf yo'q), lekin qoida o'zi arzon gulni
   buzadi. Mayda gul uchun finaroq (masalan 10 ga) yaxlitlash kerakmi? SETTLE: backend policy.
   Bog'liq: mixed basis — eski #61 cost_per_stem=5333 (100 ning karrasi EMAS) yangi yaxlitlangan
   partiyalar bilan bitta hisobotda aralashadi.
o. ⚠️ SOTISH-YOPISHDAN-OLDIN (PRIORITET) — florist katalogini chiqim YOPILMASDAN sotib bo'ladimi?
   Yopilmagan item'da composition YO'Q → COGS 0 → sotuv paytida foyda 100% ko'rinadi, keyin close
   tannarxni yozadi → TARIXIY foyda siljiydi. Spec jim. Read-only tekshirib bo'lmadi (0 florist
   katalog live). SETTLE: (1) yopilmagan florist katalogini sotishni backend bloklaydimi? (2) bloklamasa,
   sotilgach close COGS'ni orqaga to'g'rilaydimi yoki sotuv «taqsimlanmagan» qolib ketadimi?
p. ⚠️ RATE ENUM box'siz — CatalogItem.arrangement_type = [bouquet,basket,box] (2c2Enum), lekin
   FloristVolumeRate.arrangement_type = [bouquet,basket] (E15Enum, box YO'Q). Ya'ni box florist
   katalogi hech qachon mos tarif ololmaydi → missing_rates → YOPIB BO'LMAYDI. UI himoyasi: florist
   rejimida Turi'dan box olib tashlandi + matritsa 2×3 qoldi. SETTLE: rate enum'ga box qo'shilsinmi
   (spec «quti» deydi), yoki florist katalogida box rasman taqiqlansinmi?
q. ⚠️ default_stems null — FloristVolumeRate.default_stems OpenAPI'da required EMAS (nullable). Endi u
   TAQSIMOT OG'IRLIGI. Tarif bor, lekin default_stems null/0 bo'lsa — o'sha katalog og'irligi 0 (ulush
   0) bo'ladimi yoki xato? Read-only aniqlanmadi (6 live tarifning hammasida bor). UI himoyasi:
   matritsada fee bor, dona yo'q katak ogohlantiriladi. SETTLE: backend — null default_stems xatti-harakati.
r. CLOSE vs ADJUST — close'dan keyin adjust `to_catalog` o'sha guldan yasalgan kataloglarni bo'ladi;
   endi ular composition'li. Bizning o'qishimiz: MANTIQIY qoladi — close BIRINCHI taqsimot (bo'sh
   kataloglarga), adjust floristda ORTGAN gulni MAVJUD composition'ga qo'shadi/kamaytiradi (spec
   «bir-birini to'ldiradi» deydi). Ziddiyat kutilmaydi, lekin ikkalasi ham katalog tannarxini o'zgartirgani
   uchun tartib muhim (UI ikkala modalда bir qatorli izoh bilan aytadi). SETTLE: agar close ham adjust
   ham bitta gulga ketma-ket qo'llansa, ikki marta hisoblanmasligini backend'да tasdiqlang.

## LIST 2 — KATALOG_TAHRIR (2026-08-01) yangilanishlari
s. ⚠️⚠️ TARIF — YARATISHDA BLOKLOVCHI, LEKIN 10 FLORISTDAN 9 TASIDA TARIF YO'Q (kritik, ship'dan oldin).
   Live GET (/api/florist-volume-rates/?is_active=true): jami 6 tarif — HAMMASI faqat Fatxulloh (#8) da
   (bouquet/basket × S/M/L). Qolgan 9 florist TARIFSIZ: Abror#4, Abubakir#5, Bekzod#6, Isroil#7, Zafar#9,
   Azimjon#10, Abror#11, ShoxAkbar#12, Location Test#14. → Standart katalog yaratish shu 9 florist uchun
   HOZIR volume 400 bilan BLOKLANADI. UI to'g'ri (florist+hajmni atab «Tarif qo'shish →» beradi), lekin
   ma'lumot bo'shlig'i BACKEND/ADMIN ishi: ship'dan oldin har faol floristga hajm tariflari kiritilsin.
t. ✅ RESOLVED (spec §1): quantity_total + composition BIRGA tahriri — eski «Katalog sklad qoldig'i umumiy
   katalog sonidan oshib ketdi» 400 BACKEND bug edi, ENDI TUZATILGAN. Klientda bu bagga qarshi hech qanday
   guard/blok QO'YILMAGAN edi (grep tasdiqladi) → olib tashlanadigan narsa yo'q. Kutayotgan katalogda son
   bemalol; yopilgandan keyin oshirish gul talab qiladi (to'g'ri xatti-harakat — 400 AYNAN ko'rsatiladi).
u. ✅ RESOLVED (spec §4 + OpenAPI): ISSUE/RETURN/WASTE endi TUZATILADI (PATCH …/edit/ {quantity_stems,reason})
   va BEKOR QILINADI (DELETE …/cancel/ — generic destroy, kind ∈ {issue,return,waste}). Cancel ikkala
   balansni asl holiga qaytaradi; gul katalogda ISHLATILGAN bo'lsa 400 («… qo'lida atigi 0 dona bor»).
   Natija: LIST 1 risk annotatsiyalari yangilandi — issue/return/waste QAYTMAS EMAS (stem ishlatilgunча).
   (a)/(b) hali ochiq: cancel sklad harakatini o'chiradi, lekin return/waste'ning ORIGINAL warehouse
   movement yozuvi masalasi o'zgarmadi — o'sha ikki savol kuchida.

═══════════════════════════════════════════════════════════════════
# FLORIST CHIQIM YOPISH (close-issue) — BUILD + AUDIT (2026-08-01)
═══════════════════════════════════════════════════════════════════

## §0 — SIX AUDITS (live + code)
- **a) Box enum:** the RATE enum (E15Enum, governs the matrix) is STILL `[bouquet, basket]` — no box —
  so the matrix stays **2×3** (spec's «quti» is ahead of the API). BUT the CATALOG enum (2c2Enum) DOES
  have box, so a box florist catalog would be uncloseable; mitigated by dropping box from florist-mode
  Turi. → LIST 2 p.
- **b) default_stems:** OPTIONAL on the rate (not in OpenAPI `required`; all 6 live rates have it). Now
  it's the distribution WEIGHT — promoted to a first-class matrix input with a fee-but-no-stems warning.
  Null/0 behavior untestable read-only → LIST 2 q.
- **c) Zero rates:** NO longer zero — **6 rates live, all florist 8 (Fatxulloh)**; every other florist has
  0. Actionable states + matrix links surfaced in the close modal + florist catalog form.
- **d) Volume matching:** rates store **small/medium/large** (live), `volumeArrangementMatch` uses exact
  equality; matrix + catalog both use small/medium/large; `VOLUME_SHORT` (S/M/L) is display-only. The
  preview's `"volume":"S"` is a backend DISPLAY label. No second representation introduced.
- **e) Stage-2 deletions:** removed from KatalogModal — florist `compOptions` branch, per-row «mavjud:N»,
  `availOf` florist half, `rowInvalidFlorist`/`anyInvalidRow`/`over`-via-`stemsForBatchNow`, `balances`
  loader, «Bu floristga hali gul chiqarilmagan» empty-state+shortcut, the florist arm of the 400 renderer.
  `lib/floristStock.ts` `balanceRemaining/batchHeldByFlorist/stemsForBatch/isBatchOverBalance/CompStemRow`
  DELETED (adjust imports a disjoint set — verified). Warehouse composition path UNTOUCHED (tsc-verified,
  screenshot: warehouse catalog still picks flowers).
- **f) Limbo catalogs:** an unclosed florist catalog has EMPTY composition → `saleLineAllocations` returns
  `[]` (0 to supplier/variant sections) and the KatalogModal live-price computes **cost 0 / profit 100%**;
  server `net_profit`/`cost_total` depend on the backend. Mitigation: «Gul taqsimlanmagan» chip on the
  catalog card + detail + a client filter. Sell-before-close is untestable read-only → LIST 2 o (priority).

## §5 — REPORTING IMPACT (limbo)
| Site | For an unclosed (empty-composition) florist catalog |
|---|---|
| `saleLineAllocations` / supplier + variant profit tables | returns [] → contributes 0 revenue & 0 cost (item absent from those sections) |
| KatalogModal live-price preview | cost 0 → «Taxminiy foyda» = full sale (100%) |
| KatalogViewModal «Komponentlar narxi» | hidden (server component price 0) |
| hisob-kitob KPI/per-sale «Sof foyda» | server `net_profit`/`cost_total` — if backend reports 0 cost, reads 100% margin |
After a close the composition (and thus cost) comes into existence, so every one of these moves — hence
`notifyReportDataChanged()` on close success.

## Built
- API: `closeIssuePreview` (GET) + `closeIssue` (POST, never auto-called) + types. Live probe: 0 balances
  today → close-issue-preview MOCK-VERIFIED only (endpoint confirmed: needs florist+batch; without batch
  400s `{"detail":"Florist va gul tanlanishi kerak."}`). 6 rates confirmed live (florist 8).
- `FloristCloseIssueModal` (reuses Modal/StockLine): return_stems (clamped, debounced preview), «Kataloglarga
  bo'linadi» from preview, table Katalog·Hajm·Standart·Tushadi with per-item AND total, Jami footer,
  missing_rates → confirm disabled + matrix link, unplaced surfaced, all-returns calm state, verbatim 400,
  result summary, double-submit guard, ordering copy.
- Row menu «Chiqimni yopish ⌄» (dominant) + «To'g'rilash» (adjust) with one-line descriptions, gated on
  inventory MANAGE. Both modals carry a one-line ordering note (§4).
- KatalogModal florist mode: flower block replaced by an explanatory note; Turi limited to buket/basket;
  Hajm required (client + server 400 on volume/arrangement_type); existing-composition florist catalogs
  shown READ-ONLY with an adjust hint; rate-missing link to the matrix; salary auto-fill kept. Delete-confirm
  now truthful for both cases (unclosed → nothing returns to the florist).
- «Gul taqsimlanmagan» chip on catalog card + detail + a client-side filter.
- `lib/floristStock.ts`: `buildCloseIssueRequest`/`clampReturnStems`/`closeIssueBlocked`/`missingRateLabels`/
  `allReturns` + 11 new Vitest (109 total, green). tsc clean.

## Untested write paths (added — READ-ONLY, none fired)
- POST /api/florist-stock-balances/close-issue/ — distributes issued stock into empty-composition catalogs
  + returns the rest to the warehouse (catalog costs come into existence). Wired to the modal's «Yopish».
- POST /api/catalog/ with `florist` + `volume` + `arrangement_type` and NO composition — the new florist
  catalog create path.

═══════════════════════════════════════════════════════════════════
# PARTIYA ANIQ vs YAXLIT NARX (exact/rounding) — BUILD + AUDIT (2026-08-01)
═══════════════════════════════════════════════════════════════════

## §0 — THE RULE: exact/rounding is DISPLAY-ONLY
`cost_per_stem_exact` / `sale_price_per_stem_exact` + the `rounding` block (batch) and
`total_cost_exact` / `rounding_diff` (delivery) are DISPLAY-ONLY. All accounting stays on the ROUNDED
fields. Types carry an explicit ⚠️ comment naming this rule (lib/types.ts StockBatch/StockDelivery).

### Verified-UNCHANGED consumers (all read the ROUNDED field; zero read *_exact)
| Site | reads | field |
|---|---|---|
| lib/finance.ts:161 saleLineAllocations → allocateByCost | `batch_detail.cost_per_stem` | rounded |
| app/hisob-kitob/page.tsx:191/246/248/856 (florist-waste/purchase/variant-waste/consumption) | `cost_per_stem` | rounded |
| app/floristlarga-chiqarilgan/page.tsx:125/218 (value-at-cost) | `batch_detail.cost_per_stem` | rounded |
| app/analitika/page.tsx:149 (waste value) | `batch_detail.cost_per_stem` | rounded |
| KatalogModal live price memo :219-220 | `cost_per_stem`/`sale_price_per_stem` | rounded |
| StockBatchCard / BatchDrawer / DeliveryDrawer / pickers (display) | `cost_per_stem`/`sale_price_per_stem` | rounded |
| FloristStockAdjustModal / FloristCloseIssueModal / BatchSarfiPanel | (do NOT read cost) | — |
Note: the slim `FloristStockBatchDetail` only carries the rounded `cost_per_stem`, so balance/issue
value-at-cost is rounded by construction (no exact field to accidentally use).
Guard Vitest: finance.test.ts asserts saleLineAllocations cost = 100×1000 (rounded), NOT 100×998
(exact) — a future swap to `*_exact` fails loudly.

## §1 — client helper vs server block (split cleanly)
- FORM PREVIEW (StockBatchModal, before save): keeps the client helper `round(bunch/stems/100)*100` +
  "(yaxlitlandi, aniq hisob 998)" — UNCHANGED (nothing exists server-side yet).
- SAVED BATCH DISPLAY: switched to the server `rounding` block via new `roundingHint()` /
  `deliveryRoundingHint()` (lib/inventory) — we NEVER recompute exact/diff/totals. Switched call sites:
  DeliveryDrawer (flower row + Tannarx header), BatchDrawer meta (Dona narxi / Tannarx (dona)),
  StockBatchCard narx row.

## §2 — display (only when is_rounded / rounding_diff≠0, grey small)
Delivery detail flower row: Pochka tannarxi · Dona tannarxi (aniq: 998 · +2) · Dona sotuv narxi
(aniq: 1 060 · +40). Delivery header Tannarx: 100 000 so'm + «aniq hisob: 99 800 · yaxlitlashdan +200».
Pickers intentionally show the ROUNDED price only (selection UI) — the exact/rounded detail lives in
the batch/delivery detail views. BatchSarfiPanel reads a stats endpoint with no price → nothing to show.

## §3 — verify
Live GET (18 batches, 4 deliveries): every live row has `is_rounded:false` (prices divide evenly) so
the hint is correctly HIDDEN on real data; exact fields present and equal to rounded. Screenshots
(dark+light) with a MOCKED is_rounded:true batch confirm the layout. 113 Vitest (+4), tsc clean, no
console errors. READ-ONLY: GET + OpenAPI only.

═══════════════════════════════════════════════════════════════════
# SKLAD: YUK-SELECT LOCK FIX + BATCH EDIT (icon + fuller form) (2026-08-01)
═══════════════════════════════════════════════════════════════════

## §1 — Yuk dropdown lock (bug) — CAUSE + FIX
CAUSE: `StockBatchModal` rendered `{boundDelivery ? <static text> : <Select>}` — the moment a Yuk was
picked, `boundDelivery` became truthy and the JSX SWAPPED the Select for a read-only block with NO
clear/change affordance → trapped until close. FIX: the Select now always renders (whole modal life);
a derived read-only «raqam·sana·postavshik shu yukdan» line sits BELOW it and re-renders on change (no
stale text). Deliveries are always loaded + the pre-bound prop is seeded into the list so the prop case
stays changeable too (clearly labelled to prevent misfiling). Legacy no-delivery path was removed in an
earlier task, so a batch is always Yuk-bound; there is no "clear to none" — the field is simply
always-changeable, never trapped.
Same-class check elsewhere: CustomerPicker DOES swap to a static chip on select but has an explicit ✕
"Boshqasini tanlash" escape (not trapped — OK). Florist/supplier (KatalogModal, DeliveryModal,
StockBatchModal) and the branch select (CatalogTransferDrawer) are plain interactive Selects (OK). Only
the Yuk had no escape — fixed.

## §2b — PATCH /api/stock-batches/{id}/ writable fields (OpenAPI) + classification
Writable: received_bunches, batch_number, received_at, height_cm, height_from_cm, height_to_cm,
stems_per_bunch, received_stems, remaining_stems, cost_per_bunch, cost_per_stem, cost_per_stem_exact,
sale_price_per_bunch, sale_price_per_stem, sale_price_per_stem_exact, minimum_sale_stems, image_url,
notes, is_active, variant, delivery, supplier.
Read-only: id, variant_detail, supplier_detail, delivery_detail, rounding, remaining_bunches,
remaining_bunches_label, stock_value, height_label, created_at, updated_at.

| Field | Class | Exposed in edit? | Note |
|---|---|---|---|
| notes, image_url, minimum_sale_stems, height_cm | SAFE | yes (plain) | descriptive |
| sale_price_per_bunch (+ per-stem override) | SAFE | yes (plain) | forward-looking; recorded sales keep their own price |
| received_at | SAFE-ish | yes (plain) | re-dates the batch (freshness/date-window display) — minor |
| cost_per_bunch / cost_per_stem | ⚠️ RETROACTIVE | yes, behind LOUD warning | your read CONFIRMED: catalog COGS derives from batch cost (saleLineAllocations); moves historical profit exactly like adjust |
| stems_per_bunch | ⚠️ RETROACTIVE | yes, behind LOUD warning | your read CONFIRMED: every dona↔pochka conversion (florist balances, issue toggle, remaining_bunches, displays) shifts |
| received_stems | 🚫 DANGEROUS | NO | editing the original received qty on a partly-consumed batch can desync/negate remaining_stems (server recompute unknown) |
| remaining_stems | 🚫 DANGEROUS | NO | directly editing live stock bypasses the movement journal → stock vs history desync |
| delivery (move to another Yuk) | 🚫 DANGEROUS | NO | retroactively rewrites the batch's number/date/supplier AND shifts both deliveries' totals — provenance rewrite |
| variant | 🚫 DANGEROUS | NO | changes what every existing catalog/composition line points to |
| supplier | 🚫 (derived) | NO | comes from the Yuk for delivery-bound batches — editing contradicts provenance |
| is_active | — | via existing "Nofaollashtirish" button | not a form field |
DECISION NEEDED FROM YOU: the four 🚫 (received_stems, remaining_stems, delivery-move, variant) are
NOT exposed. If you want any of them editable (e.g. delivery-move to fix a misfiled batch), say so.

## §2c — form behavior (built)
Edit reuses the create modal's pricing exactly — shared `PriceHint` component (extracted to
`components/BatchPriceFields.tsx`, used by BOTH create + edit) → pochka price primary, computed per-stem,
rounding note, «qo'lda kiritish» override. Prefill from the record; `buildBatchEditPayload` sends ONLY
CHANGED keys (never a full overwrite; numeric equality ignores decimal formatting so 25000==25000.00),
price rule identical to create (bunch → stem omitted; explicit override → both). Retroactive warning
box (`batchEditIsRetroactive`) shows when cost/stems_per_bunch changed — same treatment as the adjust
sold-cost warning. On success: `notifyReportDataChanged()` + parent refetch. The old inline BatchDrawer
edit form (full-overwrite, no rounding UI) was REPLACED — BatchDrawer's «Tahrirlash» now opens the SAME
BatchEditModal, so there is one edit form everywhere.

## Built
- Bug fix: StockBatchModal Yuk select always-interactive + derived line.
- `components/BatchPriceFields.tsx` (shared PriceHint), `components/BatchEditModal.tsx` (fuller edit).
- `lib/inventory.ts`: `buildBatchEditPayload` + `batchEditIsRetroactive` + types; 8 new Vitest (121 total, green).
- StockBatchCard: ✎ edit icon in the footer (icon-btn pattern, stopPropagation so it doesn't open the
  card; separate target), gated on `canControl("inventory")` (parent passes onEdit only when permitted;
  view-only sees no icon). Sklad page wires it → BatchEditModal.

## Untested write paths (added — READ-ONLY, none fired)
- PATCH /api/stock-batches/{id}/ — DESTRUCTIVE when cost/stems_per_bunch change (rewrites historical
  COGS/profit for catalogs built from this batch, incl. sold). Wired to BatchEditModal «Saqlash»; sends
  only changed fields; NEVER fired in this audit. tsc clean, 121 Vitest green, no console errors.

═══════════════════════════════════════════════════════════════════
# MATERIAL YUKLARI (deliveries) + POCHKA-DEFAULT + MENU FIX (2026-08-01)
═══════════════════════════════════════════════════════════════════

## §0 — FIVE AUDITS
- **a) Naming:** deliveries, not "Partiya" → «Material yuki / Material yuklari» (centralized as
  `MATERIAL_DELIVERY` in lib/inventory). Labels: tab segment «Material yuklari», detail «Material yuki
  M-1 · 01.08.2026 · Qadoq Servis», button «Material kiritish», list col «Oxirgi postavshik».
- **b) ⚠️ RETROACTIVE COST — CONFIRMED, reported (not patched):** the client stores NO per-line material
  cost snapshot (`CatalogMaterialUsage` = packaging + quantity only). Live client lookups: `hisob-kitob
  page.tsx:862` shows a HISTORICAL sale's material line as `quantity × packaging_detail.cost_price`
  (CURRENT price → shifts on every receive); `KatalogModal:221-222` composer preview reads current
  cost (fine, new items). Authoritative accounting = server `material_cost_total` / per-sale
  `material_cost` (branch.ts:100, finance.ts:140), displayed as-is, never recomputed client-side.
  Whether the SERVER snapshots material_cost at sale time or recomputes from the current material price
  is unknowable read-only. → LIST 2 (priority). Same class as the transferred-stem hole.
- **c) Write paths:** material-movements GET-only. `MoveModal` previously did BOTH in+out via
  `materialMovement`; the "Kirim (+)" bypassed deliveries. FIXED: incoming now goes through
  `material-deliveries/{id}/receive/` (carries delivery+supplier); MoveModal is now CHIQIM-only. One
  way to add stock. Material create's "Boshlang'ich soni" kept (initial count, unchanged per spec).
- **d) Zero-is-a-value:** `buildMaterialReceivePayload` — empty/null cost_price → key OMITTED (price
  unchanged); typed "0" → sends "0" + loud warning (`receiveZeroCost`). Vitest: empty-omits / "0"-sends
  / real-value / qty<1-rejected.
- **e) Material must exist first:** «+ Yangi material» inside the receive picker opens the existing
  `MaterialModal` (exported from MaterialSklad) as a nested modal; on save it selects the new record —
  receive-modal state preserved.
- **DELETE mismatch:** OpenAPI exposes DELETE /api/material-deliveries/{id}/ but the spec omits it →
  followed the spec, NO delete/archive offered for material yuklari (reported).

## §1 — IA decision
A **Gul yuklari / Material yuklari segment INSIDE the existing «Yuklar» tab** (not a 5th tab) —
mirrors the «Kirim-chiqim jurnali» tab's existing Gul/Material source segment. Follows the chip
convention. Material list cols: number·date·supplier·item_count·total_quantity·total_cost
(server-computed); key=id (number repeats); date shown beside number.

## Built
- `MaterialDeliveryModal` (create/edit, flower-Yuk twin), `MaterialDeliveryDrawer` (detail + items
  from /items/ + «Material kiritish»; NO delete), `MaterialReceiveModal` (grouped picker with current
  qty+cost, quantity min-1, cost_price optional, reason, ⚠️ CONSEQUENCE preview «Soni 50→150 /
  Tannarx 6 000→7 000» or «o'zgarmaydi», keep-open + added-so-far list, +Yangi material, field-keyed
  400s, notifyReportDataChanged). Sklad Yuklar tab: Gul/Material segment + material list.
- §3: MaterialCard «Oxirgi postavshik» from last_delivery (null → clean «—»); card→MaterialDetailModal
  (last-delivery block + history from material-movements?packaging=, delivery + unit_cost, legacy
  null-delivery rows rendered clean). MoveModal → Chiqim-only.
- §4: `DualQtyInput` — `defaultQtyMode` (pochka when spb>1, else dona) + `convertQty` (re-converts on
  switch, not reinterpret) + prominent chip «100 pochka = 2 500 dona». Defaulted: StockBatchModal (was
  pochka), FloristStockIssueModal, FloristStockReturnDrawer, BatchMovementModal, KatalogModal
  new/empty composition rows (existing rows stay dona — they hold absolute stems). The submitted field
  (received_bunches vs received_stems / quantity_stems) is unchanged — only the INPUT unit. Preview
  («Qoldiq X→Y») stays in dona. BatchEditModal has no toggle (numeric spb). Vitest in lib/qty.test.ts.
- §5: `Popover` now bakes a DEFAULT themed surface (bg var(--surface-solid) + border + shadow-lg via
  clsx-merged base class) — the florist row menu was see-through because Popover rendered no surface
  and that one call site passed no background. Central fix benefits every menu; other consumers
  (Select/DatePicker/DateChips/TimePicker/LeadStatusManager) already pass their own surface (inline bg
  + larger shadow win via Tailwind order) so they're unchanged. Only the florist CloseAdjustMenu was
  affected. Keyboard/focus/hover intact; z-95 body-portal stacking unchanged.
- 22 new Vitest (qty 9 + receive 13). 138 total, green.

## §6 — VERIFY
Live GETs: material-deliveries=0, materials=0, material-movements=0 → the whole material flow is
MOCK-VERIFIED (labelled). Screenshots (dark+light) confirm: material yuklari list, detail+add,
receive consequence, materials «Oxirgi postavshik» column (+ clean «—» for never-received), material
history, pochka-default with the «100 pochka = 2 500 dona» chip, and the FIXED (solid, readable) row
menu. tsc clean, no console errors. READ-ONLY: no writes fired.

## Untested write paths (added)
- POST /api/material-deliveries/ (create material yuk), PATCH /api/material-deliveries/{id}/ (edit).
- POST /api/material-deliveries/{id}/receive/ — ⚠️ with cost_price REWRITES the material's cost basis
  (retroactive: catalogs using this material shift). Wired to the receive modal; NEVER fired.

## LIST 1 — MATERIAL YUK BLOCK (append; risk-annotated)
MD1. Yangi material yuki: Sklad → Yuklar → «Material yuklari» segment → «Yangi material yuki» → raqam
     (M-1) + sana + postavshik + izoh → ochish. REV (bo'sh yuk).
MD2. Ikkita material kiritish: yuk detali → «Material kiritish». BIRINCHISI narx BILAN (Soni 100,
     Tannarx 7 000) — CONSEQUENCE «50→150 / 6 000→7 000» ni tekshiring → Kiritish. IKKINCHISI narx SIZ
     (Tannarx bo'sh) — «Tannarx o'zgarmaydi» → Kiritish. Modal ochiq qoladi, «Shu yukka kiritildi»
     ro'yxati o'sadi. ⚠️ IRREV + narx berilgan material TANNARX ASOSINI DOIMIY o'zgartiradi (shu
     materialdan yasalgan eski katalog COGS'i siljiydi — LIST 2). Arzon test materiali ishlating.
MD3. Jamilar: yuk qatorida Xil=2, Dona=jami, Tannarx server hisobidan chiqqanini tasdiqlang. READ.
MD4. Oxirgi postavshik: Material sklad → kartada «Oxirgi postavshik: <postavshik> · M-1 · sana»
     chiqqanini; hech kirim bo'lmagan materialda «—» ekanini tekshiring. READ.
MD5. Tarix: material kartasini bosing → batafsil: oxirgi postavshik bloki + kirim tarixi (delivery +
     unit_cost). Eski (delivery=null) yozuvlar toza ko'rinsin. READ.
MD6. Kirim endi FAQAT receive orqali: Material sklad kartasidagi tugma «Chiqim» (kirim yo'q) —
     kirimni yukdan kiritasiz. READ.

## LIST 2 — RETROACTIVE MATERIAL COST (append)
o. ⚠️ MATERIAL TANNARXI RETROAKTIV (PRIORITET) — material BITTA qatorli tannarxga ega; har receive
   uni QAYTA YOZADI. Katalog material qatori faqat packaging id + quantity saqlaydi, tannarx material
   qatorining JORIY qiymatidan o'qiladi. Client per-line ko'rsatuvlari (hisob-kitob CatalogDetail)
   receive'dan keyin siljiydi. Avtoritativ pul — server `material_cost_total`. SETTLE: (1) server
   sotuv paytida `material_cost`ni SNAPSHOT qiladimi yoki so'rov paytida joriy material narxidan qayta
   hisoblaydimi? (2) qayta hisoblasa — o'tgan oydagi «O'rta savat»li katalog foydasi bugungi receive'da
   siljiydi. Transferred-stem teshigi bilan bir sinf. Backend qaror.

---

# BATCH received_stems CORRECTION (2026-08-03)

## LIST 1 — append (risk-annotated)

BR1. **Partiya «Kelgan miqdor»ni to'g'rilash — OSHIRISH.** Sklad → partiya kartasi → Tahrirlash →
     «Kelgan miqdor — to'g'rilash». Dona/Pochka tugmasi create formadagidek (pochka sukut bo'yicha,
     jonli konversiya). 100 → 150 qiling: oqibat bloki «Kelgan 100 → 150 · Ishlatilgan 80 ·
     Qoldiq 20 → 70» ko'rsatadi, retroaktiv ogohlantirish chiqadi. Saqlang. **REV** (qayta
     tahrirlab qaytarasiz), lekin **tannarx raqamlari siljiydi** — hisobotni keyin solishtiring.

BR2. **XAVFSIZ kamaytirish.** Ishlatilgandan KO'P qiymatga kamaytiring (masalan ishlatilgan 80
     bo'lsa 90 ga). Qoldiq 20 → 10 ko'rinadi, saqlanadi. **REV**, ammo ⚠️ **RETROAKTIV: partiya
     jami va YUK jamilari (dona + tannarx) qayta hisoblanadi** — o'sha yukning hisobot raqamlari
     o'zgaradi. Saqlangach Sklad → Yuklar ro'yxatida jami yangilanganini tekshiring.

BR3. **BLOKLANGAN holat (asosiy tekshiruv).** Ishlatilgandan KAM qiymat kiriting (ishlatilgan 80,
     siz 50 yozasiz). Kutilgan: qoldiq «20 → −30» qizil, «Bu partiyadan 80 dona allaqachon
     ishlatilgan…» bloki muqobillari bilan (chiqitga yozish / harakatlarni to'g'rilash),
     **«Saqlash» o'chirilgan**. Server'ga HECH NARSA ketmaydi. **READ** (hech qanday yozuv yo'q).

BR4. **Faqat o'zgargan kalitlar.** Kelgan miqdorni tegmasdan boshqa maydonni (masalan Izoh)
     o'zgartiring — payload'da `received_stems` BO'LMASLIGI kerak (modal ostidagi «Faqat o'zgargan
     maydon(lar) saqlanadi: …» satri buni ko'rsatadi). **REV**.

## LIST 2 — append (PRIORITET)

p. ⚠️ **`received_stems` O'ZGARGANDA `remaining_stems` NIMA BO'LADI? (PRIORITET — read-only hal
   qilinmadi.)** Jonli OpenAPI: `received_stems` VA `remaining_stems` IKKALASI ham PATCH'da
   yoziladigan (readOnly EMAS, min 0); `remaining_bunches` esa readOnly (hosila). Ya'ni qoldiq
   ALOHIDA saqlanadigan maydon — server `received_stems` o'zgarganda uni QAYTA HISOBLAMASLIGI
   ehtimoli katta. SETTLE: `PATCH {received_stems: 150}` yuborilganda server (1) qoldiqni
   received − consumed bo'yicha qayta hisoblaydimi, (2) boshlang'ich «Partiya kirimi» harakatini
   to'g'rilaydimi, yoki (3) qoldiqni ESKIRGAN holda qoldiradimi? (3) bo'lsa — partiyani oshirish
   qoldiqni oshirMAYDI va sklad jimgina noto'g'ri bo'lib qoladi; u holda frontend `remaining_stems`
   ni ham hisoblab yuborishi kerakmi (xavfli) yoki backend buni o'zi qilishi kerakmi?
   **Frontend hozircha faqat `received_stems` yuboradi va ishlatilgandan kam qiymatni bloklaydi.**

q. **Manfiy qoldiq himoyasi serverda bormi?** `remaining_stems` da `min 0` bor, lekin
   `received_stems` kamaytirilganda server rad etadimi, 0 ga qisadimi yoki manfiyga yo'l qo'yadimi —
   aniqlanmadi. Klientda qat'iy bloklandi (500 ko'rmaslik uchun), ammo boshqa klient/skript orqali
   yozilishi mumkin. Backend serializer darajasida validatsiya qo'shsin.

---

# STANDARD CATALOG — VOLUME-RATE GATE (2026-08-03)

## Live audit (read-only): who can actually create a standard catalog

`GET /api/florists/` + `GET /api/florist-volume-rates/?page_size=300` — 10 florists, 24 active rates.

| Florist | staff_type | active rates | standard catalog? |
|---|---|---|---|
| Abror (#4), Bekzod (#6), Isroil (#7), Fatxulloh (#8) | florist | 6 each (bouquet+basket × small/medium/large) | ✅ any size |
| **Abubakir (#5)** | florist | 0 | ❌ blocked — **real gap, needs rates** |
| **Location Test (#14)** | florist | 0 | ❌ blocked (test account) |
| Zafar (#9), Azimjon (#10), Abror (#11), ShoxAkbar (#12) | **apprentice** | 0 | ❌ blocked **by design** |

**6 of 10 blocked, but only 2 are genuine gaps.** The four apprentices are structurally excluded:
per FRONTEND_FLORIST_VOLUME_RATES.md, changing `staff_type` to `apprentice` deactivates all their
rates (apprentices are on daily pay). Consequence worth deciding on: **an apprentice can never be
the florist on a standard catalog.** If apprentices are expected to assemble standard bouquets,
that is a backend/product decision, not a frontend one.

Also structural: `FloristVolumeRate.arrangement_type` enum is `bouquet|basket` only — **`box` can
never have a rate**, so a box + florist standard catalog is impossible by construction. The
composer already hides `box` in florist mode, so this is consistent, not a new bug.

## What the UI does now
- `catalogRateMissing(kind, florist, volume, arrangement, rates)` — pure, tested. **Standard only**;
  custom never blocks (its salary is entered by hand, spec §3).
- Save is **blocked client-side** — no POST is issued (asserted in the screenshot run), so the
  operator never meets the server's `{volume: [...]}` 400.
- The warning names the florist and the size, links straight to that florist's rates
  (`/floristlar/{id}#rates`), and adds an apprentice-specific explanation when relevant.
- §3's other half: for **standard**, "Florist ish haqi" is now read-only text from the tariff
  ("Hajm tarifidan — qo'lda o'zgartirilmaydi"); **custom** keeps the editable input.

## LIST 2 — append
r. **Apprentices cannot be assigned standard catalogs at all** (rates auto-deactivated + §3 gate).
   Confirm this is intended. If apprentices do assemble standard items, either allow rates for
   apprentices or give standard catalogs a fallback salary source.
s. **Does the backend still ignore `florist_salary_amount` on standard?** Spec §3 says it is
   ignored and the tariff value is returned, but the code carries a later contradicting comment
   ("HAR IKKI rejimda AYNAN yuboriladi — backend tarif bilan bosib o'tmaydi"). We kept **sending**
   it (harmless either way, and it already equals the tariff since we auto-fill from it) but made
   the input read-only. Confirm which is true so the key can be dropped for standard.

---

# TEKIN GUL (is_free) + SKLAD ORDERING/FILTERS (2026-08-03)

## Live GETs (read-only)

### §1c — is_free audit
```
GET /api/stock-batches/?is_free=true   → count = 0
GET /api/stock-batches/?is_free=false  → count = 87   (= all 87 batches)
jami partiya: 87
⚠️ cost_per_stem = 0 AMMO is_free = false: 0
```
**Nothing is currently free, and no batch has a zero cost without the flag** — so the confusing
case ("0 cost that isn't deliberate") does not exist today. The TEKIN tag will therefore only ever
appear on batches that really were gifted.

### §4 — legacy batches with no delivery
```
GET /api/stock-batches/ → delivery = null bo'lganlar: 0 / 87
```
None exist. The supplier page still renders a **"Yuksiz partiyalar (eski yozuvlar)"** group
(always last) so such rows can never be dropped silently if any appear later.

### §2 — what the server can actually order by
```
?ordering=-id           → [62, 73, 74, 75, 76, 77, 79, 80]   (= unordered baseline → IGNORED)
?ordering=-created_at   → [62, 73, 74, 75, 76, 77, 79, 80]   (IGNORED)
?ordering=-received_at  → [107, 110, 105, 106, 108, 109, ...] (honoured)
?ordering=-received_at,-id → identical to -received_at        (secondary key DROPPED)
```
Only `received_at` is an accepted ordering field, and it is a **DATE**: 46 batches share
2026-08-02 and 21 share 2026-08-01. Worse, **two identical `-received_at` calls returned different
within-day orders**, i.e. the server ordering is unstable inside a day.

**Chosen approach:** ask the server for `?ordering=-received_at` (so pagination stays correct),
then apply `compareBatchNewestFirst` on the client — `received_at ↓ → created_at ↓ → id ↓`.
The client tiebreaker is safe here because `api.list()` de-paginates (follows `next` up to 5 pages),
so the whole set is in memory before sorting. Same comparator is used for Partiyalar, Yuklar, the
delivery detail's batch list and the supplier detail.

### §3 / §1c filters
`?variant=` (int), `?is_free=` (bool) and `?delivery=` (int) all exist and work.
`?delivery=<id>` returns **exactly** the same rows as the nested
`/api/stock-deliveries/{id}/batches/` (verified id 23 → identical 18 ids). It does **not**
simplify existing code — `api.deliveryBatches()` is already a one-liner — so that call was left
alone; the real value of `?delivery=` is that it composes with `is_free`/`variant`/`ordering` in a
single request, which the nested route cannot.

## LIST 1 — append

TG1. **Tekin partiya yaratish.** Sklad → Yuklar → yuk → «Gul qo'shish». Narx bo'limi tepasidagi
     «Postavshik tekinga qo'shib bergan» belgisini yoqing — **tannarx maydonlari YO'QOLADI**
     (disable emas), sotuv narxi qoladi va majburiy. Saqlang. **REV** (partiyani tahrirlab
     qaytarish mumkin), lekin ⚠️ tannarx asosini belgilaydi.
TG2. **⚠️ POSTAVSHIK QARZI QIMIRLAMASLIGI KERAK.** TG1 dan oldin va keyin Yetkazib beruvchilar →
     o'sha postavshik → `purchase_total` / qarzni yozib oling: **o'zgarmasligi shart** (tekin gul
     uchun pul to'lanmaydi). Agar qarz oshsa — backend `is_free` ni hisobga olmayapti, DARHOL
     xabar bering. **READ** (faqat solishtirish).
TG3. **TEKIN yorlig'i hamma joyda.** Partiyalar ro'yxati, yuk detali, partiya drawer'i va
     tanlagichlar (kompozitor, floristga chiqarish, chiqit, tuzatish) — hammasida nom yonida
     `TEKIN`, tannarx esa «0 so'm · tekin» bo'lib o'qilishi kerak (yalang 0 EMAS). **READ.**
TG4. **Tekin guldan katalog.** Tekin partiyadan katalog yasang: Hisob-kitob → 2-bo'lim qatorini
     oching — tarkib qatorida `TEKIN` va «Tarkibida tekin gul bor — marja yuqori ko'rinadi»
     izohi chiqadi. **Raqamlar o'zgartirilmagan**, faqat sabab aytilgan. **REV.**
TG5. **Tartib.** Yangi partiya qo'shing — u ro'yxatning BOSHIDA (chap-yuqorida) turishi kerak.
     Sahifani bir necha marta yangilang: tartib **sakramasligi** shart (barqaror tiebreaker).
     ⚠️ Ilgari bu yerda «kam qoldiq yuqoriga» tartibi bor edi va u endi «Kam qolgan partiyalar»
     chipiga ko'chdi. **READ.**
TG6. **Filtrlar birga.** «Tekin» + «Gul navi» + «Tugagan partiyalar» — uchtasi bir-birini
     tozalamasligi kerak; URL `?free=…&variant=…` bo'lib yangilanadi va sahifani yangilaganda
     saqlanadi. **READ.**

## LIST 2 — append
t. **`is_free` PATCH'da — hal qilindi, lekin xatti-harakati emas.** `PatchedStockBatch.is_free`
   yoziladi (readOnly EMAS), shuning uchun tahrirlashga ruxsat berdik va RETROAKTIV ogohlantirish
   qo'ydik. **Ochiq savol:** mavjud partiyani `is_free: true` ga o'tkazganda server allaqachon
   yasalgan kataloglarning `flower_cost`ini QAYTA hisoblaydimi, yoki faqat yangi sarflarga
   ta'sir qiladimi? Bu javob «retroaktiv» so'zining ma'nosini belgilaydi.
u. **Teskari yo'nalish:** `is_free: true` → `false` qilinganda tannarx qayerdan olinadi? Biz
   formada saqlangan qiymatni qayta yuboramiz, lekin server 0 bo'lib qolgan tannarxni tiklay
   oladimi yoki operator qo'lda kiritishi shartmi — tasdiqlansin.

---

# BACKDATING — created_at (2026-08-03)

## §2 Consistency table — every date input in the app

| Where | Field | Component | `+05:00`? | Omits when unchanged? | Blocks future? |
|---|---|---|---|---|---|
| Sell dialog | `sold_at` | own toggle + `DatePicker withTime` | ❌ → **FIXED** (`withTashkentOffset`) | ✅ | ❌ → **FIXED** (`maxDate`) |
| Batch movement | `created_at` | own toggle + `DatePicker withTime` | ❌ → **FIXED** | ✅ | ⚠️ still open (see below) |
| Flower delivery | `received_at` | `DatePicker` (date-only) | n/a — date field | ✅ | ⚠️ open |
| Material delivery | `received_at` | `DatePicker` (date-only) | n/a | ✅ | ⚠️ open |
| Batch edit | `received_at` | `DatePicker` (date-only) | n/a | ✅ changed-keys | ⚠️ open |
| Supplier payment | `paid_at` | `DatePicker` (date-only) | n/a | always sent (create form) | ⚠️ open |
| **Florist issue / bulk** | `created_at` | **`BackdateField`** | ✅ | ✅ | ✅ |
| **Return / waste** | `created_at` | **`BackdateField`** | ✅ | ✅ | ✅ |
| **Catalog create** | `created_at` | **`BackdateField`** | ✅ | ✅ | ✅ |
| **Catalog edit** | `created_at` | **`BackdateField`** (always open) | ✅ | ✅ only if changed | ✅ |
| Material receive | — | **no date field exists** | — | — | — |

**The odd one out was not one field — it was all of them.** `DatePicker withTime` emits
`"YYYY-MM-DDTHH:mm"` with **no offset**, and `+05:00` appeared nowhere in application code. A
`sold_at` of `23:30` was therefore liable to be read as UTC and stored on the **following day**.
Fixed at the two datetime call sites via `withTashkentOffset()`; the date-only fields (`received_at`,
`paid_at`) are unaffected because they carry no time component.

**Deliberately not changed:** future-date blocking on deliveries / `paid_at` / batch movement.
A delivery or a payment legitimately *can* be dated forward (scheduled arrival, post-dated
payment), so blocking there is a product decision, not a bug fix. Flagged rather than assumed.

## LIST 1 — append

BD1. **Orqaga sanali chiqim.** Floristlarga chiqarilgan → «Skladdan chiqarish» → florist va gul
     tanlang → «Boshqa chiqim sanasi» belgisini yoqing → o'tgan kunni tanlang. Sariq ogohlantirish
     chiqishi shart. Saqlang, so'ng **Sklad → Kirim-chiqim jurnali** da yozuv **o'sha kunda**
     turganini tekshiring (bugungi kunda EMAS). **⚠️ REV lekin RETROAKTIV** — o'sha kunlik
     hisobotlar (florist kunlik, davr filtrlari) o'zgaradi.
BD2. **Orqaga sanali katalog.** Katalog → «Katalogga qo'shish» → florist + hajm + gul → «Boshqa
     sana» → o'tgan kun. Saqlagach **Floristlar → o'sha florist → kunlik grafik** da ish haqi
     **o'sha kunga** tushganini tekshiring. **⚠️ RETROAKTIV** — florist kunlik hisoboti o'zgaradi.
BD3. **Sanani keyin tuzatish.** Shu katalogni tahrirlang, «Sana»ni boshqa kunga o'zgartiring.
     Katalog, tarix yozuvi VA ish haqi sanasi BIRGA siljishi kerak. Sana tegilmasa payload'da
     `created_at` BO'LMASLIGI kerak. **⚠️ RETROAKTIV, ikki marta siljiydi.**
BD4. **Kelajak sana bloklanishi.** Kalendarda bugundan keyingi kunlar **bosilmaydi** (o'chirilgan).
     **READ.**
BD5. **Sotuv sanasi ALOHIDA.** Orqaga sanali katalogni soting — sotuv sanasi BUGUN bo'lib qoladi
     (`sold_at` boshqa maydon). Yaratilish sanasi sotuvni orqaga surmaydi. **READ.**

## LIST 2 — append
v. **bulk-issue xato semantikasi hamon HUJJATLASHTIRILMAGAN.** OpenAPI faqat `200` javobini
   e'lon qiladi (`PaginatedFloristStockIssueList`); 400 ning shakli yo'q. Biz uni «hammasi yoki
   hech biri» deb qabul qilamiz (barcha qatorlar saqlanadi, server `detail` matni ichidan partiya
   raqamiga qarab aybdor qator belgilanadi). SETTLE: (1) qisman muvaffaqiyat bo'lishi mumkinmi?
   (2) 400 tanasi qaysi qator xato ekanini MASHINA O'QIY OLADIGAN shaklda beradimi (masalan
   `items[i]` indeksi bilan)? Hozircha matnga qarab taxmin qilamiz.
w. **Kelajak sana:** yetkazib berish (`received_at`), to'lov (`paid_at`) va partiya harakati
   uchun kelajak sana ATAYLAB bloklanmadi (rejalashtirilgan yuk / kechiktirilgan to'lov qonuniy
   bo'lishi mumkin). Tasdiqlansin — bloklash kerakmi?
