# Partiya tahriri — nima o'zgaradi, nima qulflanadi

Partiyadagi deyarli hamma maydon tahrirlanadi. Ikki joyda cheklov bor —
ular tarixni buzib yuboradigan joylar.

---

## Erkin tahrirlanadi

| Maydon | Izoh |
|---|---|
| `height_cm`, `height_from_cm`, `height_to_cm` | Bo'yi |
| `delivery` | Boshqa partiyaga ko'chirish |
| `supplier`, `received_at` | Partiya tanlanmagan bo'lsa |
| `cost_per_bunch`, `cost_per_stem` | Tannarx |
| `sale_price_per_bunch`, `sale_price_per_stem` | Sotuv narxi |
| `is_free` | Tekin belgisi |
| `minimum_sale_stems`, `image_url`, `notes`, `is_active` | Qolganlari |
| `received_stems` | Kelgan soni — qoldiq farq bo'yicha siljiydi |
| `stems_per_bunch` | Pochkadagi dona — dona narxlari qayta hisoblanadi |

---

## 1. Gul navi — ishlatilgandan keyin qulflanadi

**Muammo shu edi:** partiyadan buket yasalgandan keyin ham navni almashtirsa
bo'lardi. Natijada o'sha buketning tarkibi ham o'zgarib ketardi — buket `Prut`
dan yasalgan bo'lsa ham katalogda `Alfalob` deb ko'rinardi.

**Endi:**

```json
PATCH /api/stock-batches/{id}/
{ "variant": 32 }
```

| Holat | Natija |
|---|---|
| Partiyaga hali tegilmagan | ✅ Nav o'zgaradi — xato tanlangan bo'lsa bemalol tuzatiladi |
| Guldan biror narsa ishlatilgan | ❌ 400 |

```json
{ "variant": ["Bu partiyadan allaqachon gul ishlatilgan, navini almashtirib bo'lmaydi. Xato bo'lsa partiyani arxivlab, to'g'ri nav bilan yangisini kiriting."] }
```

«Ishlatilgan» deganda: qoldiq kelgan sondan kam, yoki katalog tarkibida bor,
yoki floristga chiqarilgan, yoki leadda ishlatilgan, yoki chiqim/chiqit
harakati bo'lgan.

### Formada

Nav maydonini **ishlatilgan partiyada bloklab qo'ying** va yoniga izoh:

```
Gul navi  [ Atirgul · Prut · Oq ]  🔒
          Bu partiyadan gul ishlatilgan, navni almashtirib bo'lmaydi
```

Ishlatilganini bilish oson: `remaining_stems !== received_stems` bo'lsa
albatta ishlatilgan. To'liq tekshiruvni backend qiladi — shunchaki 400 ni
ko'rsating.

---

## 2. Pochkadagi dona — narxlar qayta hisoblanadi

**Muammo shu edi:** `stems_per_bunch` ni 25 dan 50 ga o'zgartirsangiz dona
narxlari eskicha qolardi. Pochka narxi 25 000, pochkada 50 ta, lekin dona
narxi hamon 1 000 — bir-biriga to'g'ri kelmasdi.

**Endi:**

```json
PATCH /api/stock-batches/{id}/
{ "stems_per_bunch": 50 }
```

```
pochka tannarx  25 000  (o'zgarmaydi)
dona tannarx     1 000  →  500        ← 25 000 / 50

pochka sotuv    50 000  (o'zgarmaydi)
dona sotuv       2 000  →  1 000      ← 50 000 / 50
```

Dona narxi ilgarigidek **eng yaqin 100 ga** yaxlitlanadi va yaxlitlanmagan
aniq hisob ham yangilanadi.

**Dona narxini qo'lda yuborsangiz u ustun keladi:**

```json
{ "stems_per_bunch": 50, "cost_per_stem": "700" }   →  dona tannarx 700
```

Tekin gulda (`is_free`) dona tannarxi baribir 0 bo'lib qoladi.

---

## 3. Kelgan soni — ilgari yozilgan

Bu qoida oldingi hujjatda bor edi, eslatib o'taman:

```
100 → 120 (30 ishlatilgan)  :  qoldiq 70 → 90
100 →  80 (30 ishlatilgan)  :  qoldiq 70 → 50
120 →  10 (30 ishlatilgan)  :  400 — ishlatilgandan kam bo'lmaydi
```

Kirim harakati ham yangi songa moslanadi.

---

## Partiyani o'chirish

Sklad tarixi bo'lgan partiya o'chmaydi — **arxivlanadi**:

```json
DELETE /api/stock-batches/{id}/
→ 200 { "detail": "Bu partiyada sklad tarixi bor. Partiya o'chirilmadi, is_active=false qilib arxivlandi.", "is_active": false }
```

Tegilmagan partiya butunlay o'chadi (204).

Shuning uchun nav xato bo'lsa yo'l shu: **arxivlash → to'g'ri nav bilan yangisini kiritish.**

---

## Real misol (serverdan)

```
Partiya: Prut · 200 dona · 25/pochka, katalogga 30 dona ishlatilgan

  gul navi          → 400  qulflangan
  pochkadagi dona   → 200  25 → 50, dona narxlari qayta hisoblandi
  bo'yi             → 200
  partiya           → 200
  sotuv narxi       → 200
  tannarx           → 200
  tekin belgisi     → 200
  izoh              → 200

  Katalog tarkibi:  nav = Prut  (o'zgarmadi)
```

---

## Tekshirilgani

290 ta avtotest o'tadi, shundan 5 tasi shu ish uchun yozildi: tegilmagan
partiyada nav tuzatilishi, ishlatilganida qulflanishi, katalogda ishlatilgan
holat, pochkadagi dona o'zgarganda narxlarning qayta hisoblanishi va qo'lda
kiritilgan dona narxining ustun kelishi.
