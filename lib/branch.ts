import type { AccountingByBranch, AccountingFigures, PermissionPage, ScreenId } from "./types";

export type NavItem = { id: ScreenId; href: string; label: string; pages: PermissionPage[]; top?: boolean };

/** NAV — YAGONA manba (Sidebar + route guard + testlar shundan). */
export const NAV: NavItem[] = [
  { id: "dashboard", href: "/", label: "Dashboard", pages: ["dashboard"], top: true },
  { id: "sklad", href: "/sklad", label: "Sklad", pages: ["inventory"], top: true },
  { id: "katalog", href: "/katalog", label: "Katalog", pages: ["catalog"], top: true },
  { id: "floristlar", href: "/floristlar", label: "Floristlar", pages: ["florists", "attendance", "settings"], top: true },
  { id: "floristStock", href: "/floristlarga-chiqarilgan", label: "Floristlarga chiqarilgan", pages: ["inventory"], top: true },
  { id: "gullar", href: "/gullar", label: "Gullar", pages: ["inventory"], top: true },
  { id: "chat", href: "/chat", label: "AI chatlar", pages: ["conversations"], top: true },
  // qolganlari — joriy nisbiy tartibda
  { id: "analitika", href: "/analitika", label: "Analitika", pages: ["dashboard"] },
  { id: "hisob", href: "/hisob-kitob", label: "Hisob-kitob", pages: ["dashboard"] },
  { id: "branchReport", href: "/filial-hisoboti", label: "Filial hisoboti", pages: ["dashboard"] },
  { id: "ai", href: "/ai", label: "AI yordamchi", pages: ["ai_settings"] },
  { id: "crm", href: "/buyurtmalar", label: "Buyurtmalar", pages: ["crm"] },
  { id: "bronlar", href: "/bronlar", label: "Bronlar", pages: ["crm"] },
  { id: "mijozlar", href: "/mijozlar", label: "Mijozlar", pages: ["customers"] },
  // ⚠️ Qarzdorlar — ruxsat `crm` (inventory EMAS). Mijozlar yonida: ikkalasi ham «kim» haqida.
  { id: "qarzdorlar", href: "/qarzdorlar", label: "Qarzdorlar", pages: ["crm"] },
  { id: "suppliers", href: "/suppliers", label: "Yetkazib beruvchilar", pages: ["suppliers", "inventory"] },
  { id: "postlar", href: "/postlar", label: "Postlar", pages: ["social_posts"] },
  { id: "bildirishnomalar", href: "/bildirishnomalar", label: "Bildirishnomalar", pages: ["notifications"] },
  { id: "xodimlar", href: "/xodimlar", label: "Xodimlar", pages: ["users"] },
  { id: "integratsiyalar", href: "/integratsiyalar", label: "Integratsiyalar", pages: ["integrations"] },
  { id: "audit", href: "/audit", label: "Audit jurnali", pages: ["audit"] },
  { id: "sozlamalar", href: "/sozlamalar", label: "Sozlamalar", pages: ["settings"] },
];

/**
 * ⚠️ 2026-08-03: FILIAL ALLOWLIST OLIB TASHLANDI.
 * Ilgari filial foydalanuvchisi qattiq ["dashboard","hisob","katalog"] ro'yxati bilan
 * cheklanardi va bu ruxsat bilan KESISHTIRILARDI — natijada unga BERILGAN ruxsat ham
 * ko'rinmay qolardi (masalan Mijozlar, CRM, Bildirishnomalar). YANGI QOIDA: RUXSAT HUKM QILADI —
 * filial foydalanuvchisi ham xuddi boshqalar kabi ruxsati bergan sahifalarni ko'radi.
 *
 * ⚠️ Buning O'RNIGA halol ogohlantirish: quyidagi ekranlarning MA'LUMOTI serverda
 * filialga BO'LINMAGAN (FRONTEND_BRANCH_PARKENT.md §3 + jonli OpenAPI tekshiruvi:
 * Lead / Customer / Reservation / Notification serializerlarida `branch` maydoni UMUMAN YO'Q).
 * Ya'ni Parkent operatori bu ro'yxatlarda BARCHA filial ma'lumotini ko'radi — shuni aytamiz,
 * yashirmaymiz. Serverda bo'lingani (dashboard · hisob-kitob · katalog) bu ro'yxatda YO'Q.
 */
