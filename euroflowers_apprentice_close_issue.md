# EuroFlowers — Shogirt chiqarilgan gulni yopish flowi

## Backend o‘zgarishi
Shogirt uchun chiqarilgan gulni yopishda hajm tarifi talab qilinmaydi.

Oldingi muammo:

- Shogirtga gul chiqarilgandan keyin `close-issue` yoki `close-issues` ishlatilganda backend `hajm tarifi to‘liq emas` degan xato qaytarishi mumkin edi.
- Bu floristlar uchun to‘g‘ri edi, lekin shogirtlar kunlik ish haqi bilan yuradi, hajm tarifi bilan emas.

Yangi qoida:

- `staff_type = florist` bo‘lsa eski logic saqlanadi: yopishda hajm tarifi kerak.
- `staff_type = apprentice` bo‘lsa hajm tarifi kerak emas.
- Shogirt uchun yopishda backend `weight_source = apprentice_equal` qaytaradi.
- Shogirtga katalog orqali salary yozilmaydi.
- Shogirt puli faqat davomat/keldi-ketdi orqali kunlik yoziladi.

## Frontendda nima qilish kerak

Frontend shogirt tanlangan holatda hajm tarifi talab qilmasligi kerak.

### Katalog qo‘shish
Agar tanlangan `florist.staff_type = apprentice` bo‘lsa:

- `florist_salary_amount` yubormang yoki `0` yuboring.
- `volume_rates` mavjudligini majburiy tekshirmang.
- Hajm tanlash UI qolishi mumkin, lekin salary preview chiqmasin.
- Helper text: `Shogirt ish haqi kunlik hisoblanadi`.

Agar tanlangan `florist.staff_type = florist` bo‘lsa:

- Eski hajm/tarif flow saqlanadi.
- Tarif bo‘lmasa frontend ogohlantirishi mumkin.

### Chiqarilgan gulni yopish
Shu APIlar o‘zgarmaydi:

```http
POST /api/florist-stock-issues/close-issue/
POST /api/florist-stock-issues/close-issues/
POST /api/florist-stock-issues/close-issues-preview/
```

Payload avvalgidek:

```json
{
  "items": [
    {
      "florist": 12,
      "batch": 391,
      "return_stems": 0
    }
  ],
  "absorb_remainder": true
}
```

Shogirt bo‘lsa backend endi tarif xatosi qaytarmaydi.

## Frontend UX tavsiyasi

- Florist listdan tanlanganda `staff_type_label` yoki `staff_type` ko‘rsatilsin.
- Shogirt tanlanganda salary/hajm tarifi bloklari yashirilsin.
- Florist tanlanganda hajm tariflari ko‘rsatilsin.
- Yopish preview javobida `weight_source = apprentice_equal` bo‘lsa frontend buni oddiy matn qilib ko‘rsatishi mumkin: `Shogirt uchun tarifsiz taqsimlandi`.

## Tekshiruv case

1. Shogirtga gul chiqaring.
2. Shu shogirt nomidan yoki admin orqali katalog yarating.
3. Katalog tarkibida shu batch tanlangan bo‘lsin.
4. Chiqarilgan gulni yoping.
5. Xato chiqmasligi kerak.
6. Salary listda shogirtga katalog bo‘yicha pul yozilmasligi kerak.
7. Shogirt davomat qilsa, kunlik ish haqi alohida yozilishi kerak.
