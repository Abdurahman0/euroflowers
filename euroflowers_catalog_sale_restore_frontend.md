# EuroFlowers Frontend Update — Katalog Sotuvni Qaytarish

## Maqsad

Katalog mahsuloti xato `sotildi` qilib yuborilsa, endi sotilganlardan qaytarish mumkin.

Backend sotuvni qaytarganda:

- katalog `quantity_sold` kamayadi
- agar sotuv to‘liq qaytarilsa, `sold` history hisob-kitobdan chiqadi
- alohida `sale_restored` history yoziladi
- katalog yana qoldiq bo‘lsa `available` bo‘ladi
- sotuv vaqtida qo‘shimcha material ishlatilgan bo‘lsa material skladi qaytariladi
- sotuv oformleniya/florist salary yozuvi proporsional kamayadi
- qarzga sotilgan bo‘lsa debt kamayadi yoki to‘liq qaytarishda o‘chadi
- accounting/dashboard sotuv summalari avtomatik to‘g‘ri kamayadi

## API

```http
POST /api/catalog/{catalog_id}/restore-sale/
```

Auth kerak.
Katalog page write permission kerak.

## Request

Barcha fieldlar optional.

```json
{
  "sale_history": 123,
  "quantity": 1,
  "reason": "Xato sotildi qilingan"
}
```

Fieldlar:

- `sale_history` — sotuv history id. Berilmasa backend shu katalogning oxirgi sotuvini qaytaradi.
- `quantity` — nechta dona qaytariladi. Berilmasa tanlangan/oxirgi sotuv to‘liq qaytariladi.
- `reason` — qaytarish sababi. Optional, lekin UI’da yozdirish tavsiya qilinadi.

## Response

Success bo‘lsa backend yangilangan katalog detail qaytaradi.

```json
{
  "id": 10,
  "name_uz": "Pion Buketi",
  "status": "available",
  "quantity_total": 3,
  "quantity_sold": 1,
  "quantity_remaining": 2,
  "history": []
}
```

## Xatolar

```json
{
  "detail": "Qaytariladigan sotuv topilmadi"
}
```

Yoki:

```json
{
  "detail": "Bu sotuvda atigi 1 ta bor"
}
```

Frontend `detail`ni toast/modalda chiqarishi kerak.

## Frontend UI Tavsiya

Sotilganlar ro‘yxatida har bir sale row’da `Qaytarish` action bo‘lsin.

Flow:

1. User sotilganlar ichida bitta sotuvni tanlaydi.
2. `Qaytarish` bosadi.
3. Modal ochiladi.
4. Agar `quantity > 1` bo‘lsa, nechta qaytarishni so‘raydi.
5. Sabab field bo‘ladi.
6. Confirm bosilganda API chaqiriladi.
7. Successdan keyin katalog detail, sotuvlar ro‘yxati va hisob-kitob/dashboard refetch qilinadi.

## Sotilganlar Ro‘yxati Bilan Ishlash

`GET /api/catalog/sales/` response’dagi har bir row `id` qaytaradi.
Shu `id` restore API’dagi `sale_history`ga yuboriladi.

Misol:

```json
{
  "sale_history": 555,
  "quantity": 1,
  "reason": "Operator xato bosgan"
}
```

## Muhim Eslatma

Katalog sotilganda gul skladdan qayta minus qilinmaydi, chunki gul katalog yaratilganda allaqachon skladdan ayrilgan.
Shuning uchun sotuvni qaytarish gul batch qoldig‘iga tegmaydi, faqat katalogdagi sotilgan miqdorni sotuvga qaytaradi.

Qo‘shimcha materiallar esa sotuv paytida alohida yechilgan bo‘lsa, qaytarishda material skladga qaytadi.
