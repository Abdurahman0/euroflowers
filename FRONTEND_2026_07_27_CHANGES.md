# EuroFlowers Frontend Changes: 2026-07-27

Bu hujjat 2026-07-27 kuni backendga qo'shilgan o'zgarishlarni frontend uchun jamlaydi.

Base API:

```text
https://euroflowers.api.cognilabs.org/api
```

WebSocket:

```text
wss://euroflowers.api.cognilabs.org/ws/notifications/?token=<access_token>
```

## Commitlar

```text
892d66f Fix catalog inventory merge and analytics APIs
6fa3c47 Handle Instagram send failures gracefully
45682c0 Prevent stock tool from suggesting packaging
2d10b96 Handle failed conversation sends without gateway errors
82e8106 Separate custom catalog florist salary from fee
4471e90 Add catalog discount sale history
2b26aa2 Default branch for florist APIs
740aa11 Add self password change endpoint
cc2e0e4 Target florist notifications
d874088 Notify florists about catalog work
c31595d Notify admins on florist check-in
d52ad7d Add AI stock image tools
c4c5faf Allow admin audit logs
96e1859 Add audit user filter
```

## 1. Catalog inventory merge va analytics APIlar

Commit:

```text
892d66f Fix catalog inventory merge and analytics APIs
```

### Nima o'zgardi

Catalog create vaqtida bir xil stock batch yoki material bir necha marta yuborilsa, backend ularni bitta qatorga jamlaydi.

Frontend endi duplicate rowlarni o'zi majburan merge qilishi shart emas, lekin UX uchun merge qilib yuborsa ham bo'ladi.

### Frontend uchun

Catalog create formda bitta katalog ichida bir nechta gul/material qatorlari bo'lishi mumkin.

Agar user bir xil gul partiyasini ikki marta tanlasa:

```json
[
  { "stock_batch": 18, "quantity_stems": 5 },
  { "stock_batch": 18, "quantity_stems": 7 }
]
```

Backend buni bitta composition row qilib saqlashi kerak:

```json
[
  { "stock_batch": 18, "quantity_stems": 12 }
]
```

Materiallar uchun ham shu qoida ishlaydi.

### Analytics

Dashboard/analytics response ichida katalog, sklad, chiqit, florist production va discount statistikalarini ko'rsatish uchun qo'shimcha fieldlar qaytadi.

Frontend quyidagi bloklarga tayyor bo'lishi kerak:

```text
summary.net_profit
summary.catalog_revenue
summary.catalog_cost
summary.catalog_discount
summary.discounted_catalog_sales_count
summary.discounted_catalog_quantity
summary.discounted_catalog_amount
batch_inventory_stats
florist_production_stats
top_catalog_items
recent_top_catalog_items
top_selling_flowers
```

Sana filterlari:

```text
GET /api/dashboard/?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
GET /api/analytics/?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
```

Frontendda date range picker shu query paramlar bilan ulanishi kerak.

## 2. Instagram send errorlari

Commit:

```text
6fa3c47 Handle Instagram send failures gracefully
```

### Nima o'zgardi

Instagramga CRMdan message yuborishda Instagram API xato qaytarsa backend endi tizimni 500 qilib yiqitmaydi.

### Frontend uchun

CRM chatda message yuborilganda xato bo'lsa response ichidagi `detail` yoki error message ko'rsatiladi.

Frontend quyidagi holatni ko'rsatishi kerak:

```text
Message yuborilmadi. Qayta urinib ko'ring.
```

Yaxshi UX:

- Message bubble yonida failed state ko'rsatish.
- Retry button qo'yish.
- Operator yozgan matn inputdan yo'qolib ketmasligi kerak.

## 3. AI stock tool packaging taklif qilmasligi

Commit:

```text
45682c0 Prevent stock tool from suggesting packaging
```

### Nima o'zgardi

AI mijoz gul so'raganda sklad gul navlarini ko'radi, lekin qog'oz/savat/aksessuarlarni gul o'rnida taklif qilmaydi.

### Frontend uchun

Bu asosan AI javob sifati uchun. Frontendda alohida endpoint o'zgarishi yo'q.

