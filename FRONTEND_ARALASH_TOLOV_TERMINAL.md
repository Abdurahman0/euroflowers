# Katalogdan sotish: aralash to'lovga terminal qo'shildi

> **Loyiha: EuroFlowers CRM** (backend `/api/catalog/...`)

Backend tayyor. Frontendda **bitta narsa** o'zgaradi: `mixed` (Aralash) to'lov
tanlanganda ikkita emas, **uchta** summa maydoni ko'rsatiladi — naqd, karta va
terminal.

Sababi: 200 000 so'mlik gulning 100 000 i terminaldan, 100 000 i naqd
berilishi mumkin. Avval bunday sotuvni yozib bo'lmasdi.

---

## 1. Endpoint

O'zgarmadi:

```
POST /api/catalog/{id}/sell/
```

## 2. Nima o'zgardi

| Maydon | Tur | Majburiy | Izoh |
|---|---|---|---|
| `payment_type` | `cash` \| `card` \| **`terminal`** \| `debt` \| `mixed` | yo'q | `terminal` avval ham qabul qilinardi, ro'yxatda ko'rsatilmagan edi |
| `cash_amount` | decimal | `mixed` da shartli | naqd qismi |
| `card_amount` | decimal | `mixed` da shartli | karta qismi |
| **`terminal_amount`** | **decimal** | `mixed` da shartli | **YANGI — terminal qismi** |

Qolgan maydonlar (`quantity`, `sale_price`, `delivery_amount`, `materials`,
`customer`, `sale_image` va boshqalar) o'zgarmadi.

## 3. `mixed` qoidasi

Eski qoida: `cash_amount` va `card_amount` ikkalasi ham majburiy, ikkalasi ham
noldan katta bo'lishi shart edi.

Yangi qoida: **uchtadan kamida ikkitasi noldan katta bo'lsin.** Qaysi ikkitasi
— farqi yo'q.

Ya'ni endi shular ham to'g'ri:

```jsonc
// naqd + terminal
{ "payment_type": "mixed", "cash_amount": 100000, "terminal_amount": 100000 }

// karta + terminal
{ "payment_type": "mixed", "card_amount": 50000, "terminal_amount": 150000 }

// uchalasi
{ "payment_type": "mixed", "cash_amount": 50000, "card_amount": 50000, "terminal_amount": 100000 }

// eskisi ham ishlayveradi
{ "payment_type": "mixed", "cash_amount": 100000, "card_amount": 100000 }
```

Yuborilmagan maydon 0 deb qabul qilinadi — `0` yozib yuborsangiz ham bo'ladi,
umuman yubormasangiz ham.

Faqat bitta summa yuborilsa xato qaytadi:

```json
{ "cash_amount": "Aralash to'lovda kamida ikkita summani kiriting: naqd, karta yoki terminal" }
```

Bitta usul bilan to'langan bo'lsa `mixed` emas, o'sha usulning o'zini yuboring:
`"payment_type": "terminal"`.

## 4. Frontend uchun eslatmalar

1. **Aralash tanlanganda uchta input ko'rsating** — Naqd, Karta, Terminal.
   Uchalasi ham bo'sh qolishi mumkin, lekin kamida ikkitasi to'ldirilishi kerak.
2. **Yig'indi sotuv summasiga teng bo'lishi shart.** Backend tekshiradi va teng
   bo'lmasa 400 qaytaradi:

   ```json
   { "detail": "Naqd, karta va terminal yig'indisi olinadigan summaga teng emas. Olinadi: 200000.00, kiritilgan: 150000.00" }
   ```

   Olinadigan summa = `sale_price × quantity`. Dastafka puli shu summaning
   **ichida** — ustiga qo'shilmaydi. Formada "qolgan summa" ko'rsatib turgan
   ma'qul, shunda operator 400 ni ko'rmaydi.
3. **`terminal` alohida to'lov turi sifatida ham ro'yxatda tursin** — aralash
   emas, hammasi terminaldan to'langan holat uchun.
4. **O'qishda:** sotuv tarixida `payment_breakdown` endi uchta kalit qaytaradi:

```json
{ "cash": "100000", "card": "0", "terminal": "100000" }
```

Avval faqat `cash` va `card` bor edi. Eski sotuvlarda `terminal` doim `"0"`
bo'ladi — hech narsa buzilmaydi.

5. **Hisobotlarda** terminal ulushi `sales_terminal_total` va `terminal_total`
   ga tushadi, "Sovda" jadvalidagi `terminal` ustuniga ham. Bular avval ham bor
   edi, endi aralash sotuvdan ham to'ladi.