export const GLOBAL_DATA_SCREENS: ScreenId[] = [
  "crm", "bronlar", "mijozlar", "bildirishnomalar",
  "sklad", "floristStock", "gullar", "floristlar", "suppliers", "postlar", "chat", "xodimlar", "audit",
];

/** Filial foydalanuvchisiga shu ekranda «umumiy ma'lumot» ogohlantirishi kerakmi. */
export const showsSharedData = (id: ScreenId, branchUser: boolean): boolean =>
  branchUser && GLOBAL_DATA_SCREENS.includes(id);

/** Filial foydalanuvchisimi. Jonli kontrakt (tekshirilgan): asosiy filial
    `profile.branch = null` (integer, nullable, MAJBURIY EMAS); filial `= <id>`.
    ⚠️ XAVFSIZ YO'NALISH: `null` VA `undefined` (kalit yo'q) → asosiy (cheklanmagan) —
    bu real asosiy foydalanuvchilar uchun to'g'ri. HAR QANDAY non-null qiymat (son, "2"
    satr, hatto 0) → cheklangan filial. Ya'ni noaniqlikda OSHIQCHA cheklaymiz, kam emas.
    Kalit umuman yo'q bo'lsa (schema uni majburiy demaydi) — loadMe'da ogohlantiriladi. */
export const isBranchUser = (branch: number | null | undefined): boolean => branch !== null && branch !== undefined;


/** Katalog javobida TANNARX/FOYDA/FLORIST maydonlari filial foydalanuvchisiga backend'da
    OLIB TASHLANADI (null). Ustun/blok CHIZILMASLIGI kerak — «0 so'm» EMAS, YO'Q ([[filial-narx-yashirish]]).
    ⚠️ Ko'rinishni MA'LUMOTdan aniqlaymiz (`profit` bloki bor-yo'qligi), ROLdan emas:
      · asosiy foydalanuvchida `profit` DOIM keladi → ko'rsatamiz;
      · filial foydalanuvchida `profit` HECH QACHON kelmaydi → yashiramiz.
    Bu backend qoidasi kelajakda o'zgarsa ham UI to'g'ri qoladi (rolga qotib qolmaydi). Bu yerdagi
    sirtlarning hammasi allaqachon YUKLANGAN item'dan render qilinadi (loader ortida), shuning uchun
    flicker yo'q — qo'shimcha isBranchUser gate'i shart emas. */
export const catalogHasCostData = (item: { profit?: unknown } | null | undefined): boolean =>
  item != null && item.profit != null;

/** PURE: ko'ra oladigan sahifalar → ko'rinadigan ekranlar. YAGONA mezon — RUXSAT
    (filial qatlami olib tashlandi; `branchUser` argumenti moslik uchun qoldirilgan, e'tiborsiz). */
export function visibleScreens(_branchUser: boolean, viewablePages: PermissionPage[]): ScreenId[] {
  return NAV.filter((n) => n.pages.some((p) => viewablePages.includes(p))).map((n) => n.id);
}

/** Route guard: shu path ruxsatga ochiqmi. Noma'lum path (masalan /login) BLOKLANMAYDI.
    Eng uzun href mosligi olinadi. ⚠️ NAV bilan AYNAN bir mezon (ruxsat) — URL orqali
    menyuda yo'q sahifaga kirib bo'lmaydi va menyudagi sahifa bloklanmaydi. */
export function pathAllowed(pathname: string, _branchUser: boolean, viewablePages: PermissionPage[]): boolean {
  const item = NAV
    .filter((n) => pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href)))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (!item) return true; // NAV'da yo'q route — bloklanmaydi
  return item.pages.some((p) => viewablePages.includes(p));
}