Chat UI oddiy AI message sifatida ko'rsatadi.

## 4. Conversation send failure 500 bo'lmasligi

Commit:

```text
2d10b96 Handle failed conversation sends without gateway errors
```

### Nima o'zgardi

CRMdan chatga message yuborilganda gateway xato bo'lsa backend 500 bermaydi, boshqariladigan error qaytaradi.

### Frontend uchun

Chat send endpoint xatosini normal validation/API error sifatida tutish kerak.

Yuborilgan message real platformaga chiqmasa:

- UI failed state ko'rsatsin.
- Operatorga aniq error chiqsin.
- WebSocketdan message kelmasa ham frontend optimistik message statusini "failed"ga o'tkaza olsin.

## 5. Custom catalog florist salary va florist fee ajratildi

Commit:

```text
82e8106 Separate custom catalog florist salary from fee
```

### Nima o'zgardi

Custom katalogda florist haqqi va florist oyligiga qo'shiladigan summa ajratildi.

Muhim farq:

- `florist_fee` mijozdan olinadigan floristika xizmati yoki foydaga kiradigan summa.
- `florist_salary_amount` florist oyligiga yoziladigan summa.

Custom katalogda `florist_fee` avtomatik florist salaryga qo'shilmaydi.

### Frontend uchun

Catalog create formda custom katalog uchun alohida inputlar bo'lishi kerak:

```text
Floristika xizmati narxi
Floristga yoziladigan ish haqi
```

Backend fieldlar:

```json
{
  "florist_fee": "50000.00",
  "florist_salary_amount": "125000.00"
}
```

### UI tavsiya

Custom catalog create flowda `florist_salary_amount`ni alohida ko'rsating:

```text
Florist oyligiga qo'shiladi
```

`florist_fee`ni esa:

```text
Mijozdan olinadigan floristika xizmati
```

## 6. Catalog discount sale history

Commit:

```text
4471e90 Add catalog discount sale history
```

### Nima o'zgardi

Katalog sotilganda yoki custom katalog arzonroq sotilganda discount hisoblanadi va historyga yoziladi.

Qo'shilgan asosiy fieldlar:

```json
{
  "sale_price": "450000.00",
  "discount_amount": "50000.00",
  "discount_percent": "10.00",
  "discount_reason": "VIP mijoz",
  "sold_at": "2026-07-27T18:00:00+05:00",
  "sold_by": 1
}
```

### Standard catalog sotish

Endpoint:

```text
POST /api/catalog/{id}/sell/
```

Oddiy sotish:

```json
{
  "quantity": 1
}
```

Arzonroq sotish:

```json
{
  "quantity": 1,
  "sale_price": "450000.00",
  "discount_reason": "Doimiy mijoz"
}
```

Agar `sale_price` katalog `price`dan past bo'lsa, frontend `discount_reason` so'rashi kerak.

### Custom catalog create

Custom katalogda backend componentlardan calculated price hisoblaydi.

Agar frontend yuborgan `price` calculated component price'dan past bo'lsa, `discount_reason` majburiy.

```json
{
  "catalog_kind": "custom",
  "price": "800000.00",
  "discount_reason": "Mijozga kelishilgan chegirma"
}
```

### Frontend uchun history

Catalog detail sahifada history blok bo'lishi kerak:

```text
Kim sotdi
Qachon sotdi
Nechta sotdi
Asl narx
Sotilgan narx
Skidka summasi
Skidka foizi
Skidka sababi
```

Dashboard/analyticsda ko'rsatish:

```text
Skidkada sotilgan kataloglar soni
Skidka qilingan jami summa
Skidkada sotilgan jami dona
```

## 7. Default branch florist APIlar

Commit:

```text
2b26aa2 Default branch for florist APIs
```

### Nima o'zgardi

Filial bitta bo'lgani uchun florist bilan bog'liq APIlarda branch frontenddan majburiy yuborilmasligi mumkin.

Backend default branchni o'zi qo'yadi.

### Frontend uchun

Florist, attendance, salary, catalog create kabi joylarda `branch` fieldni UI'dan olib tashlash mumkin.

Agar eski formda `branch` bor bo'lsa, uni yashirish tavsiya qilinadi.

