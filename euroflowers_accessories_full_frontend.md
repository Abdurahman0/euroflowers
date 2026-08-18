# EuroFlowers Frontend Update

## Accessory Flow

Accessorylar backendda alohida model emas. Ular `Packaging` modelida saqlanadi.

Accessoryni ajratadigan field:

```json
{
  "packaging_type": "other"
}
```

Accessory misollari:

- O‘yinchoq
- Shokolad
- Otkritka
- Maktub
- Lentali qo‘shimcha
- Boshqa sovg‘a/accessorylar

## Asosiy Endpointlar

```http
GET /api/packaging/?packaging_type=other
POST /api/packaging/
PATCH /api/packaging/{id}/
POST /api/material-deliveries/
POST /api/material-deliveries/{id}/receive/
POST /api/catalog-items/{id}/sell/
POST /api/packaging/{id}/sell/
GET /api/packaging-movements/
GET /api/suppliers/{id}/
```

## Accessory List

Accessorylar ro‘yxati:

```http
GET /api/packaging/?packaging_type=other&page=1&page_size=50
```

Response ichida muhim fieldlar:

```json
{
  "id": 33,
  "packaging_type": "other",
  "packaging_type_label": "Boshqalar",
  "name_uz": "Shokolad",
  "unit": "piece",
  "unit_label": "Dona",
  "cost_price": "18000.00",
  "sale_price": "25000.00",
  "quantity": 48,
  "quantity_label": "48 dona",
  "image_url": "https://...",
  "is_active": true,
  "last_delivery": {
    "id": 12,
    "number": "ACC-2026-001",
    "received_at": "2026-08-18",
    "supplier": "Accessory postavshik",
    "supplier_id": 5,
    "quantity": 50,
    "unit_cost": "18000.00"
  }
}
```

## Accessory Yaratish

Minimal request:

```http
POST /api/packaging/
Content-Type: application/json
```

```json
{
  "name_uz": "Shokolad",
  "sale_price": "25000.00"
}
```

Backend avtomatik qo‘yadi:

```json
{
  "packaging_type": "other",
  "unit": "piece",
  "cost_price": "0.00",
  "quantity": 0
}
```

Tavsiya qilingan frontend forma:

- Nomi — required
- Sotuv narxi — required
- Tannarx — optional
- Rasm — optional
- Aktiv — default true

To‘liq request:

```json
{
  "packaging_type": "other",
  "name_uz": "O‘yinchoq ayiqcha",
  "sale_price": "60000.00",
  "cost_price": "40000.00",
  "is_active": true
}
```

Rasm bilan yuborishda `multipart/form-data` ishlating:

```text
name_uz=O‘yinchoq ayiqcha
sale_price=60000
cost_price=40000
packaging_type=other
image=<file>
```

## Accessory Yuk Ochish

Accessory yuklari material yuklari bilan bir xil ishlaydi.

Yuk ochish:

```http
POST /api/material-deliveries/
```

```json
{
  "number": "ACC-2026-001",
  "received_at": "2026-08-18",
  "supplier": 5,
  "note": "Shokolad va o‘yinchoqlar keldi"
}
```

Yuk ichiga accessory qo‘shish:

```http
POST /api/material-deliveries/{delivery_id}/receive/
```

```json
{
  "packaging": 33,
  "quantity": 50,
  "cost_price": "18000.00",
  "reason": "Shokolad kirim"
}
```

Natija:

- Accessory qoldig‘i oshadi.
- Accessory tannarxi `cost_price` bo‘yicha yangilanadi.
- `PackagingMovement` kirim yozuvi yaratiladi.
- Yuk supplierga bog‘langan bo‘lsa, supplier detailda shu yuk chiqadi.

## Accessoryni Yaratish Paytida Yukga Kiritish

Bitta requestda accessory yaratib, darrov yukga kiritish ham mumkin:

```http
POST /api/packaging/
```

```json
{
  "name_uz": "Shokolad",
  "sale_price": "25000.00",
  "cost_price": "18000.00",
  "delivery": 12,
  "quantity": 50
}
```

Backend:

- `packaging_type` ni `other` qiladi.
- Accessory yaratadi.
- `delivery=12` yukka 50 dona kirim qiladi.
- Accessory qoldig‘i 50 bo‘ladi.

