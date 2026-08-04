# Dastafka qoidasi o'zgardi — sotuv summasidan ayriladi

**Eski qoida:** sotuv narxi tovar puli edi, dastafka ustiga qo'shilardi.
`mijozdan olingan = sotuv narxi + dastafka`

**Yangi qoida:** sotuvda kiritilgan narx — **mijozdan olinadigan to'liq pul**.
Dastafka shu summaning ichida bo'ladi va kuryerga ketadi.
`savdo = sotuv narxi − dastafka`

Misol: 500 000 ga sotildi, 50 000 dastafka →
mijozdan **500 000** olinadi, savdoga **450 000** kiradi, kuryerga **50 000**.

---

## Nima o'zgardi

### 1. Sotish formasi (`POST /api/catalog/{id}/sell/`)

`sale_price` maydonining ma'nosi o'zgardi — endi **dastafka bilan qo'shib**
yoziladi. Formada shunday ko'rsating:

```
Sotuv summasi (mijozdan olinadi) *   [ 500 000 ]   -> sale_price
Shundan dastafka                     [  50 000 ]   -> delivery_amount
--------------------------------------------------
Tovar savdosi                          450 000     (frontend o'zi hisoblab ko'rsatadi)
```

Ikkita yangi tekshiruv qo'shildi:

| Holat | Javob |
|---|---|
| `delivery_amount` >= sotuv summasi | `400 {"delivery_amount": "Dastafka summasi sotuv summasidan kam bo'lishi kerak. Sotuv: 300000.00, dastafka: 300000.00"}` |
| Aralash to'lovda naqd+karta ≠ sotuv summasi | `400 {"detail": "Naqd va karta yig'indisi olinadigan summaga teng emas. Olinadi: 300000.00 (shundan 20000.00 dastafka), kiritilgan: 280000.00"}` |

**Aralash to'lovda** naqd + karta = **sotuv summasi** (dastafka bilan birga)
bo'lishi kerak. Avval dastafkani alohida qo'shish kerak edi — endi kerak emas.

### 2. Sotuvlar tarixi (`GET /api/catalog/sales/`, `/api/catalog/{id}/sales/`)

Maydonlar o'sha-o'sha, faqat ma'nosi aniqlashdi:

| Maydon | Ma'nosi |
|---|---|
| `received_total` | Mijozdan olingan pul (sotuvda kiritilgan summa) |
| `delivery_amount` | Shundan dastafkaga ketgani |
| `sale_total` | **Tovar savdosi** = `received_total − delivery_amount` |

Jadvalda uchalasini ham ko'rsatish tavsiya qilinadi.

### 3. Hisob-kitob (`GET /api/accounting/`)

| Maydon | Ma'nosi |
|---|---|
| `total_sales` | Savdo — **dastafkasiz** |
| `delivery_total` | Dastafka pullari (kuryerga) |
| `received_total` | `total_sales + delivery_total` — kassaga tushgan pul |
| `cash_total`, `card_total` | Mijoz to'lagan to'liq pul (dastafka bilan) |
| `net_profit` | `total_sales − tannarx − chiqit` — dastafka foydaga kirmaydi |

Shu qoida `/api/catalog/{id}/sales/` yig'indilariga, foyda hisobotiga va
Excel eksportga ham bir xil qo'llanadi.

---

## Diqqat

- Eski sotuvlarda `delivery_amount` yozilmagan bo'lsa hech narsa o'zgarmaydi
  (`sale_total = received_total`).
- Frontendda `sale_total + delivery_amount` qilib qo'shib ko'rsatadigan joy
  bo'lsa olib tashlash kerak — endi u ikki marta hisoblanadi.