## 8. Self password change endpoint

Commit:

```text
740aa11 Add self password change endpoint
```

### Nima o'zgardi

User o'z passwordini o'zi almashtirishi uchun endpoint qo'shildi.

Endpoint:

```text
POST /api/auth/change-password/
```

Payload:

```json
{
  "old_password": "OldPassword123!",
  "new_password": "NewPassword123!"
}
```

### Frontend uchun

Profile yoki Settings pagega password change form qo'shish kerak.

Form:

```text
Eski password
Yangi password
Yangi passwordni qayta yozish
```

Frontend `new_password` va confirm passwordni client tomonda solishtiradi.

Muvaffaqiyatli response bo'lsa:

```text
Password muvaffaqiyatli o'zgartirildi.
```

Xato bo'lsa:

```text
Eski password noto'g'ri.
```

## 9. Target florist notifications

Commit:

```text
cc2e0e4 Target florist notifications
```

### Nima o'zgardi

Notification modeliga userga yo'naltirilgan notificationlar qo'shildi.

Asosiy field:

```json
{
  "target_user": 12,
  "target_user_detail": {
    "id": 12,
    "username": "abror"
  }
}
```

### Notification list

Endpoint:

```text
GET /api/notifications/?page=1&page_size=20
```

Florist/shogird o'ziga tegishli notificationlarni ko'radi.

Admin umumiy notificationlarni va o'ziga tegishlilarini ko'radi.

### WebSocket

Ulanish:

```text
wss://euroflowers.api.cognilabs.org/ws/notifications/?token=<access_token>
```

Notification event kelganda frontend:

- notification badge yangilaydi.
- toast ko'rsatadi.
- kerak bo'lsa listni refetch qiladi.

## 10. Floristga katalog ishi bo'yicha notification

Commit:

```text
d874088 Notify florists about catalog work
```

### Nima o'zgardi

Katalog yaratilib florist biriktirilsa, o'sha floristga notification boradi.

### Frontend uchun

Florist dashboardida notificationdan katalog detailga o'tish imkoniyati bo'lishi kerak.

Notification `reference_type` va `reference_id` orqali route qilish mumkin:

```text
reference_type = catalog
reference_id = <catalog_id>
```

UI:

```text
Sizga yangi katalog ishi biriktirildi
```

## 11. Adminlarga florist check-in notification

Commit:

```text
c31595d Notify admins on florist check-in
```

### Nima o'zgardi

Florist ishga kelganini belgilasa adminlarga notification boradi.

### Frontend uchun

Admin notification panelida check-in eventlar chiqadi.

Tavsiya qilingan UI:

```text
Abror ishga keldi
08:03
```

Reference mavjud bo'lsa attendance detailga o'tkazish mumkin.

## 12. AI stock image tools

Commit:

```text
d52ad7d Add AI stock image tools
```

### Nima o'zgardi

AI mijoz skladdagi gulni so'raganda gul rasmi bo'lsa platformaga yubora oladi.

AI endi faqat matn emas, kerakli holatda gul rasmi ham yuboradi.

### Frontend uchun

CRM chatda AI yuborgan image message yoki media message normal ko'rinishi kerak.

Chat message modelida mavjud media fieldlarni tekshirish kerak:

```text
media_url
image_url
metadata
```

Frontend chat bubble:

- text bo'lsa text ko'rsatadi.
- image/media URL bo'lsa image preview ko'rsatadi.
- text + image bo'lsa ikkalasini bir bubble yoki ketma-ket bubble sifatida ko'rsatadi.

## 13. Admin audit logs

Commit:

```text
c4c5faf Allow admin audit logs
```

### Nima o'zgardi

Admin uchun audit log sahifasi ochildi.

Developer qilgan ishlar adminlarga ko'rinmaydi.

Audit responsega `action_label` qo'shildi.

Misol:

```json
{
  "id": 168,
  "user": 7,
  "actor_name": "Abror",
  "action": "password_changed",
  "action_label": "Password o'zgartirildi",
  "entity_type": "User",
  "entity_id": "7",
  "summary": "",
  "before": {},
  "after": {},
  "created_at": "2026-07-27T20:00:00+05:00"
}
```

