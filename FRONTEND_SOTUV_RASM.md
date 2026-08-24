# Katalogdan sotish: rasm yuklash va Telegram guruhga xabar

Backend tayyor. Frontendda **bitta narsa** qo'shilishi kerak: sotish oynasiga rasm
yuklash maydoni. Rasm yuklangan zahoti backend sotuv xabarini rasm bilan birga
Telegram guruhga o'zi yuboradi — frontend Telegram bilan ishlamaydi.

---

## 1. Endpoint

```
POST /api/catalog/{id}/sell/
```

Rasm yuborilganda **`multipart/form-data`** bo'lishi shart. Rasmsiz sotuvda
avvalgidek JSON yuborsa ham ishlaydi — endpoint uchalasini ham qabul qiladi
(`JSONParser`, `FormParser`, `MultiPartParser`).

## 2. Maydonlar

| Maydon | Tur | Majburiy | Izoh |
|---|---|---|---|
| `quantity` | int | yo'q (default 1) | nechta dona sotildi |
| `sale_price` | decimal | yo'q | **bir donaning** sotilgan narxi. Berilmasa katalog narxi olinadi |
| `discount_reason` | string | yo'q | narx katalogdan past bo'lsa sabab |
| `payment_type` | `cash` \| `card` \| `debt` \| `mixed` | yo'q | to'lov turi |
| `cash_amount` | decimal | `mixed` da **ha** | naqd qismi, noldan katta |
| `card_amount` | decimal | `mixed` da **ha** | karta qismi, noldan katta |
| `delivery_amount` | decimal | yo'q | dastafka puli |
| `sold_at` | datetime | yo'q | tarixiy sotuv uchun. Berilmasa hozirgi vaqt |
| `reservation` | id | yo'q | bron bo'yicha sotuv |
| `materials` | list | yo'q | qo'shimcha qadoq |
| `decoration_florist` | id | yo'q | bezagan florist |
| `customer` | id | `debt` da **ha*** | bor mijozni tanlash |
| `customer_name` + `customer_phone` | string | `debt` da **ha*** | yangi mijoz ochish |
| `debt_note` | string | yo'q | qarz izohi |
| **`sale_image`** | **file** | **yo'q** | **YANGI — sotilgan gulning rasmi** |
| `sale_image_url` | string | yo'q | rasm allaqachon yuklangan bo'lsa URL i |

\* `debt` da yo `customer`, yo `customer_name` **va** `customer_phone` birga
kelishi kerak. Ikkisi ham bo'lmasa 400 qaytadi.

### `delivery_amount` — diqqat qiling

Dastafka **sotuv summasining ichida** turadi, ustiga qo'shilmaydi.

```
sale_price        = 850 000   ← mijozdan olinadigan to'liq pul
delivery_amount   =  50 000   ← shundan kuryerga ketadi
savdo (do'kon puli) = 800 000  ← backend o'zi hisoblaydi
```

Ya'ni foydalanuvchi «mijozdan qancha oldingiz» ni kiritadi, dastafkani alohida
maydonga yozadi. Qo'shib yuborish kerak emas.

### `mixed` to'lov

```
payment_type = "mixed"
cash_amount  = 400000
card_amount  = 450000
```
Ikkalasi ham majburiy va ikkalasi ham noldan katta bo'lishi kerak, aks holda:
```json
{"cash_amount": ["Aralash to'lovda naqd va karta summasini kiriting"]}
```

## 3. So'rov namunasi

```js
const form = new FormData();
form.append("quantity", "1");
form.append("sale_price", "850000");
form.append("payment_type", "mixed");
form.append("cash_amount", "400000");
form.append("card_amount", "450000");
form.append("delivery_amount", "50000");
if (file) form.append("sale_image", file);   // <input type="file" accept="image/*">

await api.post(`/catalog/${id}/sell/`, form);
// Content-Type ni QO'LDA qo'ymang — brauzer boundary bilan o'zi qo'yadi
```

Axios/fetch da `Content-Type: application/json` ni majburlab qo'ysa multipart
buziladi. Interceptor da default header bo'lsa, `FormData` bo'lganda uni olib
tashlash kerak.

