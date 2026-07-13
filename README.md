# EuroFlowers AI CRM — Next.js frontend

Premium gul do'koni ekotizimi (AI Instagram assistent + CRM + Sklad + Katalog) — to'liq frontend, mock data bilan. Backend yo'q — barcha ma'lumot `lib/data.ts` dan, holat `zustand` store'da.

## Stack
- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** — CSS-variable asosli tema (5 rang mavzusi × light/dark)
- **Zustand** — global holat (leadlar, sklad, katalog, UI)
- Liquid glass dizayn, drag&drop kanban, jonli AI demo

## Ishga tushirish
```bash
npm install
npm run dev        # http://localhost:3000
```

## Tuzilma
```
app/               # sahifalar (App Router)
  page.tsx         # Dashboard
  chat/ crm/ sklad/ katalog/ postlar/ sozlamalar/
components/        # Sidebar, Header, Kanban, modallar, chat panel…
lib/
  types.ts         # domen tiplari
  data.ts          # mock ma'lumotlar (iyul mavsumi)
  store.ts         # zustand store (data + UI)
  format.ts        # narx formatlash
public/flowers/    # fon gullari (PNG) — o'zingiznikini qo'ying
```

## Keyingi qadam (backend ulash)
Store actionlari (`setLeadStatus`, `addFlower`, `addCatalogItem`, `markSold`) — API chaqiriqlar bilan almashtirish uchun yagona joy. `lib/data.ts` ni React Query/SWR fetcher'lariga almashtiring.
