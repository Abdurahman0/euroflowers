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
5.  CHIQARISH: Floristlarga chiqarilgan → Florist + Partiya (skladdan) + 30 dona → Chiqarish.
    ✅ Sklad partiyasi −30; balansda +30; sklad jurnalida «Floristga chiqarildi» chipi.
6.  KATALOG (florist qo'lidan): Katalog → +Katalog → shu florist + Hajm (salary «Tarifdan
    olindi» bilan to'ladi) + gul BALANSDAN («mavjud: N dona») + narx → Qo'shish.
    ✅ Florist balansi kamaydi; SKLAD qoldig'i O'ZGARMADI.
    ✅ Salaryни qo'lda o'zgartiring → tarif bosib o'tmaydi; «Tarifdan qayta olish» → qayta oladi.
7.  BALANSSIZ FLORIST: gul chiqarilmagan floristni tanlang → «Bu floristga hali gul
    chiqarilmagan» + «Floristga gul chiqarish» yorlig'i. ✅ Yorliq to'g'ri floristga olib boradi.
8.  QAYTARISH: Floristlarga chiqarilgan → balans qatori → Qaytarish → 10 dona. ✅ Balans −10;
    SKLAD partiyasi +10 tiklandi (OCHIQ SAVOL a).
9.  CHIQIT: balans → Chiqit → 2 dona → tasdiq → Ha. ✅ Balans −2; SKLAD partiyasi O'ZGARMADI;
    «Florist qo'lidagi chiqit» bloki (Hisob-kitob + Sklad jurnal xulosasi) 2 dona ko'rsatadi;
    sklad «Chiqit» JAMIGA qo'shilmagan (OCHIQ SAVOL b).
10. TAHRIRLASH: 6-qadamdagi katalogni tahrirlang, gul sonini balansdan OSHIRING → Saqlash.
    ✅ Server 400 beradimi (balansga qayta tekshiradimi)? (OCHIQ SAVOL c). Bizning inline
    ogohlantirish oldindan ko'rsatadi.
11. O'CHIRISH: shu katalogni o'chiring → tasdiqda «gullar floristning qo'liga qaytadi» yozuvi.
    ✅ Gullar SKLADGA emas, FLORIST balansiga qaytdi.
12. MIJOZ: Katalog → item → Sotish → Mavjud/Yangi mijoz → soting. ✅ Mijoz chipi kartada/detalda.
13. YUBORISH: Katalog → asosiy item → «Filialga yuborish» → Filial + Soni (maks = sotilmagan) +
    narx (bo'sh = asl) → «5 tadan 2 tasi ketadi, 3 qoladi» + ustama ko'rinadi → yuboring.
    ✅ «Qaytarib bo'lmaydi» ogohlantirishi ko'rinadi; asosiy filialda soni kamaydi; agar
    ko'p so'rasangiz «Yuborish uchun atigi N dona bor» 400 chiqadi.
14. FILIAL HISOBOTI: Filial hisoboti → davr tanlang. ✅ Har filial qatori (yuborilgan/sotilgan/
    ustama), «ustama vs asl» stacked bar, «Yuborilganlar tarixi» (target — oddiy matn, link EMAS),
    Excel eksport. Bo'sh davr → chiroyli empty state.
15. XODIM FILIALI: Xodimlar → yangi/tahrir → «Filial» select. ✅ Parkent tanlab saqlang →
    o'sha user faqat Dashboard·Hisob·Katalog ko'radi. Mavjud Parkent userni tahrirlab filialга
    TEGMASDAN saqlang → filiali O'ZGARMAYDI (asosiyга ko'chib ketmaydi).
16. (Parkent akkaunt bo'lsa) Parkent user: menyu faqat 3 ta; /sklad'ga URL → Dashboard'ga
    yo'naltiriladi; +Katalog tugmasi YO'Q; item'da «asl narx» muted; chegirma bilan sotuvda
    discount_reason MAJBURIY.

═══════════════════════════════════════════════════════════════════
# CONSOLIDATED HANDOVER — LIST 2: OPEN QUESTIONS FOR BACKEND
═══════════════════════════════════════════════════════════════════
a. FLORIST RETURN → warehouse restore: does `return` write a warehouse IN StockMovement, and
   with what `reference_type`? (Frontend has a defensive `florist_return` label.) SETTLE:
   run checklist #8, watch the sklad journal for a new entry.
b. FLORIST WASTE → warehouse totals: does florist `waste` write a warehouse `waste`
   StockMovement? If YES, our separate block must NOT be summed (already isn't); if NO, our
   separate block is the only place the loss shows. Either way we're correct, but you need to
   KNOW so loss numbers are trusted. SETTLE: run #9, check whether sklad «Chiqit» total moves.
c. PATCH re-validation: does `PATCH /catalog/{id}/` re-validate composition against the
   florist's balance? UI is conservative (client-side re-check + warns server may reject).
   SETTLE: run #10 with an over-balance edit.
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
