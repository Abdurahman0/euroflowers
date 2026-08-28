# EuroFlowers Frontend Update — 2026-08-28

## 1. Katalog sotishdagi to'lov turi

Katalog `sell` API endi `terminal` payment type qabul qiladi.

Endpoint:

```http
POST /api/catalog/{id}/sell/
```

`payment_type` qiymatlari:

```ts
type PaymentType = "cash" | "card" | "terminal" | "mixed" | "debt";
```

Terminal bilan sotish payload namunasi:

```json
{
  "quantity": 1,
  "sale_price": "250000",
  "payment_type": "terminal",
  "sale_image": "<file optional>"
}
```

Aralash to'lov avvalgidek ishlaydi:

```json
{
  "quantity": 1,
  "sale_price": "250000",
  "payment_type": "mixed",
  "cash_amount": "100000",
  "card_amount": "150000"
}
```

`terminal` uchun `cash_amount` va `card_amount` yuborilmaydi.

## 2. Sotilganlar tarixi

`GET /api/catalog/sales/` response ichida payment label terminal uchun alohida qaytadi.

```json
{
  "payment_type": "terminal",
  "payment_label": "Terminal"
}
```

Filter ham qo'shildi:

```http
GET /api/catalog/sales/?payment_type=terminal
```

Qo'llab-quvvatlanadigan filterlar:

```text
cash, card, terminal, debt, unknown
```

## 3. Totals va hisobotlar

Katalog sales totals ichida yangi field bor:

```json
{
  "terminal_total": "250000.00"
}
```

Hisob-kitob/dashboard/excel stats ichida ham terminal alohida hisoblanadi. Endi terminal tushum `boshqa` ichiga qo'shilib ketmaydi.

Dashboard Excel stats `SOVDA` qatorlarida yangi ustun:

```text
terminal
```

Totals ichida:

```json
{
  "terminal": "..."
}
```

## 4. Delivery location notification

Frontendda o'zgarish shart emas. Backend xaritadan yuborilgan manzilni operator Telegram guruhiga yuborishda retry va duplicate protection qo'shdi.

Natija:

- Telegram vaqtincha connection reset bersa backend 3 marta qayta urinadi.
- Bir xil koordinata oldin yuborilgan bo'lsa, qayta yuborilmaydi.
- Mijoz pinni boshqa joyga ko'chirsa, location yangilangan deb qayta yuboriladi.
