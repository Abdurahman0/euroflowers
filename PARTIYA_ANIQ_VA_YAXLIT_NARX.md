# Partiya: yaxlitlangan va yaxlitlanmagan narx yonma-yon

Oldingi hujjatga qo'shimcha. Pochka narxidan dona narxi hisoblanganda endi
**aniq natija ham saqlanadi** — partiya detalida ikkalasini yonma-yon ko'rsatish uchun.

Hisob-kitob ilgarigidek **yaxlitlangan** narx bilan boradi. Aniq hisob faqat
ko'rsatish uchun, hech qayerda ishlatilmaydi.

---

## Yangi maydonlar — `stock-batches`

| Maydon | Ma'nosi |
|---|---|
| `cost_per_stem` | Dona tannarxi — **yaxlitlangan**, hamma hisob shu bilan |
| `cost_per_stem_exact` | Dona tannarxi — **aniq hisob**, 4 xona aniqlikda |
| `sale_price_per_stem` | Dona sotuv narxi — yaxlitlangan |
| `sale_price_per_stem_exact` | Dona sotuv narxi — aniq hisob |

Bundan tashqari tayyor `rounding` bloki qaytadi — farqni o'zingiz hisoblamaysiz:

```json
"rounding": {
  "cost": {
    "per_stem_exact":   998.00,
    "per_stem_rounded": 1000.00,
    "per_stem_diff":    2.00,
    "total_exact":      99800.00,
    "total_rounded":    100000.00,
    "total_diff":       200.00,
    "is_rounded":       true
  },
  "sale": {
    "per_stem_exact":   1060.00,
    "per_stem_rounded": 1100.00,
    "per_stem_diff":    40.00,
    "total_exact":      106000.00,
    "total_rounded":    110000.00,
    "total_diff":       4000.00,
    "is_rounded":       true
  }
}
```

`total_*` — kelgan butun son bo'yicha (`received_stems`).
`is_rounded: false` bo'lsa narx tekis bo'lingan, farq yo'q — u holda
aniq hisobni umuman ko'rsatmasa ham bo'ladi.

---

## Yangi maydonlar — `stock-deliveries`

| Maydon | Ma'nosi |
|---|---|
| `total_cost` | Partiya tannarxi — yaxlitlangan narx bo'yicha |
| `total_cost_exact` | Partiya tannarxi — aniq hisob bo'yicha |
| `rounding_diff` | Yaxlitlash partiya tannarxini qanchaga o'zgartirgani |

---

## Real misol (serverdan)

Pochka tannarx **24 950**, pochkada **25** dona, kelgani **100** dona:

```
dona tannarx aniq    :    998
dona tannarx yaxlit  :  1 000        farq  +2 / dona

partiya jami aniq    :  99 800
partiya jami yaxlit  : 100 000       farq  +200
```

---

## Ekran uchun taklif

Partiya detalida gul qatorida:

```
Atirgul · Freedom · Qizil          100 dona

  Pochka tannarxi     24 950 so'm
  Dona tannarxi        1 000 so'm     (aniq: 998 · +2)
  Dona sotuv narxi     1 100 so'm     (aniq: 1 060 · +40)
```

Qavs ichidagini kulrang mayda shrift bilan, faqat `is_rounded: true` bo'lganda
ko'rsatish yetarli.

Partiya sarlavhasida:

```
Jami tannarx: 100 000 so'm      (aniq hisob: 99 800 · yaxlitlashdan +200)
```

---

## Yo'l-yo'lakay tuzatilgan nosozlik

Ilgari narx umuman yuborilmasa baza xatosi (500) chiqardi. Endi tushunarli
400 qaytadi:

```json
{ "cost_per_bunch": ["Pochka tannarxini yoki dona tannarxini kiriting"] }
{ "sale_price_per_bunch": ["Pochka sotuv narxini yoki dona sotuv narxini kiriting"] }
```

Ya'ni narxni pochkada ham, donada ham berish mumkin — lekin biri bo'lishi shart.

---

## Eski partiyalar

Migratsiya paytida mavjud gullarga aniq hisob to'ldirildi: pochka narxi bor
bo'lsa undan bo'lindi, bo'lmasa dona narxining o'zi olindi. Ya'ni eski
qatorlarda `is_rounded` odatda `false` bo'ladi.

---

## Tekshirilgani

218 ta avtotest o'tadi, shundan 6 tasi shu ish uchun yozildi: aniq hisobning
saqlanishi, tekis bo'lingan holatda farq bo'lmasligi, dona narxi qo'lda
kiritilganda yaxlitlanmasligi, partiya detalidagi ikki jami va narxsiz
qo'shishda xato berilishi. Real serverda ham tekshirildi — yuqoridagi misol
o'sha yerdan.
