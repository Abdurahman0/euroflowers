# Filial asosiy filial narxini ko'rmaydi

Parkent foydalanuvchisi katalog javobida **Toshkentdagi sotuv narxini**, tannarxni,
florist haqini, foyda blokini va gullarning narxlarini ko'rib turgan edi.
Yopildi.

---

## Sizib chiqqan ma'lumot (tuzatishdan oldin)

Parkentdagi 450 000 so'mlik buketni ochganda ko'rinardi:

```
source_price               300 000     ← Toshkent narxi
calculated_cost_price      120 000
calculated_component_price 140 000
florist_fee                 50 000
profit → unit_cost 60 000, margin 86.67%
composition[].batch_detail → cost_per_stem 1 000, sale_price_per_stem 2 000
/api/catalog-transfers/    → source_price 300 000
```

---

## Endi filial nima ko'radi

Faqat o'ziga kerakli narsalar: nomi, rasmi, turi, hajmi, soni, **o'z sotuv narxi**,
holati, sotuv tarixi.

Javobdan **butunlay olib tashlanadigan** maydonlar (filial foydalanuvchisi uchun):

| Maydon | Nima uchun |
|---|---|
| `source_price` | Asosiy filial narxi |
| `source_item` | Manba katalog |
| `calculated_cost_price` | Tannarx |
| `calculated_component_price` | Hisoblangan komponent narxi |
| `florist_fee`, `florist_salary_amount` | Florist haqi |
| `discount_amount`, `discount_percent` | Komponent narxidan hisoblanadi, tannarxni oshkor qiladi |
| `profit` | Butun blok — tannarx va marja |
| `florist`, `florist_detail` | Kim yasagani asosiy filial ishi |

Ichma-ich joylardan ham tozalanadi:

- `composition[].batch_detail` — `cost_per_stem`, `sale_price_per_stem`,
  `cost_per_bunch`, `sale_price_per_bunch`, `cost_per_stem_exact`,
  `sale_price_per_stem_exact`, `stock_value`, `rounding`, `supplier`,
  `delivery`, `received_stems`, `remaining_stems`
- `materials[].packaging_detail` — `cost_price`, `sale_price`, `quantity`
- `history[].snapshot` — ichida asosiy filial narxi va tarkibi turadi

Gulning **nomi, navi, rangi, bo'yi** qoladi — buketni tavsiflash uchun kerak.

---

## Muhim

**Bu faqat filial foydalanuvchisiga tegishli.** Asosiy filial admini uchun
hech narsa o'zgarmadi — hamma maydon ilgarigidek keladi.

Ya'ni frontend bitta komponent bilan ishlayveradi, faqat maydon **yo'q bo'lishi
mumkinligini** hisobga olish kerak:

```js
// noto'g'ri — filialda xato beradi
item.profit.unit_cost

// to'g'ri
item.profit?.unit_cost ?? null
```

Filial ekranida bu maydonlar uchun ustun/blok **umuman chizilmasin**.

---

## Transfer yozuvlari

`GET /api/catalog-transfers/`

- Filial faqat **o'ziga kelgan** yuborishlarni ko'radi (ilgari hammasini ko'rardi)
- `source_price` va `source_item` javobdan olib tashlanadi
- `target_price`, `quantity`, `branch_name`, `created_at` qoladi

Asosiy filial admini ilgarigidek hammasini, `source_price` bilan ko'radi.

---

## Filial narxni o'zgartirishi

O'zgarmadi — ilgarigidek ishlaydi:

```json
PATCH /api/catalog/{id}/
{ "price": "500000" }
```

Chegirma bilan sotish ham o'sha-o'sha (izoh majburiy).

---

## Filialga katalog yuborishning ikki yo'li

Ikkalasi ham bor, ikkalasida ham son belgilanadi:

**1. Mavjud katalogdan yuborish (transfer)**

```json
POST /api/catalog/{id}/transfer/
{ "branch": 2, "quantity": 2, "price": "450000", "note": "Parkentga" }
```

Asosiy filialdagi katalogdan bir qismi ajratiladi. `price` — filialdagi narx.
Berilmasa asosiy narx qoladi.

**2. Darrov filial uchun qo'shish**

```json
POST /api/catalog/
{ "name_uz": "...", "branch": 2, "quantity_total": 2, "price": "450000",
  "composition": [ { "stock_batch": 99, "quantity_stems": 30 } ] }
```

Gul asosiy filial skladidan yechiladi.

Ikkala holatda ham filial keyin faqat **narxini** o'zgartiradi va sotadi.

---

## Tekshirilgani

246 ta avtotest o'tadi, shundan 5 tasi shu ish uchun yozildi: filialga narx va
tannarx ko'rinmasligi, asosiy filialga hammasi ko'rinishi, transferda
`source_price` yashirilishi, filial faqat o'z transferlarini ko'rishi va
narxni o'zgartira olishi.

Real serverda ham tekshirildi — yuqoridagi sizib chiqqan maydonlarning hammasi
endi `null` qaytadi, filial narxi 450 000 esa joyida.
