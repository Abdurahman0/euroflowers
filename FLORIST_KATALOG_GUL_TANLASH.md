# Tuzatish: florist katalogida gul tanlanadi, faqat soni yozilmaydi

Oldingi hujjatda («Florist: katalogga faqat hajm») florist katalogida gul umuman
tanlanmaydi deb yozilgan edi. **Bu noto'g'ri edi va tuzatildi.**

To'g'ri holat: **florist + gul + tur + hajm tanlanadi, faqat gul soni yozilmaydi.**

---

## Nega tuzatildi

Florist bir vaqtda ikki xil gul olishi mumkin — masalan 200 qizil va 300 oq atirgul.
Gul tanlanmasa, tizim qaysi buket qaysi guldan yasalganini bilmaydi.

Natijada «qizil tugadi» deb yopilganda qizil **hamma** ochiq buketga tarqalib ketardi,
oq atirguldan yasalganiga ham. Keyin oqni yopmoqchi bo'lsangiz nomzod qolmasdi.

Endi gul katalogda tanlangani uchun har gul faqat o'zidan yasalgan buketlarga tushadi.

---

## Katalog qo'shish formasi

Florist tanlanganda:

| Maydon | Holati |
|---|---|
| Florist | tanlanadi |
| **Gul** | **tanlanadi** — floristga chiqarilgan gullardan |
| Turi (`arrangement_type`) | tanlanadi |
| Hajmi (`volume`) | tanlanadi |
| **Gul soni** | **yo'q** — yozilmaydi |

To'rttasi ham majburiy.

### So'rov

```json
POST /api/catalog/
{
  "name_uz": "Qizil buket",
  "florist": 4,
  "arrangement_type": "bouquet",
  "volume": "M",
  "price": "500000",
  "quantity_total": 1,
  "composition": [ { "stock_batch": 94 } ]
}
```

`composition` da faqat **`stock_batch`** yuboriladi. `quantity_stems`
yuborilmaydi — u 0 bo'lib turadi va chiqim yopilganda hisoblanadi.

Gul ro'yxatini floristda qoldig'i bor partiyalardan chiqaring:

```
GET /api/florist-stock-balances/?florist=<id>
```

### Xatolar

```json
{ "composition": ["Floristga chiqarilgan qaysi guldan yasalganini tanlang"] }
{ "volume": ["Florist katalogida hajmni tanlash kerak — gul shu bo'yicha taqsimlanadi"] }
{ "arrangement_type": ["Florist katalogida turini tanlash kerak"] }
```

---

## Operator katalogi

Florist tanlanmagan katalogda hech narsa o'zgarmadi: gul **va** soni ikkalasi ham
kerak, gul to'g'ridan-to'g'ri skladdan yechiladi.

Sonsiz yuborilsa:

```json
{ "composition": ["Gul sonini kiriting"] }
```

---

## Chiqim yopilganda

Endpoint o'zgarmadi:

```
GET  /api/florist-stock-balances/close-issue-preview/?florist=&batch=&return_stems=
POST /api/florist-stock-balances/close-issue/
```

Farqi: taqsimotga endi **faqat o'sha gul tanlangan** kataloglar kiradi
(soni 0 bo'lib turganlari). Boshqa guldan yasalganlariga tegilmaydi.

Bo'ladigan katalog topilmasa xato matni ham aniqroq bo'ldi:

```
Abror da bu guldan yasalgan, soni yozilmagan katalog yo'q.
Qolgan 200 dona gulni skladga qaytaring yoki chiqitga yozing.
```

---

## Real misol (serverdan)

Floristga qizildan 200, oqdan 300 chiqarildi. Qizildan 2 ta, oqdan 3 ta buket yasadi.

```
QIZILNI YOPAMIZ (200 dona)
  qizil buketlar :  100, 100      ← to'ldi
  oq buketlar    :    0,   0,  0  ← tegilmadi

OQNI YOPAMIZ (300 dona)
  oq buketlar    :  100, 100, 100 ← to'ldi
  qizil buketlar :  100, 100      ← o'zgarmadi

floristda qoldiq: qizil 0, oq 0
```

---

## Katalog ro'yxatida

Soni yozilmagan katalogda `composition[0].quantity_stems` **0** bo'ladi.
Shu bo'yicha «chiqim yopilishini kutayapti» degan belgi qo'yish mumkin:

```js
const kutayapti = item.composition.some(row => row.quantity_stems === 0)
```

Bunday katalogning tannarxida gul qismi hozircha 0 — yopilgandan keyin to'ladi.

---

## Tekshirilgani

226 ta avtotest o'tadi. Ikki xil gulli holat alohida test bilan qoplandi.

Real serverda ham 10 ta holat sinaldi, jumladan yuqoridagi qizil/oq misoli va
gulsiz katalogning rad etilishi. Hammasi o'tdi.
