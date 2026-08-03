# Postavshikda qarz yo'q · Partiya sonini tuzatish

Ikkita o'zgarish.

---

## 1. Postavshikda qarz ko'rsatkichi olib tashlandi

Postavshikdan har safar **to'liq to'lab** sotib olinadi — qarz tushunchasi yo'q.
Shuning uchun `outstanding` maydoni butunlay olib tashlandi.

### O'zgargan javob

```json
GET /api/suppliers/

{
  "id": 23,
  "name": "Hojiakbar",
  "supplier_type": "flower",
  "batches_count": 35,
  "total_received_stems": 7390,
  "purchase_total": "23767000.00",     ← umumiy sotib olingan
  "paid_total": "0.00",
  "last_payment_at": null
}
```

`outstanding` **yo'q** — endi umuman kelmaydi.

### Frontendda qilinadigan ish

- Postavshik ro'yxati va kartochkasidan **«Qarz»** ustunini/blokini olib tashlash
- `purchase_total` ni **«Umumiy sotib olingan»** deb nomlash
- `?ordering=outstanding` ishlatilgan bo'lsa olib tashlash — bu maydon bo'yicha
  saralash ham yo'q. `?ordering=-purchase_total` ishlaydi

### Qolgani

`paid_total` va `last_payment_at` joyida, `/api/supplier-payments/` ham
ilgarigidek ishlaydi — to'lovlarni yozib borish imkoni saqlandi. Faqat
**qarz hisobi** yo'q.

### Eslatma

Tekinga qo'shib berilgan gul (`is_free`) umumiy xaridga **kirmaydi** —
tannarxi nol bo'lgani uchun. Ya'ni «Umumiy sotib olingan» faqat haqiqatda
pul to'langan gulni ko'rsatadi.

---

## 2. Partiyadagi kelgan sonni tuzatish

Xato kiritilgan son endi to'g'ri tuzatiladi. **Ilgari buzuq ishlar edi.**

### Nima noto'g'ri edi

100 dona kelgan, 30 tasi ishlatilgan (qoldiq 70). Kelgan sonni 120 ga tuzatsangiz:

```
kelgan = 120,  qoldiq = 120     ← ishlatilgan 30 dona unutilardi
```

Skladda yo'q gul bor bo'lib ko'rinardi. Ustiga ishlatilgandan kam son ham
qabul qilinardi va kirim yozuvi jurnalda eski raqamda qolardi.

### Endi qanday

```
PATCH /api/stock-batches/{id}/
{ "received_stems": 120 }
```

| Holat | Natija |
|---|---|
| 100 → 120 (30 ishlatilgan) | kelgan 120, qoldiq **90** |
| 100 → 80 (30 ishlatilgan) | kelgan 80, qoldiq **50** |
| 120 → 10 (30 ishlatilgan) | **400** — «Bu partiyadan allaqachon 30 dona ishlatilgan. Kelgan sonni undan kam qilib bo'lmaydi.» |

Ya'ni qoldiq **farq qancha bo'lsa o'shancha siljiydi**, ishlatilgan gul unutilmaydi.

Kirim harakati ham yangi songa moslanadi — sklad jurnali to'g'ri qoladi.
Chiqim yozuvlariga tegilmaydi.

### Qo'lda qoldiq qo'yish

`remaining_stems` ni **aniq** yuborsangiz ilgarigidek to'g'ridan-to'g'ri
qo'yiladi — inventarizatsiyada qo'lda tuzatish imkoni saqlandi:

```json
PATCH /api/stock-batches/{id}/
{ "received_stems": 120, "remaining_stems": 65 }
```

Bunda avtomatik hisob ishlamaydi, siz bergan son qo'yiladi.

### Narx tahriri

Faqat narx o'zgartirilsa qoldiqqa tegilmaydi:

```json
PATCH /api/stock-batches/{id}/
{ "sale_price_per_bunch": "60000" }
```

### Audit

Har bir son tuzatishi audit jurnaliga yoziladi — kim, qachon, qaysi sondan
qaysi songa va o'sha paytda qancha ishlatilgan edi.

### Forma uchun

Partiya tahriri oynasida «Kelgan soni» maydonini **ochiq** qoldiring.
Yoniga kichik izoh foydali bo'ladi:

```
Kelgan soni  [ 120 ]
             Bu partiyadan 30 dona ishlatilgan. Kamida shuncha bo'lishi kerak.
```

Ishlatilgan sonni `received_stems - remaining_stems` dan hisoblasa bo'ladi.

---

## Tekshirilgani

276 ta avtotest o'tadi, shundan 9 tasi shu ikki ish uchun yozildi.

Real serverda ham tekshirildi: 100 dona kelib 30 tasi ishlatilgan partiyada
son 120 ga tuzatildi va qoldiq 90 bo'ldi, kirim yozuvi 120 ga yangilandi,
10 ga tushirishga urinish esa xato bilan to'xtatildi.
