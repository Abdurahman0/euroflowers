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

## BACKEND REQUEST (ready to forward)

**REQ-1 — daily catalog-sales series.** `/api/analytics/` `daily_stats[]` `revenue`/`orders` track **lead-pipeline** (won-lead `estimated_price`), not catalog sales — so the daily revenue chart has no real backend source and we derive it client-side from `accounting.history[]`. Please add a **per-day catalog-sales series** (e.g. `daily_stats[].catalog_revenue` + `catalog_orders`, bucketed by `sold_at` in Asia/Tashkent, gap-filled to the range) so revenue/AOV charts have an authoritative source. Also: `top_catalog_items` and `revenue_by_source` are won-lead based and read **empty despite real catalog sales** (BUG-2) — please base them on catalog sales (or add catalog-sales variants). Nice-to-have: make `sold_at` writable on `/catalog/{id}/sell/` so historical data can be seeded/imported.

## NEXT (after your review)
Phase 2 (page-by-page field checks), Phase 4 (cross-page consistency — starting from BUG-1), Phase 5 (order-flow/edge/exports/empty-state/themes), Phase 6 (fixes + `ZZZ_TEST_` cleanup in reverse order + baseline restore). I'll fix BUG-1/3/4 (frontend) and forward BUG-1(backend)/BUG-2 as backend requests.
