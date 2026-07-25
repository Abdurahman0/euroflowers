# Chat media & voice — ported pattern (clynica → euroflowers)

Manba: `Abdurahman0/clynica` →
`src/features/chat/components/ChatWorkspacePanel.tsx` (satr ~325–440 aniqlash,
~1180–1310 render, ~1417 lightbox) va `src/docs/instagram-media-crm-chat.md`.
Ko'chirilgani — **LOGIKA**, dizayn EuroFlowers tiliga qayta yozilgan.

## 1. Reference'dagi naqsh (o'zgarmagan qism)

**Aniqlash tartibi** (`getInstagramMediaPayload`):

1. `metadata.is_non_text_media === true` → media; URL = `metadata.media_url` yoki
   bo'sh bo'lsa xabar matni.
2. Aks holda: matnning o'zi to'liq `http(s)` URL bo'lsa — u ham media deb olinadi
   (aks holda `null` → oddiy text bubble).
3. Tur (`media_type`, lowercase): `audio | voice | voice_message` → **audio**,
   `video`, `image`, `ig_reel` — o'zi. Bo'lmasa URL kengaytmasidan chiqariladi:
   - audio: `aac m4a mp3 ogg opus wav weba`
   - video: `m4v mov mp4 webm`
   - image: `avif gif jpe?g png webp`
   - `instagram.com/(p|reel|tv)/<id>` → **ig_reel**
     (embed: `https://www.instagram.com/<p|reel|tv>/<id>/embed`)
   - hech biri to'g'ri kelmasa: `is_non_text_media` bo'lsa `video`, aks holda `file`.
4. `shouldHideInlineMediaUrl(text, url)` — matn aynan media URL bo'lsa, bubble'da
   xom link **ko'rsatilmaydi** (URL'lar `href` bo'yicha ham solishtiriladi).

**Render (reference qanday qilgan):**

| Tur | Reference xatti-harakati |
|---|---|
| audio | `<audio controls preload="metadata">` (oddiy, custom player YO'Q) |
| video | **INLINE** `<video controls preload="metadata">`, lightbox emas |
| image | thumbnail → bosilganda **lightbox** (`previewImageUrl` state, overlay bosish yopadi) |
| ig_reel | `iframe .../embed` + ostida "Open in Instagram" havolasi; embed bo'lmasa preview karta |
| file / boshqa | havola-chip: ikonka + "Open media file" + tashqi havola ikonkasi |

Muhim cheklov (docs'dan): Instagram **har doim** playable CDN link bermaydi —
voice odatda to'g'ridan-to'g'ri CDN link, reels esa faqat sahifa linki bo'ladi.

## 2b. REAL PAYLOAD (2026-07-24 namunasi) — asosiy shakl

Amaliy javob reference'dagi `metadata.media_url` EMAS, quyidagilarni beradi:

**a) Mijoz media/story yubordi — `metadata.attachments[]`:**
```json
{ "sender":"customer", "text":"Nechpul bu\nMedia link: https://lookaside.fbsbx.com/ig_messaging_cdn/?asset_id=…",
  "metadata": { "attachments": [ { "url":"https://lookaside…", "kind":"media", "type":"", "source":"instagram_message" } ] } }
```
Story uchun `"kind":"story", "type":"ig_story"`. URL — imzolangan IG lookaside CDN
havolasi, **kengaytmasiz** va **muddati o'tadigan**. `type` ko'pincha bo'sh.

**b) AI katalog rasmini yubordi — `metadata.image_tool_result` (sender:`system`, text:`""`):**
```json
{ "sender":"system", "text":"",
  "metadata": { "image_tool_result": { "image_url":"https://…/Pushti Atirgul buket.jpg", "catalog_id":24, "catalog_name":"Pushti atirgul buketi" } } }
```

**Shu sabab `parseMedia` manba tartibi:** `attachments[0].url` → `image_tool_result.image_url`
→ `media_url` alias'lari → matn ichidagi yalang'och havola. Kengaytmasiz IG CDN
link **rasm** deb olinadi (`kind:"media"/"story"` bo'lsa), xatoda "asl havolani
ochish" fallback ko'rsatiladi (imzo muddati o'tgani uchun tez-tez yuz beradi).
`image_tool_result` xabari `system` bo'lsa ham **chiqayotgan pufak** (o'ng tomon) qilib
ko'rsatiladi, "Katalog rasmi: <nom>" izohi bilan.

