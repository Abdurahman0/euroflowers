"use client";
import clsx from "clsx";
import { usePathname, useRouter } from "next/navigation";
import { Bell, CalendarDays, ChevronRight, CircleUserRound, LayoutDashboard, WalletCards } from "lucide-react";
import { useStore } from "@/lib/store";

const LINKS = [
  ["/florist/dashboard", "Dashboard", LayoutDashboard],
  ["/florist/attendance", "Davomat", CalendarDays],
  ["/florist/salary", "Ish haqi", WalletCards],
  ["/florist/notifications", "Bildirishnomalar", Bell],
  ["/profile", "Profil", CircleUserRound],
] as const;

export default function FloristSidebar() {
  const pathname = usePathname(); const router = useRouter(); const { sideOpen, toggleSide, notifs } = useStore();
  const unread = notifs.filter((n) => !n.is_read).length;
  return <aside className={clsx("relative z-10 flex flex-col overflow-hidden rounded-xl border border-white/10 transition-[width] duration-300", sideOpen ? "w-[240px] min-w-[240px] px-3 pb-3 pt-5" : "w-[60px] min-w-[60px] px-1.5 pb-3 pt-5", "max-md:fixed max-md:inset-y-2 max-md:left-2 max-md:z-[80] max-md:w-[256px] max-md:min-w-[256px] max-md:px-3", sideOpen ? "max-md:translate-x-0" : "max-md:-translate-x-[120%]")} style={{ background: "color-mix(in srgb, var(--side) 94%, transparent)", backdropFilter: "blur(20px)", boxShadow: "var(--shadow-md)" }}>
    <div className={clsx("flex items-center gap-2.5 border-b border-white/10 px-1 pb-4", !sideOpen && "justify-center px-0")}><img src="/flowers/textures/peony.webp" alt="EuroFlowers" className="h-9 w-9 shrink-0 object-contain" />{sideOpen && <div><div className="text-[16px] font-semibold text-[#F5F0E8]">EuroFlowers</div><div className="text-[10px] font-bold uppercase tracking-[2.5px] text-[#F5F0E8]/45">Florist space</div></div>}</div>
    {sideOpen && <div className="mx-1 mt-4 rounded-[13px] border border-white/10 bg-white/[0.06] px-3 py-2 text-[11px] font-semibold text-[#F5F0E8]/60">Shaxsiy ish maydoni</div>}
    <nav className="mt-3 flex flex-1 flex-col gap-1">{LINKS.map(([href, label, I]) => { const active = pathname === href; return <button key={href} onClick={() => { router.push(href); if (window.matchMedia("(max-width: 767px)").matches) toggleSide(); }} className={clsx("relative flex items-center rounded-[10px] text-[13px] transition-colors", sideOpen ? "gap-2.5 px-3 py-2.5" : "justify-center py-2.5", active ? "font-semibold text-white" : "font-medium text-[#F5F0E8]/60 hover:bg-white/[0.06] hover:text-[#F5F0E8]")} style={active ? { background: "color-mix(in srgb, var(--primary) 82%, #000 6%)" } : undefined}><I size={16} strokeWidth={1.8} />{sideOpen && <span className="flex-1 text-left">{label}</span>}{sideOpen && href === "/florist/notifications" && unread > 0 && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white" style={{ background: "var(--primary)" }}>{unread}</span>}{sideOpen && href === "/profile" && <ChevronRight size={13} className="opacity-40" />}</button>; })}</nav>
  </aside>;
}
