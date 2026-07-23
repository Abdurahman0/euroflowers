# Frontend Update: Single Branch Mode

## Summary

Filiallar frontenddan olib tashlanadi.

Backend endi single-branch mode’da ishlaydi:

- frontend hech qayerda `branch` tanlamaydi
- create/update requestlarda `branch` yuborish shart emas
- list filterlarda `branch` ishlatilmaydi
- user profile response’da `branches` qaytmaydi
- dashboard response’da `branch_stock` qaytmaydi
- mini app `branch` param talab qilmaydi

Backend ichkarida eski database relationlar uchun default branch ishlatadi, lekin UI/API flow’da filial tanlash kerak emas.

## Remove From Frontend

Quyidagilarni UI’dan olib tashlang:

- filial select
- branch filter
- branch column/card
- user create/edit ichidagi branch access tanlash
- dashboard branch stock chart
- mini app branch query param

## Requests

Oldin:

```json
{
  "branch": 1,
  "name_uz": "Qizil buket"
}
```

Endi:

```json
{
  "name_uz": "Qizil buket"
}
```

Shu qoida quyidagilarga tegishli:

- stock batches
- packaging/materials
- catalog
- social posts
- leads
- mini app quote/lead

## Filters

Branch filter ishlatmang:

Oldin:

`GET /api/leads/?branch=1&status=new`

Endi:

`GET /api/leads/?status=new`

## Dashboard

`GET /api/dashboard/`

Removed:

```json
{
  "branch_stock": []
}
```

Use umumiy stock metrics:

- `stock_stems`
- `low_stock`
- `available_catalog`
- `pending_deductions`

## Users

`GET /api/users/`

Profile now:

```json
{
  "profile": {
    "role": "operator",
    "language": "uz"
  }
}
```

Removed:

```json
{
  "branches": []
}
```

User create/edit requestdan `branch_ids` yubormang.

## Mini App

Do not send `branch`.

Oldin:

`GET /api/mini-app/catalog/?init_data=...&branch=1`

Endi:

`GET /api/mini-app/catalog/?init_data=...`

Quote/lead payloadlarda ham `branch` yuborilmaydi.
