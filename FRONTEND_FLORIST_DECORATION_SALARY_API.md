# Florist detali — oformleniya haqini qo'lda yozish

> **Hali serverga chiqarilmagan.** Backend tayyor va testdan o'tgan. Partiya kirimi o'zgarishi bilan birga chiqariladi.

---

## Nima qo'shildi

Florist detal sahifasida admin **nechta oformleniya** qilinganini yozadi — summa o'zi ko'payadi va ish haqiga tushadi.

```
3 ta oformleniya  ×  5 000 so'm  =  15 000 so'm
```

Bittasining narxi florist profilidagi **oformleniya narxi** (`decoration_fee`) dan olinadi. Kerak bo'lsa shu safarga boshqa narx berish ham mumkin.

---

## 1. Florist detaliga blok

```
┌─ OFORMLENIYA HAQI ──────────────────────────────┐
│                                                 │
│   Oformleniya narxi   [ 5 000 ] so'm  [Saqlash] │
│                                                 │
│   ─────────────────────────────────────────     │
│                                                 │
│   Nechta qildi        [ 3 ]  ta                 │
│   Sana                [ 07.08.2026 ]            │
│   Boshqa narx         [        ] so'm  ixtiyoriy│
│                                                 │
│              3 × 5 000 = 15 000 so'm            │
│                                                 │
│                            [ Qo'shish ]         │
└─────────────────────────────────────────────────┘
```

Formada hisobni **jonli ko'rsating** — admin «Qo'shish» bosishdan oldin qancha pul yozilayotganini ko'rib tursin.

---

## 2. Oformleniya narxi — o'zgartirish

Bu maydon avvaldan bor, alohida endpoint kerak emas:

```http
PATCH /api/florists/{id}/
```

```json
{ "decoration_fee": "8000" }
```

Bu **keyingi** qo'shishlarga ta'sir qiladi, oldin yozilgan yozuvlarga tegmaydi.

---

## 3. Oformleniya qo'shish

```http
POST /api/florists/{id}/decoration/
```

```json
{
  "count": 3,
  "work_date": "2026-08-07",
  "unit_amount": "5000",
  "note": "Kechki smena"
}
```

| Maydon | Majburiy | Izoh |
|---|---|---|
| `count` | ha | Nechta oformleniya. 1 dan kichik bo'lsa 400 |
| `work_date` | yo'q | Berilmasa bugungi sana |
| `unit_amount` | yo'q | Bittasining narxi. Berilmasa profildagi `decoration_fee` |
| `note` | yo'q | Izoh |

Javob — yaratilgan ish haqi yozuvi:

```json
{
  "id": 250,
  "florist": 7,
  "source": "extra_decoration",
  "quantity": 3,
  "unit_amount": "5000.00",
  "amount": "15000.00",
  "work_date": "2026-08-07",
  "note": "Kechki smena",
  "catalog_item_detail": null
}
```

| Status | Ma'nosi |
|---|---|
| `201` | Yangi qator ochildi |
| `200` | O'sha kunning qatoriga qo'shildi (pastga qarang) |

### Xatolar

```json
{ "count": ["Ensure this value is greater than or equal to 1."] }
```

```json
{ "detail": "Oformleniya narxini kiriting — florist profilida ham yozilmagan" }
```

Ikkinchisi profilda `decoration_fee` nol bo'lganda chiqadi. Shunda `unit_amount` yuborish kerak — yoki avval profildagi narxni to'ldiring.

---

## 4. Bir kunda bir necha marta qo'shish

Kun davomida bir necha marta qo'shilsa **yangi qator ochilmaydi**, o'sha kunning qatoriga qo'shiladi:

```
09:00   3 ta qo'shildi   →   qator: 3 ta · 15 000 so'm   (201)
18:00   2 ta qo'shildi   →   qator: 5 ta · 25 000 so'm   (200)
```

Lekin **bittasining narxi boshqa** bo'lsa alohida qator ochiladi — aks holda «soni × narxi = summa» hisobi buzilardi:

```
Isroil · 07.08.2026 · 5 ta × 5 000 = 25 000
Isroil · 07.08.2026 · 2 ta × 7 000 = 14 000
```

