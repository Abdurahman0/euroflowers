# Katalog sahifasi — sotuv tarixi

Qaysi katalogdan qachon nechta sotilgani ko'rinadigan ro'yxat. **Bitta dona
sotilgan bo'lsa ham** tarixda chiqadi.

---

## Endpointlar

```
GET /api/catalog/sales/          hamma sotuvlar (sahifalangan)
GET /api/catalog/{id}/sales/     bitta katalogning sotuvlari
```

Ruxsat: `catalog` sahifasi. Filial foydalanuvchisi **faqat o'z filialining**
sotuvlarini ko'radi.

### Filtrlar (faqat umumiy ro'yxatda)

| Parametr | Misol |
|---|---|
| `date_from`, `date_to` | `?date_from=2026-08-01&date_to=2026-08-03` |
| `payment_type` | `?payment_type=cash` — `cash`, `card`, `debt`, `unknown` |
| `search` | `?search=buket` — katalog nomi bo'yicha |
| `page`, `page_size` | `?page=2&page_size=50` (eng ko'pi 100) |

Ro'yxat **eng yangi sotuvdan** boshlanadi.

---

## Javob

```json
{
  "count": 20,
  "next": null,
  "previous": null,
  "results": [ { "...": "qatorlar" } ],
  "totals": {
    "sales_count": 20,
    "quantity": 21,
    "revenue": "7430000.00",
    "discount_total": "0.00",
    "cash_total": "3480000.00",
    "card_total": "3950000.00",
    "debt_total": "0.00"
  },
  "period": { "date_from": null, "date_to": null }
}
```

`totals` **butun filtr bo'yicha** hisoblanadi, faqat ochiq sahifa bo'yicha emas.

### Bitta qator

```json
{
  "id": 238,
  "catalog_item": 176,
  "catalog_name": "savat",
  "image_url": "https://.../savat.jpg",
  "arrangement_type": "basket",
  "volume": "small",
  "volume_label": "Kichik",
  "catalog_kind": "standard",
  "branch_name": "Toshkent (asosiy filial)",
  "florist_name": "Abror",

  "quantity": 1,
  "listed_unit_price": "150000.00",
  "sold_unit_price": "150000.00",
  "listed_total": "150000.00",
  "sale_total": "150000.00",

  "discount_amount": "0.00",
  "discount_percent": "0.00",
  "discount_reason": "",

  "payment_type": "card",
  "payment_label": "Karta",
  "sale_image_url": "https://.../sotuv.jpg",
  "sold_by": "Operator Ali",
  "created_at": "2026-08-03T22:10:39.551+05:00"
}
```

| Maydon | Izoh |
|---|---|
| `catalog_item` | Katalog id — qatorga bosilganda katalogga o'tish uchun |
| `image_url` | Katalog rasmi |
| `volume_label` | Hajm o'zbekcha: Kichik / O'rta / Katta |
| `listed_total` vs `sale_total` | Asl narx va haqiqiy sotuv — farqi chegirma |
| `payment_label` | Naqd / Karta / Qarz / Aniqlanmagan |
| `sale_image_url` | Sotuvda yuklangan rasm, bo'lmasa bo'sh |
| `sold_by` | Kim sotgani |
| `created_at` | **Mahalliy vaqt** (`+05:00`), o'girish shart emas |

---

## Ekran uchun taklif

Katalog sahifasiga ikkinchi tab: **«Sotuvlar»**.

```
SOTUVLAR                          20 ta · 21 dona · 7 430 000 so'm
                                  naqd 3 480 000 · karta 3 950 000

[ Sana oralig'i ]  [ To'lov: hammasi ▾ ]  [ Qidirish... ]

VAQT              KATALOG           DONA        SUMMA   TO'LOV   HAJM
─────────────────────────────────────────────────────────────────────
03.08 22:10  [🖼] savat                1      150 000   Karta    Kichik
03.08 22:09  [🖼] savat                1      200 000   Karta    Kichik
02.08 14:00  [🖼] qIZIL ATIRGUL        1    1 200 000   Karta    Katta
01.08 21:37  [🖼] buket 199 minli      1      200 000   Karta    Kichik
01.08 21:36  [🖼] MIX BUKET            1      200 000   Naqd     Kichik
```

Chegirmali sotuvda summani chizib ko'rsatish qulay:
~~250 000~~ **200 000** · *«Doimiy mijoz»*

Katalog kartochkasining ichida ham shu ro'yxatning qisqasini ko'rsatish mumkin —
`/api/catalog/{id}/sales/` bitta katalogniki, sahifalanmaydi.

---

## Real misol (serverdan)

```
JAMI: 20 ta sotuv · 21 dona · 7 430 000 so'm
      naqd 3 480 000 · karta 3 950 000 · qarz 0

03.08 22:10  savat            1     150 000  Karta  Kichik
03.08 22:09  savat            1     200 000  Karta  Kichik
02.08 14:00  qIZIL ATIRGUL    1   1 200 000  Karta  Katta
01.08 21:37  buket 199 minli  1     200 000  Karta  Kichik
01.08 21:36  MIX BUKET        1     250 000  Karta  Kichik
01.08 21:36  MIX BUKET        1     200 000  Naqd   Kichik
```

---

## Hisob-kitobdan farqi

`/api/accounting/` da ham sotuv tarixi bor, lekin u boshqa savolga javob
beradi: tannarx, sof foyda, filial ajratmasi, chiqit. Katalog sahifasidagi
bu ro'yxat **soddaroq** — tannarx va foyda ko'rsatilmaydi, faqat nima
sotilgani va qanchaga.

Shu sababli filial foydalanuvchisiga ham xavfsiz: tannarx sizib chiqmaydi.

---

## Tekshirilgani

326 ta avtotest o'tadi, shundan 5 tasi shu ish uchun yozildi: har bir
sotuvning chiqishi, qator maydonlari, bitta katalog tarixi, filtrlar va
filial foydalanuvchisining faqat o'z sotuvini ko'rishi.

Real serverda ham tekshirildi — yuqoridagi misol o'sha yerdan.
