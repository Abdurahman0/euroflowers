# Restavratsiya (Catalog Rework) — Frontend API

Tayyor katalog mahsulotini buzib, undan yangi mahsulot(lar) yasash. Skladdan qo'shimcha gul olish mumkin. Florist haqi qo'lda kiritiladi.

---

## Nima uchun kerak

Vitrinadagi buket sotilmay qoladi yoki ko'rinishi buziladi. Uni chiqitga tashlamay, florist sug'urib, gullarini boshqa buketlarga ishlatadi.

**1-holat.** Kichkina buket bor, katta kerak → kichkinani buzamiz, skladdan gul qo'shamiz, 1 ta katta yasaymiz.

**2-holat.** Katta buket sotilmadi → buzamiz, skladdan gul qo'shamiz, 2 ta o'rtancha va 3 ta kichkina yasaymiz.

Ikkalasida ham floristni tanlash va unga haq yozish kerak, skladdan olingan gul aniq hisoblanishi kerak.

---

## Asosiy qoidalar

1. **Buzilgan katalogning guli skladdan qayta yechilmaydi.** U katalog yasalganda allaqachon yechilgan. Buzilganda gul to'g'ridan-to'g'ri yangi mahsulot tarkibiga o'tadi.
2. **Faqat qo'shimcha olingan gul skladdan kamayadi.** Har biriga `StockMovement` yoziladi, sklad qoldig'i aniq shuncha kamayadi.
3. **Chiqim guli kirimdan ko'p bo'lmasligi kerak.** Farq — yo'qotish (`waste_stems`).
4. **Florist haqi qo'lda kiritiladi.** Avtomatik hisoblanmaydi, chunki ish hajmi har xil.
5. **Tannarx avtomatik proporsional taqsimlanadi.** Gul soniga qarab. Qo'lda o'zgartirilmaydi.
6. **Buzilgan mahsulot sotuvda ko'rinmaydi**, lekin restavratsiya tarixida va o'z tarixida qoladi.
7. **Bir nechta manba va bir nechta chiqim** bo'lishi mumkin.
8. **Qisman buzish** mumkin — 3 tadan 1 tasini.

---

## Endpointlar

| Metod | URL | Vazifa |
|---|---|---|
| `GET` | `/api/catalog-reworks/` | Restavratsiya tarixi |
| `GET` | `/api/catalog-reworks/{id}/` | Bitta hujjat |
| `POST` | `/api/catalog-reworks/` | Yangi restavratsiya |

**Ruxsat:** `catalog` sahifasi. `GET` uchun `can_view`, `POST` uchun `can_control`.

Filtr: `?florist={id}`
Tartib: `?ordering=-created_at` (default), `florist_amount`, `input_stems`, `output_stems`

---

## POST `/api/catalog-reworks/`

### So'rov

```json
{
  "florist": 3,
  "florist_amount": "150000",
  "note": "Vitrinadagi katta buket buzildi",

  "sources": [
    { "catalog_item": 41, "quantity": 1 }
  ],

  "stock_inputs": [
    { "stock_batch": 21, "quantity_stems": 40 }
  ],

  "outputs": [
    {
      "name_uz": "O'rtancha buket",
      "arrangement_type": "bouquet",
      "quantity": 2,
      "price": "450000",
      "composition": [
        { "stock_batch": 21, "quantity_stems": 25 }
      ],
      "materials": [
        { "packaging": 7, "quantity": 1 }
      ]
    },
    {
      "name_uz": "Kichkina buket",
      "arrangement_type": "bouquet",
      "quantity": 3,
      "price": "280000",
      "composition": [
        { "stock_batch": 21, "quantity_stems": 15 }
      ]
    }
  ]
}
```

### Maydonlar

**Yuqori daraja**

| Maydon | Turi | Majburiy | Izoh |
|---|---|---|---|
| `florist` | int | ha | `FloristProfile.id` — kim ishladi |
| `florist_amount` | decimal | yo'q, default `0` | **Qo'lda kiritiladi.** Manfiy bo'lmaydi |
| `note` | string | yo'q | Izoh |
| `sources` | array | — | Buziladigan katalog mahsulotlari |
| `stock_inputs` | array | — | Skladdan qo'shimcha gul |
| `outputs` | array | **ha** | Yangi mahsulotlar, kamida 1 ta |

> `sources` va `stock_inputs` dan **kamida bittasi** bo'lishi shart.