Shuning uchun javobdagi `id` ni tekshiring: agar oldingi qator bilan bir xil bo'lsa qo'shildi, boshqa bo'lsa yangi qator.

---

## 5. Yozilganini tuzatish

Yozuv oddiy ish haqi yozuvi, mavjud endpoint bilan tahrirlanadi:

```http
PATCH /api/florist-salary/{id}/
```

**Sonini o'zgartirish** — summa o'zi qayta hisoblanadi:

```json
{ "quantity": 5 }
```
→ `amount` = 5 × 5 000 = `25000.00`

**Bittasining narxini o'zgartirish** — summa yana o'zi hisoblanadi:

```json
{ "unit_amount": "6000" }
```
→ `amount` = 3 × 6 000 = `18000.00`

**Summani qo'lda yozish** — o'shanisi qoladi, ko'paytirish bekor:

```json
{ "amount": "20000" }
```
→ `amount` = `20000.00`, `quantity` o'zgarmaydi

Ya'ni `amount` yuborilsa u ustun turadi. `quantity` yoki `unit_amount` yuborilib `amount` yuborilmasa — ko'paytiriladi.

O'chirish uchun `DELETE /api/florist-salary/{id}/`.

---

## 6. Ro'yxatda ko'rsatish

Yangi manba turi:

| `source` | Yorlig'i |
|---|---|
| `extra_decoration` | Qo'shimcha oformleniya |

Filtr avvalgidek:

```http
GET /api/florist-salary/?florist=7&source=extra_decoration
GET /api/florist-salary/?florist=7&work_date=2026-08-07
```

Ro'yxatda `quantity` va `unit_amount` bor — hisobni ko'rsatib turing:

```
Qo'shimcha oformleniya    3 × 5 000        15 000 so'm    [ tahrir ]
```

Boshqa turlarda bu ikkisi `0` bo'ladi — o'shanda faqat summani chiqaring.

### Hisobotda

`/api/florists/{id}/stats/` javobida yangi tur **oformleniya ustuniga** tushadi, alohida ustun ochilmaydi:

```json
{
  "summary": {
    "decoration_salary_total": "175000.00",
    "manual_salary_total": "0.00",
    "salary_total": "185000.00"
  },
  "by_source": [
    { "source": "extra_decoration", "source_label": "Qo‘shimcha oformleniya", "count": 1, "amount": "15000.00" }
  ]
}
```

Ya'ni `decoration` + `sale_decoration` + `extra_decoration` — uchalasi `decoration_salary_total` ga yig'iladi. Grafik va jamilarga tegish shart emas, o'zi to'g'ri chiqadi.

---

## 7. Ruxsat

Yozish — `florists` sahifasiga `can_control` ruxsati bor foydalanuvchida. Floristning o'zi **o'ziga yoza olmaydi**, `403` qaytadi. O'zining ish haqini ko'rishi esa avvalgidek.

---

## 8. Nima o'zgarmadi

- Katalogdan avtomatik yoziladigan oformleniya haqi (`decoration`) — buket yasalganda o'zi yoziladi
- Sotuv oformleniyasi (`sale_decoration`) — sotuvda o'zi yoziladi
- Kunlik ish haqi, katalog haqi, restavratsiya, qo'lda yozilgan `manual`
- Hajm bo'yicha narxlar (`volume_rates`)

Yangi tur faqat **qo'lda yoziladigan** oformleniya uchun.

---

## Qisqacha

1. Florist detaliga «Oformleniya haqi» bloki qo'shing
2. Narxni `PATCH /api/florists/{id}/` dagi `decoration_fee` bilan tahrirlang
3. `POST /api/florists/{id}/decoration/` ga `count` yuboring — summa o'zi ko'payadi
4. Formada `count × narx = summa` ni jonli ko'rsating
5. Tuzatish uchun `PATCH /api/florist-salary/{id}/` — `quantity` yoki `unit_amount` yuborsangiz summa qayta hisoblanadi, `amount` yuborsangiz o'shanisi qoladi
6. Ro'yxatda `quantity × unit_amount` ni chiqaring, hisobotga tegish shart emas
