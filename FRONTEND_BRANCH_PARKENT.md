# 🏬 Parkent filiali — katalog yuborish va ajratilgan CRM

**Sana:** 2026-07-31 · **Testlar:** 175 ta ✅ · **Serverda ishlayapti**

Filiallarda **faqat tayyor katalog** bo'ladi. Sklad, florist, lead va mijozlar
avvalgidek **yagona** — ular bo'linmadi.

```
Asosiy filial                      Parkent filiali
─────────────                      ───────────────
katalog yasaladi                   ← yuboriladi (qisman ham)
sklad, florist, lead               narxni o'zgartiradi
                                   chegirma bilan sotadi
```

---

## 🏢 1. Filiallar

```
GET /api/branches/
```

```json
[
  { "id": 1, "name": "Asosiy filial",   "is_main": true,  "is_active": true },
  { "id": 2, "name": "Parkent filiali", "is_main": false, "is_active": true }
]
```

Ikkalasi avtomatik yaratilgan. Yangi filial qo'shish uchun `POST` (admin).

### Foydalanuvchini filialga biriktirish

```json
POST /api/users/   yoki   PATCH /api/users/{id}/
{ "username": "parkent1", "role": "operator", "branch": 2, "permissions": [...] }
```

`branch` bo'sh yoki `null` → **asosiy filial**.
Javobdagi `profile.branch` da ko'rinadi.

---

## 📤 2. Katalogni Parkentga yuborish

```json
POST /api/catalog/{id}/transfer/
{ "branch": 2, "quantity": 2, "price": "999000", "note": "Parkentga" }
```

| Maydon | Majburiy | Izoh |
|---|---|---|
| `branch` | ha | Filial id, asosiy filial bo'lmasligi kerak |
| `quantity` | ha | **Qisman yuborish mumkin** |
| `price` | yo'q | Parkent narxi. Berilmasa asl narx qoladi |
| `note` | yo'q | Izoh |

### Nima bo'ladi

- Asosiy filialda **soni kamayadi** (5 tadan 2 tasi ketsa, 3 tasi qoladi)
- Parkentda **yangi katalog yozuvi** paydo bo'ladi, o'z narxi bilan
- **Sklad tegilmaydi** — gul allaqachon katalog yaratilganda yechilgan
- Tarkib va material nusxalanadi, tannarx ulushga qarab bo'linadi
- Asl narx `source_price` da saqlanadi

Javob:
```json
{ "id": 1, "quantity": 2, "branch_name": "Parkent filiali",
  "source_price": "300000.00", "target_price": "999000.00",
  "target_item": 66, "catalog_name": "Oq buket" }
```

Yetmasa `400`:
```json
{ "detail": "Yuborish uchun atigi 3 dona bor" }
```

### Yuborilganlar tarixi

```
GET /api/catalog-transfers/?branch=2
```

---

## 🔒 3. Filiallar aralashmaydi

Bu **avtomatik** ishlaydi, frontend'da filtr yozish shart emas.

| Foydalanuvchi | `/api/catalog/` | `/api/dashboard/` | `/api/accounting/` |
|---|---|---|---|
| Asosiy filial | faqat asosiy katalog | faqat asosiy sotuvlar | faqat asosiy |
| Parkent | faqat Parkent katalogi | faqat Parkent sotuvlari | faqat Parkent |

Asosiy filial admini Parkent mahsulotini to'g'ridan-to'g'ri **ochib bo'lmaydi** —
`GET /api/catalog/66/` → `404`. Ular uchun **hisobot** bor (pastda).

Katalog javobiga `branch_name` qo'shildi.

### ⚠️ Filialda yangi katalog yaratib bo'lmaydi

```json
POST /api/catalog/   (Parkent foydalanuvchisi)
→ 400 { "detail": "Filialda yangi katalog yaratilmaydi. Asosiy filialdan yuboriladi." }
```

---

## 💵 4. Narx va chegirma

Uch bosqich:

```
source_price  300 000   asl narx, asosiy filialda
     ↓
price         500 000   Parkent qo'ygan narx (o'zgartirsa bo'ladi)
     ↓
sold_price    420 000   chegirma bilan sotildi
```

### Narxni o'zgartirish

```json
PATCH /api/catalog/{id}/   { "price": "500000" }
```

Parkent narxni **xohlagancha marta** o'zgartira oladi. `source_price` o'zgarmaydi.

### Chegirma bilan sotish

Asosiy filialdagidek ishlaydi:

```json
POST /api/catalog/{id}/sell/
{ "quantity": 1, "sale_price": "420000", "discount_reason": "Doimiy mijoz" }
```

Chegirma **Parkent narxidan** hisoblanadi (500 000 − 420 000 = 80 000).
Chegirma bo'lsa `discount_reason` **majburiy**, aks holda `400`.

---

## 📊 5. Admin hisoboti

```
GET /api/branch-report/
GET /api/branch-report/?branch=2&date_from=2026-07-01&date_to=2026-07-31
```

```json
{
  "period": { "date_from": null, "date_to": null },
  "branches": [
    {
      "branch_id": 2,
      "branch_name": "Parkent filiali",
      "received_transfers": 4,
      "received_quantity": 12,
      "catalog_items": 4,
      "available_quantity": 5,
      "sold_quantity": 7,
      "sold_revenue": "5950000.00",
      "source_value": "2100000.00",
      "markup_total": "3850000.00",
      "discounted_sales_count": 2,
      "discounted_quantity": 2,
      "discount_total": "150000.00"
    }
  ],
  "totals": { "received_quantity": 12, "sold_quantity": 7,
              "sold_revenue": "5950000.00", "discounted_quantity": 2,
              "discount_total": "150000.00" }
}
```

| Maydon | Nima |
|---|---|
| `received_quantity` | **Qancha katalog yuborilgan** |
| `available_quantity` | Hozir sotuvda turgani |
| `sold_quantity` | **Qanchasi sotilgan** |
| `sold_revenue` | Sotuvdan tushgan summa |
| `source_value` | Asosiy filial narxi bo'yicha qiymati |
| `markup_total` | Ustama — `sold_revenue` − `source_value` |
| `discounted_sales_count` | **Qanchasi chegirma bilan sotilgan** |
| `discount_total` | Jami chegirma summasi |

Ruxsat: `dashboard` sahifasi.

---

## 🖥️ Frontend uchun taklif

**Asosiy filial katalogida** har bir mahsulotga «Filialga yuborish» tugmasi:
```
Filial:  [Parkent filiali ▾]
Soni:    [ 2 ]  (max: sotilmagan qismi)
Narxi:   [ 999 000 ]  (bo'sh qoldirilsa asl narx)
Izoh:    [ ................ ]
```

**Parkent foydalanuvchisi** uchun menyu: Dashboard · Hisob-kitob · Katalog.
Sklad, floristlar, leadlar ko'rsatilmaydi.

**Admin uchun** yangi sahifa yoki dashboard bo'limi — `/api/branch-report/`
natijasini jadval qilib chiqarish. Davr tanlash bilan.

---

## ✅ Qisqacha

| Nima | Holat |
|---|---|
| Parkent filiali qo'shildi | ✅ |
| Katalogni qisman yuborish | ✅ |
| Parkent narxni o'zgartiradi | ✅ asl narx saqlanadi |
| Narxdan keyin chegirma bilan sotish | ✅ izoh majburiy |
| Dashboard, hisob-kitob, katalog ajratilgan | ✅ aralashmaydi |
| Admin hisoboti | ✅ yuborilgan, sotilgan, chegirmali |

Sklad, floristlar, leadlar va mijozlar **bo'linmadi** — ular yagona qoladi.
