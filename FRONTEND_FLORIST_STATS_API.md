# Florist statistikasi, dashboard va Excel eksport — Frontend API

**Sana:** 2026-07-30
**Holat:** serverda ishlayapti (`https://euroflowers.api.cognilabs.org`)
**Migratsiya:** `0083_ai_prompt_no_florist_fee`
**Testlar:** 133 ta o'tadi

Uchta joy bir xil ma'lumot strukturasini qaytaradi — admin uchun florist detali,
floristning o'z dashboardi va Excel eksport. Frontend'da bitta komponent yozib
ikkalasida ishlatish mumkin.

---

## 1. `GET /api/florists/{id}/stats/`

Admin va supervisor uchun. Ruxsat sahifasi — `florists`.

**Query parametrlar:**

| Parametr | Format | Izoh |
|---|---|---|
| `date_from` | `YYYY-MM-DD` | Ixtiyoriy. Berilmasa boshidan |
| `date_to` | `YYYY-MM-DD` | Ixtiyoriy. Berilmasa bugungacha |

Filtr `work_date` bo'yicha ishlaydi, ya'ni ish haqi qaysi kunga yozilganiga qarab.

```
GET /api/florists/5/stats/?date_from=2026-07-01&date_to=2026-07-31
```

## 2. `GET /api/florists/me/dashboard/`

Floristning o'zi uchun. Xuddi shu struktura, faqat `id` kerak emas —
token'dan aniqlanadi. Query parametrlar bir xil.

Florist profili topilmasa `404`.

---

## Javob strukturasi

```json
{
  "florist": {
    "id": 5,
    "name": "Abubakir Toshmatov",
    "username": "abubakir",
    "staff_type": "florist",
    "staff_type_label": "Florist",
    "phone": "+998901112233",
    "daily_pay": "0",
    "is_active": true
  },
  "period": { "date_from": "2026-07-01", "date_to": "2026-07-31" },
  "summary": { ... },
  "by_source": [ ... ],
  "by_arrangement": [ ... ],
  "by_volume": [ ... ],
  "by_day": [ ... ],
  "salary_entries": [ ... ],
  "attendance": [ ... ]
}
```

### `summary` — yuqoridagi kartochkalar uchun

```json
{
  "salary_total": "150000.00",
  "salary_entries_count": 2,
  "catalog_salary_total": "150000.00",
  "daily_salary_total": "0",
  "manual_salary_total": "0",
  "catalog_count": 1,
  "bouquet_count": 1,
  "basket_count": 0,
  "standard_count": 1,
  "custom_count": 0,
  "sold_quantity": 1,
  "unsold_quantity": 0,
  "sale_revenue": "1500000.00",
  "avg_fee_per_item": "150000.00",
  "attendance_days": 0
}
```

| Maydon | Nima |
|---|---|
| `salary_total` | Davr uchun jami olgan puli |
| `catalog_salary_total` | Katalog mahsulotlari uchun olgani |
| `daily_salary_total` | Kunlik ish haqi, shogirdlar uchun |
| `manual_salary_total` | Qo'lda qo'shilgan summalar |
| `catalog_count` | Yasagan mahsulot soni |
| `bouquet_count` / `basket_count` | Buket va savat soni |
| `standard_count` / `custom_count` | Standart va custom katalog soni |
| `sold_quantity` | Uning mahsulotlaridan nechtasi sotilgan |
| `unsold_quantity` | Hali sotilmagani |
| `sale_revenue` | Uning mahsulotlari sotuvidan tushgan real summa |
| `avg_fee_per_item` | Bitta mahsulotga o'rtacha haq |
| `attendance_days` | Ishga kelgan kunlari |

`sale_revenue` — `CatalogHistory` dagi haqiqiy sotuv narxidan hisoblanadi,
katalogdagi ko'rsatilgan narxdan emas. Ya'ni chegirma bilan sotilgan bo'lsa
real tushgan summa chiqadi.

### `by_day` — kunlar bo'yicha grafik uchun

