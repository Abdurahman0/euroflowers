# EuroFlowers API — Full Audit & Wiring Report

**Source of truth:** live OpenAPI 3.0.3 schema pulled from
`https://euroflowers.api.cognilabs.org/api/schema/?format=json`
(Swagger UI at `/api/docs/`; DRF Spectacular, JWT `Authorization: Bearer <access>`).
**Scale:** 84 paths across 34 domains. **Pagination:** every list is
`{count, next, previous, results}` with `page`, `page_size`, `search`, `ordering`.
Our `list()` helper unwraps `.results` and walks `next` (page_size 100, max 5 pages) — ✅ correct.

Legend: ✅ used · ⚠️ partially used (fields/filters/actions we ignore) · ❌ unused · ⛔ not applicable to the operator CRM (mini-app / server webhook).

---

## ⭐ Backend re-verification — round 2 (production, 2026-07-27)

The backend team fixed the reported issues. Re-verified live; verdicts:

1. **Duplicate composition/materials — NOW MERGED by the backend.** Raw payload
   `composition:[(30,5),(30,7)]` → response `[(30,12)]`; `materials:[(1,1),(1,2)]`
   → `[(1,3)]`. The earlier "load-bearing" warning is **withdrawn**. We keep
   client `normalizeComposition`/`normalizeMaterials` anyway (cleaner payloads +
   the in-builder merge is good UX) — they're now belt-and-suspenders, not required.
2. **`received_stems` is now OPTIONAL; backend computes it.** Batch create with
   only `received_bunches:"8"` (spb 25) → `received_stems=200`, `remaining_stems=200`,
   `remaining_bunches:"8.00"`. (Was HTTP 500 before.) **Client adapted:**
   `StockBatchModal` bunch-mode now sends `received_bunches` only and drops the
   client `remaining_stems`; the server math matches our preview ("Jami kirim: 200 dona").
3. **Insufficient-stock error is now a plain STRING** (`{"detail": "…\n…"}`), no
   longer `{"detail":[…],"composition":[…]}`. Labels unchanged (Gul/Partiya/Kerak/
   Bor/Yetmayapti). Our renderer already handles **string | string[]** via
   `Array.isArray` — verified against the new shape (screenshot).
4. **Dashboard/Analytics §8 fields are returned with data** (field names match
   what we wired last round). Dashboard top-level: `net_profit, catalog_revenue,
   catalog_cost, catalog_discount, florist_salary_total, batch_inventory_stats[],
   florist_production_stats[]`. Analytics: money in `summary.*`, the two lists
   top-level. `date_from`/`date_to` **now documented in the schema** and change the
   numbers (Jul-2026 range → net_profit −135 000, 8 batch stats; Jan-2025 → 0/0).
   §8 blocks render live (screenshots). Note: `date_to` still exclusive-of-day →
   we send `end+1` via `dateBeforeParam` (already in place).
   `batch_inventory_stats[]` item = `{batch_id, batch_number, supplier_id,
   supplier_name, flower, variant, color, standard_catalog_stems,
   custom_catalog_stems, waste_stems, total_out_stems}`;
   `florist_production_stats[]` item = `{florist_id, name, staff_type,
   standard_bouquets, standard_baskets, custom_bouquets, custom_baskets,
   catalog_total, salary_total}`.
5. **`GET /api/mini-app/leads/?init_data=…` now EXISTS** (Telegram mini-app;
   signed `init_data`, ⛔ not called from the operator CRM). Response schema
   `MiniAppOrders = { customer: Customer, orders: [] }`. POST body `MiniAppLead =
   {init_data, arrangement_type(bouquet|basket|catalog), items[], packaging,
   request_text, name, phone, note}`. `MiniAppLine = {stock_batch, catalog_item,
   quantity_stems, quantity}`. To be wired in the mini-app project, not this repo.

**Other spec changes since round 1 (adapted where relevant):**
- Catalog `quantity_total` scales `calculated_component_price`/`calculated_cost_price`
  AND the auto salary entry (qty 2 → salary = fee×2 = 100 000). Our preview already
  multiplies by qty — re-verified exact (component 2 000 000, cost 1 120 000,
  discount 700 000 == server).
