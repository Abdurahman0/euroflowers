# Katalogdan sotish — aralash to'lov (Mixed Payment)

Mijoz bir qismini naqd, bir qismini karta bilan to'lasa — aralash to'lov. Backend buni to'liq qo'llab-quvvatlaydi, frontendda shu hujjat bo'yicha qilinsa yetarli.

---

## Endpoint

```
POST /api/catalog/{id}/sell/
```

Ruxsat: `catalog` sahifasi, `can_control`.

---

## To'lov turlari

| `payment_type` | Ma'nosi | Qo'shimcha maydonlar |
|---|---|---|
| `cash` | Naqd | — |
| `card` | Karta | — |
| `debt` | Qarzga | mijoz majburiy |
| **`mixed`** | **Aralash — naqd + karta** | `cash_amount`, `card_amount` majburiy |

---

## Aralash to'lov qoidalari

Uchta shart bir vaqtda bajarilishi kerak, aks holda `400` qaytadi.

**1. Ikkala summa ham berilishi shart**

```
cash_amount va card_amount — ikkalasi ham bo'lishi kerak
```

**2. Ikkalasi ham noldan katta**

Agar biri nol bo'lsa, bu aralash emas — oddiy `cash` yoki `card` ishlatilsin.

**3. Yig'indi olinadigan summaga TENG bo'lishi kerak**

```
cash_amount + card_amount  ==  sale_price × quantity
```

Bu eng ko'p xato qilinadigan joy. Diqqat qiling:

> **Dastafka summasi olinadigan summaning ICHIDA.** Ustiga qo'shilmaydi.

Ya'ni mijozdan olinadigan pul har doim `sale_price × quantity`. Dastafka o'shaning ichidan kuryerga ketadi va savdodan ayriladi.

---

## So'rov

```json
{
  "quantity": 1,
  "sale_price": "800000",
  "payment_type": "mixed",
  "cash_amount": "500000",
  "card_amount": "300000",
  "delivery_amount": "50000",
  "discount_reason": "",
  "sold_at": "2026-08-05T15:30:00+05:00",
  "decoration_florist": 4,
  "materials": [{ "packaging": 7, "quantity": 1 }],
  "sale_image_url": ""
}
```

### Maydonlar

| Maydon | Turi | Majburiy | Izoh |
|---|---|---|---|
| `quantity` | int ≥ 1 | yo'q, default 1 | Nechta dona sotilyapti |
| `sale_price` | decimal | yo'q | **Bir donaning** narxi. Berilmasa katalogdagi narx olinadi |
| `payment_type` | enum | yo'q | `cash` / `card` / `debt` / `mixed` |
| `cash_amount` | decimal > 0 | **mixed uchun ha** | Naqd qismi |
| `card_amount` | decimal > 0 | **mixed uchun ha** | Karta qismi |
| `delivery_amount` | decimal ≥ 0 | yo'q | Sotuv summasi ichidagi dastafka puli |
| `discount_reason` | string | yo'q | Narx tushirilgan bo'lsa sababi |
| `sold_at` | datetime | yo'q | Tarixiy sotuv uchun. Berilmasa hozirgi vaqt |
| `materials` | array | yo'q | Sotuvda ishlatilgan qadoq |
| `decoration_florist` | int | yo'q | Oformleniya qilgan florist |
| `sale_image` / `sale_image_url` | file / string | yo'q | Sotuv rasmi, guruhga ketadi |
| `reservation` | int | yo'q | Bron bo'yicha sotuv |

`debt` uchun qo'shimcha: `customer` **yoki** `customer_name` + `customer_phone` majburiy, `debt_note` ixtiyoriy.

### Javob

`200 OK` — yangilangan katalog mahsuloti (`CatalogItemSerializer`).

---

## Xatolar — `400`

| Holat | Javob |
|---|---|
| `cash_amount` yoki `card_amount` yo'q | `{"cash_amount": "Aralash to'lovda naqd va karta summasini kiriting"}` |
| Biri nol yoki manfiy | `{"cash_amount": "Aralash to'lovda ikkala summa ham noldan katta bo'lishi kerak"}` |
| Yig'indi mos emas | `{"detail": "Naqd va karta yig'indisi olinadigan summaga teng emas. Olinadi: 800000.00 (shundan 50000 dastafka), kiritilgan: 750000.00"}` |
| Dastafka sotuvdan katta | `{"delivery_amount": "Dastafka summasi sotuv summasidan kam bo'lishi kerak. Sotuv: 800000.00, dastafka: 900000"}` |
| Qarzda mijoz yo'q | `{"customer": "Qarzga sotishda mijozni tanlang yoki ism va telefon kiriting"}` |

---

## Frontda hisoblash

Saqlash tugmasi bosilishidan oldin frontda tekshirilsa, foydalanuvchi xatosini darrov ko'radi:

```js
const received = Number(salePrice) * Number(quantity)

// aralash to'lov tekshiruvi
const given = Number(cashAmount) + Number(cardAmount)
const valid =
  cashAmount > 0 &&
  cardAmount > 0 &&
  given === received

// qolgan summa — foydalanuvchiga ko'rsatish uchun
const remaining = received - given
```

**Qulay UX:** foydalanuvchi naqd summani kiritganda, karta summasi avtomatik to'ldirilsin:

```js
onCashChange = (cash) => {
  setCash(cash)
  setCard(Math.max(received - cash, 0))
}
```

