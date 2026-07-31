# Sklad: partiya alohida + pochka narxidan dona narxi

Ikkita o'zgarish:

1. **Partiya endi alohida yozuv.** Avval partiya ochiladi (raqam, sana, postavshik),
   keyin uning ichiga turli gullar qo'shiladi.
2. **Pochka narxi kiritilsa dona narxi o'zi hisoblanadi** va eng yaqin 100 ga yaxlitlanadi.

---

## 1. Partiya

### Yangi endpoint

```
GET    /api/stock-deliveries/            ro'yxat
POST   /api/stock-deliveries/            yangi partiya
GET    /api/stock-deliveries/{id}/       bitta partiya
PATCH  /api/stock-deliveries/{id}/       tahrirlash
DELETE /api/stock-deliveries/{id}/       o'chirish (ichida gul bo'lsa arxivlanadi)
GET    /api/stock-deliveries/{id}/batches/   partiya ichidagi gullar
```

Ruxsat: `inventory` sahifasi. O'zgartirish uchun `admin` yoki `warehouse` roli.

### Partiya ochish

```json
POST /api/stock-deliveries/
{
  "number": "7",
  "received_at": "2026-08-01",
  "supplier": 22,
  "note": "Chorshanba yuki"
}
```

`number` takrorlanishi mumkin — turli sanadagi partiyalar bir xil raqamli bo'lishi normal.

### Javob

```json
{
  "id": 2,
  "number": "7",
  "received_at": "2026-08-01",
  "supplier": 22,
  "supplier_detail": { "id": 22, "name": "Golland Flowers", "...": "..." },
  "note": "Chorshanba yuki",
  "is_active": true,
  "created_by_detail": { "...": "..." },

  "batch_count": 2,          // ichida nechta xil gul bor
  "total_stems": 200,        // jami kelgan dona
  "remaining_stems": 175,    // hozir qolgan dona
  "total_cost": "200000.00"  // partiyaning jami tannarxi
}
```

Oxirgi to'rttasi hisoblab beriladi — ro'yxatda kartochka qilib ko'rsatish uchun qulay.

### Partiya ichiga gul qo'shish

Odatdagi `POST /api/stock-batches/`, faqat `delivery` maydoni bilan:

```json
{
  "delivery": 2,
  "variant": 31,
  "height_cm": 50,
  "stems_per_bunch": 25,
  "received_stems": 100,
  "cost_per_bunch": "25000",
  "sale_price_per_bunch": "50000"
}
```

**`batch_number`, `received_at`, `supplier` yuborilmaydi** — ular partiyadan olinadi.
Yuborilsa ham partiyaniki ustun keladi. Formada bu uchtasini ko'rsatmang,
partiya tanlangach uning ma'lumotini shunchaki matn qilib chiqaring.

Javobda partiya haqida qisqa ma'lumot qaytadi:

```json
"delivery": 2,
"delivery_detail": {
  "id": 2, "number": "7", "received_at": "2026-08-01",
  "supplier": "Golland Flowers", "note": "Chorshanba yuki"
}
```

### Eski oqim ham ishlaydi

`delivery` bermay, ilgarigidek `batch_number` bilan yuborsangiz — o'sha raqam va
sanadagi partiya topiladi, topilmasa **o'zi ochiladi**. Ya'ni skladda partiyasiz
gul qolmaydi. Migratsiya paytida mavjud gullar ham partiyalarga taqsimlandi.

---

## 2. Pochka narxi va yaxlitlash

`StockBatch` ga **`cost_per_bunch`** (pochka tannarxi) qo'shildi.
`sale_price_per_bunch` (pochka sotuv narxi) ilgari ham bor edi.

### Qoida

