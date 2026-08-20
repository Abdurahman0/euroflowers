# EuroFlowers Frontend Update

Sana: 2026-08-20

Bu hujjat frontend uchun oxirgi backend o‘zgarishlarini bir joyga jamlaydi. Asosiy o‘zgarishlar katalog list/totals, dashboard statistikasi, Excel export, postavshik qarz balansi va custom katalog inventory oqimiga tegishli.

## 1. Katalog list API

Endpoint:

```http
GET /api/catalog/
```

Katalog list javobida endi katalogni yasagan florist ma’lumotlari qaytadi.

Muhim fieldlar:

```json
{
  "id": 123,
  "name_uz": "Buket nomi",
  "arrangement_type": "bouquet",
  "catalog_kind": "standard",
  "volume": "large",
  "florist": "Isroil",
  "florist_name": "Isroil",
  "florist_detail": {
    "id": 5,
    "name": "Isroil",
    "staff_type": "florist",
    "staff_type_label": "Florist",
    "phone": "",
    "user": 18
  },
  "decoration_florist": "",
  "decoration_florist_name": "",
  "decoration_florist_detail": null,
  "composition": [],
  "materials": []
}
```

Frontendda:

- Florist ismini ko‘rsatish uchun `florist` yoki `florist_name` ishlatiladi.
- ID kerak bo‘lsa `florist_detail.id` ishlatiladi.
- `composition` va `materials` listda ham qaytadi, detailga kirmasdan asosiy tarkibni ko‘rsatish mumkin.

## 2. Katalog totals va buket hajm umumiylashtirish

Endpoint:

```http
GET /api/catalog/?status_group=available
```

Javobdagi `totals` ichiga buket hajmlari bo‘yicha umumiy statistika qo‘shilgan.

Field:

```json
{
  "totals": {
    "bouquet_volume_summary": [
      {
        "volume": "large",
        "volume_label": "Katta",
        "label": "Katta buket 15 ta",
        "items_count": 5,
        "quantity_total": 25,
        "quantity_sold": 9,
        "quantity_remaining": 15
      }
    ]
  }
}
```

Frontendda katalog yuqorisida yoki filter yonida buketlarni hajm bo‘yicha umumiy ko‘rsatish mumkin.

Tavsiya qilingan UI:

- `label` ni card title sifatida chiqaring.
- `quantity_remaining` asosiy son bo‘lsin.
- `quantity_total`, `quantity_sold`, `items_count` kichik subtitle/metrikalarda ko‘rsatilsin.
- Bu summary faqat buketlar uchun. Savat va boshqa turlar alohida umumiylashtirilmaydi.

## 3. Katalog status filterlari va countlar

Katalog listda status group filterlari ishlatiladi:

```http
GET /api/catalog/?status_group=available
GET /api/catalog/?status_group=sold
GET /api/catalog/?status_group=archived
GET /api/catalog/?status_group=all
```

Frontendda tablar:

- Sotuvda
- Sotilgan
- Arxiv
- Barchasi

Agar `totals` ichida status countlar qaytsa, tab badge sifatida ishlating. Pagination `count` umumiy filtrlangan count uchun ishlatiladi.

## 4. Dashboard API yangi fieldlari

Endpoint:

```http
GET /api/dashboard/?date_from=2026-08-01&date_to=2026-08-20
```

Yangi supplier balans fieldlari:

```json
{
  "supplier_purchase_total": "12000000.00",
  "supplier_flower_purchase_total": "9000000.00",
  "supplier_material_purchase_total": "3000000.00",
  "supplier_paid_total": "8000000.00",
  "supplier_manual_debt_total": "500000.00",
  "supplier_debt_total": "4500000.00",
  "supplier_overpaid_total": "0.00",
  "supplier_debtors_count": 3
}
```

Ma’nosi:

- `supplier_purchase_total` postavshikdan kelgan mahsulotlar jami.
- `supplier_paid_total` postavshikka qo‘lda kiritilgan to‘lovlar jami.
- `supplier_manual_debt_total` qo‘lda qo‘shilgan qo‘shimcha qarzlar jami.
- `supplier_debt_total` hozirgi qarz jami.
- `supplier_overpaid_total` ortiqcha to‘lab yuborilgan summa.
- `supplier_debtors_count` qarzi bor postavshiklar soni.

## 5. Dashboard Excel-style stats

Dashboard javobiga `excel_stats` qo‘shildi.

