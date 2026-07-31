# REPORTING_AUDIT.md — Dashboard / Analitika / Hisob-kitob

**Date:** 2026-07-29 · verified against live API `https://euroflowers.api.cognilabs.org`
**Scope:** audit of the three reporting pages before restructuring. This is Phase 1 — no feature code written yet.

> Live dataset is small (1 catalog item sold, 1 sale, **0 suppliers**), so some lists are near-empty, but every item **shape** below is confirmed from real populated records or `OPTIONS`.

---

## 0. Executive summary

- **Dashboard is `app/page.tsx`**, not `app/dashboard/page.tsx` (the latter is just `redirect("/")`).
- The three pages **heavily overlap**: NetProfitCard, DiscountStatsCard, FloristProductionCards, BatchSarfiPanel, DailyChart, top-selling-flowers and the revenue KPI each appear on **two** pages. Net profit / discounts appear on **all three**.
- **5 of the 6 owner questions are answerable today** (some by backend directly, some by client computation from existing endpoints). **The one true blocker is supplier payments (Q1, paid-vs-outstanding).**
- Two things the owner wants are already in responses but **thrown away**: per-sale `cost_total` + `net_profit` (accounting `history[]`), and full sold-item `composition[]` with batch linkage (catalog `history[].snapshot`). Rendering these unlocks Section 2 and part of Section 3 with **no new backend work**.

**The single most important gap to forward to backend:** supplier payment/debt tracking (see Part C, GAP-1).

---

## PART A — INVENTORY (what's on each page today)

Legend — **Status:** REAL = renders live data · COND = renders only if an optional field is present (defensive gate) · DUP = same metric/block also on another page · DEAD = fetched but never rendered.

### A1. DASHBOARD (`app/page.tsx`)
Primary source: `api.dashboard({from,to,date_from,date_to})` → `GET /api/dashboard/` (auto-refresh). BatchSarfiPanel additionally calls `api.stockBatches()` → `GET /api/stock-batches/`.

| # | Widget (UZ label) | Shows | Fields | Status |
|---|---|---|---|---|
| 1 | KPI tiles ×6 | Bugungi/7-kunlik savdo, faol buyurtmalar, AI suhbatlar, katalogda sotuvda, skladda gul | `revenue_today, revenue_7d, orders_today, active_leads, new_leads_today, conversion_rate, ai_conversations, operator_conversations, available_catalog, pending_deductions, stock_stems, low_stock` | REAL (revenue DUP) |
| 2 | Sof foyda (NetProfitCard) | net profit + katalog daromadi/tannarx/chegirma | `net_profit, catalog_revenue, catalog_cost, catalog_discount` | REAL·COND·**DUP** |
| 3 | Chegirmalar (DiscountStatsCard) | discount total + count + qty | `discounted_catalog_sales_count, discounted_catalog_quantity, discounted_catalog_amount` | REAL·COND·**DUP** |
| 4 | Florist ishlab chiqarish | per-florist prod bars + jami oylik | `florist_production_stats[]{florist_id,name,standard/custom_bouquets,standard/custom_baskets,salary_total}, florist_salary_total` | REAL·COND·**DUP** |
| 5 | Partiya sarfi (BatchSarfiPanel) | per-batch usage bars | `batch_inventory_stats[]{batch_id,flower,variant,color,batch_number,supplier_name,standard_catalog_stems,custom_catalog_stems,waste_stems,total_out_stems}` JOIN `stock-batches` | REAL·**DUP** |
| 6 | Kunlik dinamika (DailyChart) | leads+conversations line | `daily_stats[]{date,leads,conversations}` | REAL·COND·**DUP** |
| 7 | So'nggi buyurtmalar | 5 recent leads | `recent_leads[]` | REAL (unique) |
| 8 | Buyurtmalar oqimi | pipeline bars | `lead_pipeline[]{status,count}` | REAL·**DUP** (donut on Analitika) |
| 9 | Eng ko'p sotilgan gullar | top-5 flowers | `top_selling_flowers[]{name_uz,color_uz,stems,bunches}` | REAL·**DUP** |
| 10 | Sklad holati | 4 chips | `stock_stems, low_stock, available_catalog, pending_deductions` | REAL·**DUP of tile #1 (same page!)** |

