# Sotuvda dastafka summasi

Yetkazib berish uchun olingan pul endi sotuvda kiritiladi. **Tovar savdosiga
kirmaydi** — alohida hisoblanadi, shuning uchun buketlardan qancha tushgani
toza ko'rinadi.

---

## So'rov

```json
POST /api/catalog/{id}/sell/
{
  "quantity": 1,
  "payment_type": "cash",
  "delivery_amount": "20000"
}
```

`delivery_amount` — ixtiyoriy, noldan kichik bo'lmaydi. Berilmasa 0.

### Aralash to'lov bilan

Naqd va karta yig'indisi **tovar summasi + dastafka** ga teng bo'lishi kerak:

```json
{
  "quantity": 1,
  "payment_type": "mixed",
  "cash_amount": "100000",
  "card_amount": "220000",
  "delivery_amount": "20000"
}
```
300 000 + 20 000 = 320 000 = 100 000 + 220 000 ✓

To'g'ri kelmasa xato aniq aytadi:

```json
{ "detail": "Naqd va karta yig'indisi olinadigan summaga teng emas. Olinadi: 320000.00 (tovar 300000.00 + dastafka 20000.00), kiritilgan: 300000.00" }
```

---

## Hisob-kitobda qanday turadi

**Uchta narsa alohida:**

| Ko'rsatkich | Ma'nosi |
|---|---|
| `total_sales` | **Tovar savdosi** — faqat buket va savatlardan |
| `delivery_total` | **Dastafka** — alohida qator |
| `received_total` | **Kassaga tushgan** = tovar + dastafka |

Ustiga `delivery_count` — nechta sotuvda dastafka olingani.

**Naqd va karta ustunlari kassaga tushgan pulni ko'rsatadi**, ya'ni dastafka
ham ular ichida. Shuning uchun:

```
cash_total + card_total + debt_total + unknown_total  =  received_total
```

**Sof foydaga ta'sir qilmaydi.** Dastafka kuryerga berilgani uchun kirib
chiqib ketadi — foyda faqat tovardan hisoblanadi.

### Misol

```
300 000 so'mlik buket, 20 000 dastafka, naqd

  Tovar savdosi     +300 000
  Dastafka           +20 000
  ─────────────────────────────
  Kassaga tushgan   +320 000
  Naqd              +320 000

  Sof foyda         +240 000     ← 300 000 − 60 000 tannarx
                                    dastafka qatnashmaydi
```

Bu ko'rsatkichlar `summary` da ham, har bir filial qatorida (`by_branch`) ham bor.

---

## Sotuv tarixida

`GET /api/catalog/sales/` qatoriga ikkita maydon qo'shildi:

```json
{
  "sale_total": "300000.00",
  "delivery_amount": "20000.00",
  "received_total": "320000.00"
}
```

Dastafka olinmagan sotuvda `delivery_amount` **0**, `received_total` esa
`sale_total` ga teng bo'ladi.

`totals` ichida ham `delivery_total` va `received_total` bor.

---

## Forma uchun

Sotuv oynasiga bitta maydon, sukut bo'yicha bo'sh:

```
Sotuv summasi:      300 000 so'm
Dastafka:         [  20 000 ]     ← ixtiyoriy

─────────────────────────────────
Mijozdan olinadi:   320 000 so'm
```

Aralash to'lov bilan birga ishlatilsa, naqd va karta maydonlari **320 000** ga
tenglashishi kerak — jamini shu raqamdan hisoblang.

Ro'yxatda dastafkani alohida ko'rsatish qulay:

```
03.08 22:10   savat   1 ta   300 000 + 20 000 dastafka = 320 000   Naqd
```

---

## Real misol (serverdan)

```
tovar savdosi   : 19 545 000
dastafka        :     40 000   (2 ta sotuvda)
kassaga tushgan : 19 585 000

naqd            :  6 400 000
karta           : 13 185 000

foyda +240 000 = savdo +300 000 − tannarx +60 000   ← dastafka qatnashmadi
```

---

## Nima o'zgarmadi

- Dastafkasiz sotuvlar ilgarigidek — hamma yangi maydon 0 bo'ladi
- Chegirma, qarz, sotuv rasmi, tarixiy sana — hech biriga tegilmadi
- Eski sotuvlarda `delivery_amount` 0 bo'lib ko'rinadi

---

## Keyinchalik kerak bo'lsa

Hozir dastafka kuryerga berilgani uchun foydaga qo'shilmaydi. Agar kuryer
xarajatini alohida yozib borish kerak bo'lsa — masalan qaysi kuryerga qancha
berilgani — buni keyin qo'shsa bo'ladi. Hozirgi tuzilma shunga tayyor.

---

## Tekshirilgani

337 ta avtotest o'tadi, shundan 5 tasi shu ish uchun yozildi: dastafkaning
savdodan tashqarida qolishi, foydaga ta'sir qilmasligi, aralash to'lov bilan
ishlashi, yig'indi dastafkani qoplamasa rad etilishi va dastafkasiz sotuvda
nol qaytishi.

Real serverda ham 10 ta holat sinaldi — hammasi o'tdi.
