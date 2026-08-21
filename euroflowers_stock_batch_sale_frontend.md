# EuroFlowers Frontend Update - Sklad Partiyadan Dona Sotish

Sana: 2026-08-21
Backend: https://euroflowers.api.cognilabs.org/api

## 1. Yangi API

Sklad partiyasidan gulni dona qilib alohida sotish uchun yangi endpoint qo'shildi.

```http
POST /api/stock-batches/{batch_id}/sell/
```

Auth kerak.

Permission: inventory control.

## 2. Request body

Naqd:

```json
{
  "quantity_stems": 5,
  "sale_amount": "250000",
  "payment_type": "cash",
  "reason": "Do'kondan dona sotildi"
}
```

Karta:

```json
{
  "quantity_stems": 5,
  "sale_amount": "250000",
  "payment_type": "card",
  "reason": "Do'kondan dona sotildi"
}
```

Aralash:

```json
{
  "quantity_stems": 5,
  "sale_amount": "250000",
  "payment_type": "mixed",
  "cash_amount": "100000",
  "card_amount": "150000",
  "reason": "Do'kondan dona sotildi"
}
```

Tarixiy sana bilan sotish:

```json
{
  "quantity_stems": 5,
  "sale_amount": "250000",
  "payment_type": "cash",
  "sold_at": "2026-08-21T18:00:00+05:00",
  "reason": "Kecha sotilgan gul"
}
```

## 3. Fieldlar

`quantity_stems` majburiy. Nechta dona gul sotilgani.

`sale_amount` majburiy. Umumiy sotilgan summa. Frontend dona narxni o'zi hisoblab ko'rsatishi mumkin, lekin backendga umumiy summa yuboriladi.

`payment_type` optional, lekin UI’da tanlash tavsiya qilinadi.

Qiymatlar:

```text
cash
card
debt
mixed
```

`cash_amount` va `card_amount` faqat `payment_type=mixed` bo'lganda yuboriladi.

`reason` optional.

`sold_at` optional.

## 4. Validation

Backend qoldiqni tekshiradi.

Agar partiyada yetarli gul bo'lmasa:

```json
{
  "detail": "Skladda yetarli gul yo'q. Kerak: 10, bor: 4"
}
```

Mixed paymentda backend tekshiradi:

```text
cash_amount + card_amount == sale_amount
```

Teng bo'lmasa:

```json
{
  "detail": "Naqd va karta yig'indisi sotuv summasiga teng emas. Sotuv: 250000.00, kiritilgan: 240000.00"
}
```

## 5. Response

Response `StockMovement` qaytadi.

Muhim fieldlar:

```json
{
  "id": 123,
  "batch": 45,
  "movement_type": "out",
  "quantity_stems": -5,
  "quantity_bunches": "-0.20",
  "unit_price": "50000.00",
  "sale_amount": "250000.00",
  "payment_type": "mixed",
  "cash_amount": "100000.00",
  "card_amount": "150000.00",
  "reference_type": "stock_sale",
  "reason": "Do'kondan dona sotildi",
  "batch_detail": {}
}
```

`quantity_stems` chiqim bo'lgani uchun minus qaytadi.

`unit_price` backendda avtomatik hisoblanadi:

```text
sale_amount / quantity_stems
```

## 6. Sklad harakati jurnalida filter

Stock movement API’da endi quyidagilar bilan filter qilish mumkin:

```http
GET /api/stock-movements/?reference_type=stock_sale
GET /api/stock-movements/?payment_type=cash
GET /api/stock-movements/?payment_type=card
GET /api/stock-movements/?payment_type=mixed
GET /api/stock-movements/?reference_type=stock_sale&created_at_after=2026-08-01T00:00:00+05:00&created_at_before=2026-08-31T23:59:59+05:00
```

## 7. Stock movement totals

`GET /api/stock-movements/` totals ichida yangi fieldlar bor:

```json
{
  "totals": {
    "stock_sale_total": "250000.00",
    "stock_sale_cash_total": "100000.00",
    "stock_sale_card_total": "150000.00"
  }
}
```

Bu faqat `reference_type=stock_sale` bo'lgan sotuvlardan hisoblanadi.

## 8. UI tavsiya

Sklad partiya detailida `Sotish` button qo'shilsin.

Modal fieldlari:

- Dona soni
- Sotuv summasi
- To'lov turi
- Agar mixed bo'lsa naqd summa va karta summa
- Izoh
- Sana vaqt optional

Modalda frontend ham tekshirsin:

```text
cash_amount + card_amount == sale_amount
```

Lekin backend ham baribir tekshiradi.

## 9. Muhim

Bu katalog sotish emas.

Bu florist/katalogga chiqarmasdan, sklad partiyasidan gulni dona qilib alohida sotish uchun.

Sotilganda:

- `StockBatch.remaining_stems` kamayadi
- `StockMovement`da `reference_type=stock_sale` bilan chiqim yoziladi
- Audit log yoziladi
- Low stock holatda notification yaratiladi