**Dashboard DEAD fields (fetched, unrendered):** `period, period_revenue, period_orders, period_leads, period_customers, period_conversations, florist_revenue, flowers_sold_stems, unread_notifications, recent_notifications`.

### A2. ANALITIKA (`app/analitika/page.tsx`)
Sources: `api.analytics(...)` → `GET /api/analytics/`; `api.leadStatuses()` → `GET /api/lead-statuses/`; Excel button → `api.accounting(...)` → `GET /api/accounting/`. `s = a.summary`.

| # | Widget | Shows | Fields | Status |
|---|---|---|---|---|
| 1 | Excel export | downloads accounting-by-day | `api.accounting` | action (**DUP source** of Hisob-kitob) |
| 2 | Xulosa tiles ×6 | daromad, so'rovlar, suhbatlar, yangi mijozlar, florist daromadi, sotilgan gul | `summary.{revenue,orders,leads,conversion_rate,conversations,customers,florist_revenue,flowers_sold_stems}` | REAL (revenue DUP) |
| 3 | Sof foyda (NetProfitCard) | — | `summary.{net_profit,catalog_revenue,catalog_cost,catalog_discount}` | REAL·COND·**DUP** |
| 4 | Chegirmalar | — | `summary.discounted_*` (fallback top-level) | REAL·COND·**DUP** |
| 5 | Florist ishlab chiqarish | — | `florist_production_stats[]`, `summary.florist_salary_total` | REAL·COND·**DUP** |
| 6 | Partiya sarfi | — | `batch_inventory_stats[]` + `stock-batches` | REAL·**DUP** |
| 7 | Kunlik faollik (DailyChart) | leads/conv/orders | `daily_stats[]{...,orders}` | REAL·**DUP** |
| 8 | Kunlik daromad (RevenueBars) | daily revenue | `daily_stats[]{date,revenue}` | REAL (unique chart) |
| 9 | Eng ko'p sotilgan gullar | full list | `top_selling_flowers[]` | REAL·**DUP** |
| 10 | Top katalog gullari | by qty+revenue | `top_catalog_items[]{catalog_item__name_uz,__arrangement_type,quantity,revenue}` | REAL (unique) |
| 11 | So'nggi kunlar hiti | recent hits | `recent_top_catalog_items[]` | REAL·COND (unique) |
| 12 | Buyurtmalar holati (Donut) | status distribution | `lead_statuses[]{status,count}` + colors | REAL·**DUP** (bars on Dashboard) |
| 13 | Buyurtma turlari | arrangement mix | `arrangement_types[]{arrangement_type,count}` | REAL (unique) |
| 14 | Suhbat manbalari | channel share | `conversation_sources[]{source,count}` | REAL (unique) |
| 15 | Manbalar bo'yicha daromad | revenue by source | `revenue_by_source[]{source,revenue,orders}` | REAL (unique) |

**Analitika DEAD fields:** top-level `net_profit, catalog_revenue, catalog_cost, catalog_discount, florist_salary_total` (only `summary.*` read); `TopCatalogItem.catalog_item_id`.

### A3. HISOB-KITOB (`app/hisob-kitob/page.tsx`)
Perm-gated (`canView("dashboard")`). Source: `api.accounting({date_from,date_to})` → `GET /api/accounting/` (**`date_to` INCLUSIVE here** — opposite of Dashboard/Analitika, which send end+1). `s = data.summary`.

| # | Widget | Shows | Fields | Status |
|---|---|---|---|---|
| 1 | Excel export | uses cached data | — | action |
| 2 | KPI tiles ×5 | umumiy savdo, naqd, karta, sof foyda, umumiy chegirma | `summary.{total_sales,total_quantity,cash_total,card_total,net_profit,cost_total,discount_total,discounted_sales_count}` | REAL (sof foyda/chegirma/savdo **DUP**) |
| 3 | Turi bo'yicha | per-kind cards | `by_kind[]{catalog_kind,sales,quantity,discount}` | REAL (unique) |
| 4 | To'lov bo'yicha | cash/card bars | `by_payment[]{payment_type,label,sales,quantity}` | REAL (unique) |
| 5 | Hajm bo'yicha | HBars | `by_volume[]{catalog_kind,volume,sales,quantity,discount}` | REAL·COND (unique) |
| 6 | Sotuvlar tarixi / Chegirmalar (tabs) | 7-col ledger | `history[]`, `discounted_sales[]` (AccountingSale) | REAL (unique) |

