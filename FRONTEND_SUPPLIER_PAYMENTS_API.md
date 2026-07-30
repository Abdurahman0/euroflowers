# Yetkazib beruvchilar bilan hisob-kitob — Frontend API

**Sana:** 2026-07-30
**Holat:** serverda ishlayapti (`https://euroflowers.api.cognilabs.org`)
**Migratsiya:** `0082_supplier_payment`
**Testlar:** 129 ta o'tadi

Barcha endpointlar JWT talab qiladi. Ruxsat sahifasi — `suppliers`.
Yozish huquqi: `admin`, `warehouse`.

---

## 1. Yangi resurs — `/api/supplier-payments/`

To'liq CRUD: `GET` `POST` `PATCH` `DELETE`.

### POST tanasi

```json
{
  "supplier": 3,
  "amount": "5000000.00",
  "paid_at": "2026-07-29",
  "method": "cash",
  "note": "Iyul oyi uchun"
}
```

| Maydon | Tur | Majburiy | Izoh |
|---|---|---|---|
| `supplier` | integer | ha | Supplier `id` |
| `amount` | decimal string | ha | Noldan katta bo'lishi shart |
| `paid_at` | date `YYYY-MM-DD` | yo'q | Sukut bo'yicha bugungi sana |
| `method` | enum | yo'q | `cash` \| `card` \| `transfer`, sukut `cash` |
| `note` | string | yo'q | Erkin izoh |

### Javob

So'ralganidan tashqari uchta qulaylik maydoni qo'shildi:

```json
{
  "id": 1,
  "supplier": 3,
  "amount": "5000000.00",
  "paid_at": "2026-07-29",
  "method": "cash",
  "method_label": "Naqd",
  "note": "Iyul oyi uchun",
  "supplier_detail": { "id": 3, "name": "Gul Import", "phone": "+998901112233" },
  "created_by_detail": { "id": 1, "username": "admin", "first_name": "Admin", "last_name": "EuroFlowers" },
  "created_at": "2026-07-30T10:12:03+05:00",
  "updated_at": "2026-07-30T10:12:03+05:00"
}
```

- `method_label` — tayyor o'zbekcha yorliq: `Naqd` / `Karta` / `O'tkazma`.
  Frontend'da alohida map yozish shart emas.
- `supplier_detail` — ro'yxatda postavshik nomini ko'rsatish uchun.
  Alohida `GET /api/suppliers/{id}/` so'rovi kerak emas.
- `created_by_detail` — to'lovni kim kiritganini ko'rsatish uchun.

### Filtr, qidiruv, tartib

```
GET /api/supplier-payments/?supplier=3
GET /api/supplier-payments/?method=cash
GET /api/supplier-payments/?paid_at=2026-07-29
GET /api/supplier-payments/?search=iyul
GET /api/supplier-payments/?ordering=-paid_at
```

- **Filtr:** `supplier`, `method`, `paid_at`
- **Qidiruv:** `search` — izoh va postavshik nomi bo'yicha
- **Tartib:** `paid_at`, `amount`, `created_at`
- **Sukut tartib:** yangi to'lov birinchi (`-paid_at`, `-id`)
- **Sahifalash:** standart `count` / `next` / `previous` / `results`

### Validatsiya va xatolar

| Holat | Kod | Javob |
|---|---|---|
| `amount` ≤ 0 | `400` | `{"amount": ["To'lov summasi noldan katta bo'lishi kerak."]}` |
| `supplier` mavjud emas | `400` | standart DRF xatosi |
| Token yo'q | `401` | — |
| Ruxsat yo'q | `403` | `{"detail": "Sizda bu sahifa uchun ruxsat yo'q."}` |

To'lov yaratilishi audit log'ga yoziladi — `supplierpayment_created`.

---

## 2. Supplier obyektidagi rollup maydonlar

`GET /api/suppliers/` va `GET /api/suppliers/{id}/` javobiga qo'shildi.
Hammasi **read-only**.

```json
{
  "id": 3,
  "name": "Gul Import",
  "phone": "+998901112233",
  "is_active": true,
  "batches_count": 4,
  "total_received_stems": 1250,

  "purchase_total": "2500000.00",
  "paid_total": "700000.00",
  "outstanding": "1800000.00",
  "last_payment_at": "2026-07-30"
}
```

| Maydon | Hisoblanishi |
|---|---|
| `purchase_total` | Σ (`received_stems` × `cost_per_stem`) — postavshikning barcha partiyalari bo'yicha |
| `paid_total` | Σ (`SupplierPayment.amount`) |
| `outstanding` | `purchase_total` − `paid_total` — ya'ni qarz |
| `last_payment_at` | Oxirgi to'lov sanasi, to'lov bo'lmasa `null` |

`last_payment_at` so'rovda yo'q edi, «oxirgi marta qachon to'langan» ustuni uchun
qo'shdim.

### Ishlash tezligi

Maydonlar `Subquery` bilan hisoblanadi — **N+1 muammosi yo'q**.
100 ta postavshik ham bitta SQL so'rovda keladi.

### Saralash

Rollup maydonlari bo'yicha ham saralash mumkin:

```
GET /api/suppliers/?ordering=-outstanding     # eng ko'p qarzdorlar birinchi
GET /api/suppliers/?ordering=-purchase_total
GET /api/suppliers/?ordering=last_payment_at  # eng uzoq to'lanmaganlar
```

### Tekshirilgan misol

Serverda real ma'lumot bilan sinaldi:

```
partiya: received_stems = 250, cost_per_stem = 10 000
to'lovlar: 500 000 (cash) + 200 000 (transfer)

