"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useStore, THEMES } from "@/lib/store";
import { fmtTime } from "@/lib/format";
import { Icon } from "./icons";
import clsx from "clsx";

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/chat": "AI Instagram chatlar",
  "/crm": "CRM — mijozlar va leadlar",
  "/sklad": "Sklad",
  "/katalog": "Kunlik katalog",
  "/postlar": "Instagram postlar",
  "/sozlamalar": "Sozlamalar",
};

const WEEKDAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentyabr", "oktyabr", "noyabr", "dekabr"];

export default function Header() {
  const pathname = usePathname();
  const { toggleSide, notifs, markNotifRead, markAllNotifsRead, themeId, setTheme, dark, setDark } = useStore();
  const [notifOpen, setNotifOpen] = useState(false);
  const [temaOpen, setTemaOpen] = useState(false);
  const unread = notifs.filter((n) => !n.is_read).length;
  const now = new Date();
  const dateStr = `${WEEKDAYS[now.getDay()]}, ${now.getDate()}-${MONTHS[now.getMonth()]} ${now.getFullYear()} · Toshkent`;

  return (
    <header className="relative z-20 flex items-center justify-between gap-3.5 border-b-[1.5px] px-6 pb-4 pt-4" style={{ borderColor: "var(--ink)" }}>
      <div className="flex items-center gap-3">
        <button onClick={toggleSide} className="glass flex h-[38px] w-[38px] items-center justify-center !rounded-xl" title="Sidebar">
          <Icon name="menu" />
        </button>
        <div>
          <h1 className="text-[27px] font-extrabold tracking-tight">{TITLES[pathname] ?? "EuroFlowers"}</h1>
          <p className="text-[12.5px] font-medium" style={{ color: "var(--mut)" }}>{dateStr}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* tema */}
        <div className="relative">
          <button onClick={() => { setTemaOpen(!temaOpen); setNotifOpen(false); }} className="glass flex h-[42px] w-[42px] items-center justify-center !rounded-[13px]">
            <Icon name="palette" />
          </button>
          {temaOpen && (
            <div className="glass-modal absolute right-0 top-[52px] z-50 w-60 p-3.5 !rounded-2xl">
              <div className="mb-2.5 text-[13px] font-bold">Rejim</div>
              <div className="mb-3.5 flex gap-2">
                <button onClick={() => setDark(false)} className={clsx("flex-1 rounded-[11px] border py-2 text-xs font-bold", !dark && "ring-2")} style={{ background: "#FFFDF8", color: "#221833", borderColor: "#221833" }}>
                  ☀ Yorug&apos;
                </button>
                <button onClick={() => setDark(true)} className={clsx("flex-1 rounded-[11px] border py-2 text-xs font-bold", dark && "ring-2")} style={{ background: "#17141C", color: "#F0E9FA", borderColor: "#221833" }}>
                  ☾ Qorong&apos;u
                </button>
              </div>
              <div className="mb-2 text-[13px] font-bold">Rang mavzusi</div>
              <div className="flex flex-wrap gap-2">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    title={t.nomi}
                    onClick={() => setTheme(t.id)}
                    className={clsx("h-[34px] w-[34px] rounded-full border transition-transform hover:scale-110", themeId === t.id && "ring-2 ring-white")}
                    style={{ background: t.accent, borderColor: "#221833" }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* bildirishnomalar */}
        <div className="relative">
          <button onClick={() => { setNotifOpen(!notifOpen); setTemaOpen(false); }} className="glass relative flex h-[42px] w-[42px] items-center justify-center !rounded-[13px]">
            <Icon name="bell" />
            {unread > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-[#221833] bg-[#E4572E] px-1 text-[10.5px] font-bold text-white">
                {unread}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="glass-modal absolute right-0 top-[52px] z-50 max-h-[70vh] w-[min(410px,90vw)] overflow-auto p-2 !rounded-2xl">
              <div className="flex items-center justify-between px-3 pb-1.5 pt-2.5">
                <span className="text-[15px] font-bold">Bildirishnomalar</span>
                {unread > 0 && (
                  <button onClick={markAllNotifsRead} className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold hover:bg-white/20">
                    Barchasini o&apos;qish
                  </button>
                )}
              </div>
              {notifs.length === 0 && <p className="px-3 pb-3 text-[13px] text-white/55">Bildirishnoma yo&apos;q.</p>}
              {notifs.map((n) => (
                <button key={n.id} onClick={() => !n.is_read && markNotifRead(n.id)} className={clsx("flex w-full items-start gap-2.5 rounded-xl p-3 text-left hover:bg-white/10", n.is_read && "opacity-55")}>
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border border-[#221833]" style={{ background: n.notification_type === "lead" ? "#7FC9A0" : "#E4572E" }} />
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

        {/* AI status */}
        <div className="flex items-center gap-2 rounded-full border-[1.5px] px-4 py-2 text-[12.5px] font-bold text-white" style={{ background: "var(--acc)", borderColor: "var(--ink)" }}>
          <span className="h-2 w-2 rounded-full bg-[#7FC9A0]" />
          AI faol · @euroflowers.uz
        </div>
      </div>
    </header>
  );
}
