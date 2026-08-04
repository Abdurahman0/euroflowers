# Rasxodlar sahifasi — frontend uchun

Yangi sahifa: **Rasxodlar**. Faqat qo'lda kiritiladi — sotuv, sklad yoki katalog bilan
bog'lanmaydi. Har bir qatorda: qancha pul ketdi, qayerga ketdi, izoh va sana.

Backend tayyor, serverda ishlayapti. Sahifa kaliti: `expenses`.

---

## 1. Ruxsat

`/api/me/` javobidagi `permissions` ro'yxatiga yangi qator qo'shildi:

```json
{ "page": "expenses", "label": "Rasxodlar", "can_view": true, "can_control": true }
```

- `can_view` — sahifani ko'radi (ro'yxat, yig'indi)
- `can_control` — qo'shadi, tahrirlaydi, o'chiradi

Ruxsati yo'q foydalanuvchiga `403` qaytadi. Menyuda sahifani `can_view` bo'yicha
ko'rsating. Adminlar va developerlarga ruxsat avtomatik ochilgan.

---

## 2. Endpointlar

| Metod | URL | Vazifasi |
|---|---|---|
| GET | `/api/expenses/` | Ro'yxat (filtr, qidiruv, sahifalash) |
| POST | `/api/expenses/` | Yangi rasxod |
| GET | `/api/expenses/{id}/` | Bitta rasxod |
| PATCH | `/api/expenses/{id}/` | Tahrirlash |
| DELETE | `/api/expenses/{id}/` | O'chirish |
| GET | `/api/expenses/summary/` | Yig'indi (sahifa tepasidagi kartochkalar) |
| GET | `/api/expenses/categories/` | Tanlov ro'yxatlari (tur, to'lov usuli) |

---

## 3. Maydonlar

### Yuboriladigan maydonlar (POST / PATCH)

| Maydon | Turi | Majburiy | Izoh |
|---|---|---|---|
| `amount` | decimal (string) | **ha** | Summa, 0 dan katta bo'lishi shart |
| `destination` | string (200) | **ha** | **Qayerga ketdi** — bo'sh bo'lmasin |
| `category` | enum | yo'q | Sukut: `other` |
| `note` | text | yo'q | Izoh |
| `payment_method` | enum | yo'q | Sukut: `cash` |
| `spent_at` | datetime | yo'q | **Yuborilmasa hozirgi vaqt qo'yiladi** |
| `branch` | id | yo'q | Filial. Bo'sh = asosiy |

`created_by` avtomatik to'ldiriladi (kim kiritgani), yuborilmaydi.

### Javobda qo'shimcha keladigan maydonlar (faqat o'qish)

| Maydon | Izoh |
|---|---|
| `category_label` | Tur nomi o'zbekcha — "Ijara", "Transport / dastafka" |
| `payment_method_label` | "Naqd" / "Karta" / "O'tkazma" |
| `branch_name` | Filial nomi, bo'lmasa "Asosiy" |
| `created_by_detail` | Kim kiritgani (to'liq user obyekti) |
| `created_at`, `updated_at` | Yozuv vaqti |

Barcha sana-vaqtlar **+05:00** da keladi, alohida konvertatsiya kerak emas.

### Tur (`category`)

`/api/expenses/categories/` dan oling, qattiq yozib qo'ymang:

| value | label |
|---|---|
| `rent` | Ijara |
| `utilities` | Kommunal (svet, suv, gaz) |
| `salary` | Oylik / avans |
| `transport` | Transport / dastafka |
| `supplies` | Xo'jalik mollari |
| `marketing` | Reklama |
| `tax` | Soliq / yig'im |
| `repair` | Ta'mirlash |
| `food` | Oshxona |
| `other` | Boshqa |

### To'lov usuli (`payment_method`)

`cash` — Naqd · `card` — Karta · `transfer` — O'tkazma

---

## 4. Forma

Qo'shish formasi 4 ta majburiy bo'lmagan qadamdan iborat, faqat 2 tasi shart:

```
Summa *            [ 150 000 ]              -> amount
Qayerga ketdi *    [ Kuryerga ]             -> destination
Turi               [ Transport / dastafka ] -> category   (dropdown)
To'lov usuli       [ Naqd ]                 -> payment_method (dropdown, default naqd)
Sana               [ ____ ]                 -> spent_at  (bo'sh qoldirilsa hozirgi vaqt)
Izoh               [ Chilonzorga dastafka ] -> note (textarea)
```

**Sana maydoni bo'sh bo'lishi kerak** — foydalanuvchi tegmasa backend o'zi hozirgi
vaqtni qo'yadi. Sanani belgilasa (kecha, o'tgan hafta) o'sha vaqt saqlanadi.
Datetime yuboring: `2026-08-01T10:00:00+05:00`. Faqat sana bo'lsa `T00:00:00+05:00`
qo'shib yuboring.

### POST namunasi

```http
POST /api/expenses/
{
  "amount": "150000",
  "destination": "Kuryerga",
  "category": "transport",
  "note": "Chilonzorga dastafka",
  "payment_method": "cash"
}
```

Javob `201`:

```json
{
  "id": 3,
  "amount": "150000.00",
  "category": "transport",
  "category_label": "Transport / dastafka",
  "destination": "Kuryerga",
  "note": "Chilonzorga dastafka",
  "payment_method": "cash",
  "payment_method_label": "Naqd",
  "spent_at": "2026-08-04T17:36:49.089499+05:00",
  "branch": null,
  "branch_name": "Asosiy",
  "created_by": 1,
  "created_by_detail": { "id": 1, "username": "admin", "...": "..." },
  "created_at": "2026-08-04T17:36:49.089742+05:00"
}
```