- New read-only fields: `StockBatch.remaining_bunches` (decimal string) +
  `remaining_bunches_label`; `FloristProfile.volume_rates`; `Packaging.quantity_label`
  / `packaging_type_label` / `image`; `FloristSalaryEntry.reason`. Added the
  StockBatch ones to `lib/types.ts` (used for dual-unit display); others are
  additive/optional and don't affect our client.
- Enums unchanged (`packaging_type` still `wrap|basket|box|other`, etc.).

---

## ⭐ Round 3 — CRM 5-task pass (production, 2026-07-28)

- **Branch removal:** `branch` is `null` on ALL florists/volume-rates, `required=false`
  on write, no `/api/branches/` endpoint, create-without-branch → 201. Removed
  cleanly from florist types + UI (no client-side hiding needed). Ask backend to
  drop the field entirely if unused.
- **Catalog `note`:** exists and round-trips, BUT `?search=` does **not** cover it
  (note-only token → 0 hits). → not server-searchable (report to backend if wanted).
- **Catalog florist filter:** no `?florist=` param → filtered **client-side**.
- **Exports:** `/exports/florist/` **404s for non-florist users** ("Florist profile
  topilmadi"). Switched all exports to **client-side SheetJS** (`lib/exports.ts`)
  for exact columns + per-day/payment aggregation (backend `/accounting/` has
  `by_payment` cash/card + per-sale `history`, but **no per-day breakdown** — we
  aggregate client-side).
- **Material movements:** `/material-movements/` filters by `packaging` (id),
  `movement_type`, dates — **no `packaging_type` filter** → material-type filtered
  client-side. `quantity` is a plain int (no stems/bunches).

## a) Full endpoint inventory + b) Coverage matrix

### Inventory domain (focus of this integration)

| Endpoint | Methods | Purpose | Coverage | Notes |
|---|---|---|---|---|
| `/api/suppliers/` | GET·POST·GET{id}·PATCH·PUT·DELETE | Yetkazib beruvchilar | ✅ | filters `is_active, search, ordering`. Read fields `batches_count, total_received_stems` — we show `batches_count`; ⚠️ `total_received_stems` not surfaced. |
| `/api/stock-batches/` | CRUD + `{id}/movement/` | Gul partiyalari | ✅ | filters `variant, supplier, is_active, height_cm, height_from_cm, height_to_cm, search`. ⚠️ we expose only `search` on Partiyalar (supplier/height filters unused). |
| `/api/stock-movements/` | GET·GET{id} | Harakatlar (read-only) | ✅ | filters `batch, supplier, movement_type, created_at_after/before`. **`supplier` filter now wired** into the Jurnal tab (was unused). `{id}` detail unused (not needed). |
| `/api/catalog/` | CRUD + `{id}/sell/` + `{id}/deduct_stock/` | Katalog | ✅ | sell/deduct wired in `app/katalog`. ⚠️ list filters are only `arrangement_type, status` — **no `catalog_kind`/`volume` server filter** (client-side only if needed). |
| `/api/materials/` | CRUD + `{id}/movement/` | Material sklad (Packaging model) | ✅ | `packaging_type ∈ {wrap,basket,box,other}`. **Fixed:** we previously used a non-existent `accessory` value. |
| `/api/packaging/` | CRUD + `{id}/movement/` | Same model, alias | ⚠️ | We drive everything through the `/materials/` alias; `/packaging/*` CRUD exists but is redundant for our UI. |
| `/api/material-movements/` | GET·GET{id} | Material harakatlari | ✅ | list used in Jurnal; detail unused. |
| `/api/packaging-movements/` | GET·GET{id} | Same movements, alias | ❌ | Covered by `/material-movements/`. |
| `/api/florists/` | CRUD + `me/` + `me/dashboard/` | Florist profillari | ✅ / ⛔ | CRUD used. `me/`, `me/dashboard/` are florist self-service (mini-app) — ⛔ N/A for operators. |
| `/api/florist-volume-rates/` | CRUD | Hajm tariflari matritsasi | ✅ | filters `arrangement_type, volume, branch, is_active`. |
| `/api/florist-salary/` | CRUD | Oyliklar | ⚠️ | list + create wired; filters `florist, source, work_date, created_at_after/before`. ⚠️ `source` filter not exposed in the ledger UI; update/delete/detail unused. |
| `/api/florist-attendance/` | CRUD + `check-in/` + `check-out/` | Davomat (geofence) | ❌ | **Entire domain unused** — see §d. The geofence editor we built feeds this. |
| `/api/dashboard/` | GET | Bosh sahifa | ⚠️ | **No query params** in schema — our `from/to/date_from/date_to` are likely ignored (verify live). |
| `/api/analytics/` | GET | Analitika | ⚠️ | **No query params**; `summary`/`period` are opaque objects. §8 blocks inert — see §c. |

### Other domains (existing CRM, spot-checked)

| Domain | Coverage | Notes |
|---|---|---|
| `auth` (token/refresh/blacklist) | ✅ | login, silent refresh, logout-blacklist all wired. |
| `me`, `users` (CRUD + deactivate), `permissions` (CRUD) | ✅ | |
| `leads` (CRUD + `reorder-column/` + `{id}/move/`) | ⚠️ | We use `reorder-column`; the single-item `{id}/move/` is ❌ unused (redundant). |
| `lead-statuses` (CRUD) | ✅ | dynamic kanban columns. |
| `customers`, `flowers`, `flower-variants` (CRUD) | ✅ | |
| `catalog` sell/deduct | ✅ | |
| `conversations` (send/simulate/handoff/pause_ai/resume_ai/delete) | ⚠️ | create/PUT unused (conversations are system-created). |
| `notifications` (list/read/read_all) | ⚠️ | POST-create & `{id}` detail unused (system-created). |
| `social-posts` (CRUD) | ✅ | |
| `instagram` (status GET/PATCH, events) | ✅ | `webhook` ⛔ server-side. |
| `ai/settings`, `integrations`, `settings` (GET/PATCH) | ✅ | |
| `audit` (list) | ⚠️ | `{id}` detail unused. |
| `uploads` (POST) | ✅ | |
| `mini-app/*`, `telegram/webhook` | ⛔ | Telegram mini-app (signed `init_data`) / server webhooks — not called from CRM. |

---

## c) Contract mismatches — **all fixed** (or explicitly noted)

**Fixed in code:**

1. **Materials `packaging_type` used a non-existent enum value.** Code used
   `accessory`; the real enum is `wrap | basket | box | other`. Creating or
   filtering "Aksessuar" would 400 / return nothing against the live API.
   → `components/MaterialSklad.tsx`: all options now come from the real enum via
   `PACKAGING_LABEL`; a `normType()` guard maps any legacy `accessory` → `other`.

2. **Nested validation errors were silently dropped.** `extractFieldErrors`
   only understood flat `{field: ["msg"]}`. Catalog composer / batch create send
   nested serializers, so their errors (`{composition:[{quantity_stems:[…]}]}`)
   fell through to a generic toast. → `lib/api.ts` now **recursively flattens**
   into dotted keys (`composition.0.quantity_stems`), keeping `non_field_errors`
   and mapping top-level fields; `detail` is excluded from field errors.

3. **StockBatch create omitted a required field in bunch mode.** Schema marks
   `received_stems` **required** on write; we sent only `received_bunches`.
   → `components/StockBatchModal.tsx` now **always** sends the computed
   `received_stems` (plus `received_bunches` for display when in bunch mode).

4. **`received_at` sent as ISO datetime though the field is a `date`.**
   Schema: `received_at: string (date)`. We sent `new Date(x).toISOString()`.
   → now sends `YYYY-MM-DD`.

5. **Raw error JSON shown to users.** Batch & catalog drawers did
   `showToast(JSON.stringify(e.body))`. → both now map `e.fieldErrors` to the
   relevant inputs (inline red text) plus a nested-errors banner in the composer,
   with a readable summary toast.

**Verified already-correct (no change needed):**

- Decimal-as-string fields (`received_bunches`, `quantity_bunches`,
  `cost_per_stem`, `sale_price_*`, `price`, `florist_fee`, `discount_amount`,
  `daily_pay`, `shop_latitude/longitude`, salary `amount`) — our payloads send
  strings and readers `parseFloat`/`+` them. ✅
- Movement request bodies: `MovementRequest` (stock) allows either
  `quantity_stems` (int) or `quantity_bunches` (string) — `qtyPayload()` sends
  exactly one; `PackagingMovementRequest` needs integer `quantity` — materials
  MoveModal sends that. ✅
- Enums: `catalog_kind (standard|custom)`, `volume (small|medium|large| "")`,
  catalog `arrangement_type (bouquet|basket|box)`, `staff_type`, `MovementType`,
  `SalarySource` — all match our unions. ✅

**Found & fixed during live testing (production, 2026-07-27):**

6. **`height_cm` is REQUIRED on batch create — our modal never sent it.** A real
   user got `400 height_cm: "Ushbu maydon to'ldirilishi shart."` → added a
   required "Gul bo'yi (sm)" field to `StockBatchModal`, sent + validated.
7. **Composer preview understated component/cost/discount by the florist_fee.**
   Live `calculated_component_price`/`calculated_cost_price` both **fold in
   `florist_fee`**, and `discount_amount = component − price`. Our preview treated
   fee as a separate line. Verified: server 770 000 / 445 000 / 120 000 vs old
   preview 720 000 / 395 000 / 70 000 (Δ = 50 000 fee each). → preview now adds
   fee to both; net profit was already correct (205 000). Also: `calculated_*`
   return **0 on the create response** (composition saves after), correct on GET —
   so the post-save toast now uses the (now-accurate) preview instead of the 0.
8. **Analytics §8 money fields live in `summary.*`, not top-level.** Our analitika
   page read `a.net_profit` (always null) → fixed to `a.summary.net_profit` etc.
   The two lists (`batch_inventory_stats`, `florist_production_stats`) ARE
   top-level. Dashboard has all of them top-level (its wiring was already right).
9. **§8 stat field names differed from our types.** Live shapes:
   `batch_inventory_stats[]` = `{batch_id, batch_number, supplier_id,
   supplier_name, flower, variant, color, standard_catalog_stems,
   custom_catalog_stems, waste_stems, total_out_stems}` (a consumption
   breakdown — **no** `remaining_stems`); `florist_production_stats[]` =
   `{florist_id, name, staff_type, standard_bouquets, standard_baskets,
   custom_bouquets, custom_baskets, catalog_total, salary_total}`. Types +
   `AnalyticsExtra` components realigned; §8 blocks now render live (screenshotted).

**Answered live (both schema claims overturned):**

- **Q1 — Dashboard/Analytics DO honor `date_from`/`date_to`** (undocumented
  SerializerMethod params). BUT `date_to` is treated as **midnight start-of-day
  (exclusive)**: `date_to=2026-07-27` → `period.to = 2026-07-27T00:00:00`, which
  **drops that whole day**. Proof: same range with `date_to=2026-07-27` → net
  profit 0, 0 stats; with `date_to=2026-07-28` → 150 000, 2+1 stats. Our pages
  sent `date_to = today`, so "Bugun" and any range ending today silently omitted
  the last day. → **Fixed**: new `dateBeforeParam()` sends `end + 1 day`
  (matching what `rangeParams` already did for movements); applied to both
  dashboard and analytics. (Backend-side, `date_to` ought to be inclusive
  end-of-day — worth flagging to the backend team.)
- **Q2 — the §8 fields DO exist in the live response; the OpenAPI schema is
  incomplete** (SerializerMethodFields aren't documented). So the blocks are now
  wired for real, not dormant (see fixes 8–9). Recorded exact shapes above for
  the backend team.

**Backend issues to relay (not client bugs):** — ✅ ALL FIXED in round 2 (see
top section). Kept below for history:

- ~~`POST /stock-batches/` with `received_bunches` but no `received_stems` →
  HTTP 500~~ → **FIXED**: now computes `received_stems = received_bunches × spb`.
- ~~`received_bunches` neither computed nor persisted~~ → **PARTIALLY FIXED**:
  `remaining_bunches`/`remaining_bunches_label` are now computed and returned;
  the write field `received_bunches` still isn't echoed back on read (minor).
- `date_to` treated as exclusive start-of-day — still true; documented + handled
  client-side via `dateBeforeParam` (send end+1 day). Backend could make it
  inclusive end-of-day, but no longer blocking.

---

## d) Missed capabilities — surfaced / recommended / deferred

**Surfaced now:**

- **`stock-movements?supplier=` filter** → added a "Yetkazib beruvchi" filter to
  the Sklad → Jurnal tab (alongside movement-type + date range).
- **Movements summary strip** (§3 of the task): Kirim / Ishlab chiqarishga /
  Chiqit totals for the current filter, using the movement-type hues.

**Recommended, deferred (with reason):**

- **`florist-attendance` domain (check-in / check-out, geofence).** This is a
  whole feature: the geofence we already edit on the florist profile
  (`shop_latitude/longitude`, `arrival/departure_radius_meters`) is the *input*
  to attendance. A proper build = an attendance page (daily check-in/out log,
  map of on/off-site, tie-in to `daily` salary entries). **Deferred** — it's a
  new module beyond this integration's scope; flagging so it's not forgotten.
- **`stock-batches` supplier/height filters** on the Partiyalar tab. Low value
  now (search covers day-to-day); easy to add if buyers ask.
- **`florist-salary?source=` filter** in the salary ledger. Nice-to-have.
- **`supplier.total_received_stems`** read field in the supplier detail header.
  One extra stat chip — trivial, deferred to avoid scope creep.

**Deliberately not built:** `mini-app/*`, `telegram/webhook`, `florists/me*`,
`leads/{id}/move`, `packaging(-movements)` aliases — redundant with, or out of
scope for, the operator CRM (reasons in the matrix).

---

## e) Error shapes

DRF returns, and `ApiError` now handles, all of:

| Shape | Example | Handling |
|---|---|---|
| Flat field | `{"name":["This field is required."]}` | → `fieldErrors.name`, mapped to the input |
| Multiple msgs | `{"price":["a","b"]}` | joined with a space |
| Nested serializer | `{"composition":[{"quantity_stems":["…"]}]}` | flattened → `composition.0.quantity_stems`; shown in composer banner |
| Non-field | `{"non_field_errors":["…"]}` | banner |
| Auth/permission | `{"detail":"Authentication credentials…"}` | `statusMessage` (401/403 friendly text) |

Forms wired for field-level mapping: **StockBatchModal** (variant, received_stems/
bunches, cost_per_stem, sale_price_per_stem, batch_number) and **KatalogModal**
(name_uz, price, florist_fee + nested composition/materials banner). Other
drawers surface the flattened readable message via toast.

---

## Verification status — LIVE flow completed (production, 2026-07-27)

`tsc --noEmit` clean after all fixes. Full flow run against production with
`ZZZ_TEST_` records, all cleaned up afterward. Actual numbers:

| Step | Result |
|---|---|
| Supplier create | ✅ 201 |
| Batch — DONA (received_stems=150) | ✅ `remaining=150`, `stock_value=2 700 000`; `received_bunches` stays null (backend doesn't derive it) |
| Batch — BOG'LAM pure (bunches only) | ❌ **500 NameError** (backend needs `received_stems`) |
| Batch — BOG'LAM our UI (stems=200 + bunches=8) | ✅ `remaining=200` |
| Waste — `quantity_stems=10` | ✅ 150→140 |
| Waste — `quantity_bunches="2.00"` | ✅ 200→150 (backend computed −50 = 2×25) |
| Standard catalog | ✅ server `calc_component=770 000`, `calc_cost=445 000`, `discount=120 000` → **preview was off by fee (fixed)**; stock 140→110; `stock_deducted_at` set |
| Salary (standard) | ✅ auto-created `source="catalog"`, `amount=50 000` (= volume-rate autofill) |
| Custom catalog | ✅ `status=sold`, `quantity_sold=1`, stock 150→130; salary `source="custom_catalog"`, `amount=50 000` |
| Lead won→back | ✅ 110→80 (won) →110 (back) →80 (won again, **no double-deduct**) →110 |
| Dashboard delta | ✅ `net_profit 0→150 000`, `florist_salary_total 100 000`, `flowers_sold_stems 110`, `available_catalog 0→1` |
| Q1 date params | ✅ honored; `date_to` exclusive-of-day (fixed client-side) |
| Q2 §8 fields | ✅ present live; blocks wired + screenshotted |
| Yandex geofence map | ✅ real tiles load, green(120 m)+violet(300 m) circles + both sliders |

**Cleanup:** hard-deleted (404) — supplier, florist, 2 catalog, 2 salary, lead,
volume-rate. **Soft-deleted** — 2 stock-batches (`DELETE`→204 but `is_active=false`,
records + movements retained by backend design; invisible in `is_active=true`
UI lists). Stock movements have no delete endpoint (immutable history). Dashboard
returned to baseline (`net_profit=0`, `stock_stems=2680`, `available_catalog=0`).
