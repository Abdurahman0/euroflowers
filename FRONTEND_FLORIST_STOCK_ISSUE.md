# 📦 Skladdan floristga gul chiqarish

**Sana:** 2026-07-31 · **Testlar:** 175 ta ✅ · **Serverda ishlayapti**

Gul avval floristga **chiqariladi**, keyin katalog **uning qo'lidagi** guldan
yasaladi. Shunda kimga qancha gul berilgani va u nimaga sarflangani aniq ko'rinadi.

```
   Sklad  ──── chiqarish ────►  Florist qo'lida  ──── katalog yasaldi ────►  minus
     ▲                               │
     └────────── qaytarish ──────────┤
                                     └────── chiqit (so'ldi) ──► skladga qaytmaydi
```

---

## 🔧 1. Endpointlar

| Metod | Manzil | Nima qiladi |
|---|---|---|
| `POST` | `/api/florist-stock-issues/issue/` | Skladdan floristga chiqarish |
| `POST` | `/api/florist-stock-issues/return/` | Qaytarish yoki chiqit |
| `GET` | `/api/florist-stock-issues/` | Butun tarix |
| `GET` | `/api/florist-stock-balances/` | Kimda hozir qancha gul bor |

Ruxsat: `inventory` sahifasi. Florist o'zining yozuvlarini ko'ra oladi.

---

## 📤 2. Chiqarish

```json
POST /api/florist-stock-issues/issue/
{ "florist": 4, "batch": 51, "quantity_stems": 30, "reason": "Ertangi buketlar uchun" }
```

- Sklad partiyasidan **30 dona kamayadi**
- Floristning qoldig'iga **30 dona qo'shiladi**
- `StockMovement` ga ham yoziladi (`reference_type: "florist_issue"`)

Javob:
```json
{ "id": 12, "kind": "issue", "kind_label": "Chiqarildi",
  "quantity_stems": 30, "florist_name": "Abror",
  "batch_detail": { "id": 51, "batch_number": "EF-260725-23",
                    "flower": "Atirgul", "variant": "Freedom", "color": "Qizil",
                    "height_label": "50 sm", "image_url": "...",
                    "cost_per_stem": "8000.00" } }
```

Skladda yetmasa `400`:
```json
{ "detail": "EF-260725-23 partiyasida atigi 12 dona qolgan" }
```

---

## 📥 3. Qaytarish va chiqit

```json
POST /api/florist-stock-issues/return/
{ "florist": 4, "batch": 51, "quantity_stems": 10, "kind": "return", "reason": "Ortib qoldi" }
```

| `kind` | Nima bo'ladi |
|---|---|
| `return` | Floristdan minus, **sklad qoldig'i tiklanadi** |
| `waste` | Floristdan minus, **skladga qaytmaydi** — so'lgan gul |

`kind` berilmasa `return` deb olinadi.

Floristda yetmasa `400`:
```json
{ "detail": "Abror qo'lida bu guldan atigi 5 dona bor" }
```

---

## 📊 4. Kimda qancha gul bor

```
GET /api/florist-stock-balances/?florist=4
```

```json
{
  "id": 3, "florist": 4, "florist_name": "Abror",
  "batch": 51, "remaining_stems": 20,
  "batch_detail": {
    "id": 51, "batch_number": "EF-260725-23",
    "flower": "Atirgul", "variant": "Freedom", "color": "Qizil",
    "height_label": "50 sm", "image_url": "...",
    "cost_per_stem": "8000.00", "stems_per_bunch": 25
  }
}
```

Sukut bo'yicha **faqat qoldig'i bor** qatorlar chiqadi.
Hammasini ko'rish uchun `?only_available=false`.

Filtr: `?florist=` `?batch=`

---

## 🌸 5. Katalog qo'shishda o'zgarish

Bu **eng muhim qismi**.

### Florist tanlangan bo'lsa

Gul **skladdan emas, floristning qoldig'idan** minus bo'ladi.

```json
POST /api/catalog/
{
  "name_uz": "Qizil buket",
  "arrangement_type": "bouquet",
  "volume": "M",
  "florist": 4,
  "price": "500000",
  "quantity_total": 1,
  "composition": [ { "stock_batch": 51, "quantity_stems": 20 } ]
}
```

Natija: floristning qoldig'i `20 → 0`, **sklad qoldig'i o'zgarmaydi**
(gul allaqachon chiqarilganda yechilgan).

Floristda yetmasa `400`:
```json
{ "detail": "Abror qo'lida yetarli gul yo'q: EF-260725-23 (5 dona bor, 20 kerak)" }
```

### 💡 Formada gul ro'yxatini qayerdan olish

Florist tanlangach, gul tanlash ro'yxatini **shu yerdan** to'ldiring:

```
GET /api/florist-stock-balances/?florist=4
```

U yerda faqat **o'sha floristda bor** gullar chiqadi, `remaining_stems` bilan.
Skladning umumiy ro'yxatini ishlatmang — florist olmagan gulni tanlab qo'ysa
`400` keladi.

### Florist tanlanmasa

Ilgarigidek **to'g'ridan-to'g'ri skladdan** olinadi. Hech narsa o'zgarmadi.

### Katalog o'chirilsa

Gul floristning qo'liga **qaytadi**, skladga emas.

---

## 🖥️ 6. Frontend uchun taklif

### Yangi sahifa — «Floristlarga chiqarilgan gullar»

**Yuqorida:** kim, qaysi gul, qancha — chiqarish formasi
```
Florist:  [ Abror ▾ ]
Gul:      [ Atirgul Freedom Qizil · EF-260725-23 · 321 dona ▾ ]
Soni:     [ 30 ]
Izoh:     [ ................ ]
                              [ Chiqarish ]
```

**O'rtada:** kimda nima bor — `/api/florist-stock-balances/`
```
Abror     Atirgul Freedom Qizil     20 dona    [Qaytarish] [Chiqit]
Dilnoza   Gortenziya Golland        12 dona    [Qaytarish] [Chiqit]
```

**Pastda:** tarix — `/api/florist-stock-issues/`, `kind_label` bilan.

### Katalog formasida

Florist tanlangach gul ro'yxatini balansdan yuklang va har birida
«mavjud: 20 dona» ko'rsating. Kiritilgan son undan oshsa formada
darhol ogohlantiring — server ham `400` beradi, lekin oldindan ko'rsatgan yaxshi.

---

## ⚠️ Muhim

Bu **buzuvchi o'zgarish**. Endi florist tanlangan katalogni qo'shish uchun
o'sha floristga gul **oldindan chiqarilgan** bo'lishi shart.

Eski oqim (skladdan to'g'ridan-to'g'ri) faqat **florist tanlanmagan** holatda
ishlaydi.

---

## ✅ Qisqacha

| Nima | Holat |
|---|---|
| Skladdan floristga chiqarish | ✅ |
| Qaytarish, sklad tiklanadi | ✅ |
| Chiqit, skladga qaytmaydi | ✅ |
| Kimda qancha gul bor | ✅ |
| Katalog florist qoldig'idan minus qiladi | ✅ |
| Yetmasa aniq xato xabari | ✅ |
| Butun tarix saqlanadi | ✅ |
