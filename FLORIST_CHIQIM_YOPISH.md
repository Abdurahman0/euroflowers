# Florist: katalogga faqat hajm, gul chiqim yopilganda taqsimlanadi

Florist endi katalogga **qancha gul ketganini yozmaydi** — faqat hajmni tanlaydi.
Nazoratchi «chiqarilgan gul tugadi» deganda, chiqarilgan gul o'sha kataloglarga
hajm standartiga qarab bo'lib yuboriladi.

---

## Oqim

```
1. Skladdan floristga 600 dona chiqariladi        (bor edi)
       POST /api/florist-stock-issues/issue/

2. Florist katalog qo'shadi — faqat hajm          (o'zgardi)
       POST /api/catalog/   { florist, arrangement_type, volume, ... }
       composition YUBORILMAYDI

3. Nazoratchi chiqimni yopadi                     (yangi)
       POST /api/florist-stock-balances/close-issue/
       ortiqchasi skladga qaytadi, qolgani kataloglarga bo'linadi
```

---

## 2-qadam: katalog formasi

Florist tanlangan katalogda **gul tanlash bloki butunlay olib tashlanadi**.
Uning o'rniga faqat:

- **Turi** — buket / savat / quti (`arrangement_type`)
- **Hajm** — S / M / L yoki nima belgilangan bo'lsa (`volume`)

Ikkalasi ham **majburiy**. Yuborilmasa 400 qaytadi:

```json
{ "volume": ["Florist katalogida hajmni tanlash kerak — gul shu bo'yicha taqsimlanadi"] }
{ "arrangement_type": ["Florist katalogida turini tanlash kerak"] }
```

> **Operator katalogi o'zgarmadi.** Florist tanlanmagan katalogda gul to'g'ridan-to'g'ri
> skladdan yechiladi, shuning uchun u yerda gul tanlash bloki ilgarigidek qoladi.

---

## 3-qadam: chiqimni yopish

### Oldindan ko'rish — hech narsa o'zgarmaydi

```
GET /api/florist-stock-balances/close-issue-preview/
      ?florist=<id>
      &batch=<id>
      &return_stems=<skladga qaytariladigan son>     (ixtiyoriy, sukut 0)
```

### Bajarish

```json
POST /api/florist-stock-balances/close-issue/
{
  "florist": 4,
  "batch": 72,
  "return_stems": 40
}
```

Bitta amalda ikki ish bajariladi:
1. `return_stems` skladga qaytariladi
2. **Qolgani** guli yozilmagan kataloglarga taqsimlanadi

Ruxsat: `inventory` sahifasi (yopish uchun boshqarish huquqi).

---

## Taqsimot qanday hisoblanadi

Har floristga belgilangan **hajm tarifidagi standart dona soni** og'irlik bo'lib xizmat qiladi.

**Misol.** 600 dona chiqarildi, 40 tasi skladga qaytdi, 560 taqsimlanadi.
Yasalgani: 3 ta S, 2 ta M, 1 ta L. Floristning tarifi: S=15, M=25, L=40.

```
Standart jami:  3×15 + 2×25 + 1×40  =  45 + 50 + 40  =  135

Ulush:   S = 15/135     M = 25/135     L = 40/135

Natija:  S × 3  →  62 donadan
         M × 2  →  104 donadan
         L × 1  →  166 dona
         ─────────────────────
         jami      560 dona
```

Butun songa bo'linmagan qismi eng katta kasrga ega kataloglardan boshlab
bittadan tarqatiladi — bitta gul ham osilib qolmaydi.

**Katalogda bir nechta dona bo'lsa** hisob dona bo'yicha boradi: 4 donalik
katalogga 200 gul tushsa, tarkibga har donaga 50 yoziladi.

---

## Har bir gul alohida yopiladi

`batch` majburiy — nazoratchi «qizil atirgul tugadi» deb bittalab yopadi.
Shuning uchun qizil buketga oq atirgul tushib qolmaydi.

Bir vaqtda bir nechta xil gul chiqarilgan bo'lsa, har biri uchun alohida
yopish kerak. Formada gul tanlash ro'yxatini floristda qoldig'i bor
partiyalardan chiqaring:

```
GET /api/florist-stock-balances/?florist=<id>
```