Shunda yig'indi doim to'g'ri chiqadi va xato bo'lmaydi.

---

## Ekran

```
┌─ Sotish ───────────────────────────────────────────┐
│  Mahsulot   Oq Atirgul Kompozitsiya                │
│  Soni       [1]                                    │
│  Narxi      [800 000] so'm                         │
│                                                    │
│  To'lov turi                                       │
│   ( ) Naqd   ( ) Karta   ( ) Qarz   (•) Aralash    │
│                                                    │
│   ┌────────────────────────────────────────────┐   │
│   │ 💵 Naqd   [500 000]                        │   │
│   │ 💳 Karta  [300 000]                        │   │
│   │                                            │   │
│   │ Olinadi   800 000                          │   │
│   │ Kiritildi 800 000        ✓ to'g'ri         │   │
│   └────────────────────────────────────────────┘   │
│                                                    │
│  🚚 Dastafka  [50 000]  ← 800 000 ichida           │
│                                                    │
│  Oformleniya florist [Abror ▾]                     │
│  Qadoq  [+ qo'shish]                               │
│  Rasm   [yuklash]                                  │
│                                                    │
│                      [Bekor]  [Sotildi]            │
└────────────────────────────────────────────────────┘
```

Aralash tanlanmagunicha naqd/karta maydonlari ko'rsatilmasin. Tanlangach ikkalasi ham majburiy bo'ladi.

Yig'indi mos kelmasa `Sotildi` tugmasi o'chiq tursin va farq qizil rangda ko'rsatilsin:

```
Kiritildi 750 000        ✗ 50 000 kam
Kiritildi 850 000        ✗ 50 000 ortiq
```

---

## Saqlangandan keyin

### Ma'lumot qayerda turadi

Aralash to'lov `CatalogHistory.snapshot` ichida saqlanadi:

```json
{
  "payment_type": "mixed",
  "payment_cash": "500000",
  "payment_card": "300000",
  "delivery_amount": "50000"
}
```

Sotuvlar ro'yxatida (`GET /api/catalog-history/` yoki sotuvlar sahifasi) shu maydonlardan foydalaning.

### Hisobotda qanday ko'rinadi

Aralash to'lov hisobotda **ikkiga ajratiladi** — naqd qismi naqd kassaga, karta qismi karta kassaga tushadi. Ya'ni pul to'g'ri joyda hisoblanadi.

Sotuvlar **soni** esa ikki marta sanalmasligi uchun faqat **katta ulush** qaysi usulda bo'lsa o'shanga yoziladi. Masalan 500 000 naqd + 300 000 karta bo'lsa, dona soni naqdga yoziladi.

Hisobotda alohida ko'rsatkichlar bor:

```json
{
  "mixed_count": 3,
  "mixed_quantity": 4
}
```

Bu — nechta sotuv aralash to'lov bilan bo'lganini ko'rsatadi. Kassalar summasidan ajratib turadi.

`?payment_type=mixed` bilan filtrlash ham mumkin.

### Telegram guruhiga xabar

Sotuv guruhga avtomatik ketadi. Aralash to'lovda shunday ko'rinadi:

```
🔀 To'lov: Aralash — 💵 500 000 · 💳 300 000
```

Oddiy to'lovlarda:

```
💵 To'lov: Naqd
💳 To'lov: Karta
📝 To'lov: Qarz
```

---

## Misollar

### 1. Oddiy aralash

Buket 800 000, mijoz 500 000 naqd va 300 000 karta berdi.

```json
{
  "quantity": 1,
  "sale_price": "800000",
  "payment_type": "mixed",
  "cash_amount": "500000",
  "card_amount": "300000"
}
```

### 2. Dastafka bilan

Mijozdan jami 800 000 olinadi, shundan 50 000 kuryerga ketadi.

```json
{
  "quantity": 1,
  "sale_price": "800000",
  "payment_type": "mixed",
  "cash_amount": "300000",
  "card_amount": "500000",
  "delivery_amount": "50000"
}
```

`cash + card = 800 000` — dastafka **ustiga qo'shilmaydi**, ichida.

### 3. Bir nechta dona

3 ta buket, donasi 300 000, jami 900 000.

```json
{
  "quantity": 3,
  "sale_price": "300000",
  "payment_type": "mixed",
  "cash_amount": "400000",
  "card_amount": "500000"
}
```

`cash + card = 900 000 = 300 000 × 3`

### 4. Chegirma bilan

Katalogda narx 1 000 000, mijozga 850 000 ga berildi.

```json
{
  "quantity": 1,
  "sale_price": "850000",
  "payment_type": "mixed",
  "cash_amount": "400000",
  "card_amount": "450000",
  "discount_reason": "Doimiy mijoz"
}
```

Chegirma avtomatik hisoblanadi — katalog narxi bilan sotuv narxi farqi.

---

## Qisqacha eslatma

1. Aralash tanlansa — naqd va karta **ikkalasi ham majburiy**, ikkalasi ham noldan katta
2. Yig'indi **aniq** `sale_price × quantity` ga teng bo'lsin
3. Dastafka **ichida**, ustiga qo'shilmaydi
4. Frontda avtomatik to'ldirish qo'yilsa xato bo'lmaydi
5. Hisobotda pul ikki kassaga bo'linadi, dona soni katta ulushga yoziladi
