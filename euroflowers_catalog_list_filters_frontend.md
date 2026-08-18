# EuroFlowers Frontend Update

## Katalog List API Optimization

Backendda `GET /api/catalog-items/` list endpoint yengillashtirildi va yangi tab/filter param qo‘shildi.

## Yangi Filter

`GET /api/catalog-items/?status_group=available`

`status_group` qiymatlari:

- `available` — sotuvda turgan kataloglar
- `sold` — sotilgan kataloglar
- `archived` — arxiv kataloglar
- `all` yoki bo‘sh — barchasi

Aliaslar ham ishlaydi:

- `active`
- `sale`
- `sotuvda`

Bu aliaslar `available` bilan bir xil.

## Existing Filterlar

Quyidagilar avvalgidek ishlaydi:

```text
status
arrangement_type
catalog_kind
florist
customer
search
ordering
page
page_size
```

Misollar:

```http
GET /api/catalog-items/?status_group=available&page=1&page_size=30
GET /api/catalog-items/?status_group=sold&ordering=-sold_at
GET /api/catalog-items/?status_group=archived&search=gortenziya
GET /api/catalog-items/?status_group=available&arrangement_type=basket
GET /api/catalog-items/?status_group=available&catalog_kind=custom
GET /api/catalog-items/?status_group=sold&florist=12
```

## List Response Endi Yengil

`GET /api/catalog-items/` endi list uchun lightweight serializer ishlatadi.

Listda endi quyidagi og‘ir fieldlar qaytmaydi:

```text
composition
materials
history
social_post_detail
florist_detail
decoration_florist_detail
description_uz
description_ru
note
```

Bu response hajmini kamaytiradi va page tezroq ochiladi.

## Detail Response O‘zgarmadi

To‘liq ma’lumot kerak bo‘lsa detail API ishlatiladi:

```http
GET /api/catalog-items/{id}/
```

Detailda avvalgidek to‘liq data qaytadi:

```text
composition
materials
history
social_post_detail
florist_detail
decoration_florist_detail
description_uz
description_ru
note
```

Frontend list card/tableda ko‘rsatish uchun list endpoint yetarli.
Edit/view detail drawer yoki page ochilganda detail endpoint chaqirish kerak.

## List Response Fieldlari

List response ichida asosiy fieldlar:

```json
{
  "id": 1,
  "name_uz": "Gortenziya Mix",
  "arrangement_type": "basket",
  "catalog_kind": "standard",
  "volume": "medium",
  "branch": null,
  "branch_name": "Asosiy filial",
  "customer": null,
  "customer_detail": null,
  "florist": 12,
  "florist_name": "Abror",
  "decoration_florist": null,
  "decoration_florist_name": "",
  "height_cm": 60,
  "diameter_cm": 45,
  "price": "850000.00",
  "calculated_cost_price": "520000.00",
  "discount_amount": "0.00",
  "discount_percent": "0.00",
  "status": "available",
  "image_url": "https://...",
  "instagram_story_url": "",
  "quantity_total": 1,
  "quantity_sold": 0,
  "quantity_wasted": 0,
  "quantity_reworked": 0,
  "quantity_remaining": 1,
  "sold_at": null,
  "created_at": "2026-08-18T17:08:00+05:00",
  "updated_at": "2026-08-18T17:08:00+05:00",
  "profit": {
    "unit_price": "850000.00",
    "unit_cost": "520000.00",
    "unit_profit": "330000.00",
    "unit_margin_percent": "38.82",
    "realized_profit": "0.00"
  }
}
```

## Totals / Countlar

Pagination response ichida `totals` avvalgidek qaytadi.

Muhim fieldlar:

```json
{
  "totals": {
    "items": 30,
    "quantity_total": 45,
    "quantity_sold": 12,
    "quantity_wasted": 0,
    "quantity_reworked": 0,
    "quantity_remaining": 33,
    "remaining_value": "25000000.00",
    "sold_value": "9000000.00",
    "cost_total": "15000000.00",
    "discount_total": "500000.00",
    "by_status": {
      "available": 20,
      "sold": 8,
      "archived": 2
    },
    "status_counts": {
      "draft": 0,
      "available": 20,
      "reserved": 0,
      "sold": 8,
      "archived": 2,
      "all": 30
    },
    "available_count": 20,
    "sold_count": 8,
    "archived_count": 2,
    "by_kind": {
      "standard": 25,
      "custom": 5
    }
  }
}
```

Tablarda `status_counts` ishlatilgani yaxshi.

## Frontend Tavsiya

Katalog page tablari:

- Sotuvda → `status_group=available`
- Sotilgan → `status_group=sold`
- Arxiv → `status_group=archived`
- Barchasi → `status_group=all`

List page:

- Faqat list endpointni chaqiring.
- Row/card bosilganda detail endpointni chaqiring.
- Edit modal ochilganda ham detail endpointdan to‘liq data oling.

## Muhim

Oldin list response ichidan `composition`, `materials`, `history` olib ishlatilgan joylar bo‘lsa, ularni detail endpointga ko‘chirish kerak.

Bu `.md` faqat frontend uchun. Repo ichiga commit qilinmaydi.
