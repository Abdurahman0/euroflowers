# EuroFlowers Frontend Update

## Maqsad

Bu update 2 ta joyni yopadi:

- Postavshik detail sahifasida material/accessory yuklari ham chiqadi.
- Accessorylar materiallar kabi yuk bilan kirim qilinadi, katalog sotuvda ishlatiladi va alohida sotiladi.

## Supplier Detail

`GET /api/suppliers/{id}/`

Detail response endi material yuklarini ham qaytaradi:

```json
{
  "id": 1,
  "name": "Material postavshik",
  "supplier_type": "material",
  "batches_count": 0,
  "total_received_stems": 0,
  "material_deliveries_count": 2,
  "material_received_quantity": 140,
  "flower_purchase_total": "0.00",
  "material_purchase_total": "1200000.00",
  "purchase_total": "1200000.00",
  "paid_total": "0.00",
  "material_deliveries": [
    {
      "id": 12,
      "number": "MD-2026-001",
      "received_at": "2026-08-18",
      "note": "",
      "is_active": true,
      "item_count": 2,
      "total_quantity": 140,
      "total_cost": "1200000.00",
      "items": [
        {
          "movement_id": 91,
          "packaging": 33,
          "name_uz": "Shokolad",
          "packaging_type": "other",
          "quantity": 20,
          "unit_cost": "15000.00"
        }
      ]
    }
  ]
}
```

Frontendda supplier detailda 2 ta blok qilish kerak:

- Gul yuklari eski flow bo‘yicha `StockDelivery`.
- Material/accessory yuklari yangi `material_deliveries` array bo‘yicha.

Supplier listda ham qo‘shimcha count/summa fieldlari keladi:

- `material_deliveries_count`
- `material_received_quantity`
- `flower_purchase_total`
- `material_purchase_total`
- `purchase_total` endi gul + material umumiy kirim summasi

## Accessory Kirim

Accessory alohida model emas. U `Packaging` ichida yuradi:

`packaging_type = "other"`

Material yuk ochish:

`POST /api/material-deliveries/`

Yuk ichiga accessory/material kiritish:

`POST /api/material-deliveries/{delivery_id}/receive/`

Request:

```json
{
  "packaging": 33,
  "quantity": 20,
  "cost_price": "15000.00",
  "reason": "Shokolad kirim"
}
```

Accessory yaratish yoki edit qilishda rasm ham ishlaydi, chunki `Packaging` da `image` upload bor.

## Catalog Sotuvda Accessory Qo‘shish

Katalog sotilayotganda qo‘shimcha accessory/materiallar `materials` array orqali yuboriladi.

`POST /api/catalog-items/{id}/sell/`

Request:

```json
{
  "quantity": 1,
  "sale_price": "850000.00",
  "payment_type": "cash",
  "materials": [
    {
      "packaging": 33,
      "quantity": 1
    },
    {
      "packaging": 41,
      "quantity": 2
    }
  ]
}
```

Backend har bir `materials` itemni sklad qoldig‘idan kamaytiradi.

Agar accessory/material yetmasa:

```json
{
  "detail": "Sotuv uchun material qoldig‘i yetarli emas: Shokolad"
}
```

Frontend sell modalda `materials` tanlashda barcha `Packaging` turlarini ko‘rsata oladi:

- `wrap`
- `basket`
- `box`
- `other`

Accessory uchun odatda `other` filter ishlatiladi.

## Accessory Alohida Sotish

Yangi endpoint:

`POST /api/packaging/{id}/sell/`

Request:

```json
{
  "quantity": 2,
  "sale_price": "25000.00",
  "payment_type": "cash",
  "reason": "Mijozga shokolad alohida sotildi",
  "sold_at": "2026-08-18T12:00:00+05:00"
}
```

Fieldlar:

- `quantity` optional, default `1`
- `sale_price` optional, berilmasa `Packaging.sale_price` olinadi
- `payment_type` optional, qiymatlar `cash`, `card`, `debt`, `mixed`
- `reason` optional
- `sold_at` optional

Response `PackagingMovement` qaytaradi.

Bu actiondan keyin:

- `Packaging.quantity` kamayadi
- `PackagingMovement` yaratiladi
- `reference_type = "packaging_sale"`
- `unit_price` va `payment_type` movementda saqlanadi
- Audit log yoziladi

## Movement Journal

`GET /api/packaging-movements/`

Movement response ichida yangi fieldlar bor:

- `unit_price`
- `payment_type`

List totals ichida yangi:

- `sale_total`

Frontend journalda alohida sotuvlarni `reference_type = "packaging_sale"` orqali ajratib ko‘rsatishi mumkin.

## Tavsiya Qilingan UI

Supplier detail:

- Headerda umumiy `purchase_total`.
- Pastida `Flower deliveries` va `Material/accessory deliveries` tab.
- Material yuk cardida `number`, `received_at`, `total_quantity`, `total_cost`.
- Card ichida itemlar table: nomi, turi, soni, tannarxi.

Accessory page:

- Filter `packaging_type=other`.
- Card/tableda rasm, nom, qoldiq, tannarx, sotuv narxi.
- Actionlar: kirim, adjustment, alohida sotish.

Catalog sell modal:

- Asosiy sotuv fieldlari.
- Qo‘shimcha `Accessory/materials` section.
- Multi-select yoki add-row style: item, quantity.
- Yetarli qoldiq bo‘lmasa backend `detail` messageini toast qilib ko‘rsatish.

## Muhim

Markdown file repo ichiga commit qilinmasin. Bu hujjat faqat frontend integratsiya uchun.