**`sources[]`**

| Maydon | Turi | Izoh |
|---|---|---|
| `catalog_item` | int | Buziladigan katalog `id` |
| `quantity` | int ≥ 1 | Nechta dona buziladi. Default `1` |

**`stock_inputs[]`**

| Maydon | Turi | Izoh |
|---|---|---|
| `stock_batch` | int | Partiya `id` |
| `quantity_stems` | int ≥ 1 | **Aniq dona soni.** Sklad shuncha kamayadi |

**`outputs[]`**

| Maydon | Turi | Majburiy | Izoh |
|---|---|---|---|
| `name_uz` | string | ha | Mahsulot nomi |
| `arrangement_type` | enum | yo'q | `bouquet` / `basket` / `box`. Default `bouquet` |
| `quantity` | int ≥ 1 | yo'q | Nechta dona yasaladi. Default `1` |
| `price` | decimal | ha | Bir donaning sotuv narxi |
| `composition` | array | ha | **Bir dona uchun** gul tarkibi |
| `materials` | array | yo'q | **Bir dona uchun** qadoq |
| `volume` | string | yo'q | Hajm nomi |
| `description_uz` | string | yo'q | Tavsif |
| `note` | string | yo'q | Ichki izoh |
| `height_cm` | int | yo'q | Balandlik |
| `diameter_cm` | int | yo'q | Diametr |
| `image_url` | string | yo'q | Rasm |
| `status` | enum | yo'q | `available` / `draft`. Default `available` |
| `branch` | int | yo'q | Filial `id` |
| `catalog_kind` | enum | yo'q | `standard` / `custom`. Default `standard` |

> **Diqqat:** `composition[].quantity_stems` — bu **bitta dona uchun** gul soni.
> `quantity: 2` va `quantity_stems: 25` bo'lsa, jami 50 dona ishlatiladi.

### Javob — `201 Created`

```json
{
  "id": 12,
  "florist": 3,
  "florist_name": "Dilnoza",
  "florist_amount": "150000.00",

  "input_stems": 100,
  "output_stems": 95,
  "waste_stems": 5,
  "input_cost": "1000000.00",
  "waste_cost": "50000.00",

  "note": "Vitrinadagi katta buket buzildi",
  "created_by": 1,
  "created_by_name": "Admin EuroFlowers",
  "created_at": "2026-07-29T16:20:11+05:00",
  "updated_at": "2026-07-29T16:20:11+05:00",

  "sources": [
    {
      "id": 9,
      "catalog_item": 41,
      "catalog_item_name": "Katta buket",
      "quantity": 1,
      "stems": 60,
      "unit_cost": "600000.00",
      "cost": "600000.00"
    }
  ],

  "stock_inputs": [
    {
      "id": 5,
      "stock_batch": 21,
      "batch_number": "EF-260725-26",
      "variant_name": "Atirgul prut oq",
      "quantity_stems": 40,
      "cost": "400000.00"
    }
  ],

  "outputs": [
    {
      "id": 14,
      "catalog_item": 88,
      "catalog_item_name": "O'rtancha buket",
      "catalog_item_price": "450000.00",
      "image_url": "",
      "quantity": 2,
      "stems": 50,
      "allocated_cost": "578947.00",
      "allocated_florist_amount": "78947.00"
    },
    {
      "id": 15,
      "catalog_item": 89,
      "catalog_item_name": "Kichkina buket",
      "catalog_item_price": "280000.00",
      "image_url": "",
      "quantity": 3,
      "stems": 45,
      "allocated_cost": "521053.00",
      "allocated_florist_amount": "71053.00"
    }
  ]
}
```

### Hisoblangan maydonlar

| Maydon | Ma'nosi |
|---|---|
| `input_stems` | Buzilgan katalog guli + skladdan olingan gul |
| `output_stems` | Yangi mahsulotlardagi jami gul |
| `waste_stems` | `input_stems − output_stems`. Ishga yaramagan gul |
| `input_cost` | Buzilgan katalog tannarxi + yangi gul tannarxi |
| `waste_cost` | Yo'qotilgan qiymat — gul va tashlangan qadoq |
| `allocated_cost` | Yangi mahsulotning hisoblangan tannarxi |
| `allocated_florist_amount` | Shu mahsulotga tegishli florist haqi ulushi |

