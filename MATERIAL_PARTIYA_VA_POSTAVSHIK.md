# Material partiyasi va postavshik

Buket qog'ozi, savat, gupka va boshqa materiallar endi **partiya orqali** kiritiladi.
Partiya ochiladi (raqam, sana, postavshik), keyin ichiga materiallar qo'shiladi.

---

## Gul partiyasidan farqi — muhim

Gulda har partiya **alohida qator** bo'ladi, o'z tannarxi bilan.
Materialda esa **bitta qator bo'lib qoladi**: kirim uning sonini oshiradi va
tannarxini yangilaydi.

```
SAVAT · O'RTA                 ← bitta qator, doim shu

  1-kirim  10.07   50 ta   12 000 so'm   →  soni 50,   tannarx 12 000
  2-kirim  25.07   30 ta   15 000 so'm   →  soni 80,   tannarx 15 000
```

Ya'ni tannarx **oxirgi kirimdan** olinadi. Partiya faqat kirimlarni guruhlaydi
va postavshikni saqlaydi.

---

## Endpointlar

```
GET    /api/material-deliveries/               ro'yxat
POST   /api/material-deliveries/               yangi partiya
GET    /api/material-deliveries/{id}/          bitta partiya
PATCH  /api/material-deliveries/{id}/          tahrirlash
GET    /api/material-deliveries/{id}/items/    ichiga kiritilgan materiallar
POST   /api/material-deliveries/{id}/receive/  partiyaga material kiritish
```

Ruxsat: `inventory` sahifasi. Kiritish uchun `admin` yoki `warehouse` roli.

---

## 1-qadam: partiya ochish

```json
POST /api/material-deliveries/
{
  "number": "M-1",
  "received_at": "2026-08-01",
  "supplier": 22,
  "note": "Qog'oz va savat"
}
```

Javob:

```json
{
  "id": 1,
  "number": "M-1",
  "received_at": "2026-08-01",
  "supplier": 22,
  "supplier_detail": { "id": 22, "name": "Qadoq Servis", "...": "..." },
  "note": "Qog'oz va savat",
  "is_active": true,

  "item_count": 3,          // ichida nechta xil material
  "total_quantity": 180,    // jami kiritilgan dona
  "total_cost": "1200000.00"
}
```

---

## 2-qadam: partiyaga material kiritish

Material **oldin yaratilgan** bo'lishi kerak (`POST /api/materials/`), keyin
partiyaga kiritiladi. Formada material ro'yxatdan **tanlanadi**.

```json
POST /api/material-deliveries/1/receive/
{
  "packaging": 30,
  "quantity": 100,
  "cost_price": "6000"
}
```

| Maydon | Majburiy | Ma'nosi |
|---|---|---|
| `packaging` | ha | Qaysi material — ro'yxatdan tanlanadi |
| `quantity` | ha | Nechta keldi (1 dan kam bo'lmaydi) |
| `cost_price` | yo'q | Dona tannarxi. **Berilmasa** materialning hozirgi tannarxi o'zgarmaydi |
| `reason` | yo'q | Izoh |

Javob — kirim harakati (`PackagingMovement`), ichida `delivery` va `unit_cost` bilan.

Bir partiyaga bir nechta material ketma-ket kiritiladi — har biri uchun alohida
`receive/` chaqiruvi.

---

## Materialda postavshik qayerda ko'rinadi

Materialning o'zida doimiy postavshik yo'q — u **oxirgi kirim partiyasidan** olinadi.
`GET /api/materials/{id}/` javobiga yangi blok qo'shildi:

```json
"last_delivery": {
  "id": 1,
  "number": "M-1",
  "received_at": "2026-08-01",
  "supplier": "Qadoq Servis",
  "supplier_id": 22,
  "quantity": 100,
  "unit_cost": "6000.00"
}
```

Hech qachon kirim bo'lmagan materialda `null` keladi.

Material ro'yxatida shuni ustun qilib qo'yish qulay: **«Oxirgi postavshik»**.

---

## Kirim tarixi

`GET /api/material-movements/?packaging=<id>` — har bir kirim yozuviga ikki
yangi maydon qo'shildi:

| Maydon | Ma'nosi |
|---|---|
| `delivery` | Qaysi partiyadan kelgani (id). Eski yozuvlarda `null` |
| `unit_cost` | O'sha kirimdagi dona tannarxi |

Shu bilan «bu savatni qachon, kimdan, qanchadan olgan edik» degan savolga
javob beriladi — material qatorida faqat oxirgi narx tursa ham, tarix saqlanadi.

---

## Real misol (serverdan)

```
Partiya M-1 · 01.08.2026 · Qadoq Servis

  Buket qog'ozi    100 ta × 6 000    →  soni 0 → 100,  tannarx 5 000 → 6 000
  O'rta savat       30 ta × 15 000   →  soni 0 → 30,   tannarx 12 000 → 15 000
  Gupka             50 ta            →  soni 0 → 50,   tannarx o'zgarmadi
  ──────────────────────────────────────────────────────────────────────────
  jami 3 xil, 180 dona, 1 200 000 so'm

Partiya M-2 · 01.08.2026 · Qadoq Servis

  Buket qog'ozi     50 ta × 7 000    →  soni 100 → 150, tannarx 6 000 → 7 000
```

---

## Ekran uchun taklif

**Sklad → Material partiyalari** ro'yxati:

| Partiya | Sana | Postavshik | Xil | Dona | Tannarx |
|---|---|---|---|---|---|
| M-1 | 01.08.2026 | Qadoq Servis | 3 | 180 | 1 200 000 |

Qatorga bosilganda partiya ichi ochiladi (`/items/`) va o'sha yerda
**«Material kiritish»** tugmasi turadi: material tanlanadi, soni va tannarxi
yoziladi. Bir marta partiya ochib, ketma-ket bir nechta materialni kiritish
mumkin — postavshik va sana qayta so'ralmaydi.

Material ro'yxatiga esa **«Oxirgi postavshik»** ustunini qo'shish kifoya.

---

## Nima o'zgarmadi

- Materialning o'zi (`/api/materials/`) ilgarigidek: nomi, turi, o'lchami,
  tannarx, sotuv narxi, soni
- Katalogga material ishlatish, chiqim, chiqit, tuzatish — hech biriga tegilmadi
- Eski kirim yozuvlarida `delivery` va `unit_cost` bo'sh bo'ladi, bu normal

---

## Tekshirilgani

223 ta avtotest o'tadi, shundan 5 tasi shu ish uchun yozildi.

Real serverda ham 16 ta holat sinaldi: partiya ochish, uchta material kiritish,
tannarx berilganda yangilanishi va berilmaganda o'zgarmasligi, partiya jamilari,
materialda oxirgi partiya va postavshikning ko'rinishi, ikkinchi kirimda sonning
qo'shilib tannarxning yangilanishi va 0 dona kiritishning rad etilishi. Hammasi o'tdi.