## Supplier Detailda Accessory Yuklari

```http
GET /api/suppliers/{id}/
```

Detail response ichida:

```json
{
  "material_deliveries_count": 2,
  "material_received_quantity": 140,
  "material_purchase_total": "1200000.00",
  "purchase_total": "1200000.00",
  "material_deliveries": [
    {
      "id": 12,
      "number": "ACC-2026-001",
      "received_at": "2026-08-18",
      "item_count": 2,
      "total_quantity": 80,
      "total_cost": "1440000.00",
      "items": [
        {
          "movement_id": 91,
          "packaging": 33,
          "name_uz": "Shokolad",
          "packaging_type": "other",
          "quantity": 50,
          "unit_cost": "18000.00"
        }
      ]
    }
  ]
}
```

Frontend supplier detailda alohida section:

- Gul yuklari
- Material/accessory yuklari

Accessory yuk itemlarini `packaging_type=other` label bilan chiqaring.

## Katalog Sotuvda Accessory Qo‘shish

Katalog sotish modalida accessory/materiallar `materials` array orqali yuboriladi.

```http
POST /api/catalog-items/{id}/sell/
```

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

Bu yerda `materials` ichida qog‘oz, savat, box, accessory ham bo‘lishi mumkin.

Accessory tanlash uchun frontendda:

```http
GET /api/packaging/?packaging_type=other&is_active=true
```

Backend katalog sotilganda accessory qoldig‘ini kamaytiradi.

Qoldiq yetmasa:

```json
{
  "detail": "Sotuv uchun material qoldig‘i yetarli emas: Shokolad"
}
```

## Accessoryni Alohida Sotish

Yangi action:

```http
POST /api/packaging/{id}/sell/
```

Request:

```json
{
  "quantity": 2,
  "sale_price": "25000.00",
  "payment_type": "cash",
  "reason": "Mijozga shokolad alohida sotildi",
  "sold_at": "2026-08-18T17:20:00+05:00"
}
```

Fieldlar:

- `quantity` optional, default `1`
- `sale_price` optional, berilmasa accessory `sale_price` olinadi
- `payment_type` optional, qiymatlar `cash`, `card`, `debt`, `mixed`
- `reason` optional
- `sold_at` optional

Response `PackagingMovement` qaytaradi.

Natija:

- Accessory qoldig‘i kamayadi.
- `PackagingMovement` yaratiladi.
- `reference_type = "packaging_sale"`
- `unit_price` va `payment_type` movementda saqlanadi.
- Audit log yoziladi.

## Movement Journal

```http
GET /api/packaging-movements/?packaging__packaging_type=other
```

Movementda muhim fieldlar:

```json
{
  "id": 100,
  "packaging": 33,
  "movement_type": "out",
  "quantity": -2,
  "unit_cost": "18000.00",
  "unit_price": "25000.00",
  "payment_type": "cash",
  "reference_type": "packaging_sale",
  "reason": "Mijozga shokolad alohida sotildi"
}
```

List totals ichida:

```json
{
  "totals": {
    "in_quantity": 50,
    "out_quantity": 2,
    "net_quantity": 48,
    "cost_total": "...",
    "sale_total": "50000.00"
  }
}
```

## Frontend UI Tavsiya

Accessory page:

- Card/table: rasm, nom, qoldiq, tannarx, sotuv narxi, aktivlik.
- Actions: edit, yukga kirim, alohida sotish, movement history.
- Filter: active/all.

Accessory create modal:

- Nomi
- Sotuv narxi
- Tannarx
- Rasm
- Darrov yukka kiritish toggle
- Toggle yoqilsa: yuk tanlash, quantity, cost_price

Katalog sell modal:

- Asosiy sotuv fieldlari
- Accessory qo‘shish section
- Multi row: accessory, quantity
- Submitda `materials` arrayga qo‘shib yuborish

Supplier detail:

- Material/accessory deliveries section
- Har bir yuk ichida itemlar
- `packaging_type=other` bo‘lsa Accessory label

## Muhim

Accessory uchun frontend `packaging_type="other"` yuborsa yaxshi. Yubormasa ham backend default `other` qiladi.

Bu `.md` faqat frontend integratsiya uchun. Repo ichiga commit qilinmaydi.
