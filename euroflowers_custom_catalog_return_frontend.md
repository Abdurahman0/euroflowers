# EuroFlowers Frontend: Mahsus katalogni qaytarish

## Maqsad

Mahsus katalog (`catalog_kind=custom`) xato qo‘shilgan bo‘lsa yoki mijoz bekor qilsa, frontend detail page’dan bitta action orqali uni qaytarishi kerak.

Backend custom katalogdagi yechilgan gullar va materiallarni skladga qaytaradi, florist salary yozuvlarini olib tashlaydi, audit log yozadi va katalog itemni o‘chiradi.

## Endpoint

```http
POST /api/catalog/{catalog_id}/return-custom/
Authorization: Bearer <access_token>
Content-Type: application/json
```

## Request

```json
{
  "reason": "Mijoz buyurtmani bekor qildi"
}
```

`reason` optional, lekin UI’da sabab kiritishni tavsiya qilamiz.

## Success Response

```json
{
  "detail": "Mahsus katalog qaytarildi",
  "returned_catalog": {
    "id": 123,
    "catalog": "Custom buket",
    "catalog_kind": "custom",
    "arrangement_type": "bouquet",
    "volume": "medium",
    "price": "500000.00",
    "quantity_total": 1,
    "quantity_stock_deducted": 1,
    "status": "available",
    "composition": [],
    "materials": [],
    "reason": "Mijoz buyurtmani bekor qildi"
  }
}
```

`returned_catalog` audit/preview uchun snapshot. Endpointdan keyin item katalogdan olib tashlangan bo‘ladi.

## Error Response

```json
{
  "detail": "Faqat mahsus katalog qaytariladi"
}
```

Yoki:

```json
{
  "detail": "Sotilgan, chiqitga chiqarilgan yoki restavratsiya qilingan mahsus katalogni bu yerdan qaytarib bo‘lmaydi"
}
```

Yoki:

```json
{
  "detail": "Bu mahsus katalog boshqa hujjatlarga bog‘langan, avval bog‘langan hujjatlarni tekshiring"
}
```

## Frontend Ko‘rsatish Qoidasi

Button faqat quyidagi holatda chiqsin:

```ts
item.catalog_kind === "custom" &&
item.quantity_sold === 0 &&
item.quantity_wasted === 0 &&
item.quantity_reworked === 0
```

Button text:

```text
Mahsus katalogni qaytarish
```

Confirm modal:

```text
Bu mahsus katalog qaytariladi. Yechilgan gullar va materiallar skladga qaytadi, katalog esa o‘chiriladi. Davom etasizmi?
```

Reason input placeholder:

```text
Sababini yozing
```

Successdan keyin:

- detail modal/page yopiladi
- katalog list refetch qilinadi
- toast chiqadi: `Mahsus katalog qaytarildi`

## Muhim

Bu endpoint sotuvni qaytarish emas.

Sotilgan katalog uchun eski endpoint ishlatiladi:

```http
POST /api/catalog/{catalog_id}/restore-sale/
```

Custom katalogni butunlay bekor qilish uchun yangi endpoint:

```http
POST /api/catalog/{catalog_id}/return-custom/
```
