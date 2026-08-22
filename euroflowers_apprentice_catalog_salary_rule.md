# EuroFlowers — Shogirt katalog salary cheklovi

## Maqsad
Shogirtlar katalogga gul yig‘ib qo‘shganda ularga katalog/hajm bo‘yicha ish haqi yozilmasligi kerak.
Shogirtlarning puli faqat kunlik ish haqi orqali hisoblanadi.

## Backend holati
Backendda quyidagi qoida qo‘shildi:

- `staff_type = florist` bo‘lsa katalog/hajm bo‘yicha salary yoziladi.
- `staff_type = apprentice` bo‘lsa katalog yoki custom katalog orqali `FloristSalaryEntry` yozilmaydi.
- Shogirt tanlangan katalogda `florist_salary_amount` avtomatik `0` bo‘ladi.
- Shogirt uchun hajm tarifi majburiy emas.
- Shogirtning kunlik puli davomat orqali alohida yoziladi.

## Frontendda nima o‘zgaradi
Katalog yaratish/edit qilish formasida florist tanlanayotganda `staff_type` ni tekshirish kerak.

Agar tanlangan profil `staff_type = apprentice` bo‘lsa:

- Hajm bo‘yicha ish haqi inputini ko‘rsatmaslik kerak.
- `florist_salary_amount` fieldini yubormaslik kerak yoki `0` yuborish mumkin.
- Hajm tanlash UI kerak bo‘lsa qolishi mumkin, lekin salary hisoblash maqsadida ishlatilmasin.
- Shogirtga “kunlik ish haqi orqali hisoblanadi” degan kichik helper text ko‘rsatish tavsiya qilinadi.

Agar tanlangan profil `staff_type = florist` bo‘lsa:

- Avvalgidek hajm tanlanadi.
- Backend floristning volume rate sozlamasidan salary summani hisoblaydi.
- Custom katalogda agar manual salary amount kerak bo‘lsa, faqat florist uchun yuboriladi.

## API payload tavsiyasi

### Shogirt uchun katalog yaratish
```json
{
  "name_uz": "Shogirt buketi",
  "arrangement_type": "bouquet",
  "catalog_kind": "standard",
  "volume": "small",
  "florist": 12,
  "price": "250000.00",
  "quantity_total": 1,
  "composition": [
    {
      "stock_batch": 391,
      "quantity_stems": 10,
      "quantity_bunches": "0.50"
    }
  ]
}
```

Bu payloadda `florist_salary_amount` yuborilmaydi.
Backend uni `0` qiladi va salary entry yaratmaydi.

### Florist uchun katalog yaratish
Floristlarda hozirgi flow o‘zgarmaydi.
Frontend hajm tanlatadi, backend volume rate orqali salary yozadi.

## Muhim UX qoidalar

- Shogirt tanlanganda salary preview chiqmasin.
- Shogirt tanlanganda “Hajm tarifi topilmadi” kabi xato ko‘rsatmaslik kerak.
- Florist tanlanganda eski salary preview/hajm flow saqlanadi.
- Davomat sahifasida shogirtning kunlik puli alohida ko‘rinadi.

## Tekshiruv case

1. Shogirt tanlab katalog qo‘shiladi.
2. Katalog saqlanadi.
3. Florist salary listda bu katalog bo‘yicha entry chiqmasligi kerak.
4. Shogirt davomatdan keldi/ketdi qilinsa, kunlik salary yozilishi kerak.
5. Oddiy florist tanlab katalog qo‘shilganda esa salary avvalgidek yozilishi kerak.