```json
[
  { "work_date": "2026-07-29", "count": 2, "amount": "150000.00",
    "bouquets": 1, "baskets": 0, "sold_quantity": 1, "sale_revenue": "1500000.00" }
]
```

Yangi kun birinchi. Grafik chizsangiz teskari tartibda o'qing.

### `by_volume` — hajm bo'yicha jadval uchun

```json
[
  { "arrangement_type": "bouquet", "arrangement_label": "Buket", "volume": "Katta",
    "count": 1, "amount": "50000.00", "sold_quantity": 1, "sale_revenue": "1500000.00" }
]
```

Hajmi belgilanmagan mahsulotlar `"volume": "Belgilanmagan"` bilan keladi.

### `by_arrangement` — buket va savat kesimi

```json
[
  { "arrangement_type": "bouquet", "arrangement_label": "Buket",
    "count": 1, "amount": "50000.00", "sold_quantity": 1, "sale_revenue": "1500000.00" }
]
```

### `by_source` — pul qaysi manbadan qo'shilgani

```json
[
  { "source": "catalog", "source_label": "Katalog", "count": 1, "amount": "50000.00" },
  { "source": "daily", "source_label": "Kunlik", "count": 0, "amount": "0" },
  { "source": "manual", "source_label": "Qo‘lda", "count": 1, "amount": "15000.00" }
]
```

`source` qiymatlari: `catalog`, `custom_catalog`, `daily`, `manual`.
`source_label` tayyor o'zbekcha yorliq.

### `salary_entries` — asosiy jadval

Har bir yozuvda «qachon, qancha, qanaqa hajmda, buketmi savatmi, sotildimi,
qancha tushdi» — hammasi bor.

```json
[
  {
    "id": 12,
    "work_date": "2026-07-29",
    "created_at": "2026-07-29T22:00:11+05:00",
    "source": "catalog",
    "source_label": "Katalog",
    "amount": "50000.00",
    "note": "mm uchun florist haqi",
    "added_by": "Admin EuroFlowers",

    "catalog_item_id": 41,
    "catalog_name": "Katta buket",
    "catalog_kind": "standard",
    "catalog_kind_label": "Standart",
    "arrangement_type": "bouquet",
    "arrangement_label": "Buket",
    "volume": "Katta",
    "quantity_total": 5,
    "quantity_sold": 1,
    "listed_price": "1600000.00",

    "sold_quantity": 1,
    "sale_revenue": "1500000.00",
    "last_sold_at": "2026-07-29T22:00:11+05:00",
    "is_sold": true
  }
]
```

| Maydon | Nima |
|---|---|
| `work_date` | Ish haqi qaysi kunga yozilgan |
| `created_at` | Tizimga qachon kiritilgan |
| `amount` | Floristga qo'shilgan summa |
| `added_by` | Kim qo'shdi |
| `listed_price` | Katalogdagi ko'rsatilgan narx |
| `sold_quantity` | Nechta dona sotilgan |
| `sale_revenue` | Sotuvdan real tushgan summa |
| `last_sold_at` | Oxirgi sotuv vaqti, sotilmagan bo'lsa `null` |
| `is_sold` | Sotilganmi |

Kunlik yoki qo'lda qo'shilgan yozuvlarda katalog maydonlari bo'sh bo'ladi
(`catalog_item_id: null`, `catalog_name: ""`, `arrangement_label: ""`).
Jadvalda shu holatni hisobga oling.

Yangi yozuv birinchi keladi (`-work_date`, `-id`).

### `attendance` — keldi-ketdi

```json
[
  { "id": 3, "work_date": "2026-07-29",
    "check_in_at": "2026-07-29T09:02:00+05:00",
    "check_out_at": "2026-07-29T19:10:00+05:00",
    "source": "mobile", "source_label": "Mobile", "note": "" }
]
```

---

## 3. Excel eksport

```
GET /api/exports/florist/                       # o'z hisoboti
GET /api/exports/florist/?florist=5             # admin uchun aniq florist
GET /api/exports/florist/?florist=5&date_from=2026-07-01&date_to=2026-07-31
```

