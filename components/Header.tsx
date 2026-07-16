"use client";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { useStore, THEMES } from "@/lib/store";
import { logout } from "@/lib/api";
import { ROLE_LABEL } from "./badges";
import { fmtTime } from "@/lib/format";
import { Icon } from "./icons";
import clsx from "clsx";

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/chat": "AI Instagram chatlar",
  "/crm": "CRM — mijozlar va leadlar",
  "/sklad": "Sklad",
  "/gullar": "Gullar va navlar",
  "/katalog": "Kunlik katalog",
  "/postlar": "Instagram postlar",
  "/bildirishnomalar": "Bildirishnomalar",
  "/sozlamalar": "Sozlamalar",
};

const WEEKDAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentyabr", "oktyabr", "noyabr", "dekabr"];

/** Bir xil ko'rinishdagi topbar icon-tugmasi */
const iconBtnCls =
  "flex h-9 w-9 items-center justify-center rounded-[10px] border transition-colors duration-200 hover:bg-[var(--hover)]";
const iconBtnStyle = { borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-2)" } as const;

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { toggleSide, notifs, markNotifRead, markAllNotifsRead, themeId, setTheme, dark, setDark, user } = useStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const [temaOpen, setTemaOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const role = user?.profile.role ?? "admin";
  const fullName = user ? [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username : "…";
  const popRef = useRef<HTMLDivElement>(null);
  const unread = notifs.filter((n) => !n.is_read).length;
  const now = new Date();
  const dateStr = `${WEEKDAYS[now.getDay()]}, ${now.getDate()}-${MONTHS[now.getMonth()]} ${now.getFullYear()} · Toshkent`;

  /**
   * Mavzu almashinuvi — View Transitions API bilan doiraviy ochilish:
   * yangi mavzu aynan tugma markazidan suv halqasidek yoyiladi.
   * API bo'lmasa yoki reduced-motion bo'lsa — oddiy silliq almashish.
   */
  const flipTheme = (e: React.MouseEvent<HTMLButtonElement>) => {
    const next = !dark;
    const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
    const apply = () => {
      // snapshot to'g'ri chiqishi uchun sinf va fon sinxron qo'yiladi
      const root = document.documentElement;
      root.classList.toggle("dark", next);
      root.style.setProperty("--bg", next ? theme.dark : theme.light);
      flushSync(() => setDark(next));
    };
    const startVT = (document as Document & { startViewTransition?: (cb: () => void) => { ready: Promise<void> } }).startViewTransition?.bind(document);
    if (!startVT || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      apply();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const r = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    startVT(apply)
      .ready.then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
          { duration: 620, easing: "cubic-bezier(0.4, 0, 0.2, 1)", pseudoElement: "::view-transition-new(root)" }
        );
      })
      .catch(() => {});
  };

  // ochiq panellar: tashqariga bosish yoki ESC — yopadi
  useEffect(() => {
    if (!notifOpen && !temaOpen && !profileOpen) return;
    const closeAll = () => {
      setNotifOpen(false);
      setTemaOpen(false);
      setProfileOpen(false);
    };
    const onDown = (e: PointerEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) closeAll();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [notifOpen, temaOpen, profileOpen]);

  return (
    <header className="relative z-20 flex items-center justify-between gap-4 border-b px-6 pb-4 pt-4" style={{ borderColor: "var(--border)" }}>
      <div className="flex min-w-0 items-center gap-3">
        <button onClick={toggleSide} className={clsx(iconBtnCls, "shrink-0")} style={iconBtnStyle} title="Sidebar" aria-label="Sidebarni ochish/yopish">
          <Icon name="menu" size={16} />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-[22px] tracking-tight">{TITLES[pathname] ?? "EuroFlowers"}</h1>
          <p className="truncate text-[12px] font-medium" style={{ color: "var(--muted)" }}>{dateStr}</p>
        </div>
      </div>

      <div ref={popRef} className="flex items-center gap-2.5">
        {/* mavzu almashtirgich — yagona tugma: ☀ ↔ 🌙, ikonkasi silliq aylanadi */}
        <button
          onClick={flipTheme}
          className={clsx(iconBtnCls, "overflow-hidden")}
          style={iconBtnStyle}
          title={dark ? "Yorug' rejim" : "Qorong'u rejim"}
          aria-label="Mavzuni almashtirish"
        >
          <span className="relative block h-4 w-4">
            <span className={clsx("absolute inset-0 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]", dark ? "-rotate-[120deg] scale-[0.4] opacity-0" : "rotate-0 scale-100 opacity-100")}>
              <Icon name="sun" size={16} />
            </span>
            <span className={clsx("absolute inset-0 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]", dark ? "rotate-0 scale-100 opacity-100" : "rotate-[120deg] scale-[0.4] opacity-0")}>
              <Icon name="moon" size={16} />
            </span>
          </span>
        </button>

        {/* aksent palitrasi */}
        <div className="relative">
          <button
            onClick={() => { setTemaOpen(!temaOpen); setNotifOpen(false); }}
            className={iconBtnCls}
            style={iconBtnStyle}
            title="Rang mavzusi"
            aria-label="Rang mavzusini tanlash"
            aria-expanded={temaOpen}
          >
            <Icon name="palette" size={16} />
          </button>
          {temaOpen && (
            <div className="glass-modal absolute right-0 top-[46px] z-50 w-56 origin-top-right p-3.5 animate-[rowIn_0.22s_var(--ease)_both]">
              <div className="mb-2.5 text-[13px] font-bold">Rang mavzusi</div>
              <div className="flex flex-wrap gap-2">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    title={t.nomi}
                    onClick={() => setTheme(t.id)}
                    aria-label={t.nomi}
                    className={clsx("h-8 w-8 rounded-full border transition-transform duration-200 hover:scale-110", themeId === t.id && "ring-2 ring-white/80")}
                    style={{ background: t.accent, borderColor: "rgba(255,255,255,0.2)" }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* bildirishnomalar */}
        <div className="relative">
          <button
            onClick={() => { setNotifOpen(!notifOpen); setTemaOpen(false); }}
            className={clsx(iconBtnCls, "relative")}
            style={iconBtnStyle}
            title="Bildirishnomalar"
            aria-label="Bildirishnomalar"
            aria-expanded={notifOpen}
          >
            <Icon name="bell" size={16} />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: "var(--danger)", boxShadow: "0 0 0 2px var(--bg)" }}>
                {unread}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="glass-modal absolute right-0 top-[46px] z-50 max-h-[70vh] w-[min(410px,90vw)] origin-top-right overflow-y-auto overscroll-contain p-2 animate-[rowIn_0.22s_var(--ease)_both]" data-lenis-prevent>
              <div className="flex items-center justify-between px-3 pb-1.5 pt-2.5">
                <span className="text-[15px] font-bold">Bildirishnomalar</span>
                {unread > 0 && (
                  <button onClick={markAllNotifsRead} className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold transition-colors duration-200 hover:bg-white/20">
                    Barchasini o&apos;qish
                  </button>
                )}
              </div>
              {notifs.length === 0 && <p className="px-3 pb-3 text-[13px] text-white/55">Bildirishnoma yo&apos;q.</p>}
              {notifs.map((n) => (
                <button key={n.id} onClick={() => !n.is_read && markNotifRead(n.id)} className={clsx("flex w-full items-start gap-2.5 rounded-xl p-3 text-left transition-colors duration-200 hover:bg-white/10", n.is_read && "opacity-55")}>
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: n.notification_type === "lead" ? "var(--success)" : "var(--danger)" }} />
                  <div className="flex-1">
                    <div className="text-[13px] font-bold leading-snug">{n.title_uz || n.title_ru}</div>
                    {(n.body_uz || n.body_ru) && <div className="mt-0.5 text-[12.5px] leading-relaxed text-white/75">{n.body_uz || n.body_ru}</div>}
                    <div className="mt-0.5 text-[11.5px] text-white/55">{fmtTime(n.created_at)}{!n.is_read && " · o'qilmagan"}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* profil */}
        <div className="relative">
          <button
            onClick={() => { setProfileOpen(!profileOpen); setNotifOpen(false); setTemaOpen(false); }}
            className="flex h-9 items-center gap-2.5 rounded-[10px] border pl-1.5 pr-2.5 transition-colors duration-200 hover:bg-[var(--hover)]"
            style={iconBtnStyle}
            aria-label="Profil menyusi"
            aria-expanded={profileOpen}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-[8px] text-[11px] font-bold text-white" style={{ background: "var(--primary)" }}>
              {fullName[0]?.toUpperCase() ?? "?"}
            </span>
            <span className="hidden min-w-0 text-left sm:block">
              <span className="block max-w-[140px] truncate text-[12.5px] font-semibold leading-tight" style={{ color: "var(--text)" }}>{fullName}</span>
              <span className="block text-[10.5px] leading-tight" style={{ color: "var(--muted)" }}>{ROLE_LABEL[role] ?? role}</span>
            </span>
            <span className={clsx("transition-transform duration-200", profileOpen && "rotate-180")} style={{ color: "var(--muted)" }}>
              <Icon name="chevron" size={14} />
            </span>
          </button>
          {profileOpen && (
            <div className="glass-modal absolute right-0 top-[46px] z-50 w-52 origin-top-right p-1.5 animate-[rowIn_0.22s_var(--ease)_both]">
              <div className="border-b border-white/10 px-3 pb-2.5 pt-2">
                <div className="truncate text-[13px] font-bold">{fullName}</div>
                <div className="text-[11px] text-white/55">{ROLE_LABEL[role] ?? role}</div>
              </div>
              <div className="pt-1.5">
                <button onClick={() => { setProfileOpen(false); router.push("/sozlamalar"); }} className="flex w-full items-center gap-2.5 rounded-[9px] px-3 py-2 text-left text-[12.5px] font-medium text-white/80 transition-colors duration-200 hover:bg-white/10 hover:text-white">
                  <Icon name="user" size={15} /> Profil
                </button>
                <button onClick={() => { setProfileOpen(false); router.push("/sozlamalar"); }} className="flex w-full items-center gap-2.5 rounded-[9px] px-3 py-2 text-left text-[12.5px] font-medium text-white/80 transition-colors duration-200 hover:bg-white/10 hover:text-white">
                  <Icon name="sozlamalar" size={15} /> Sozlamalar
                </button>
                <button onClick={() => { setProfileOpen(false); logout(); }} className="flex w-full items-center gap-2.5 rounded-[9px] px-3 py-2 text-left text-[12.5px] font-medium transition-colors duration-200 hover:bg-white/10" style={{ color: "var(--danger-ink)" }}>
                  <Icon name="logout" size={15} /> Chiqish
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
