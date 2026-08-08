# Partiya kirimi — nav olib tashlandi, bir xil narxlilar qo'shiladi

> **Hali serverga chiqarilmagan.** Backend tayyor va testdan o'tgan, lekin prodda eski holat turibdi. Frontend tayyor bo'lganda ikkalasi birga chiqariladi. Shu hujjat bo'yicha ishlab tura bering.

---

## Nima o'zgardi

Postavshik ham, yuk ham bitta bo'lgani uchun kirimda **gul navi so'ralmaydi**. Endi qator shunday:

```
gul  +  bo'y  +  tannarx  +  sotuv narxi  +  soni
```

Va shu partiya ichida **guli, bo'yi va tannarxi bir xil** qator allaqachon bo'lsa — yangi qator ochilmaydi, soni o'sha qatorga qo'shiladi.

**Oldin** — 40 sm atirgulning 12 navi kelsa 12 ta qator to'ldirilardi, skladda ham 12 ta qator turardi:

```
Atirgul · Freedom · qizil  · 40 sm · 8 000 · 100 dona
Atirgul · Explorer · oq    · 40 sm · 8 000 · 130 dona
Atirgul · Mondial · pushti · 40 sm · 8 000 · 150 dona
```

**Endi** — bitta qator:

```
Atirgul · 40 sm · 8 000 · 380 dona
```

---

## 1. Kirim formasi

Nav va rang maydonlari **olib tashlanadi**. Gul ro'yxati qoladi.

```
┌─ PARTIYAGA GUL QO'SHISH ────────────────────────┐
│                                                 │
│   Gul        [ Atirgul              ▾ ]         │
│   Bo'y       [ 40         ] sm                  │
│   Pochkada   [ 25         ] dona                │
│   Tannarx    [ 8 000      ] so'm / dona         │
│   Sotuv      [ 15 000     ] so'm / dona         │
│   Soni       [ 380        ] dona                │
│                                                 │
│                          [ Qo'shish ]           │
└─────────────────────────────────────────────────┘
```

### So'rov

```http
POST /api/stock-batches/
```

```json
{
  "delivery": 114,
  "flower": 7,
  "height_cm": 40,
  "stems_per_bunch": 25,
  "cost_per_stem": "8000",
  "sale_price_per_stem": "15000",
  "received_stems": 380
}
```

| Maydon | Izoh |
|---|---|
| `flower` | **Yangi va majburiy.** `/api/flowers/` dagi gul ID si. `variant` o'rniga shu yuboriladi. |
| `variant` | Endi majburiy emas. Eski partiyalarni tahrirlash uchun qoldirilgan, yangi kirimda ishlatilmaydi. |
| `delivery` | Partiya ID si. Berilmasa `batch_number` bo'yicha topiladi yoki ochiladi — bu o'zgarmagan. |
| `height_cm` | Bo'y. Oraliq kerak bo'lsa `height_from_cm` / `height_to_cm` — bu ham o'zgarmagan. |
| `cost_per_stem` | Tannarx. Pochkada bersangiz `cost_per_bunch` — bu ham o'zgarmagan. |
| `received_stems` | Soni. Pochkada bersangiz `received_bunches`. |

`flower` yuborilmasa **400** qaytadi:

```json
{ "flower": "Gulni tanlang" }
```

### Javob

Javobda uchta yangi maydon bor:

```json
{
  "id": 412,
  "merged": true,
  "merged_stems": 130,
  "received_stems": 380,
  "remaining_stems": 380,
  "title": "Atirgul 40 sm",
  "flower_name": "Atirgul",
  "flower_detail": { "id": 7, "name_uz": "Atirgul", "...": "..." },
  "height_label": "40 sm",
  "cost_per_stem": "8000.00",
  "sale_price_per_stem": "15000.00"
}
```

| Maydon | Ma'nosi |
|---|---|
| `merged` | `true` — mavjud qatorga qo'shildi, `false` — yangi qator ochildi |
| `merged_stems` | **Aynan shu safar qo'shilgan son.** Yangi qatorda `received_stems` ga teng |
| `received_stems` | Qatordagi **umumiy** son, hamma qo'shilganidan keyin |
| `title` | Skladda ko'rsatiladigan nom — gul va bo'y |
| `flower_name` | Faqat gul nomi |
| `flower_detail` | Gulning to'liq obyekti |

