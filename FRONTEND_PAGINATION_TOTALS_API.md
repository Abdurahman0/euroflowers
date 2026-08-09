# Sahifalash va umumiy sonlar — katalog, sklad, floristlar

**Serverga chiqarildi — 09.08.2026.** Eski kod sinmaydi: javobga faqat yangi
maydonlar qo'shildi, `count` / `next` / `previous` / `results` joyida qoldi.

## Nima o'zgardi

Ilgari ro'yxat javobida faqat shular bor edi:

```json
{ "count": 154, "next": "...", "previous": null, "results": [ ... ] }
```

Shuning uchun «1–30 / 154» deb yozish uchun `next` havolasini o'zingiz tahlil
qilishingiz, «jami 26 900 000 so'm» deb yozish uchun esa hamma sahifani
aylanib chiqishingiz kerak edi.

Endi har bir sahifalangan javobda sahifa ma'lumoti bor, katalog / sklad /
floristlar bo'limidagi ro'yxatlarda esa qo'shimcha `totals` bloki bor.

**`totals` sahifadan emas, filtrga tushgan butun ro'yxatdan hisoblanadi.**
Ya'ni 2-sahifaga o'tsangiz ham `totals` o'zgarmaydi, lekin `?status=sold`
qo'ysangiz o'sha filtrga moslashadi.

## Javob ko'rinishi

```json
{
  "count": 154,
  "page": 1,
  "page_size": 30,
  "total_pages": 6,
  "has_next": true,
  "has_previous": false,
  "next": "https://euroflowers.api.cognilabs.org/api/catalog/?page=2",
  "previous": null,
  "results": [ ... ],
  "totals": { ... }
}
```

| Maydon | Turi | Izoh |
|---|---|---|
| `count` | int | Filtr bo'yicha **jami** yozuv soni (sahifadagi emas) |
| `page` | int | Hozirgi sahifa raqami |
| `page_size` | int | Bitta sahifadagi yozuv soni |
| `total_pages` | int | Jami sahifalar soni |
| `has_next` | bool | Keyingi sahifa bormi |
| `has_previous` | bool | Oldingi sahifa bormi |
| `next` / `previous` | string \| null | Tayyor havolalar (avvalgidek) |
| `results` | array | Shu sahifadagi yozuvlar |
| `totals` | object | Butun filtr bo'yicha umumiy sonlar |

`totals` faqat quyida sanab o'tilgan endpointlarda bo'ladi. Boshqa
ro'yxatlarda u yo'q — kodda `body.totals?.…` deb yozing.

## So'rov parametrlari

