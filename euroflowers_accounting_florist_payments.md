# EuroFlowers Frontend Update — Hisob-kitob va Florist To‘lovlari

## Backend deploy

Backend deploy qilingan.

Yangi commit:

`76b3b72 Add florist payments to accounting`

## 1. Yangi API — floristga pul berish

Floristga real pul berilganda shu endpoint ishlatiladi.

### List

`GET /api/florist-payments/`

Query params:

`page`, `page_size`, `ordering`, `florist`, `method`, `paid_at`, `search`

`ordering` misollar:

`-paid_at`, `paid_at`, `-amount`, `amount`, `-created_at`

### Create

`POST /api/florist-payments/`

Payload:

```json
{
  "florist": 1,
  "amount": "150000.00",
  "paid_at": "2026-08-20",
  "method": "cash",
  "note": "Oy oxiri uchun berildi"
}
```

`method` qiymatlari:

`cash` — Naqd

`card` — Karta

`transfer` — O‘tkazma

### Update/Delete

`PATCH /api/florist-payments/{id}/`

`DELETE /api/florist-payments/{id}/`

Admin yoki supervisor ishlata oladi.

## 2. Hisob-kitob API yangi statslar

`GET /api/accounting/?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD`

`summary` ichiga yangi fieldlar qo‘shildi:

```json
{
  "total_sales": "367412299.00",
  "sales_cash_total": "245726777.00",
  "sales_card_total": "121685522.00",
  "sales_other_total": "0.00",
  "cash_total": "246703999.00",
  "card_total": "126540300.00",
  "received_total": "373244299.00",
  "net_profit": "46769663.00",
  "net_profit_after_expenses": "45752663.00",
  "supplier_purchase_total": "309699015.00",
  "supplier_paid_total": "0.00",
  "supplier_debt_total": "309699015.00",
  "supplier_overpaid_total": "0.00",
  "florist_accrued_total": "34320000.00",
  "florist_paid_total": "0.00",
  "florist_balance_total": "34320000.00",
  "expense_total": "1017000.00",
  "owner_take_home": "372227299.00",
  "cashflow_balance": "372227299.00"
}
```

## 3. Statslarni frontendda qanday ko‘rsatish kerak

Hisob-kitob page tepasida 2 ta blok qiling.

### Moliyaviy foyda

`total_sales` — Umumiy sotuv

`sales_cash_total` — Sotuvdan naqd

`sales_card_total` — Sotuvdan karta

`sales_other_total` — Sotuvdan boshqa

`net_profit` — Sof foyda

`net_profit_after_expenses` — Rasxodlardan keyingi foyda

### Real kassa / owner

`received_total` — Jami tushum

`supplier_paid_total` — Postavshiklarga to‘langan

`supplier_debt_total` — Postavshik qarzi

`florist_accrued_total` — Floristlarga hisoblangan

`florist_paid_total` — Floristlarga berilgan

`florist_balance_total` — Floristlarga qolgan qarz

`expense_total` — Boshqa rasxodlar

`owner_take_home` — Egaga qoladigan pul

## 4. Muhim formula

`net_profit` bu biznes foydasi:

```text
sof foyda = sotuv - tannarx - chiqit
```

`owner_take_home` bu owner real olib qolishi mumkin bo‘lgan pul:

```text
egaga qoladigan pul = jami tushum - postavshiklarga to‘langan - floristlarga berilgan - rasxodlar
```

Bu ikki fieldni aralashtirmang.

## 5. UI tavsiya

Florist detail yoki Hisob-kitob page ichida “Floristga pul berish” button qo‘shing.

Modal fieldlar:

`Florist` select

`Summa`

`Sana`

`To‘lov turi` select

`Izoh`

Save bo‘lgandan keyin:

`/api/florist-payments/` refetch

`/api/accounting/` refetch

## 6. Tekshirish

Backend real DBda tekshirildi:

`sales_split_ok True`

`owner_formula_ok True`

`florist_balance_ok True`

