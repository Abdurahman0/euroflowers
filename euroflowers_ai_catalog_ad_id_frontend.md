# EuroFlowers Frontend Update — AI Catalog Ad ID Mapping

## Maqsad

Meta Ads orqali kelgan Instagram DMlarda backend endi `ad_id` va `post_id` orqali AI katalogdagi to'g'ri mahsulotlarni topadi. Frontend AI katalog create/edit formalarida shu fieldlarni optional qilib yuborishi kerak.

Bu reklama orqali kelgan mijozga noto'g'ri katalog mahsuloti yuborilishini kamaytiradi.

## Backendda qo'shilgan fieldlar

`AICatalogItem` modeliga 2 ta optional field qo'shildi:

```json
{
  "instagram_ad_id": "120240146122130452",
  "instagram_ad_post_id": "938672392402515"
}
```

Fieldlar majburiy emas. Oddiy AI katalog mahsulotlari uchun bo'sh qolishi mumkin.

## Qayerda ishlatish kerak

AI katalog qo'shish modal/page:

- `instagram_ad_id` optional text input
- `instagram_ad_post_id` optional text input

AI katalog edit modal/page:

- mavjud qiymatlar ko'rsatilsin
- admin/marketolog edit qilib saqlay olsin
- bo'sh string yuborilsa mapping tozalanadi

## API integratsiya

AI katalog list/detail javobida fieldlar qaytadi:

```json
{
  "id": 4,
  "name": "Buket Alfalob Gulidan Kompazitsia",
  "price": "199000.00",
  "instagram_link": "https://www.instagram.com/reel/DIjgRABNbSf/",
  "instagram_ad_id": "120240146122130452",
  "instagram_ad_post_id": "938672392402515"
}
```

Create/PATCH payloadga ham qo'shib yuboriladi:

```json
{
  "name": "Buket Alfalob Gulidan Kompazitsia",
  "price": "199000.00",
  "instagram_link": "https://www.instagram.com/reel/DIjgRABNbSf/",
  "instagram_ad_id": "120240146122130452",
  "instagram_ad_post_id": "938672392402515"
}
```

## UI tavsiya

AI katalog formda Instagram link pastida alohida blok qiling:

`Meta Ads mapping`

Inputlar:

- `Instagram Ad ID`
- `Instagram Ad Post ID`

Helper text:

`Target yoqilganda Meta Ads Manager yoki reklama tafsilotlaridan olingan IDlarni kiriting. Bitta reklamada bir nechta gul bo'lsa, bir xil Ad ID va Post ID bir nechta AI katalog mahsulotiga qo'yilishi mumkin.`

## Backend qanday ishlaydi

Instagram webhookdan referral kelsa backend quyidagilarni metadata qilib saqlaydi:

- `instagram_referral`
- `instagram_ad_id`
- `instagram_ad_post_id`

AI match ketma-ketligi:

1. Avval `instagram_ad_id` / `instagram_ad_post_id` bo'yicha AI katalogdan qidiradi.
2. Agar bir nechta mahsulot shu reklama bilan bog'langan bo'lsa, faqat o'sha mahsulotlarni yuboradi.
3. Agar ad mapping topilmasa, keyin reel/post/story link yoki image matching ishlaydi.

## Operator Telegram notification fix

Backend AI tanlagan katalog mahsulotini endi `catalog_id` orqali saqlaydi. Shuning uchun operator guruhiga yuborilganda fuzzy name match sabab boshqa mahsulot ketib qolmasligi kerak.

Frontend bu joyda qo'shimcha ish qilmaydi.

## Qabul mezoni

- AI katalog create/edit formda `Instagram Ad ID` va `Instagram Ad Post ID` optional fieldlari bor.
- Fieldlar APIga create/PATCHda yuboriladi.
- List/detailda kelgan fieldlar UIda ko'rsatiladi.
- Bir xil reklama ichidagi bir nechta gulga bir xil `instagram_ad_id` va `instagram_ad_post_id` qo'yish mumkin.
- Reklama DMdan kelgan mijozga faqat shu reklama bilan bog'langan AI katalog mahsulotlari ko'rsatiladi.