/** UserModal `branch` payload — ⚠️ ODAMNI JIMGINA ASOSIY FILIALGA KO'CHIRMASLIK uchun:
    kalit FAQAT o'zgarg+anda yuboriladi (o'zgarmasa TUSHIRILADI). null = asosiy filial.
    - yangi: filial tanlansa {branch}, aks holda {} (default asosiy).
    - tahrir: tanlov ≠ boshlang'ich bo'lsagina {branch: tanlov}. */
export function buildUserBranchPayload(
  initialBranch: number | null | undefined,
  selectedBranch: number | null,
  isEdit: boolean,
): { branch: number | null } | Record<string, never> {
  if (!isEdit) return selectedBranch != null ? { branch: selectedBranch } : {};
  const init = initialBranch ?? null;
  return selectedBranch === init ? {} : { branch: selectedBranch };
}

/* ===== HISOB-KITOB filial ajratmasi (accounting branch split) ===== */
const num = (v: string | number | null | undefined): number => (v == null ? 0 : typeof v === "number" ? v : parseFloat(v) || 0);

/** Segmentli tanlov → `?branch=` qiymati. "all"→all, "main"→main, id→"<id>". */
export type BranchSelection = "all" | "main" | number;
export const accountingBranchParam = (sel: BranchSelection): string =>
  sel === "all" ? "all" : sel === "main" ? "main" : String(sel);

/** Jadval/footer YAGONA row-view — `summary` VA `by_branch` qatori bir xil shaklda.
    Pul stringlari songa aylantiriladi; branch_name yo'q bo'lsa "Jami". */
export function accountingRowView(f: AccountingFigures) {
  return {
    name: f.branch_name || "Jami",
    isMain: f.is_main ?? false,
    salesCount: f.sales_count ?? 0,
    // ⚠️ ARALASH — cash/card bucketlari BILAN KESISHADI, beshinchi kategoriya EMAS.
    // Jamlashga yaroqsiz; «shundan aralash» sifatida ko'rsatiladi.
    mixedCount: f.mixed_count ?? 0,
    mixedQuantity: f.mixed_quantity ?? 0,
    // ⚠️ DASTAFKA — TOVAR savdosidan tashqarida; naqd/karta ustunlari ICHIDA.
    // INVARIANT: cash + card + debt + unknown = received (total_sales EMAS).
    delivery: num(f.delivery_total),
    deliveryCount: f.delivery_count ?? 0,
    received: num(f.received_total) || num(f.total_sales) + num(f.delivery_total),
    buket: f.total_quantity ?? 0,
    stems: f.flower_stems ?? 0,
    sales: num(f.total_sales),
    cash: num(f.cash_total),
    card: num(f.card_total),
    discount: num(f.discount_total),
    cost: num(f.cost_total),
    flowerCost: num(f.flower_cost_total),
    materialCost: num(f.material_cost_total),
    feeCost: num(f.florist_fee_cost_total),
    net: num(f.net_profit),
    // summary'da share_percent yo'q → Jami = 100%
    share: f.share_percent != null ? num(f.share_percent) : 100,
  };
}

/** Kartochka ostidagi ajratma bo'laklari: "Toshkent 7 700 000 (91.45%) · Parkent …".
    `field` — pul kaliti (total_sales/cash_total/…). Faqat `all` rejimda ko'rsatiladi. */
export function branchSplitParts(rows: AccountingByBranch[], field: keyof AccountingFigures): { name: string; value: number; share: string }[] {
  return rows.map((r) => ({ name: r.branch_name || "—", value: num(r[field] as string | number), share: r.share_percent ?? "" }));
}
/** Bo'laklarni bitta satrga yig'adi (fmt — pul formatlagich). Uzun bo'lsa komponent kesadi. */
export function branchSplitLine(rows: AccountingByBranch[], field: keyof AccountingFigures, fmt: (v: number) => string): string {
  return branchSplitParts(rows, field).map((p) => `${p.name} ${fmt(p.value)}${p.share ? ` (${p.share}%)` : ""}`).join(" · ");
}
