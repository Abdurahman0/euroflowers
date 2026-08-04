# Rasxodlar sahifasi — Google Calendar ko'rinishida

Sahifa **oy kalendari** bo'lib ochiladi. Har bir kun katakchasida o'sha kunning
rasxodlari yozuv-yozuv turadi, tepasida kunlik jami. Kunga bosilsa o'sha sanaga
yangi rasxod qo'shiladi.

> **O'zgarish:** rasxodda **tur (category) yo'q** — olib tashlandi. Qoladi:
> summa, qayerga ketdi, izoh, sana, to'lov usuli.

---

## 1. Umumiy ko'rinish

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Rasxodlar          [Bugun]  ‹  Avgust 2026  ›        [Oy][Hafta][Kun]  [+]  │
│                                          Oylik jami: 4 350 000 so'm · 12 ta  │
├────────┬────────┬────────┬────────┬────────┬────────┬────────────────────────┤
│  Du    │  Se    │  Chor  │  Pay   │  Ju    │  Sha   │  Yak                   │
├────────┼────────┼────────┼────────┼────────┼────────┼────────────────────────┤
│  27    │  28    │  29    │  30    │  31    │   1    │   2                    │
│        │        │        │        │        │2 500 000│                       │
│        │        │        │        │        │•Ijara  │                        │
│        │        │        │        │        │ 2.5 mln│                        │
├────────┼────────┼────────┼────────┼────────┼────────┼────────────────────────┤
│   3    │   4 ●  │   5    │   6    │   7    │   8    │   9                    │
│        │ 350 000│        │        │        │        │                        │
│        │•Kuryer │        │        │        │        │                        │
│        │ 150 000│        │        │        │        │                        │
│        │•Svet   │        │        │        │        │                        │
│        │ 200 000│        │        │        │        │                        │
│        │+2 ta   │        │        │        │        │                        │
└────────┴────────┴────────┴────────┴────────┴────────┴────────────────────────┘
```

- Bugungi kun katakchasi ajratilgan (`●` va boshqa fon rangi)
- Kun katakchasida **eng ko'pi 3 ta** yozuv ko'rsatiladi, qolgani `+N ta` bo'lib
  turadi — bosilsa kun paneli ochiladi
- Kun tepasidagi qalin son — **o'sha kunning jami rasxodi**
- Rasxodsiz kunlar bo'sh, ochroq fonda
- Joriy oydan tashqaridagi kunlar (27–31) xira ko'rinadi

---

## 2. Boshqaruv

| Amal | Natija |
|---|---|
| Kun katakchasiga bosish | Yangi rasxod formasi, **sanasi o'sha kun** qilib to'ldirilgan |
| Yozuvga bosish | O'ng tomondan tahrirlash paneli ochiladi |
| `+` tugmasi | Yangi rasxod, sanasi bugun |
| `‹` `›` | Oldingi / keyingi oy |
| `Bugun` | Joriy oyga qaytadi |
| `Oy / Hafta / Kun` | Ko'rinishni almashtiradi |
| Klaviatura: `←` `→` | Oy almashtirish |
| Klaviatura: `T` | Bugunga qaytish |
| Klaviatura: `N` | Yangi rasxod |
| `Esc` | Panelni yopish |

---

## 3. Yangi rasxod formasi

Google Calendar'dagi "Yangi hodisa" oynasi kabi — kichik, tez to'ladigan modal:

```
┌──────────────────────────────────────────────┐
│  Yangi rasxod                            ✕   │
├──────────────────────────────────────────────┤
│  Summa                                       │
│  ┌────────────────────────────────────────┐  │
│  │ 150 000                          so'm  │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  Qayerga ketdi                               │
│  ┌────────────────────────────────────────┐  │
│  │ Kuryerga                               │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  🕐  4-avgust 2026, 17:40        [o'zgartir] │
│                                              │
│  💳  ( ) Naqd   (•) Karta   ( ) O'tkazma     │
│                                              │
│  📝  Izoh (ixtiyoriy)                        │
│  ┌────────────────────────────────────────┐  │
│  │ Chilonzorga dastafka                   │  │
│  └────────────────────────────────────────┘  │
│                                              │
│              [ Bekor ]     [ Saqlash ]       │
└──────────────────────────────────────────────┘
```

**Muhim:**

1. Faqat **Summa** va **Qayerga ketdi** majburiy. Qolganini teginmasdan
   saqlash mumkin.
2. Sana avtomat to'ldirilgan (bosilgan kun yoki hozir). Foydalanuvchi
   tegmasa **backendga umuman yubormang** — u o'zi hozirgi vaqtni qo'yadi.
   "o'zgartir" bosilsa sana+vaqt tanlagich ochiladi.
3. Summa maydoniga fokus avtomat tushadi, `Enter` — saqlash.
4. To'lov usuli sukut bo'yicha **Naqd**.

---

## 4. Kun / yozuv paneli

Kunga yoki yozuvga bosilganda o'ngdan panel chiqadi (Google Calendar'dagi kabi):

```
┌────────────────────────────────┐
│  4-avgust, seshanba        ✕   │
│  Jami: 350 000 so'm · 2 ta     │
├────────────────────────────────┤
│  17:40   Kuryerga              │
│          150 000 · Naqd        │
│          Chilonzorga dastafka  │
│                    [✎]  [🗑]   │
├────────────────────────────────┤
│  09:15   Svet puli             │
│          200 000 · O'tkazma    │
│                    [✎]  [🗑]   │
├────────────────────────────────┤
│        [ + Shu kunga qo'shish ]│
└────────────────────────────────┘
```

O'chirishda tasdiq so'ralsin ("Rasxod o'chirilsinmi?").

---

## 5. Ranglar

Tur olib tashlangani uchun rang **to'lov usuli** bo'yicha beriladi:

| To'lov | Rang | Nuqta |
|---|---|---|
| Naqd | yashil | `#22c55e` |
| Karta | ko'k | `#3b82f6` |
| O'tkazma | binafsha | `#8b5cf6` |

Yozuv oldidagi kichik doiracha shu rangda bo'ladi. Boshqa hech qayerda
rangli fon ishlatilmasin — sahifa toza qolsin.

---

## 6. API bilan bog'lanish

### Oyni yuklash

Kalendar ochilganda ko'rinib turgan oraliq uchun **bitta so'rov**:

```
GET /api/expenses/?date_from=2026-07-27&date_to=2026-09-06&page_size=500&ordering=spent_at
```

`date_from` / `date_to` — kalendar to'rida ko'rinib turgan **birinchi va oxirgi
katakcha** sanasi (oldingi/keyingi oyning kunlari ham kiradi). Javobdagi
qatorlarni `spent_at` ning sanasi bo'yicha guruhlab kataklarga joylang.

Tepadagi "Oylik jami" uchun aynan shu oyning o'zi:

```
GET /api/expenses/summary/?date_from=2026-08-01&date_to=2026-08-31
```

```json
{
  "totals": { "expense_count": 12, "total": "4350000.00", "average": "362500.00" },
  "by_payment_method": [
    { "payment_method": "cash", "label": "Naqd", "count": 9, "total": "3150000.00" }
  ],
  "by_day": [ { "date": "2026-08-04", "count": 2, "total": "350000.00" } ]
}
```

`by_day` dan kun katakchalaridagi jami sonni olsangiz ham bo'ladi — ikkinchi
so'rov qilmasdan ro'yxatdan hisoblasangiz ham bo'ladi, ixtiyoringiz.

### Qo'shish

```http
POST /api/expenses/
{
  "amount": "150000",
  "destination": "Kuryerga",
  "payment_method": "cash",
  "note": "Chilonzorga dastafka"
}
```

Sana tanlangan bo'lsa qo'shing: `"spent_at": "2026-08-01T10:00:00+05:00"`.
Yubormasangiz backend hozirgi vaqtni qo'yadi.

### Boshqa endpointlar

| Metod | URL | Vazifasi |
|---|---|---|
| PATCH | `/api/expenses/{id}/` | Tahrirlash |
| DELETE | `/api/expenses/{id}/` | O'chirish (`204`) |
| GET | `/api/expenses/options/` | To'lov usullari ro'yxati |

### Maydonlar

| Maydon | Turi | Majburiy |
|---|---|---|
| `amount` | decimal string | **ha** |
| `destination` | string (200) | **ha** — "qayerga ketdi" |
| `note` | text | yo'q |
| `payment_method` | `cash` / `card` / `transfer` | yo'q (sukut `cash`) |
| `spent_at` | datetime | yo'q (yubormasangiz hozirgi vaqt) |
| `branch` | id | yo'q |

Javobda qo'shimcha: `payment_method_label`, `branch_name`, `created_by_detail`,
`created_at`. Vaqtlar **+05:00** da keladi.

### Xatolar

| Holat | Javob |
|---|---|
| `destination` bo'sh | `400 {"destination": ["Pul qayerga ketganini yozing"]}` |
| `amount` ≤ 0 | `400 {"amount": ["Summa noldan katta bo'lishi kerak"]}` |
| Ruxsat yo'q | `403 {"detail": "Sizda bu sahifa uchun ruxsat yo'q."}` |

---

## 7. Ruxsat

`/api/me/` dagi `permissions` ichida:

```json
{ "page": "expenses", "label": "Rasxodlar", "can_view": true, "can_control": true }
```

- `can_view` — kalendarni ko'radi
- `can_control` — qo'shadi / tahrirlaydi / o'chiradi. Bo'lmasa `+` tugmasi va
  `✎` `🗑` tugmalari ko'rinmasin.

---

## 8. Qo'shimcha ko'rinishlar

### Hafta ko'rinishi

7 ta ustun, har birida shu kunning barcha yozuvlari (kesilmasdan). Yuqorida
haftalik jami.

### Kun ko'rinishi

Bitta kunning barcha rasxodlari vaqt bo'yicha ro'yxat, tepada kunlik jami.

### Ro'yxat (jadval) ko'rinishi — ixtiyoriy

Kalendar asosiy bo'lsa ham, "Ro'yxat" tugmasi qo'shsangiz yaxshi bo'ladi:
sana / qayerga / summa / to'lov / izoh / kim kiritdi ustunlari bilan oddiy
jadval, qidiruv (`?search=`) va summa oralig'i (`min_amount`, `max_amount`)
filtrlari bilan.

---

## 9. Hisob-kitob sahifasi bilan bog'liqlik

`/api/accounting/` javobiga rasxod qo'shilgan:

| Maydon | Izoh |
|---|---|
| `summary.expense_total` | Davr ichidagi rasxodlar yig'indisi |
| `summary.expense_count` | Nechta rasxod |
| `summary.net_profit_after_expenses` | `net_profit − expense_total` |
| `expenses` | Davr ichidagi rasxodlar ro'yxati (sana, summa, qayerga, to'lov) |

`net_profit` o'zgarmagan — u avvalgidek sotuv foydasi. Hisob-kitobda shunday
ko'rsating:

```
Sof foyda                5 200 000
Rasxodlar             -  4 350 000
--------------------------------
Rasxoddan keyingi foyda    850 000
```

Bir xil maydonlar `by_branch` ichidagi har bir filial qatorida ham bor.

---

## 10. Diqqat

1. **Tur (category) endi yo'q** — eski hujjatdagi `category`, `category_label`,
   `/api/expenses/categories/` ishlatilmaydi. O'rniga `/api/expenses/options/`.
2. `amount` string bo'lib keladi — ko'rsatishdan oldin formatlang
   (`150 000 so'm`).
3. `date_from` / `date_to` **sarflangan sana** bo'yicha ishlaydi, yozuv
   kiritilgan sana bo'yicha emas.
4. Oy almashganda eski so'rovni bekor qiling (abort) — tez bosilganda
   javoblar aralashib ketmasin.
5. Mobilda kalendar to'ri o'rniga kunlar ro'yxati bo'lgani qulay: sana
   sarlavhasi + o'sha kunning yozuvlari, pastda suzuvchi `+` tugmasi.
