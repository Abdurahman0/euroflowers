# AI katalog albomi va operator aloqa sozlamalari

Backend tayyor va serverga chiqarilgan. Frontendda ikkita joy o'zgaradi — **sozlamalar sahifasi** va **suhbat oynasi**.

---

## 1. Sozlamalar — uchta yangi maydon

AI mijozni operatorga ulayotganda unga aloqa raqamini va administratorlar navbatchilik vaqtini aytadi. Bu qiymatlar promptga yozilmagan, bazadan olinadi — ya'ni sozlamalar sahifasidan istalgan payt o'zgartirsa bo'ladi va AI keyingi xabardanoq yangisini aytadi.

### Endpoint

```
GET   /api/settings/
PATCH /api/settings/
```

PATCH uchun `settings` sahifasiga `can_control` ruxsati kerak. GET hammaga ochiq.

### Yangi maydonlar

| Maydon | Turi | Default | Nima uchun |
|---|---|---|---|
| `operator_phone` | string, 64 | `+998 88 009 33 30` | Mijozga beriladigan aloqa raqami |
| `operator_hours` | string, 64 | `08:00 dan 00:00 gacha` | Administratorlar aloqada bo'ladigan vaqt, o'zbekcha |
| `operator_hours_ru` | string, 64 | `с 08:00 до 00:00` | Xuddi shu, ruscha |

`shop_phone` va `working_hours` **o'z joyida qoladi** va o'zgarmaydi. Bular ikki xil narsa:

- `working_hours` — do'kon ish vaqti, mijoz «nechida ochilasiz» deb so'raganda aytiladi
- `operator_hours` — administratorlar telefonda javob beradigan vaqt, operatorga ulaganda aytiladi

Ikkalasini bitta maydonga birlashtirmang, AI ularni ataylab ajratib ishlatadi.

### Ekranda

Sozlamalar sahifasida «Operator aloqasi» degan alohida blok qilinsa qulay bo'ladi:

```
┌─ Operator aloqasi ─────────────────────────────────┐
│  Aloqa raqami      [+998 88 009 33 30]             │
│  Navbatchilik      [08:00 dan 00:00 gacha]         │
│  Navbatchilik RU   [с 08:00 до 00:00]              │
│                                                    │
│  AI mijozni operatorga ulaganda shu raqamni va     │
│  vaqtni aytadi. Do'kon ish vaqtidan alohida.       │
└────────────────────────────────────────────────────┘
```

Vaqt maydonini erkin matn qoldiring — `08:00 dan 00:00 gacha`, `har kuni 08:00 - 00:00` kabi yozuvlar ham to'g'ri ishlaydi. AI uni javobga o'zgartirmasdan qo'yadi.

### Mijoz nima ko'radi

```
Aloqa raqamimiz +998 88 009 33 30, shu raqamga qo'ng'iroq qilsangiz bo'ladi.
Administratorlarimiz 08:00 dan 00:00 gacha aloqada bo'lishadi.
Xohlasangiz ism va telefon raqamingizni qoldiring, o'zlari siz bilan bog'lanishadi.
```

---

## 2. Suhbat oynasi — katalog albomi

Endi mijoz katalogni so'rasa AI matn ro'yxati yozmaydi. Buning o'rniga katalogdagi hamma mahsulot rasmini albom qilib yuboradi va qisqa yozadi — «Katalogimiz shu. Qaysi biri yoqdi, raqamini yozing».

Bu suhbatda **system xabar** sifatida qayd qilinadi. Turi — `catalog_album_result`.

### Xabar ko'rinishi

```
GET /api/conversations/{id}/
```

`messages` ichida:

```json
{
  "id": 4821,
  "sender": "system",
  "text": "",
  "metadata": {
    "catalog_album_result": {
      "ok": true,
      "sent_as": "album",
      "messages_sent": 4,
      "album_max_per_message": 10,
      "numbering_visible": true,
      "items": [
        {
          "position": 1,
          "catalog_id": 274,
          "name": "MIX BUKET KOMPAZITSIYA",
          "price": "800000.00",
          "type": "bouquet",
          "image_url": "https://.../mix-buket.jpg",
          "delivered": true,
          "detail": "album"
        }
      ],
      "not_sent": []
    }
  }
}
```