`allocated_florist_amount` yig'indisi doim `florist_amount` ga teng — oxirgi mahsulotga qoldiq qo'shiladi, tiyin yo'qolmaydi.

---

## Xato javoblari — `400 Bad Request`

Barchasi `{"detail": "..."}` shaklida.

| Holat | Xabar |
|---|---|
| Chiqimga gul yetmadi | `EF-260725-26 guli yetmayapti: mavjud 100 dona, kerak 120 dona` |
| Katalogda dona yetmadi | `Katta buket katalogida atigi 2 dona qolgan` |
| Skladda qoldiq yetmadi | `EF-260725-26 partiyasida atigi 30 dona qolgan` |
| Chiqim kirimdan ko'p | `Yangi mahsulotlardagi gul soni kirimdan ko'p bo'lmasligi kerak` |
| Tarkib bo'sh | `O'rtancha buket uchun gul tarkibi kiritilmagan` |
| Manba tanlanmagan | `Kamida bitta buziladigan katalog yoki skladdan gul tanlang` |
| Chiqim yo'q | `Kamida bitta yangi mahsulot kiritilishi kerak` |
| Florist haqi manfiy | `Florist haqi manfiy bo'lmaydi` |

Validatsiya xatolari (`serializers`) odatdagi DRF formatida keladi — maydon nomi va xabarlar ro'yxati.

---

## Ekran oqimi

```
┌─ Restavratsiya ────────────────────────────────────────┐
│                                                        │
│  1. BUZILADIGAN MAHSULOT                               │
│     [+ Katalogdan tanlash]                             │
│     • Katta buket   ×[1]   60 dona   600 000 so'm  [×] │
│                                                        │
│  2. SKLADDAN QO'SHIMCHA GUL     (ixtiyoriy)            │
│     [+ Partiyadan tanlash]                             │
│     • Atirgul prut oq   [40] dona   400 000 so'm   [×] │
│                                                        │
│     ── Jami kirim: 100 dona · 1 000 000 so'm ──        │
│                                                        │
│  3. YANGI MAHSULOTLAR                                  │
│     [+ Mahsulot qo'shish]                              │
│     ┌──────────────────────────────────────────────┐   │
│     │ Nomi     [O'rtancha buket        ]           │   │
│     │ Turi     [Buket ▾]   Soni [2]                │   │
│     │ Narxi    [450 000]                           │   │
│     │ Tarkibi  Atirgul prut oq  [25] dona/dona     │   │
│     │          → jami 50 dona                      │   │
│     └──────────────────────────────────────────────┘   │
│     ┌──────────────────────────────────────────────┐   │
│     │ Kichkina buket · 3 dona · 15 dona/dona = 45  │   │
│     └──────────────────────────────────────────────┘   │
│                                                        │
│     ── Jami chiqim: 95 dona ──                         │
│     ── Yo'qotish: 5 dona ──                            │
│                                                        │
│  4. FLORIST                                            │
│     Kim ishladi  [Dilnoza ▾]                           │
│     Haqi         [150 000] so'm      ← qo'lda          │
│                                                        │
│  Izoh [                                    ]           │
│                        [Bekor]  [Saqlash]              │
└────────────────────────────────────────────────────────┘
```

### Frontda real vaqtda hisoblanadigan ko'rsatkichlar

Saqlashdan oldin foydalanuvchi ko'rishi kerak:

```js
// Kirim
const sourceStems = sources.reduce((sum, s) =>
  sum + s.item.composition.reduce((a, c) => a + c.quantity_stems, 0) * s.quantity, 0)
const stockStems  = stockInputs.reduce((sum, r) => sum + r.quantity_stems, 0)
const inputStems  = sourceStems + stockStems

// Chiqim
const outputStems = outputs.reduce((sum, o) =>
  sum + o.composition.reduce((a, c) => a + c.quantity_stems, 0) * o.quantity, 0)

// Yo'qotish
const wasteStems = inputStems - outputStems   // manfiy bo'lsa Saqlash tugmasi o'chiq
```

**Partiya bo'yicha tekshiruv.** Har bir partiya uchun alohida:

```js
// mavjud = buzilgan katalogdagi shu partiya guli + skladdan olingani
// kerak  = barcha chiqimlardagi shu partiya guli
// kerak > mavjud bo'lsa qizil ogohlantirish va Saqlash o'chiq
```

Backend ham shuni tekshiradi, lekin frontda ko'rsatilsa foydalanuvchi qulayroq ishlaydi.