purchase_total  = 2 500 000
paid_total      =   700 000
outstanding     = 1 800 000
last_payment_at = 2026-07-30
```

---

## 3. Sotuv tannarxi uchga ajratildi

Ilgari bitta yig'ma `cost_total` bor edi, frontend o'zi qayta hisoblardi.
Endi backend ajratib beradi.

### `/api/accounting/` → `summary`

```json
{
  "cost_total": "885000.00",
  "flower_cost_total": "875000.00",
  "material_cost_total": "0.00",
  "florist_fee_cost_total": "10000.00",
  "net_profit": "615000.00"
}
```

### `/api/accounting/` → `history[]` har bir qatorda

```json
{
  "catalog_name": "Oq buket",
  "quantity": 1,
  "sale_total": "1500000.00",
  "cost_total": "885000.00",
  "flower_cost": "875000.00",
  "material_cost": "0.00",
  "florist_fee_cost": "10000.00",
  "net_profit": "615000.00"
}
```

| Maydon | Nima |
|---|---|
| `flower_cost` | Gul tannarxi — Σ (dona × `cost_per_stem`) |
| `material_cost` | Qadoq va material tannarxi — Σ (soni × `packaging.cost_price`) |
| `florist_fee_cost` | Florist haqi |

**Muhim:** yaxlitlash farqi gul tannarxiga qo'shiladi, shuning uchun

```
flower_cost + material_cost + florist_fee_cost === cost_total
```

har doim aniq teng. Frontend'da tekshirish yoki tuzatish shart emas.

---

## 4. Chiqit puli backendda hisoblanadi

### `/api/accounting/` → `summary`

```json
{
  "waste_cost_total": "1450000.00",
  "waste_stems": 145
}
```

Tanlangan davr uchun `movement_type = "waste"` harakatlari bo'yicha
Σ (dona × `cost_per_stem`).

### `/api/stock-movements/` har bir qatorda

```json
{
  "id": 161,
  "movement_type": "out",
  "quantity_stems": -125,
  "cost_value": "4375000.00",
  "sale_value": "7500000.00"
}
```

| Maydon | Nima |
|---|---|
| `cost_value` | \|dona\| × `batch.cost_per_stem` — tannarx bo'yicha qiymat |
| `sale_value` | \|dona\| × `batch.sale_price_per_stem` — sotuv narxi bo'yicha qiymat |

`sale_value` so'rovda yo'q edi. Chiqit bo'yicha «qancha daromad yo'qoldi»
ko'rsatmoqchi bo'lsangiz asqotadi.

Ikkalasi ham barcha harakat turlarida hisoblanadi (`in`, `out`, `adjustment`,
`waste`, `transfer_in`, `transfer_out`), faqat chiqitda emas.

### `/api/inventory-movements/` qatorlarida

```json
{
  "batch_id": 18,
  "batch_number": "EF-260725-23",
  "supplier_name": "Gul Import",
  "waste_stems": 12,
  "waste_cost_value": "120000.00",
  "total_out_stems": 137,
  "total_out_cost_value": "1370000.00"
}
```

---

## E'tibor beriladigan joy

`SupplierPayment.supplier` da `on_delete=PROTECT`.

Ya'ni **to'lovi bor postavshikni o'chirib bo'lmaydi**. `DELETE /api/suppliers/{id}/`
bunday holatda xato qaytaradi. Frontend'da bu xatoni ushlab
«Avval bu postavshikning to'lovlarini o'chiring» degan xabar ko'rsatish kerak.

Agar postavshik bilan birga to'lovlari ham o'chib ketishi kerak bo'lsa —
`CASCADE` ga o'zgartiriladi, aytsangiz bo'ladi.

---

## Qisqa xulosa

| So'rov | Holat |
|---|---|
| `/api/supplier-payments/` CRUD | ✅ tayyor |
| `purchase_total` | ✅ tayyor |
| `paid_total` | ✅ tayyor |
| `outstanding` | ✅ tayyor |
| Har sotuvda `{flower_cost, material_cost, florist_fee_cost}` | ✅ tayyor |
| Chiqitda `cost_value` va `waste_cost_total` | ✅ tayyor |

Qo'shimcha ravishda berilgan: `method_label`, `supplier_detail`,
`created_by_detail`, `last_payment_at`, `sale_value`, `waste_stems`,
`total_out_cost_value` va rollup maydonlari bo'yicha saralash.
