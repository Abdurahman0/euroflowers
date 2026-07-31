# Hisob-kitob — filial bo'yicha ajratma

Parkent filialiga yuborilgan kataloglar u yerda sotilganda endi **umumiy hisob-kitobga
kiradi**, lekin qaysi filialdan qancha kelgani **aniq ajratib** ko'rsatiladi.

Endpoint: `GET /api/accounting/`

---

## ⚠️ Eng muhim o'zgarish

Ilgari admin `/api/accounting/` ni chaqirganda **faqat asosiy filial** sotuvlari kelardi.
Endi **sukut bo'yicha hamma filial** keladi. Ya'ni `summary.total_sales` qiymati oshadi.

Eski sonni olish uchun: `GET /api/accounting/?branch=main`

`summary` ichidagi eski kalitlarning hammasi joyida qoldi — hech narsa sinmaydi,
faqat yangi kalitlar qo'shildi.

---

## Filial filtri

| So'rov | Nima keladi |
|---|---|
| `/api/accounting/` | Hamma filial (sukut) |
| `/api/accounting/?branch=all` | Hamma filial |
| `/api/accounting/?branch=main` | Faqat Toshkent (asosiy filial) |
| `/api/accounting/?branch=2` | Faqat o'sha filial (id bo'yicha) |

Sana filtri ilgarigidek: `?date_from=2026-07-01&date_to=2026-07-31` — filial filtri bilan
birga ishlatilaveradi.

**Filial foydalanuvchisi** (masalan `parkent_admin`) qanday parametr yuborsa ham faqat
o'z filialini ko'radi. `?branch=all` ham unga ta'sir qilmaydi. Bu himoya backendda,
frontendda tekshirish shart emas — lekin filial foydalanuvchisiga filial tanlash
tugmasini **ko'rsatmaslik** kerak.

---

## Javob strukturasi

```json
{
  "period":        { "date_from": null, "date_to": null },
  "branch_filter": { "mode": "all", "branch_id": null, "branch_name": null },
  "summary":       { ... umumiy yig'indi ... },
  "by_branch":     [ ... har filial alohida ... ],
  "by_kind":       [ ... ],
  "by_payment":    [ ... ],
  "by_volume":     [ ... ],
  "discounted_sales": [ ... ],
  "history":       [ ... ]
}
```

`branch_filter.mode` — `all` | `main` | `branch`. Sarlavhada nima ko'rsatishni shundan oling.

---

## `by_branch` — asosiy yangilik

Massiv. Birinchi qator **doim asosiy filial**, keyin filiallar nomi bo'yicha.
Hamma qatorlar bir xil kalitlarga ega, `summary` ham aynan shu shaklda —
bitta komponent bilan ikkalasini ham chizsa bo'ladi.

| Kalit | Turi | Ma'nosi |
|---|---|---|
| `branch_id` | int / null | `null` = asosiy filial |
| `branch_name` | string | `"Toshkent (asosiy filial)"` yoki `"Parkent filiali"` |
| `is_main` | bool | Asosiy filialmi |
| `sales_count` | int | **Sotuvlar soni** (nechta marta sotildi) |
| `total_quantity` | int | **Sotilgan buket/savat soni** |
| `flower_stems` | int | **Sotilgan gul donasi** |
| `standard_quantity` | int | Standart katalogdan sotilgan soni |
| `custom_quantity` | int | Custom katalogdan sotilgan soni |
| `total_sales` | decimal | **Savdo** (tushum) |
| `cash_total` | decimal | **Naqd** summa |
| `cash_count` | int | Naqd sotuvlar soni |
| `cash_quantity` | int | Naqd sotilgan buket soni |
| `card_total` | decimal | **Karta** summa |
| `card_count` | int | Karta sotuvlar soni |
| `card_quantity` | int | Karta sotilgan buket soni |
| `unknown_total` / `unknown_count` / `unknown_quantity` | | To'lov turi belgilanmagan sotuvlar |
| `discount_total` | decimal | Berilgan skidka summasi |
| `discounted_sales_count` | int | Skidkali sotuvlar soni |
| `discounted_quantity` | int | Skidka bilan ketgan buket soni |
| `cost_total` | decimal | Tannarx |
| `flower_cost_total` | decimal | Tannarxning gul qismi |
| `material_cost_total` | decimal | Tannarxning material qismi |
| `florist_fee_cost_total` | decimal | Tannarxning florist haqi qismi |
| `waste_cost_total` | decimal | Chiqit qiymati |
| `waste_stems` | int | Chiqit gul donasi |
| `net_profit` | decimal | **Sof foyda** = savdo − tannarx |
| `share_percent` | decimal | **Umumiy savdodagi ulushi, %** |

### Kafolatlangan qoidalar

- `by_branch` qatorlarining `total_sales` yig'indisi **aynan** `summary.total_sales` ga teng.
  Naqd, karta, gul donasi, tannarx uchun ham shunday. Frontendda qayta hisoblash shart emas.
- `share_percent` yig'indisi 100 ga teng (yaxlitlash farqi bo'lishi mumkin).
- **Chiqit faqat asosiy filialda.** Filiallarda gul saqlanmaydi, shuning uchun
  filial qatorida `waste_stems` va `waste_cost_total` doim 0. `?branch=<id>` bilan
  so'ralganda `summary.waste_stems` ham 0 keladi.
- Filialda sotuv bo'lmasa ham qator **nolga teng qiymatlar bilan keladi** —
  jadval qatori yo'qolib qolmaydi.

---

## `summary` — umumiy yig'indi