`?florist=<id>` faqat `florists` sahifasiga ruxsati bor foydalanuvchida ishlaydi.
Florist o'zi parametr bermasa o'z hisobotini oladi.

Fayl nomi davr bilan keladi:
`florist_5_2026-07-01_2026-07-31.xlsx`
Davr berilmasa: `florist_5_boshidan_bugun.xlsx`

### Oltita varaq

**1. Ish haqi tarixi** — asosiy jadval, 15 ustun:

```
Sana | Qo‘shilgan vaqt | Manba | Katalog mahsuloti | Turi |
Buket yoki savat | Hajm | Soni | Sotilgan | Narxi |
Sotuvdan tushgan | Floristga qo‘shilgan | Sotilgan vaqti | Izoh | Kim qo‘shdi
```

Oxirida qalin shriftda jami summa.

**2. Umumiy** — florist ma'lumoti va 20 ta ko'rsatkich: davr, jami ish haqi,
manbalar bo'yicha taqsimot, yasagan mahsulot, buket va savat soni, standart
va custom, sotilgan va sotilmagan, sotuvdan tushgan, o'rtacha haq, ishlagan kunlar.

**3. Kunlar bo'yicha**

```
Sana | Yozuvlar | Buket | Savat | Sotilgan dona | Sotuvdan tushgan | Floristga qo‘shilgan
```

**4. Hajm bo'yicha**

```
Buket yoki savat | Hajm | Soni | Sotilgan dona | Sotuvdan tushgan | Floristga qo‘shilgan
```

**5. Manba bo'yicha**

```
Manba | Yozuvlar | Summa
```

**6. Keldi-ketdi**

```
Sana | Keldi | Ketdi | Manba | Izoh
```

Barcha varaqlarda ustun kengligi avtomatik moslashtirilgan, sarlavha qatori
qora fonda oq qalin shrift.

### Frontend'da yuklab olish

`Content-Disposition` sarlavhasida fayl nomi keladi, `blob` orqali yuklab olsa
bo'ladi. `Content-Type` —
`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

---

## 4. AI endi florist haqi summasini aytmaydi

Bu frontend'ga bevosita ta'sir qilmaydi, lekin chat oynasida ko'rinadi,
shuning uchun bilib qo'yish kerak.

**Oldin:**
```
Atirgul prut oq
50 dona 750 000 so'm
Florist haqi taxminan 50 000 so'm

Jami taxminan 800 000 so'm
```

**Hozir:**
```
Atirgul prut oq
50 dona 750 000 so'm

Gullar jami 750 000 so'm
Florist haqi va aniq narxni operatorlarimiz aytadi
```

Mijoz «floristika nechpul» yoki «florist haqi qancha» deb so'rasa ham AI summa
aytmaydi, operatorga yo'naltiradi.

**Lekin CRM tomonida hammasi saqlanadi.** Lead obyektida:

```json
{ "estimated_price": "9050000.00", "florist_fee": "50000.00" }
```

`estimated_price` — gullar va florist haqi qo'shilgan to'liq summa.
`florist_fee` — alohida. Operator ikkalasini ham ko'radi va mijozga yakuniy
narxni o'zi aytadi.

Ya'ni lead kartochkasida ko'rsatilgan summa mijoz chatda ko'rgan summadan
katta bo'lishi normal — bu ataylab shunday.

---

## Qisqa xulosa

| So'rov | Endpoint | Holat |
|---|---|---|
| Florist detali — qachon qancha pul, qanaqa hajm, buketmi savatmi, qancha tushgan | `GET /api/florists/{id}/stats/` | ✅ tayyor |
| Floristning o'z dashboardi | `GET /api/florists/me/dashboard/` | ✅ tayyor |
| Excel eksport, kunlar bilan to'liq info | `GET /api/exports/florist/?florist=<id>` | ✅ tayyor |
| AI florist haqini aytmasin | prompt `0083` | ✅ tayyor |

Uchala endpoint bitta backend funksiyasidan (`florist_stats_data`) foydalanadi,
shuning uchun raqamlar har joyda bir xil chiqadi.
