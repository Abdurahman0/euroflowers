# EuroFlowers Frontend Update - Katalog va AI Katalog

Sana: 2026-08-20
Backend: https://euroflowers.api.cognilabs.org/api

## 1. Oddiy katalog API

Endpoint:

```http
GET /api/catalog/
```

Avvalgi format buzilmagan. `results` hali ham list bo'lib qaytadi.

Qo'shimcha yangi field:

```json
{
  "grouped_results": {
    "standard": [],
    "custom": []
  }
}
```

`standard` - oddiy katalog mahsulotlari.

`custom` - maxsus katalog mahsulotlari.

Frontend eski `results` bilan ishlashda davom etsa bo'ladi. Agar alohida chiqarish kerak bo'lsa, `grouped_results.standard` va `grouped_results.custom` ishlatiladi.

## 2. Results'ni ham alohida olish

Agar frontend `results` ichida ham alohida obyekt xohlasa:

```http
GET /api/catalog/?separate_by_kind=true
```

Shunda response:

```json
{
  "count": 293,
  "results": {
    "standard": [],
    "custom": []
  },
  "grouped_results": {
    "standard": [],
    "custom": []
  },
  "totals": {}
}
```

Tavsiya: hozircha eski stabil format uchun `results` list bo'lib qolgan holatni ishlating, maxsuslarni esa `grouped_results.custom`dan oling.

## 3. Filterlar

Maxsus kataloglarni alohida olish:

```http
GET /api/catalog/?catalog_kind=custom
```

Oddiy kataloglarni alohida olish:

```http
GET /api/catalog/?catalog_kind=standard
```

Status bilan birga:

```http
GET /api/catalog/?catalog_kind=custom&status_group=available
GET /api/catalog/?catalog_kind=standard&status_group=sold
```

Mavjud `status_group` qiymatlari:

```text
available
sold
archived
all
```

## 4. AI uchun alohida katalog

AI mijozlarga ko'rsatadigan katalog endi oddiy CRM katalogdan alohida.

Endpoint:

```http
GET /api/ai-catalog/
```

Create:

```http
POST /api/ai-catalog/
```

Update:

```http
PATCH /api/ai-catalog/{id}/
```

Delete:

```http
DELETE /api/ai-catalog/{id}/
```

## 5. AI katalog fieldlari

```json
{
  "id": 1,
  "name": "Gortenziya Mix savat",
  "arrangement_type": "basket",
  "quantity": 1,
  "volume": "large",
  "price": "1200000.00",
  "note": "Mijozga ko'rinadigan izoh",
  "image_url": "https://...",
  "instagram_link": "https://...",
  "is_active": true,
  "created_at": "2026-08-20T...",
  "updated_at": "2026-08-20T...",
  "created_by": 1
}
```

`arrangement_type` qiymatlari:

```text
bouquet
basket
box
other
```

## 6. AI katalog totals

`GET /api/ai-catalog/` response ichida `totals` ham bor:

```json
{
  "totals": {
    "items": 0,
    "quantity_total": 0,
    "value_total": "0.00",
    "active": 0,
    "inactive": 0,
    "by_arrangement_type": {}
  }
}
```

Dashboard yoki list headerda ishlatish mumkin.

## 7. Frontend page tavsiyasi

CRM katalog page:

- Tab 1: Sotuvda
- Tab 2: Sotilgan
- Tab 3: Arxiv
- Ichida alohida section: Standart katalog
- Ichida alohida section: Maxsus katalog

AI katalog page:

- Alohida menu bo'lsin: AI Katalog
- Bu page faqat AI mijozlarga ko'rsatadigan mahsulotlar uchun
- Oddiy CRM katalog bilan aralashtirilmasin
- Create formda quyidagilar bo'lsin: nomi, turi, soni, hajmi, narxi, izoh, rasm link, Instagram link, active toggle

## 8. Muhim qoida

Oddiy katalog `/api/catalog/` - CRM ichki sotuv, sklad, florist, sotildi/arxiv hisoblari uchun.

AI katalog `/api/ai-catalog/` - AI mijozga ko'rsatadigan alohida vitrina uchun.

Frontendda bu ikkisini aralashtirmang.