**Hisob-kitob DEAD fields (fetched, unrendered) — several are gold for the rebuild:** `summary.{unknown_total,standard_quantity,custom_quantity,discounted_quantity}`; per-row `AccountingSale.{catalog_id, arrangement_type, created_at, florist_id, listed_unit_price, sold_unit_price, listed_total, cost_total, net_profit}`.

### A4. Duplicate network calls
- `GET /api/stock-batches/` fetched **twice** (BatchSarfiPanel on Dashboard **and** Analitika).
- `GET /api/accounting/` fetched by Hisob-kitob (render) **and** Analitika (export) — same endpoint.

---

## PART B — DATA AVAILABILITY (can the API answer the owner's 6 questions?)

Verdict key: **BACKEND** = returned directly · **CLIENT** = compute from existing endpoints · **BLOCKED** = needs new backend field/endpoint.

### Endpoint fields that matter (confirmed live)
- **`/api/stock-batches/`** → `cost_per_stem, received_stems, remaining_stems, sale_price_per_stem, stems_per_bunch, supplier(FK), variant(FK), variant_detail, supplier_detail, batch_number, received_at, stock_value`. No profit/consumed fields.
- **`/api/catalog/{id}/`** → `price, florist_fee, calculated_cost_price, calculated_component_price, discount_amount, quantity_total, quantity_sold, status, catalog_kind, volume, arrangement_type, florist(FK)`, **`composition[]{stock_batch, batch_detail(→cost_per_stem, supplier, variant_detail), quantity_stems, quantity_bunches}`**, `materials[]`, `history[]{action, snapshot{composition[], materials[], florist_fee, payment_type, ...}}`.
- **`/api/accounting/`** → `summary{total_sales, cost_total, net_profit, discount_total, cash_total, card_total, standard/custom_quantity, discounted_*}`, `by_kind[]`, `by_payment[]`, `by_volume[]`, **`history[]/discounted_sales[]` (AccountingSale) with per-row `sale_total, cost_total, net_profit, listed_total, discount_amount, discount_percent, florist_id, florist_name, catalog_id, catalog_name, arrangement_type, volume, payment_type, sold_at`**.
- **`/api/suppliers/`** → `id, name, phone, notes, is_active, batches_count, total_received_stems`. **No money fields at all.**
- **`/api/stock-movements/?movement_type=waste`** → `quantity_stems (negative), batch(FK), batch_detail(→cost_per_stem), reason, created_at`. **No cost/value field.**
- **`/api/florists/`** → `salary_total, catalog_count, daily_pay, volume_rates[], staff_type, user_detail`. Plus dashboard/analytics **`florist_production_stats[]{standard/custom_bouquets, standard/custom_baskets, catalog_total, salary_total, florist_id}`**.

### The six questions

| Q | Question | Verdict | How |
|---|---|---|---|
| **1** | Suppliers: purchase total + **paid vs outstanding** | Purchase: **CLIENT** · Paid/debt: **BLOCKED** | Purchase = Σ `received_stems × cost_per_stem` from `stock-batches` grouped by `supplier`. Paid/outstanding has **no field anywhere** and `/supplier-payments/` = 404. → **GAP-1**. |
| **2** | Per supplier: revenue realized + margin | **CLIENT** | Join catalog `composition[].stock_batch → batch_detail.supplier`; allocate each sale's `sale_total` across its composition lines by cost or stems; margin = allocated revenue − allocated cost. Attribution documented in tooltip. *Caveat: all current batches have `supplier=None`, so it only lights up once suppliers are assigned.* |
| **3** | Per catalog item **and** per flower variant: net profit | Item: **BACKEND** · Variant: **CLIENT** | Item: accounting `history[]` already has `sale_total, cost_total, net_profit, discount_amount` per sale. Variant: no endpoint — compute from `composition[]` lines (`batch_detail.variant_detail`, `quantity_stems × cost_per_stem`), allocate sale revenue/discount proportionally. |
| **4** | Period cost breakdown (flowers/materials/salaries/waste/discounts) | **CLIENT** | `discount_total` + `florist_salary_total` come straight from backend. But accounting `cost_total` is **one combined number** (not split flowers vs materials), and **waste is not valued**. Split flowers/materials from composition & materials cost lines; waste from Q6. |
| **5** | Per florist: production + salary | **BACKEND** | `/api/florists/` (`salary_total, catalog_count, volume_rates, daily_pay`) + `florist_production_stats[]` (counts by kind/arrangement). |
| **6** | Waste valued at `cost_per_stem` | **CLIENT** | `/stock-movements/?movement_type=waste` → `abs(quantity_stems) × batch_detail.cost_per_stem`. No server value field. |