### Frontend uchun audit page

Audit page admin panelda ko'rinishi kerak.

Table columnlar:

```text
Sana
User
Action
Entity
Summary
Oldingi data
Yangi data
IP
User agent
```

`action_label` asosiy ko'rsatiladigan label bo'lishi kerak.

`action` texnik kod sifatida filter/debug uchun ishlatiladi.

Developer loglar kelmaydi, frontend alohida yashirish qilishi shart emas.

## 14. Audit user filter

Commit:

```text
96e1859 Add audit user filter
```

### Nima o'zgardi

Audit APIga user bo'yicha filter qo'shildi.

Endpoint:

```text
GET /api/audit/?user=<user_id>
GET /api/audit/?user_id=<user_id>
```

Qo'shimcha filterlar:

```text
action
entity_type
created_at_after
created_at_before
```

Misollar:

```text
GET /api/audit/?user=12
GET /api/audit/?user_id=12&created_at_after=2026-07-27T00:00:00+05:00
GET /api/audit/?action=stock_received
GET /api/audit/?entity_type=CatalogItem
```

### Frontend uchun

Audit page headerida filter panel bo'lishi kerak:

```text
User select
Action select yoki text search
Entity type select
Date from
Date to
Clear filters
```

User select uchun:

```text
GET /api/users/?page_size=100
```

Developer userlar selectda ko'rinsa ham, ularni tanlaganda audit result bo'sh qaytadi. Yaxshi UX uchun developer userlarni selectda yashirish mumkin.

## Permissionlar

Admin audit page ko'rishi uchun userda audit permission bo'lishi kerak:

```text
page = audit
can_view = true
```

Developer har doim hammasini ko'ra oladi.

Admin developer loglarni ko'ra olmaydi.

## Frontend checklist

- Audit page menu admin uchun ko'rinsin.
- Audit table `action_label`ni asosiy label sifatida ishlatsin.
- Audit filter panelga user select qo'shilsin.
- User filter `?user=<id>` bilan yuborilsin.
- Date range `created_at_after` va `created_at_before` bilan yuborilsin.
- Password change page/form qo'shilsin.
- Notification badge WebSocket eventlar bilan yangilansin.
- Florist dashboardda target notificationlar ko'rinsin.
- Admin notification panelda florist check-in eventlari ko'rinsin.
- Catalog sell modalda optional `sale_price` bo'lsin.
- `sale_price < price` bo'lsa `discount_reason` majburiy so'ralsin.
- Custom catalog create formda `florist_fee` va `florist_salary_amount` alohida input bo'lsin.
- Custom catalog discount reason fieldi kerakli holatda ko'rsatilsin.
- Dashboard/analyticsda discount, net profit, florist production va batch inventory bloklari ko'rsatilsin.
- Chat send xatosida 500 deb crash qilmasdan failed state va retry ko'rsatilsin.
- AI yuborgan image/media chatda preview bilan chiqsin.

## Eng muhim frontend route mapping

```text
Audit page              /api/audit/
Users select            /api/users/
Password change         /api/auth/change-password/
Notifications           /api/notifications/
Notifications WS        /ws/notifications/?token=<access_token>
Catalog list/detail     /api/catalog/
Catalog sell            /api/catalog/{id}/sell/
Dashboard               /api/dashboard/
Analytics               /api/analytics/
Chats/conversations     /api/conversations/
```

## Xatolarni ko'rsatish qoidasi

Backend ayrim holatlarda validation error qaytaradi.

Frontend umumiy qoida:

```text
detail string bo'lsa, o'shani ko'rsatish.
detail array bo'lsa, array elementlarini qatorma-qator ko'rsatish.
field error bo'lsa, tegishli input ostida ko'rsatish.
```

Misol:

```json
{
  "detail": ["Skladda yetarli qoldiq yo'q"]
}
```

UI:

```text
Skladda yetarli qoldiq yo'q
```

## Deploy holati

2026-07-27 kuni yuqoridagi commitlar serverga deploy qilingan.

Oxirgi deploy qilingan commit:

```text
96e1859 Add audit user filter
```