> **Diqqat:** qo'shilganda ham status **201** qaytadi va `id` mavjud qatornikini beradi. Yangi qator ochilgan-ochilmaganini `merged` bo'yicha bilib oling, status bo'yicha emas.

Foydalanuvchiga qaytimni shunday ko'rsatish tavsiya qilinadi:

```
✓  Atirgul 40 sm qatoriga 130 dona qo'shildi.
   Qatorda jami 380 dona.
```

yangi qatorda esa:

```
✓  Atirgul 40 sm — 380 dona qo'shildi.
```

---

## 2. Qachon qo'shiladi, qachon yangi qator ochiladi

Beshta shart **hammasi** to'g'ri kelsa qo'shiladi:

| # | Shart |
|---|---|
| 1 | Bitta partiya (`delivery`) |
| 2 | Bitta gul (`flower`) |
| 3 | Bo'y bir xil (`height_cm`, `height_from_cm`, `height_to_cm`) |
| 4 | Tannarx bir xil (`cost_per_stem`) |
| 5 | Ikkalasi ham tekin yoki ikkalasi ham pulli (`is_free`) |

Bittasi farq qilsa — yangi qator.

```
QO'SHILADI
  Atirgul 40 sm 8 000 → 100 dona
  Atirgul 40 sm 8 000 → 130 dona
  ────────────────────────────────
  Atirgul 40 sm 8 000 · 230 dona

QO'SHILMAYDI
  Atirgul 40 sm 8 000     ┐
  Atirgul 30 sm 8 000     │ bo'yi boshqa
  Atirgul 40 sm 9 000     │ tannarxi boshqa
  Xrizantema 40 sm 8 000  │ guli boshqa
  Atirgul 40 sm tekin     ┘ tekin gul alohida
```

**Sotuv narxi kalitga kirmaydi.** Ya'ni tannarxi bir xil bo'lsa, sotuv narxi boshqa kiritilsa ham qo'shiladi.

---

## 3. Sotuv narxi — oxirgisi qoladi

Bitta qatorda ikki xil sotuv narxi turolmaydi. Shuning uchun oxirgi kiritilgan sotuv narxi **butun qatorga** o'rnatiladi — oldin kirgan gullar ham shu narxda sotiladi.

```
Qator:  Atirgul 40 sm · tannarx 8 000 · sotuv 15 000 · 100 dona
Yangi:  380 dona, sotuv 18 000
        ↓
Qator:  Atirgul 40 sm · tannarx 8 000 · sotuv 18 000 · 480 dona
```

Pochka narxlari (`cost_per_bunch`, `sale_price_per_bunch`) qatorning `stems_per_bunch` iga qarab avtomatik qayta hisoblanadi.

### Frontendda ogohlantirish qo'ying

Bu jimgina bo'lib ketmasligi kerak — foydalanuvchi bilmay turib eski gullarning narxini o'zgartirib yuborishi mumkin. Formada gul, bo'y va tannarx tanlangandan keyin mavjud qatorni tekshiring:

```http
GET /api/stock-batches/?delivery=114&flower=7&height_cm=40&is_active=true
```

Qaytgan qatorda `cost_per_stem` mos kelsa va `sale_price_per_stem` foydalanuvchi kiritayotganidan boshqa bo'lsa:

```
⚠  Bu qatorda sotuv narxi 15 000 so'm turibdi.
   18 000 kiritsangiz, qatordagi 100 dona ham
   shu narxda sotiladi.

   [ Bekor ]              [ Davom etish ]
```

Backend to'sib qo'ymaydi — bu faqat foydalanuvchini ogohlantirish.

---

## 4. Sklad ro'yxati

Qatorlar o'zi kamayadi, alohida ish qilish shart emas. Ikkita qulaylik qo'shildi:

**Gul bo'yicha filtr**

```http
GET /api/stock-batches/?flower=7
```

**Tayyor nom** — `title` va `flower_name` maydonlaridan foydalaning, gul va navni o'zingiz yig'ishtirmang:

```
SKLAD

Atirgul      40 sm    8 000 / 15 000    380 dona
Atirgul      30 sm    6 000 / 12 000    200 dona
Xrizantema   50 sm   10 000 / 20 000    120 dona
```

`variant_detail` hamon qaytadi — eski partiyalarda haqiqiy nav turibdi va uni ko'rsatish kerak. Yangi qatorlarda `variant_detail.name_uz` va `variant_detail.color_uz` bo'sh bo'ladi, `variant_detail.is_general` esa `true`. Shuning uchun nomni **qo'lda yig'manlar** — `title` ishlating, aks holda bo'sh joy va ortiqcha ajratgich chiqadi.