| Parametr | Misol | Izoh |
|---|---|---|
| `page` | `?page=3` | Sahifa raqami |
| `page_size` | `?page_size=50` | Sahifa hajmi. Sukut 30, eng ko'pi **200** (ilgari 100 edi) |
| `page_size=all` | `?page_size=all` | **Hamma yozuv bitta sahifada.** `0` yoki `-1` ham shu ma'noda |
| `ordering` | `?ordering=-created_at` | Tartib (o'zgarmadi) |
| `search` | `?search=atirgul` | Qidiruv (o'zgarmadi) |

### `page_size=all` haqida

Javob ko'rinishi o'zgarmaydi — natija baribir `results` ichida, `count` va
`totals` joyida bo'ladi, `total_pages` esa `1` bo'ladi.

Bu **ochiluvchi ro'yxatlar (dropdown/select) uchun** kerak. Ilgari, masalan,
katalog qo'shishda floristning qoldig'i 30 tadan oshsa ro'yxat jimgina
kesilib qolardi va foydalanuvchi qolganini umuman ko'rmasdi.

Katta jadvallarga (`/api/catalog/`, `/api/stock-movements/`) `all` ni
sahifalangan ko'rinishda ishlatmang — faqat select va eksport uchun.

### Tartib barqarorlashtirildi

Ba'zi ro'yxatlarning tartibi aniq emas edi, shuning uchun 2-sahifada bitta
yozuv takrorlanib, boshqasi tushib qolishi mumkin edi. Endi hammasida aniq
default tartib bor. Ayniqsa **floristlar ro'yxati** — u umuman tartibsiz
qaytardi, endi ism bo'yicha keladi.

---

## Endpointlar va ularning `totals` maydonlari

### Katalog

#### `GET /api/catalog/`

```json
"totals": {
  "items": 154,
  "quantity_total": 249,
  "quantity_sold": 196,
  "quantity_wasted": 0,
  "quantity_reworked": 1,
  "quantity_remaining": 52,
  "remaining_value": "26900000.00",
  "sold_value": "81350000.00",
  "cost_total": "68615500.00",
  "discount_total": "82486000.00",
  "by_status": { "available": 38, "sold": 102, "archived": 14 },
  "by_kind": { "standard": 154 }
}
```

| Maydon | Ma'nosi |
|---|---|
| `items` | Nechta katalog qatori (= `count`) |
| `quantity_total` | Jami dona |
| `quantity_sold` / `quantity_wasted` / `quantity_reworked` | Sotilgan / chiqit / buzilgan dona |
| `quantity_remaining` | Hozir qo'lda turgan dona |
| `remaining_value` | Qo'ldagi dona × sotuv narxi |
| `sold_value` | Sotilgan dona × sotuv narxi (**chegirmasiz**) |
| `cost_total` | Jami tannarx |
| `discount_total` | Jami chegirma |
| `by_status` / `by_kind` | Holat va tur bo'yicha nechtadan |

> Aniq tushum, naqd/karta/qarz bo'linishi kerak bo'lsa — u avvalgidek
> `GET /api/catalog/sales/` da (`totals` bilan birga). `sold_value` faqat
> taxminiy ko'rsatkich, chegirma hisobga olinmagan.

#### `GET /api/catalog-reworks/`

`reworks`, `input_stems`, `output_stems`, `waste_stems`, `input_cost`,
`waste_cost`, `florist_amount`, `florists`.

#### `GET /api/catalog-transfers/`

`transfers`, `quantity_total`, `source_value`, `target_value`, `branches`.

---

### Sklad

#### `GET /api/stock-batches/`

```json
"totals": {
  "batches": 150,
  "active_batches": 150,
  "flowers": 20,
  "suppliers": 4,
  "received_stems": 26650,
  "remaining_stems": 4440,
  "used_stems": 22210,
  "received_cost": "84189999.95",
  "remaining_cost": "14374999.99",
  "remaining_sale_value": "33399999.99"
}
```

| Maydon | Ma'nosi |
|---|---|
| `batches` / `active_batches` | Nechta qator, nechtasi faol |
| `flowers` / `suppliers` | Nechta xil gul, nechta postavshik |
| `received_stems` | Jami kelgan dona |
| `remaining_stems` | Skladda hozir turgan dona |
| `used_stems` | Ishlatilgan dona |
| `received_cost` | Kelgan gulning jami tannarxi |
| `remaining_cost` | **Skladda turgan gulning tannarxi** |
| `remaining_sale_value` | Skladda turgan gulning sotuv qiymati |

#### `GET /api/stock-deliveries/`

`deliveries`, `active_deliveries`, `batches`, `received_stems`,
`remaining_stems`, `cost_total`.

#### `GET /api/stock-movements/`

`rows`, `in_stems`, `out_stems`, `waste_stems`, `net_stems`, `by_type`.

> `out_stems` va `waste_stems` **musbat** son bo'lib qaytadi (bazada manfiy
> yozilsa ham). `net_stems` — sof o'zgarish: kirim − chiqim − chiqit.

#### `GET /api/materials/` (= `/api/packaging/`)

`items`, `active_items`, `quantity_total`, `cost_value`, `sale_value`,
`by_type`.

#### `GET /api/material-deliveries/`

`deliveries`, `active_deliveries`, `items`, `quantity_total`, `cost_total`.

#### `GET /api/material-movements/` (= `/api/packaging-movements/`)

`rows`, `in_quantity`, `out_quantity`, `net_quantity`, `cost_total`,
`by_type`. Bu yerda ham `out_quantity` musbat.

---

### Floristlar

#### `GET /api/florists/`

```json
"totals": {
  "florists": 10,
  "active": 10,
  "inactive": 0,
  "by_staff_type": { "florist": 6, "apprentice": 4 },
  "salary_total": "13845000.00",
  "catalog_quantity": 364,
  "catalog_remaining": 69,
  "stock_stems": 305
}
```

| Maydon | Ma'nosi |
|---|---|
| `florists` / `active` / `inactive` | Nechta florist |
| `by_staff_type` | Florist va shogird soni |
| `salary_total` | Jami yozilgan ish haqi |
| `catalog_quantity` | Ular yasagan jami katalog donasi |
| `catalog_remaining` | Shundan hali sotilmagani |
| `stock_stems` | **Floristlar qo'lida yopilmagan gul** |

#### `GET /api/florist-stock-issues/`

`rows`, `issued_stems`, `returned_stems`, `wasted_stems`, `net_stems`,
`florists`, `batches`.

`net_stems` = chiqarilgan − qaytarilgan − chiqit, ya'ni floristda qolishi
kerak bo'lgan son.

#### `GET /api/florist-stock-balances/`

`rows`, `remaining_stems`, `cost_total`, `florists`, `batches`.

`cost_total` — floristlar qo'lidagi gulning tannarxi.

#### `GET /api/florist-salary/`

```json
"totals": {
  "entries": 272,
  "amount_total": "13845000.00",
  "quantity_total": 83,
  "florists": 5,
  "by_source": {
    "catalog":          { "count": 211, "amount": "10380000.00" },
    "decoration":       { "count": 38,  "amount": "515000.00" },
    "sale_decoration":  { "count": 11,  "amount": "60000.00" },
    "extra_decoration": { "count": 3,   "amount": "415000.00" },
    "manual":           { "count": 9,   "amount": "2475000.00" }
  }
}
```

---

## Muhim eslatmalar

1. **Pul qiymatlari string bo'lib keladi** (`"26900000.00"`) — API'ning
   qolgan joyi bilan bir xil. Hisoblashdan oldin `Number(...)` qiling.
2. **Sonlar (`*_stems`, `quantity_*`, `count`) — int.**
3. `by_status` / `by_type` / `by_source` — faqat **mavjud** kalitlar bo'ladi.
   Bitta ham `archived` bo'lmasa, `by_status` da `archived` kaliti umuman
   bo'lmaydi. `?? 0` bilan o'qing.
4. `totals` filtr va qidiruv bilan birga ishlaydi. `?florist=3&source=catalog`
   yoki `?status=sold` qo'ysangiz, `totals` ham faqat o'sha bo'yicha
   hisoblanadi. Filtr parametrlarining o'zi o'zgarmadi.
5. Florist roli bilan kirilsa u faqat o'z ma'lumotini ko'radi — `totals` ham
   shunga mos ravishda faqat o'zinikini hisoblaydi.

## Frontend uchun tavsiya

```ts
type Paginated<T> = {
  count: number
  page: number
  page_size: number
  total_pages: number
  has_next: boolean
  has_previous: boolean
  next: string | null
  previous: string | null
  results: T[]
  totals?: Record<string, any>
}
```

Jadval ostidagi qatorni endi `totals` dan to'g'ridan-to'g'ri chizsa bo'ladi —
sahifalarni aylanib chiqish shart emas:

```
Jami: 154 ta katalog · qo'lda 52 dona · 26 900 000 so'm · tannarx 68 615 500 so'm
```

Savol bo'lsa yozing.
