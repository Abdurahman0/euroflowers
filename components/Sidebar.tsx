"use client";
import { Fragment, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { motion } from "framer-motion";
import { usePerm, useStore } from "@/lib/store";
import { Icon } from "./icons";
import { NAV } from "@/lib/branch";

/** NAV sahifalari backend ruxsat sahifalariga bog'langan (kontrakt: can_view).
    `pages` — bir nechtasidan BIRORTASI yetarli (backend florists/suppliers/
    attendance ruxsatlarini alohida ajratdi, eski matritsalarda ular yo'q). */
// Eng ko'p ishlatiladigan 6 sahifa TEPADA (top:true) — keyin ajratgich, so'ng qolganlari
// JORIY NISBIY tartibda. Ruxsat gating o'zgarmaydi (yashirilgan element render bo'lmaydi).
// NAV endi lib/branch.ts'da — Sidebar, route guard va testlar YAGONA manbadan.

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sideOpen, toggleSide } = useStore();
  const { canView } = usePerm();

  // tor ekranlarda avtomatik yig'iladi — kontent doim ustuvor
  useEffect(() => {
    if (window.matchMedia("(max-width: 1024px)").matches && useStore.getState().sideOpen) {
      toggleSide();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <aside
      className={clsx(
        "relative z-10 flex flex-col overflow-hidden rounded-xl border border-white/10",
        "transition-[width,min-width,padding,transform] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        sideOpen ? "w-[240px] min-w-[240px] px-3 pb-3 pt-5" : "w-[60px] min-w-[60px] px-1.5 pb-3 pt-5",
        // <768px: chap chetdan suzib chiquvchi drawer (overlay); yopiq holda ekrandan tashqarida
        "max-md:fixed max-md:inset-y-2 max-md:left-2 max-md:z-[80] max-md:w-[256px] max-md:min-w-[256px] max-md:px-3",
        "max-md:pb-[calc(12px+env(safe-area-inset-bottom))]",
        sideOpen ? "max-md:translate-x-0" : "max-md:-translate-x-[120%]"
      )}
      style={{
        background: "color-mix(in srgb, var(--side) 94%, transparent)",
        backdropFilter: "blur(20px)",
        boxShadow: "var(--shadow-md)",
      }}
    >
      {/* logo */}
      <div className={clsx("flex items-center gap-2.5 border-b border-white/10 px-1 pb-4", !sideOpen && "justify-center px-0")}>
        <img
          src="/flowers/textures/peony.webp"
          alt="EuroFlowers"
          className="h-9 w-9 shrink-0 object-contain transition-transform duration-300 hover:rotate-6 hover:scale-105"
          style={{ filter: "saturate(0.95) drop-shadow(0 2px 8px rgba(0,0,0,0.4))" }}
        />
        {sideOpen && (
          <div className="min-w-0">
            <div className="truncate text-[16px] font-semibold tracking-tight text-[#F5F0E8]">EuroFlowers</div>
            <div className="text-[11px] font-semibold uppercase tracking-[3px] text-[#F5F0E8]/45">AI · Boutique</div>
          </div>
        )}
      </div>

      {/* nav */}
      <nav className="mt-3 flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden">
        {/* ⚠️ RUXSAT HUKM QILADI — filial allowlist'i olib tashlandi (filial foydalanuvchisi ham
            ruxsati bergan hamma sahifani ko'radi). Umumiy ma'lumot ogohlantirishi sahifa ichida. */}
        {NAV.filter((n) => canView(...n.pages)).map((n, i, arr) => {
          const active = pathname === n.href;
          // tepa 6lik va qolganlari orasida yumshoq ajratgich — ALOHIDA element sifatida
          // (item wrapper'iga BIRIKTIRILMAYDI), shunda HAR bir tugma bir xil to'g'ridan-to'g'ri
          // flex bola bo'ladi (Analitika ilgari yagona `border-t` wrapper ichida edi).
          const divider = i > 0 && arr[i - 1].top && !n.top;
          return (
            <Fragment key={n.id}>
            {divider && <div className="mt-2 border-t border-white/[0.08] pt-2" aria-hidden />}
            <button
              onClick={() => {
                router.push(n.href);
                if (window.matchMedia("(max-width: 767px)").matches) toggleSide();
              }}
              title={sideOpen ? undefined : n.label}
              className={clsx(
                "group relative flex items-center rounded-[10px] text-[13px] outline-none",
                "transition-colors duration-200",
                sideOpen ? "gap-2.5 px-3 py-2.5" : "justify-center py-2.5",
                active ? "font-semibold text-white" : "font-medium text-[#F5F0E8]/60 hover:bg-white/[0.06] hover:text-[#F5F0E8]"
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  transition={{ type: "spring", stiffness: 380, damping: 36 }}
                  className="absolute inset-0 rounded-[10px]"
                  style={{
                    background: "color-mix(in srgb, var(--primary) 82%, #000 6%)",
                    boxShadow: "var(--shadow-xs), inset 0 1px 0 rgba(255,255,255,0.16)",
                  }}
                />
              )}
              <span className={clsx("relative z-10 transition-opacity duration-200", !active && "opacity-80 group-hover:opacity-100")}>
                <Icon name={n.id} size={16} />
              </span>
              {sideOpen && <span className="relative z-10 flex-1 whitespace-nowrap text-left">{n.label}</span>}
            </button>
            </Fragment>
          );
        })}
      </nav>

    </aside>
  );
}
