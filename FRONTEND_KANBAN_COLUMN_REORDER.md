# Frontend: Kanban Column Reorder

API base:

```text
https://euroflowers.api.cognilabs.org/api
```

## Endpoint

Kanban column tartibini bitta request bilan saqlash:

```http
POST /api/leads/reorder-column/
```

Body:

```json
{
  "status": "new",
  "lead_ids": [31, 18, 25]
}
```

Bo‘sh column uchun branch yuboriladi:

```json
{
  "status": "qualified",
  "branch": 1,
  "lead_ids": []
}
```

Response:

```json
{
  "updated": 3
}
```

## Frontend Qoidasi

Drag/drop tugagandan keyin target column ichidagi barcha lead idlarni yuqoridan pastga tartibda yuboring.

Masalan user leadni column ichida 2-o‘ringa qo‘ydi:

```json
{
  "status": "new",
  "lead_ids": [lead_1, moved_lead, lead_2, lead_3]
}
```

Backend `sort_order`ni avtomatik qayta yozadi:

```text
lead_1      -> 1000.000000
moved_lead  -> 2000.000000
lead_2      -> 3000.000000
lead_3      -> 4000.000000
```

Refreshdan keyin:

```http
GET /api/leads/?status=new&ordering=sort_order
```

shu tartib qaytadi.

## Validation

`lead_ids` target columnni to‘liq yuborishi kerak.

Agar column ichidagi biror lead tushib qolsa:

```json
{
  "lead_ids": "Target column lead_ids to‘liq yuborilishi kerak",
  "missing_ids": [25]
}
```

Duplicate lead id yuborilsa:

```json
{
  "lead_ids": "Lead id takrorlanmasligi kerak"
}
```

Lead boshqa filialga tegishli bo‘lsa:

```json
{
  "lead_ids": "Bitta column tartibi faqat bitta filial leadlari bilan yuboriladi"
}
```

## Status O‘zgarishi

Lead boshqa status columniga drop qilinsa ham shu endpoint ishlatiladi.

Masalan `new`dan `qualified`ga o‘tdi:

```json
{
  "status": "qualified",
  "lead_ids": [moved_lead, old_qualified_1, old_qualified_2]
}
```

Backend `moved_lead.status = qualified` qiladi va target column tartibini saqlaydi.

`won` columniga o‘tsa sklad kamayadi.

`won`dan boshqa columnga o‘tsa sklad avtomatik qaytariladi.

## Eski Endpoint

`POST /api/leads/{id}/move/` hali ham ishlaydi, lekin yangi frontend uchun tavsiya qilingan yo‘l:

```http
POST /api/leads/reorder-column/
```
