# Ishlatilgan partiyada navni almashtirish

Nav xato yozilgan bo'lsa endi partiyani arxivlab yangisini kiritish shart emas.
Alohida amal bilan almashtiriladi va ishlatilgan joylar ham moslanadi.

---

## Nega bu xavfsiz

**Narxlar partiyada saqlanadi, gul navida emas.** Shuning uchun nav
almashtirilganda katalog tannarxi, foyda va hisob-kitob — hech biri
o'zgarmaydi. Faqat ko'rinadigan gul nomi o'zgaradi.

**Ishlatilgan joylar o'zi yangilanadi.** Katalog tarkibi, sklad harakatlari,
floristdagi qoldiq va lead — hammasi partiyaga bog'langan, nav ularda alohida
saqlanmaydi.

**Bitta muzlatilgan nusxa bor** — sotuv tarixidagi `snapshot` ichida gul nomi
matn bo'lib yozilib qoladi. U ham avtomatik yangilanadi, aks holda eski nom
qolib ketardi.

---

## 1. Avval ishlatilgan joylarni ko'rish

```
GET /api/stock-batches/{id}/usage/
```

```json
{
  "batch": 167,
  "batch_number": "CHG-QA",
  "variant": "Atirgul · Prut · Oq",
  "is_used": true,
  "catalog_items": 1,
  "sold_catalog_items": 1,
  "florist_issues": 0,
  "lead_usages": 0,
  "stock_movements": 2,
  "used_stems": 40
}
```

Tasdiq oynasida shu raqamlarni ko'rsating — foydalanuvchi nimaga tegayotganini
bilib tursin.

## 2. Almashtirish

```json
POST /api/stock-batches/{id}/change-variant/
{
  "variant": 32,
  "reason": "Kirimda xato nav yozilgan"
}
```

`reason` **majburiy** — audit jurnaliga yoziladi.

Javob odatdagi partiya, ustiga:

```json
"variant_change": {
  "old_variant": "Atirgul · Prut · Oq",
  "new_variant": "Atirgul · Alfalob · To'q Pushti",
  "usage": { "catalog_items": 1, "sold_catalog_items": 1, "used_stems": 40 },
  "history_rows_updated": 2
}
```

### Xatolar

| Holat | Javob |
|---|---|
| Sabab yozilmagan | 400 — `{"reason": ["Ushbu maydon to'ldirilishi shart."]}` |
| Ayni nav tanlangan | 400 — «Bu nav allaqachon tanlangan» |
| Ruxsat yo'q | 403 — `inventory` sahifasi boshqarish huquqi kerak |

---

## 3. Oddiy tahrirda nav qulflangan qoladi

`PATCH /api/stock-batches/{id}/` orqali **ishlatilgan** partiyada nav
o'zgarmaydi — tasodifan bosilib ketmasligi uchun:

```json
{ "variant": ["Bu partiyadan allaqachon gul ishlatilgan. Navni almashtirish uchun «change-variant» amalidan foydalaning — u ishlatilgan joylarni ham moslaydi."] }
```

**Tegilmagan** partiyada esa oddiy PATCH bilan bemalol tuzatiladi — u yerda
hech qanday tarix yo'q.

---

## Ekran uchun taklif

Partiya tahriri oynasida nav maydoni yonida kichik tugma: **«Navni almashtirish»**.
Bosilganda `usage/` chaqiriladi va tasdiq oynasi ochiladi:

```
NAVNI ALMASHTIRISH

  Atirgul · Prut · Oq   →   [ Atirgul · Alfalob · To'q Pushti ▾ ]

  ⚠ Bu partiya quyidagilarda ishlatilgan:
      1 ta katalog (1 tasi sotilgan)
      40 dona gul ketgan
      2 ta sklad harakati

  Ularda gul nomi yangi navga o'zgaradi.
  Narxlar, sonlar va foyda o'zgarmaydi.

  Sabab [ Kirimda xato nav yozilgan          ]

                    [ Bekor ]   [ Almashtirish ]
```

`is_used: false` bo'lsa tasdiq oynasi kerak emas — oddiy tahrirning o'zida
navni almashtiraverish mumkin.

---

## Qachon ishlatmaslik kerak

Bu amal **«nav boshidanoq xato yozilgan»** holat uchun. Ya'ni o'sha buketlarda
haqiqatan yangi nav bo'lgan, faqat yorlig'i noto'g'ri edi.

Agar partiya **rostdan eski nav bo'lgan** va siz qatorni boshqa gul uchun qayta
ishlatmoqchi bo'lsangiz — almashtirmang, yangi partiya kiriting. Aks holda
o'tgan buketlar noto'g'ri gul bilan qolib ketadi.

Tizim bu ikkisini farqlay olmaydi, shuning uchun sabab majburiy qilingan va
har almashtirish audit jurnalida turadi.

---

## Real misol (serverdan)

```
Partiya CHG-QA · Prut · katalogga 40 dona ketgan, 1 buket sotilgan

  usage/                    →  katalog 1 (sotilgan 1), 40 dona, 2 harakat
  oddiy PATCH               →  400, change-variant ga yo'naltiradi
  sababsiz change-variant   →  400
  sabab bilan               →  200

  Prut → Alfalob
  katalog tarkibi           →  Alfalob
  katalog tannarxi          →  140 000 → 140 000   (o'zgarmadi)
  hisob-kitob               →  7 380 000 → 7 380 000  (o'zgarmadi)
  sotuv tarixidagi eski nom →  yangilandi (2 qator)
  audit                     →  sabab bilan yozildi
```

---

## Tekshirilgani

297 ta avtotest o'tadi, shundan 7 tasi shu ish uchun yozildi.
Real serverda ham 9 ta holat sinaldi — hammasi o'tdi.
