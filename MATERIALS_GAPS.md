# Materials / packaging — backend gaps

> **STATUS 2026-08-02 — MOSTLY CLOSED by the material-delivery release.**
> Re-audited read-only against the live API (`GET` + `/api/schema/`). Per-gap verdicts below;
> the summary table at the bottom carries the current state. Only **GAP 5** is still open.


Feasibility audit for the shop-owner's materials requests (2026-08-01), done
**read-only** against the live API (`GET` + `/api/schema/`). Everything below is
**not supported by the current backend** and needs the field/endpoint changes
described. Each item lists: the exact model/serializer/filter change, types, and
why the frontend can't do it honestly without it.

Reference — the current writable `Packaging` (material) fields (POST/PATCH
`/api/materials/` both use the `Packaging` schema): `packaging_type` (enum
`wrap|basket|box|other`), `name_uz`, `size` (free-text string, nullable),
`capacity_min_stems`, `capacity_max_stems`, `cost_price`, `sale_price`,
`quantity` (int), `image_url`, `is_active`. Read-only: `quantity_label`
("176 dona"), `packaging_type_label`, `last_delivery` (`{id, number,
received_at, supplier, supplier_id, quantity, unit_cost}`).

---

## GAP 1 — `supplier` FK on a material — ⚠️ PARTIALLY CLOSED

**Closed part:** every material now carries a reliable read-only `last_delivery`
(`{id, number, received_at, supplier, supplier_id, quantity, unit_cost}`) in BOTH list and
detail responses, so the supplier chip + last-delivery number ship today (§4).
**Still missing:** an independently *editable* `supplier` FK and a server-side `?supplier=`
filter on `/api/materials/` (we filter client-side by `last_delivery.supplier`).

**Now:** a material has no supplier field. Its supplier is only *derivable*
read-only from `last_delivery.supplier_id` (the most recent delivery). That can't
be set independently, can't be filtered server-side, and changes every delivery.

**Request:**
- Model `Packaging`: add `supplier = models.ForeignKey(Supplier, null=True, blank=True, on_delete=models.SET_NULL, related_name="materials")`.
- Serializer: writable `supplier` (int id) + read-only nested `supplier_detail`.
- Filterset on `GET /api/materials/`: add `supplier` (exact id).

**Why:** §2 wants an editable supplier on the material and a `?supplier=` filter
on the list; §1 wants to segment suppliers into flower vs material sets.

---

## GAP 2 — pack unit + pack size — ✅ CLOSED

Shipped as `unit` (`UnitEnum: piece|bunch`) + `units_per_bunch` on `Packaging`, plus a
bunch-shaped receive (`bunches` + `cost_per_bunch`) that the backend converts
(`quantity = bunches × units_per_bunch`, `cost_price = cost_per_bunch ÷ units_per_bunch`).
`?unit=` filter exists. Dual display is client-side (`quantityDual`).

**Now:** `quantity` is a plain integer of pieces; `quantity_label` is always
"N dona". There is no unit concept and no pack-size field. Pack↔piece conversion
cannot round-trip (given "60 dona" the UI can't know it was 20/pack unless the
pack size is stored).

**Request:**
- Model `Packaging`: add `items_per_pack = models.PositiveIntegerField(null=True, blank=True)` (e.g. 20 for paper; null = counted in pieces only).
- Serializer: writable `items_per_pack`; include it in `quantity_label` logic or add a second read-only `quantity_pack_label` ("60 dona · 3 pochka").
- (Optional) `PackagingMovement`: accept `quantity_packs` alongside `quantity` so incoming deliveries can be entered in packs.

**Why:** §3 wants paper bought/counted in packs (default 20/pack, **editable**)
with a dual-unit display; §5 wants gupka counted in pochka. Without stored pack
size this is fake state.

---

## GAP 3 — `supplier_type` on Supplier — ✅ CLOSED

`Supplier.supplier_type` exists (`flower|material|both`) with a `?supplier_type=` filter.
Live data already classifies Xayrulloh and Jamoliddin as `material`.

**Now:** Supplier has no type/kind marker (fields: `name`, `phone`, `notes`,
`is_active` + read-only aggregates `batches_count`, `total_received_stems`, …).

**Derivation works today** (so the §1 filter can ship without this): a supplier
is a *flower* supplier if `batches_count > 0`, and a *material* supplier if it
appears as `supplier` on any `/api/material-deliveries/` record. But a brand-new
supplier with no history is unclassifiable, and material-supplier detection costs
a full `/material-deliveries/` scan client-side.

**Request (preferred):**
- Model `Supplier`: add `supplier_type = models.CharField(choices=[("flower","Gul"),("material","Material"),("both","Ikkalasi")], default="flower")`.
- Serializer: writable; Filterset on `GET /api/suppliers/`: add `supplier_type`.

**Why:** makes the §1 segmented filter and the §2 material-supplier select exact
and cheap instead of derived/heuristic.

---

## GAP 4 — basket subtype + size enum — ✅ MOSTLY CLOSED

