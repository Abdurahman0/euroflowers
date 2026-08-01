# Materials / packaging — backend gaps

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

## GAP 1 — `supplier` FK on a material  (blocks §2, part of §1)

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

## GAP 2 — pack unit + pack size (`items_per_pack`)  (blocks §3, part of §5)

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

## GAP 3 — `supplier_type` on Supplier  (part of §1)

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

## GAP 4 — basket subtype + size enum  (blocks §4)

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

## GAP 5 — consumable categories in `packaging_type`  (blocks §5 categorization)

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

| # | Need | Backend change | Blocks |
|---|------|----------------|--------|
| 1 | supplier on material | `Packaging.supplier` FK + `?supplier=` filter | §2, §1 |
| 2 | pack unit / size | `Packaging.items_per_pack` (+ movement `quantity_packs`) | §3, §5 |
| 3 | supplier type | `Supplier.supplier_type` enum + filter (else derive) | §1 |
| 4 | basket subtype + size | `Packaging.basket_subtype` enum + `size` enum + filters | §4 |
| 5 | consumable categories | extend `PackagingTypeEnum` (gupka/lenta/lak) | §5 |

**Already supported (no backend change):** `sale_price` on materials; movement
types `in/adjustment/waste`; reading a material's latest supplier via
`last_delivery`; free-text `size` (unstructured).
