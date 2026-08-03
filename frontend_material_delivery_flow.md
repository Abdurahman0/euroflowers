# Frontend: Material Sklad Yuk Orqali Kirim

## Asosiy Flow

Materiallar gulga o'xshab avval yuk bilan kirim qilinadi.

1. Material yuki ochiladi.
2. Shu yuk ichiga materiallar birma-bir kirim qilinadi.
3. Material qoldig'i avtomatik oshadi.
4. Materialning oxirgi kirim yuki va supplieri detail response ichida ko'rinadi.

## Material Yuki Ochish

`POST /api/material-deliveries/`

Payload:

```json
{
  "number": "M-13",
  "received_at": "2026-08-02",
  "supplier": 5,
  "note": "Jamoliddindan kelgan materiallar"
}
```

Fieldlar:

- `number` - yuk raqami.
- `received_at` - kelgan sana.
- `supplier` - optional material postavshik id.
- `note` - optional izoh.

Response ichida muhim fieldlar:

- `id`
- `number`
- `received_at`
- `supplier`
- `total_quantity`
- `total_cost`
- `item_count`

## Yaratilgan Yuk Ichiga Material Kirim Qilish

`POST /api/material-deliveries/{delivery_id}/receive/`

### Dona Bilan Kirim

Lenta yoki Lak kabi dona bilan keladigan materiallar:

```json
{
  "packaging": 13,
  "quantity": 20,
  "cost_price": "5000",
  "reason": "Yangi yuk"
}
```

Bu yerda:

- `packaging` - material id.
- `quantity` - dona soni.
- `cost_price` - 1 dona tannarxi.
- `reason` - optional izoh.

Backend material qoldig'iga `quantity` ni qo'shadi.

### Pochka Bilan Kirim

Gupka kabi pochkada keladigan material:

```json
{
  "packaging": 12,
  "bunches": 5,
  "cost_per_bunch": "60000",
  "reason": "5 pochka gupka"
}
```

Backend hisoblaydi:

- `quantity = bunches * units_per_bunch`
- `cost_price = cost_per_bunch / units_per_bunch`

Masalan `units_per_bunch = 20` bo'lsa:

- `5 pochka = 100 dona`
- `60000 / 20 = 3000` so'm 1 dona tannarx

## Materiallar Ro'yxati

`GET /api/materials/`

Filterlar:

- `packaging_type`
- `unit`
- `is_active`
- `basket_material`
- `size`
- `search`

Misollar:

```http
GET /api/materials/?packaging_type=other
GET /api/materials/?unit=bunch
GET /api/materials/?search=Gupka
```

## Hozir Seed Qilingan Materiallar

DBda default bor:

| Nomi | packaging_type | unit | UI label |
|---|---|---|---|
| Gupka | other | bunch | Pochka |
| Lenta | other | piece | Dona |
| Lak | other | piece | Dona |

Ularning boshlang'ich qoldig'i `0`.
Narxlar kirim qilinganda yoziladi.

## Material Yaratib Turib Yukga Kirim Qilish

Yangi material yaratishda birdan deliveryga bog'lab kirim qilish ham bor:

`POST /api/materials/`

Dona material:

```json
{
  "packaging_type": "other",
  "name_uz": "Yangi material",
  "unit": "piece",
  "delivery": 7,
  "quantity": 30,
  "cost_price": "4000",
  "sale_price": "0"
}
```

Pochka material:

```json
{
  "packaging_type": "other",
  "name_uz": "Yangi gupka turi",
  "unit": "bunch",
  "units_per_bunch": 20,
  "delivery": 7,
  "bunches": 10,
  "cost_per_bunch": "50000",
  "sale_price": "0"
}
```

Frontendda existing materialga kirim qilish uchun asosiy tavsiya:

1. `POST /api/material-deliveries/`
2. `POST /api/material-deliveries/{id}/receive/`

## UI Qoidalari

- Avval material yuki tanlanadi yoki yangi yuk ochiladi.
- Keyin material tanlanadi.
- Agar material `unit = bunch` bo'lsa, `bunches` va `cost_per_bunch` inputlarini ko'rsating.
- Agar material `unit = piece` bo'lsa, `quantity` va `cost_price` inputlarini ko'rsating.
- `Gupka` uchun pochkada kirim UI ishlating.
- `Lenta` va `Lak` uchun dona kirim UI ishlating.
- Kirimdan keyin material detail/listni refresh qiling, qoldiq va oxirgi delivery yangilanadi.

## Muhim Eslatma

`Gupka`, `Lenta`, `Lak` hozir faqat kirim uchun ishlatiladi. Frontend ularni katalog qo'shish yoki sotishdagi ishlatiladigan material selectida ko'rsatmasin.
