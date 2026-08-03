# Tekin gul — tannarxsiz partiya

Postavshik ba'zan gulni tekinga qo'shib beradi. Bunday gul **sotib olinmagan**,
shuning uchun tannarxi yozilmaydi. Lekin u keyin sotiladi — sotuv narxi
odatdagidek yoziladi.

---

## Yangi maydon

`StockBatch.is_free` — mantiqiy maydon, sukut bo'yicha `false`.

```json
POST /api/stock-batches/
{
  "delivery": 19,
  "variant": 31,
  "height_cm": 60,
  "stems_per_bunch": 25,
  "received_stems": 100,
  "is_free": true,
  "sale_price_per_bunch": "50000"
}
```

`cost_per_bunch` va `cost_per_stem` **yuborilmaydi**.

---

## Qoidalar

**Tannarx majburiy emas.** Oddiy gulda tannarxsiz saqlab bo'lmaydi:

```json
{ "cost_per_bunch": ["Pochka tannarxini yoki dona tannarxini kiriting"] }
```

Tekin gulda bu tekshiruv ishlamaydi.

**Tannarx yozilsa ham e'tiborga olinmaydi.** `is_free: true` bilan birga
`cost_per_bunch: 99000` yuborilsa ham natija **0** bo'ladi. Ya'ni tasodifan
eski qiymat qolib ketmaydi.

```
cost_per_bunch      → 0.00
cost_per_stem       → 0.00
cost_per_stem_exact → 0.0000
```

**Sotuv narxi majburiy bo'lib qoladi.** Yuborilmasa:

```json
{ "sale_price_per_bunch": ["Pochka sotuv narxini yoki dona sotuv narxini kiriting"] }
```

Pochka sotuv narxidan dona sotuv narxi ilgarigidek hisoblanadi va 100 ga yaxlitlanadi.

---

## Nimaga ta'sir qiladi

| Joy | Natija |
|---|---|
| **Postavshik qarzi** | Qo'shilmaydi. `purchase_total` = 0 — tekin gul uchun pul to'lanmaydi |
| **Partiya jami tannarxi** | Tekin qatorlar 0 bo'lib qo'shiladi |
| **Katalog tannarxi** | Bu guldan ketgan qism 0. Ya'ni sof foyda haqiqiy chiqadi |
| **Hisob-kitob** | `flower_cost_total` shu qadar kam, `net_profit` shu qadar ko'p |
| **Sklad qoldig'i** | Odatdagidek — dona sanaladi, chiqim va katalogga ketishi bir xil |

---

## Filtr

```
GET /api/stock-batches/?is_free=true      faqat tekin gullar
GET /api/stock-batches/?is_free=false     faqat sotib olinganlar
```

Bonus qo'shimcha: `?delivery=<id>` ham qo'shildi — partiya bo'yicha filtrlash.

---

## Forma uchun taklif

Gul qo'shish formasiga yuqoriga bitta belgi:

```
[ ] Postavshik tekinga qo'shib bergan
```

Belgilanganda **tannarx maydonlari yashiriladi** (pochka tannarxi, dona tannarxi).
Sotuv narxi maydonlari joyida qoladi.

Ro'yxatda tekin qatorlarni ajratib ko'rsatish qulay bo'ladi — masalan nom yoniga
kichik yorliq: `TEKIN`. Shunda skladchi tannarxi 0 ekanini xato deb o'ylamaydi.

---

## Real misol (serverdan)

```
Tekin gul · 100 dona · 25 dona/pochka
  dona tannarx    0        pochka tannarx    0
  dona sotuv  2 000        pochka sotuv 50 000

Postavshik xaridi        0 so'm     ← qarz qo'shilmadi
Partiya jami tannarxi    0 so'm

Undan yasalgan buket (20 dona gul):
  tannarx      50 000     ← faqat material va florist haqi
  sof foyda   250 000     (sotuv 300 000)
```

---

## Tekshirilgani

267 ta avtotest o'tadi, shundan 6 tasi shu ish uchun yozildi: tannarxsiz saqlash,
yozilgan tannarxning e'tiborga olinmasligi, sotuv narxining majburiyligi,
postavshik qarziga qo'shilmasligi, katalog tannarxida 0 bo'lishi va filtr.

Real serverda ham yuqoridagi misol bo'yicha tekshirildi.
