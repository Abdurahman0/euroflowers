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

---

# SUPPLIER DEBT REMOVAL + FULL BATCH EDITING (2026-08-03)

## §1 — «Qarz» olib tashlandi: jonli audit

Read-only GET `/api/suppliers/` (11 ta postavshik) va `/api/schema/?format=json`:

- `outstanding` **hech bir javobda yo'q** (11/11) va OpenAPI `Supplier` sxemasida ham yo'q.
  Ya'ni maydon endi umuman kelmaydi — bizdagi `Supplier.outstanding` o'lik tur edi.
- `?ordering=outstanding` kod bazasida **ishlatilmagan edi** — olib tashlanadigan saralash yo'q.
- `purchase_total` va `paid_total` joyida, `last_payment_at` ham. `/api/supplier-payments/` tegilmadi.

### Nomlash (spec'dagi noaniqlik — qaror qabul qilindi)

Spec `purchase_total` uchun «Umumiy sotib olingan» deydi, `paid_total` uchun nom bermaydi.
Ikkalasi yonma-yon turgani uchun foydalanuvchi ularni **ayirishga** urinishi tabiiy — aynan shu
qarz hisobi endi yo'q. Shuning uchun:

| Maydon | Ko'rinadigan nom |
|---|---|
| `purchase_total` | **«Umumiy sotib olingan»** |
| `paid_total` | **«Yozib borilgan to'lovlar»** («To'langan» EMAS — u ayirishga chorlaydi) |

Ustiga Hisob-kitob sahifasida Tip: *«⚠️ Bu QARZ EMAS — qarz hisobi yuritilmaydi, shuning uchun
sotib olingandan AYIRMANG.»*

### Nima o'zgardi

- `lib/types.ts` — `Supplier.outstanding` o'chirildi; `purchase_total`/`paid_total` izohlandi.
- `app/suppliers/page.tsx` — qarz chiplari o'rniga neytral «Sotib olingan {summa}» chipi.
- `app/hisob-kitob/page.tsx` — `debtTone` funksiyasi va **QARZ ustuni** o'chirildi; saralash
  chiplari endi `Sotib olingan` / `Oxirgi to'lov`; jadval ostidagi jami «To'lovlar jami».
- `lib/reportExports.ts` — `SupplierRow.debt` o'chirildi, eksport sarlavhalari yangilandi.

