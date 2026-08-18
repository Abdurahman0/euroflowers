# EuroFlowers Frontend Update

## Material va Accessory Ajratildi

Backendda `Packaging.packaging_type`ga yangi tur qo‘shildi:

```text
material
```

Endi `Packaging` turlari:

```text
wrap      Buket qog‘ozi
basket    Savat
box       Quti
material  Material
other     Aksessuar
```

## Muhim O‘zgarish

Oldin `other` ichida turgan materiallar endi `material`ga o‘tkazildi.

Serverdagi ko‘chirilgan data:

```text
Gupka  material
Lak    material
Lenta  material
sumka  material
```

`other` endi faqat haqiqiy aksessuarlar uchun:

```text
O‘yinchoq
Shokolad
Otkritka
Maktub
Sovg‘a qo‘shimchalari
```

## Frontend Filterlar

Materiallar page:

```http
GET /api/packaging/?packaging_type=material
```

Accessory page:

```http
GET /api/packaging/?packaging_type=other
```

Buket qog‘ozlari:

```http
GET /api/packaging/?packaging_type=wrap
```

Savatlar:

```http
GET /api/packaging/?packaging_type=basket
```

Qutilar:

```http
GET /api/packaging/?packaging_type=box
```

## Material Yaratish

Material yaratishda `packaging_type=material` yuboring.

```http
POST /api/packaging/
```

```json
{
  "packaging_type": "material",
  "name_uz": "Lenta",
  "sale_price": "0.00",
  "cost_price": "60000.00"
}
```

Material yuk bilan darrov kirim qilish:

```json
{
  "packaging_type": "material",
  "name_uz": "Lenta",
  "sale_price": "0.00",
  "cost_price": "60000.00",
  "delivery": 12,
  "quantity": 20
}
```

## Accessory Yaratish

Accessory yaratishda `packaging_type=other` yuborish tavsiya qilinadi.
Yuborilmasa backend default `other` qiladi.

Minimal accessory:

```http
POST /api/packaging/
```

```json
{
  "name_uz": "Shokolad",
  "sale_price": "25000.00"
}
```

To‘liq accessory:

```json
{
  "packaging_type": "other",
  "name_uz": "O‘yinchoq ayiqcha",
  "sale_price": "60000.00",
  "cost_price": "40000.00",
  "is_active": true
}
```

Accessory yuk bilan darrov kirim qilish:

```json
{
  "packaging_type": "other",
  "name_uz": "Shokolad",
  "sale_price": "25000.00",
  "cost_price": "18000.00",
  "delivery": 12,
  "quantity": 50
}
```

## Yuklar

Material va accessory yuklari bir xil endpoint orqali ishlaydi:

```http
POST /api/material-deliveries/
POST /api/material-deliveries/{id}/receive/
```

Yuk ochish:

```json
{
  "number": "MAT-2026-001",
  "received_at": "2026-08-18",
  "supplier": 5,
  "note": "Material va aksessuarlar keldi"
}
```

Yuk ichiga mavjud material/accessory kiritish:

```json
{
  "packaging": 53,
  "quantity": 20,
  "cost_price": "60000.00",
  "reason": "Lenta kirim"
}
```

## Katalog Sotishda Material/Accessory Qo‘shish

Katalog sotuv modalida material va accessory ikkalasi ham `materials` array orqali yuboriladi.

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
      "packaging": 53,
      "quantity": 1
    },
    {
      "packaging": 101,
      "quantity": 2
    }
  ]
}
```

Frontendda sell modalda 2 ta alohida selector qilish mumkin:

```text
Materiallar    packaging_type=material
Accessorylar   packaging_type=other
```

Backend ikkalasini ham qoldiqdan kamaytiradi.

## Accessoryni Alohida Sotish

Faqat accessory emas, har qanday `Packaging`ni alohida sotish actioni bor, lekin UI’da asosan accessory uchun ishlating.

```http
POST /api/packaging/{id}/sell/
```

```json
{
  "quantity": 2,
  "sale_price": "25000.00",
  "payment_type": "cash",
  "reason": "Mijozga shokolad alohida sotildi"
}
```

## Supplier Detail

Supplier detailda material/accessory yuklari `material_deliveries` ichida chiqadi.

```http
GET /api/suppliers/{id}/
```

Item ichida `packaging_type` keladi:

```json
{
  "packaging": 53,
  "name_uz": "Lenta",
  "packaging_type": "material",
  "quantity": 20,
  "unit_cost": "60000.00"
}
```

Frontend label:

```text
material → Material
other    → Aksessuar
wrap     → Buket qog‘ozi
basket   → Savat
box      → Quti
```

## UI Tavsiya

Inventory ichida tablar:

```text
Buket qog‘ozlari
Savatlar
Qutilar
Materiallar
Aksessuarlar
```

Materiallar tab:

- Gupka
- Lak
- Lenta
- Sumka
- boshqa ishlab chiqarish/qadoqlash materiallari

Aksessuarlar tab:

- O‘yinchoq
- Shokolad
- Otkritka
- Maktub
- boshqa sovg‘a qo‘shimchalari

## Muhim

Oldin `other`dan material olib ishlatilgan joylar endi `material`ga o‘tkazilsin.

Accessory page faqat `packaging_type=other` ko‘rsatsin.

Material page faqat `packaging_type=material` ko‘rsatsin.

Bu `.md` faqat frontend integratsiya uchun. Repo ichiga commit qilinmaydi.
