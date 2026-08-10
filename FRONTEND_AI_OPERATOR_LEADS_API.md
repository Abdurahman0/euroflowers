# AI endi skladni ko'rsatmaydi — so'rovlar operatorga topshiriladi

**Serverga chiqarildi — 10.08.2026.** Backend API sxemasi buzilmadi: mavjud
maydonlar joyida, faqat `Lead.details` ichiga yangi kalitlar qo'shildi va
`Conversation.ai_summary` endi to'ldiriladi.

## Nima o'zgardi

Ilgari AI mijozga skladdagi gullar ro'yxatini dona narxi bilan yozib berardi.
Chatlarda shunday javoblar chiqib turardi:

```
Skladimizda hozir quyidagi gullar bor

1 Atirgul — dona 8 000 so'm
2 Atirgul — dona 8 000 so'm
...
16 Atirgul Alfalob To'q Pushti — dona 16 000 so'm
```

Bu ichki ma'lumot edi va mijozga chiqmasligi kerak. Endi AI dan sklad butunlay
olib tashlandi — u gul ro'yxatini ham, dona narxini ham, sklad rasmini ham
ko'rmaydi.

AI ga qolgan function'lar faqat shular: `get_catalog`, `send_catalog_album`,
`send_catalog_image`, `client_leads_get`, `client_lead_create`, `client_lead_edit`.

## AI endi qanday ishlaydi

| Holat | AI nima qiladi |
|---|---|
| Katalogdan tayyor mahsulot | Avvalgidek albom yuboradi, aniq narxini aytadi, buyurtma oladi |
| Mijoz o'zi yasatmoqchi | Gul turi, hajm, buket yoki savat va kontaktni oladi. **Narx aytmaydi** |
| Mijoz rasm yubordi | Operatorlar ko'rib javob berishini aytadi, kontakt oladi, rasm havolasini leadga yozadi |
| AI javob berolmagan savol | Kontakt oladi va leadga yozadi |

Hamma holatda oxiri bitta — **lead**. Operator uchun butun ma'lumot leadning
ichida bo'ladi.

## `Lead.details` — yangi kalitlar

`GET /api/leads/` va `GET /api/leads/{id}/` javobidagi `details` obyektiga
to'rtta kalit qo'shildi. Eski kalitlar (`catalog_items`, `stock_items`, `note`,
`created_by`) joyida qoldi.

```json
"details": {
  "created_by": "ai_tool",
  "topic": "custom_order",
  "flowers_text": "Jumila pushti atirgul",
  "size_text": "51 dona, katta",
  "photo_urls": [],
  "note": "Tug'ilgan kunga sovg'a",
  "catalog_items": [],
  "stock_items": []
}
```

| Kalit | Turi | Ma'nosi |
|---|---|---|
| `topic` | string | So'rov turi, quyidagi jadvalga qarang |
| `flowers_text` | string | Mijoz aytgan gul nomi va rangi, **o'z so'zi bilan**. Aytmagan bo'lsa bo'sh string |
| `size_text` | string | Hajm yoki dona soni. Masalan `"51 dona, katta"` |
| `photo_urls` | string[] | Mijoz yuborgan rasm havolalari, ko'pi bilan 5 ta |
| `note` | string | Qolgan tafsilotlar — idish rangi, kimga sovg'a va hokazo |

### `topic` qiymatlari

| Qiymat | O'zbekcha | Operator nima qiladi |
|---|---|---|
| `catalog_order` | Katalogdan buyurtma | Narx aniq, buyurtmani rasmiylashtiradi |
| `custom_order` | Yasatma buyurtma | **Narxni o'zi hisoblab, mijozga aytadi** |
| `photo_request` | Rasm bo'yicha so'rov | Rasmni ochib ko'radi, javob beradi |
| `question` | Savol | Mijozga qo'ng'iroq qilib javob beradi |
| `other` | Boshqa mavzu | Ko'rib chiqadi |

`topic` bo'sh string bo'lishi ham mumkin — eski leadlarda va operator qo'lda
yaratgan leadlarda u yo'q. `details.topic || null` deb o'qing.

### `estimated_price` yasatma buyurtmada `null`

