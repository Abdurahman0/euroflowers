# Frontend Update: Social Post Composition

## Social Posts

Endpoint:

`POST /api/social-posts/`

`PATCH /api/social-posts/{id}/`

Post, reel, story yoki target qo‘shishda endi shu postga tegishli tayyor katalog guli va gul tarkibini bir payload ichida yuborish mumkin.

New field:

`catalog_items`

Example:

```json
{
  "branch": 1,
  "post_type": "post",
  "permalink": "https://www.instagram.com/p/POST_CODE/",
  "title_uz": "Qizil atirgul buket",
  "title_ru": "Букет красных роз",
  "description_uz": "Postdagi tayyor buket",
  "description_ru": "Готовый букет из поста",
  "price": "400000.00",
  "flower_count": 3,
  "is_active": true,
  "catalog_items": [
    {
      "name_uz": "Qizil atirgul buket",
      "name_ru": "Букет красных роз",
      "arrangement_type": "bouquet",
      "price": "400000.00",
      "quantity_total": 4,
      "status": "available",
      "height_cm": 60,
      "composition": [
        {
          "stock_batch": 12,
          "quantity_stems": 3,
          "quantity_bunches": "0.15"
        }
      ]
    }
  ]
}
```

## Fields

`catalog_items[].quantity_total`

Postdagi tayyor buket/savat nechta borligi.

`catalog_items[].composition[].stock_batch`

Skladdagi gul partiyasi ID.

`catalog_items[].composition[].quantity_stems`

Bitta buket/savatga nechta dona gul ketgani.

`catalog_items[].composition[].quantity_bunches`

Bitta buket/savatga nechta pochka ketgani. Frontend decimal string yuborishi mumkin.

## Validation

Backend `quantity_total * quantity_stems` bo‘yicha sklad qoldig‘ini tekshiradi.

Yetarli gul bo‘lmasa `400` qaytadi:

```json
{
  "catalog_items": "API-1 partiyada yetarli qoldiq yo‘q. Kerak: 120, bor: 100"
}
```

## Response

`GET /api/social-posts/` va detail response ichida `catalog_items` qaytadi.

AI story/post/reel reply qilgan mijozga javob berishda shu bog‘langan katalog va composition ma’lumotlaridan foydalanadi.