---

## Buzilgan mahsulot keyin qayerda ko'rinadi

**Sotuvda ko'rinmaydi.** `GET /api/catalog/` va AI katalogi buzilgan donalarni chiqarmaydi. Hisob:

```
qoldiq = quantity_total − quantity_sold − quantity_wasted − quantity_reworked
```

`quantity_reworked` — `CatalogItem` ga qo'shilgan yangi maydon. Hammasi buzilsa `status` avtomatik `archived` bo'ladi (agar avval sotilgan bo'lsa `sold`).

**Ko'rinadigan joylar:**

1. `GET /api/catalog-reworks/` — restavratsiya tarixi
2. `GET /api/catalog/{id}/` — `quantity_reworked` maydoni
3. Mahsulot tarixida — `CatalogHistory` yozuvi, `action: "reworked"`

Katalog kartochkasida ko'rsatish tavsiya qilinadi:

```
Jami 3 · Sotildi 1 · Restavratsiyada 1 · Qoldi 1
```

---

## Florist oyligi

Har bir restavratsiya uchun bitta yozuv yaratiladi:

```json
{
  "florist": 3,
  "amount": "150000.00",
  "source": "rework",
  "rework": 12,
  "work_date": "2026-07-29"
}
```

`GET /api/florist-salary/?source=rework` bilan ajratib olish mumkin. `FloristSalaryEntry.source` ro'yxatiga `rework` qiymati qo'shildi — oylik ekranidagi filtr va legendaga qo'shish kerak.

`florist_amount: 0` bo'lsa oylik yozuvi yaratilmaydi.

---

## Sklad harakati

Har bir `stock_inputs` uchun:

```json
{
  "movement_type": "out",
  "quantity_stems": -40,
  "reference_type": "catalog_rework",
  "reference_id": 12,
  "reason": "Restavratsiya #12 uchun olindi"
}
```

`GET /api/stock-movements/?reference_type=catalog_rework` bilan filtrlash mumkin.

Buzilgan katalogning guli uchun sklad harakati **yaratilmaydi** — u allaqachon hisobdan chiqqan.

---

## Yangi mahsulotning sklad holati

Yaratilgan mahsulotlarga `quantity_stock_deducted = quantity_total` va `stock_deducted_at` qo'yiladi. Ya'ni ular **allaqachon skladdan yechilgan** deb belgilanadi.

Shuning uchun frontda bu mahsulotlar uchun **"Skladdan yechish" tugmasi ko'rsatilmasin** — bosilsa backend `400` qaytaradi. Buni `quantity_stock_deducted >= quantity_total` sharti bilan aniqlash mumkin.

---

## Misollar

### 1-holat: kichkinadan katta

```json
{
  "florist": 3,
  "florist_amount": "60000",
  "sources": [{ "catalog_item": 41, "quantity": 1 }],
  "stock_inputs": [{ "stock_batch": 21, "quantity_stems": 25 }],
  "outputs": [{
    "name_uz": "Katta buket",
    "quantity": 1,
    "price": "900000",
    "composition": [{ "stock_batch": 21, "quantity_stems": 50 }]
  }]
}
```

Natija: `input_stems: 50`, `output_stems: 50`, `waste_stems: 0`, sklad −25 dona.

### Bir nechta buketni birlashtirish

```json
{
  "florist": 3,
  "florist_amount": "50000",
  "sources": [
    { "catalog_item": 41, "quantity": 1 },
    { "catalog_item": 42, "quantity": 1 }
  ],
  "outputs": [{
    "name_uz": "Katta buket",
    "quantity": 1,
    "price": "800000",
    "composition": [{ "stock_batch": 21, "quantity_stems": 40 }]
  }]
}
```

Skladdan hech narsa olinmaydi — `stock_inputs` bo'sh.

### Qisman buzish

`quantity_total: 3` bo'lgan mahsulotdan 1 tasini buzish:

```json
{ "sources": [{ "catalog_item": 41, "quantity": 1 }] }
```

Mahsulot `available` holicha qoladi, `quantity_reworked: 1`, sotuvda 2 dona ko'rinadi.

---

## Eslatma — eski endpoint

`POST /api/catalog/{id}/restore-flowers/` saqlanib qoldi. U faqat bitta gulni boshqasiga almashtiradi va florist haqini yozmaydi. Yangi ishlarda `catalog-reworks` ishlatilsin.