`is_free` partiyalar tannarxi nol bo'lgani uchun `purchase_total` ga kirmaydi — bu **serverda**
hal qilingan, frontend hech narsa ayirmaydi (jonli audit: 0 ta free partiya bor, ya'ni hozircha
farq ko'rinmaydi).

## §2 — Kelgan sonni tuzatish

**Tuzatish (spec bizni noto'g'ri ayblagan joyi):** bizdagi tekshiruv **hech qachon blanket blok
bo'lmagan**. U aynan `yangiKelgan < ishlatilgan` bo'lganda ishlaydi — bu spec talab qilgan
«ishlatilgan» chegarasining o'zi va serverning 400 sharti bilan bir xil. Spec'ning uchala qatori
ham bizda avvaldan to'g'ri ishlagan:

| Spec qatori | Bizdagi natija |
|---|---|
| 100 → 120 (80 ishlatilgan) | ruxsat, oldindan ko'rsatish: qoldiq 20 → **40** |
| 100 → 80 (kamaytirish) | **ruxsat** (bloklanmagan), qoldiq 20 → 0 |
| 120 → 10 (80 ishlatilgan) | **bloklanadi** — serverning 400'i bilan bir xil shart |

Qo'shilgani — **oqibatni oldindan ko'rsatish**, chunki ilgari foydalanuvchi qoldiq ham
siljishini bilmasdi:

```
Kelgan miqdor  [ 90 ]
Bu partiyadan 80 dona ishlatilgan. Kamida shuncha bo'lishi kerak.
┌─────────────────────────────────┐
│ Kelgan       100 → 90 dona      │
│ Ishlatilgan       80 dona       │
│ Qoldiq        20 → 10 dona      │
└─────────────────────────────────┘
```

`lib/inventory.ts` → `receivedEditConsequence(received, remaining, next)` sof funksiya; ishlatilgan
= `received − remaining`, yangi qoldiq = `next − ishlatilgan` (0 dan past emas).

### Qo'lda qoldiq (inventarizatsiya)

Spec `remaining_stems` ni aniq yuborish avtomatik hisobni **bekor qilishini** aytadi. Shuning uchun
u tasodifan yuborilmaydi: alohida **«Qoldiqni qo'lda belgilash (inventarizatsiya)»** belgisi bor,
belgilanmaguncha `remaining_stems` payload'ga **umuman tushmaydi**. Belgilanganda qizil ogohlantirish:
*«Server avtomatik hisobi BEKOR QILINADI — aynan siz yozgan son qo'yiladi.»*

## §3 — To'liq partiya tahriri: qaysi maydonlar

OpenAPI `PatchedStockBatch` bo'yicha **yaratish formasidagi har bir maydon PATCH'da ham
yoziladigan** — tahrirlab bo'lmaydigan create-maydoni **yo'q**. Qo'shilganlari:

- **`variant`** (gul navi) — retroaktiv izoh bilan: avval yasalgan kataloglar tarkibi shu partiyaga
  bog'langan, nav o'zgarsa ular ham boshqa gulni ko'rsatadi.
- **`delivery`** (qaysi yuk) — postavshik **yuk orqali** aniqlanadi, shuning uchun yukni almashtirish
  postavshikni ham almashtiradi; forma buni ochiq yozadi va yuk jamilarini (dona va tannarx) ikkala
  tomonda qayta hisoblanishini eslatadi.
- `stems_per_bunch` o'zgarganda **dona narxi oldindan ko'rsatiladi** (pochka narxi bo'linadi).

**Umumiy forma ajratilmadi** (ataylab): create va edit haqiqatan ajralib ketgan — create yukka
bog'langan va gul→nav kaskadi bor, edit'da esa o'zgarmas provenance sarlavhasi, kelgan sonni
tuzatish, qo'lda qoldiq va retroaktiv ogohlantirishlar bor. Bitta formaga siqish shartlarni
ko'paytirardi. Payload mantiqi esa **allaqachon umumiy** — `lib/inventory.ts` dagi
`buildBatchEditPayload` (faqat o'zgargan kalitlar) va `batchEditIsRetroactive`.

## §4 — Verify

`tsc --noEmit` toza · **275/275 Vitest** o'tdi · konsol/sahifa xatosi yo'q (dark + light).

Skrinshotlar (ikkala mavzu): postavshik ro'yxati va Hisob-kitob — qarz ustuni yo'q; partiya tahriri
to'liq maydon to'plami bilan; kelgan-son izohi va oqibat bloki; qo'lda qoldiq affordansi.
Tahrir oynasidagi maydonlar (skript o'qigan holda): Gul bo'yi · Kelgan sana · Minimal sotuv ·
Pochkada dona · **Gul navi** · **Qaysi yukka** · Izoh · Kelgan miqdor · Qoldiqni qo'lda belgilash ·
Tekin belgisi · Pochka tannarxi · Pochka sotuv narxi.

Jonli misol (read-only GET): partiya **#62 №01:00** — `received=100, remaining=0` → ishlatilgan
**100**, ya'ni bu partiyada kelgan sonni 100 dan past qilib bo'lmaydi.

## LIST 1 — append (risk-annotated)

SB1. **Postavshik qarzsiz.** Postavshiklar va Hisob-kitob → Postavshiklar: hech qayerda «Qarz»
     ustuni/chipi bo'lmasligi kerak. «Umumiy sotib olingan» va «Yozib borilgan to'lovlar»
     ko'rinadi. Eksport (CSV/PDF) da ham qarz ustuni yo'q. **READ.**
SB2. **Kelgan sonni OSHIRISH.** Qisman ishlatilgan partiyani tahrirlang, kelgan sonni oshiring —
     oyna ichidagi blok qoldiq qancha bo'lishini oldindan ko'rsatadi. Saqlang va qoldiq **aynan
     shu songa** o'tganini, «Kirim-chiqim jurnali»dagi kirim yozuvi ham yangilanganini tekshiring.
     **⚠️ RETROAKTIV** — partiya jami va yuk jamilari qayta hisoblanadi.
SB3. **Kelgan sonni KAMAYTIRISH (yangilangan qadam).** Ishlatilgandan **ko'p** qiymatga kamaytirish
     endi **ruxsat etiladi** — chegara ishlatilgan son. Masalan 100 kelgan / 80 ishlatilgan →
     90 ga tushiring: qoldiq 20 → 10. So'ng 70 ga urinib ko'ring — forma bloklaydi (server ham
     400 qaytaradi). **⚠️ RETROAKTIV.**
SB4. **Qo'lda qoldiq.** «Qoldiqni qo'lda belgilash» ni yoqing, qoldiqni o'zingiz yozing va saqlang —
     avtomatik hisob EMAS, aynan siz yozgan son qo'yilishi kerak. Belgini yoqmasangiz payload'da
     `remaining_stems` **BO'LMASLIGI** kerak. **⚠️ XAVFLI — sklad sonini to'g'ridan-to'g'ri yozadi.**
SB5. **Nav va yukni almashtirish.** Tahrirda «Gul navi» ni o'zgartiring — shu partiyadan yasalgan
     eski kataloglar tarkibi ham yangi navni ko'rsatadimi? So'ng «Qaysi yukka» ni boshqa
     postavshikning yukiga o'tkazing — ikkala yuk jamilari (dona va tannarx) qayta hisoblanadimi?
     **⚠️ QAYTMAS EMAS lekin RETROAKTIV va POSTAVSHIK O'ZGARADI.** Test partiyasida sinang.
SB6. **Faqat narx tahriri.** Faqat sotuv narxini o'zgartiring — qoldiqqa TEGILMASLIGI kerak va
     payload'da `received_stems`/`remaining_stems` bo'lmasligi kerak. **READ.**

## LIST 2 — javob berilgan

- **p — JAVOB BERILDI.** Server `received_stems` o'zgarganda qoldiqni **farq qancha bo'lsa
  o'shancha siljitadi** (100→120, 30 ishlatilgan ⇒ qoldiq 90) va **boshlang'ich kirim harakatini
  ham yangi songa moslaydi**; chiqim yozuvlariga tegmaydi. Ya'ni (1)-variant. Frontend qoldiqni
  o'zi hisoblab yubormaydi — faqat oldindan ko'rsatadi.
- **q — JAVOB BERILDI.** Server ishlatilgandan kam qiymatni **400 bilan rad etadi** («Bu partiyadan
  allaqachon N dona ishlatilgan…»), 0 ga qismaydi va manfiyga yo'l qo'ymaydi. Klientdagi bloklash
  serverning shartiga aynan mos — dublikat emas, faqat 400 ni oldini oladi.
- **Yangi:** qo'lda `remaining_stems` yuborilganda server avtomatik hisobni **bekor qiladi**
  (spec §2). Shuning uchun frontend uni faqat aniq belgilangan inventarizatsiya rejimida yuboradi.

## Untested write paths (added — READ-ONLY, none fired)

- `PATCH /api/stock-batches/{id}/` `{ received_stems }` — kelgan sonni tuzatish
- `PATCH /api/stock-batches/{id}/` `{ received_stems, remaining_stems }` — qo'lda inventarizatsiya
- `PATCH /api/stock-batches/{id}/` `{ variant }` — nav almashtirish
- `PATCH /api/stock-batches/{id}/` `{ delivery }` — yukni (va shu bilan postavshikni) almashtirish

### §1 follow-up — TEKIN matnlari «qarz» deyishdan to'xtatildi

`outstanding` olib tashlangach, TEKIN ishidan qolgan uchta matn hamon «postavshik **qarziga**
qo'shilmaydi» der edi — endi mavjud bo'lmagan tushunchaga havola. Uchalasi ham «Umumiy sotib
olingan»ga o'tkazildi: `components/FreeBatchChip.tsx` (tooltip), `components/FreeBatchToggle.tsx`
(yordamchi matn), `lib/types.ts` (`StockBatch.is_free` izohi). Boshqa `qarz` uchrashuvi —
`app/bronlar/page.tsx` dagi «Qolgan qarz» — MIJOZ oldindan to'lovi, postavshikka aloqasi yo'q,
tegilmadi.

---

# QARZDORLAR — QARZGA SOTISH (2026-08-03)

## §5 — Jonli GET'lar (read-only, hech qanday yozuv yuborilmadi)

```
GET /api/debts/by-customer/                   → 200
{"customers": [], "totals": {"customer_count": 0, "debt_count": 0,
                             "unpaid_total": 0.0, "paid_total": 0.0}}

GET /api/debts/                               → 200
{"count": 0, "next": null, "previous": null, "results": []}

GET /api/debts/?is_paid=false                 → 200   (count 0)
GET /api/debts/by-customer/?include_paid=true → 200   (customers [])
```

**Hozircha bironta ham qarz YO'Q** — endpoint'lar tirik, ma'lumot bo'sh.

⚠️ **Kontrakt nomuvofiqligi (spec vs jonli javob):** spec `unpaid_total` ni `"450000.00"`
(STRING) deb ko'rsatadi, jonli server esa bo'sh holatda `0.0` (NUMBER) qaytardi. Ikkalasini
ham xavfsiz o'qish uchun `debtNum()` yozildi (test bilan qoplangan).

## §0 — BESH AUDIT

### a) Parity — READ-ONLY TEKSHIRIB BO'LMAYDI (LIST 2, PRIORITET)

Hozirgi jonli holat:

| Manba | Maydon | Qiymat |
|---|---|---|
| `/api/accounting/` | `summary.total_sales` | `"7080000.00"` |
| `/api/dashboard/` | `period_catalog_sales_revenue` | `7080000.0` |
| `/api/analytics/` | `summary.catalog_sales_revenue` | `7080000.0` |

Uchalasi **mos** — lekin serverda **0 ta qarz** bor, ya'ni bu qarzning chiqarib
tashlanishi haqida HECH NARSA isbotlamaydi. Isbotlash uchun qarzga sotish kerak — bu YOZUV.

Aniqlangani: accounting `by_payment` da faqat `cash`/`card`/`unknown` bor — **qarz uchun
ustun YO'Q**, ya'ni to'lanmagan qarz butunlay chiqarib tashlanishi ehtimoli yuqori.
Analytics javobida `debt` so'zi umuman uchramaydi. Va `/api/accounting/` OpenAPI'da
`"200": {"description": "No response body"}` — javob **umuman hujjatlashtirilmagan**,
ya'ni kontrakt kafolat bermaydi. Tuzatilmadi, LIST 2 ga yozildi.

### b) `sold_at` — `paid_from_debt` FAQAT BITTA YUZADA BOR

Jonli tekshiruv: `/api/accounting/` `history` massividagi **18/18 qatorda** `paid_from_debt`
bor (hammasi hozir `false`). Ammo:

| Yuza | `paid_from_debt` bormi | Belgi qo'yildimi |
|---|---|---|
| `/api/accounting/` `history` | ✅ **BOR** (jonli) | ✅ «qarzdan» chipi qo'shildi |
| OpenAPI (istalgan sxema) | ❌ **E'LON QILINMAGAN** | — (shuning uchun ixtiyoriy maydon) |
| Katalog itemning `history[]` qatorlari | ❌ yo'q | ❌ imkonsiz — maydon yo'q |
| `/api/analytics/` | ❌ yo'q | ❌ imkonsiz |

`sold_at` ning klientdagi HAMMA ishlatilishi ko'rib chiqildi:
`lib/exports.ts:102` (kunlik guruhlash), `app/hisob-kitob` (saralash + jadval),
`ClientModal`, `KatalogViewModal`, `app/analitika` (`last_sold_at`),
`app/floristlar/[id]` (`last_sold_at`), `saleLineAllocations`.

**HUKM: hech biri NOTO'G'RI raqam chiqarmaydi.** Kunlik guruhlash va saralash sotuvni
to'lov kuniga qo'yadi — bu pul HAQIQATAN kelgan kun, ya'ni to'g'ri.
`saleLineAllocations` sanaga bog'liq emas. Muammo faqat **odam o'qiganda**: ko'rsatilgan
sana gul do'kondan chiqqan kun emas. Ya'ni **hayratlanarli, xato emas** → belgi yetarli.

### c) Miqdor va pul — jadval

| Yuza | Miqdor+pul juftmi | Ta'sirlanadimi |
|---|---|---|
| accounting `summary` (`total_quantity` / `total_sales`) | ha | **yo'q** — bitta qatorlar to'plami, butunlay chiqarib tashlanadi |
| accounting `by_branch` (`sold_quantity` / `sold_revenue`) | ha | **yo'q** — o'sha manba |
| accounting `by_payment` / `by_kind` / `by_volume` | ha | **yo'q** — o'sha manba |
| analytics `catalog_sales_quantity` / `catalog_sales_revenue` | ha | **yo'q** — o'sha manba |
| analytics `top_catalog_items` (`quantity` / `revenue`) | ha | **yo'q** |
| `/api/branch-report/` (`sold_quantity` / `sold_revenue`) | ha | **noma'lum** — alohida endpoint, hujjatsiz |
| **katalog `quantity_sold` ↔ istalgan tushum hisoboti** | manbalar ARO | **HA** — miqdor sotuv kuni, pul to'lov kuni |
| **florist stats `sold_quantity` / `sale_revenue`** | ha | **ehtimol** — miqdor katalogdan, tushum accounting'dan bo'lsa |

**Muhim xulosa:** qator BUTUNLAY chiqarib tashlangani uchun har bir hisobot O'Z ICHIDA
izchil qoladi — ya'ni bitta endpoint ichidagi AOV **buzilmaydi**. Ajralish **manbalar
ARO**: sklad tomonidagi hisoblagichlar (katalog `quantity_sold`, `quantity_stock_deducted`)
va pul tomonidagi hisobotlar o'rtasida. Tuzatilmadi — bu topilma (LIST 2).

### d) Mijoz tanlagich — nima o'zgardi

`CustomerPicker` ga **uchta ixtiyoriy prop** qo'shildi; berilmasa xatti-harakat **AYNAN
ilgarigidek** (naqd/karta va katalog kompozitori yo'llari tegilmagan):

- `disabledModes` — rejim **YASHIRILMAYDI**, `disabled` + sabab bilan bosilmaydigan bo'ladi.
- `disabledReason` — sababi (tooltip + ostidagi matn).
- `requirePhone` — yangi mijozda ism+telefon ikkalasi kerakligini ko'rsatadi (bo'sh bo'lsa
  matn qizil bo'ladi).

⚠️ **Aniqlangan kamchilik:** umumiy `customerPayload` ism YOKI telefon bo'lsa ham yuboradi
(ism-only o'tib ketardi). Qarz uchun bu YETARLI EMAS — shuning uchun qarz yo'li
`customerPayload` ni ISHLATMAYDI, o'rniga `debtSellPayload` + `debtCustomerReady`
(ikkalasini ham talab qiladi). Umumiy funksiya **o'zgartirilmadi** — boshqa chaqiruvchilar
buzilmasin.

### e) Ruxsat va joylashuv

Sahifa ham, nav elementi ham `crm` da (inventory EMAS): `lib/branch.ts` NAV va
`Shell.tsx` `ROUTE_PERM` — bitta mezon, URL orqali ham ochilmaydi.

Natijaviy tartib (yuqori oltilik TEGILMAGAN): Dashboard · Sklad · Katalog · Floristlar ·
Floristlarga chiqarilgan · Gullar · AI chatlar → **Analitika · Hisob-kitob · Filial hisoboti ·
AI yordamchi · Buyurtmalar · Bronlar · Mijozlar · «Qarzdorlar» · Yetkazib beruvchilar ·
Postlar · Bildirishnomalar · Xodimlar · Integratsiyalar · Audit jurnali · Sozlamalar.**

⚠️ **Filial:** `Debt` sxemasida `branch` maydoni **YO'Q**, `by-customer` da `branch`
parametri **YO'Q** — qarz filial bo'yicha ajratiladimi noma'lum (LIST 2). Sukut:
ruxsat bergan joyda ko'rsatamiz (`branch.test.ts` shu qoidani qayd etadi).

## Qurilgani

- `lib/debt.ts` — sof mantiq: `debtCustomerReady`, `debtSellPayload`, `debtPayPayload`,
  `canPayDebt`, `debtQtyLabel`, `debtNum` + server matnlarining AYNAN nusxasi.
- `lib/debt.test.ts` — **32 ta test** (jami 307 ta o'tadi).
- `components/DebtPayModal.tsx` — usul majburiy (sukut yo'q), oqibat matni, tarixiy sana
  (`BackdateField`, +05:00), ikki marta to'lash to'sig'i, `notifyReportDataChanged()`.
- `app/qarzdorlar/page.tsx` — guruhlangan (sukut) + tekis ro'yxat, `?tab=` konvensiyasi,
  server filtrlari URL'da saqlanadi, `include_paid` toggle, rasmsiz qator degradatsiyasi.
- `components/KatalogSellModal.tsx` — uchinchi «Qarz» segmenti + tushuntirish + mijoz bloki
  + `debt_note` + toast.
- `app/hisob-kitob/page.tsx` — sotuv sanasi yonida «qarzdan» chipi.

### Qaror: qarzda SOTUV SANASI ko'rsatilmaydi

Qarz tanlansa «Boshqa sotuv sanasi» affordansi **butunlay yashiriladi** va o'rniga izoh
chiqadi. Sabab: `sold_at` ni backend TO'LOV kuniga qo'yadi — bu yerda tanlangan sana
baribir ustidan yozilardi, ya'ni operatorni aldardi. (Spec bu haqda jim — bu bizning
qarorimiz.)

### Qaror: qarzda PATCH qadami o'tkazib yuboriladi

⚠️ Modaldagi eski izoh «sell endpoint mijozni qabul qilmaydi» der edi — **endi ESKIRGAN**:
`CatalogSellRequest` da `customer`, `customer_name`, `customer_phone`, `debt_note` BOR
(OpenAPI bilan tasdiqlandi). Shuning uchun qarz yo'li bitta yozuv bilan ketadi (yarim
holat bo'lmaydi). Naqd/karta yo'li **o'zgarmadi** — ilgarigidek avval PATCH, keyin sell.

## §5 — Verify natijalari

`tsc --noEmit` toza · **307/307 Vitest** · konsol/sahifa xatosi yo'q (light 0 ta; dark'da
faqat bitta muvaffaqiyatsiz login urinishidan keyingi CORS xabari — skript artefakti).

Skrinshotlar (dark + light): `dbt-sell-qarz-*`, `dbt-grouped-expanded-*`, `dbt-pay-confirm-*`,
`dbt-pay-method-chosen-*`, `dbt-flat-list-*`.

Skript o'qigan holat:
```
SELL DEBT MODE: {"explain":true,"mandatory":true,"noneDisabled":true,"izoh":true,
                 "debtSum":true,"btn":{"text":"1 ta qarzga berish","disabled":true},"noDate":true}
QARZDORLAR:     {"jami":true,"total":"650 000","aziz":true,"chips":true}
EXPANDED:       {"items":true,"stems":true,"note":true,"payBtns":2,"imgs":1,"card":true}
PAY (usulsiz):  {"title":true,"required":true,"consequence":true,"dateToggle":true,
                 "submitDisabled":true}
usul tanlangach submit disabled: false
FLAT LIST:      {"rows":true,"paidMuted":true,"filters":true,"urlTab":true,"custLink":true}
RASMSIZ qator:  {"savatVisible":true,"savatAmount":true}   ← rasm yo'q, qator TO'LIQ ko'rinadi
```

## LIST 1 — QARZ BLOKI (append; risk-annotated)

⚠️ **BUTUN KETMA-KETLIK BITTA TEKSHIRUV** — qadamlarni ajratmang, ma'nosi shunda.

QZ1. **Qarzga sotish.** Katalog → biror mahsulot → «Sotish» → to'lov turi **«Qarz»**.
     «Biriktirmayman» **o'chirilgan** bo'lishi kerak. Mavjud mijoz tanlang (yoki yangi
     mijozga ism VA telefon kiriting), ixtiyoriy izoh yozing → «qarzga berish».
     **⚠️ QAYTMAS: sotuvning o'zi bekor qilinmaydi va gul SHU ZAHOTI skladdan yechiladi.**
QZ2. **Mijozsiz bloklanadi.** Qarz tanlab mijozni tanlamang — tugma **bosilmaydi**.
     Yangi mijozda faqat ism yozing (telefonsiz) — baribir bosilmaydi. **READ.**
QZ3. **⚠️ SAVDO KO'CHMAGANINI TEKSHIRING (eng muhim qadam).** Sotgandan darhol keyin
     Hisob-kitob va Dashboard'ni oching: **umumiy savdo O'ZGARMAGAN** bo'lishi kerak.
     Sklad esa kamaygan bo'ladi. **READ.**
     ⚠️ Shu yerda Dashboard/Analitika/Hisob-kitob raqamlari BIR-BIRIGA MOS ekanini ham
     tekshiring — §0a bo'yicha bu read-only tekshirib bo'lmagan (LIST 2 p-priority).
QZ4. **Qarzdorlar sahifasi.** Sahifada mijoz, telefon, qarz soni va summasi ko'rinsin;
     ochilganda gul rasmi, «N ta · M gul», summa, sana va izoh chiqsin. **READ.**
QZ5. **Karta bilan to'lash.** «To'landi» → usul tanlanmagan holda tugma **bosilmasin**
     → «Karta» tanlang → tasdiqlang. **⚠️ QAYTMAS: OpenAPI'da qarzni «to'lanmagan»ga
     QAYTARISH yo'li YO'Q** (pastga qarang).
QZ6. **⚠️ SAVDO KO'CHGANINI TEKSHIRING.** To'lovdan keyin: umumiy savdo **+qarz summasi**
     bo'lsin va u **KARTA ustuniga** tushsin, **to'lov kunida**. Hisob-kitob sotuvlar
     jadvalida o'sha qator yonida **«qarzdan»** belgisi chiqsin. **READ.**
QZ7. **Ikki marta to'lab bo'lmaydi.** To'langan qarzni yana to'lashga urinib ko'ring —
     «Bu qarz allaqachon to'langan» chiqishi kerak. **READ.**
QZ8. **Tarixiy to'lov.** «Boshqa to'lov sanasi» bilan o'tgan kunni tanlab to'lang —
     savdo **o'sha kunga** tushsin. **⚠️ RETROAKTIV** — o'sha kunlik hisobotlar o'zgaradi.
QZ9. **Chegirmali qarz.** «Arzonroq sotish» + «Qarz» birga: chegirma sababi majburiy
     bo'lib qolsin va qarz **chegirmali** summa bo'lsin. **READ.**

### ⚠️ Bekor qilish / qaytarish — OpenAPI bo'yicha ANIQ holat

Spec hech qanday bekor qilish yo'lini nomlamaydi. **OpenAPI esa boshqacharoq ko'rsatadi** —
to'liq ro'yxat:

```
GET/POST      /api/debts/
GET/PATCH/PUT/DELETE  /api/debts/{id}/
POST          /api/debts/{id}/pay/
```

Ya'ni: **`DELETE /api/debts/{id}/` MAVJUD** — qarz yozuvini butunlay o'chirish mumkin.
Ammo `is_paid`, `paid_at`, `paid_method` — **readOnly**, shuning uchun **«to'langan»ni
«to'lanmagan»ga PATCH bilan qaytarib bo'lmaydi**. Va qarz o'chirilsa sotuvning o'zi
(gul chiqimi) qaytmaydi. UI'da bekor qilish **ATAYLAB qo'yilmadi** — oqibati aniq emas
(savdoga tushgan pul nima bo'ladi?). LIST 2 ga savol yozildi.

## LIST 2 — append (PRIORITET)

x. ⚠️ **PARITET QARZ BILAN SAQLANADIMI? (PRIORITET — read-only hal qilinmadi.)**
   Bizning qabul mezonimiz: Dashboard `period_catalog_sales_revenue` == Analitika
   `catalog_sales_revenue` == Hisob-kitob `?branch=main` `total_sales`. Hozir uchalasi
   `7 080 000` — MOS, lekin serverda 0 ta qarz bor, ya'ni sinov bo'lmadi.
   SETTLE: to'lanmagan qarz **Dashboard va Analitika** dan ham chiqarib tashlanadimi
   (accounting'dagidek), yoki faqat `/api/accounting/` dan? Agar faqat accounting bo'lsa —
   birinchi qarz sotuvidayoq paritet BUZILADI va bu **bizning xatoimizdek** ko'rinadi.
   Qo'shimcha: `/api/accounting/` javobi OpenAPI'da umuman e'lon qilinmagan
   (`"200": {"description": "No response body"}`) — `paid_from_debt` ham shu sababli
   hujjatsiz. E'lon qilinsin.
y. **Miqdor va pul ajralishi (§0c).** Katalog `quantity_sold` sotuv kunida oshadi, tushum
   esa to'lov kunida keladi. Bitta endpoint ichida izchillik saqlanadi (qator butunlay
   chiqariladi), ammo **manbalar aro** — masalan katalog `quantity_sold` ↔ accounting
   tushumi — ajralish bor. `/api/branch-report/` va florist statistikasi qaysi manbadan
   olishini tasdiqlang: agar miqdor katalogdan, tushum accounting'dan bo'lsa, to'lovgacha
   bo'lgan oraliqda «bir dona uchun tushum» ko'rsatkichi buziladi.
z. **Qarz FILIAL bo'yicha ajratiladimi?** `Debt` sxemasida `branch` maydoni YO'Q,
   `/api/debts/by-customer/` da `branch` parametri YO'Q. Filial foydalanuvchisi
   BOSHQA filialning qarzlarini ko'radimi? Hozircha ruxsat (`crm`) bergan joyda
   ko'rsatamiz — bu xavfsiz sukut emas, tasdiqlansin.
aa. **Qarzni bekor qilish semantikasi.** `DELETE /api/debts/{id}/` bor, lekin: (1) qarz
   o'chirilsa sotuv va gul chiqimi qaytadimi? (2) TO'LANGAN qarzni o'chirsa savdodan
   pul ayriladimi? (3) `is_paid` readOnly bo'lgani uchun «noto'g'ri usul bilan to'ladim»
   holatini tuzatish yo'li bormi? Aniq bo'lmagani uchun UI'da bekor qilish YO'Q.
bb. **`by-customer` jamilarining turi.** Bo'sh holatda `unpaid_total: 0.0` (NUMBER)
   qaytdi, spec'da esa `"450000.00"` (STRING). Ma'lumot bo'lganda qaysi biri keladi?
   Biz ikkalasini ham o'qiymiz, lekin kontrakt bir xil bo'lgani ma'qul.

## Untested write paths (added — READ-ONLY, none fired)

- `POST /api/catalog/{id}/sell/` `{payment_type:"debt", customer, debt_note}` — bor mijozga qarz
- `POST /api/catalog/{id}/sell/` `{payment_type:"debt", customer_name, customer_phone}` — yangi mijoz
- `POST /api/catalog/{id}/sell/` `{payment_type:"debt", sale_price, discount_reason, …}` — chegirmali qarz
- `POST /api/debts/{id}/pay/` `{method}` — qarzni to'lash
- `POST /api/debts/{id}/pay/` `{method, paid_at}` — tarixiy to'lov (+05:00)

---

# SKLAD QIDIRUVI (BO'Y BILAN) + KATALOG TARTIBI (2026-08-03)

## 1. «prut 40» — ko'p so'zli qidiruv

Ilgari qidiruv BUTUN so'rovni bitta maydonga solishtirardi
(`[gul, nav, rang, partiya_raqami].some(includes(q))`), shuning uchun **«prut 40»
hech narsa topmasdi** — hech bir maydonda «prut 40» degan matn yo'q.

Endi `batchMatchesQuery` so'rovni **so'zlarga bo'ladi**: har bir so'z biror maydonga mos
kelishi kerak (so'zlar orasida **VA**, maydonlar orasida **YOKI**). Qidiriladigan
maydonlar: gul nomi · nav · rang · partiya raqami · **bo'y** (`40` ham, `40 sm` ham).

Tekshirilgan (uchta partiya: Prut 40, Prut 60, Atirgul 40):

| So'rov | Natija |
|---|---|
| `prut 40` | **faqat B-301** (Prut · 40 sm) |
| `prut` | B-301 + B-302 (ikkala Prut) |
| `40` | B-301 + B-303 (ikkala 40 sm) |
| `40 prut` | B-301 — so'z tartibi ahamiyatsiz |

Eski xatti-harakat saqlangan: nav (`freedom`), rang (`qizil`), partiya raqami (`b-0501`)
bo'yicha qidiruv ilgarigidek ishlaydi.

## 2. Katalog — oxirgi qo'shilgan CHAPDA birinchi

⚠️ **Bu haqiqiy nosozlik edi, faqat tartib xohishi emas.** Jonli tekshiruv:

```
GET /api/catalog/?ordering=-created_at&page_size=8
   id 147  created 2026-08-02T12:00:00     ← aralash!
   id 148  created 2026-08-02T12:00:00
   id 146  created 2026-08-02T12:00:00
   id 145  created 2026-08-02T12:00:00
   id 149  created 2026-08-02T12:00:00
   id 130  created 2026-08-01T21:14:13
```

Server `-created_at` ni **qabul qiladi**, ammo bir XIL `created_at` da tartib
**BARQAROR EMAS**. Va bu tasodifiy hol emas: `lib/backdate.ts` bo'yicha orqaga sanalgan
yozuv DOIM **12:00** ga qo'yiladi, ya'ni bir kunga surilgan HAMMA katalog aynan bir xil
vaqtga tushadi va har so'rovda o'rnini almashtiraveradi.

`compareCatalogNewestFirst` (vaqt ↓ → **id ↓**) buni barqarorlashtiradi. `id` — kiritilish
tartibining yagona ishonchli belgisi (orqaga sanash unga ta'sir qilmaydi).

Tekshirilgan: server `[147,148,146,145,149]` bergan holda ekranda
**`[149,148,147,146,145]`** chiqdi, qayta saralashda tartib o'zgarmadi.

⚠️ Eslatma: `sklad` dagi partiyalar uchun bu allaqachon hal qilingan edi
(`compareBatchNewestFirst`) — katalogda o'sha muammo qolib ketgan ekan.

**Tekshiruv:** tsc toza · **322/322 Vitest** (15 tasi shu ish uchun) · konsol xatosi yo'q ·
skrinshotlar dark + light (`srch-sklad-prut40-*`, `srch-katalog-order-*`).

---

# PARTIYA TAHRIRI QOIDALARI (2026-08-03)

## §0a — Spec ro'yxati ↔ bizdagi modal

| Spec ruxsat beradi | Bizda (avval) | Holat |
|---|---|---|
| `height_cm` | ✅ | — |
| `height_from_cm`, `height_to_cm` | ❌ yo'q edi | **qo'shildi** |
| `delivery` | ✅ | — |
| `supplier` (yuksiz partiyada) | ❌ yo'q edi | **qo'shildi, SHARTLI** |
| `received_at` | ⚠️ SHARTSIZ tahrirlanardi | **yuk bo'lsa read-only qilindi** |
| `cost_*`, `sale_price_*` | ✅ | — |
| `is_free`, `minimum_sale_stems`, `image_url`, `notes` | ✅ | — |
| `is_active` | ❌ yo'q edi | **qo'shildi** |
| `received_stems`, `stems_per_bunch` | ✅ | o'zgarmadi (TASK A qoidalari saqlandi) |
| `variant` (ishlatilganda QULF) | ⚠️ SHARTSIZ tahrirlanardi | **QULFLANDI** |

Bizda bor, spec ro'yxatida yo'q — **OpenAPI bilan tekshirildi, ikkalasi ham yoziladigan,
shuning uchun QOLDIRILDI**: `batch_number` va qo'lda `remaining_stems` (sukut bo'yicha o'chiq).

OpenAPI'da yoziladigan, ammo ATAYLAB ochilmagan: `cost_per_stem_exact`,
`sale_price_per_stem_exact` (bizdagi qoida: FAQAT KO'RSATISH uchun) va `received_bunches`
(DualQtyInput allaqachon donaga aylantiradi).

## §0b — ⚠️ BU BIZNING XATOMIZ EDI

TASK A da men `variant` ni «SAFE» deb tasnifladim va ogohlantirish yozdim:

> «⚠️ Nav o'zgaradi — bu partiyadan yasalgan kataloglarda ham yangi nav ko'rinadi.»

Bu jumla spec tasvirlagan BUZILISHNI (Prut → Alfalob) **xususiyat sifatida** taqdim etgan.
Ishlatilgan partiyada nav almashtirish bizning UI'da MUMKIN edi. Endi:

- `batchVariantLocked(b)` → `remaining_stems !== received_stems` bo'lsa maydon Select emas,
  🔒 bilan o'qiladigan matn + spec izohi + **arxivlash chorasi**.
- Payload darajasida ham ushlanadi: qulflangan partiyada `variant` payload'ga TUSHMAYDI.
- ⚠️ **Bizning tekshiruv — ZAIF TAXMIN.** Server «ishlatilgan»ni kengroq biladi (katalog
  tarkibi, floristga chiqarilgan, lead, har qanday harakat). Shuning uchun qulflanmagan
  maydon RUXSAT degani EMAS: 400 kelsa matni AYNAN ko'rsatiladi va maydon **o'shandan keyin
  qulflanadi** (`serverLocked`), nav esa asl qiymatiga qaytariladi.

## §0c — `stems_per_bunch`: payload allaqachon TO'G'RI edi

Tekshirildi va **o'zgartirilmadi**: `addPriceEdit` avto rejimda faqat pochka narxini
yuboradi, dona narxini HECH QACHON qo'shmaydi; qo'lda rejimda esa dona narxini faqat
**o'zgargan bo'lsa** yuboradi. Ya'ni tegilmagan dona narxi hech qachon `stems_per_bunch`
bilan birga ketmaydi — spec ogohlantirgan «jimgina muzlatish» bizda yuz bermasdi.
Endi bu uchta test bilan mixlab qo'yildi.

Tuzatilgani — **preview**: ilgari tekin partiyada ham «arvoh» tannarx qatori chiqardi.
`spbPriceRecompute(..., isFree)` endi tekin gulda dona tannarxini 0 da qoldiradi.

Ekrandagi haqiqiy matn (25 → 50):
```
Pochkada dona: 25 → 50 — pochka narxi o'zgarmaydi, dona narxi qayta hisoblanadi:
Dona tannarx 1 000 so'm → 500 so'm    Dona sotuv 2 000 so'm → 1 000 so'm
Eng yaqin 100 ga yaxlitlanadi; aniq hisob ham yangilanadi.
```
— spec §2 jadvali bilan AYNAN bir xil.

## §0d — O'chirish: bizda UMUMAN YO'Q EDI

⚠️ Kutilganidan boshqacha topilma: **partiyani o'chirish oqimi kod bazasida yo'q edi** —
`deleteStockBatch` ham, tugma ham. Ya'ni 200 ni noto'g'ri talqin qilish MUMKIN emas edi,
chunki hech qachon chaqirilmagan. Endi qurildi.

⚠️ **OpenAPI faqat `204` ni e'lon qiladi** — spec'dagi `200 {detail, is_active:false}`
hujjatlashtirilmagan (LIST 2). Bizning `request()` 204 da `undefined`, 200 da tanani
qaytaradi, shuning uchun ikkalasini ajratsa bo'ladi:

```
describeBatchDeleteResult(undefined)          → {archived:false}  «Partiya o'chirildi»
describeBatchDeleteResult({detail, is_active}) → {archived:true}   serverning matni AYNAN
```

Tasdiq oynasi IKKALA natijani ham rostini aytadi va «qaysi biri bo'lgani saqlangandan
keyin aytiladi» deydi. Toast **haqiqatda nima bo'lganini** aytadi — arxivlanganda
«o'chirildi» deb ALDAMAYDI.

## §2 — Verify

Jonli (read-only GET, 86 ta partiya): **31 tasi ishlatilgan, 55 tasi tegilmagan** — ikkala
holat ham real ma'lumotda mavjud.

```
QULF bo'ladiganlar (remaining ≠ received):
  #138 №01:00 Atirgul · Jumilia   received=475 remaining=325
  #117 №01:00 Atirgul · Alfalob   received=125 remaining=50
  #134 №01:00 Atirgul · Alfalob   received=25  remaining=0

OCHIQ qoladiganlar (remaining = received):
  #173 №01:00 Atirgul · Alfalob   received=50  remaining=50
  #170 №01:00 Atirgul · Luchiana  received=100 remaining=100
  #169 №01:00 Atirgul · Jumilia   received=25  remaining=25
```

`tsc` toza · **344/344 Vitest** (22 tasi shu ish uchun) · konsol xatosi yo'q ·
skrinshotlar dark + light: `rul-variant-locked-*`, `rul-spb-recompute-*`,
`rul-archive-confirm-*`, `rul-variant-unlocked-*`.

## LIST 1 — yangilangan qadamlar

SB7. **🔒 Nav qulfi.** Ishlatilgan partiyani (masalan #117: 125 kelgan / 50 qoldiq)
     tahrirlang — «Gul navi» **tanlab bo'lmasligi**, 🔒 va «Bu partiyadan gul ishlatilgan,
     navni almashtirib bo'lmaydi» izohi chiqishi kerak. **READ.**
SB8. **Tegilmagan partiyada nav OCHIQ.** #173 (50/50) da nav almashtiriladi va saqlanadi.
     **⚠️ QAYTMAS EMAS lekin diqqat**: faqat hali ishlatilmagan partiyada ruxsat.
SB9. **⚠️ ZAIF QULF sinovi.** Qoldiq = kelgan, LEKIN partiya katalog tarkibida yoki
     floristda bo'lgan holatni toping (bizning tekshiruv buni BILMAYDI). Nav almashtiring —
     server **400** qaytarishi va UI o'sha matnni ko'rsatib maydonni qulflashi kerak. **READ.**
SB10. **Pochkadagi dona qayta hisobi.** 25 → 50: preview «Dona tannarx 1 000 → 500 ·
     Dona sotuv 2 000 → 1 000» ko'rsatsin, saqlagach server ham shu raqamlarni qo'ysin.
     **⚠️ RETROAKTIV.** Tekin partiyada tannarx 0 da qolsin.
SB11. **Arxivlash.** Tarixi BOR partiyani o'chiring → «arxivlandi» deb aytilsin va partiya
     `is_active=false` bo'lsin (ro'yxatdan yo'qolsin, tarix qolsin). Tarixi YO'Q partiyada
     esa «o'chirildi». **⚠️ QAYTMAS.**

## LIST 2 — yopilgan savollar

- **p (received_stems ↔ remaining_stems)** — allaqachon yopilgan edi (TASK A).
- **q (manfiy qoldiq himoyasi)** — allaqachon yopilgan edi (TASK A).
- **YANGI YOPILDI: nav tahririning oqibati.** Ilgari «nav o'zgarsa kataloglar nima bo'ladi?»
  aniq emas edi — spec javob berdi: avval yasalgan buketlar tarkibi qayta yozilardi,
  shuning uchun server endi bloklaydi.

### LIST 2 — yangi savol

cc. **`DELETE /api/stock-batches/{id}/` OpenAPI'da chala.** Sxema faqat `204` ni e'lon
   qiladi, jonli xatti-harakat esa tarixi bor partiyada `200 {detail, is_active:false}`
   qaytaradi. Biz tanasi bor-yo'qligiga qarab ajratamiz — bu ISHONCHLI kontrakt emas.
   `200` javob sxemasi e'lon qilinsin. Qo'shimcha: arxivlangan partiyani QAYTARISH
   (`is_active=true`) qo'llab-quvvatlanadimi? Biz «Faol partiya» belgisi orqali PATCH
   yuboramiz — tasdiqlansin.

---

# ISHLATILGAN PARTIYADA NAVNI ALMASHTIRISH (2026-08-03)

## §0 — Audit

**Biz nima yuborgan edik (`9af59e1`):** qulflangan nav maydoni ostida
«Nav xato bo'lsa: partiyani **arxivlang** va to'g'ri nav bilan yangisini kiriting» matni.
**Bu chora endi ESKIRDI** — o'rniga «Navni almashtirish» tugmasi qo'yildi.
Arxivlash/o'chirish amali **o'zi qoldi** (u DELETE=arxiv oqimi, o'z vazifasi bor) — faqat
nav muammosining yechimi sifatida REKLAMA QILINMAYDI.

**OpenAPI tasdig'i:**
```
GET  /api/stock-batches/{id}/usage/           → 200, javob sxemasi E'LON QILINMAGAN
POST /api/stock-batches/{id}/change-variant/  → StockBatchVariantChange
                                                 required: ["reason", "variant"]
                                                 javob: StockBatch (variant_change E'LON QILINMAGAN)
```

### ⚠️ ZAIF TEKSHIRUV — JONLI ISBOT

Bizdagi `remaining !== received` taxminini serverning `is_used` hukmi bilan solishtirdim
(14 ta «tegilmagan» partiya):

```
⚠️ #174 №01:00 — qoldiq = kelgan, used_stems 0, LEKIN is_used = TRUE (3 ta sklad harakati)
⚠️ #175 №01:00 — qoldiq = kelgan, used_stems 0, LEKIN is_used = TRUE (3 ta sklad harakati)
   tekshirildi 14 ta — NOMUVOFIQ: 2 ta
```

Ya'ni bizning tekshiruv **14 tadan 2 tasida yanglishadi**: UI ochiq Select ko'rsatadi,
PATCH esa 400 oladi. Shuning uchun:

- Zaif tekshiruv **FAQAT qaysi UI ko'rsatilishini** hal qiladi, HECH QACHON ruxsatni emas.
- 400 kelganda matn AYNAN ko'rsatiladi, maydon qulflanadi VA **o'sha yerda
  «Navni almashtirish» tugmasi taklif qilinadi** — foydalanuvchi tupikda qolmaydi.
- Tasdiq oynasi ochilishini **serverning `is_used`i** hal qiladi (`variantChangeNeedsDialog`),
  bizning taxminimiz emas.

## §1 — Oqim

1. Qulflangan nav yonida **«Navni almashtirish»** tugmasi (ruxsat: `canControl("inventory")`).
2. Bosilganda **AVVAL `GET usage/`** — raqamlar hech qachon taxmin qilinmaydi.
3. `is_used: false` → oyna OCHILMAYDI, «bu partiya hali ishlatilmagan, shu yerdan tanlab
   saqlayvering» deyiladi (oddiy PATCH yo'li ishlashda qoladi).
4. `is_used: true` → tasdiq oynasi:
   - eski nav → yangi nav (searchable Select; **joriy nav ro'yxatdan CHIQARILGAN**, shuning
     uchun «Bu nav allaqachon tanlangan» 400'i UI orqali umuman qo'zg'atilmaydi)
   - ishlatilgan joylar — **faqat nolga teng bo'lmaganlari** (`variantUsageLines`)
   - «Ishlatilgan joylarda gul NOMI yangi navga o'zgaradi (sotilgan tarix ham).
     Narxlar, sonlar va foyda O'ZGARMAYDI.»
   - ⚠️ **NOTO'G'RI ISHLATISH ogohlantirishi — sabab maydonidan YUQORIDA**, qizil blokda,
     tooltipda EMAS
   - «Sabab» majburiy

**Sabab bo'sh bo'lsa:** so'rov YUBORILMAYDI (payload `null`), lekin tugma «o'lik» emas —
bosilganda maydon ostida «Sabab majburiy — audit jurnaliga yoziladi» chiqadi. Tugma faqat
nav tanlanmaganda o'chiq turadi.

**Muvaffaqiyatda:** serverning `variant_change` xulosasi ko'rsatiladi (eski → yangi,
`history_rows_updated`), so'ng partiya/ro'yxat yangilanadi va `notifyReportDataChanged()`
chaqiriladi — pul siljimasligi kerak, lekin buni TAXMIN qilmay qayta yuklab ko'rsatamiz.

## §2 — Orqaga qaytarish YO'Q

Butun OpenAPI bo'ylab teskari amal qidirildi (`revert|undo|restore|rollback`) — topilgani
faqat `/api/catalog/{id}/restore-flowers/`, u boshqa narsa. Ya'ni **nav almashtirishning
bekor qilish yo'li YO'Q**.

⚠️ **Ikkinchi marta eski navga qaytarish «undo» EMAS**: bu yana bitta `change-variant`
amali bo'lib, audit jurnalida **IKKITA yozuv** qoladi va «xato bo'ldi» degani hech qayerda
ko'rinmaydi. Shuning uchun operatorga bu «tuzatish yo'li» sifatida TAKLIF QILINMAYDI —
oynada faqat «Qaytarib bo'lmaydi» deyiladi.

## §3 — Verify

### Jonli `usage/` (read-only GET; change-variant HECH QACHON chaqirilmadi)

```
GET /api/stock-batches/138/usage/ → 200      ← ISHLATILGAN
{ "batch": 138, "batch_number": "01:00", "variant": "Atirgul · Jumilia · Pushti",
  "is_used": true, "catalog_items": 2, "sold_catalog_items": 0, "florist_issues": 1,
  "lead_usages": 0, "stock_movements": 2, "used_stems": 150 }

GET /api/stock-batches/117/usage/ → 200      ← ISHLATILGAN
{ "batch": 117, "variant": "Atirgul · Alfalob · To'q Pushti", "is_used": true,
  "catalog_items": 1, "sold_catalog_items": 0, "florist_issues": 1,
  "lead_usages": 0, "stock_movements": 2, "used_stems": 75 }

GET /api/stock-batches/173/usage/ → 200      ← TEGILMAGAN
{ "batch": 173, "variant": "Atirgul · Alfalob · To'q Pushti", "is_used": false,
  "catalog_items": 0, "sold_catalog_items": 0, "florist_issues": 0,
  "lead_usages": 0, "stock_movements": 1, "used_stems": 0 }

GET /api/stock-batches/170/usage/ → 200      ← TEGILMAGAN
{ "batch": 170, "variant": "Atirgul · Luchiana · pushti", "is_used": false,
  ... "stock_movements": 1, "used_stems": 0 }
```

⚠️ Diqqat: **tegilmagan partiyada ham `stock_movements: 1`** (kirim harakati) — shuning
uchun «harakat bor = ishlatilgan» deb hisoblab bo'lmaydi, `is_used` ni server hal qiladi.

Jonli hisob: 86 partiyadan **31 ishlatilgan, 55 tegilmagan** — ikkala yo'l ham real
ma'lumotda sinaladi. **Sotilgan katalogi bor partiya hozircha yo'q** (hamma
`sold_catalog_items: 0`), shuning uchun «(N tasi SOTILGAN)» qatori jonli ma'lumotda
ko'rinmadi — test va skrinshotda spec misolidagi raqamlar (1 ta / 1 sotilgan) ishlatildi.

`tsc` toza · **359/359 Vitest** (15 tasi shu ish uchun) · konsol xatosi yo'q ·
skrinshotlar dark + light: `rul-variant-locked-*` (qulf + tugma),
`rul-variant-change-dialog-*` (haqiqiy raqamlar + noto'g'ri ishlatish ogohi),
`rul-variant-change-no-reason-*` (sababsiz validatsiya), `rul-variant-change-success-*`.

## LIST 1 — SB7 ALMASHTIRILDI

~~SB7 (eski): arxivlab yangisini kiritish~~ — **bekor qilindi**, quyidagi bilan almashtirildi:

SB7. **🔒 Nav qulfi + almashtirish.** Ishlatilgan partiyani (#138: 475/325, yoki #117: 125/50)
     tahrirlang — «Gul navi» qulflangan bo'lishi va yonida **«Navni almashtirish»** tugmasi
     turishi kerak. Bosing: `usage/` raqamlari (katalog, ketgan gul, florist, harakat)
     HAQIQIY sonlar bilan chiqsin. **READ (tugmani bosish — GET, xavfsiz).**
SB7a. **⚠️ ALMASHTIRISH — QAYTMAS.** Yangi navni tanlang, sababni yozing, tasdiqlang.
     Tekshiring: (1) partiya navi o'zgardi, (2) shu partiyadan yasalgan **katalog tarkibida**
     yangi nav ko'rinadi, (3) **katalog tannarxi va hisob-kitob O'ZGARMADI**, (4) sotuv
     tarixidagi eski nom ham yangilandi, (5) audit jurnalida sabab bilan yozuv bor.
     **⚠️ QAYTARIB BO'LMAYDI — teskari amal YO'Q.** Test partiyasida sinang.
SB7b. **Sabab majburiy.** Sababsiz tasdiqlashga urinib ko'ring — bloklanishi kerak. **READ.**
SB7c. **Tegilmagan partiya oynasiz.** #173 (50/50) da «Navni almashtirish» bosilsa oyna
     OCHILMASLIGI va oddiy tanlash taklif qilinishi kerak. **READ.**
SB7d. **⚠️ ZAIF QULF.** #174 yoki #175 (qoldiq = kelgan, lekin `is_used: true`) da navni
     oddiy tahrirdan o'zgartiring — **400** kelishi, matni ko'rinishi va o'sha yerda
     «Navni almashtirish» tugmasi paydo bo'lishi kerak. **READ.**

## LIST 2

- **YOPILDI (oldingi spec savoli): nav tahririning oqibati.** Javob berildi — narxlar
  partiyada saqlanadi, navda emas; shuning uchun almashtirish tannarx/foydaga tegmaydi,
  faqat ko'rinadigan nom o'zgaradi va sotuv tarixidagi muzlatilgan nusxa ham yangilanadi.
- **YOPILDI: «arxivlab yangisini kiritish» chorasi** — endi kerak emas.

### Yangi savollar

dd. ⚠️ **Nav almashtirishni QAYTARISH yo'li yo'q.** OpenAPI'da teskari amal umuman yo'q.
   Xato almashtirilsa nima qilinadi? Ikkinchi marta qaytarish auditda ikkita yozuv
   qoldiradi va «bu tuzatish edi» degani ko'rinmaydi. SETTLE: (1) `change-variant` uchun
   bekor qilish/undo rejalashtirilganmi? (2) Bo'lmasa, auditda «tuzatish» belgisi
   (masalan `is_correction`) qo'shilsinmi, toki ikkita yozuv juftlik ekani bilinsin?
ee. **`usage/` va `variant_change` OpenAPI'da e'lon qilinmagan.** `usage/` javobida sxema
   yo'q (faqat tavsif), `change-variant` javobi esa oddiy `StockBatch` deb ko'rsatilgan —
   `variant_change` bloki hujjatsiz. Ikkalasi ham e'lon qilinsin (bu `paid_from_debt` va
   DELETE-200 bilan bir xil naqsh — javoblar hujjatdan oldinda ketmoqda).

## Untested write paths (added — READ-ONLY, none fired)

- `POST /api/stock-batches/{id}/change-variant/` `{variant, reason}` — nav almashtirish

---

# KATALOG SOTUV TARIXI (2026-08-04)

## §0a — ⚠️ UCHINCHI «SAVDO RAQAMI» TUG'ILMADI: ro'yxat AYNAN mos keladi

Jonli tekshiruv (bir xil davr, filtrsiz):

| Manba | Tushum | Sotuv |
|---|---|---|
| `/api/catalog/sales/` `totals.revenue` | **7 430 000** | 20 |
| `/api/accounting/?branch=main` `total_sales` | **7 430 000** | 20 |
| `/api/dashboard/` `period_catalog_sales_revenue` | **7 430 000** | 20 |
| `/api/accounting/` (filtrsiz, `mode: all`) | 11 645 000 | 45 |

⚠️ 4 215 000 lik farq **QARZ EMAS**. Yetishmayotgan 25 qatorning HAMMASI —
`branch_name: "Parkent filiali"`. Har bir `history_id` tekshirildi:

```
accounting'da BOR, catalog/sales'da YO'Q — 25 qator
  filial bo'yicha: Counter({'Parkent filiali': 25})
  paid_from_debt : Counter({False: 25})
```

**Xulosa:** `/api/catalog/sales/` — O'Z FILIALI bilan chegaralangan (xuddi `/api/catalog/`
kabi), tannarx/foyda esa umuman yo'q. Asosiy filial foydalanuvchisi uchun u
`accounting?branch=main` bilan SO'MMA-SO'M teng.

Shu sababli sarlavha **«Sotuvlar bo'yicha»** (—«Savdo» EMAS) va ostida bitta qator izoh:
*«Bu ro'yxat o'z filialingiz sotuvlarini ko'rsatadi; tannarx va foyda bu yerda yo'q.
Tannarx, sof foyda va filiallar ajratmasi uchun — Hisob-kitob»* (havola bilan).
Ya'ni farq **hisoblash uslubida emas, QAMROVDA** — buni ochiq aytamiz.

### Qarz sotuvi — TEKSHIRIB BO'LMADI (LIST 2)

`?payment_type=debt` → `count: 0`, `totals.debt_total: 0.0`. Serverda hamon **0 ta qarz**
bor (TASK B dagi holat o'zgarmagan), shuning uchun qarz sotuvi bu ro'yxatda DARHOL
chiqishini **empirik tasdiqlab bo'lmadi**. Bilsa bo'ladigani: `payment_type=debt` filtri
QABUL QILINADI (200 qaytaradi) va `totals` da alohida `debt_total` kaliti bor — bu qarz
qatorlari shu yerga tushishini bildiradi.

`created_at` sotuv payti-mi yoki to'lov payti-mi: 45/45 accounting qatorida
`sold_at == created_at`, ammo ularning HAMMASI qarzsiz sotuv — qarz qatori uchun bu
hech narsani isbotlamaydi. → LIST 2.

## §0b — Takrorlanish: KENGAYTIRILDI, yangi ro'yxat qo'shilmadi

`KatalogViewModal` da **allaqachon** «Sotuv tarixi» bo'limi bor (`item.history`,
`action === "sold"`): sana, dona, asl/sotilgan narx, chegirma, sabab. Yetishmayotgani —
**TO'LOV TURI**.

⚠️ Jonli tekshiruv: sotuv qatorining `id`si CatalogHistory `id`si bilan AYNAN bir xil —
katalog 165 → `history: [(238,'sold'),(236,'created')]`, `/api/catalog/165/sales/` →
`[(238, 1, 'Karta')]`. Shuning uchun `/api/catalog/{id}/sales/` dan FAQAT to'lov yorlig'i
olinib, mavjud qatorlarga ulandi. Ikkinchi ro'yxat CHIZILMAYDI (skrinshot bilan
tasdiqlangan: `onlyOneList: true`).

Accounting jadvali va analitikadagi `top_catalog_items` boshqa savolga javob beradi
(tannarx/foyda, agregat) — ular tegilmadi.

## §0c — Filial xavfsizligi: TOZA

Javobda `cost` / `profit` / `net_` / `margin` satrlari **umuman yo'q** (jonli blob
tekshirildi). `CatalogSaleRow` 23 ta maydon e'lon qiladi, birortasi tannarxga aloqador
emas. Klientda ham hech narsa hosil qilinmaydi — `listed_total` va `sale_total`
ikkalasi ham sotuv tomonidagi raqamlar. Ruxsat `catalog` — ikkala Parkent
foydalanuvchisida bor (`parkent_admin`, `parkent_sotuvchi`), demak ular BU ro'yxatni
ko'radi. «Filial» ustuni esa ularga chizilmaydi (bitta takrorlanuvchi qiymat).

## ⚠️ YO'L-YO'LAKAY TOPILGAN HAQIQIY NOSOZLIK — MINTAQA SILJISHI

`fmtTime`/`fmtDate` qiymatni `new Date(iso).getDate()/getHours()` bilan o'qiydi — bular
BRAUZER mintaqasiga o'giradi. Server esa `+05:00` bilan MAHALLIY vaqt yuboradi:

```
2026-08-03T22:10:39.551452+05:00
  TZ=Asia/Tashkent      → 03.08 · 22:10   ✓
  TZ=UTC                → 03.08 · 17:10   ✗ vaqt xato
  TZ=Asia/Tokyo         → 04.08 · 02:10   ✗ KUN SILJIDI
  TZ=America/New_York   → 03.08 · 13:10   ✗ vaqt xato
```

Ya'ni Toshkentga sozlanmagan qurilmada 22:10 dagi sotuv **ertangi kunda** ko'rinardi.
Bu FAQAT shu ekranga emas, mavjud hamma ekranga tegishli edi.

Tuzatildi: `readIsoParts` / `fmtLocalTime` / `fmtLocalDate` — satr komponentlarini
TO'G'RIDAN-TO'G'RI o'qiydi, `Date` obyektiga umuman tegmaydi. Sinov 5 xil mintaqada
o'tkazildi (UTC+14 gacha):

```
TZ=Asia/Tashkent → 27 passed    TZ=UTC → 27 passed    TZ=Asia/Tokyo → 27 passed
TZ=America/New_York → 27 passed TZ=Pacific/Kiritimati (UTC+14) → 27 passed
```

## Kontrakt nomuvofiqliklari

- ⚠️ **Tur aralashligi.** `listed_total` / `sale_total` OpenAPI'da `string (decimal)`
  deb e'lon qilingan, jonli javobda esa **NUMBER** (`250000.0`). `listed_unit_price`,
  `sold_unit_price`, `discount_amount`, `discount_percent` — STRING. `totals` ning
  hammasi — NUMBER. Shuning uchun hamma pul maydoni `string | number` va `saleNum()`
  bilan o'qiladi.
- ⚠️ **`totals` e'lon qilinmagan** — `PaginatedCatalogSaleRowList` da faqat
  `count/next/previous/results` bor.
- ⚠️ **`/api/catalog/{id}/sales/` Paginated deb e'lon qilingan, lekin EMAS** — jonli
  javob `{results, totals}`, `count`/`next`/`previous` YO'Q.
- Spec'da yozilmagan, lekin ishlaydigan filtrlar: `arrangement_type`, `catalog_kind`,
  `customer`, `florist`, `ordering`, `status`.

## Qurilgani

- `lib/catalogSales.ts` — `buildSalesQuery` (hamma filtr serverda, `page_size` 100 ga
  qisiladi), `salesFiltersToParams` (URL), `salesPageCount`, `totalsView` (server
  raqamlari AYNAN), `discountView`, `saleNum`.
- `lib/format.ts` — `readIsoParts` / `fmtLocalTime` / `fmtLocalDate`.
- `components/CatalogSalesTab.tsx` — jamilar + naqd/karta/qarz ajratmasi, «butun davr
  bo'yicha, ochiq sahifa emas» izohi, Hisob-kitobga havola, sana/to'lov/qidiruv filtrlari
  (URL'da saqlanadi), SERVER sahifalash, chegirmali qator, `sale_image_url` nishonchasi
  (bosilsa yangi oynada), rasmsiz qator degradatsiyasi, bo'sh/yuklanish/xato holatlari.
- `components/KatalogViewModal.tsx` — mavjud «Sotuv tarixi» qatorlariga TO'LOV chipi.
- `app/katalog/page.tsx` — `?tab=` konvensiyasi, «Katalog» sukut.

`tsc` toza · **386/386 Vitest** (27 tasi shu ish uchun) · konsol xatosi yo'q ·
skrinshotlar dark + light: `sal-tab-*`, `sal-empty-*`, `sal-drawer-*`.

Skript o'qigan holat (ikkala mavzuda ham bir xil):
```
SOTUVLAR TAB: header ✓ totals ✓ split ✓ scopeNote ✓ reconcile ✓
              time ✓ (03.08 · 22:10)  noNextDay ✓ (04.08 YO'Q)
              discount ✓  debtChip ✓  volumes ✓  filters ✓
BO'SH HOLAT : empty ✓ explains ✓
KARTOCHKA   : section ✓ payChip ✓ qty ✓ prices ✓ reason ✓ onlyOneList ✓
```

## LIST 1 — append

CS1. **Sotuv ro'yxatda chiqadimi.** QZ1 (yoki oddiy naqd/karta sotuv) dan keyin
     Katalog → «Sotuvlar» tabini oching: sotuv eng yuqorida, TO'G'RI to'lov turi bilan
     turishi kerak. **READ.**
CS2. **⚠️ QARZ QATORI — ikki joyda tekshiring.** Qarzga sotgach:
     (a) «Sotuvlar» tabida qator DARHOL chiqadimi va to'lov «Qarz» deb turadimi?
     (b) Hisob-kitobda o'sha summa SAVDOGA QO'SHILMAGAN bo'lishi kerak (QZ3).
     So'ng qarzni to'lang (QZ5) va yana ikkalasini solishtiring:
     (c) «Sotuvlar» tabidagi qator sanasi/to'lov turi o'zgardimi?
     (d) Hisob-kitobda savdo endi ko'chdimi? **READ.**
     ⚠️ Bu qadam LIST 2 (ff) savoliga javob beradi — natijani yozib qo'ying.
CS3. **Jamilar sahifadan mustaqil.** Filtr qo'ying, 2-sahifaga o'ting — yuqoridagi
     jamilar O'ZGARMASLIGI kerak (ular butun filtr bo'yicha). **READ.**
CS4. **Chegirmali qator.** Chegirma bilan sotilgan qatorda asl narx chizilgan, haqiqiy
     narx qalin va sabab kursiv bo'lishi kerak. **READ.**
CS5. **⚠️ KECH SOTUV.** Soat 22:00 dan keyin sotuv qiling — ro'yxatda O'SHA KUN
     ko'rinishi kerak, ertangi kun EMAS. **READ.**

## LIST 2 — append

ff. ⚠️ **Qarz sotuvi bu ro'yxatda QACHON paydo bo'ladi va `created_at` nimani
   bildiradi?** Serverda 0 ta qarz bo'lgani uchun tekshirib bo'lmadi.
   SETTLE: (1) to'lanmagan qarz `/api/catalog/sales/` da DARHOL chiqadimi (biz shunday
   deb faraz qilyapmiz, chunki `payment_type=debt` filtri va `debt_total` mavjud)?
   (2) Chiqsa, `created_at` — SOTUV payti-mi yoki accounting'dagi `sold_at` kabi TO'LOV
   payti-mi? (3) Qarz to'langach bu qator o'zgaradimi (sana/`payment_type`) yoki
   o'zgarmay qoladimi? Bu javob bo'lmasa, ro'yxat va Hisob-kitob o'rtasidagi farqni
   operatorga to'liq tushuntirib bo'lmaydi.
gg. **`totals` va per-catalog javob shakli hujjatlashtirilmagan.** `totals`
   `PaginatedCatalogSaleRowList` da yo'q; `/api/catalog/{id}/sales/` esa Paginated deb
   e'lon qilingan bo'lsa-da aslida `{results, totals}` qaytaradi. Ikkalasi ham e'lon
   qilinsin (bu `paid_from_debt`, DELETE-200 va `usage/` bilan bir xil naqsh).
hh. **Pul maydonlari turi.** `listed_total`/`sale_total` NUMBER kelyapti, OpenAPI
   `string (decimal)` deydi; qolgan pul maydonlari STRING. Bitta konvensiya tanlansin.

---

# ARALASH TO'LOV — NAQD + KARTA (2026-08-04)

## §0a — To'rt rejim va ularning kombinatsiyalari

`payment_type` — BITTA enum qiymat (OpenAPI: `['cash','card','debt','mixed']`), shuning
uchun **`mixed` va `debt` BIRGA BO'LA OLMAYDI** — tanlagichda o'zaro istisno, qo'shimcha
qulf shart emas. Rejimdan chiqilganda ajratma tozalanadi (eski summa qolib ketmasin).

| Kombinatsiya | Yaroqli | Talab qilinadigan maydonlar |
|---|---|---|
| har qanday rejim + chegirma | ✅ | `sale_price`; past bo'lsa `discount_reason` MAJBURIY |
| har qanday rejim + dona > 1 | ✅ | jami = `sale_price × quantity` |
| har qanday rejim + mijoz | ✅ ixtiyoriy | **qarz**da MAJBURIY |
| har qanday rejim + tarixiy sana | ✅ | **qarz**da YASHIRILADI (server `sold_at` ni to'lov kuniga qo'yadi) |
| **mixed + debt** | ❌ imkonsiz | bitta enum qiymat |
| **mixed** | ✅ | `cash_amount` VA `card_amount`, ikkalasi ham > 0, yig'indi AYNAN teng |

⚠️ **Spec farazini tuzatish:** sotuv oynasida **SOTUV RASMI maydoni YO'Q**.
`sale_image_url` — sotuv tarixida faqat O'QISH uchun keladi; `CatalogSellRequest` da
bunday maydon yo'q va bizning formada ham hech qachon bo'lmagan. Ya'ni «aralash + sotuv
rasmi» degan kombinatsiya mavjud emas.

## §0b — Taqqoslash summasi CHEGIRMADAN KEYINGI (tasdiqlandi)

```js
const salePrice = discountOn ? Math.round(+price || 0) : listPrice;
totalSum: salePrice * qty
```
`calc.totalSum` allaqachon `useMemo([listPrice, salePrice, qty])` — ya'ni dona, sotuv
narxi va chegirma tugmasi jamini DARHOL qayta hisoblaydi. Ajratma tekshiruvi AYNAN shu
qiymatni o'qiydi, ikkinchi manba yaratilmadi.

## §0c — Hisoblagichlar: jonli holat

| Joy | `mixed_count` | `mixed_quantity` |
|---|---|---|
| `accounting.summary` | ✅ 0 | ✅ 0 |
| `accounting.by_branch[]` (ikkala qator) | ✅ 0 | ✅ 0 |
| `catalog/sales.totals` | ✅ 0 | ❌ **YO'Q** |
| `CatalogSaleRow.payment_breakdown` | ✅ OpenAPI'da **E'LON QILINGAN** (object, readOnly) | — |

Serverda hozircha **0 ta aralash sotuv** bor.

Invariant jonli tasdiqlandi: `cash_count 16 + card_count 37 + unknown_count 0 = 53 =
sales_count` ✓.

⚠️ **`debt_count` javobda UMUMAN YO'Q.** Spec invariantda uni nomlaydi, jonli
`summary` da esa faqat `cash_count`, `card_count`, `unknown_count`, `mixed_count`,
`mixed_quantity` bor. Hozir tenglik saqlanyapti chunki qarz 0 ta. → LIST 2.

**Kesishuv qanday ko'rsatildi (jamlanmaydi):**
- Hisob-kitob «Sotuvlar soni» kartochkasi ostida: «shundan aralash: 1 (1 dona)»
- `by_branch` jadvalida `sales_count` katakchasi ICHIDA kichik qator (alohida ustun
  QILINMADI — aks holda kimdir jamlab yuborardi)
- Yagona renderer `accountingRowView` ga `mixedCount`/`mixedQuantity` qo'shildi, shuning
  uchun `summary` (Jami) va `by_branch` qatorlari IKKALASI ham avtomatik oldi.

## ⚠️ JONLI TOPILGAN SERVER NOSOZLIGI — «mixed» filtri ISHLAMAYDI

```
payment_type=''            count=28   turlar=['card','cash']
payment_type='cash'        count=10   turlar=['cash']
payment_type='card'        count=18   turlar=['card']
payment_type='debt'        count=0    turlar=[]
payment_type='unknown'     count=0    turlar=[]
payment_type='mixed'       count=28   turlar=['card','cash']   ← FILTRLANMAGAN
payment_type='abrakadabra' count=28   turlar=['card','cash']   ← AYNAN bir xil
```

`mixed` — tanilmagan qiymat kabi ishlaydi: server BUTUN ro'yxatni qaytaradi. Agar uni
shunchaki tanlagichga qo'shsak, «Aralash»ni tanlagan operator HAMMA sotuvni ko'rardi va
jamilar ham butun davrniki bo'lardi — ya'ni hammasi aralashdek ko'rinardi.

**Qaror:** variant qo'shildi (spec talab qiladi), ammo javobda aralash BO'LMAGAN qator
bo'lsa ochiq ogohlantirish chiqadi:
> ⚠️ Server «aralash» filtrini qo'llamadi — quyida BARCHA sotuvlar va butun davr jamilari
> ko'rsatilyapti. Aralash sotuvlar to'lov ustunidan bilinadi.

## §1 — Sotuv oynasi

To'rtinchi tugma **Aralash**; tanlansa jami va ikkita summa maydoni ochiladi.
Avtomatik to'ldirish qoidalari (hammasi testlangan):
- ikkinchi maydon **QO'LDA tegilmagan** bo'lsagina to'ladi;
- **manfiy qoldiq HECH QACHON yozilmaydi** — bo'sh qoladi, nomuvofiqlik ko'rsatiladi;
- jami keyin o'zgarsa (dona/chegirma) **faqat tegilmagan** maydon qayta hisoblanadi;
  ikkalasi ham tegilgan bo'lsa hech narsa o'zgarmaydi.

Bloklash: yig'indi ≠ jami bo'lsa «Farq: N so'm kam/ortiq»; yig'indi to'g'ri lekin bittasi
0 bo'lsa — «ikkala summa ham noldan katta bo'lishi kerak — bitta usul bo'lsa «Naqd» yoki
«Karta»ni tanlang» (spec ikkalasini MAJBURIY qiladi).

Payload: `cash_amount`/`card_amount` **FAQAT** aralash rejimda; qolgan uchta rejimda
kalitlar umuman yo'q (to'rtala rejim ham testlangan). Taqqoslash **raqam bo'yicha**
(`parseMoney`), formatlangan satr solishtirilmaydi.

⚠️ **Test topgan haqiqiy nosozlik:** dastlabki `parseMoney` raqamdan boshqa hamma
belgini tashlardi, shuning uchun serverning `payment_breakdown` decimal satri
`"150000.00"` → **15 000 000** bo'lib ketardi. Onlik nuqta endi saqlanadi (test bilan
qoplandi).

## §2 — Ko'rinish

- Sotuv tarixi qatori: «Aralash (150 000 naqd · 150 000 karta)». Oddiy to'lovda
  `payment_breakdown` `null` → faqat «Naqd»/«Karta»/«Qarz», **bo'sh qavs CHIZILMAYDI**
  (bo'sh obyekt va 0/0 holatlari ham testlangan).
- To'lov turi filtriga «Aralash» qo'shildi (yuqoridagi ogohlantirish bilan).
- To'lov nishonchasi mavjud oiladan: qarz — `--danger-ink`, aralash — `--acc`,
  qolganlari — `--text-2`. Yangi rang KIRITILMADI.

## §3 — Verify

`tsc` toza · **420/420 Vitest** (34 tasi shu ish uchun) · konsol xatosi yo'q ·
skrinshotlar dark + light: `mix-sell-ok-*`, `mix-sell-mismatch-*`, `mix-history-*`,
`mix-accounting-*`.

Skript o'qigan holat (ikkala mavzuda bir xil):
```
ARALASH ochildi : {"target":true,"total300":true,"blocked":true}
avtomatik       : {"cash":"100 000","card":"200 000"}   ← qoldiq to'g'ri
NOMUVOFIQ       : {"diff":true,"diffText":"Farq: 150 000 so'm kam","blocked":true}
TO'G'RI (150/150): {"noDiff":true,"enabled":true,"note":true}
SOTUV TARIXI    : {"mixedRow":true,"plainNoParens":true}
HISOB-KITOB     : {"counter":true,"text":"shundan aralash: 1 (1 dona)"}
```

## LIST 1 — append

MX1. **⚠️ ARALASH SOTUV — BUTUN MA'NOSI SHU QADAMDA.** Avval Hisob-kitobdagi uchta
     raqamni YOZIB OLING: umumiy savdo, naqd jami, karta jami va sotuvlar soni.
     So'ng 300 000 so'mlik katalogni «Aralash» bilan soting: naqd 150 000 + karta 150 000.
     Keyin tekshiring:
     - umumiy savdo **+300 000**
     - **naqd +150 000 VA karta +150 000** (ikkalasi ham!)
     - **sotuvlar soni ATIGI +1** (ikki marta sanalmasin)
     - «Sotuvlar soni» kartochkasi ostida «shundan aralash: N» paydo bo'lsin
     **⚠️ QAYTMAS: sotuv bekor qilinmaydi.**
MX2. **Avtomatik to'ldirish.** Naqdga 100 000 yozing — karta 200 000 bo'lib to'lsin.
     So'ng kartani QO'LDA 50 000 qiling — naqd O'ZGARMASLIGI va «Farq: 150 000 so'm kam»
     chiqishi kerak, tugma bloklangan. **READ.**
MX3. **Chegirma bilan aralash.** «Arzonroq sotish» yoqib narxni o'zgartiring —
     jami QAYTA hisoblanib, tegilmagan maydon yangilanishi kerak. 2 dona × 250 000 =
     500 000 ni 200 000 + 300 000 qilib soting. **READ (sotuvgacha).**
MX4. **Bitta usul 0 bo'lsa.** 300 000 + 0 kiritib ko'ring — yig'indi to'g'ri bo'lsa ham
     bloklanishi va «Naqd yoki Karta»ga yo'naltirishi kerak. **READ.**
MX5. **Tarixda ko'rinishi.** Sotuvlar tabida qator «Aralash (150 000 naqd · 150 000
     karta)» deb chiqsin; oddiy sotuvlarda esa faqat «Naqd»/«Karta», bo'sh qavssiz.
     **READ.**
MX6. **⚠️ Filtr.** To'lov filtrida «Aralash»ni tanlang — hozircha server filtrni
     QO'LLAMAYDI va sariq ogohlantirish chiqishi kerak. Backend tuzatgach bu qadam
     haqiqiy filtrlashni tekshiradi. **READ.**

## LIST 2 — append

ii. ⚠️ **`?payment_type=mixed` FILTRLAMAYDI.** Jonli: `mixed` uchun 28 qator qaytdi —
   filtrsiz so'rov va `abrakadabra` bilan AYNAN bir xil, holbuki `cash`/`card`/`debt`/
   `unknown` to'g'ri filtrlaydi. Ya'ni qiymat tanilmayapti. Tuzatilsin; hozircha UI
   ogohlantirish ko'rsatadi.
jj. **`debt_count` `summary` da YO'Q.** Spec invarianti
   `cash_count + card_count + debt_count + unknown_count = sales_count` — lekin javobda
   `debt_count` umuman yo'q. Hozir 0 ta qarz bo'lgani uchun tenglik saqlanyapti; birinchi
   qarz sotuvidayoq javobdan tenglikni tekshirib bo'lmay qoladi. Qo'shilsinmi?
kk. **`catalog/sales.totals` da `mixed_quantity` yo'q** (accounting'da bor). Ikkala
   joyda bir xil bo'lgani ma'qul.

---

# DASTAFKA SUMMASI (2026-08-04)

## §0a — Aralash taqqoslash summasi O'ZGARDI: tovar → tovar + dastafka

`calc.totalSum` 10 joyda o'qiladi; ulardan **beshtasi** taqqoslash summasi bo'lgani uchun
`mixedTarget(calc.totalSum, delivery)` ga o'tkazildi:

| Joy | Vazifasi | Holat |
|---|---|---|
| `recalcOnTotalChange(...)` | tegilmagan maydonni qayta hisoblash | ✅ |
| `validateMixed(...)` | ✓ / «Farq» xabari | ✅ |
| `mixedSellPayload(...)` | submit qulfi | ✅ |
| `applyMixedEdit(... "cash")` | avtomatik qoldiq | ✅ |
| `applyMixedEdit(... "card")` | avtomatik qoldiq | ✅ |
| ajratma qutisi sarlavhasi | ko'rsatiladigan jami | ✅ «Mijozdan olinadi» + «tovar X + dastafka Y» |

Qasddan TEGILMAGANLARI (ular tovar summasi bo'lib qolishi kerak): qarz toasti, bron
farqi qatori. Footer «Mijoz to'laydi» esa «Mijozdan olinadi» ga aylandi va endi
tovar/dastafka/jami uchta qator ko'rsatadi.

`payTarget` `useEffect` bog'lanishida — ya'ni **dastafka o'zgargan zahoti** qayta
hisoblanadi (faqat dona/chegirmada emas). Jonli tekshirildi: naqd 100 000 qo'lda
yozilgan, dastafka keyin kiritilgan → karta avtomatik **220 000** bo'ldi.

## §0b — Uchinchi raqam: qayerda nima ko'rsatiladi

| Joy | Ilgari | Endi |
|---|---|---|
| Hisob-kitob kartochkasi | «Umumiy savdo» = `total_sales` | **«Tovar savdosi»** = `total_sales` |
| — yangi — | — | **«Dastafka»** = `delivery_total` (+ `delivery_count`) |
| — yangi — | — | **«Kassaga tushgan»** = `received_total` |
| «Naqd»/«Karta» kartochkalari | `cash_total`/`card_total` | o'sha qiymat + izoh «dastafka ham ichida» |
| `by_branch` jadvali | Savdo · Naqd · Karta | **Tovar savdosi · Dastafka · Kassaga tushgan** · Naqd · Karta |
| Excel eksport | Savdo/Naqd/Karta | + Dastafka, + Kassaga tushgan (yagona renderer orqali) |

⚠️ **INVARIANT jonli holatda TEKSHIRILDI, lekin HOZIRCHA DEGENERAT:**
```
naqd 5 980 000 + karta 13 965 000 + qarz 0 + noma'lum 0 = 19 945 000
received_total                                          = 19 945 000  ✓ MOS
total_sales                                             = 19 945 000
delivery_total                                          = 0
```
Ya'ni `received_total == total_sales` bo'lgani uchun bu tekshiruv ikkalasini hali
AJRATA OLMAYDI — shaklni tasdiqlaydi, xatti-harakatni emas.

⚠️ **Spec farazini tuzatish:** §3 «spec 2 ta sotuvda dastafka bor deydi, shuning uchun
buni HOZIR tekshirsa bo'ladi» — **tekshirib bo'lmadi**. Jonli serverda
`delivery_count: 0`, `delivery_total: 0`, sotuv qatorlarining birortasida dastafka yo'q.
Spec'ning o'z misoli (19 545 000 / 40 000) ham jonli raqamlarga mos kelmaydi
(`total_sales` = 19 945 000). Sinov ma'lumoti tozalangan — qarz va aralash bilan bir xil.

**Paritet hukmi:** `accounting?branch=main total_sales` = dashboard = analytics =
**15 730 000** — uchalasi mos. Ammo `delivery_total = 0` bo'lgani uchun bu ularning
dastafkani CHIQARIB TASHLASHINI isbotlamaydi. Bayroqlandi, tuzatilmadi (LIST 2).

**Sof foyda toza:** `saleProfit` `netClient = sale_total − cost_total` ni hisoblab
serverning `net_profit` iga solishtiradi; accounting qatorida `delivery_amount`
ALOHIDA maydon, `sale_total` esa tovar bo'lib qoladi. Klientda hech narsa dastafkani
foydaga qo'shmaydi — qo'shsa, mavjud `reconcile` nomuvofiqlik nuqtasi yonardi.

## §0c — Yorliqlar

Sizning taklifingiz o'zgarishsiz qabul qilindi: **«Tovar savdosi»** · **«Dastafka»** ·
**«Kassaga tushgan»**. Naqd/karta kartochkalari ostiga **«dastafka ham ichida»** izohi
qo'shildi — ularsiz ular «Tovar savdosi» bilan ko'z bilan solishtirilmay qolardi.
`by_branch` sarlavhalarida Tip: *«Naqd va Karta ustunlari AYNAN «Kassaga tushgan»ni
bo'ladi — «Tovar savdosi»ni emas.»*

⚠️ Dastafka umuman bo'lmasa (`delivery_total = 0` va `delivery_count = 0`) qo'shimcha
kartochkalar va izohlar **CHIZILMAYDI** — ekran toza qoladi.

## §1 — Sotuv oynasi

Bitta ixtiyoriy «Dastafka» maydoni (sukut bo'yicha bo'sh, ≥ 0). To'ldirilsa footer
uchta qator ko'rsatadi: Sotuv summasi · Dastafka · **Mijozdan olinadi**.

Payload: `delivery_amount` **bo'sh bo'lsa YUBORILMAYDI** («0» ham emas); operator
ataylab «0» yozsa — yuboriladi. Testlangan.

**Chegirma tartibi tasdiqlandi:** `calc.totalSum` allaqachon chegirmadan keyingi jami
(`salePrice × qty`), dastafka esa uning USTIGA qo'shiladi — ya'ni dastafka hech qachon
chegirmaga tushmaydi. Test: 2 × 250 000 (chegirmali) + 20 000 = 520 000.

⚠️ **QARZ + DASTAFKA — API'dan aniqlanmadi.** Qarz summasi dastafkani o'z ichiga
oladimi yoki faqat tovarni — serverda 0 ta qarz bo'lgani uchun tekshirib bo'lmadi va
OpenAPI ham aytmaydi. Hozircha oynada qarz summasi **`payTarget`** (tovar + dastafka)
deb ko'rsatilyapti, chunki mijozdan olinadigan summa shu. → LIST 2 (ll).

## §2 — Ko'rinish

Sotuv tarixi qatori: **«300 000 so'm + 20 000 so'm dastafka = 320 000 so'm»** —
FAQAT `delivery_amount > 0` bo'lganda; dastafkasiz qatorlar toza qoladi (skrinshotda
ikkinchi qator shunday). Jamilar sarlavhasiga `delivery_total` va `received_total`
qo'shildi (ular ham faqat dastafka bo'lganda).

## §3 — Verify

`tsc` toza · **438/438 Vitest** (18 tasi shu ish uchun) · konsol xatosi yo'q ·
skrinshotlar dark + light: `dlv-sell-delivery-*`, `dlv-sell-ok-*`, `dlv-sell-mismatch-*`,
`dlv-history-*`, `dlv-accounting-*`.

```
DASTAFKA (naqd)  : {"line":true,"sum320":true,"goods":true,"dastafka":true}
ARALASH ochildi  : {"target":true,"blocked":true}
avtomatik        : {"dastafka":"20 000","cash":"100 000","card":"220 000"}  ← 320 000 dan
NOMUVOFIQ        : {"diff":true,"diffText":"Farq: 170 000 so'm kam","blocked":true}
TO'G'RI (100/220): {"noDiff":true,"enabled":true}
SOTUV TARIXI     : {"deliveryRow":true,"totalsDelivery":true,"plainNoParens":true}
HISOB-KITOB      : {"tovarSavdosi":true,"dastafkaCard":true,"kassaga":true,"cashNote":true}
```

Yo'l-yo'lakay: uchala pul maydoniga `aria-label` qo'shildi («Naqd summasi», «Karta
summasi», «Dastafka summasi») — ular bir xil `placeholder="0"` bilan farqlanmas edi.

## LIST 1 — append

DL1. **⚠️ DASTAFKA — TO'RT TOMONLAMA TEKSHIRUV (butun ma'nosi shu).** Avval Hisob-kitobdan
     TO'RT raqamni yozib oling: «Tovar savdosi», «Kassaga tushgan», «Naqd» (yoki «Karta»)
     va «Sof foyda». So'ng 300 000 so'mlik katalogni **20 000 dastafka** bilan naqdga
     soting. Keyin tekshiring:
     - **«Tovar savdosi» +300 000** (dastafka KIRMAYDI)
     - **«Kassaga tushgan» +320 000**
     - **«Naqd» +320 000** (dastafka ICHIDA)
     - **«Sof foyda» +(300 000 − tannarx)** — dastafka QATNASHMAYDI
     Va `cash + card + qarz + noma'lum = Kassaga tushgan` tengligi saqlanganini
     tekshiring. **⚠️ QAYTMAS.**
DL2. **Aralash + dastafka.** Aralash rejimda 300 000 tovar + 20 000 dastafka: naqd/karta
     yig'indisi **320 000** ga tenglashishi kerak. 150 000 + 150 000 kiritib ko'ring —
     endi «Farq: 20 000 so'm kam» chiqishi shart (ilgari bu to'g'ri edi). **READ.**
DL3. **Dastafkani KEYIN kiritish.** Aralashda avval naqdni yozing, so'ng dastafka
     qo'shing — karta (tegilmagan maydon) avtomatik qayta hisoblanishi kerak. **READ.**
DL4. **Chegirma + dastafka tartibi.** Chegirma bilan soting va dastafka qo'shing —
     dastafka chegirmaga TUSHMASLIGI, chegirmadan KEYIN qo'shilishi kerak. **READ.**
DL5. **Dastafkasiz sotuv toza qoladi.** Oddiy sotuvda tarix qatorida dastafka satri
     BO'LMASLIGI va Hisob-kitobda qo'shimcha kartochkalar chiqmasligi kerak. **READ.**

## LIST 2 — append

ll. ⚠️ **QARZ dastafkani o'z ichiga oladimi?** `payment_type: "debt"` + `delivery_amount`
   bo'lsa, Qarzdorlar sahifasidagi qarz summasi TOVAR (300 000) mi yoki TOVAR+DASTAFKA
   (320 000) mi? Serverda 0 ta qarz bo'lgani uchun tekshirib bo'lmadi, OpenAPI ham
   aytmaydi. Hozircha oynada 320 000 ko'rsatilyapti (mijozdan olinadigan summa).
   Bu Qarzdorlar sahifasi nimani ko'rsatishini ham hal qiladi.
mm. ⚠️ **Dashboard/Analitika dastafkani chiqarib tashlaydimi?** Uchala manba hozir
   mos (15 730 000), lekin `delivery_total = 0` bo'lgani uchun bu isbot emas. Birinchi
   dastafkali sotuvdan keyin paritet buzilsa, u BIZNING xatoimizdek ko'rinadi.
   Tasdiqlansin: `period_catalog_sales_revenue` va `catalog_sales_revenue` —
   TOVAR savdosimi (`total_sales`) yoki kassaga tushganmi (`received_total`)?
nn. **Jonli sinov ma'lumoti yo'q.** Spec «2 ta sotuvda dastafka bor» deydi, jonli
   serverda esa `delivery_count: 0`. Xuddi qarz (0 ta) va aralash (0 ta) kabi —
   frontend bu uchala xususiyatni ham HAQIQIY ma'lumotda tekshira olmayapti.
   Demo ma'lumot qoldirilsa yaxshi bo'lardi.

---

# BUG: FLORIST HAJM TARIFLARI MATRITSASI (2026-08-04)

## §1 — Jonli ma'lumot

```
GET /api/florist-volume-rates/?florist=8&is_active=true
{ "count": 24, "results": [
  { "id": 44, "florist_name": "Isroil",    "arrangement_type": "basket", "volume": "large",
    "default_stems": 0, "florist_fee": "80000.00",  "is_active": true, "florist": 7 },
  { "id": 32, "florist_name": "Abror",     "arrangement_type": "basket", "volume": "large",
    "default_stems": 0, "florist_fee": "100000.00", "is_active": true, "florist": 4 },
  { "id": 20, "florist_name": "Fatxulloh", "arrangement_type": "basket", "volume": "large",
    "default_stems": 0, "florist_fee": "80000.00",  "is_active": true, "florist": 8 },
  { "id": 38, "florist_name": "Bekzod",    ... "florist": 6 },  … jami 24 qator
]}
```

⚠️ **`?florist=8` so'ralgan, javobda 4, 6, 7 VA 8 ning qatorlari.**

```
GET /api/florists/8/ → volume_rates   (6 qator, FAQAT 8 niki — TO'G'RI ajratilgan)
[{ "id": 20, "arrangement_type": "basket", "volume": "large",
   "default_stems": 0, "florist_fee": "80000.00", "is_active": true }, …]
```

### Ikki manba farqi

| | ro'yxat endpointi | `florists/{id}/volume_rates` |
|---|---|---|
| florist bo'yicha ajratilgan | ❌ **YO'Q** | ✅ ha |
| `florist` maydoni | ✅ bor | ❌ **yo'q** |
| `florist_name` | ✅ bor | ❌ yo'q |
| `created_at`/`updated_at` | ✅ bor | ❌ yo'q |
| maydon nomlari va turlari | `florist_fee` (string), `default_stems` (int) — **IKKALASIDA BIR XIL** | |

## §2 — Sabablarni tekshirish

| # | Faraz | Natija |
|---|---|---|
| a | VOLUME satri mos kelmasligi (`S/M/L` ↔ `small/…`) | ❌ **EMAS** — jonli API `['large','medium','small']` beradi, bizdagi `VOLUMES` bilan AYNAN mos |
| b | ARRANGEMENT_TYPE mos kelmasligi | ❌ **EMAS** — `['basket','bouquet']`, mos |
| c | Maydon nomi (`florist_fee`/`default_stems`) | ❌ **EMAS** — kod aynan shularni o'qiydi, `florist_salary_amount` emas |
| d | Kodda qotib qolgan «placeholder» raqamlar | ❌ **EMAS** — komponentda birorta literal tarif qiymati yo'q |
| e | So'rov umuman ketmaydimi / gate | ❌ **EMAS** — so'rov ketadi va 200 qaytaradi |
| f | Kesh/ota obyektdan o'qish | ❌ **EMAS** — ochilganda yangi GET qilinadi |

### ⚠️ HAQIQIY SABAB — SERVER `?florist=` FILTRINI E'TIBORGA OLMAYDI

```
(filtrsiz)                count=24  floristlar=[4,6,7,8]
?florist=7                count=24  floristlar=[4,6,7,8]
?florist=8                count=24  floristlar=[4,6,7,8]
?florist=7&is_active=true count=24  floristlar=[4,6,7,8]
?florist=999              count=24  floristlar=[4,6,7,8]   ← mavjud bo'lmagan id
?florist=abc              count=24  floristlar=[4,6,7,8]   ← umuman raqam emas
```

`?florist=abc` ham bir xil natija berishi — parametr **umuman qo'llanmasligini** isbotlaydi.

`gridFromRates` esa qatorlar ustidan yurib `g[key] = …` qiladi — ya'ni **oxirgi yozuv
g'olib**. 24 qator kelgani uchun har bir katak oxirgi kelgan floristnikiga to'lardi va
natija HAMMA florist uchun BIR XIL bo'lardi — aynan shu «shablon qiymatlar»dek ko'rinardi:

```
bouquet small  → 5 000    (Isroil 7)      basket small  → 15 000   (Abror 4)
bouquet medium → 10 000   (Isroil 7)      basket medium → 40 000   (Bekzod 6)
bouquet large  → 40 000   (Fatxulloh 8)   basket large  → 100 000  (Bekzod 6)
```

Fatxulloh (8) ning HAQIQIY tariflari esa: `10 000 / 15 000 / 40 000` va
`10 000 / 30 000 / 80 000` — oltitadan to'rttasi noto'g'ri ko'rsatilardi.

## §3 — Tuzatish

`lib/inventory.ts` ga `ratesForFlorist(rates, floristId)` qo'shildi va **ikkala**
chaqiruv joyida qo'llandi:
- `components/FloristRateMatrix.tsx` — matritsa (faol + nofaol tekshiruvi + nusxalash)
- `components/KatalogModal.tsx` — kompozitorning «Tarifdan olindi» avto-to'ldirishi

⚠️ `florist` maydoni YO'Q qatorlar (ichma-ich manba) «allaqachon ajratilgan» deb
o'tkaziladi — shu bois funksiya ikkala manba bilan ham ishlaydi. Server keyinchalik
tuzatilsa filtr zararsiz qoladi (idempotent).

### ⚠️ Hech narsa JIMGINA normallashtirilmadi

Volume satrlari (`small/medium/large`) va arrangement type (`bouquet/basket`) jonli
API'da bizdagi konstantalar bilan AYNAN mos — hech qanday o'girish qo'shilmadi.

### Kompozitordagi bir nuans

Matritsa tayinlash sikli ishlatadi (**oxirgi** g'olib), kompozitor esa `find`
(**birinchi** g'olib). Shu bois kompozitorda xato TARTIBGA bog'liq edi — masalan
Isroilga (7) Fatxullohning `bouquet/small` = 10 000 i qo'yilardi (5 000 o'rniga),
Fatxullohda esa tasodifan to'g'ri chiqardi. Ikkalasi ham endi filtrlangan.

## Tekshirish

Test fixture — **jonli javobdan** olingan 13 qator (4 florist aralash), mock EMAS:
- filtrsiz grid boshqa floristlarning summasini berishini isbotlaydi;
- `ratesForFlorist(…, 8)` → aynan `{10000, 15000, 40000, 10000, 30000, 80000}`;
- ikki floristning gridi BIR XIL BO'LMASLIGI (nosozlik belgisi);
- tarifi yo'q florist → bo'sh (birovniki ko'rinmaydi);
- kompozitorning `find` yo'li ikkala holatda.

`tsc` toza · **450/450 Vitest** (13 tasi shu nosozlik uchun) · konsol xatosi yo'q.

**JONLI skrinshotlar** (mock YO'Q — `rate-florist-8-*`, `rate-florist-7-*`, dark + light):

```
FLORIST 8 «Fatxulloh» ekran: 10 000 · 15 000 · 40 000 | 10 000 · 30 000 · 80 000
FLORIST 8 API             : 10 000 · 15 000 · 40 000 | 10 000 · 30 000 · 80 000  ✓
FLORIST 7 «Isroil»  ekran :  5 000 · 10 000 · 40 000 | 10 000 · 30 000 · 80 000
FLORIST 7 API             :  5 000 · 10 000 · 40 000 | 10 000 · 30 000 · 80 000  ✓
```
Ikki florist endi TURLICHA ko'rsatilyapti — tuzatishning bevosita isboti.

## LIST 2 — append

oo. ⚠️ **`GET /api/florist-volume-rates/` `?florist=` filtrini QO'LLAMAYDI.** Jonli:
   `?florist=7`, `?florist=8`, `?florist=999` va hatto `?florist=abc` — hammasi bir xil
   24 qator qaytaradi. Bu frontendda har bir floristda BOSHQA floristning tarifi
   ko'rinishiga olib kelgan edi. Hozircha klientda filtrlaymiz, lekin server tuzatilsin
   (ro'yxat o'sganda bu ortiqcha trafik ham demakdir). Qo'shimcha: `is_active` filtri
   ishlayaptimi — alohida tekshirilsin, chunki u ham xuddi shu tarzda e'tiborsiz
   qolayotgan bo'lishi mumkin.
pp. **`default_stems` hamma qatorda 0.** Matritsada «0» ko'rinadi. Bu ataylabmi (dona
   soni ishlatilmayaptimi) yoki to'ldirilmaganmi? Agar ishlatilmasa, ustunni yashirish
   mumkin.

---

# TEKSHIRUV: `florist_salary_amount` standart katalogda qabul qilinadimi? (2026-08-04)

## HUKM: YO'Q — maydon QAYTA OCHILMADI

### 1. OpenAPI — yoziladigan, LEKIN bu hech narsani hal qilmaydi

```
CatalogItem.florist_salary_amount        : {"type":"string","format":"decimal"}  readOnly: FALSE
PatchedCatalogItem.florist_salary_amount : {"type":"string","format":"decimal"}  readOnly: FALSE
POST  /api/catalog/      → CatalogItem
PATCH /api/catalog/{id}/ → PatchedCatalogItem
```

Ya'ni kalit **qabul qilinadi**. Ammo bu faqat model maydoni ochiqligini bildiradi —
serializer `create()`/`update()` ichida uni baribir ustidan yozishi mumkin. Sxemada
standart/maxsus farqi haqida **hech narsa yo'q**: `"standard"`, `"volume rate"`, `"tarif"`
so'zlari `CatalogItem` sxemasida umuman uchramaydi. Ya'ni OpenAPI spec aytgan qoidani
IFODALAY OLMAYDI — u orqali javob berib bo'lmaydi.

### 2. Jonli solishtirish — hammasi tarifga MOS

Serverdagi 8 ta katalog (hammasi standart, florist va hajm bilan):

| katalog | florist | tur · hajm | katalog salary | tarif | |
|---|---|---|---|---|---|
| 179 | 8 | bouquet · small | 10 000 | 10 000 | mos |
| 180 | 8 | bouquet · medium | 15 000 | 15 000 | mos |
| 181 | 8 | bouquet · small | 10 000 | 10 000 | mos |
| 182 | 5 | basket · medium | 40 000 | 40 000 | mos |
| 183 | 5 | bouquet · medium | 15 000 | 15 000 | mos |
| 184 | 5 | bouquet · medium | 15 000 | 15 000 | mos |
| 185 | 5 | bouquet · medium | 15 000 | 15 000 | mos |
| **186** | 5 | bouquet · large | **100 000** | **50 000** | ⚠️ farqli |

**8 tadan 7 tasi tarifga AYNAN teng.**

⚠️ Yagona farqli qator (186) **override ishlayotganini ISBOTLAMAYDI** — aksincha:

```
katalog 186 created_at = 2026-08-03T12:00
tarif   id=49 fee=50 000  updated_at = 2026-08-04T14:32   ← katalogdan KEYIN o'zgargan
```

Tarif katalog yaratilgandan **keyin** tahrirlangan. Katalogning eski 100 000 ni saqlab
qolgani — «server yaratish paytidagi tarifni bosib qo'yadi» qoidasining AYNAN kutilgan
natijasi. Ya'ni bu topilma override ishlayotganiga QARSHI dalil.

### 3. ⚠️ Nega moslik ham hech narsani isbotlamaydi

Bizning kompozitorimiz ish haqini **tarifdan avtomatik to'ldiradi** va shu qiymatni
yuboradi. Shuning uchun «katalog salary == tarif» holati IKKALA farazga ham mos keladi:
serverning bosib yozgani ham, bizning aynan o'sha qiymatni yuborganimiz ham.

**Yagona hal qiluvchi sinov — BOSHQA qiymat yuborib, u saqlanadimi deb ko'rish. Bu YOZUV
amali, read-only rejimda mumkin emas.**

Qo'shimcha: serverda hozir **bironta ham `custom` katalog yo'q** (8 tasi ham standart),
shuning uchun «maxsusda qabul qilinadi» degan qarama-qarshi holatni ham ko'rsatib
bo'lmadi.

### Xulosa

Read-only dalillarning hech biri override ishlayotganini ko'rsatmaydi; eng kuchli signal
(186 ning eski tarifni saqlab qolgani) esa teskarisiga ishora qiladi. Sizning
ko'rsatmangiz bo'yicha — «qiymati jimgina yo'qoladigan input umuman yo'qidan battar» —
maydon **qayta ochilmadi**.

## Buning o'rniga: operator qayerga borishni bilsin

`components/KatalogModal.tsx` — standart katalogda:

- summa endi **«Tarifdan: 10 000 so'm»** deb ko'rsatiladi (ilgari shunchaki raqam edi —
  qayerdan kelgani bilinmasdi);
- ostida bir qator izoh: *«Summa hajm tarifidan olinadi va shu yerda o'zgartirilmaydi —
  tarifni floristning tarif jadvalida tahrirlang»*;
- **«Tarif jadvalini ochish →»** havolasi — o'sha floristning sahifasiga (`/floristlar/{id}`,
  yangi oynada);
- tarif yo'q holatda: «Bu florist uchun bu hajmda tarif yo'q» + **«Tarif belgilash →»**
  havolasi (ilgari faqat ogohlantirish bor edi, yo'l ko'rsatilmasdi).

Maxsus (custom) katalogdagi tahrirlanadigan maydon **tegilmadi**.

## Tekshirish

`tsc` toza · **450/450 Vitest** · konsol xatosi yo'q.

**JONLI skrinshotlar** (mock YO'Q — `sal-composer-light.png`, `sal-composer-dark.png`),
Fatxulloh + Buket + Kichik tanlangan holat:
```
{"tarifdan":true,"amount":"Tarifdan: 10 000 so'm","note":true,
 "link":true,"linkHref":"/floristlar/8","noInput":true}
```
Ko'rsatilgan 10 000 — API'dagi Fatxullohning bouquet/small tarifi bilan AYNAN bir xil.

## LIST 2 — append

qq. ⚠️ **`florist_salary_amount` standart katalogda haqiqatan e'tiborsizmi?** OpenAPI uni
   yoziladigan deb ko'rsatadi (`readOnly: false`), spec esa standartda e'tiborga
   olinmasligini aytadi — ikkalasi ZIDDIYATDA. Read-only tekshiruv hal qila olmadi
   (boshqa qiymat yuborish kerak). SETTLE: (1) standart katalogda yuborilgan qiymat
   saqlanadimi yoki tarif bosib yozadimi? (2) Agar bosib yozilsa, OpenAPI'da `readOnly`
   qilib belgilansinmi — hozircha sxema frontendni yanglishtiradi. (3) PATCH bilan
   keyinchalik o'zgartirsa-chi (yaratishdan farqli)?

---

# RASXODLAR SAHIFASI (2026-08-04)

## §0a — Ruxsat kaliti

Jonli `/api/me/` da **bor**:
```json
{ "page": "expenses", "label": "Rasxodlar", "can_view": true, "can_control": true }
```
To'liq kalitlar: `dashboard, inventory, catalog, crm, customers, conversations, social_posts,
notifications, suppliers, florists, attendance, settings, ai_settings, integrations, users,
mini_app, expenses, audit`.

**Noma'lum kalit XAVFSIZ.** `checkPerm` `permissions.find(x => x.page === page)` qiladi —
frontend bilmagan kalit hech qachon so'ralmaydi; NAV esa berilgan sahifalarga qarab
filtrlanadi, ya'ni tanilmagan kalit hech narsaga mos kelmaydi va hech narsa chizilmaydi.
Yiqilish YO'Q. `PermissionPage` turida `mini_app` bor edi, `expenses` yo'q edi — qo'shildi.

### ⚠️ FILIAL GATING — vazifadagi ikki faraz noto'g'ri

**1. Filial allowlist YO'Q — u yagona manba bo'la olmaydi.** U 2026-08-03 da SIZNING
ko'rsatmangiz bilan olib tashlangan («filial foydalanuvchi sidebari ortiqcha cheklangan —
ruxsat hukm qilsin»). `visibleScreens(_branchUser, …)` filial bayrog'ini UMUMAN
e'tiborga olmaydi. Siz nazarda tutgan audit **tuzatishgacha to'xtatilgan edi** — men
sizib chiqishni xabar qilganman (parkent_admin uchta sahifadan tashqari yana 9 ta
route'ga kira oladi), lekin gatingni O'ZGARTIRMAGANMAN.

**2. Backend bu sahifani filial foydalanuvchiga ATAYLAB bergan:**
```
parkent_admin     branch=2  can_view = [catalog, crm, customers, dashboard, expenses, notifications]  ← BOR
parkent_sotuvchi  branch=2  can_view = [catalog, customers, dashboard, notifications]                 ← yo'q
```
Va rasxodlar serverda haqiqatan filial bo'yicha ajratilgan: `?branch=2` → `net_profit 0`,
`?branch=main` → `1 179 700`; modelda `branch` maydoni bor.

Ya'ni «filialga sizib chiqmasin» va «API aytganicha gate qiling» AKS TOMONGA ishora
qiladi. Men `expenses` ruxsatiga gate qildim (backend nazarda tutgani va filial bo'yicha
ajratilgan ma'lumot shuni qo'llaydi) va buni **yashirmasdan xabar qilyapman** —
serverning ataylab bergan sahifasini bir tomonlama bloklab qo'ymadim. Aytsangiz bir
qatorda filial uchun yopaman; bu aslida to'xtatilgan auditdagi hal qilinmagan allowlist
savoli.

## §0b — Accounting yangi maydonlari (jonli)

```
total_sales               = 2 000 000
cost_total                =   820 300
waste_cost_total          =         0
net_profit                = 1 179 700   ← O'ZGARMAGAN, hamon SOTUV foydasi
expense_total             =         0
expense_count             =         0
net_profit_after_expenses = 1 179 700
```
**Ayirish to'g'ri:** `1 179 700 − 0 = 1 179 700` ✓. `summary` da ham, **ikkala**
`by_branch` qatorida ham bor; yuqori darajada `expenses_by_category: []`.

⚠️ Serverda **0 ta rasxod** bor, shuning uchun `net_profit == net_profit_after_expenses` —
bu SHAKLNI tasdiqlaydi, XATTI-HARAKATNI emas. Bu ketma-ket **to'rtinchi** xususiyat
(qarz, aralash, dastafka, endi rasxod) jonli ma'lumotda sinab bo'lmadi.

Filial filtri ishlaydi: `?branch=2` → `net_profit 0`; `?branch=main` → `1 179 700`.

Yagona renderer (`accountingRowView`) `expense`, `expenseCount`, `netAfter` ni oldi —
`summary` (Jami) va `by_branch` qatorlari IKKALASI ham avtomatik ko'rsatadi.

**Paritet buzilmadi** — u `total_sales` ga tayanadi, bularning hech biri unga tegmaydi.

## §0c — Hisob-kitobdagi pul raqamlari va tartib

Endi bir ekranda: `total_sales` · `delivery_total` · `received_total` · `cost_total` ·
`waste_cost_total` · `net_profit` · `expense_total` · `net_profit_after_expenses`.

Arifmetika bloki (kartochkalardan YUQORIDA, alohida ramka):
```
Savdo                      2 000 000
Tannarx                  −   820 300
Chiqit                   −         0
──────────────────────────────────────
Sof foyda                  1 179 700   ← net_profit (Tip: rasxodlar HISOBGA OLINMAGAN)
Rasxodlar                −         0   ← expense_total
══════════════════════════════════════
Rasxoddan keyingi foyda    1 179 700   ← net_profit_after_expenses (kattaroq, --acc rangda)
```
Ikki foyda VIZUAL ajratilgan: «Sof foyda» qalin/oddiy rangda, «Rasxoddan keyingi foyda»
qo'shaloq chiziqdan keyin kattaroq va aksent rangda, ikkalasida ham bir-birini
ARALASHTIRMASLIK haqida Tip.

## §0c(2) — `by_day` teskarisiga o'girish

Server ENG YANGI KUNNI BIRINCHI beradi. `byDayChronological` BITTA joyda o'giradi va
test bilan mixlangan (asl massiv o'zgarmaydi). Ekranda kunlar **01 → 03 → 04** tartibida
chiqdi (skrinshot bilan tasdiqlangan).

## Qurilgani

- `lib/expenses.ts` — `buildExpenseQuery` (ro'yxat VA yig'indi uchun BITTA quruvchi),
  `expenseFiltersToParams`, `spentAtPayload`, `byDayChronological`, `byCategoryDesc`,
  `validateExpense`, `buildExpensePayload`, `buildExpenseEditPayload`, `expenseNum`.
- `app/rasxodlar/page.tsx` — kartochkalar, ikki vizual, jadval, server filtrlari
  (URL'da), server sahifalash, o'chirish tasdig'i, bo'sh/yuklanish/xato holatlari.
- `components/ExpenseModal.tsx` — qo'shish/tahrirlash, serverdan kelgan tanlovlar.
- `lib/branch.ts` NAV + `Shell.tsx` ROUTE_PERM — nav VA route ikkalasi ham gate.
- `app/hisob-kitob/page.tsx` — arifmetika bloki + rasxod turlari + sahifaga havola
  (joriy sana oralig'i URL'da).

Sidebar tartibi (yuqori oltilik TEGILMAGAN): … Analitika · Hisob-kitob · Filial hisoboti ·
**Rasxodlar** · AI yordamchi · Buyurtmalar · Bronlar · Mijozlar · Qarzdorlar · …

### ⚠️ SANA — katalog/chiqim formalaridan FARQLI

`spent_at` sukut bo'yicha **BO'SH**; tegilmasa kalit UMUMAN yuborilmaydi va backend
hozirgi vaqtni qo'yadi. `new Date()` HECH QACHON yuborilmaydi. Sana tanlansa —
`YYYY-MM-DDT00:00:00+05:00`. Boshqa formalardagi «bugun» sukuti bu yerda TAKRORLANMADI.

## §4 — Verify

`tsc` toza · **489/489 Vitest** (39 tasi shu ish uchun) · konsol xatosi yo'q ·
skrinshotlar dark + light: `exp-page-*`, `exp-filtered-*`, `exp-form-*`, `exp-accounting-*`.

```
SAHIFA     : {"cards":true,"total":true,"avg":true,"charts":true,"rows":true,
              "chips":true,"who":true,"dayOrder":"01,03,04"}   ← XRONOLOGIK
FILTRLANGAN: {"onlyRent":true,"url":"?category=rent"}
FORMA      : {"open":true,"req":true,"dateEmpty":true,"hint":true}  ← sana BO'SH
HISOB-KITOB: {"sof":true,"after":true,"n1":true,"exp":true,"n2":true,
              "breakdown":true,"link":true}
```

## LIST 1 — append

RX1. **⚠️ RASXOD → HISOB-KITOB (butun ma'nosi shu).** Avval Hisob-kitobdan IKKI raqamni
     yozib oling: «Sof foyda» va «Rasxoddan keyingi foyda». So'ng 150 000 so'mlik rasxod
     qo'shing (masalan Transport). Keyin tekshiring:
     - **«Sof foyda» O'ZGARMAGAN** (rasxod sotuv foydasiga tegmaydi)
     - **«Rasxoddan keyingi foyda» AYNAN 150 000 ga kamaygan**
     - «Rasxod turlari» ajratmasida yangi tur paydo bo'lgan
     **⚠️ RASXODLAR HISOBOTGA DARHOL TA'SIR QILADI.**
RX2. **⚠️ ORQAGA SANALI rasxod.** Sanani o'tgan oyga qo'yib rasxod kiriting. Hisob-kitobda
     davrni O'SHA OYGA o'zgartiring — rasxod o'sha oyda ko'rinishi, joriy oyda esa
     KO'RINMASLIGI kerak (`date_from`/`date_to` sarflangan sana bo'yicha ishlaydi).
     **⚠️ RETROAKTIV.**
RX3. **Sana bo'sh qolsa.** Sanaga TEGMASDAN saqlang — yozuv bugungi vaqt bilan tushishi
     kerak (frontend `new Date()` yubormaydi). **READ.**
RX4. **Yig'indi jadvalga MOS.** Filtr qo'ying (masalan Turi = Ijara) — yuqoridagi
     «Jami rasxod» faqat ko'rinayotgan qatorlarni hisoblashi kerak, butun davrni emas.
     Sahifani almashtiring — jamilar O'ZGARMASIN. **READ.**
RX5. **Tur ro'yxati serverdan.** Backend yangi tur qo'shsa, u frontend o'zgarmasdan
     tanlovda paydo bo'lishi kerak. **READ.**
RX6. **O'chirish.** Rasxodni o'chiring (tasdiq oynasi chiqadi) — «Rasxoddan keyingi
     foyda» darhol ortishi kerak. **⚠️ QAYTMAS.**

## LIST 2 — append

rr. ⚠️ **Filial foydalanuvchisi Rasxodlar sahifasini ko'rishi KERAKMI?** Backend
   `parkent_admin` ga `expenses` ruxsatini bergan va rasxodlar filial bo'yicha
   ajratilgan (`?branch=2` alohida `expense_total` beradi), lekin
   FRONTEND_BRANCH_PARKENT.md filial menyusini uchta sahifa bilan cheklaydi. Hozircha
   ruxsatga gate qilingan (ya'ni parkent_admin ko'radi). SETTLE: (1) bu ataylabmi?
   (2) Agar yo'q bo'lsa, ruxsat backenddan olib tashlansinmi yoki frontend filial
   allowlist qaytarilsinmi? Bu to'xtatilgan filial auditidagi hal qilinmagan savolning
   o'zi.
ss. **Jonli sinov ma'lumoti yo'q — endi TO'RTTA xususiyatda.** Qarz (0 ta), aralash
   to'lov (0 ta), dastafka (0 ta) va rasxod (0 ta) — hech biri haqiqiy ma'lumotda
   tekshirilmadi. Barchasida faqat javob SHAKLI tasdiqlangan. Serverda kamida bittadan
   namuna yozuv qoldirilsa, frontend ularni haqiqatan tekshira olardi.

---

# DASTAFKA QOIDASI TESKARISIGA O'ZGARDI (2026-08-04)

## §0 — Eski qoida qayerda yashagan

⚠️ **Avval MUHIM aniqlik:** saqlangan uchta maydon MUNOSABATI O'ZGARMADI.
`received = sale + delivery` va `sale = received − delivery` — bu AYNAN bir tenglama.
O'zgargani — **operator qaysi raqamni yozishi**, maydonlar orasidagi bog'liqlik emas.

| Joy | Eski | Yangi | O'zgardimi |
|---|---|---|---|
| **Sotuv oynasi `payTarget`** (`mixedTarget(calc.totalSum, delivery)`) | tovar + dastafka | `sale_price` dastafkani ALLAQACHON o'z ichiga oladi → qo'shish **IKKI MARTA** | ✅ **asl nosozlik** |
| **Footer «Mijozdan olinadi»** = payTarget | tovar + dastafka | o'sha ikki marta hisob | ✅ |
| **Aralash: jami / avto-to'ldirish / ✓ / farq** | tovar + dastafka | sotuv summasining O'ZI | ✅ |
| `deliveryRowView` zaxirasi `goods + delivery` | received ni hosil qilardi | arifmetik to'g'ri, ammo endi TOVAR received'dan AYIRILADI | ✅ yo'nalish o'zgardi |
| Sotuv qatori matni «300 000 + 20 000 dastafka = 320 000» | «ustiga qo'shildi» deb o'qilardi | «shundan» deb o'qilishi kerak | ✅ qayta nomlandi |
| `lib/branch.ts` `received = total_sales + delivery_total` | accounting | **spec §3 buni SAQLAB QOLDI** | ❌ to'g'ri, tegilmadi |
| `types.ts` `CatalogSaleRow` izohi | «received = sale + delivery» | yo'nalish teskari | ✅ izoh |
| Hisob-kitob yorliqlari | tovar / dastafka / kassaga | ma'nolari o'zgarmadi | ❌ kerak emas |

**Ikki marta hisoblash FAQAT sotuv oynasida edi** — u yerda `sale_price` endi dastafkani
o'z ichiga oladi.

## §3 — Eski sotuvlar TO'G'RI ko'rinadi (migratsiya muammosi YO'Q)

Jonli holatda dastafkali BITTA sotuv bor:
```
id=299 «SUMKALI KOMPAZITSA»
   sale_total 350 000 · delivery_amount 50 000 · received_total 400 000
   YANGI (sale = received − delivery): 350 000 ✓
   ESKI  (received = sale + delivery): 400 000 ✓
```
**Ikkalasiga ham mos** — chunki bu bitta tenglamaning ikki ko'rinishi. Ya'ni eski
qatorlar noto'g'ri ko'rsatilmaydi va migratsiya talab qilinmaydi. Bu xavf
RO'YOBGA CHIQMADI — shuni ochiq aytamiz.

## §4 — Jonli invariantlar (yangi qoida ostida)

```
total_sales    2 650 000 + delivery_total 50 000 = received_total 2 700 000  ✓
cash 1 600 000 + card 1 100 000 + 0 + 0          = received_total 2 700 000  ✓
net_profit 651 450 = total_sales − tannarx − chiqit   (dastafka QATNASHMAYDI)
sotuv tarixi totals: revenue 2 650 000 + delivery 50 000 = received 2 700 000 ✓
```
OpenAPI endi `delivery_amount` ni shunday hujjatlaydi:
*«Sotuv summasining ichidagi yetkazib berish puli»* — ya'ni summaning ICHIDA.

## §1 — Sotuv oynasi

- «Sotuv summasi (mijozdan olinadi)» → `sale_price`; **«Shundan dastafka»** →
  `delivery_amount`. «Shundan» so'zi — butun ma'no shunda.
- Ostida HOSILA qator: **«Tovar savdosi (hisoblanadi) 250 000 so'm»** — kiritma emasligi
  ochiq yozilgan.
- Izoh: *«Sotuv summasining ICHIDAN kuryerga ketadigan pul — ustiga qo'shilmaydi.»*
- Validatsiya: dastafka sotuv summasidan **QAT'IY kichik**; teng bo'lsa ham bloklanadi
  (tovar savdosi 0 bo'lib qolardi). Xabar serverning yangi 400 matni bilan bir shaklda.
- **Aralash jami REVERT QILINDI**: endi sotuv summasining o'zi. Jonli tekshiruv:
  300 000 sotuv + 50 000 dastafka da naqd 100 000 kiritilsa karta **200 000** to'ladi
  (eski qoidada 220 000 edi).

### ⚠️ CHEGIRMA bilan o'zaro ta'sir — TOPILMA, taxmin emas

`discount_reason` `sale_price < price` bo'lganda majburiy. Endi `sale_price` dastafkani
o'z ichiga oladi, `price` esa TOVAR narxi — ya'ni **turli xil kattaliklar** solishtiriladi:

- E'lon 450 000, tovar 450 000 + 50 000 dastafka → `sale_price` 500 000 > 450 000 →
  chegirma DEB HISOBLANMAYDI (to'g'ri natija).
- E'lon 450 000, tovar **400 000** + 50 000 dastafka → `sale_price` 450 000 = e'lon →
  chegirma DEB HISOBLANMAYDI, holbuki tovar e'londan 50 000 PAST ketdi.

Ikkinchi holat haqiqiy chegirmani JIMGINA yashiradi. Spec ham, OpenAPI ham server nimani
solishtirishini aytmaydi — shuning uchun TAXMIN QILMADIM, LIST 2 ga yozdim.

## Testlar

Eski qoidani kodlagan testlar **O'CHIRILDI** (ikkalasi qoldirilmadi) va yangisi yozildi:
`deliveryGoods` (500 000 − 50 000 = 450 000 va «550 000 EMAS»), `deliveryTooLarge`
(teng ham noto'g'ri), aralash jami (150+150=300 000 ✓, 320 000 endi «20 000 ortiq»),
`deliveryRowView` (jonli id 299 qatori bilan).

`tsc` toza · **494/494 Vitest** · konsol xatosi yo'q · skrinshotlar dark + light:
`rev-sell-delivery-*`, `rev-sell-ok-*`, `rev-sell-mismatch-*`, `rev-history-*`.

Ekranda (300 000 sotuv, 50 000 dastafka):
```
Asl narx            300 000 so'm
Shundan dastafka   − 50 000 so'm
Tovar savdosi       250 000 so'm
Mijozdan olinadi    300 000 so'm   ← 350 000 EMAS (ikki marta hisob yo'q)
```

## LIST 1 — DL1 QAYTA YOZILDI

~~DL1 (eski): 300 000 + 20 000 dastafka = 320 000 olinadi~~ — **bekor**, o'rniga:

DL1. **⚠️ DASTAFKA — BESH TOMONLAMA TEKSHIRUV (butun ma'nosi shu).** Hisob-kitobdan BESH
     raqamni yozib oling: «Tovar savdosi», «Dastafka», «Kassaga tushgan», «Naqd» va
     «Sof foyda». So'ng **500 000** ga soting, **shundan 50 000** dastafka, naqd bilan.
     Formada «Tovar savdosi 450 000» ko'rinishi kerak. Saqlagach tekshiring:
     - **«Tovar savdosi» +450 000** (dastafka KIRMAYDI)
     - **«Dastafka» +50 000**
     - **«Kassaga tushgan» +500 000**
     - **«Naqd» +500 000** (mijoz to'lagan to'liq pul)
     - **«Sof foyda» = 450 000 − tannarx** (dastafka QATNASHMAYDI)
     Va `naqd + karta + qarz + noma'lum = Kassaga tushgan` tengligini tekshiring.
     **⚠️ QAYTMAS.**
DL2. **Aralash + dastafka (YANGI qoida).** 300 000 sotuv, shundan 20 000 dastafka:
     naqd + karta **300 000** ga tenglashishi kerak (320 000 EMAS — bu eski qoida edi).
     **READ.**
DL3. **Dastafka juda katta.** Dastafkani sotuv summasiga TENG qilib qo'ying — bloklanishi
     va «Dastafka summasi sotuv summasidan kam bo'lishi kerak…» chiqishi kerak. **READ.**
DL4. **Tarixda uchala raqam.** Sotuvlar tabida qator «shundan 50 000 dastafka → tovar
     450 000» ko'rinishida bo'lsin; dastafkasiz qatorlar toza qolsin. **READ.**
DL5. **Eski dastafkali sotuv.** id 299 (400 000 / 50 000 / 350 000) hamon TO'G'RI
     ko'rinishi kerak — migratsiya talab qilinmaydi. **READ.**

## LIST 2 — append

tt. ⚠️ **Chegirma tekshiruvi dastafka bilan buziladimi?** `discount_reason`
   `sale_price < price` bo'lganda majburiy, lekin endi `sale_price` dastafkani o'z ichiga
   oladi, `price` esa tovar narxi. Natijada tovar e'londan past ketgan bo'lsa ham
   dastafka uni «yopib» chegirma aniqlanmay qolishi mumkin (misol yuqorida).
   SETTLE: (1) server chegirmani `sale_price` bilanmi yoki `sale_price − delivery_amount`
   (tovar) bilanmi solishtiradi? (2) Agar `sale_price` bo'lsa — bu ataylabmi?
   Aks holda dastafkali sotuvlarda chegirma hisobotlari kam ko'rsatadi.

---

# RASXODLAR — KALENDAR KO'RINISHI (2026-08-04)

## §0 — Audit

**Avvalgi spec'dan qurilgani** (`fbedd01`): kartochkalar + turlar bari + kunlar bari +
filtrlangan jadval + sahifalash, `ExpenseModal`, `lib/expenses.ts`, 39 test, nav/route
gate, Hisob-kitob arifmetikasi. Ya'ni bu **konversiya**, noldan qurish emas.

### ⚠️ `category` HAQIQATAN olib tashlangan — o'chirishdan OLDIN uch usulda tekshirildi

```
GET /api/expenses/categories/  → 404 {"detail": "Not found."}
GET /api/expenses/options/     → 200 {"payment_methods":[cash, card, transfer]}
OpenAPI Expense / PatchedExpense kalitlari:
  amount, branch, branch_name, created_at, created_by, created_by_detail,
  destination, id, note, payment_method, payment_method_label, spent_at, updated_at
  → 'category' bor: False
GET /api/expenses/summary/     → by_payment_method + by_day; 'by_category': False
```

Shu sababli o'chirildi: `category`, `category_label`, tur filtri, turlar diagrammasi,
`byCategoryDesc`, `expenseCategories()` va `ExpenseModal`.

### Accounting ham o'zgargan (siz taxmin qilganingizdek)

`expenses_by_category` **YO'Q**; o'rniga yuqori darajada `expenses` ro'yxati (hozir `[]`).
Jonli:
```
total_sales 4 700 000 · cost 3 444 550 · waste 0
net_profit                1 255 450   ← O'ZGARMAGAN, sotuv foydasi
expense_total                     0
net_profit_after_expenses 1 255 450   ✓ ayirish to'g'ri
```
`summary` da ham, ikkala `by_branch` qatorida ham bor. ⚠️ Serverda **0 ta rasxod** —
shakl tasdiqlandi, xatti-harakat emas (ketma-ket beshinchi xususiyat).

### ⚠️ §5 — filial farazi UCHINCHI marta noto'g'ri

> «confirm it's excluded by the branch allowlist without needing a special case»

**Filial allowlist YO'Q.** U 2026-08-03 da sizning ko'rsatmangiz bilan olib tashlangan
(«ruxsat hukm qilsin»), uni tiklashi kerak bo'lgan audit esa tuzatishgacha to'xtatilgan.
Bundan tashqari **`parkent_admin` da `expenses` can_view BOR** — ya'ni filial
foydalanuvchisi bu sahifaga BUGUN ham kira oladi.

Maxsus holat qo'shmadim — bu turg'un ko'rsatmaga zid bo'lardi. Bayroqlanmoqda; aytsangiz
bir qatorda yopiladi.

## §2 — Ma'lumot yuklash

- Ko'rinib turgan to'r uchun **bitta** so'rov:
  `?date_from=<birinchi katak>&date_to=<oxirgi katak>&page_size=500&ordering=spent_at`.
  `visibleRange` qo'shni oylarning kunlarini ham qamraydi (2026-avgust → 27-iyuldan).
- Oylik jami — `summary/` oyning O'ZI bilan (`monthRange`).
- ⚠️ **ABORT**: `AbortController` har yuklashda; `request()` ichida chaqiruvchi signali
  ichki taymer kontrolleriga **bog'landi** — ilgari `init.signal` bosib ketilardi va
  bekor qilish umuman ishlamasdi. Bekor qilingan `AbortError` chaqiruvchiga O'ZIDEK
  uzatiladi (xato sifatida ko'rsatilmaydi).
- ⚠️ **Kesilish jimgina emas**: `count − results.length > 0` bo'lsa sarlavhada
  «⚠️ N ta yozuv ko'rsatilmadi — oraliqni qisqartiring» chiqadi.

## §1/§3/§4 — Qurilgani

Oy to'ri (bugungi katak ●+tint, 3 tagacha yozuv + «+N ta», kunlik jami, oydan tashqari
kunlar xira), hafta (7 ustun, kesilmagan), kun, ro'yxat (qidiruv + min/max). Ko'rinish va
oy **URL'da** saqlanadi. Kun paneli o'ngdan (vaqt, summa, to'lov, izoh, ✎/🗑,
«+ Shu kunga qo'shish»). Klaviatura: ← → T N Esc — **input fokusda bo'lsa tegmaydi**.
O'chirish «Rasxod o'chirilsinmi?» tasdig'i bilan (204).

⚠️ **Ranglar**: faqat to'lov nuqtachalari — `#22c55e` / `#3b82f6` / `#8b5cf6`.
Bizda bu uchtaga token ekvivalenti YO'Q (mavjud `--success-ink` yashil boshqa ohangda),
shuning uchun spec bergan literal qiymatlar ishlatildi va `PAYMENT_DOT` da
markazlashtirildi. Boshqa hech qayerda rangli fon yo'q.

⚠️ **Sana qoidasi — uchta holat** (`quickAddSpentAt`, uchalasi testlangan):
[+] dan tegilmagan → kalit YO'Q · kun katakchasidan → `T00:00:00+05:00` ·
vaqt tanlangan → o'sha vaqt. `new Date()` HECH QACHON yuborilmaydi.

### ⚠️ Yo'l-yo'lakay topilgan nosozlik: chuqur havola ishlamasdi

URL yozuvchi effekt mount'da SUKUT holat bilan ishga tushib, `?view=hafta` ni
`?view=oy` ga almashtirib yuborardi. Endi birinchi yurish o'tkazib yuboriladi —
uchala ko'rinish ham havoladan to'g'ri ochiladi (tasdiqlangan).

## §8 — Verify

`tsc` toza · **508/508 Vitest** (25 tasi kalendar uchun) · konsol xatosi yo'q ·
skrinshotlar dark + light: `cal-month-*`, `cal-day-panel-*`, `cal-quick-add-*`,
`cal-hafta-*`, `cal-kun-*`, `cal-royxat-*`, `cal-mobile-*`, `cal-accounting-*`.

```
OY         : header ✓ month ✓ weekdays ✓ total ✓ «+2 ta» ✓ views ✓
KUN PANELI : ochildi ✓ vaqtlar (17:40 / 09:15) ✓ «Shu kunga qo'shish» ✓ 5/5 yozuv ✓
QUICK ADD  : ochildi ✓ Summa ✓ Qayerga ✓ «o'zgartir» ✓ radiolar ✓ AUTOFOCUS ✓
HAFTA/KUN/RO'YXAT : ✓ (URL: ?view=hafta|kun|royxat)
MOBIL (390px)     : kunlar ro'yxati ✓, to'r YO'Q ✓
HISOB-KITOB       : Sof foyda ✓ Rasxoddan keyingi foyda ✓ 5 200 000 − 3 505 000
                    = 1 695 000 ✓ rasxodlar ro'yxati ✓ havola ✓
```

## LIST 1 — RX bloki QAYTA YOZILDI (kalendar UI)

~~RX1–RX6 (jadval UI)~~ — bekor, o'rniga:

RK1. **⚠️ KUN KATAKCHASIDAN ORQAGA SANALI RASXOD (butun ma'nosi shu).** Hisob-kitobdan
     IKKI raqamni yozib oling: «Sof foyda» va «Rasxoddan keyingi foyda». Kalendarda
     ‹ bilan O'TGAN OYGA o'ting, biror kun katakchasiga bosing, 150 000 so'mlik rasxod
     qo'shing. Keyin tekshiring:
     - yozuv **O'SHA kun katakchasida** paydo bo'ldi (bugungi kunda EMAS)
     - Hisob-kitobda davrni o'sha oyga qo'ying: **«Sof foyda» O'ZGARMAGAN**,
       **«Rasxoddan keyingi foyda» 150 000 ga kamaygan**
     - joriy oyda esa bu rasxod KO'RINMAYDI
     **⚠️ RASXODLAR HISOBOTGA DARHOL TA'SIR QILADI.**
RK2. **[+] dan sana tegilmasa.** [+] bosing, sanaga TEGMANG, saqlang — yozuv BUGUNGI
     katakka tushishi kerak (frontend `new Date()` yubormaydi). **READ.**
RK3. **«+N ta» va kun paneli.** Bir kunga 4+ rasxod qo'shing — katakda 3 tasi va
     «+N ta» ko'rinsin; bosilganda o'ng panel HAMMASINI vaqt bo'yicha ko'rsatsin. **READ.**
RK4. **Tez ‹ › bosish.** ‹ ni ketma-ket tez bosing — oxirida KO'RINAYOTGAN oyning
     ma'lumoti turishi kerak (eski oy javobi kelib qolmasin). **READ.**
RK5. **Klaviatura.** ← → oy, T bugun, N yangi, Esc yopadi. Summa maydoniga yozayotganda
     bu tugmalar ishlamasligi kerak. **READ.**
RK6. **Faqat ko'rish huquqi.** `expenses` da `can_control` YO'Q foydalanuvchi bilan
     kiring — [+], ✎, 🗑 KO'RINMASLIGI va kun katakchasiga bosilganda forma
     OCHILMASLIGI kerak. **READ.**
RK7. **Mobil.** Telefon enida to'r o'rniga kunlar ro'yxati va suzuvchi [+] bo'lsin. **READ.**

## LIST 2 — append

uu. ⚠️ **Filial foydalanuvchisi Rasxodlar kalendarini ko'radi.** `parkent_admin` da
   `expenses` ruxsati bor va filial allowlist yo'q. RASXODLAR_KALENDAR_DIZAYN.md
   filialga nima bo'lishini aytmaydi, spec §7 esa faqat ruxsatni nomlaydi.
   Bu (rr) va to'xtatilgan filial auditidagi savolning o'zi — bitta qaror kerak.
vv. **`page_size=500` yetmasligi mumkin.** Endpoint sahifalangan (`count`/`next`) va biz
   `count > results.length` bo'lsa ogohlantiramiz, lekin KEYINGI sahifani olmaymiz.
   Band oyda bu yuzaga chiqadi. SETTLE: `next` bo'yicha yurish kerakmi yoki serverda
   kalendar uchun alohida (sahifalanmagan) endpoint qo'shiladimi?

═══════════════════════════════════════════════════════════════════
# RESTAVRATSIYA (FRONTEND_CATALOG_REWORK_API.md, 2026-08-05)
# READ-ONLY: GET + jonli OpenAPI. POST ATAYIN sinalmagan (spec bo'yicha yozildi).
═══════════════════════════════════════════════════════════════════

## §4 — Jonli tekshiruv (backend DEPLOY QILINGAN)

```
GET /api/catalog-reworks/           → 200 {"count": 0, "next": null, "previous": null, "results": []}
OpenAPI yo'llari                    → /api/catalog-reworks/      : get, post
                                       /api/catalog-reworks/{id}/ : get   ← FAQAT GET
GET parametrlari                    → florist, ordering, page, page_size, search
CatalogReworkCreate  required       → ['florist', 'outputs']
CatalogReworkOutputInput required   → ['composition', 'name_uz', 'price']
enum arrangement_type               → [bouquet, basket, box]
enum catalog_kind                   → [standard, custom]
enum status                         → [available, draft]
FloristSalaryEntry.source enum      → … + rework ✓
```

**`quantity_reworked` KATALOG ITEMDA BOR** (jonli, id=211):

```json
{"quantity_remaining": 1, "quantity_total": 1, "quantity_sold": 0,
 "quantity_wasted": 0, "quantity_reworked": 0, "quantity_stock_deducted": 1}
```

⚠️ **BEKOR QILISH YO'Q — OpenAPI'da tasdiqlangan.** `{id}/` da faqat `get` bor:
PATCH ham, DELETE ham YO'Q. Saqlangan restavratsiya QAYTMAYDI.

## §0a — QOLDIQ MATEMATIKASI (app-wide, TUZATILDI)

Ilgari HAMMA joyda `total − sold` hisoblanardi — ya'ni `quantity_wasted` ALLAQACHON
e'tiborsiz qolayotgan edi (jonli maydon bo'lsa ham), `quantity_reworked` esa endi
qo'shildi. Oltita joy `lib/rework.ts → catalogRemaining()` ga o'tkazildi; u avval
SERVER hisoblagan `quantity_remaining` ni oladi (avtoritativ), bo'lmasa
`total − sold − wasted − reworked` ni o'zi ayiradi:

| # | Joy | Nima buzilgan edi |
|---|---|---|
| 1 | `app/katalog/page.tsx` — kartochka `left` | «N TA QOLDI» va sotiladigan holat oshib ketardi |
| 2 | `app/katalog/page.tsx` — filialga yuborish gate'i ×2 | buzilgan donani yuborishga ruxsat berardi |
| 3 | `components/KatalogSellModal.tsx` — `left` | sotuv maksimumi oshib ketardi |
| 4 | `components/CatalogTransferDrawer.tsx` — `unsold` | transfer maksimumi oshib ketardi |
| 5 | `components/KatalogViewModal.tsx` — `left` | batafsildagi qoldiq |
| 6 | `components/UsagePicker.tsx` — `remaining` | tanlanadigan dona |

Kartochkada spec qatori: «Jami 3 · Sotildi 1 · Restavratsiyada 1 · Qoldi 1»
(chiplar) + batafsilda AYNAN shu satr (`catalogCountsLabel`).

## §0b — «SKLADDAN YECHISH» (verdict: TUGMA UMUMAN YO'Q)

Biz `quantity_stock_deducted` ni **o'qiymiz** (kartochkada «Kutilmoqda: N»,
batafsilda «Skladdan yechilgan» sanasi), lekin katalog itemida **yechish AMALI
umuman yo'q** — ya'ni bugun bosiladigan tugma ham yo'q, 400 ham chiqmaydi.
`stockAlreadyDeducted()` lib'ga qo'yildi va batafsilda «To'liq yechilgan —
qayta yechilmaydi» qatorini chiqaradi; tugma qo'shilsa gate TAYYOR.

## §0c — OYLIK MANBASI `rework`

Filtr va legenda `Object.keys(SALARY_SOURCE_LABEL)` dan quriladi → `rework`
avtomatik chiqdi. **Noma'lum manba** esa ilgari XOM `snake_case` bo'lib ekranga
chiqardi (`LABEL[v] ?? v`) va hech kim sezmasdi. Endi `lib/enumLabel.ts`:
o'qiladigan zaxira («Kelajak manba») + konsolga BIR MARTA ogohlantirish.
Formada: «Haq yozilmasa (0) **oylik yozuvi yaratilmaydi**».

## §0d — `reference_type: catalog_rework`

Yorliq qo'shildi. ⚠️ **Asl nosozlik yorliqda emas edi:** `BatchDrawer.tsx` yorliqni
faqat `reference_type.startsWith("florist")` bo'lganda chizardi — ya'ni
`catalog_rework` yorliq bilan ham jurnalda KO'RINMAY qolardi. Shart olib tashlandi.
`movementRefLabel` endi noma'lum tur uchun `null` qaytarmaydi — ko'rsatadi va
ogohlantiradi.

## §0e — ⚠️ RESTAVRATSIYA YO'QOTISHI HISOBOTDAGI «CHIQIT»GA TUSHMAYDI (patch YO'Q)

`lib/finance.ts → costBreakdown()` chiqitni FAQAT sklad harakatlaridan yig'adi
(`wasteMovements`). Spec esa aniq aytadi: restavratsiyada sklad chiqit harakati
**yaratilmaydi** — yo'qotish hujjat ichidagi `waste_stems`/`waste_cost` bo'lib qoladi.
**Demak bugun bu yo'qotish hisobotdagi chiqit raqamiga KO'RINMAYDI.** Bu florist-chiqit
topilmasi bilan bir sinf. Taklif: Hisob-kitobda **alohida** «Restavratsiyadagi
yo'qotish» qatori — sklad chiqitiga **QO'SHILMAYDI** (LIST 2 ww). Hozircha faqat
restavratsiya hujjatining o'zida ko'rinadi va u yerda ko'zga tashlanadi.

## §1 — Hisob qatlami (`lib/rework.ts`, UI'dan OLDIN yozildi va sinaldi)

⚠️ **PER-DONA TUZOG'I** — `composition[].quantity_stems` BITTA dona uchun;
`quantity 2 × 25 = 50`. UI aynan spec eskizidagidek yozadi:
«25 dona/dona → jami 50 dona». Barcha hisob ×quantity qiladi.

⚠️ **PARTIYA BO'YICHA** tekshiruv: umumiy gul yetsa ham AYNAN bitta partiya
yetmasligi mumkin — `batchBalance()` har partiya uchun alohida mavjud/kerak
beradi va yetmaganini NOMLAYDI (test: «jami yetarli, bitta partiya yetmaydi»).

**Manba guli** itemning O'Z `composition`idan olinadi. Jonli tekshiruv: 26/26
katalogda `composition` bor (masalan id=210: partiya 207 × 25 + partiya 209 × 13
= 38 dona/dona). ⚠️ **Kutayotgan florist katalogi** (`quantity_stems: 0`) manba
sifatida bugun HECH QANDAY jonli yozuvda yo'q — ya'ni bu chekka holatni jonli
kuzatib bo'lmadi; nazariy jihatdan u 0 dona beradi va shu bois chiqim uchun
gul yetmaydi (LIST 2 xx).

## §4 — Verify

`tsc` toza · **592/592 Vitest** (50 tasi `rework.test.ts` — spec'ning IKKALA ishlangan
misoli uchdan-uchgacha, 11 tasi `enumLabel.test.ts`) · konsol xatosi yo'q ·
skrinshotlar dark + light: `rw-card-*`, `rw-history-*`, `rw-form-*`,
`rw-form-batches-*`, `rw-form-short-*`, `rw-form-ok-*`.

```
KARTOCHKA  : Jami 3 · Sotildi 1 · Restavratsiyada 1 · Qoldiq 1 ✓ «1 TA QOLDI» ✓
FORMA      : 2 manba ✓ 1 sklad kirimi (40 dona) ✓ 2 chiqim ✓
             «Jami kirim: 125 dona · 960 000 so'm» (buzilgan 85 + skladdan 40) ✓
             «25/dona = 50 dona» per-dona yorlig'i ✓
             «Jami chiqim: 95 dona» · «Yo'qotish: 30 dona» ✓
             florist haqi QO'LDA (tarif prefill'i YO'Q) ✓
YETMASLIK  : «Atirgul kust pushti guli yetmayapti: mavjud 20 dona, kerak 45 dona» ✓
             partiya jadvali: kust pushti 20/45 · 25 dona yetmaydi | prut oq 105/50 ✓
             Saqlash o'chiq + SABAB ko'rinadi (jimgina o'chmaydi) ✓
TO'G'RI    : jadval 105/95 + 20/0 ✓ «Bu amal qaytmaydi …» ✓ Saqlash yonadi ✓
TARIX      : hujjat ochildi ✓ buzilgan / skladdan / yangi ustunlari ✓
             allocated_cost 578 947 + haq 78 947 ✓ Yo'qotish 5 dona · 50 000 ✓
```

### ⚠️ Yo'l-yo'lakay topilgan nosozlik: partiya jadvali 2px chiziqqa siqilgan edi

Drawer tanasi `flex flex-col`; `overflow-hidden` bo'lgan bolaning avtomatik minimal
o'lchami 0 ga tushadi, shuning uchun jadval SIQILIB ketardi — sabab matni ko'rinsa ham
QAYSI partiya yetmayotgani ko'rinmasdi. `shrink-0` qo'shildi (skrinshotda tutildi,
DOM balandligi 2px → 97px).

## LIST 1 — RESTAVRATSIYA bloki (⚠️ HAMMASI IRREVERSIBLE)

⚠️ **BEKOR QILISH YO'Q** — OpenAPI'da `{id}/` faqat GET (yuqorida). Quyidagilarni
BAJARSANGIZ, ortga qaytarish yo'li YO'Q: buzilgan katalog tiklanmaydi, sklad qaytmaydi,
yasalgan kataloglarni faqat qo'lda o'chirish mumkin. Sinov uchun ARZON katalog tanlang.

RW1. **⚠️ QISMAN BUZISH (asosiy holat). IRREV.** `quantity_total: 3` bo'lgan katalogni
     toping (yoki yarating). Kartochkadagi ♻ → forma o'sha itemni manba qilib ochadi.
     Soni **1**. Skladdan 1 partiya, aniq dona qo'shing. Bitta chiqim: nom, narx,
     tarkib. Florist + haq. Saqlang. Keyin tekshiring:
     - kartochkada **«Restavratsiyada: 1»** va **«Qoldiq: 1»** (3 − 1 sotilgan − 1 buzilgan)
     - «N TA QOLDI» yorlig'i ham **1** ni ko'rsatadi (2 EMAS)
     - katalog **`available` holicha** qoladi
RW2. **Sklad FAQAT qo'shimchaga kamayadi. READ (RW1 dan keyin).** Sklad → o'sha partiya →
     harakatlar. **Faqat bitta** chiqim yozuvi bo'lsin — siz qo'shgan dona.
     Buzilgan katalogning guli uchun harakat **BO'LMASLIGI** kerak.
     Yozuvda «Restavratsiya» yorlig'i ko'rinsin (`reference_type: catalog_rework`).
RW3. **Yangi mahsulot QAYTA yechilmaydi. READ.** Yasalgan katalogni oching — «Sklad holati:
     To'liq yechilgan — qayta yechilmaydi». Agar biror joyda «Skladdan yechish» tugmasi
     ko'rinsa — bu NOSOZLIK, ayting (backend 400 qaytaradi).
RW4. **Florist oyligi. READ.** Hisob-kitob → oylik → manba filtri **«Restavratsiya»**.
     Yozuv summasi siz kiritgan haqqa TENG bo'lsin.
RW5. **⚠️ HAQSIZ RESTAVRATSIYA. IRREV.** Haqni **bo'sh** qoldirib saqlang → oylikda
     yangi yozuv **PAYDO BO'LMASLIGI** kerak (`florist_amount: 0`).
RW6. **Partiya yetishmovchiligi. READ (saqlamaysiz).** Chiqim tarkibida biror partiyadan
     mavjuddan KO'P so'rang → qizil jadval «mavjud / kerak» va Saqlash o'chadi, sabab
     ko'rinadi. **Saqlamang** — shu yerda to'xtang.
RW7. **Chiqim kirimdan ko'p. READ (saqlamaysiz).** Umumiy chiqimni kirimdan oshiring →
     «Yangi mahsulotlardagi gul soni kirimdan ko'p bo'lmasligi kerak».
RW8. **⚠️ HAMMASINI BUZISH. IRREV — eng oxirida.** `quantity_total` ning HAMMASINI buzing →
     katalog `archived` (avval sotilgan bo'lsa `sold`) bo'lishi va sotuvda
     KO'RINMASLIGI kerak.
RW9. **Tarix. READ.** Katalog → «Restavratsiya» tabi → hujjatni oching: buzilgan / skladdan /
     yangi ustunlari, `allocated_cost` va har mahsulotdagi haq ulushi, **Yo'qotish**
     ko'zga tashlansin. Florist filtri va tartiblar ishlasin.

## LIST 2 — append

ww. ⚠️ **Restavratsiya yo'qotishi chiqit hisobotiga KIRMAYDI (§0e).** `waste_stems`/
   `waste_cost` hujjat ichida qoladi, sklad chiqit harakati yaratilmaydi — demak
   Hisob-kitobdagi «Chiqit» bu zararni KO'RMAYDI. SETTLE: (1) backend restavratsiya
   yo'qotishini alohida jamida bersinmi (`accounting.rework_waste_cost`), yoki
   (2) frontend `/api/catalog-reworks/` ni o'zi yig'ib **alohida** qator chizsinmi?
   Sklad chiqitiga QO'SHILMASLIGI kerak — aks holda bir zarar ikki marta sanaladi.
xx. **Kutayotgan florist katalogi manba bo'la oladimi?** Chiqim yopilmagan katalogda
   `composition[].quantity_stems = 0` — ya'ni u restavratsiyaga 0 dona beradi. Backend
   uni manba sifatida QABUL QILADIMI (keyin «gul yetmayapti» beradi), yoki darhol
   rad etadimi? Bugun jonli bazada bunday item YO'Q, shuning uchun tekshirib bo'lmadi.
   Frontend hozir uni ro'yxatdan chiqarmaydi (qoldig'i bor bo'lsa ko'rinadi).
yy. **Eski `restore-flowers` qoladimi?** Spec «yangi ishlarda catalog-reworks ishlatilsin»
   deydi, lekin endpoint saqlangan. UI'da ikkalasi ham bor: yangisi «Restavratsiya»,
   eskisi «So'lgan gulni almashtirish» deb QAYTA NOMLANDI (ilgari ikkalasi ham
   «Restavratsiya» edi — chalkash). SETTLE: eskisi qachon o'chiriladi?

═══════════════════════════════════════════════════════════════════
# YETKAZIB BERUVCHI — SANA ORALIG'I (2026-08-05)
# READ-ONLY: GET + jonli OpenAPI.
═══════════════════════════════════════════════════════════════════

## Qaysi endpoint sanani QABUL QILADI (jonli tekshirilgan)

| endpoint | oraliq | maydon | qayerda filtrlanadi |
|---|---|---|---|
| `/api/suppliers/` | **YO'Q** | — | — (sarlavha jamilari) |
| `/api/stock-batches/` | bor | `created_at_after/_before` | ⚠️ **ISHLATILMAYDI** — pastga qarang |
| `/api/stock-movements/` | bor | `created_at_after/_before` | **SERVERDA** |
| `/api/stock-deliveries/` | yo'q | faqat aniq kun `received_at=` | — |
| `/api/supplier-payments/` | yo'q | faqat aniq kun `paid_at=` | **KLIENTDA** (`paid_at`) |

⚠️ **PARTIYADAGI TUZOQ.** Ekranda ko'rinadigan sana — `received_at` (yuk sarlavhasi,
partiya yangiligi), server esa faqat `created_at` (bazaga kiritilgan payt) bo'yicha
kesa oladi. Jonli ma'lumotda ular BOSHQA kun:

```
supplier 22 · received_at:  [('2026-08-02', 6), ('2026-08-04', 28)]
supplier 22 · created_at:   [('2026-08-04', 6), ('2026-08-05', 27)]   ← bir kun farq
```

Ya'ni «02.08 — 04.08» so'ralganda server'ga `created_at` yuborilsa 27 partiya
JIMGINA yo'qolardi. Shuning uchun partiyalar KLIENTDA `received_at` bo'yicha
saralanadi.

⚠️ `received_at_after` / `received_at_before` / `date_from` — server ularni
**TANIMAYDI va jimgina hammasini qaytaradi** (33 → 33, `?zzz_bogus=1` bilan bir xil).
Ular hech qachon yuborilmaydi.

## Sarlavha jamilari — DAVRGA ERGASHADI (klientda hisoblanadi)

`/api/suppliers/` da sana parametri YO'Q, shuning uchun oraliq tanlanganda
**to'rttala raqam ham ko'rinayotgan qatorlardan** hisoblanadi
(`supplierTotals`, `lib/supplierRange.ts`, Vitest bilan qulflangan):

| sarlavha raqami | qayerdan | hosil bo'ladimi |
|---|---|---|
| `batches_count` | filtrlangan partiyalar soni | ✓ |
| `total_received_stems` | Σ `received_stems` | ✓ |
| `purchase_total` | Σ `received_stems × cost_per_stem` | ✓ |
| `paid_total` | Σ to'lov `amount` | ✓ (jonli 0 ta to'lov — nolda tasdiqlangan) |

**Filtrsiz — SERVER raqamlari** (avtoritativ; ro'yxat 500 qatorda cheklangan, katta
yetkazib beruvchida klient yig'indisi kam chiqishi mumkin edi).

⚠️ **`cost_per_stem` ishlatiladi, `cost_per_stem_exact` EMAS.** Server `purchase_total` i
aynan YAXLITLANGAN maydon bilan mos tushdi — «aniqroq» maydon sarlavhani serverdan
jimgina ajratib yuborardi:

```
id 22 «Davron Aka» : server 18 525 000 · cost_per_stem 18 525 000 ✓ · exact 18 525 000
id 23 «Hojiakbar»  : server 13 278 000 · cost_per_stem 13 278 000 ✓ · exact 13 295 000 ✗ (+17 000)
id 24 «Mirzarahim» : server  4 550 000 · cost_per_stem  4 550 000 ✓ · exact  4 550 000
```

Tekin partiyalar alohida ajratilmaydi — `cost_per_stem` i allaqachon 0
(id 22 da 3 ta tekin partiya bor; «tekinsiz» va «hammasi» AYNAN bir xil chiqdi).

## Tenglik tekshiruvi — SARLAVHA == KO'RINGAN QATORLAR (jonli)

```
YETKAZIB BERUVCHI: Davron Aka (id 22)   ORALIQ: 2026-08-04 — 2026-08-04

SARLAVHA (filtrsiz = SERVER):  34 partiya · 8385 dona · 18 525 000 so'm · to'langan 0
SARLAVHA (oraliqda = KLIENT):  28 partiya · 8060 dona · 17 300 000 so'm · to'langan 0

EKRANDAGI YUK GURUHLARI:
   Yuk Davr stek 040800 · 2026-08-04     7 partiya ·  2100 dona
   Yuk Davronaka 040800 · 2026-08-04    20 partiya ·  3760 dona
   Yuk Mirzarahim 040800 · 2026-08-04    1 partiya ·  2200 dona
   JAMI                                 28 partiya ·  8060 dona   ← qatorlar yig'indisi

TENGLIK:  sarlavha 28 partiya == qatorlar 28  ✓
          sarlavha 8060 dona  == qatorlar 8060 ✓
```

Filtrsiz holatda klient yig'indisi server raqamiga ham teng (34 · 8385 · 18 525 000).

## Ko'rsatish qoidalari

- Sarlavha ustida DOIM davr yozilgan: filtrsiz «BUTUN DAVR» (kul rang),
  oraliqda «04.08.2026 — 04.08.2026» (aksent rang). Ikkalasi hech qachon aralashmaydi.
- Oraliqda ostiga qo'shimcha qator: «Tanlangan davr bo'yicha — quyidagi N partiya
  va M to'lov yig'indisi» — raqamlar SERVERDAN kelmagani ochiq aytiladi.
- Oraliq `?date_from=&date_to=` da, `?supplier=<id>` bilan birga — ulashilgan havola
  drawer'ni QAYTA OCHADI (busiz oraliq «saqlangandek» ko'rinib, aslida yo'qolardi).
- Bo'sh davr: «Bu davrda yozuv yo'q» + «Butun davrni ko'rsatish» tugmasi.

## Verify

`tsc` toza · **599/599 Vitest** (30 tasi `supplierRange.test.ts`) · konsol xatosi yo'q ·
skrinshotlar dark + light: `sup-full-*` (filtrsiz), `sup-range-*` (partiyalar),
`sup-range-moves-*`, `sup-range-pay-*`, `sup-empty-*`.

## LIST 2 — append

zz. **Sana bo'yicha kesiladigan yetkazib beruvchi endpointi.** Sarlavha jamilari hozir
   KLIENTDA hisoblanadi va ro'yxat 500 qatorda cheklangan (`list()` guard) — ya'ni
   500 dan ko'p partiyali yetkazib beruvchida oraliq jamilari KAM chiqadi. SETTLE:
   `/api/suppliers/{id}/?date_from=&date_to=` (yoki `/api/suppliers/{id}/summary/`)
   qo'shilsinmi? Qo'shilsa `purchase_total` AYNAN `Σ received_stems × cost_per_stem`
   (yaxlitlangan maydon) bo'yicha hisoblanishini tasdiqlang — biz shunga moslashtirdik.
aaa. **`received_at` bo'yicha oraliq filtri.** `/api/stock-batches/` da faqat `created_at_*`
   bor, ekranda esa `received_at` ko'rinadi va ular jonli ma'lumotda bir kun farq qiladi.
   SETTLE: `received_at_after`/`received_at_before` qo'shilsinmi? Hozir bu kalitlar
   qabul qilinadi-yu, JIMGINA e'tiborsiz qoldiriladi — bu eng xavfli holat.

═══════════════════════════════════════════════════════════════════
# NOSOZLIK: ARALASH TO'LOVNI SAQLAB BO'LMASDI (2026-08-05)
# READ-ONLY: brauzerda takrorlandi, POST/PATCH tutilib BEKOR qilindi.
═══════════════════════════════════════════════════════════════════

## §1 — Takrorlash va o'lchov (taxmin emas, jonli holat)

Sotish oynasi → «Aralash» → naqd 400 000 → karta 500 000 (jami 900 000):

```
─── ARALASH tanlandi ───
  xom kiritma   : naqd=''  karta=''
  tugma         : { ochiq: false, title: "Farq: 900 000 so'm kam" }

─── naqd 400000 yozildi ───
  xom kiritma   : naqd='400 000'  karta='500 000'   ← karta AVTOMATIK to'ldi
  parse qilingan: naqd=400000  karta=500000  yig'indi=900000
  tugma         : { ochiq: true }                   ← shu payt hammasi joyida

─── karta 500000 yozildi ───
  xom kiritma   : naqd='400 000'  karta='500 000 500 000'   ← QO'SHILIB KETDI
  parse qilingan: naqd=400000  karta=500000500000
  xabar         : "Farq: 500 000 000 000 so'm ortiq"
  tugma         : { ochiq: false }

CHIQQAN YOZISH SO'ROVLARI: (hech qanday — klientda bloklangan)
```

## §2 — Sabab: (d) HOLAT ULANISHI. (a) ham, (b) ham EMAS.

Operator naqdni yozganda karta maydoni **QOLDIQ bilan avtomatik to'ladi**. Keyin
operator o'sha maydonga o'z summasini yozadi — lekin maydon **BO'SH EMAS**, shuning
uchun yozilgani mavjud qiymatga **QO'SHILADI**:

```
"500 000" + "500000" → "500 000 500 000" = 500 000 500 000
```

Ya'ni avtomatik to'ldirish operator yozadigan AYNAN o'sha maydonga yozilgan, va uni
tanlab/tozalab qo'yadigan hech narsa yo'q edi.

**(a) formatlangan satrlar — SABAB EMAS.** `parseMoney` barcha raqamsiz belgilarni
tashlaydi, oddiy bo'shliq ham, uzilmas bo'shliq (NBSP) ham to'g'ri o'qiladi:

```
"150 000"          parseMoney -> 150000     | Number() bo'lsa -> NaN
"150 000" (NBSP)   parseMoney -> 150000     | Number() bo'lsa -> NaN
"1 500 000"        parseMoney -> 1500000    | Number() bo'lsa -> NaN
"abrakadabra"      parseMoney -> 0          | Number() bo'lsa -> NaN
```

Kod hech qayerda `Number()` ishlatmaydi — hamma joyda `parseMoney`.

**(b) dastafka qoidasining teskari bo'lishi — SABAB EMAS.** To'rttala joyda ham
taqqoslash summasi `calc.totalSum` (validatsiya, avto-qoldiq, «Jami ✓», farq xabari) —
dastafka HECH QAYERDA ustiga qo'shilmaydi. Matritsada dastafkali va dastafkasiz
qatorlar bir xil ishladi.

**(c) falsy tekshiruv — yo'q.** `mixedSellPayload` `=== null` bilan, `validateMixed`
`cash > 0 && card > 0` bilan solishtiradi.

**(e) eski xato — yo'q.** Xatolar har o'zgarishda tozalanadi. Lekin ko'rsatilgan xabar
(«Farq: … ortiq») ASL sababni tushuntirmaydi — operator uchun bu «summalarni kiritdim,
sotib bo'lmayapti» bo'lib ko'rinadi.

## §3 — Tuzatish

`focusMixedField` / `blurMixedField` (`lib/mixedPayment.ts`, sof funksiyalar):

- maydon HALI QO'LDA tegilmagan bo'lsa (ichidagi son — BIZNING taklifimiz), fokus
  olinganda **TOZALANADI** → yozilgan har narsa YANGI qiymat, qo'shilmaydi;
- hech narsa yozilmasdan fokusdan chiqilsa — taklif **QAYTADI**;
- QO'LDA tegilgan maydonga **HECH QACHON** tegilmaydi.

⚠️ `select()` bilan qilinmadi: sichqoncha bosilganda karetka `mouseup` da qayta
qo'yiladi va tanlov bekor bo'ladi — o'rtaga yozish yana buzardi.

Avtomatik qiymatli maydon ostida «avtomatik qoldiq» yozuvi chiqadi — raqam qayerdan
kelgani ko'rinib tursin.

## §3 — Boshqa pul maydonlari (tekshirildi)

`formatMoneyInput` butun ilovada FAQAT ikki joyda: aralash to'lovning ikki maydoni va
dastafka summasi. Dastafka **avtomatik to'ldirilmaydi**, shuning uchun unga qo'shilib
ketish holati yo'q. Qolgan hamma pul maydonlari (`sale_price`, rasxod summasi, partiya
narxlari, hajm tariflari, material narxi) `replace(/\D/g, "")` bilan faqat raqam saqlaydi
va ajratgich KO'RSATMAYDI — ya'ni na format, na avto-to'ldirish muammosi bor.
**Parser umumiy (`parseMoney`) va U SOG'LOM — nosozlik hech qachon o'qishda emas edi.**

## §3 — Brauzer matritsasi (POST TUTILDI, BEKOR QILINDI — backendga bormadi)

Naqd va Karta (8 + 8 holat) oldingi yurishda tasdiqlangan; quyida Aralash va Qarz:

```
 1 Aralash dast=yo'q cheg=yo'q n=1  naqd=450 000  karta=450 000  OCHIQ  POST /api/catalog/210/sell/
 2 Aralash dast=yo'q cheg=yo'q n=2  naqd=900 000  karta=900 000  OCHIQ  POST …
 3 Aralash dast=yo'q cheg=bor  n=1  naqd=400 000  karta=400 000  OCHIQ  POST …
 4 Aralash dast=yo'q cheg=bor  n=2  naqd=800 000  karta=800 000  OCHIQ  POST …
 5 Aralash dast=bor  cheg=yo'q n=1  naqd=450 000  karta=450 000  OCHIQ  POST …
 6 Aralash dast=bor  cheg=yo'q n=2  naqd=900 000  karta=900 000  OCHIQ  POST …
 7 Aralash dast=bor  cheg=bor  n=1  naqd=400 000  karta=400 000  OCHIQ  POST …
 8 Aralash dast=bor  cheg=bor  n=2  naqd=800 000  karta=800 000  OCHIQ  POST …
 9–16 Qarz  (dastafka × chegirma × dona)                          OCHIQ  POST …

JAMI 16 holat · OCHIQ 16 · bloklangan 0
KONSOL XATOLARI (abort'lardan tashqari): yo'q
```

⚠️ Hech bir POST **yuborilmadi** — harness ularni tutib, qayd etib, bekor qildi.
«OCHIQ + POST» = so'rov chiqishga tayyor edi, xolos.

⚠️ Chegirmali qatorlar chegirma SABABISIZ bloklanadi, qarz esa MIJOZSIZ bloklanadi —
bu TO'G'RI xatti-harakat (birinchi yurishda mening skriptim bu maydonlarni
to'ldirmagani uchun «bloklangan» chiqqan edi, ilova aybi emas).

## Verify

`tsc` toza · **617/617 Vitest** (69 tasi `mixedPayment.test.ts`) · konsol xatosi yo'q.

═══════════════════════════════════════════════════════════════════
# NOSOZLIK: MOBILDA YASHIL ✓ va QIZIL XATO BIR VAQTDA (2026-08-05)
# READ-ONLY: brauzerda 390×844 (iPhone Safari UA) takrorlandi.
# Serverning 400 javobi TAQLID qilindi — jonli API'ga hech narsa yuborilmadi.
═══════════════════════════════════════════════════════════════════

## §1 — «Native bubble» taxmini: MEXANIZM BOSHQA (tekshirildi)

Butun kod bazasida **constraint validation UMUMAN ishlatilmaydi**:

```
setCustomValidity / reportValidity / checkValidity / noValidate  → HECH QAYERDA YO'Q
<form> elementi                                                  → YO'Q
input[required]                                                  → YO'Q
```

Brauzerda ham tasdiqlandi (har bir input tekshirildi):

```
<form> bormi : false  ·  native validatsiya holati: []       ← validationMessage BO'SH
```

Aralash pul maydonlari allaqachon `type="text"` + `inputMode="numeric"`
(`type="number"` EMAS) — «75 000» dagi bo'shliq brauzer darajasida hech narsani
buzmaydi. Ya'ni **`setCustomValidity` sabab EMAS — u yo'q.**

⚠️ **Qora oynachaning HAQIQIY manbai — `title` atributi.** iOS Safari `title` ni
uzoq bosilganda qora native oynacha qilib ko'rsatadi va u brauzer xatosidan
farq qilmaydi. Sotish oqimida ikkita shunday joy bor edi:

| joy | `title` qiymati | holati |
|---|---|---|
| `KatalogSellModal` — «Sotish» tugmasi | `mixedV.message` (bloklash sababi) | **OLIB TASHLANDI** |
| `CustomerPicker` — o'chirilgan rejim chipi | `disabledReason` | **OLIB TASHLANDI** |

Ikkalasida ham matn ekranda ALLAQACHON oddiy matn sifatida ko'rinib turardi —
ya'ni `title` faqat takror va chalkashlik manbai edi. Tugmaga `aria-describedby`
qo'yildi (skrinrider uchun sabab bog'lanadi, qora oynacha chiqmaydi).

## §2 — HAQIQIY nosozlik: IKKI VALIDATOR, IKKI JAVOB

Yashil ✓ **hosila** qiymatdan (`mixedV`) chiqadi, qizil matn esa **saqlangan**
`errs` dan. Xabar matni kod bazasida YO'Q — chunki u **SERVERNING 400 javobi**:

```
{"cash_amount": "Aralash to'lovda naqd va karta summasini kiriting"}
```

`setErrs(e.fieldErrors)` uni saqlaydi, keyin esa uni FAQAT ikkita pul maydonining
`onChange` i tozalardi. Dona, chegirma, to'lov turi yoki dastafka o'zgarganda —
QOLIB KETARDI. Jonli takrorlash (390×844):

```
─── 3. «Sotish» bosildi → server 400 (TAQLID) ───
  naqd='75 000' karta='75 000'  |  Jami: "150 000 so'm"
  QIZIL xabar: ["Aralash to'lovda naqd va karta summasini kiriting", …]
  >>> ZIDDIYAT: BOR — yashil ✓ va qizil xabar BIR VAQTDA

─── 4. dastafka o'zgartirildi ───            (tuzatishdan OLDIN)
  >>> server xatosi tozalandimi? YO'Q — HALI HAM TURIBDI ✗
```

**Tuzatish — HOSILA yo'l tanlandi (saqlash EMAS):**

1. Aralash xatosi endi **umuman saqlanmaydi** — `submit()` dagi
   `next.cash_amount = mixedV.message` OLIB TASHLANDI. Yashil ✓ ham, qizil sabab
   ham AYNAN bitta `mixedV` dan chiqadi → **zid bo'lishi mumkin emas** (invariant
   Vitest bilan qulflangan: `ok=true ⇒ message===""`, `ok=false ⇒ message!==""`).
