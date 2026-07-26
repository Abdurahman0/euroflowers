# INVENTORY_PLAN — WEB_SYSTEM_API.md integratsiyasi

Manba: `WEB_SYSTEM_API.md` + jonli sxema (`/api/schema/`) bilan solishtirildi.
Bu reja **chuqur qurishdan OLDIN** tasdiq uchun. Poydevor (types + api) allaqachon
qo'shildi va typecheck toza (`lib/types.ts`, `lib/api.ts`).

## A. Endpoint → ekran xaritasi

| Endpoint | Ekran / joy | Holat |
|---|---|---|
| `/suppliers/` (CRUD, `is_active`,`search`) | **Yangi sahifa** `/suppliers` (Sidebar: Truck) | rejalashtirildi |
| `/stock-batches/` (CRUD + `/movement/`) | **Sklad → yangi "Partiyalar" tab** (mavjud IA'ga mos — sklad allaqachon Gul/Material/Jurnal tabli) | rejalashtirildi |
| `/stock-movements/` (filtrlar) | **Sklad → "Kirim-chiqim jurnali" tab qayta ishlanadi** (timeline + summ.) | mavjudni yangilash |
| `/materials/`,`/packaging/` (+`/movement/`) | **Sklad → Material tab** (mavjud) — tur bo'yicha guruh + movement drawer | mavjudni yangilash |
| `/florists/` (CRUD, geofence) | **Yangi sahifa** `/floristlar` (Sidebar: Scissors) — Profillar tab | rejalashtirildi |
| `/florist-volume-rates/` | `/floristlar` → **"Hajm tariflari" tab** (matritsa) | rejalashtirildi |
| `/florist-salary/` (filtrlar) | `/floristlar` → **"Oyliklar" tab** (guruh + leaderboard) | rejalashtirildi |
| `/catalog/` (yangi maydonlar) | **Mavjud `/katalog`** — KatalogModal → kompozitsiya quruvchi drawer | mavjudni kengaytirish |
| `/dashboard/`,`/analytics/` (yangi bloklar) | Mavjud `/` va `/analitika` — yangi kartalar | mavjudni kengaytirish |
| WS `supplier_stock` | Mavjud bildirishnoma WS klienti + toast | mavjudni kengaytirish |

## B. Yangi routelar
- `app/suppliers/page.tsx`
- `app/floristlar/page.tsx` (3 tab: Profillar / Hajm tariflari / Oyliklar)
- `app/sklad/page.tsx` — **+1 tab "Partiyalar"** (jami 4 tab), Material va Jurnal tablar yangilanadi

## C. Yangi komponentlar (barchasi mavjud dizayn tilida)
- `components/SupplierModal.tsx` (drawer) + supplier detail drawer (2 tab)
- `components/StockBatchCard.tsx` — **stem gauge** + **freshness chip** + narx qatori
- `components/StockBatchModal.tsx` — Dona/Bog'lam segment toggle + margin hint + inline "yangi supplier"
- `components/BatchMovementModal.tsx` — waste/manual, Dona/Bog'lam, sabab chiplari, optimistik
- `components/MovementTimeline.tsx` — kunlar bo'yicha guruhlangan ledger + summ. strip
- `components/FloristModal.tsx` — geofence bo'limi (Yandex xarita + 2 doira + sliderlar)
- `components/VolumeRateMatrix.tsx` — volume × arrangement matritsasi, inline tahrir
- `components/SalaryLedger.tsx` — guruh + SourceBadge + leaderboard strip
- `components/CatalogComposer.tsx` — kompozitsiya quruvchi (keng drawer, jonli narx paneli)
- `components/StemGauge.tsx`, `components/DualQtyInput.tsx` — qayta ishlatiladigan primitivlar
- Dashboard/Analytics: `NetProfitCard`, `BatchInventoryBars`, `FloristProductionCards`
- `lib/inventory.ts` — markazlashgan yorliqlar (movement_type, packaging_type, staff_type,
  volume, salary source), pul/dona/bog'lam formatlash, freshness ranglari (tema tokenlari)

## D. Dizayn qonuni (barcha ekranlarga)
- Faqat tema tokenlari (0 ta qattiq rang), lucide ikonalar, o'ng Drawer, kichik markaziy
  tasdiq dialoglari, ellipsis + hover tooltip, SourceBadge/chip tili, 4-burchak yumaloq header.
- dark + pushti + barcha temalar, Rasm/Video fon, Premium/Yengil, 360→4K responsive.
- Pul "1 850 000 so'm", "120 dona", "6 bog'lam".

## E. Enumlar (jonli sxemadan tasdiqlangan)
- `movement_type`: in, out, adjustment, waste, transfer_out, transfer_in
- `packaging_type`: wrap(Buket qog'ozi), basket(Savat), box(Quti), other(Aksessuarlar)
- `staff_type`: florist(Florist), apprentice(Shogird)
- `volume`: small(Kichik), medium(O'rta), large(Katta)
- `catalog_kind`: standard(Standart), custom(Maxsus)
- salary `source`: catalog(Katalog), custom_catalog(Maxsus katalog), daily(Kunlik), manual(Qo'lda)
- volume-rate `arrangement_type`: bouquet(Buket), basket(Savat)

## F. Bo'sh joylar / SAVOLLAR (tasdiq kerak)
1. **Dashboard/Analytics yangi bloklari** (`net_profit`, `batch_inventory_stats`,
   `florist_production_stats`, `catalog_revenue/cost/discount`, `florist_salary_total`)
   jonli OpenAPI sxemasida HALI YO'Q — Django ularni typelanmagan qo'shimcha sifatida
   beradi. **Defensiv** o'qiyman (bo'lsa ko'rsataman, bo'lmasa blok yashirin). Kelgan
   aniq maydon nomlari sxemada bo'lmagani uchun taxminiy nomlanadi — real javob kelganda
   moslanadi. **OK?**
2. **Sana parametri:** spec `?date_from&date_to`, bizning mavjud sahifalar `?from&to`.
   Yangi bloklar uchun **ikkalasini ham** yuboraman (`from`+`date_from`). **OK?**
3. **Florist `user`:** florist profili mavjud `User`ga bog'lanadi (`user` majburiy).
   Formada foydalanuvchi tanlash — `/api/users/` dan (xodimlar). Yangi user yaratish
   florist formasida EMAS (xodimlar sahifasida). **OK?**
4. **Yandex xarita:** loyihada hozircha Yandex xarita integratsiyasi topilmadi. Yandex
   Maps JS API'ni (bepul, kalitsiz `api-maps.yandex.ru`) CSP'ga qo'shib, markaz-pin
   picker + 2 doira quraman. Kalit kerak bo'lsa ayting. **OK?**
5. **Filial (branch):** biz avval "single-branch mode"ga o'tgandik (branch UI olib
   tashlangan). Ammo florist/volume-rate `branch` MAJBURIY. Shu sahifalarda branch
   tanlovini **qayta kiritaman** (faqat shu yangi bo'limlarda), qolgan joylar single-branch
   qoladi. **OK?** (yoki default branch=1 yuboraymi?)
6. **Ruxsatlar:** yangi sahifalar uchun `inventory`(sklad), `catalog`, `settings`/`users`
   ruxsatlariga tayanaman (yangi permission page kaliti yo'q). Florist bo'limi → `users`
   yoki `settings`? Taxminan `settings`. **OK?**
7. **Demo rejim:** NEXT_PUBLIC_DEMO=1 QA uchun ishlatiladi. Yangi 8 endpoint uchun demo
   javoblarini ham qo'shaman (aks holda QA'da bo'sh). Bu katta, lekin skrinshot-verifikatsiya
   uchun zarur. **OK?**

## G. Qurilish tartibi (tasdiqdan keyin)
1. `lib/inventory.ts` yorliqlar + primitivlar (StemGauge, DualQtyInput) + demo seed
2. Suppliers sahifa + drawer + detail
3. Sklad "Partiyalar" tab + BatchCard + BatchModal + Movement
4. Movements timeline + Materials yangilanishi
5. Floristlar (3 tab) + geofence xarita
6. Katalog kompozitsiya quruvchi + jonli narx paneli
7. Lead drawer explainer + query invalidatsiya
8. Dashboard/Analytics yangi bloklar
9. WS supplier_stock
10. QA: har sahifa/drawer dark+light, desktop+mobil, to'liq oqim testi