---

## 5. Nav ro'yxati

Har gulga bitta texnik "navsiz" qator ochiladi — kirim shunga bog'lanadi. U foydalanuvchi uchun nav emas, shuning uchun **ro'yxatdan chiqarib tashlandi**:

```http
GET /api/flower-variants/          → navsiz qatorlar ko'rinmaydi
GET /api/flower-variants/?is_general=true   → faqat o'shalar
```

Ya'ni nav sahifasi o'zi to'g'ri ishlaydi, hech narsa qilish shart emas. Yangi maydon:

| Maydon | Ma'nosi |
|---|---|
| `is_general` | `true` — bu texnik qator, foydalanuvchiga ko'rsatilmaydi |

Nav ma'lumotnomasining o'zi joyida qoladi — eski partiyalar unga bog'langan va gul tavsiflari AI da ishlatiladi. Faqat **kirimda** ishlatilmaydi.

---

## 6. Xato gulni to'g'rilash

`change-variant` o'rniga `change-flower`:

```http
POST /api/stock-batches/412/change-flower/
```

```json
{ "flower": 9, "reason": "Kirimda xato yozilgan" }
```

Ishlatilgan partiyada ham ishlaydi — katalog tarkibi, sklad harakatlari va sotuv tarixidagi nom ham moslanadi. `reason` majburiy.

Javob — partiyaning o'zi, ustiga:

```json
{
  "variant_change": {
    "old_variant": "Atirgul",
    "new_variant": "Xrizantema",
    "usage": { "catalog_items": 2, "sold_catalog_items": 1, "florist_issues": 3, "...": "..." },
    "history_rows_updated": 1
  }
}
```

Almashtirishdan oldin qayerda ishlatilganini ko'rsatish uchun:

```http
GET /api/stock-batches/412/usage/
```

Javobga `flower` va `title` qo'shildi.

`change-variant` hali ham ishlaydi va aynan shu narsani qiladi — eski chaqiruvlar buzilmaydi, lekin yangi kodda `change-flower` ishlating.

### Oddiy PATCH bilan almashtirib bo'lmaydi

Partiyadan gul ishlatilgan bo'lsa `PATCH /api/stock-batches/{id}/` bilan gulni o'zgartirsangiz **400** qaytadi. Xato xabari endi `flower` kalitida keladi (oldin `variant` edi):

```json
{ "flower": "Bu partiyadan allaqachon gul ishlatilgan. Gulni almashtirish uchun «change-flower» amalidan foydalaning — u ishlatilgan joylarni ham moslaydi." }
```

---

## 7. Nima o'zgarmadi

Bularga tegmang, hammasi avvalgidek:

- Partiya (`/api/stock-deliveries/`) — raqam, sana, postavshik, izoh
- Narxni pochkada berish (`cost_per_bunch`, `sale_price_per_bunch`, `received_bunches`)
- Yaxlitlash va `rounding` bloki
- Bo'y oralig'i (`height_from_cm` / `height_to_cm`)
- Tekin gul (`is_free`)
- Kelgan sonni tuzatish, floristga chiqarish, katalog tarkibi, restavratsiya, filialga o'tkazish
- Material partiyasi (`/api/material-deliveries/`) — gul bilan aloqasi yo'q

Kirim jurnali ham to'g'ri qoladi: har safar qo'shganda alohida `StockMovement` yoziladi, shuning uchun `/api/stock-movements/?batch=412` da qaysi kun qancha kelgani ko'rinib turadi.

---

## Qisqacha

1. Kirim formasidan **nav va rang** maydonlarini olib tashlang
2. `POST /api/stock-batches/` ga `variant` emas, **`flower`** yuboring
3. Javobdagi **`merged`** va **`merged_stems`** bo'yicha xabar ko'rsating — qo'shildimi yoki yangi qator ochildimi
4. Sotuv narxi boshqa kiritilayotganda **ogohlantiring** — u butun qatorga o'rnatiladi
5. Sklad ro'yxatida nomni **`title`** dan oling, qo'lda yig'mang
6. `change-variant` o'rniga **`change-flower`**, xato kaliti `variant` emas **`flower`**
7. Nav sahifasiga tegish shart emas — texnik qatorlar server tomonda yashirilgan