| Nima yuborilsa | Nima hisoblanadi |
|---|---|
| `cost_per_bunch` | → `cost_per_stem` = pochka tannarx ÷ pochkadagi dona, **100 ga yaxlitlanadi** |
| `sale_price_per_bunch` | → `sale_price_per_stem` = pochka sotuv ÷ pochkadagi dona, **100 ga yaxlitlanadi** |
| `cost_per_stem` | → `cost_per_bunch` = dona tannarx × pochkadagi dona (yaxlitlanmaydi) |
| `sale_price_per_stem` | → `sale_price_per_bunch` = dona sotuv × pochkadagi dona |

Ikkalasi ham yuborilsa — yuborilgani o'zgarmaydi, hech narsa hisoblanmaydi.
Ya'ni kerak bo'lsa dona narxini qo'lda ham yozib ketish mumkin.

### Yaxlitlash

Eng yaqin **100** ga. Kiritilgan pochka narxi hech qachon o'zgarmaydi —
faqat undan chiqadigan dona narxi yaxlitlanadi.

| Pochka narxi | Pochkada | Aniq hisob | Saqlanadi |
|---|---|---|---|
| 25 000 | 25 | 1 000.00 | **1 000** |
| 24 950 | 25 | 998.00 | **1 000** |
| 24 900 | 25 | 996.00 | **1 000** |
| 25 100 | 25 | 1 004.00 | **1 000** |
| 26 300 | 25 | 1 052.00 | **1 100** |
| 26 500 | 25 | 1 060.00 | **1 100** |

Yarmi va undan yuqorisi tepaga, pastrog'i pastga.

### Formada qanday bo'lishi

Pochka narxi maydonini asosiy qilib qo'ying, dona narxini uning ostida
avtomatik hisoblanadigan qilib ko'rsating:

```
Pochkada nechta dona:  [ 25 ]

Pochka tannarxi:       [ 24 950 ]  so'm
   → dona tannarxi:      1 000 so'm   (yaxlitlandi, aniq hisob 998)

Pochka sotuv narxi:    [ 50 000 ]  so'm
   → dona sotuv narxi:   2 000 so'm
```

Hisobni frontendda ham ko'rsatish uchun formula: `round(pochka / dona / 100) * 100`.
Lekin saqlashda backend baribir o'zi qayta hisoblaydi, shuning uchun dona narxini
yubormasangiz ham bo'ladi.

---

## Nima o'zgarmadi

- `stock-batches` ning qolgan hamma maydoni va xatti-harakati o'sha-o'sha
- `received_bunches` bilan `received_stems` ni hisoblash ilgarigidek ishlaydi
- Sklad kamayishi, floristga chiqarish, katalog tannarxi — hech biriga tegilmadi
- `batch_number` maydoni javobda qoladi (partiya raqamining nusxasi), eski
  ekranlar va qidiruv shu bo'yicha ishlayveradi

---

## Ekran uchun taklif

**Sklad → Partiyalar** ro'yxati:

| Partiya | Sana | Postavshik | Xil gul | Kelgan | Qolgan | Tannarx |
|---|---|---|---|---|---|---|
| 7 | 01.08.2026 | Golland Flowers | 2 | 200 | 175 | 200 000 |

Qatorga bosilganda partiya ichi ochiladi (`/batches/`) va o'sha yerda
**«Gul qo'shish»** tugmasi turadi. Shunda operator bir marta partiya ochib,
ketma-ket bir nechta gulni kiritadi — har safar sana va postavshikni qayta
tanlamaydi.

---

## Tekshirilgani

201 ta avtotest o'tadi, shundan 6 tasi shu ish uchun yozildi.

Real serverda ham 18 ta holat sinaldi: partiya ochish, ichiga ikkita gul qo'shish,
raqam/sana/postavshikning partiyadan olinishi, partiya jami ko'rsatkichlari,
`998 → 1 000`, `996 → 1 000`, `1 004 → 1 000`, `1 052 → 1 100`, `1 060 → 1 100`,
teskari hisob va partiyasiz qo'shilganda partiyaning o'zi ochilishi. Hammasi o'tdi.
