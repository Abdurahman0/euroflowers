# Florist gul hisobini to'g'rilash

Standart hajm bilan haqiqat har doim ustma-ust tushmaydi. M buket standartda 25 dona,
lekin florist 27 tadan ham, 23 tadan ham yasashi mumkin. Shu farqni tuzatish uchun
ikki tomonga ishlaydigan amal qo'shildi — **yo'nalishni nazoratchi o'zi tanlaydi**.

---

## Muammo

**Florist ko'proq ishlatgan.** Skladdan 100 dona chiqarildi, florist 25 dan 3 ta buket
yasadim dedi — tizim 75 donani yechdi. Aslida u 33 tadan ishlatgan. Natijada:
- floristda "25 dona qoldi" deb turadi, aslida qo'lida gul yo'q
- katalog tannarxi haqiqiydan past ko'rinadi, foyda bo'rttirib ko'rsatiladi

**Florist kamroq ishlatgan.** Standart 25 yozilgan, florist 23 tadan ishlatgan.
Tizim ortiqcha 6 donani hisobdan chiqarib yuborgan — u gul aslida florist qo'lida turibdi.

Ikkalasida ham yechim bitta: farqni katalog tarkibiga ko'chirish yoki teskarisiga qaytarish.

---

## Endpointlar

### 1. Oldindan ko'rish — hech narsa o'zgarmaydi

```
GET /api/florist-stock-balances/adjust-preview/
      ?florist=<id>
      &direction=to_catalog | to_florist     (sukut: to_catalog)
      &batch=<id>                            (to_florist da majburiy)
      &quantity_stems=<son>                  (to_florist da majburiy)
```

Tugmani bosishdan **oldin** shuni chaqiring va natijani ko'rsating. Bu chaqiruv
bazaga tegmaydi.

### 2. Bajarish

```
POST /api/florist-stock-balances/adjust/
{
  "florist": 4,
  "direction": "to_catalog",     // yoki "to_florist"
  "batch": 63,                   // to_catalog da ixtiyoriy, to_florist da majburiy
  "quantity_stems": 10           // faqat to_florist uchun
}
```

Ikkalasi ham `inventory` sahifasi ruxsatini talab qiladi (`adjust` uchun boshqarish huquqi).

---

## Yo'nalish 1 — `to_catalog` (florist ko'proq ishlatgan)

Floristda ortib qolgan gul, o'sha guldan yasalgan kataloglarga bo'linadi.
Floristdagi qoldiq nolga tushadi, katalog tannarxi ko'tariladi.

`batch` berilmasa floristning **hamma** qoldig'i bo'linadi.
`quantity_stems` kerak emas — qancha qolgan bo'lsa, o'shancha bo'linadi.

**Misol:** 100 dona olindi, 25 dan 3 ta buket → floristda 25 dona qoldi.

```
25 ni 3 ta buketga bo'lamiz → 8, 8, 9
tarkib:  25 25 25  →  33 33 34     (jami 100 — bitta gul ham yo'qolmadi)
floristda: 25 → 0
```

---

## Yo'nalish 2 — `to_florist` (florist kamroq ishlatgan)

Katalogdan ortiqcha yozilgan gul kamaytiriladi va floristning qo'liga qaytariladi.

Bu yerda `batch` va `quantity_stems` **majburiy** — qaysi guldan qanchasi ortganini
faqat nazoratchi biladi, tizim o'zi topa olmaydi.

**Misol:** tarkib 33/33/34, 10 donani qaytaramiz.

```
10 ni 3 ta buketdan olamiz → 4, 3, 3
tarkib:  33 33 34  →  30 30 30     (jami 90)
floristda: 0 → 10
```

Keyin o'sha 10 donani odatdagi tugma bilan skladga qaytarish yoki chiqitga yozish mumkin
(`POST /api/florist-stock-issues/return/`).

---

## Bo'lish qoidalari

**Bo'lish katalog emas, dona hisobida boradi.** Bitta katalogda 2 dona buket bo'lsa,
uning tarkibiga +1 qo'shilsa 2 dona gul ketadi. Tizim shuni hisobga oladi.

**Teng bo'linmasa kimdir bittaga ko'proq oladi.** 25 ni 3 ga bo'lsa 8, 8, 9 bo'ladi —
qoldiq hech qachon osilib qolmaydi. Ko'proq oluvchi eng birinchi yasalgan katalog bo'ladi.

**Sotilgan kataloglar ham qamraladi.** Gul ularga ham haqiqatda ketgan, shuning uchun
ularning tannarxi ham to'g'rilanadi va hisob-kitobdagi sof foyda haqiqiyga yaqinlashadi.

**Tarkib nolga tushmaydi.** `to_florist` da har bir katalogda kamida 1 dona gul qoladi.

---

## Javob shakli

### `adjust-preview`