**Bottom line:** Q3(item) and Q5 are backend-native. Q1(purchase), Q2, Q3(variant), Q4, Q6 are client-computable from existing endpoints. **Only Q1(paid/outstanding) is truly blocked.**

---

## PART C — GAP LIST (exact backend requests to forward)

### GAP-1 — Supplier payments / debt *(blocks Q1 — highest priority)*
The owner's #1 question ("qancha berishim kerak / berdim") cannot be answered. The supplier object has no money field and there is no payments resource.

**Requested backend work (pick one of two shapes):**
1. **Payments resource (preferred):** `GET/POST /api/supplier-payments/` with `{id, supplier(FK), amount(decimal string), paid_at(date), method(cash|card|transfer), note}`; and on the supplier object add read-only rollups `purchase_total`, `paid_total`, `outstanding` (= purchase_total − paid_total). This gives a real ledger + running balance.
2. **Minimal:** on the supplier object add `purchase_total` (Σ received_stems×cost_per_stem, server-side) and a writable `paid_total`; frontend derives `outstanding`.

*Until this ships: Hisob-kitob Section 1 will show the computed **purchase total** and mark To'langan/Qarz as "backend qo'llab-quvvatlamaydi" with a visible note.*

### GAP-2 — (nice-to-have) Split `cost_total` into flower vs material *(eases Q4)*
Accounting `cost_total` and catalog `calculated_cost_price` bundle flower + material + florist fee into one figure. A per-sale `{flower_cost, material_cost, florist_fee_cost}` split would remove a client re-derivation and be authoritative. **Workaround exists** (recompute from composition/materials), so this is optional, not blocking.

### GAP-3 — (nice-to-have) Valued waste *(eases Q6)*
A `cost_value` on waste stock-movements (or a `waste_cost_total` in accounting summary) would make waste loss authoritative. **Workaround exists** (client valuation), so optional.

---

## PART D — RECONCILIATION (hand-check vs live API)

Sold catalog item **"mm"** (`catalog_id=49`), sale `history_id=25`, `quantity=1`:

```
listed_unit_price   1 600 000
sold_unit_price     1 500 000   → discount_amount = 1 600 000 − 1 500 000 = 100 000  (6.25%)  ✓ matches server
sale_total          1 500 000
cost_total            885 000   = flower cost 875 000  (25 stems × 35 000 cost_per_stem)
                                + florist_fee 10 000
                                + materials 0
net_profit            615 000   = 1 500 000 − 885 000                                 ✓ matches server net_profit
```
Cross-check: catalog `calculated_cost_price = 4 425 000` for `quantity_total = 5` → `4 425 000 / 5 = 885 000` per unit = accounting `cost_total`. ✓ All three sources agree.

**Rule adopted for `lib/finance.ts`:** where the server gives an authoritative figure (`net_profit`, `cost_total`, `discount_amount`, `calculated_cost_price`), **use it**; only the flower-vs-material-vs-fee *split* and *waste valuation* are client-derived. If a client recomputation disagrees with the server total, show the **server** value and `console.warn` the delta (never contradict silently).

---

## PART E — PROPOSED DISPOSITION (preview of Phase 2 — for your approval)

