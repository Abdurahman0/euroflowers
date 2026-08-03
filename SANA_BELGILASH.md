# Sana belgilash — floristga chiqim va katalog

Ish qolib ketgan bo'lsa endi sanani qo'lda belgilash mumkin. Ikki joyda:
**floristga gul chiqarish** va **katalog qo'shish**.

Ikkalasida ham maydon nomi bir xil: **`created_at`**. Berilmasa hozirgi vaqt
qo'yiladi — ya'ni eski so'rovlar o'zgarishsiz ishlayveradi.

---

## 1. Floristga gul chiqarish

```json
POST /api/florist-stock-issues/issue/
{
  "florist": 4,
  "batch": 178,
  "quantity_stems": 100,
  "reason": "Qolib ketgan chiqim",
  "created_at": "2026-07-28T10:00:00+05:00"
}
```

O'sha kunga **ikkita** yozuv tushadi:

- chiqim yozuvining o'zi (`FloristStockIssue`)
- sklad harakati (`StockMovement`) — sklad jurnalida ham o'sha kun ko'rinadi

Qoldiqlar odatdagidek darrov o'zgaradi — sana faqat yozuv vaqtiga tegishli.

### Qaytarish va chiqit

```json
POST /api/florist-stock-issues/return/
{ "florist": 4, "batch": 178, "quantity_stems": 20, "kind": "return", "created_at": "2026-07-29T09:00:00+05:00" }
```

### Bir nechta gulni birdan

```json
POST /api/florist-stock-issues/bulk-issue/
{
  "florist": 4,
  "items": [
    { "batch": 178, "quantity_stems": 100 },
    { "batch": 179, "quantity_stems": 50 }
  ],
  "created_at": "2026-07-27T08:00:00+05:00"
}
```

Hamma chiqim va harakat o'sha bitta kunga tushadi.

---

## 2. Katalog qo'shish

```json
POST /api/catalog/
{
  "name_uz": "O'tgan kungi buket",
  "arrangement_type": "bouquet",
  "volume": "M",
  "florist": 4,
  "price": "500000",
  "quantity_total": 1,
  "composition": [ { "stock_batch": 178 } ],
  "created_at": "2026-07-30T12:00:00+05:00"
}
```

O'sha kunga **uchta** narsa tushadi:

| Nima | Nega muhim |
|---|---|
| Katalogning o'zi | Ro'yxatda to'g'ri kunda turadi |
| Katalog tarixi (`created` yozuvi) | Tarix bo'yicha hisobotlar to'g'ri chiqadi |
| **Florist ish haqining ish sanasi** | Florist o'sha kunlik ishiga haq oladi, bugungi kunga tushib qolmaydi |

Oxirgisi ayniqsa muhim — floristning kunlik hisoboti buzilmaydi.

### Sanani keyin tuzatish

Xato yozilgan bo'lsa tahrirda o'zgartiriladi:

```json
PATCH /api/catalog/{id}/
{ "created_at": "2026-07-26T15:00:00+05:00" }
```

Bunda ham tarix yozuvi va ish haqi sanasi birga siljiydi.

---

## Forma uchun

Ikkala oynaga ham sana maydoni qo'shing, **sukut bo'yicha bugungi kun**:

```
Sana  [ 03.08.2026 ]      ← odatda tegilmaydi
```

Agar operator o'tgan kunni tanlasa vaqt ham kerak bo'ladi. Vaqt so'ramasangiz
kunning ixtiyoriy vaqtini qo'ying (masalan `12:00`) — muhimi kun to'g'ri bo'lsin.

Kelajak sanani tanlab qo'ymaslik uchun kalendarda yuqori chegarani bugunga
qo'yish tavsiya qilinadi.

---

## Nima o'zgarmadi

- Sana berilmasa hammasi ilgarigidek — hozirgi vaqt qo'yiladi
- Sklad qoldig'i, floristdagi qoldiq, tannarx, hisob-kitob — hech biriga
  ta'sir qilmaydi, faqat yozuv vaqti o'zgaradi
- Sotuv sanasi (`sold_at`) ilgaridan ham bor edi — u alohida maydon,
  `POST /api/catalog/{id}/sell/` da yuboriladi

---

## Real misol (serverdan)

```
CHIQIM
  created_at 2026-07-28  →  chiqim yozuvi   28.07
                            sklad harakati  28.07
  sanasiz                →  bugungi kun     03.08

KATALOG
  created_at 2026-07-30  →  katalog         30.07
                            tarix yozuvi    30.07
                            ish haqi sanasi 30.07

  keyin PATCH 2026-07-26 →  katalog         26.07
```

---

## Tekshirilgani

305 ta avtotest o'tadi, shundan 8 tasi shu ish uchun yozildi: chiqim,
qaytarish va bulk chiqimning sanasi, sanasiz holatda bugungi kun, katalog
sanasi, tarix yozuvi, florist ish haqi sanasi va keyin tuzatish.

Real serverda ham 9 ta holat sinaldi — hammasi o'tdi.