```json
{
  "florist": 4,
  "florist_name": "Abror",
  "direction": "to_catalog",
  "total_florist_stems": 25,
  "blocked_count": 0,
  "batches": [
    {
      "batch_id": 63,
      "batch_number": "QA-LEFT-1",
      "flower": "Atirgul · Freedom · Qizil",
      "florist_stems_now": 25,
      "requested_stems": 25,
      "unplaced_stems": 0,
      "blocked": false,
      "reason": "",
      "items": [
        {
          "catalog_item": 77,
          "catalog_name": "Buket 1",
          "quantity_total": 1,
          "stems_per_item_now": 25,
          "change_per_item": 9,
          "change_total": 9,
          "stems_per_item_after": 34
        }
      ]
    }
  ]
}
```

`change_per_item` va `change_total` — `to_florist` da **manfiy** son bo'ladi.

### `adjust`

```json
{
  "florist": "Abror",
  "direction": "to_catalog",
  "moved_stems": 25,
  "unplaced_stems": 0,
  "batches": [
    {
      "batch_id": 63,
      "batch_number": "QA-LEFT-1",
      "flower": "Atirgul · Freedom · Qizil",
      "moved_stems": 25,
      "florist_stems_after": 0,
      "items": [
        { "catalog_item": 77, "catalog_name": "Buket 1", "quantity_total": 1,
          "stems_before": 25, "stems_after": 34, "change_total": 9 }
      ]
    }
  ]
}
```

---

## Xatolar

| Holat | Javob |
|---|---|
| Bu guldan florist yasagan katalog yo'q | 400 — «Bu guldan ... yasagan katalog topilmadi: ... Qoldiqni skladga qaytaring yoki chiqitga yozing.» |
| `to_florist` da `batch` yo'q | 400 — `{"batch": ["Katalogdan qaytarishda partiyani tanlash kerak"]}` |
| `to_florist` da `quantity_stems` yo'q | 400 — `{"quantity_stems": ["Qaytariladigan gul sonini kiriting"]}` |
| Katalogda shuncha gul yo'q | 400 — «... dona gulni katalogdan kamaytirib bo'lmadi. Katalogdagi gul soni yetmayapti» |
| Bo'linadigan qoldiq yo'q | 400 — «... qo'lida bo'linadigan qoldiq yo'q» |

Xato bo'lsa **hech narsa o'zgarmaydi** — amal butunlay orqaga qaytariladi.
Bir nechta partiya bo'lib, ulardan biri bloklangan bo'lsa ham hammasi to'xtaydi.
Bunday holda `batch` berib bittalab bajaring — `adjust-preview` qaysi biri
bloklanganini `blocked: true` bilan ko'rsatadi.

---

## UI uchun taklif

Florist sahifasida yoki «Floristdagi gullar» ro'yxatida qoldig'i bor florist yonida
tugma: **«Hisobni to'g'rilash»**.

Modal ochiladi:

```
Florist: Abror
Gul:     Atirgul · Freedom · Qizil  (QA-LEFT-1)
Hozir floristda: 25 dona

( • ) Florist ko'proq ishlatgan — qoldiqni buketlarga bo'lish
(   ) Florist kamroq ishlatgan — buketdan floristga qaytarish
      Qaytariladigan son: [____] dona

────────────────────────────────
Buket 1     25 → 34   (+9)
Buket 2     25 → 33   (+8)
Buket 3     25 → 33   (+8)
────────────────────────────────
Floristda qoladi: 0 dona

              [ Bekor ]  [ Tasdiqlash ]
```

Jadval `adjust-preview` dan to'g'ridan-to'g'ri chiziladi. Yo'nalish yoki son
o'zgarganda preview qayta chaqiriladi. Tasdiqlangandan keyin `adjust`.

Ogohlantirish qo'ying: **«Sotilgan buketlar tannarxi ham o'zgaradi»** — chunki
hisob-kitobdagi foyda raqami shundan keyin biroz siljiydi.

---

## Yo'l-yo'lakay tuzatilgan nosozlik

Ilgari gul floristga to'liq chiqarilgach sklad nolga tushar, keyin florist o'z buketini
katalogga qo'sha olmasdi — tekshiruv skladni qarar edi, floristning qo'lidagini emas.

Endi katalogda **florist tanlangan bo'lsa uning qoldig'i tekshiriladi**. Xato matni
ham o'zgardi:

```
Katalogni saqlash uchun floristdagi gul yetarli emas. Gul Abror qo'lida.
Gul: Atirgul Freedom Qizil
Partiya: API-1
Kerak: 25 dona
Bor: 10 dona
Yetmayapti: 15 dona
```

Florist tanlanmagan katalogda hammasi eskicha — sklad tekshiriladi.

---

## Tekshirilgani

195 ta avtotest o'tadi, shundan 12 tasi shu ish uchun yozildi: teng bo'linish,
teng bo'linmaganda bittaga ko'p berish, dona hisobi, sotilgan katalog tannarxi,
oldindan ko'rishning hech narsani o'zgartirmasligi, ikkala yo'nalish, majburiy
maydonlar va yetmagan holatda hech narsa o'zgarmasligi.

Real serverda ham uchidan-uchiga sinaldi: 100 dona chiqarildi → 25 dan 3 ta buket →
qoldiq 25 → bo'lindi (33/33/34, jami 100) → sotilgan buket tannarxi 300 000 dan
390 000 ga ko'tarildi → keyin 10 dona qaytarildi (30/30/30) va floristda 10 dona paydo bo'ldi.