Yuqoridagi kalitlarning hammasi bor, ustiga `branch_name: "Umumiy"`.
Eski kalitlar (`total_sales`, `cash_total`, `card_total`, `total_quantity`,
`standard_quantity`, `custom_quantity`, `discount_total`, `cost_total`,
`net_profit`, `waste_cost_total`, `waste_stems`, ...) o'z joyida.

Yangi qo'shilganlari: `sales_count`, `flower_stems`, `cash_count`, `card_count`,
`unknown_count`, `cash_quantity`, `card_quantity`, `unknown_quantity`, `share_percent`.

---

## `history` — sotuv qatorlari

Har bir qatorga 4 ta yangi maydon qo'shildi:

| Kalit | Ma'nosi |
|---|---|
| `branch_id` | Sotuv qaysi filialda bo'lgani (`null` = asosiy) |
| `branch_name` | Filial nomi — jadvalda ustun qilib qo'yish uchun |
| `is_main_branch` | Asosiy filialmi |
| `flower_stems` | Shu sotuvga ketgan gul donasi |

`discounted_sales` qatorlarida ham shu maydonlar bor.

---

## Real misol (serverdan)

```json
{
  "branch_filter": { "mode": "all", "branch_id": null, "branch_name": null },
  "summary": {
    "branch_name": "Umumiy",
    "sales_count": 11,
    "total_quantity": 19,
    "flower_stems": 1378,
    "total_sales": "8420000.00",
    "cash_total": "7870000.00",
    "card_total": "550000.00",
    "net_profit": "3520000.00"
  },
  "by_branch": [
    {
      "branch_id": null,
      "branch_name": "Toshkent (asosiy filial)",
      "is_main": true,
      "sales_count": 9,
      "total_quantity": 17,
      "flower_stems": 1368,
      "total_sales": "7700000.00",
      "cash_total": "7550000.00", "cash_count": 8,
      "card_total": "150000.00",  "card_count": 1,
      "discount_total": "4700000.00",
      "waste_stems": 10,
      "net_profit": "2980000.00",
      "share_percent": "91.45"
    },
    {
      "branch_id": 2,
      "branch_name": "Parkent filiali",
      "is_main": false,
      "sales_count": 2,
      "total_quantity": 2,
      "flower_stems": 10,
      "total_sales": "720000.00",
      "cash_total": "320000.00", "cash_count": 1,
      "card_total": "400000.00", "card_count": 1,
      "discount_total": "80000.00",
      "waste_stems": 0,
      "net_profit": "540000.00",
      "share_percent": "8.55"
    }
  ]
}
```

---

## UI uchun taklif

**1. Yuqorida filial tanlash.** Uchta holat: `Hammasi` / `Toshkent` / `Parkent`.
Tanlov `?branch=` ga tushadi. Filial foydalanuvchisiga bu blok ko'rsatilmaydi.

**2. Umumiy kartochkalar.** `summary` dan: Savdo, Sotuvlar soni, Sotilgan buket,
Sotilgan gul donasi, Naqd, Karta, Skidka, Sof foyda.

Har kartochka ostiga kichik ajratma yozilsa yaxshi bo'ladi — bu foydalanuvchi
aynan so'ragan narsa:

```
Umumiy savdo
8 420 000 so'm
Toshkent 7 700 000 (91.45%) · Parkent 720 000 (8.55%)
```

**3. Filiallar jadvali** — `by_branch` ni to'g'ridan-to'g'ri chizsa bo'ladi:

| Filial | Sotuv | Buket | Gul donasi | Savdo | Naqd | Karta | Skidka | Tannarx | Sof foyda | Ulush |
|---|---|---|---|---|---|---|---|---|---|---|

Oxirgi qator — `summary` dan "Jami".

**4. Sotuvlar jadvaliga "Filial" ustuni** — `history[].branch_name`.
Ustun bo'yicha filtrlash ham qo'shsa bo'ladi.

---

## Excel eksport

`GET /api/exports/profit/` ham yangilandi (`?branch=` shu yerda ham ishlaydi):

- **Yangi "Filiallar" varag'i** — `by_branch` ning to'liq jadvali
- "Hisob-kitob" varag'iga `Sotuvlar soni` va `Sotilgan gul donasi` qatorlari qo'shildi
- "Sotuv history" varag'iga `Filial` va `Gul donasi` ustunlari qo'shildi
- "Skidkalar" varag'iga `Filial` ustuni qo'shildi

---

## Aloqador endpointlar

`GET /api/branch-report/` o'zgarmadi. U boshqa savolga javob beradi:
filialga **nechta katalog yuborildi**, nechtasi sotildi, ustama qancha.
Hisob-kitob esa pul oqimini ko'rsatadi. Ikkalasi bir-birini to'ldiradi.

`GET /api/dashboard/` ilgarigidek foydalanuvchining o'z filiali bo'yicha ishlaydi.
Filiallar kesimi kerak bo'lsa — `/api/accounting/` dan `by_branch` ni oling.

---

## Tekshirilgani

Backendda 182 ta avtotest o'tadi, shundan 8 tasi shu ajratma uchun yozildi:
umumiy yig'indi filial sotuvini qamrashi, ajratma yig'indisi umumiyga tengligi,
naqd/karta filiallar bo'yicha ajralishi, gul donasi sanalishi, `?branch=` filtri,
filial foydalanuvchisi chegarasi va chiqit faqat asosiy filialda qolishi.

Bundan tashqari real serverda ham tekshirildi — yuqoridagi misol o'sha yerdan olingan.