Bu eng muhim o'zgarish. Ilgari AI custom buketga taxminiy narx qo'yardi, endi
qo'ymaydi — `topic: "custom_order"` bo'lgan leadda `estimated_price` va
`florist_fee` **null yoki 0** bo'ladi.

Lead ro'yxatidagi narx ustuni bo'sh qolmasin, o'rniga shunday yozing:

```
Narxni operator belgilaydi
```

Operator narxni kiritgach `PATCH /api/leads/{id}/` bilan `estimated_price`
yuboriladi — bu avvalgidek ishlaydi.

### `photo_urls` — rasm serverda saqlanmaydi

Havolalar Instagram yoki Telegram CDN dan keladi, biz ularni o'z serverimizga
ko'chirmaymiz. Shuning uchun:

- Havolani `<img src>` qilib qo'yish mumkin, lekin **Telegram havolalari
  vaqtinchalik** — bir muddatdan keyin ishlamay qolishi mumkin.
- Yonida "Rasmni yangi oynada ochish" havolasi ham bo'lsin.
- Rasm ochilmasa xatolik ko'rsatmang, shunchaki "Rasm muddati o'tgan, mijozdan
  qayta so'rang" deb yozing.

## `Conversation.ai_summary` endi to'ldiriladi

Ilgari bu maydon doim bo'sh edi. Endi lead yaratilganda yoki yangilanganda
bitta qatorlik xulosa yoziladi:

```
Yasatma buyurtma · buket · gul Jumila pushti atirgul · hajmi 51 dona, katta · Jumila pushti atirguldan 51 dona katta buket yasatish so'rovi
```

```
Rasm bo'yicha so'rov · 1 ta rasm havolasi · Mijoz rasm yubordi va shu buketdan bormi deb so'radi
```

`GET /api/conversations/` va `GET /api/conversations/{id}/` da keladi.
Chat ro'yxatida suhbat nomi ostiga yoki chat oynasining tepasiga chiqarsangiz,
operator suhbatni ochmasdan nima gapligini tushunadi.

Hali lead yaratilmagan suhbatlarda bo'sh string bo'ladi.

## Xabar biriktirmalari — yangi `kind: "photo"`

`Message.metadata.attachments` dagi `kind` maydoniga yangi qiymat qo'shildi.

| `kind` | Ilgari | Endi |
|---|---|---|
| `photo` | yo'q edi, `media` yoki `post` bo'lardi | Mijoz yuborgan oddiy rasm |
| `story` / `post` / `reel` / `voice` / `media` | o'zgarmadi | o'zgarmadi |

Xabar matnida ham havola oldiga `Mijoz yuborgan rasm:` deb yoziladi.
Chatda `kind === "photo"` bo'lgan biriktirmani rasm qilib ko'rsatsangiz bo'ladi.

## Nima o'zgarmadi

Bularga tegilmadi, eski kod ishlayveradi:

- Lead, Conversation, Message endpointlari va ularning maydonlari
- Katalog albomi va katalog mahsuloti narxi
- Mini app narx hisobi — u avvalgidek skladdan hisoblaydi
- CRM ichidagi sklad sahifalari, partiyalar, floristlar
- Leadga qo'lda `stock_usage` qo'shish

Ya'ni **sklad faqat AI dan olib tashlandi**, CRM dan emas. Operator avvalgidek
hamma narsani ko'radi.

## Frontend uchun tavsiya

Lead kartasida shunday ko'rinsa qulay bo'ladi:

```
[Yasatma buyurtma]                          Narxni operator belgilaydi

Jumila pushti atirguldan 51 dona katta buket yasatish so'rovi

Gul      Jumila pushti atirgul
Hajm     51 dona, katta
Izoh     Tug'ilgan kunga sovg'a

Bekzod · +998 90 123 45 67
```

`photo_request` bo'lsa yuqoriga rasm eskizini qo'ying.

TypeScript tipi:

```ts
type LeadTopic = "catalog_order" | "custom_order" | "photo_request" | "question" | "other"

type LeadDetails = {
  topic?: LeadTopic | ""
  flowers_text?: string
  size_text?: string
  photo_urls?: string[]
  note?: string
  catalog_items?: { catalog_name: string; quantity: number }[]
  stock_items?: unknown[]
  created_by?: string
}
```

Savol bo'lsa yozing.
