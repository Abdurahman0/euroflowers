# Aralash to'lov — bir qismi naqd, bir qismi karta

Katalog sotilayotganda to'lovni ikkiga bo'lish mumkin. To'lov turiga
to'rtinchi qiymat qo'shildi: **`mixed`**.

---

## So'rov

```json
POST /api/catalog/{id}/sell/
{
  "quantity": 1,
  "payment_type": "mixed",
  "cash_amount": "150000",
  "card_amount": "150000"
}
```

| Maydon | Qoida |
|---|---|
| `payment_type` | `cash` · `card` · `debt` · **`mixed`** |
| `cash_amount` | `mixed` da majburiy, noldan katta |
| `card_amount` | `mixed` da majburiy, noldan katta |

**Yig'indi sotuv summasiga aniq teng bo'lishi kerak.** Aks holda:

```json
{ "detail": "Naqd va karta yig'indisi sotuv summasiga teng emas. Sotuv: 300000.00, kiritilgan: 200000.00" }
```

Faqat bittasi berilsa:

```json
{ "cash_amount": ["Aralash to'lovda naqd va karta summasini kiriting"] }
```

Chegirma va bir nechta dona bilan ham ishlaydi — tekshiruv **chegirmadan
keyingi** summaga qarab bo'ladi:

```json
{
  "quantity": 2,
  "sale_price": "250000",
  "discount_reason": "Aksiya",
  "payment_type": "mixed",
  "cash_amount": "200000",
  "card_amount": "300000"
}
```
2 × 250 000 = 500 000 = 200 000 + 300 000 ✓

---

## Hisob-kitobda

Pul **haqiqatda qayerga tushgan bo'lsa o'sha ustunga** yoziladi:

```
Sotuv 300 000  (naqd 150 000 + karta 150 000)

  Umumiy savdo   +300 000
  Naqd           +150 000
  Karta          +150 000
```

**Sotuv soni ikki marta sanalmaydi.** Bitta sotuv — bitta yozuv. Son katta
ulush qaysi usulda bo'lsa o'shanga yoziladi, shuning uchun
`cash_count + card_count + debt_count + unknown_count = sales_count`
tengligi saqlanadi.

Ustiga ikkita yangi ko'rsatkich qo'shildi:

| Maydon | Ma'nosi |
|---|---|
| `mixed_count` | Nechta sotuv aralash to'lov bilan bo'lgan |
| `mixed_quantity` | Ularda nechta dona sotilgan |

Bular `summary` da ham, `by_branch` qatorlarida ham bor.

---

## Sotuv tarixida

`GET /api/catalog/sales/` qatoriga yangi maydon qo'shildi:

```json
{
  "payment_type": "mixed",
  "payment_label": "Aralash",
  "payment_breakdown": { "cash": "150000.00", "card": "150000.00" }
}
```

Oddiy to'lovlarda `payment_breakdown` **`null`** bo'ladi.

`totals` ichida ham pul ajratilgan holda hisoblanadi va `mixed_count` turadi.

---

## Forma uchun

To'lov turi tanlagichiga to'rtinchi tugma: `Naqd` · `Karta` · `Qarz` · **`Aralash`**.

**Aralash** tanlanganda ikkita summa maydoni ochiladi:

```
Sotuv summasi:  300 000 so'm

  Naqd   [ 150 000 ]
  Karta  [ 150 000 ]
  ─────────────────────
  Jami   300 000  ✓
```

Foydali bo'ladi:
- Bittasini yozganda ikkinchisini **o'zi to'ldirish** (qolgan summa)
- Yig'indi sotuv summasiga teng bo'lmasa tugmani bloklash — backend baribir
  tekshiradi, lekin oldindan ko'rsatgan yaxshi
- Chegirma kiritilsa jami qayta hisoblanadi

Ro'yxatda aralash sotuvni shunday ko'rsatish mumkin:

```
03.08 22:10   savat   1 ta   300 000   Aralash (150 000 naqd · 150 000 karta)
```

---

## Real misol (serverdan)

```
Sotuvdan oldin:  savdo 15 295 000 · naqd 5 280 000 · karta 10 015 000

300 000 so'mlik buket: 150 000 naqd + 150 000 karta

Sotuvdan keyin:  savdo 15 595 000 · naqd 5 430 000 · karta 10 165 000
                 sotuv soni 50 -> 51   (bir marta)
                 mixed_count 1
```

---

## Nima o'zgarmadi

- Oddiy `cash`, `card`, `debt` to'lovlar ilgarigidek
- Qarzga sotish, chegirma, sotuv rasmi, tarixiy sana — hammasi o'sha-o'sha
- Eski sotuvlarda `payment_breakdown` bo'lmaydi (`null`)

---

## Tekshirilgani

332 ta avtotest o'tadi, shundan 6 tasi shu ish uchun yozildi: pulning
ajralishi, sotuv sonining bir marta sanalishi, yig'indi to'g'ri kelmasa
rad etilishi, faqat bitta summa berilgan holat, chegirma va bir nechta
dona bilan ishlashi hamda tarixda ko'rinishi.

Real serverda ham 10 ta holat sinaldi — hammasi o'tdi.
