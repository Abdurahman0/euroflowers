# 🎯 Har floristga alohida hajm tariflari

**Sana:** 2026-07-31 · **Testlar:** 175 ta ✅ · **Serverda ishlayapti**

Har bir floristga **buket** va **savat** uchun `S / M / L` hajmlari bo'yicha
**ish haqi** va **ketadigan gul soni** alohida belgilanadi.

Umumiy tarif **olib tashlandi** — endi har florist o'z tarifiga ega.

---

## 📋 1. Tarif nima

Bitta tarif = bitta florist + buket yoki savat + hajm.

```
Abror  ·  Buket  ·  M  →  60 000 so'm  ·  25 dona gul
Abror  ·  Savat  ·  L  →  90 000 so'm  ·  40 dona gul
Dilnoza·  Buket  ·  M  →  75 000 so'm  ·  25 dona gul
```

Bir xil hajmga ikki florist **turli haq** olishi mumkin — tajribasiga qarab.

---

## 🔧 2. Endpoint

```
GET  POST  PATCH  DELETE   /api/florist-volume-rates/
```

### Yaratish

```json
POST /api/florist-volume-rates/
{
  "florist": 4,
  "arrangement_type": "bouquet",
  "volume": "M",
  "default_stems": 25,
  "florist_fee": "60000"
}
```

| Maydon | Tur | Majburiy | Izoh |
|---|---|---|---|
| `florist` | integer | **ha** | Florist id |
| `arrangement_type` | enum | ha | `bouquet` yoki `basket` |
| `volume` | string | ha | `S` `M` `L` yoki o'zingiz xohlagan nom |
| `default_stems` | integer | yo'q | Shu hajmga ketadigan gul soni |
| `florist_fee` | decimal | yo'q | Florist oladigan summa |

Javobda `florist_name` ham keladi.

### ⚠️ `florist` majburiy

Bo'sh qoldirilsa `400`:

```json
{ "florist": ["Tarif aniq floristga biriktirilishi kerak. Umumiy tarif ishlatilmaydi."] }
```

Ilgari `florist` bo'sh bo'lsa «umumiy tarif» sifatida hammaga ishlardi.
**Bu olib tashlandi.**

### Bir florist uchun bitta hajm bitta marta

`florist + arrangement_type + volume` uchtasi birga **noyob**.
Takror yaratilsa `400`. O'zgartirish uchun `PATCH` ishlating.

### Filtr

```
GET /api/florist-volume-rates/?florist=4
GET /api/florist-volume-rates/?arrangement_type=bouquet
GET /api/florist-volume-rates/?volume=M
GET /api/florist-volume-rates/?is_active=true
```

---

## 👤 3. Florist kartochkasi orqali ham

`/api/florists/{id}/` javobida **`volume_rates`** massivi bor va u orqali
tariflarni birdaniga saqlash mumkin:

```json
PATCH /api/florists/4/
{
  "volume_rates": [
    { "arrangement_type": "bouquet", "volume": "S", "default_stems": 15, "florist_fee": "40000" },
    { "arrangement_type": "bouquet", "volume": "M", "default_stems": 25, "florist_fee": "60000" },
    { "arrangement_type": "bouquet", "volume": "L", "default_stems": 40, "florist_fee": "85000" },
    { "arrangement_type": "basket",  "volume": "S", "default_stems": 20, "florist_fee": "50000" },
    { "arrangement_type": "basket",  "volume": "M", "default_stems": 35, "florist_fee": "75000" },
    { "arrangement_type": "basket",  "volume": "L", "default_stems": 55, "florist_fee": "110000" }
  ]
}
```

Bu yerda `florist` yozish shart emas — URL dan olinadi.

**Diqqat:** ro'yxatda **bo'lmagan** tariflar `is_active: false` qilinadi.
Ya'ni bu to'liq almashtirish, qisman emas. Formada barcha 6 qatorni birga yuboring.

Shogird (`staff_type: "apprentice"`) qilib o'zgartirilsa barcha tariflari
avtomatik nofaol bo'ladi — shogird kunlik ish haqi oladi.

---

## ⚙️ 4. Katalogda qanday ishlaydi

Katalog qo'shilganda **florist** va **hajm** tanlansa, mos tarif topilib
`florist_salary_amount` **avtomatik** qo'yiladi.

```
Katalog:  florist = Abror,  arrangement_type = bouquet,  volume = M
   ↓
Tarif topildi:  60 000
   ↓
florist_salary_amount = 60 000  (qo'lda yozish shart emas)
```

- Tarif **topilmasa** — avtomatik qo'yilmaydi, qo'lda kiritasiz
- `florist_salary_amount` ni **o'zingiz yuborsangiz** — tarif ustidan yozilmaydi,
  sizning qiymatingiz qoladi
- Florist tanlanmagan bo'lsa tarif qidirilmaydi

Ish haqi **katalog qo'shilganda** floristga yoziladi, sotuvda emas.

`default_stems` — bu tavsiya, formada gul sonini oldindan to'ldirish uchun.
Majburlamaydi, florist boshqacha qo'ysa ham bo'ladi.

---

## 🗑️ 5. Eski umumiy tariflar

Bazadagi **6 ta umumiy tarif o'chirildi**.

Har bir floristga tariflarini **qaytadan kiritish kerak**. Aks holda katalog
qo'shishda `florist_salary_amount` avtomatik to'lmaydi.

---

## 🖥️ Frontend uchun taklif

Florist kartochkasida jadval:

```
              S              M              L
        ┌──────────┬──────────────┬──────────────┐
Buket   │ 40 000   │  60 000      │  85 000      │
        │ 15 dona  │  25 dona     │  40 dona     │
        ├──────────┼──────────────┼──────────────┤
Savat   │ 50 000   │  75 000      │ 110 000      │
        │ 20 dona  │  35 dona     │  55 dona     │
        └──────────┴──────────────┴──────────────┘
                              [ Saqlash ]
```

«Saqlash» bosilganda 6 qatorni birga `PATCH /api/florists/{id}/` ga
`volume_rates` sifatida yuborish qulay.

Katalog formasida florist va hajm tanlangach `florist_salary_amount` maydonini
tarifdan oldindan to'ldirib qo'ysangiz — operator ko'radi va kerak bo'lsa
o'zgartiradi.

---

## ✅ Qisqacha

| Nima | Holat |
|---|---|
| Har floristga alohida S/M/L tarif | ✅ |
| Buket va savat uchun alohida | ✅ |
| Ish haqi va gul soni belgilanadi | ✅ |
| Umumiy tarif olib tashlandi | ✅ |
| Katalogda avtomatik qo'llanadi | ✅ |
