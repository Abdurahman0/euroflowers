# EuroFlowers AI Media Handoff

Sana: 2026-08-20

Backendga AI media handoff qo‘shildi. Maqsad: mijoz Instagram/Telegramda rasm, story, post yoki reel yuborsa va AI uni aniq tushunmasa, AI mijozdan telefon so‘raydi. Telefon kelsa yoki mijoz telefon berishni rad etsa, AI `handoff_media_to_operator` function call qiladi va operator Telegram guruhiga media/linklar, AI xulosa va CRM chat button yuboriladi.

## Frontend uchun kerakli o‘zgarish

Operator Telegramdagi inline button quyidagi linkni ochadi:

```text
https://euroflowers.cognilabs.org/chat?conversation_id=<conversation_id>
```

Frontend `/chat` sahifasida `conversation_id` query paramni o‘qishi kerak.

Flow:

1. Agar `conversation_id` queryda bo‘lsa, chats list yuklangandan keyin shu chatni avtomatik oching.
2. Agar querydagi chat listda hali yo‘q bo‘lsa, `GET /api/conversations/{conversation_id}/` yoki mavjud detail API orqali chatni olib oching.
3. Agar detail API yo‘q bo‘lsa, listdan topilmaganda listni bir marta refetch qiling.
4. Chat ochilgandan keyin URLni tozalash ixtiyoriy: `/chat` holatiga qaytarish mumkin, lekin majburiy emas.

## Tavsiya qilingan frontend logic

```ts
const params = new URLSearchParams(window.location.search)
const conversationId = params.get("conversation_id")

if (conversationId) {
  openConversationById(conversationId)
}
```

`openConversationById`:

- avval loaded sessions ichidan qidiradi
- topilsa active chat qiladi
- topilmasa backenddan detail/list refetch qiladi
- topilgandan keyin messages websocket yoki messages API bilan xabarlarni yuklaydi

## Operator notification ko‘rinishi

Backend Telegram guruhga shunaqa ma’lumot yuboradi:

- mijoz ismi yoki platform id
- telefon raqami yoki `raqam berilmagan`
- conversation id
- platforma
- AI xulosa
- media havolalar
- inline button: `CRM chatni ochish`

Frontendda alohida API o‘zgarishi shart emas. Faqat `/chat?conversation_id=...` deep-link ishlashi kerak.

## Muhim

AI media/linklarni serverga saqlamaydi. Instagramdan link kelsa link operatorga yuboriladi. Direct photo/video URL bo‘lsa Telegram media group sifatida yuborishga urinadi, bo‘lmasa link xabar ichida qoladi.