**Matn tozalash:** media bo'lsa `text` ichidan barcha havolalar va endi bo'sh qolgan
"Media link:" / "Story link:" yorliq satrlari olib tashlanadi; "Nechpul bu" kabi
haqiqiy matn qoladi (`mediaBodyText`).

**Overflow:** probelsiz uzun matn/URL pufakni yorib chiqmasligi uchun bubble'da
`overflow-wrap: anywhere` + `word-break: break-word` + `min-w-0` qo'yildi.

## 2. Bizning API (mapping va farqlar)

`GET /api/conversations/{id}/` → `messages[]`; schema (`/api/schema/`) → `Message`:
`id, created_at, updated_at, sender, text, instagram_message_id, metadata, conversation`.

| Reference | Bizda | Yechim |
|---|---|---|
| `content` | **`text`** | URL fallback `text`dan olinadi |
| `metadata.media_url/media_type/is_non_text_media` | `metadata` — schema'da **typelanmagan** (`{}`), ya'ni erkin JSON | Xuddi shu kalitlar o'qiladi + alias'lar: `url`, `attachment_url`, `file_url`; tur uchun `type`, `mime_type`, `mime` |
| `image_urls: string[]` | **YO'Q** | Bu tarmoq olib tashlandi; mavjud `metadata.image_url` (eski qo'llanish) qo'shimcha alias sifatida qoldi |
| `duration` (voice) | **YO'Q** | Klient tomonda `loadedmetadata` hodisasidan o'qiladi; `Infinity`/NaN bo'lsa `--:--` ko'rsatiladi |
| fayl o'lchami | **YO'Q** | HEAD so'rov IG CDN'da CORS'ga uriladi → o'lcham o'rniga kengaytma yorlig'i (`PDF`, `DOCX`…) ko'rsatiladi |
| `sender_type` | `sender` (`customer/ai/operator/system`) | Bubble tomonini mavjud `sideOf()` hal qiladi — tegilmagan |

## 3. Bizdagi render (EuroFlowers dizayni)

`components/chat/MessageMedia.tsx` — bitta joyda:

- **parseMedia()** — yuqoridagi 1–4 qadam (alias'lar bilan).
- **Rasm** — 280px gacha thumbnail, yuklanmaguncha *shimmer* skelet,
  `IntersectionObserver` bilan **lazy** (ko'rinmaguncha `src` qo'yilmaydi),
  bosilganda **lightbox**: xira + blur fon, frosted panel, Esc/overlay yopadi,
  yuklab olish tugmasi.
- **Video** — reference kabi **inline** ijro, lekin *plakat-karta* bilan:
  boshida faqat yumshoq play-kapsulasi (hech narsa yuklanmaydi), bosilgach
  `<video controls autoPlay preload="metadata">` mount qiladi.
- **Voice** — custom player (bare `<audio>` EMAS): play/pause doirasi (dusty-rose,
  bosilganda spring), **id'dan seed olingan psevdo-to'lqin** (34 ta ingichka
  ustun; o'tilgani aksent rangda), bosish/sudrash bilan **seek**, `0:07` uslubida
  davomiylik, `1x/1.5x/2x` tezlik chipi. **Bir vaqtda faqat bitta** ovoz —
  modul darajasidagi registr yangi ijro boshlanganda avvalgisini pauza qiladi.
- **Reel** — kompakt karta (Instagram gradient chipi); "Ko'rish" bosilganda
  embed `iframe` **lazy** mount bo'ladi + "Instagramda ochish" havolasi
  (embed ko'p holatda bloklanadi — docs'dagi ogohlantirish).
- **Fayl** — chip: ikonka + fayl nomi (URL'dan) + kengaytma yorlig'i + yuklab olish.
- **Xato/muddati o'tgan media** — yumshoq rose holat: "Media ochilmadi" +
  qayta urinish ikonkasi (cache-bust bilan qayta yuklaydi). Layout buzilmaydi.

Skroll: media bubble balandligi o'zgarganda (rasm/audio yuklandi) `onMediaLoad`
orqali sahifa pastga yopishib turishini saqlaydi — faqat foydalanuvchi pastda
bo'lsa (60px tolerans), aks holda o'qigan joyi saqlanadi.
