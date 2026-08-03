# Qarzdorlar — katalogni qarzga sotish

Katalog sotilayotganda naqd va kartadan tashqari **qarz** tanlanadi. Qarzga
berilgan tovar alohida sahifada — kimga, qachon, qanaqa gul, qancha summaga
berilgani rasmi bilan ko'rinadi.

---

## 1. Sotuvda qarz

`payment_type` ga uchinchi qiymat qo'shildi: **`debt`**.

```json
POST /api/catalog/{id}/sell/
{
  "quantity": 1,
  "payment_type": "debt",

  "customer": 12,                       // bor mijoz tanlansa
  "customer_name": "Aziz Karimov",      // yoki yangisi uchun ism
  "customer_phone": "+998901234567",    // va telefon
  "debt_note": "Juma kuni to'laydi"
}
```

| Maydon | Qachon kerak |
|---|---|
| `customer` | Bor mijoz tanlanganda |
| `customer_name` + `customer_phone` | Yangi mijoz kiritilayotganda — **ikkalasi ham** |
| `debt_note` | Ixtiyoriy izoh |

**Mijoz majburiy.** Ikkalasi ham berilmasa:

```json
{ "customer": ["Qarzga sotishda mijozni tanlang yoki ism bilan telefon raqamini kiriting"] }
```

Ism va telefon berilsa mijoz **avtomatik ochiladi**. Telefon bo'yicha bor mijoz
topilsa yangisi ochilmaydi — borga qo'shiladi.

Standart va maxsus (custom) katalogda bir xil ishlaydi. Chegirma bilan sotilsa
qarz ham **chegirmali summa** bo'ladi.

### Forma

To'lov turi tanlagichiga uchinchi tugma: `Naqd` · `Karta` · `Qarz`.
**Qarz** tanlanganda quyida ochiladi:

```
( • ) Bor mijozdan tanlash    [ Aziz Karimov ▾ ]
(   ) Yangi mijoz              Ism [______]  Telefon [______]

Izoh [ Juma kuni to'laydi                    ]
```

---

## 2. Hisob-kitobga ta'siri — muhim

**Qarzga sotilgan katalog sotilgan kunda savdoga kirmaydi.** U **to'langan kuni**,
**to'langan usul** bilan hisobga tushadi.

```
12.08  Qarzga sotildi 300 000   →  o'sha kungi savdo o'zgarmaydi
20.08  Qarz karta bilan to'landi →  20.08 savdosi +300 000, karta ustuniga
```

Ya'ni `/api/accounting/` da to'lanmagan qarz umuman ko'rinmaydi. Bu ataylab —
kassaga tushmagan pul savdo deb hisoblanmaydi.

Sotuv qatorida yangi belgi bor: `paid_from_debt: true` — bu sotuv qarzdan
kelganini bildiradi. `sold_at` esa to'lov sanasini ko'rsatadi.

---

## 3. Qarzdorlar sahifasi

```
GET /api/debts/by-customer/                     to'lanmaganlar (sukut)
GET /api/debts/by-customer/?include_paid=true   to'langanlar ham
```

Ruxsat: `crm` sahifasi.

### Javob

```json
{
  "customers": [
    {
      "customer": 12,
      "name": "Aziz Karimov",
      "phone": "+998901234567",
      "debt_count": 2,
      "unpaid_total": "450000.00",
      "paid_total": "0.00",
      "total": "450000.00",
      "first_debt_at": "2026-08-12T14:20:00+05:00",
      "last_debt_at": "2026-08-14T11:05:00+05:00",
      "items": [
        {
          "id": 7,
          "quantity": 1,
          "amount": "300000.00",
          "note": "Juma kuni to'laydi",
          "is_paid": false,
          "paid_at": null,
          "paid_method": "",
          "created_at": "2026-08-12T14:20:00+05:00",
          "customer_detail": { "id": 12, "name": "Aziz Karimov", "phone": "+998901234567" },
          "catalog_detail": {
            "id": 88,
            "name_uz": "Qizil buket",
            "image_url": "https://.../qizil.jpg",
            "arrangement_type": "bouquet",
            "volume": "M",
            "catalog_kind": "standard",
            "stems_per_item": 25,
            "stems_total": 25
          }
        }
      ]
    }
  ],
  "totals": {
    "customer_count": 2,
    "debt_count": 3,
    "unpaid_total": "650000.00",
    "paid_total": "0.00"
  }
}
```

Mijozlar **eng katta qarzdan** boshlab tartiblangan.

`catalog_detail` ichida sahifa uchun kerakli hammasi bor: **rasm**, katalog nomi,
turi, hajmi, **bir donadagi gul soni** va **jami gul soni**.

### Ekran

```
QARZDORLAR                                    Jami qarz: 650 000

  Aziz Karimov   +998901234567   2 ta   450 000   ▾
    ┌──────────────────────────────────────────────────────────┐
    │ [rasm]  Qizil buket · M   1 ta · 25 gul   300 000   12.08│
    │         «Juma kuni to'laydi»           [ To'landi ]      │
    │ [rasm]  Savat M           1 ta · 25 gul   150 000   14.08│
    │                                        [ To'landi ]      │
    └──────────────────────────────────────────────────────────┘

  Malika Yusupova +998939876543  1 ta   200 000   ▸
```

---

## 4. Qarzni to'lash

```json
POST /api/debts/{id}/pay/
{ "method": "cash" }        // yoki "card"
{ "method": "card", "paid_at": "2026-08-20T15:00:00+05:00" }   // tarixiy to'lov
```

`method` **majburiy** — savdo qaysi ustunga tushishi shundan bilinadi.
`paid_at` berilmasa hozirgi vaqt.

Ikkinchi marta to'lash urinishi:

```json
{ "detail": "Bu qarz allaqachon to'langan" }
```

To'langan qarz sukut bo'yicha qarzdorlar sahifasidan **chiqib ketadi**.

---

## 5. Qarzlarning tekis ro'yxati

Guruhsiz ro'yxat ham bor:

```
GET /api/debts/                          hammasi
GET /api/debts/?is_paid=false            to'lanmaganlar
GET /api/debts/?customer=12              bitta mijoz
GET /api/debts/?paid_method=card         karta bilan to'langanlar
GET /api/debts/?search=Aziz              ism, telefon, izoh, katalog nomi bo'yicha
GET /api/debts/?ordering=-amount         summa bo'yicha
```

---

## Real misol (serverdan)

```
QARZGA SOTILDI
  Aziz Karimov   Qizil buket  1 ta · 25 gul · 300 000  «Juma kuni to'laydi»
  Aziz Karimov   Savat M      1 ta · 25 gul · 150 000
  Malika         Pushti buket 1 ta · 25 gul · 200 000

  Umumiy savdo:  7 080 000 → 7 080 000     ← o'zgarmadi

QARZ TO'LANDI (Savat M, karta)
  Umumiy savdo:  7 080 000 → 7 230 000     ← +150 000
  Karta:         3 600 000 → 3 750 000
  Azizning qolgan qarzi: 300 000
```

---

## Tekshirilgani

285 ta avtotest o'tadi, shundan 9 tasi shu ish uchun yozildi.

Real serverda ham 13 ta holat sinaldi: yangi va bor mijozga qarz, mijozsiz
sotuvning rad etilishi, qarzning savdoga kirmasligi, mijoz bo'yicha guruhlanish,
rasm va gul sonining chiqishi, to'lovdan keyin savdoga karta ustuniga tushishi
va ikkinchi marta to'lab bo'lmasligi.