| Current block | New home |
|---|---|
| KPI revenue tiles, lead pipeline, recent leads, AI suhbatlar, stock alerts (low/8-day/deliveries) | **Dashboard** (keep; add new/returning-customer, source split, top-5 customers) |
| NetProfitCard, DiscountStatsCard | **Hisob-kitob** KPIs (remove from Dashboard) |
| DailyChart, RevenueBars, top flowers, top catalog, arrangement mix, channel revenue, waste-trend (new) | **Analitika** (add period-over-period deltas) |
| BatchSarfiPanel | **Analitika** (single copy; drop the Dashboard duplicate) |
| Accounting ledger, by_kind/by_payment/by_volume | **Hisob-kitob** |
| Supplier payables, per-product profit, per-variant profit, cost breakdown, florist detail | **Hisob-kitob** Sections 1–5 (new, using the dormant fields above) |

---

## Part G — GAPS CLOSED + client math removed (backend integration, 2026-07-30)

Backend shipped `0082_supplier_payment` + `0083`. All three gaps **CLOSED** and verified live:

**GAP-1 — Supplier payments → CLOSED (2026-07-30).** `/api/supplier-payments/` full CRUD live; suppliers now return `purchase_total`/`paid_total`/`outstanding`/`last_payment_at`. Section 1 rebuilt: server rollups (client purchase-total computation **removed**), QARZ column color-coded, default sort `-outstanding`, payment drawer (Naqd/Karta/O'tkazma), expandable payments ledger with edit/delete + running balance (uses `supplier_detail`/`created_by_detail` from the response — no per-row fetch; all payments loaded once and grouped). Outstanding chip also on the Suppliers page. **Reconciled live:** supplier "Gul Import" + batch 40 (150×35 000) + payments 500 000 cash + 200 000 transfer → `purchase_total 5 250 000`, `paid_total 700 000`, `outstanding 4 550 000`, `last_payment_at 2026-07-30` — all exact.

**GAP-2 — cost split → CLOSED.** `accounting.summary.{flower_cost_total,material_cost_total,florist_fee_cost_total}` + per-`history[]` `{flower_cost,material_cost,florist_fee_cost}`. **Removed client `unitCostSplit()`** (and its test); Section 4 + Section 2 expand now use server fields. Backend guarantees `flower+material+fee === cost_total` (verified: 875 000+0+10 000=885 000) — client correction/`diverged` dot dropped.

**GAP-3 — waste valuation → CLOSED.** Movements now carry `cost_value`/`sale_value`. **Removed client `wasteValue()`** (cost_per_stem math); added `wasteTotals()` that SUMS the server `cost_value`/`sale_value` over guard-filtered movements. Section 4 waste line now shows cost loss **and** `sale_value` ("daromadda … yo'qoldi" — from the bonus `sale_value` field). Analitika waste trend switched to server `cost_value` too.

**lib/finance.ts** — KEPT (still client): `allocateByCost`/`saleLineAllocations` (per-supplier & per-variant cost-share attribution), `reconcile` (server-wins + dev mismatch dot on `net_profit`), `saleProfit`, `profitTone`, `num`, `isTestRecord`/`excludeTest` guard. **DELETED:** `unitCostSplit`, `wasteValue` (+ their tests). **ADDED tests:** `wasteTotals`, updated `costBreakdown` (server-field signature). 17 tests green.

**Florist stats (NEW).** `GET /florists/{id}/stats/` + `/florists/me/dashboard/` → one shared `components/FloristStats.tsx` (summary cards incl. `sale_revenue` = real post-discount price, `by_day` chart reversed, `by_volume`/`by_arrangement`/`by_source` tables, `salary_entries` table handling empty catalog fields, attendance). Opened from a clickable Floristlar card (admin detail); same component ready for the florist self-dashboard. **Hisob-kitob Section 5** left on the backend `florist_production_stats` aggregate (authoritative; per-florist stats endpoint would be N calls for the all-florists overview) — the rich per-florist view lives on Floristlar.

**Server Excel export (NEW).** Floristlar salary export **switched** from client SheetJS → `GET /api/exports/florist/` (own) & `/api/exports/florists/` (all), and the florist detail drawer downloads `/api/exports/florist/?florist=<id>&date_from&date_to` (6-sheet, Content-Disposition filename). **Kept client-side** (no server endpoint): Hisob-kitob suppliers / catalog-profit / variants / cost-breakdown sheets + the "Barchasi" workbook, and `exportAccountingByDay`.

**AI pricing note.** Lead drawer (`LeadModal`) now shows `florist_fee` as its own line under `estimated_price`, both with an info tooltip explaining the customer only saw the flower total in chat.

**⚠️ Spec-vs-live discrepancy (delete PROTECT).** The spec said deleting a supplier with payments returns an **error** (`on_delete=PROTECT`). Live it does **not** error — it returns **204 and silently soft-deactivates** (`is_active=false`; the row persists), while a supplier with **no** payments hard-deletes (404). So the promised friendly error never fires from the backend. **Mitigation:** the Suppliers page now **guards client-side** — if `paid_total>0` (or `last_payment_at`), it blocks the delete and shows "Bu yetkazib beruvchida to'lovlar bor — avval to'lovlarni o'chiring", so the owner can't accidentally lose a supplier with payment history. Worth telling backend the PROTECT error isn't actually raised.

## Part D-2 — RECONCILIATION of the new Hisob-kitob sections (live, 2026-07-30)

All three hand-checked against live API responses; `lib/finance.ts` produces the same, and the page shows the server value (no divergence dot).

**Catalog item — "mm" (`catalog_id=49`, sale `history_id=25`, qty 1):**
```
composition: 1 line, batch №177 (Gortenziya Kolumbia), 25 stems × cost_per_stem 35 000 = 875 000  (flower)
florist_fee 10 000 ; materials 0
client cost split = 875 000 + 0 + 10 000 = 885 000  == server cost_total 885 000   ✓
net = sale_total 1 500 000 − 885 000 = 615 000       == server net_profit 615 000    ✓  margin 41%
```

**Flower variant — Gortenziya Kolumbia (variant 28, batch 40):**
```
purchased  = received 150 × 35 000 = 5 250 000
sold       = 25 stems (mm sale) ; revenue allocated (single line) = 1 500 000
cost       = 25 × 35 000 = 875 000
profit     = 1 500 000 − 875 000 = 625 000   margin 42%   (page: 625 000 / 42% ✓)
```
*Note:* per-variant profit = allocated revenue − that variant's flower cost; it **excludes florist fee** (fee is not attributable to a single flower), which is why this reads 625 000 vs the catalog **net** 615 000 (the 10 000 fee). Documented in the section tooltip.

**Supplier — temporarily assigned "ZZZ_TEST Yetkazuvchi" (id 14) to batch 40, then reverted:**
```
after PATCH: catalog49 composition batch_detail.supplier = 14  (this is what saleLineAllocations reads)
Xarid summasi = 150 × 35 000 = 5 250 000
Tushum (cost-share allocation) = 1 500 000 ; cost of sold = 875 000
Foyda = 625 000 ; Marja 41.7% ; Chiqit(batch40) = 0
reverted: batch40.supplier → None ; supplier 14 DELETED (204)   ✓ clean
```

## Part F — TEST-DATA CLEANUP & GUARD (2026-07-30)

Swept all entities for leftover test records. **Hard-deleted:** 2 customers (`ZZZ_TEST Mijoz` #57, `ZZZ_TEST` #58 — DELETE 204→404), 2 orphan salary entries (#5 "Mix", #6 "MIXX" — referenced already-deleted catalogs; DELETE 204), and the reconciliation temp supplier (#14). **Cannot hard-delete (backend limitation):** 14 `ZZZ_TEST_*` stock-batches (DELETE = **soft-only**, `is_active=false`; already inactive) and **49 stock-movements** incl. all 5 waste rows (DELETE → **HTTP 405, immutable ledger**).

**Invisible-pollution confirmed (owner's point 1):** the backend `batch_inventory_stats` **includes soft-deleted batches** — 12 of 17 entries were `ZZZ_TEST_*`, contributing **all 145 waste_stems**. And the waste query (`/stock-movements/?movement_type=waste`) has no `is_active` filter, so all 5 test-waste rows returned. Two of them even had reasons `"ZZZ bunch"`/`"ZZZ stems"` (no `ZZZ_TEST_` prefix) — so the guard filters by **`batch_number` / `catalog_name`, not by reason**.

**Guard shipped** (`lib/finance.ts` `isTestRecord`/`excludeTest`, 3 new tests): report aggregations exclude `ZZZ_TEST_`-prefixed records **by default**, with a **dev-only "Test yozuvlar" toggle** on Hisob-kitob to re-include. Applied to Hisob-kitob (sales/batches/waste), Analitika (waste trend), and baked into `BatchSarfiPanel`.

**HONEST BASELINE — last 30 days (after cleanup+guard), live-verified:**
```
Umumiy savdo   1 500 000     (1 real sale — "mm")
Sof foyda        615 000     (server net_profit)
Tannarx (COGS)   885 000  =  gullar 875 000 + materiallar 0 + florist haqi 10 000
Chegirmalar      100 000
Chiqit           0 so'm / 0 dona   ← was 145 dona / 1 450 000 (100% test)
Chiqit foizi     0.0%              ← was 15.4%
```
*Ambiguous, NOT deleted (not `ZZZ_TEST_`-tagged, awaiting owner call):* the sole sale **"mm"** (2-char name, discount "doimiy mijoz") and its salary entry #7 look test-like; if they're also test, the real baseline is **zero activity**.

## Addendum (2026-07-30) — "Yangi vs qaytgan mijoz" definition
Verified live: a lead's `customer_detail` exposes `leads_count` (all-time) and `created_at`, but **not** `purchases_count`; `/api/customers/` exposes `purchases_count` only as an **all-time** count (no per-date breakdown), and there is **no per-customer order/purchase-history endpoint** (`/customers/{id}/orders|purchases/` → 404). So a strict "had ≥1 **purchase** before this period" cannot be computed.
**Chosen definition (Dashboard):** *returning* = the customer's all-time `leads_count` exceeds their lead count **within the selected period** (i.e. they had a prior request). This correctly classifies "registered long ago but ordering for the first time this period" as **new** (their only lead is in-period), which the earlier `created_at < from` heuristic got wrong. It is interaction-based (leads), not purchase-based; surfaced via a tooltip on the card. Residual edge case: for a custom range entirely in the past, leads created *after* the range would also make `leads_count > periodCount` — acceptable for the "today/recent" operational dashboard, noted here. *(If backend later adds per-customer purchase history with dates, switch to purchase-based.)*

## Open decisions for you
1. **GAP-1**: forward the supplier-payments backend request now? Section 1 ships either way (purchase total + "Qarz: backend kerak" note) but paid/outstanding stays dark until it lands.
2. **Q2 attribution basis**: allocate a sale's revenue across its flower lines by **cost share** (default, recommended) or by **stem share**? (Affects per-supplier & per-variant revenue split; I'll tooltip whichever you pick.)
3. **Testing**: no test runner exists — I'll add **Vitest** solely for `lib/finance.ts` (profit math). OK?

*No feature code has been written. Awaiting your go-ahead on Phase 2 + the three decisions above.*

## BRANCH / FLORIST-STOCK REPORTING IMPACT (2026-07-31) — see VERIFICATION_REPORT.md for full detail
- **Stock leaves the warehouse at ISSUE time now** (florist flow): a `florist_issue` OUT
  StockMovement is written when gul is issued to a florist; florist-based catalog creation
  makes NO second warehouse movement. **No frontend double-count** (each stem departs once).
  `florist_issue` is labeled "Floristga chiqarildi"; it is lumped into the sklad journal's
  movement_type="out" ("Ishlab chiqarishga") bucket — correct as a departure, imprecise as a label.
- **Florist-hand waste is SHOWN, not SUMMED** into warehouse chiqit (Hisob-kitob waste section +
  sklad journal summary), noted "Sklad chiqiti bilan qo'shilmagan". Open question: does the
  backend also write a warehouse waste movement for it? (LIST 2, item b.)
- **Partial branch transfer → attribution hole (flagged, not patched):** transferred items'
  stems were consumed from the main warehouse but sold under Parkent's separate accounting
  scope, so they vanish from main's variant/supplier sale attribution; the Parkent markup lives
  in the branch report, not main COGS. (VERIFICATION_REPORT §3; LIST 2, item f.)
- **Money stays server-authoritative** everywhere (net_profit/cost_total); client only does
  attribution (saleLineAllocations) and separate not-summed loss displays.
