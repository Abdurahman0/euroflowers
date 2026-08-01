# Filial uchun to'g'ridan-to'g'ri katalog qo'shish

Ilgari Parkentga katalog faqat **transfer** orqali tushardi: avval asosiy filialda
katalog yaratilardi, keyin bir qismi filialga yuborilardi.

Endi asosiy filialdan turib **darrov «Parkent uchun»** deb katalog qo'shish mumkin —
qaysi guldan necha dona ketganini ham ko'rsatib.

---

## So'rov

Odatdagi `POST /api/catalog/`, faqat **`branch`** maydoni bilan:

```json
{
  "name_uz": "Parkent uchun buket",
  "arrangement_type": "bouquet",
  "volume": "M",
  "branch": 2,
  "price": "500000",
  "quantity_total": 2,
  "status": "available",
  "composition": [
    { "stock_batch": 99, "quantity_stems": 30 }
  ],
  "materials": [
    { "packaging": 12, "quantity": 1 }
  ]
}
```

| Maydon | Ma'nosi |
|---|---|
| `branch` | Qaysi filial uchun. Bo'sh qoldirilsa asosiy filial |
| `composition[].stock_batch` | Qaysi gul |
| `composition[].quantity_stems` | Katalogning **bitta donasiga** necha dona gul |

Filiallar ro'yxati: `GET /api/branches/?is_main=false&is_active=true`

---

## Muhim qoidalar

**Gul soni majburiy.** Bu florist katalogi emas — chiqim yopish bosqichi yo'q,
shuning uchun son darrov yoziladi.

**Gul asosiy filial skladidan yechiladi.** Yuqoridagi misolda 30 × 2 = **60 dona**
skladdan kamayadi. Yetmasa odatdagi xato chiqadi.

**Katalog filialga tegishli bo'ladi.** Asosiy filial ro'yxatida **ko'rinmaydi**,
filial foydalanuvchisi esa uni darrov ko'radi va sotadi.

**Faqat asosiy filial foydalanuvchisi qo'sha oladi.** Filial foydalanuvchisining
o'zi katalog yaratolmaydi — bu ilgarigidek:

```json
{ "detail": "Filialda yangi katalog yaratilmaydi. Asosiy filialdan yuboriladi." }
```

---

## Kelib chiqish narxi (`source_price`)

Transferda `source_price` — asosiy filialdagi narx. To'g'ridan-to'g'ri qo'shilganda
bunday narx yo'q, chunki katalog asosiy filialda sotuvga qo'yilmagan.

Shuning uchun backend **bir donaga to'g'ri keladigan tannarxni** yozib qo'yadi:

```
tannarx (2 dona uchun)  :  160 000
source_price (1 dona)   :   80 000
```

Shu tufayli filial hisobotidagi **ustama haqiqiy foydani** ko'rsatadi:

```
sotildi        500 000
kelib chiqishi  80 000
ustama         420 000      ← 500 000 − 80 000
```

Xohlasangiz `source_price` ni o'zingiz ham yuborishingiz mumkin — u holda
avtomatik hisob ishlamaydi.

---

## Filial hisobotida — yangi maydonlar

`GET /api/branch-report/` javobidagi har bir filial qatoriga uchta maydon qo'shildi:

| Maydon | Ma'nosi |
|---|---|
| `received_quantity` | **Transfer** orqali kelgan dona (avvalgidek) |
| `direct_quantity` | **To'g'ridan-to'g'ri** filial uchun qo'shilgan dona |
| `incoming_quantity` | Ikkalasining yig'indisi — «jami kelgan» |

`totals` ichida ham shu uchtasi bor.

Ilgari to'g'ridan-to'g'ri qo'shilgan kataloglar hisobotda «kelgan» sifatida umuman
ko'rinmasdi — endi ko'rinadi va transferdan ajratilgan.

---

## Real misol (serverdan)

```
Parkent uchun buket · 2 dona · 500 000 so'm
  gul: 30 dona × 2 = 60 dona asosiy sklad'dan yechildi
  tannarx 160 000  →  source_price 80 000 / dona

FILIAL HISOBOTI
  transfer orqali   : 0
  to'g'ridan-to'g'ri: 2
  jami kelgan       : 2
  sotilgan          : 1  —  500 000
  kelib chiqishi    : 80 000
  ustama            : 420 000

HISOB-KITOB (?branch=2)
  savdo 500 000 · tannarx 80 000 · sotilgan gul 30 dona
```

---

## Ekran uchun taklif

Katalog qo'shish formasida yuqoriga **«Qaysi filial uchun»** tanlagichi:

```
( • ) Asosiy filial          ( ) Parkent filiali
```

Filial tanlanganda forma o'zgarmaydi — gul, soni, material hammasi o'sha-o'sha.
Faqat saqlangandan keyin katalog asosiy ro'yxatda ko'rinmasligini eslatib qo'ying,
masalan yashil xabar: «Katalog Parkent filialiga qo'shildi».

Filial foydalanuvchisiga bu tanlagich umuman ko'rsatilmaydi.

---

## Nima o'zgarmadi

- Transfer (`POST /api/catalog/{id}/transfer/`) ilgarigidek ishlaydi — ikkala yo'l ham bor
- Filialda narxni o'zgartirish va chegirma bilan sotish o'zgarmadi
- Hisob-kitobdagi filial ajratmasi (`by_branch`) o'zgarmadi
- Asosiy filial katalogi (branch bo'sh) ilgarigidek

---

## Tekshirilgani

238 ta avtotest o'tadi, shundan 3 tasi shu ish uchun yozildi.

Real serverda ham tekshirildi: Parkent uchun 2 donalik katalog gul soni bilan
qo'shildi, skladdan 60 dona yechildi, filial foydalanuvchisi ko'rdi va sotdi,
hisobotda ustama 420 000 bo'lib to'g'ri chiqdi.