### Xatolar

| Holat | Javob |
|---|---|
| `destination` bo'sh | `400 {"destination": ["Pul qayerga ketganini yozing"]}` |
| `amount` 0 yoki manfiy | `400 {"amount": ["Summa noldan katta bo'lishi kerak"]}` |
| Ruxsat yo'q | `403 {"detail": "Sizda bu sahifa uchun ruxsat yo'q."}` |

---

## 5. Ro'yxat

```
GET /api/expenses/?date_from=2026-08-01&date_to=2026-08-31&category=rent&page=1&page_size=20
```

| Parametr | Vazifasi |
|---|---|
| `date_from`, `date_to` | `YYYY-MM-DD`, **sarflangan sana** (`spent_at`) bo'yicha |
| `category` | Tur bo'yicha |
| `payment_method` | Naqd / karta / o'tkazma |
| `branch` | Filial id |
| `created_by` | Kim kiritgani |
| `min_amount`, `max_amount` | Summa oralig'i |
| `search` | `destination` va `note` ichidan qidiradi |
| `ordering` | `-spent_at` (sukut), `spent_at`, `amount`, `-amount`, `created_at` |
| `page`, `page_size` | Sahifalash |

Sukut bo'yicha **eng oxirgi rasxod birinchi** chiqadi.

### Jadval ustunlari (tavsiya)

| Sana | Turi | Qayerga ketdi | Summa | To'lov | Izoh | Kim kiritdi | ⋯ |
|---|---|---|---|---|---|---|---|
| `spent_at` (kun.oy.yil soat:daqiqa) | `category_label` (rangli chip) | `destination` | `amount` | `payment_method_label` | `note` (qisqartirib) | `created_by_detail.first_name` | tahrir / o'chirish |

---

## 6. Yig'indi — sahifa tepasidagi kartochkalar

```
GET /api/expenses/summary/?date_from=2026-08-01&date_to=2026-08-31
```

Filtr parametrlari ro'yxatdagi bilan bir xil ishlaydi (`category`, `search`, `branch` ham).

```json
{
  "period": { "date_from": "2026-08-01", "date_to": "2026-08-31" },
  "totals": { "expense_count": 12, "total": "4350000.00", "average": "362500.00" },
  "by_category": [
    { "category": "rent", "label": "Ijara", "count": 1, "total": "2500000.00" },
    { "category": "transport", "label": "Transport / dastafka", "count": 8, "total": "1200000.00" }
  ],
  "by_payment_method": [
    { "payment_method": "cash", "label": "Naqd", "count": 9, "total": "3150000.00" },
    { "payment_method": "card", "label": "Karta", "count": 3, "total": "1200000.00" }
  ],
  "by_day": [
    { "date": "2026-08-04", "count": 2, "total": "200000.00" },
    { "date": "2026-08-01", "count": 1, "total": "2500000.00" }
  ]
}
```

Ko'rinishi:

- **Jami rasxod** — `totals.total`
- **Nechta yozuv** — `totals.expense_count`
- **O'rtacha** — `totals.average`
- **Turlar bo'yicha** — `by_category` (donut yoki gorizontal bar, kattadan kichikka)
- **Kunlar bo'yicha** — `by_day` (chiziqli grafik; oxirgi kun tepada keladi, grafik uchun teskarisiga o'giring)

---

## 7. Hisob-kitob sahifasi bilan bog'liqlik

`/api/accounting/` javobiga rasxod alohida qo'shildi. **Eski `net_profit` o'zgarmadi** —
u avvalgidek sotuv foydasi. Yoniga yangi maydonlar keldi:

`summary` va `by_branch` ichidagi har bir qatorda:

| Maydon | Izoh |
|---|---|
| `expense_total` | Shu davrdagi rasxodlar yig'indisi |
| `expense_count` | Nechta rasxod |
| `net_profit_after_expenses` | `net_profit - expense_total` |

Javobning yuqori qismida yana bittasi bor:

```json
"expenses_by_category": [
  { "category": "rent", "label": "Ijara", "count": 1, "total": "2500000.00" }
]
```

Rasxodlar hisob-kitobdagi **sana filtri** va **filial filtri** bo'yicha ham
filtrlanadi (rasxodga filial belgilangan bo'lsa o'sha filialga tushadi).

Hisob-kitob sahifasida shunday ko'rsatish tavsiya qilinadi:

```
Savdo                  12 400 000
Tannarx               - 6 900 000
Chiqit                -   300 000
--------------------------------
Sof foyda                5 200 000     <- net_profit (eski maydon, o'zgarmagan)
Rasxodlar             - 4 350 000      <- expense_total (yangi)
--------------------------------
Rasxoddan keyingi foyda    850 000     <- net_profit_after_expenses (yangi)
```

---

## 8. Diqqat qilinadigan joylar

1. **Sana bo'sh qolsa** backend hozirgi vaqtni qo'yadi — frontend o'zi `new Date()`
   yuborishi shart emas, aksincha bo'sh qoldirgani ma'qul.
2. `amount` **string** bo'lib keladi (`"150000.00"`) — ko'rsatishdan oldin formatlang.
3. Tur va to'lov usuli ro'yxatini `/api/expenses/categories/` dan oling — keyinchalik
   yangi tur qo'shilsa frontend o'zgarmasdan ishlayveradi.
4. `date_from` / `date_to` **sarflangan sana** bo'yicha ishlaydi, yozuv kiritilgan
   sana bo'yicha emas. Ya'ni bugun kiritilgan, sanasi 1-avgust qilingan rasxod
   avgust hisobotiga tushadi.
5. O'chirish `204` qaytaradi, tasdiq oynasini frontendda qo'ying.