### Maydonlar

| Maydon | Ma'nosi |
|---|---|
| `ok` | Kamida bitta rasm mijozga yetdi |
| `sent_as` | `album` — albom bo'lib ketdi, `one_by_one` — bittalab, `mixed` — aralash |
| `messages_sent` | Mijoz nechta xabar oldi |
| `album_max_per_message` | Bitta xabarga sig'adigan rasm soni, hozir 10 |
| `numbering_visible` | Raqamlar rasm ostida ko'rinyaptimi |
| `items[].position` | **Mijoz ko'rgan tartib raqami** |
| `items[].catalog_id` | Katalog mahsuloti ID si |
| `items[].image_url` | **Mijozga yuborilgan rasm manzili** |
| `items[].delivered` | Shu rasm yetkazildimi |
| `not_sent` | Yuborilmagan mahsulotlar va sababi |

### Qanday ko'rsatish kerak

Hozir bu xabar `text` bo'sh bo'lgani uchun suhbatda bo'sh qator bo'lib turadi. O'rniga mijozga ketgan rasmlarni shu yerda ko'rsating — `items[].image_url` shu uchun qaytariladi.

Rasmlar `position` tartibida galereya qilib chiqarilsin, har rasm ostida raqami, nomi va narxi:

```
🖼  Katalog albomi yuborildi — 38 ta mahsulot, 4 ta xabar

┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│  rasm  │ │  rasm  │ │  rasm  │ │  rasm  │
│   1    │ │   2    │ │   3    │ │   4    │
└────────┘ └────────┘ └────────┘ └────────┘
 MIX BUKET  SAVAT      SAVAT MIX  SAVAT
 800 000    1 200 000  850 000    500 000
```

Bu operator uchun juda muhim, chunki mijoz keyin **«1chisi qancha»** deb yozadi. Operator suhbatga qo'shilganda mijoz aynan qaysi rasmni ko'rganini va qaysi raqam qaysi mahsulot ekanini shu yerdan ko'radi.

`image_url` mijozga ketgan aynan o'sha manzil. `delivered` false bo'lgan qatorni xira qilib yoki belgi bilan ajratib qo'ying — u rasm mijozga yetmagan.

`ok` false bo'lsa qizil qilib ko'rsating:

```
⚠  Katalog rasmlari yuborilmadi
```

`not_sent` bo'sh bo'lmasa nechta mahsulot yuborilmaganini yozing.

### Eski `image_tool_result` o'zgarmadi

Bitta gul yoki bitta katalog mahsuloti rasmi hali ham `image_tool_result` bilan keladi. U qanday ishlagan bo'lsa shundayligicha qoladi, yangi format faqat albom uchun.

---

## 3. Katalog ro'yxati — `catalog_id` qo'shildi

AI ishlatadigan katalog javobiga `catalog_id` qo'shildi. Bu **ichki** o'zgarish, frontend API'siga tegmaydi, lekin bilib qo'ying — endi AI mahsulotni nomi bo'yicha emas, ID bo'yicha aniq tanlaydi. Ya'ni bir xil nomli ikkita buket bo'lsa ham adashmaydi.

Mijozga ID hech qachon ko'rsatilmaydi.

---

## 4. Platforma cheklovi — bilib qo'yish uchun

Telegram ham, Instagram ham bitta xabarga **ko'pi bilan 10 ta rasm** qo'yadi. Bu ularning qattiq chegarasi.

Katalogda 38 ta mahsulot bo'lsa mijoz 4 ta xabar oladi — 10 + 10 + 10 + 8. Raqamlash esa uzluksiz, 1 dan 38 gacha davom etadi. `messages_sent` shuning uchun bittadan ko'p chiqishi mumkin, bu xato emas.

---

## Qisqacha

1. Sozlamalarga uchta maydon qo'shing — `operator_phone`, `operator_hours`, `operator_hours_ru`
2. `working_hours` bilan `operator_hours` ni aralashtirmang, ular alohida
3. Suhbatda `catalog_album_result` system xabarini bo'sh qoldirmang — `items[].image_url` dagi rasmlarni `position` tartibida galereya qilib chiqaring
4. Operator mijoz aytgan raqamni shu galereyadan topadi
