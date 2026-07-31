import type { PermissionPage, ScreenId } from "./types";

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
  { id: "mijozlar", href: "/mijozlar", label: "Mijozlar", pages: ["customers"] },
  { id: "suppliers", href: "/suppliers", label: "Yetkazib beruvchilar", pages: ["suppliers", "inventory"] },
  { id: "postlar", href: "/postlar", label: "Postlar", pages: ["social_posts"] },
  { id: "bildirishnomalar", href: "/bildirishnomalar", label: "Bildirishnomalar", pages: ["notifications"] },
  { id: "xodimlar", href: "/xodimlar", label: "Xodimlar", pages: ["users"] },
  { id: "integratsiyalar", href: "/integratsiyalar", label: "Integratsiyalar", pages: ["integrations"] },
  { id: "audit", href: "/audit", label: "Audit jurnali", pages: ["audit"] },
  { id: "sozlamalar", href: "/sozlamalar", label: "Sozlamalar", pages: ["settings"] },
];

/** Filial (non-main) foydalanuvchisi FAQAT shu ekranlarni ko'radi (spec §3). */
export const BRANCH_SCREENS: ScreenId[] = ["dashboard", "hisob", "katalog"];

/** Filial foydalanuvchisimi. Jonli kontrakt (tekshirilgan): asosiy filial
    `profile.branch = null` (integer, nullable, MAJBURIY EMAS); filial `= <id>`.
    ⚠️ XAVFSIZ YO'NALISH: `null` VA `undefined` (kalit yo'q) → asosiy (cheklanmagan) —
    bu real asosiy foydalanuvchilar uchun to'g'ri. HAR QANDAY non-null qiymat (son, "2"
    satr, hatto 0) → cheklangan filial. Ya'ni noaniqlikda OSHIQCHA cheklaymiz, kam emas.
    Kalit umuman yo'q bo'lsa (schema uni majburiy demaydi) — loadMe'da ogohlantiriladi. */
export const isBranchUser = (branch: number | null | undefined): boolean => branch !== null && branch !== undefined;

/** Ekran filial foydalanuvchisiga OCHIQmi (ruxsatdan ALOHIDA, ustiga qatlam). */
export const screenAllowedForBranch = (id: ScreenId, branchUser: boolean): boolean =>
  !branchUser || BRANCH_SCREENS.includes(id);

/** PURE: (filial foydalanuvchisi?, ko'ra oladigan sahifalar) → ko'rinadigan ekranlar.
    Ruxsat VA filial qatlami — ikkalasi ham o'tishi shart, hech qachon ko'proq emas. */
export function visibleScreens(branchUser: boolean, viewablePages: PermissionPage[]): ScreenId[] {
  return NAV
    .filter((n) => n.pages.some((p) => viewablePages.includes(p)) && screenAllowedForBranch(n.id, branchUser))
    .map((n) => n.id);
}

/** Route guard: shu path filial foydalanuvchisiga (va ruxsatga) ochiqmi. Noma'lum
    path (masalan /login) BLOKLANMAYDI. Eng uzun href mosligi olinadi. */
export function pathAllowed(pathname: string, branchUser: boolean, viewablePages: PermissionPage[]): boolean {
  const item = NAV
    .filter((n) => pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href)))
    .sort((a, b) => b.href.length - a.href.length)[0];
  if (!item) return true; // NAV'da yo'q route — bloklanmaydi
  return item.pages.some((p) => viewablePages.includes(p)) && screenAllowedForBranch(item.id, branchUser);
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