---

## Javob shakli

### `close-issue-preview`

```json
{
  "florist": 4,
  "florist_name": "Abror",
  "batch_id": 72,
  "batch_number": "QA-CLOSE",
  "flower": "Atirgul · Freedom · Qizil",
  "florist_stems_now": 600,
  "return_stems": 40,
  "share_stems": 560,
  "unplaced_stems": 0,
  "missing_rates": [],
  "items": [
    {
      "catalog_item": 91,
      "catalog_name": "S buket 1",
      "arrangement_type": "bouquet",
      "volume": "S",
      "quantity_total": 1,
      "standard_stems": 15,
      "stems_per_item": 62,
      "stems_total": 62
    }
  ]
}
```

`missing_rates` bo'sh bo'lmasa — o'sha hajmlarga tarif belgilanmagan, yopish
ishlamaydi. Tugmani o'chirib qo'ying va ro'yxatni ko'rsating.

### `close-issue`

```json
{
  "florist": "Abror",
  "batch_number": "QA-CLOSE",
  "returned_stems": 40,
  "shared_stems": 560,
  "unplaced_stems": 0,
  "items": [ { "...": "preview dagi kabi" } ]
}
```

---

## Xatolar

| Holat | Javob |
|---|---|
| Guli yozilmagan katalog yo'q | 400 — «... da guli yozilmagan katalog yo'q. Qolgan N dona gulni skladga qaytaring yoki chiqitga yozing.» |
| Hajm tarifi belgilanmagan | 400 — «... uchun hajm tarifi belgilanmagan: Buket · XL. Avval floristga shu hajm narxini kiriting.» |
| Qaytariladigan son qoldiqdan ko'p | 400 — «... qo'lida bu guldan atigi N dona bor» |
| Floristda bu guldan qoldiq yo'q | 400 — «... qo'lida bu guldan qoldiq yo'q» |

Xato bo'lsa **hech narsa o'zgarmaydi** — qaytarish ham, taqsimot ham orqaga qaytariladi.

---

## Hammasi skladga qaytsa

`return_stems` qoldiqqa teng bo'lsa hammasi skladga qaytadi, taqsimot bo'lmaydi
(`shared_stems: 0`) va xato ham chiqmaydi. Florist gul olib, hech narsa yasamagan
holat uchun shu.

---

## UI uchun taklif

«Floristdagi gullar» ro'yxatida qoldig'i bor har bir qator yonida tugma:
**«Chiqimni yopish»**.

```
Florist: Abror
Gul:     Atirgul · Freedom · Qizil   (partiya QA-CLOSE)
Floristda: 600 dona

Skladga qaytariladi:  [ 40 ] dona
Kataloglarga bo'linadi:  560 dona

──────────────────────────────────────────
Katalog          Hajm   Standart   Tushadi
S buket 1        S        15         62
S buket 2        S        15         62
S buket 3        S        15         62
M buket 1        M        25        104
M buket 2        M        25        104
L buket 1        L        40        166
──────────────────────────────────────────
                              Jami   560

              [ Bekor ]   [ Yopish ]
```

`return_stems` o'zgarganda preview qayta chaqiriladi — jadval darrov yangilanadi.

---

## Aloqador amal

Yopilgandan **keyin** ham xato sezilsa, avval qo'shilgan `adjust` amali ishlaydi:
`to_catalog` — floristda ortib qolganini kataloglarga qo'shadi,
`to_florist` — katalogdan kamaytirib floristga qaytaradi.
Ikkalasi bir-birini to'ldiradi: `close-issue` birinchi taqsimot, `adjust` keyingi tuzatish.

---

## Tekshirilgani

212 ta avtotest o'tadi, shundan 11 tasi shu ish uchun yozildi.

Real serverda ham 15 ta holat sinaldi: 600 dona chiqarildi → 6 ta katalog faqat hajm
bilan qo'shildi → hajmsiz katalog rad etildi → oldindan ko'rish chiqdi va hech narsani
o'zgartirmadi → 40 dona skladga qaytdi → 560 dona taqsimlandi (S 62, M 104, L 166,
jami 560) → floristda gul qolmadi → katalog tannarxi hisoblandi. Hammasi o'tdi.
