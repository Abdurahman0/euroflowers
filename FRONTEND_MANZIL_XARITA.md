# Yetkazib berish manzili — xarita sahifasi

Backend tayyor. Frontendda **bitta yangi sahifa** kerak: mijoz xaritada nuqtani
belgilaydi, biz koordinatani API ga yuboramiz.

Sahifaga mijoz Instagramdagi havoladan kiradi — **avtorizatsiya yo'q**, login
oynasi chiqmasligi kerak.

---

## 1. Havola

AI mijozga shu ko'rinishda havola beradi:

```
https://<front>/loc/147?t=9f2b71a4c3
                  ^^^      ^^^^^^^^^^
                  lead_id  maxfiy kod
```

- `lead_id` — yo'l qismida (`/loc/:leadId`)
- `t` — query parametr, **maxfiy kod**

Kodni **o'zgartirmasdan, kesmasdan** API ga qaytarasiz. U buyurtmani himoya qiladi:
kodsiz begona odam lead raqamini taxmin qilib manzil yuborishi mumkin bo'lardi.

URL shablonini men backendga qo'yaman — sizdan faqat yakuniy manzilni kutaman
(pastda 6-bo'lim).

## 2. Sahifa nima qilishi kerak

1. Xarita ko'rsatiladi (Yandex yoki Google — o'zingiz tanlaysiz)
2. Markazda ko'chiruvchi belgi (pin) turadi
3. Mijoz belgini kerakli joyga qo'yadi
4. **«Tanlash»** tugmasini bosadi
5. API ga POST ketadi
6. Muvaffaqiyatli bo'lsa: «Manzilingiz qabul qilindi, Instagramga qaytishingiz
   mumkin» degan ekran

Boshlang'ich markaz: Toshkent, do'kon manzili — `41.2995, 69.2401`
(Bobur ko'chasi 10). Mijozga «joylashuvimni aniqlash» tugmasi ham qo'yilsa
yaxshi bo'ladi (`navigator.geolocation`), lekin **majburiy emas** — ruxsat
bermasa ham sahifa ishlashi kerak.

## 3. API

```
POST https://euroflowers.api.cognilabs.org/api/delivery-location/
Content-Type: application/json
```

| Maydon | Tur | Majburiy | Izoh |
|---|---|---|---|
| `lead_id` | int | **ha** | URL yo'lidan |
| `token` | string | **ha** | URL dagi `?t=` qiymati, o'zgartirmasdan |
| `latitude` | number | **ha** | −90 … 90 |
| `longitude` | number | **ha** | −180 … 180 |
| `address` | string | yo'q | xarita topgan matn manzil yoki mijoz yozgani |

`address` ni yuborsangiz operatorlar guruhida koordinata bilan birga matn ham
ko'rinadi — kuryerga ancha qulay. Xarita reverse geocoding beradigan matnni
qo'yib yuborsangiz kifoya.

### Namuna

```js
await fetch(`${API}/api/delivery-location/`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    lead_id: Number(leadId),
    token,                       // URL dan o'qilgan ?t=
    latitude: pin.lat,
    longitude: pin.lng,
    address: resolvedAddress || "",
  }),
});
```

Avtorizatsiya sarlavhasi **kerak emas**. Agar sizda global interceptor
`Authorization` qo'shsa — shu so'rov uchun uni o'chirib qo'ying.

## 4. Javoblar

| Kod | Tanasi | Nima ko'rsatiladi |
|---|---|---|
| 200 | `{"status":"OK"}` | «Manzilingiz qabul qilindi» ekrani |
| 200 | `{"status":"SKIPPED"}` | «Havola eskirgan. Iltimos, Instagramda operatorimizga yozing» |
| 403 | `{"status":"REJECTED"}` | Xuddi shu xabar — havola buzuq yoki kod noto'g'ri |
| 400 | maydon xatolari | «Manzilni qaytadan belgilang» |

`SKIPPED` — bunday buyurtma topilmadi (masalan lead o'chirilgan). Foydalanuvchi
uchun `403` bilan bir xil ko'rinishda bo'lsin, texnik farqni ko'rsatish shart emas.

**Ikki marta yuborishga ruxsat bering.** Mijoz belgini ko'chirib yana bossa,
oxirgi koordinata saqlanadi — bu normal holat, bloklash kerak emas.

## 5. UI talablari

- Tugma bosilgach **spinner** va tugma bloklanadi (ikki marta yuborilmasin)
- Xarita to'liq ekran bo'lsa yaxshi — mijoz telefondan kiradi
- Til: o'zbekcha (lotin). Kirill yoki ruscha shart emas
- Sahifada narx, katalog, buyurtma tafsiloti **ko'rsatilmaydi** — faqat xarita.
  `lead_id` ni ham ekranga chiqarmang
- Havola bir necha kun ishlaydi, muddat yo'q

## 6. Mendan kutilayotgani

Sahifa tayyor bo'lgach menga **yakuniy URL shablonini** yuboring, masalan:

```
https://euroflowers.cognilabs.org/loc/{lead_id}?t={token}
```

`{lead_id}` va `{token}` — aynan shu ko'rinishda qoldiring, backend ularning
o'rniga haqiqiy qiymatlarni qo'yadi. Shundan keyin AI havolani mijozlarga
bera boshlaydi.

Shu shablon kelmaguncha AI havola bermaydi va manzilni matn bilan so'raydi —
ya'ni tizim buzilmaydi, shunchaki xarita ishlamaydi.

## 7. Tekshirish ro'yxati

- [ ] `/loc/:leadId?t=...` sahifasi loginsiz ochiladi
- [ ] URL dan `lead_id` va `t` to'g'ri o'qiladi
- [ ] xarita ochiladi, belgi ko'chadi, markaz Toshkent
- [ ] «Tanlash» POST yuboradi, `Authorization` sarlavhasi yo'q
- [ ] `token` o'zgartirilmagan holda ketadi
- [ ] 200 / 403 / 400 uchun uchta alohida ekran bor
- [ ] tugma yuborilayotganda bloklanadi
- [ ] ekranda narx, katalog yoki lead raqami ko'rinmaydi