Struktura:

```json
{
  "excel_stats": {
    "sovda": [],
    "rasxod": [],
    "yandex": [],
    "totals": {
      "sovda": "0.00",
      "naxt": "0.00",
      "karta": "0.00",
      "rasxod": "0.00",
      "supplier_paid": "0.00"
    }
  }
}
```

### 5.1. `excel_stats.sovda`

Kunlik sotuv jadvali.

Asosiy ustunlar:

- `№`
- `sana`
- `sovda`
- `naxt`
- `karta`
- `dostavka`
- `sotuv`
- `kotta savat`
- `sredni savat`
- `kickina savat`
- `kotta buket`
- `sred buket`
- `kich buket`
- `oyincho`
- `shokolad`
- `zapiska`
- `kitob`
- `banketka`

Frontendda bu jadvalni dashboard ichida compact table yoki alohida “Hisobot” tabida ko‘rsatish mumkin.

### 5.2. `excel_stats.rasxod`

Kunlik rasxod jadvali. Excel shablondagi ustunlarga mos.

Asosiy ustunlar:

- `№`
- `SANA`
- `RASXOD`
- `OBED DEN`
- `OBED NOCH`
- florist/ismlar bo‘yicha ustunlar
- `DOSTAVKA`
- `LENTA`
- `target`
- `nalog`
- `svet`
- `musur`
- `POKE`
- `SKOCH`

### 5.3. `excel_stats.yandex`

Postavshik/to‘lov yo‘nalishlari bo‘yicha kunlik jadval.

Ustunlar:

- `№`
- `SANA`
- `DOV`
- `KIYM`
- `XAYRULLO`
- `LENTA`
- `GUL`
- `VODIY`

## 6. Dashboard Excel export

Yangi endpoint:

```http
GET /api/dashboard/export/?date_from=2026-08-01&date_to=2026-08-20
Authorization: Bearer <token>
```

Response:

- Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- File: `.xlsx`
- Sheetlar: `SOVDA`, `RASXOD`, `YANDEX`

Frontendda download:

```ts
const res = await fetch(`${API_URL}/api/dashboard/export/?date_from=${from}&date_to=${to}`, {
  headers: { Authorization: `Bearer ${accessToken}` },
})

const blob = await res.blob()
const url = URL.createObjectURL(blob)
const a = document.createElement("a")
a.href = url
a.download = `euroflowers-dashboard-${from}-${to}.xlsx`
a.click()
URL.revokeObjectURL(url)
```

UI tavsiya:

- Dashboard/Hisobot page yuqorisiga `Excel yuklab olish` button.
- Date filterdagi `from/to` aynan exportga ham berilsin.
- Export paytida loading state ko‘rsatilsin.

## 7. Supplier qarz va oldi-berdi

### 7.1. Supplier list/detail

Endpoint:

```http
GET /api/suppliers/?date_from=2026-08-01&date_to=2026-08-20
GET /api/suppliers/{id}/?date_from=2026-08-01&date_to=2026-08-20
```

Yangi fieldlar:

```json
{
  "flower_purchase_total": "0.00",
  "material_purchase_total": "0.00",
  "purchase_total": "0.00",
  "paid_total": "0.00",
  "manual_debt_total": "0.00",
  "balance_total": "0.00",
  "debt_total": "0.00",
  "overpaid_total": "0.00",
  "balance_status": "closed"
}
```

`balance_status` qiymatlari:

- `debt` postavshikka qarz bor.
- `overpaid` ortiqcha to‘lov bor.
- `closed` balans yopiq.

Formula:

```text
balance_total = purchase_total + manual_debt_total - paid_total
debt_total = max(balance_total, 0)
overpaid_total = max(-balance_total, 0)
```

Frontendda:

- Supplier card/detailda `purchase_total`, `paid_total`, `debt_total` alohida ko‘rsatilsin.
- `balance_status=debt` bo‘lsa qizil/yellow badge.
- `balance_status=overpaid` bo‘lsa yashil/blue badge.
- `balance_status=closed` bo‘lsa neutral badge.

### 7.2. Supplier payment

Mavjud endpoint:

```http
POST /api/supplier-payments/
```

Payload:

```json
{
  "supplier": 1,
  "amount": "1000000",
  "paid_at": "2026-08-20",
  "method": "cash",
  "note": "Qisman to‘lov"
}
```

`method`:

