"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { motion } from "framer-motion";
import { usePerm, useStore } from "@/lib/store";
import { Icon } from "./icons";
import type { PermissionPage, ScreenId } from "@/lib/types";

/** NAV sahifalari backend ruxsat sahifalariga bog'langan (kontrakt: can_view) */
const NAV: { id: ScreenId; href: string; label: string; page: PermissionPage }[] = [
  { id: "dashboard", href: "/", label: "Dashboard", page: "dashboard" },
  { id: "chat", href: "/chat", label: "AI chatlar", page: "conversations" },
  { id: "crm", href: "/crm", label: "CRM", page: "crm" },
  { id: "sklad", href: "/sklad", label: "Sklad", page: "inventory" },
  { id: "gullar", href: "/gullar", label: "Gullar", page: "inventory" },
  { id: "katalog", href: "/katalog", label: "Katalog", page: "catalog" },
  { id: "postlar", href: "/postlar", label: "Postlar", page: "social_posts" },
  { id: "bildirishnomalar", href: "/bildirishnomalar", label: "Bildirishnomalar", page: "notifications" },
  { id: "xodimlar", href: "/xodimlar", label: "Xodimlar", page: "users" },
  { id: "integratsiyalar", href: "/integratsiyalar", label: "Integratsiyalar", page: "integrations" },
  { id: "audit", href: "/audit", label: "Audit jurnali", page: "audit" },
  { id: "sozlamalar", href: "/sozlamalar", label: "Sozlamalar", page: "settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sideOpen, toggleSide, notifs } = useStore();
  const { canView } = usePerm();
  const yangiLead = notifs.filter((n) => !n.is_read && n.notification_type === "lead").length;

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
        "transition-[width,min-width,padding] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        sideOpen ? "w-[240px] min-w-[240px] px-3 pb-3 pt-5" : "w-[60px] min-w-[60px] px-1.5 pb-3 pt-5"
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
        {NAV.filter((n) => canView(n.page)).map((n) => {
          const active = pathname === n.href;
          return (
            <button
              key={n.id}
              onClick={() => router.push(n.href)}
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
              {sideOpen && n.id === "crm" && yangiLead > 0 && (
                <span
                  className={clsx(
                    "relative z-10 min-w-[20px] rounded-full px-1.5 py-px text-center text-[11px] font-bold",
                    active ? "bg-white/20 text-white" : "text-white"
                  )}
                  style={active ? undefined : { background: "var(--primary)" }}
                >
                  {yangiLead}
                </span>
              )}
            </button>
          );
        })}
      </nav>

    </aside>
  );
}