## 4. Rasm maydoni uchun UI talablari

- `<input type="file" accept="image/*" capture="environment">` — telefonda
  to'g'ridan-to'g'ri kameradan olish uchun `capture` foydali
- tanlangan rasmning **preview** i ko'rinsin, «o'chirish» tugmasi bo'lsin
- rasm **ixtiyoriy**: yuklanmasa backend katalogdagi gul rasmini yuboradi
- katta fayl uchun cheklov qo'yish tavsiya etiladi (masalan 10 MB) va
  yuborishdan oldin siqish
- yuborilayotganda tugma bloklanib, progress ko'rinsin — multipart sekinroq

## 5. Javob

Muvaffaqiyatli bo'lsa `CatalogItemSerializer` qaytadi (yangilangan
`quantity_sold`, `status` va h.k.).

Yuklangan rasmning URL i sotuv tarixida ko'rinadi:

```
GET /api/catalog/{id}/sales/
→ results[].sale_image_url
```

Sotuv tarixi jadvalida shu URL bilan kichik rasm ko'rsatish mumkin.

## 6. Telegram guruhga nima ketadi

Backend sotuvdan keyin rasmni caption bilan guruhga yuboradi. Frontend bunga
aralashmaydi. Xabar shu ko'rinishda:

```
🌸 *Alfalob Gulidan Katta Kompazitsia 100 Tali*
🏬 Parkent filiali
🧾 Soni: *2 ta*
📐 Hajmi: katta · bo'yi 60 sm · diametri 45 sm
💰 Savdo: *800 000 so'm*
🚚 Dastafka: 50 000 so'm
🧮 Jami olingan: *850 000 so'm*
🔀 To'lov: *Aralash* — 💵 400 000 · 💳 450 000
🏷 Chegirma: 200 000 so'm
↳ Doimiy mijoz
👤 Sotdi: Diyor A
🕒 24.08.2026 18:40
```

Qatorlar shartli: filial, soni, hajm, dastafka va chegirma faqat ma'lumot
bo'lganda chiqadi.

## 7. Sozlama — bu bo'lmasa xabar ketmaydi

Guruh sozlanmagan bo'lsa sotuv baribir amalga oshadi, faqat xabar ketmaydi va
logda `SALE_GROUP_NOT_CONFIGURED` yoziladi.

**Umumiy (asosiy filial) uchun** — developer sozlamalari:

```
PATCH /api/integrations/
{ "sale_bot_token": "...", "sale_group_chat_id": "-100..." }
```

**Har filialning o'z guruhi uchun:**

```
PATCH /api/branches/{id}/
{ "sale_bot_token": "...", "sale_group_chat_id": "-100..." }
```

Tokenlar javobda **qaytmaydi** (`write_only`). Sozlanganini bilish uchun
`sale_group_configured: true/false` maydoni bor — sozlamalar sahifasida
«guruh ulangan / ulanmagan» ko'rsatib turish uchun shu maydonni ishlating.

Filialga biriktirilgan katalog sotilsa o'sha filialning boti ishlatiladi,
asosiy filial sotuvi umumiy sozlamadagi botga ketadi. Filial guruhi
sozlanmagan bo'lsa xabar boshqa guruhga **tushmaydi** — shunchaki yuborilmaydi.

## 8. Tekshirish ro'yxati

- [ ] sotish oynasida rasm tanlash maydoni bor, preview va o'chirish ishlaydi
- [ ] rasm bilan sotuv `multipart/form-data` bo'lib ketadi
- [ ] `Content-Type` qo'lda qo'yilmagan
- [ ] rasmsiz sotuv ham avvalgidek ishlaydi
- [ ] `mixed` da naqd va karta ikkalasi ham so'raladi, nol qabul qilinmaydi
- [ ] `delivery_amount` «mijozdan olingan summaning ichida» deb tushuntirilgan
- [ ] `debt` da mijoz yoki ism+telefon majburiy
- [ ] sotuv tarixida `sale_image_url` ko'rinadi
- [ ] sozlamalar sahifasida `sale_group_configured` holati ko'rinadi
