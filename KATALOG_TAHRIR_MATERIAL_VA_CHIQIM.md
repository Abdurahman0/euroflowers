# Katalog tahriri, materiallar, florist haqi va chiqimni tuzatish

To'rtta o'zgarish.

---

## 1. Katalog sonini tahrirlash — tuzatildi

**Muammo.** Katalogda son va gul birga tahrirlansa xato chiqardi:

```
{ "detail": "Katalog sklad qoldig'i umumiy katalog sonidan oshib ketdi" }
```

Sabab backendda edi: qoldiq qaytarilgach obyekt bazadan yangilanmasdi va keyingi
saqlash eski qiymatni qaytarib yozardi.

**Endi.** Chiqim yopilishidan **oldin** katalog sonini bemalol tuzatish mumkin.
Ikkala usul ham ishlaydi:

```json
PATCH /api/catalog/{id}/
{ "quantity_total": 4 }

PATCH /api/catalog/{id}/
{ "quantity_total": 4, "composition": [ { "stock_batch": 97 } ] }
```

Keyin chiqim yopilganda gul yangi songa qarab taqsimlanadi.

> Bu tuzatish florist katalogiga ham, oddiy sklad katalogiga ham tegishli —
> ilgari ikkalasida ham shu xato bor edi.

**Yopilgandan keyin sonni oshirish** hamon gul talab qiladi — bu to'g'ri xatti-harakat:

```
{ "detail": "Abror qo'lida yetarli gul yo'q: PROBE-1 (0 dona bor, 75 kerak)" }
```

Bunday holda avval floristga yana gul chiqaring yoki `adjust` amali bilan tuzating.

---

## 2. Katalogda materiallar tanlash — bor, hujjatlashtirildi

Ha, katalogga material qo'shish allaqachon bor. Standart katalogda ham, custom
katalogda ham ishlaydi.

### So'rov

```json
POST /api/catalog/
{
  "name_uz": "Katta buket",
  "arrangement_type": "bouquet",
  "volume": "M",
  "florist": 4,
  "price": "500000",
  "quantity_total": 1,
  "composition": [ { "stock_batch": 97 } ],
  "materials": [
    { "packaging": 12, "quantity": 1 },
    { "packaging": 15, "quantity": 2 }
  ]
}
```

| Maydon | Ma'nosi |
|---|---|
| `packaging` | Qaysi material — `/api/materials/` dan tanlanadi |
| `quantity` | Katalogning **bitta donasiga** nechta ketadi |

Ro'yxatni turi bo'yicha filtrlash mumkin:

```
GET /api/materials/?packaging_type=wrap      buket qog'ozi
GET /api/materials/?packaging_type=basket    savat
GET /api/materials/?packaging_type=box       quti
GET /api/materials/?packaging_type=other     boshqalar (gupka, lenta)
```

### Qoidalar

- **Material soni majburiy** — guldan farqli, u chiqim yopilishini kutmaydi.
- Material skladdan **darrov** yechiladi: `quantity × quantity_total`.
- Yetmasa tushunarli xato: «Katalogni saqlash uchun material qoldig'i yetarli emas».
- Javobda `materials[].packaging_detail` ichida materialning to'liq ma'lumoti keladi.
- Katalog tannarxi uchga bo'linadi: **gul + material + florist haqi**
  (`profit` bloki va `/api/accounting/` da alohida ustunlar bor).

---

## 3. Florist haqini qo'lda kiritish — olib tashlandi

**Standart katalogda** `florist_salary_amount` endi qabul qilinmaydi. Haq faqat
floristga belgilangan **hajm tarifidan** olinadi.

Yuborsangiz ham e'tiborga olinmaydi — javobda tarifdagi summa qaytadi:

```
yuborildi:  "florist_salary_amount": "999000"
qaytdi:     "florist_salary_amount": "50000.00"     ← M hajm tarifi
```

Formadan bu maydonni **olib tashlang**. O'rniga hajm tanlanganda tarifdagi summani
faqat ko'rsatib qo'ying (o'zgartirib bo'lmaydigan matn sifatida).

### Tarif belgilanmagan bo'lsa

Endi katalog qo'shilayotgan paytdayoq to'xtatiladi — ilgari faqat chiqim
yopilganda bilinardi:

```json
{ "volume": ["Abror uchun bu hajm tarifi belgilanmagan. Avval floristga hajm narxini kiriting."] }
```

Tariflar: `GET/POST /api/florist-volume-rates/?florist=<id>`

### Custom katalog

Custom katalogda `florist_salary_amount` **qoladi** — ish hajmi oldindan noma'lum,
shuning uchun operator o'zi kiritadi. U yerda maydonni olib tashlamang.

---

## 4. Floristga berilgan gulni tahrirlash — qo'shildi

Chiqim noto'g'ri yozilgan bo'lsa endi tuzatiladi yoki butunlay bekor qilinadi.

### Tahrirlash

```json
PATCH /api/florist-stock-issues/{id}/edit/
{ "quantity_stems": 250, "reason": "Tuzatildi" }
```

Farq qancha bo'lsa sklad va floristdagi qoldiq o'shancha siljiydi:

```
30 dona chiqarilgan edi  →  50 ga tuzatildi
   skladda:  −20         floristda:  +20

keyin 20 ga tuzatildi
   skladda:  +30         floristda:  −30
```

Qaytarish va chiqit yozuvlari uchun ham ishlaydi — yo'nalish avtomatik hisobga olinadi.

### Bekor qilish

```
DELETE /api/florist-stock-issues/{id}/cancel/     →  204
```

Yozuv o'chadi, sklad va florist qoldig'i asl holiga qaytadi, sklad harakati ham
o'chiriladi.

### Xatolar

| Holat | Javob |
|---|---|
| Skladda yetarli gul yo'q | 400 — «... partiyasida atigi N dona qolgan» |
| Florist qo'lida yo'q (allaqachon ishlatilgan) | 400 — «... qo'lida atigi N dona bor» |
| Ishlatilgan chiqimni bekor qilish | 400 — «... qo'lida atigi 0 dona bor, 100 donalik chiqimni bekor qilib bo'lmaydi» |

Xato bo'lsa hech narsa o'zgarmaydi.

### Ekran uchun

«Floristlarga chiqarilgan gullar» ro'yxatidagi har qatorga ikki tugma:
**✏️ Tuzatish** va **🗑 Bekor qilish**. Tuzatishda faqat son va izoh so'raladi —
florist va gul o'zgarmaydi (ular o'zgarsa bu boshqa chiqim bo'ladi, eskisini
bekor qilib yangisini kiritish kerak).

---

## Tekshirilgani

235 ta avtotest o'tadi, shundan 9 tasi shu ish uchun yozildi.

Real serverda ham sinaldi: 300 dona chiqarilgan floristda katalog soni 2 → 3 → 4
qilib tahrirlandi (son bilan tarkib birga ham), keyin chiqim yopildi va 300 dona
4 ta buketga 75 donadan to'g'ri taqsimlandi.