2. SERVER 400 maydonlari (ular saqlanishi SHART — server aytgan gap) endi
   tegishli kiritmalardan BIRORTASI o'zgarsa tozalanadi — yagona effektda:
   `[payment, mixed.cash, mixed.card, qty, discountOn, price, delivery, cust.mode]`.
3. Server xabari faqat holat YAROQLI bo'lganda ko'rsatiladi — aks holda o'zimizning
   sabab bilan ikkilanib ketardi.

Tuzatishdan keyin (jonli, o'sha qadamlar):

```
>>> 4-QADAM: server xatosi tozalandimi? HA ✓
>>> 5-QADAM: yaroqli holatda xato bormi? YO'Q ✓   (naqd 50 000 + karta 100 000)
>>> 5-QADAM: tugma ochiqmi? HA ✓
```

## §3 — Parse (tasdiqlandi)

`parseMoney` barcha raqamsiz belgilarni tashlaydi va SONLI solishtiriladi:

```
"75 000"            → 75000      | Number() bo'lsa → NaN
"75 000" (NBSP)     → 75000      | Number() bo'lsa → NaN
"75 000" (NNBSP)    → 75000      | Number() bo'lsa → NaN
"150000.00"         → 150000     (server decimal satri — nuqta saqlanadi)
"" / null / axlat   → 0          (NaN EMAS)
```

Ilova hech qayerda `Number()` yoki satr solishtiruvi ishlatmaydi.
`formatMoneyInput` (ajratgichli ko'rinish) butun ilovada FAQAT ikki joyda:
aralash to'lovning ikki maydoni va dastafka summasi — ikkalasi ham `parseMoney`
bilan o'qiladi. Qolgan pul maydonlari (`sale_price`, rasxod summasi, partiya
narxlari, hajm tariflari, material narxi) `replace(/\D/g, "")` bilan faqat raqam
saqlaydi va ajratgich KO'RSATMAYDI. **Parser umumiy va SOG'LOM.**

## §4 — Mobil tekshiruv

Viewport: **390×844, deviceScaleFactor 3, isMobile+hasTouch, iOS 17.5 Safari UA.**

Skrinshotlar (tuzatilgandan keyingi yaroqli holat, xatosiz va oynachasiz):
`mobile-valid-dark.png`, `mobile-valid-light.png` — «Jami 150 000 so'm ✓» yashil,
qizil matn YO'Q, qora oynacha YO'Q.

Matritsa (to'lov turi × dastafka × chegirma × dona), MOBIL kenglikda:

```
 1– 8  Aralash  (naqd/karta juftlari to'g'ri, qo'shilib ketish YO'Q)   OCHIQ  POST
 9–16  Qarz                                                            OCHIQ  POST
17–24  Naqd                                                            OCHIQ  POST
25–32  Karta                                                           OCHIQ  POST

JAMI 32 holat · OCHIQ 32 · bloklangan 0
POST chiqishga tayyor bo'lganlar: 32
ZIDDIYAT (yashil ✓ + qizil xato birga): 0
NATIVE QORA OYNACHA manbai (title/validationMessage): 0
KONSOL XATOLARI: yo'q
```

⚠️ Hech bir POST **yuborilmadi** — harness ularni tutib, qayd etib, bekor qildi.

`tsc` toza · **630/630 Vitest** (82 tasi `mixedPayment.test.ts`) · konsol xatosi yo'q.

═══════════════════════════════════════════════════════════════════
# ⚠️ ASL SABAB TOPILDI: SUMMALAR BRAUZERDAN CHIQMAGAN (2026-08-05)
# Manba: FRONTEND_CATALOG_MIXED_SALE_API.md · READ-ONLY (POST tutildi/bekor qilindi)
═══════════════════════════════════════════════════════════════════

Spec bo'yicha tekshirganda chiqayotgan so'rov tanasi o'lchandi. **Tana bo'sh edi:**

```
CHIQAYOTGAN POST TANASI (tuzatishdan OLDIN):
 {"payment_type":"mixed"}

  payment_type     -> "mixed"
  cash_amount      -> ❌ YO'Q
  card_amount      -> ❌ YO'Q
  delivery_amount  -> ❌ YO'Q
```

`api.sellCatalogItem` tanani **OQ RO'YXAT** bo'yicha qayta qurardi va ro'yxatda
bo'lmagan kalitlarni **JIMGINA tashlab yuborardi**. `git log -S` ko'rsatadi: bu metod
birinchi commit'dan (`bccd693`) beri **tegilmagan** — undan keyin qo'shilgan har bir
maydon chaqiruv joyida berilib, shu chegarada yo'qolgan:

| commit | qo'shilgan maydon | holati |
|---|---|---|
| `904b22b` qarzdorlar | `customer_name`, `customer_phone`, `debt_note` | **yo'qolardi** |
| `0d84faa` aralash | `cash_amount`, `card_amount` | **yo'qolardi** |
| `840341f`/`5eee296` dastafka | `delivery_amount` | **yo'qolardi** |

Ya'ni server haqli ravishda o'zining 400 ini qaytarardi —
«Aralash to'lovda naqd va karta summasini kiriting» — chunki summalar **haqiqatan
yo'q edi**. Formadagi yashil ✓ ham HAQ edi: u kiritilgan qiymatlarni to'g'ri
hisoblardi. Ikki tomon ham to'g'ri, o'rtadagi uzatish buzuq edi.

**⚠️ QARZ ham xuddi shunday buzilgan edi** — har bir qarz sotuvi
«Qarzga sotishda mijozni tanlang…» xatosi bilan tugashi kerak edi.

Tuzatishdan keyin (jonli o'lchov, 390×844):

```
ARALASH + DASTAFKA : {"payment_type":"mixed","cash_amount":"75000","card_amount":"75000","delivery_amount":"20000"}
QARZ + MIJOZ       : {"payment_type":"debt","delivery_amount":"20000","customer_name":"Aziz","customer_phone":"901112233","debt_note":"Juma kuni to'laydi"}
```

Tana endi `buildSellPayload` sof funksiyasida (`lib/api.ts`), 12 ta Vitest bilan
qulflangan — har bir hujjatlashtirilgan maydonning YETIB BORISHI tekshiriladi.

## §1 — Qoida (tasdiqlandi)

`cash_amount + card_amount == sale_price × quantity`, dastafka ICHIDA.
Taqqoslash summasi TO'RTTA joyda ham `calc.totalSum` (= `salePrice × qty`):

| joy | qiymat |
|---|---|
| `payTarget` (yagona hosila) | `calc.totalSum` |
| validatsiya — `validateMixed(mixed, payTarget)` | ✓ |
| avto-qoldiq — `applyMixedEdit(..., payTarget)` / `recalcOnTotalChange` | ✓ |
| «Jami ✓» ko'rsatkichi va farq xabari | ✓ (bitta `mixedV`) |
| payload — `mixedSellPayload(isMixed, mixed, payTarget)` | ✓ |

Hech qayerda dastafka QO'SHILMAYDI. Farq iborasi spec'ga moslandi:
**«✗ 50 000 kam» / «✗ 50 000 ortiq»** (ilgari «Farq: 50 000 so'm kam»).
Ikkalasi ham > 0 sharti — bloklash BILAN BIRGA sabab yoziladi:
«…bitta usul bo'lsa «Naqd» yoki «Karta»ni tanlang».

## §2 — Xato shakli: SATR ham, MASSIV ham

`extractFieldErrors` ikkalasini ham TO'G'RI o'qiydi (`flattenErrors` da satr sharti
massivdan OLDIN turadi), ya'ni `[object Object]` ham, harflarga bo'linish ham yo'q:

```
{"cash_amount": "…"}    -> {"cash_amount": "…"}     (spec shakli)
{"cash_amount": ["…"]}  -> {"cash_amount": "…"}     (DRF shakli)
{"cash_amount": "abc"}  -> kalitlar: ["cash_amount"]  ("0","1","2" EMAS)
```

`delivery_amount`, `customer` — xuddi shunday. `detail` esa maydon emas, umumiy
xabarga chiqadi. 9 ta Vitest (`lib/apiErrors.test.ts`).

## §3 — Maydonlar (jonli `CatalogSellRequest` bilan solishtirildi)

Server 17 maydon e'lon qiladi. Holat:

| maydon | avval | endi |
|---|---|---|
| `quantity`, `sale_price`, `discount_reason`, `payment_type`, `sold_at` | ✓ | ✓ |
| `reservation` — «Bronga bog'lash» | ✓ (UI bor va YUBORADI) | ✓ |
| `materials` — sotuvdagi qadoq | ✓ | ✓ |
| `decoration_florist` — oformleniya floristi | ✓ | ✓ |
| `customer` / `customer_name` / `customer_phone` / `debt_note` | UI bor, **YUBORILMASDI** | ✓ |
| `cash_amount` / `card_amount` | UI bor, **YUBORILMASDI** | ✓ |
| `delivery_amount` | UI bor, **YUBORILMASDI** | ✓ |
| `sale_image` / `sale_image_url` | **UI YO'Q EDI** | ✓ qo'shildi |

⚠️ `sale_price` — **BIR DONA** narxi. `salePrice = discountOn ? +price : listPrice`
va payload'ga `salePrice.toFixed(2)` ketadi; `qty` ALOHIDA maydon. Jami hech qachon
yuborilmaydi (spec 3-misoli test bilan qulflangan).

⚠️ `sale_image_url` — biz uni sotuvlar ro'yxatida KO'RSATARDIK, lekin hech qachon
YUBORMASDIK, ya'ni u hech qachon to'lmasdi. Endi «Sotuvda qo'shilgan» bo'limida
rasm yuklagich bor (Telegram guruhiga ketishi izohlangan).

## §4 — Qayerdan o'qiladi: IKKI MANBA YO'Q

```
GET /api/catalog-history/   -> 404   (OpenAPI'da UMUMAN yo'q)
GET /api/catalog/sales/     -> 200   (26 sotuv, `payment_breakdown` bor)
```

Spec `CatalogHistory.snapshot` va `/api/catalog-history/` ni ko'rsatadi — **bu
endpoint mavjud emas**. Ziddiyat xavfi YO'Q: biz yagona mavjud manbadan o'qiymiz.

⚠️ **`?payment_type=mixed` ISHLAMAYDI** (jonli):

```
?payment_type=cash        -> 5 ta    ✓
?payment_type=card        -> 21 ta   ✓
?payment_type=debt        -> 0 ta    ✓
?payment_type=mixed       -> 26 ta   ✗ (hammasi — filtr qo'llanmadi)
?payment_type=abrakadabra -> 26 ta     (aynan bir xil — ya'ni TANILMAYDI)
```

Spec «filtrlash ham mumkin» deydi — bugun EMAS. UI bu holatni ochiq aytadi.
`totals` da `mixed_count` BOR, lekin spec va'da qilgan `mixed_quantity` **YO'Q**.

## §5 — Avto-to'ldirish (saqlandi)

Spec'ning sodda varianti (`setCard(received − cash)`) o'rniga bizdagi kengaytma
kuchda qoladi va tasdiqlandi: qo'lda tegilgan maydon QAYTA YOZILMAYDI, manfiy
qoldiq 0 ga qisiladi, dona/narx o'zgarganda faqat tegilmagani qayta hisoblanadi,
taklif qilingan qiymat ustiga yozib ketmaslik uchun fokusda tozalanadi.

## Verify

Viewport **390×844, dSF 2–3, isMobile+hasTouch, iOS 17.5 Safari UA**.
Skrinshotlar: `mobile-valid-dark.png`, `mobile-valid-light.png` — 75 000 + 75 000,
dastafka 20 000 ICHIDA («tovar savdosi 130 000»), «Jami 150 000 so'm ✓» yashil,
qizil xato YO'Q, native qora oynacha YO'Q.

`tsc` toza · **651/651 Vitest** · konsol xatosi yo'q · hech qanday POST yuborilmadi.

## LIST 2 — append

bbb. **`/api/catalog-history/` mavjud emas (404).** Spec aralash to'lov ma'lumoti
   `CatalogHistory.snapshot` da (`payment_cash`/`payment_card`) deydi va shu
   endpointni ko'rsatadi. SETTLE: endpoint qo'shiladimi, yoki spec `/api/catalog/sales/`
   ga (`payment_breakdown`) yo'naltirilsinmi? Biz ikkinchisidan o'qiyapmiz.
ccc. **`?payment_type=mixed` jimgina e'tiborsiz qoladi.** cash/card/debt ishlaydi,
   `mixed` esa noma'lum qiymat kabi hammasini qaytaradi. Filtr «ishlagandek»
   ko'rinib, aslida ishlamayapti — eng xavfli shakl.
ddd. **`totals.mixed_quantity` yo'q.** Spec `mixed_count` bilan birga va'da qiladi;
   jonli javobda faqat `mixed_count` bor.

═══════════════════════════════════════════════════════════════════
# AI KATALOG ALBOMI + OPERATOR ALOQASI (2026-08-07)
# Spec: FRONTEND_AI_ALBUM_AND_OPERATOR_API.md · READ-ONLY (GET + OpenAPI)
═══════════════════════════════════════════════════════════════════

## §2 audit — chat bugun nima qiladi

`sender: "system"` + media yo'q → `sideOf()` «center» beradi, keyin:

```
if (!m.text.trim()) return null;   // app/chat/page.tsx
```

⚠️ Ya'ni albom xabari **bo'sh qator ham emas — UMUMAN chizilmaydi** (bug hisobotidagidan
biroz battarroq). Operator mijoz nima ko'rganini bilmaydi.

`image_tool_result` esa `parseMedia()` (MessageMedia.tsx) ichida, `attachments[]` dan
keyingi ikkinchi manba sifatida o'qiladi va bitta rasm pufagi bo'lib chiqadi.
**Unga TEGILMADI** — albom butunlay alohida yo'lda (`parseAlbum`), chunki u galereya,
u esa bitta rasm; bitta uslubga tiqishtirish ikkalasini ham buzardi.

## §2 — ⚠️ JONLI MA'LUMOT SPEC BILAN MOS EMAS: `image_url` YO'Q

Haqiqiy albom topildi — **suhbat 274, xabar 2715**:

```
sender='system'  text=''
yuqori daraja : album_max_per_message · items · messages_sent · not_sent · numbering_visible · ok · sent_as
ok=True · sent_as='album' · messages_sent=4 · album_max_per_message=10 · numbering_visible=True
items: 38 · positions 1…38 · delivered=false: 0
ITEM kalitlari: catalog_id · delivered · detail · name · position · price · type
                                    ↑ image_url HECH BIR itemda YO'Q
not_sent: [] (bo'sh)
```

Spec «`items[].image_url` shu uchun qaytariladi» deydi — **backend uni yubormayapti**.
Shu bois galereya rasmni SHART qilmaydi: plitka raqam + nom + narx + tur bilan quriladi,
`image_url` kelsa (spec bo'yicha kelishi kerak) rasm ham chiziladi. Katalog rasmini
`catalog_id` orqali TORTIB OLMADIK — u mijozga ketgan rasm emas, keyin o'zgargan
bo'lishi mumkin; soxta dalil ko'rsatgandan ko'ra rasmsiz halol plitka yaxshiroq.

⚠️ `not_sent` bo'sh bo'lgani uchun uning HAQIQIY shakli KO'RINMADI — parser satr ham,
`{name/title/catalog_id}` + `{reason/error/detail/message}` obyekti ham qabul qiladi.
⚠️ `delivered:false` ham jonli ma'lumotda YO'Q — u variant MOCK bilan tekshirildi.

## §2 — Qanday chizildi

- Sarlavha: «Katalog albomi yuborildi — 38 ta mahsulot, 4 ta xabar» + `sent_as` chipi
- Plitkalar `position` bo'yicha; **raqam eng yirik element** (`tabular-nums`, plitkaning
  chap yuqorisida, `--primary` fonda) — 38 da ham bir qarashda o'qiladi
- Har plitka `catalog_id` bo'lsa `/katalog?item=<id>` ga havola
- `delivered:false` → xira (opacity .45) + «yetmadi» belgisi
- `ok:false` → galereya YO'Q, faqat «⚠ Katalog rasmlari yuborilmadi» + sabablari
- `not_sent` bo'sh emas → nechtaligi va sabablari yoziladi
- To'r: mobil 3, sm 5, lg 7 ustun — 38 plitka ham buzilmaydi
- Ostida: «Mijoz shu raqamlarni ko'rgan — «1chisi qancha» degani shu ro'yxatdagi 1-raqam»

## §1 — Sozlamalar: «Operator aloqasi»

Uchala maydon JONLI mavjud va spec defaultlari bilan:

```
operator_phone    -> "+998 88 009 33 30"
operator_hours    -> "08:00 dan 00:00 gacha"
operator_hours_ru -> "с 08:00 до 00:00"
shop_phone        -> "+998 88 009 33 30"        ← operator_phone bilan AYNAN BIR XIL
working_hours     -> {"uz": "24/7, kunu tun ochiq", "ru": "24/7, круглосуточно", …}
```

⚠️ **`shop_phone` va `operator_phone` hozir bir xil qiymatda** — «takror» bo'lib
ko'rinadi va kimdir birlashtirib yuborishi mumkin. Lekin `working_hours` («24/7»)
va `operator_hours` («08:00–00:00») JONLI ma'lumotda ochiq FARQ qiladi: do'kon
tunu kun ochiq, administrator esa 08:00–00:00 da javob beradi. Blok ostida shu
ochiq yozilgan.

⚠️ **`shop_phone` / `working_hours` bugun HECH QAYERDA tahrirlanmaydi** — butun
frontendda ular faqat `lib/types.ts` va `lib/demo.ts` da uchraydi, UI yo'q. Ya'ni
chalkashadigan MAVJUD blok yo'q; yangi blok o'zi tushunarli bo'lishi kerak edi va
shunday qilindi (sarlavha + izoh + «Do'kon ish vaqtidan alohida» ta'kidi).

**Bo'sh maydon qoidasi:** «bo'sh → yubormaslik» EMAS, «**o'zgarmagan → yubormaslik**».
Tegilmagan maydon PATCH'ga umuman tushmaydi (server defaulti saqlanadi). Operator
ATAYLAB tozalasa — bu ongli tanlov va `""` yuboriladi; aks holda Saqlash bosilardi-yu
hech nima o'zgarmasdi. `can_control` yo'q bo'lsa maydonlar FAQAT O'QISH (GET ochiq).

## §3 — Verify

`tsc` toza · **672/672 Vitest** (21 tasi `lib/aiAlbum.test.ts`) · konsol xatosi yo'q.
Skrinshotlar — JONLI metadata bilan (suhbat 274), **1440 va 390 · dark va light**:
`album-settings-*`, `album-live-*` (38 raqamli plitka), `album-undelivered-*`,
`album-fail-*`.

⚠️ `delivered:false` va `ok:false` variantlari JONLI ma'lumotda YO'Q (hammasi
`delivered:true`, `ok:true`, `not_sent: []`) — ular jonli metadatadan **MOCK
qilib olingan**: item'lar va matnlar haqiqiy, faqat shu uch bayroq o'zgartirilgan.
Qolgan hamma skrinshot — o'zgartirilmagan jonli javob.

Mobil (390px): 3 ustunli to'r, raqamlar 1…38 o'qiladi, `delivered:false` plitka
xira + «yetmadi» belgisi, sarlavhada «3 ta yetmadi» chipi.

## LIST 1 — append

OP1. **⚠️ OPERATOR SOATINI O'ZGARTIRISH (arzon va foydali tekshiruv).** Sozlamalar →
     «Operator aloqasi» → «Navbatchilik» ni erkin matnga o'zgartiring, masalan
     `har kuni 09:00 - 23:00`. Saqlang. Keyin **haqiqiy suhbatda** (Instagram/Telegram)
     AI'dan operatorga ulashni so'rang — javobida AYNAN yangi matn chiqishi kerak.
     Shu bilan uch narsa tasdiqlanadi: PATCH ketdi, erkin matn buzilmadi, AI bazadan
     o'qiyapti. **REV** — eski qiymatni qaytarib qo'ysangiz bo'ldi.
OP2. **Ruxsatsiz foydalanuvchi. READ.** `settings` da `can_control` YO'Q hisob bilan
     kiring — uchala maydon faqat o'qish uchun ko'rinsin, Saqlash tugmasi BO'LMASIN.
OP3. **Albom galereyasi. READ.** Katalog so'ralgan suhbatni oching — raqamlangan
     plitkalar ko'rinsin. Mijoz «1chisi qancha» desa, 1-plitka nomi va narxi
     javobingizga mos kelishini tekshiring.

## LIST 2 — append

eee. ⚠️ **`catalog_album_result.items[].image_url` YUBORILMAYAPTI.** Spec uni
   hujjatlashtiradi va «mijozga ketgan aynan o'sha manzil» deydi, lekin jonli javobda
   (suhbat 274, 38 ta item) u YO'Q. Galereya rasmsiz ishlaydi, lekin operator mijoz
   ko'rgan RASMNI ko'rmaydi — bu xususiyatning yarmi. SETTLE: qo'shiladimi?
fff. **`not_sent` elementining shakli noma'lum** — jonli ma'lumotda doim `[]`.
   Parser satr ham, obyekt ham qabul qiladi, lekin haqiqiy shakl tasdiqlanmagan.
   SETTLE: element `{catalog_id, name, reason}` bo'ladimi?
ggg. **`shop_phone` va `operator_phone` bir xil qiymatda.** Ikkalasi ATAYLAB alohida
   (spec), lekin bugun qiymatlari bir xil va `shop_phone` frontendda tahrirlanmaydi.
   SETTLE: `shop_phone` uchun ham UI kerakmi, yoki u faqat AI uchunmi?

═══════════════════════════════════════════════════════════════════
# QO'LDA OFORMLENIYA HAQI (FRONTEND_FLORIST_DECORATION_SALARY_API.md, 2026-08-07)
# READ-ONLY: GET + OpenAPI. Har bir yozish ATAYIN sinalmagan.
═══════════════════════════════════════════════════════════════════

## §5 — ⚠️ ISH DAVOMIDA DEPLOY BO'LDI

Birinchi tekshiruv (148 yo'l) va ikkinchisi (149 yo'l) ORASIDA backend chiqdi:

| | 1-tekshiruv | 2-tekshiruv |
|---|---|---|
| `POST /api/florists/{id}/decoration/` | ❌ YO'Q | ✅ BOR |
| salary enum'da `extra_decoration` | ❌ YO'Q | ✅ BOR |
| `FloristSalaryEntry.quantity/unit_amount` | ❌ YO'Q | ✅ BOR |
| `decoration_fee` florist modelida | ✅ BOR | ✅ BOR |
| `PATCH /api/florist-salary/{id}/` | ✅ BOR | ✅ BOR |
| `summary.decoration_salary_total` | ✅ BOR | ✅ BOR |

Ya'ni **hammasi endi TEKSHIRILGAN**, kontrakt-only qism qolmadi.

```
FloristDecorationSalary (request)  maydonlar: count · note · unit_amount · work_date
                                   required : ['count']
javoblar (OpenAPI)                 : ['200']      ← ⚠️ 201 E'LON QILINMAGAN (LIST 2)
```

**Jonli yozuvlar bor** (florist 7 «Isroil», `decoration_fee = 5000.00`):

```
id=250  2026-08-07  qty=3   unit=5000.00  amount=15000.00
id=173  2026-08-05  qty=28  unit=5000.00  amount=140000.00
id=134  2026-08-04  qty=52  unit=5000.00  amount=260000.00
```

Boshqa manbalarda `quantity=0, unit_amount=0.00` — spec §6 AYNAN shunday deydi, ya'ni
qatordagi «hisobni ko'rsatish» sharti bitta bo'lishi mumkin (`hasArithmetic`).

## §0a — `decoration_fee` UI'da ALLAQACHON BOR → TAKRORLANMADI

`components/FloristModal.tsx:84` — florist yaratish/tahrirlash formasida input bor
(`PATCH /api/florists/{id}/` ham o'sha yerda). Shu bois yangi blokka **ikkinchi input
QO'YILMADI**: blok narxni KO'RSATADI va «O'zgartirish» tugmasi o'sha yagona formani
ochadi. Ikki input bo'lsa ikki joyda ikki xil qiymat ko'rinib qolardi.

⚠️ Yo'l-yo'lakay: florist detalida «Hajm tariflari» ichida FAQAT O'QISH uchun
«Oformleniya haqi» chizig'i bor edi — u endi ortiqcha, olib tashlandi va o'rniga
to'liq blok o'z bo'limiga chiqdi (bitta nomdagi ikkita joy qolmadi).

## §0b — yangi manba AVTOMATIK qo'llab-quvvatlandi ✓

`rework` paytida qilingan tuzatish AYNAN ishladi:
`SalaryLedger.tsx:16` filtr variantlarini `Object.keys(SALARY_SOURCE_LABEL)` dan
quradi, yorliq esa `salarySourceLabel()` orqali (noma'lum qiymat uchun ogohlantirish +
o'qiladigan zaxira). Ya'ni `lib/inventory.ts` ga BITTA qator qo'shish yetdi — filtr,
yorliq va legenda o'zi keldi. **Hech qayerda qattiq yozilgan manba ro'yxati YO'Q.**
(`lib/exports.ts` dagi `source === "catalog"` — boshqa maqsad: katalog turini sanash,
manba ro'yxati emas.)

Jonli tasdiq (skrinshot): florist 7 ning «Manba bo'yicha» chizmasida
«Qo'shimcha of… 415 000 so'm · 3» qatori O'ZI paydo bo'ldi.

## §0c — VERDIKT: biz yig'MAYMIZ, serverdan olamiz ✓

`FloristStats.tsx` va `app/floristlar/[id]/page.tsx` `stats.by_source` va
`stats.summary.*` ni TO'G'RIDAN-TO'G'RI chizadi; manbalarni klientda qo'shadigan
joy YO'Q. Jonli arifmetika buni tasdiqlaydi:

```
extra_decoration  415 000
decoration        165 000
sale_decoration    30 000
                  ───────
decoration_salary_total = 610 000   ✓ (server o'zi yig'gan)
```

Ya'ni ikki marta sanash xavfi yo'q — tegilmadi.

## §4 — «bu florist — MEN» qanday aniqlanadi

`FloristProfile.user` — `User` jadvalining kaliti (jonli: florist 7 → user 11,
florist 4 → user 8). `/api/me/` esa o'sha `User` ning `id` sini beradi. Demak
`florist.user === me.id` (`isOwnProfile`). Shu holatda qo'shish formasi UMUMAN
chizilmaydi — doim 403 beradigan tugma ko'rsatilmaydi.

## §2 — 200 va 201 farqi

`api.requestWithStatus` qo'shildi: `request` ning O'ZIDAN holat kodini oladi
(ikkinchi so'rov YUBORILMAYDI — u yozuvni ikki marta yaratardi). Keyin:

```
200 → «Bugungi qatorga qo'shildi: 5 ta · 25 000 so'm»
201 → «Yangi qator qo'shildi: 2 ta · 14 000 so'm»
```

Ikki marta bosishdan `busy` qo'riqlaydi; muvaffaqiyatdan keyin `loadStats()` chaqiriladi.

## §3 — tahrir: UCH XULQ, IKKI REJIM

⚠️ Server qoidasi: `amount` yuborilsa u USTUN turadi va ko'paytirish BEKOR bo'ladi.
Shu bois forma uchta erkin maydon EMAS, ikkita REJIM: «Soni / narxi» yoki
«Summani qo'lda». `buildSalaryEditPayload` `amount` ni HECH QACHON `quantity`/
`unit_amount` bilan birga chiqarmaydi va O'ZGARMAGAN qiymatni yubormaydi —
aks holda operator sonini o'zgartirsa-yu, eski `amount` ham ketib, hisob jimgina
muzlab qolardi. Bu Vitest bilan qulflangan (uchala kombinatsiya + invariant).

## Verify

`tsc` toza · **706/706 Vitest** (34 tasi `lib/decoration.test.ts`) · konsol xatosi yo'q.
Skrinshotlar (dark + light, jonli ma'lumot bilan):
`deco-calc-*` (3 × 5 000 = 15 000), `deco-blocked-*` (narx yo'q — tugma o'chiq va
sabab yozilgan), `deco-rows-*` (`?source=extra_decoration`, qatorda «3 × 5 000»),
`deco-edit-*` (ikki rejim + jonli hisob).

## LIST 1 — OFORMLENIYA bloki (⚠️ ISH HAQIGA TA'SIR QILADI)

OF1. **Narxni belgilash. REV.** Florist detali → «Oformleniya haqi» → «O'zgartirish» →
     `decoration_fee` ni 5 000 qiling. ✅ Blokdagi narx yangilansin.
OF2. **⚠️ 3 ta qo'shish. IRREV-ish (o'chirish mumkin, lekin ish haqi o'zgaradi).**
     «Nechta qildi» = 3 → hisob «3 × 5 000 = 15 000» ko'rinsin → Qo'shish.
     ✅ Toast: «**Yangi qator** qo'shildi: 3 ta · 15 000 so'm».
OF3. **⚠️ SHU KUNI yana 2 ta — BIRLASHISHI SHART.** Yana 2 ta qo'shing (narx o'sha).
     ✅ Toast: «**Bugungi qatorga qo'shildi**: 5 ta · 25 000 so'm».
     ✅ Ro'yxatda YANGI qator PAYDO BO'LMASIN — o'sha qator «5 × 5 000 = 25 000» bo'lsin.
     Bu — butun xatti-harakatning MAG'ZI: qator 3 da qolsa xato, 2 ta alohida
     qator chiqsa ham xato.
OF4. **⚠️ BOSHQA narx — ALOHIDA qator.** «Boshqa narx» = 7 000, «Nechta» = 2 → Qo'shish.
     ✅ Toast «**Yangi qator** qo'shildi: 2 ta · 14 000 so'm» va ro'yxatda IKKI qator:
     `5 × 5 000 = 25 000` va `2 × 7 000 = 14 000`.
OF5. **Narx yo'q holati. READ.** `decoration_fee` = 0 bo'lgan floristni oching —
     Qo'shish O'CHIQ va «Avval oformleniya narxini kiriting» yozilgan bo'lsin.
     «Boshqa narx» kiritilsa tugma YONSIN.
OF6. **Tahrir — soni. REV.** Qatorni tuzating: «Soni / narxi» rejimida sonni 5 → 6
     qiling. ✅ Summa 30 000 ga O'ZI o'zgarsin.
OF7. **Tahrir — qo'lda summa. REV.** «Summani qo'lda» rejimiga o'ting, 20 000 yozing.
     ✅ Summa 20 000 bo'lsin, `quantity` O'ZGARMASIN (ko'paytirish bekor).
OF8. **⚠️ O'ZINGIZGA yozib bo'lmasligi. READ.** Florist hisobi bilan kirib o'z
     profilingizni oching — qo'shish formasi UMUMAN ko'rinmasin (server 403 beradi).

## LIST 2 — append

hhh. **`POST /api/florists/{id}/decoration/` OpenAPI'da faqat `200` e'lon qilingan**,
   holbuki spec `201` (yangi qator) va `200` (birlashdi) ni ajratadi va butun UX
   shunga qurilgan. Kod haqiqiy kodni o'qiydi, lekin sxema chalg'ituvchi.
   SETTLE: `201` javobi sxemaga qo'shilsinmi?