- `cash`
- `card`
- `transfer`

### 7.3. Manual supplier debt

Yangi endpoint:

```http
GET /api/supplier-debts/
POST /api/supplier-debts/
PATCH /api/supplier-debts/{id}/
DELETE /api/supplier-debts/{id}/
```

Create payload:

```json
{
  "supplier": 1,
  "amount": "500000",
  "adjusted_at": "2026-08-20",
  "note": "Oldingi qarz qo‘lda qo‘shildi"
}
```

List filterlari:

```http
GET /api/supplier-debts/?supplier=1
GET /api/supplier-debts/?adjusted_at=2026-08-20
GET /api/supplier-debts/?search=dovron
```

Frontendda supplier detailga 2 ta action qo‘shing:

- `To‘lov qo‘shish` → `/api/supplier-payments/`
- `Qarz qo‘shish` → `/api/supplier-debts/`

Supplier detailda history tab:

- To‘lovlar
- Qo‘lda qo‘shilgan qarzlar
- Material yuklari
- Gul partiyalari

## 8. Custom katalog inventory oqimi

Custom katalog qo‘shishda muhim o‘zgarish bor.

Oldingi muammo:

- Custom katalogda florist tanlansa ham gul florist balansidan kamayishga urinardi.
- Custom katalogda real dona soni aniq kiritilgani uchun bu noto‘g‘ri edi.

Yangi qoida:

- `catalog_kind=custom` bo‘lsa, compositiondagi gullar to‘g‘ridan-to‘g‘ri `stock_batch` qoldig‘idan kamayadi.
- Florist tanlangan bo‘lsa ham stock deduction florist balansidan ketmaydi.
- `catalog_kind=standard` bo‘lsa avvalgi oqim qoladi, ya’ni floristga chiqarilgan gul balansidan yopiladi.

Custom create payload misol:

```json
{
  "name_uz": "Mijoz uchun custom buket",
  "catalog_kind": "custom",
  "arrangement_type": "bouquet",
  "volume": "custom katta",
  "quantity_total": 1,
  "price": "800000",
  "florist": 5,
  "florist_salary_amount": "70000",
  "composition": [
    {
      "stock_batch": 18,
      "quantity_stems": 10
    },
    {
      "stock_batch": 22,
      "quantity_stems": 15
    }
  ],
  "materials": [
    {
      "packaging": 4,
      "quantity": 1
    }
  ],
  "discount_reason": "Mijozga kelishilgan narxda sotildi"
}
```

Frontend validatsiya:

- Customda `composition.quantity_stems` majburiy.
- Bir nechta gul qo‘shish mumkin.
- Bir xil `stock_batch` bir necha marta tanlansa frontend bitta rowga jamlab yuborgani yaxshi, lekin backend ham normalizatsiya qiladi.
- `florist_salary_amount` qo‘lda berilsa shu summa florist salaryga yoziladi.
- `florist_salary_amount` berilmasa backend hajm tarifidan oladi.

## 9. Standard katalog inventory oqimi

Standard katalogda avvalgi florist issue flow saqlanadi.

Oqim:

1. Admin/nazoratchi floristga gul chiqaradi.
2. Florist guldan buket/savat yasaydi.
3. Katalog qo‘shilganda florist tanlanadi.
4. Katalog yopilganda yoki taqsimlanganda gul florist balansidan kamayadi.

Frontendda standard katalog create/editda:

- `arrangement_type` majburiy.
- `volume` majburiy.
- `florist` tanlangan bo‘lsa, compositionda kamida qaysi guldan yasalganini tanlash kerak.
- Standard katalogda florist salary qo‘lda kiritilmaydi, hajm tarifidan avtomatik olinadi.

## 10. Tavsiya qilingan frontend sahifalar

Dashboard:

- Supplier qarz widgetlari.
- Excel-style stats preview.
- Excel export button.

Supplier detail:

- Balans summary.
- To‘lov qo‘shish.
- Qarz qo‘shish.
- Material yuklari.
- Gul partiyalari.
- To‘lov/qarz tarixi.

Catalog:

- Status tabs.
- Buket hajm summary cards.
- Florist name column.
- Composition/materials preview.
- Custom katalog formda bir nechta gul/material tanlash.

Hisobot:

- `excel_stats.sovda`, `excel_stats.rasxod`, `excel_stats.yandex` uchun 3 ta tab.
- Date range filter.
- Excel export.

