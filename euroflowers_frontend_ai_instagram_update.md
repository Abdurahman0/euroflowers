# EuroFlowers Frontend Update

## 1. Developer AI Global Switch

Backendda `AISettings.is_active` endi real ishlaydi.

Endpoint:

```http
GET /api/ai-settings/
PATCH /api/ai-settings/
```

Developer `is_active=false` qilsa:

- Instagram AI javob bermaydi
- Telegram AI javob bermaydi
- AI follow-up yuborilmaydi
- Mijoz chatlari saqlanaveradi
- Operator CRM’dan yoki Instagram’dan javob yozishi mumkin

Payload:

```json
{
  "is_active": false
}
```

Frontendda developer settings page’da toggle qo‘yish kerak:

- Label: `AI javoblari`
- ON: AI hamma mijozlarga javob beradi
- OFF: AI to‘liq o‘chadi, faqat operatorlar yozadi

## 2. Instagram Production Account

Backend production Instagram accountga o‘tkazildi.

Frontend tomonda o‘zgarish shart emas.

Production Instagram Business ID:

```txt
17841460916008920
```

Token backend DB’da saqlangan, frontendga hech qachon ko‘rsatilmaydi.

## 3. Instagram App’dan Yozilgan Operator Message

Agar operator Instagram app’ning o‘zidan mijozga yozsa, Meta webhook orqali backendga `is_echo=true` xabar keladi.

Endi backend bu xabarni tashlab yubormaydi, chat ichiga operator message qilib qo‘shadi.

Message frontendga quyidagicha keladi:

```json
{
  "sender": "operator",
  "text": "Operator yozgan xabar",
  "metadata": {}
}
```

Frontendda alohida logic shart emas, chat message list’da `sender=operator` bo‘lsa oddiy operator xabari kabi chiqarish kerak.

## 4. AI Auto Pause

Instagram app’dan operator mijozga yozsa:

- conversation `status=operator` bo‘ladi
- AI 15 minut pause bo‘ladi
- `ai_pause_reason=instagram_operator_message`

Frontend chat detail yoki chat list’da `is_ai_paused=true` bo‘lsa AI pause badge ko‘rsatishi mumkin.

## 5. WebSocket

Operator Instagram app’dan yozgan xabar ham backendda `Message` sifatida yaratiladi, shuning uchun mavjud websocket eventlar orqali frontendga keladi.

Frontend mavjud `message.created` yoki chat message websocket handler bilan ishlataversin.

Qo‘shimcha route kerak emas.

## 6. Muhim UX

Developer AI global OFF qilsa, frontendda chatlar ishlashda davom etadi, faqat AI javob yozmaydi.

Shuning uchun frontendda AI OFF holatini developer dashboard/settings’da aniq ko‘rsatish kerak:

```txt
AI o‘chirilgan. Mijoz xabarlari qabul qilinadi, lekin AI javob bermaydi.
```