`basket_material` (`BasketMaterialEnum: wooden|plastic_handle|woven`) + `basket_material_label`
shipped, with `?basket_material=` and `?size=` filters. **Residual:** `size` is still a free-text
string (seeded `xs/s/m/l/xl`), not an enum — we uppercase it for display and build the size
filter from observed values, so a typo would create a stray option.

**Now:** no subtype field at all; `size` exists but is a free-text string (no
enum, no validation).

**Request:**
- Model `Packaging`: add `basket_subtype = models.CharField(null=True, blank=True, choices=[("yogochli","Yog'ochli"),("plastmassa_ruchka","Plastmassa ruchka"),("toqima","To'qima")])` — required (serializer-level) when `packaging_type="basket"`.
- Constrain `size` to `choices=[("xs","XS"),("s","S"),("m","M"),("l","L"),("xl","XL")]` (keep nullable for non-sized types), OR add a dedicated `size_code` enum and leave `size` for other uses.
- Filterset on `GET /api/materials/`: add `basket_subtype` and `size`.

**Why:** §4 is a 3×5 matrix that needs structured storage to drive the two
required selects, the card chip pair, and the two list filters. Free-text `size`
+ no subtype can't validate or filter reliably.

---

## GAP 5 — consumable categories in `packaging_type` — ❌ STILL OPEN

`PackagingTypeEnum` is unchanged (`wrap|basket|box|other`); Gupka / Lenta / Lak all remain
`other`. **This now also blocks a correctness rule, not just labelling:** the catalog/sell
pickers must hide receive-only consumables, and the only data-driven signal available is
`packaging_type === "other"` (see `lib/materialUnit.ts → isConsumableOnly`).

**Preferred request (upgraded):** an explicit boolean `is_sellable` / `usable_in_catalog` on
`Packaging` (+ filter). That is more robust than splitting the enum, because it survives new
consumables being filed under any type. Until then our heuristic silently breaks if a
consumable is created as `wrap`/`basket`/`box`.

**Now:** `PackagingTypeEnum = [wrap, basket, box, other]`. Gupka / lenta / lak all
collapse into "other" (labelled "Aksessuarlar").

**Request:**
- Extend `PackagingTypeEnum` with `gupka`, `lenta`, `lak` (or a `consumable`
  parent + a `consumable_kind` sub-enum). Add Uzbek labels: Gupka, Lenta, Lak.
- If pack units are wanted per kind (gupka→pochka), that rides on GAP 2's
  `items_per_pack`.

**Why:** the owner says grouping these three under one "Aksessuarlar" bucket
hurts usability; they're distinct consumables with different units and separate
stock lines. The movement-type restriction (incoming/adjustment/waste only, no
sale) is **already supported** — `MovementTypeEnum` has `in|out|adjustment|waste|
transfer_out|transfer_in`, so no backend change needed there.

---

## Summary table

| # | Need | State (2026-08-02) | Residual request |
|---|------|--------------------|------------------|
| 1 | supplier on material | ⚠️ **Partial** — `last_delivery.supplier(_id)` reliable in list+detail | editable `Packaging.supplier` FK + `?supplier=` filter |
| 2 | pack unit / size | ✅ **Closed** — `unit` + `units_per_bunch` + bunch receive | — |
| 3 | supplier type | ✅ **Closed** — `Supplier.supplier_type` + filter | — |
| 4 | basket subtype + size | ✅ **Mostly** — `basket_material` enum + `?basket_material=`/`?size=` | make `size` an enum |
| 5 | consumable categories | ❌ **Open** — Gupka/Lenta/Lak still `other` | **`is_sellable`/`usable_in_catalog` flag** (now blocks a correctness rule) |

---

## NEW GAP 6 — material purchases do not roll into supplier debt  (blocks Hisob-kitob §1)

**Verified live (2026-08-02):** supplier *Xayrulloh* (`supplier_type: "material"`) has a material
delivery worth **3 635 000** (`/api/material-deliveries/3/` → `total_cost: 3635000.0`), yet the
supplier record reports `purchase_total: "0.00"`, `paid_total: "0.00"`, `outstanding: "0.00"`,
`batches_count: 0`. The same holds for *Jamoliddin*.

**Consequence:** money owed to material suppliers is **invisible** in Hisob-kitob Section 1
(Yetkazib beruvchilar), which aggregates `purchase_total`/`outstanding`. A shop can owe a
material supplier millions and see zero debt. Supplier payments (`/api/supplier-payments/`) can
still be recorded against them, which would make `paid_total` exceed `purchase_total` — a
negative-debt display.

**Request:** include material deliveries' `total_cost` in `Supplier.purchase_total` /
`outstanding` (ideally with a breakdown: `flower_purchase_total` vs `material_purchase_total`),
so material suppliers appear in Section 1 even with no flower batches.

**Frontend meanwhile:** we do NOT fabricate the rollup. Section 1 keeps showing server numbers;
material purchase totals are surfaced only where they are real (the delivery list/detail).

**Already supported (no backend change):** `sale_price` on materials; movement
types `in/adjustment/waste`; reading a material's latest supplier via
`last_delivery`; free-text `size` (unstructured).
