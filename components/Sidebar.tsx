"use client";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { logout } from "@/lib/api";
import { Icon } from "./icons";
import { ROLE_LABEL } from "./badges";
import type { Role, ScreenId } from "@/lib/types";

const NAV: { id: ScreenId; href: string; label: string; roles: Role[] }[] = [
  { id: "dashboard", href: "/", label: "Dashboard", roles: ["admin", "operator", "florist", "warehouse", "content"] },
  { id: "chat", href: "/chat", label: "AI chatlar", roles: ["admin", "operator"] },
  { id: "crm", href: "/crm", label: "CRM", roles: ["admin", "operator"] },
  { id: "sklad", href: "/sklad", label: "Sklad", roles: ["admin", "warehouse", "florist"] },
  { id: "katalog", href: "/katalog", label: "Katalog", roles: ["admin", "operator", "florist", "warehouse", "content"] },
  { id: "postlar", href: "/postlar", label: "Postlar", roles: ["admin", "operator", "content"] },
  { id: "sozlamalar", href: "/sozlamalar", label: "Sozlamalar", roles: ["admin"] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { sideOpen, user, notifs } = useStore();
  const role = user?.profile.role ?? "admin";
  const yangiLead = notifs.filter((n) => !n.is_read && n.notification_type === "lead").length;
  const fullName = user ? [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username : "…";

  return (
    <aside
      className={clsx(
        "relative z-10 flex flex-col overflow-hidden rounded-[26px] border-[1.5px] border-white/15",
        "shadow-[0_18px_48px_rgba(40,28,20,.3),inset_0_1px_0_rgba(255,255,255,.12)]",
        "transition-[width,min-width,padding] duration-[550ms] ease-[cubic-bezier(.22,1,.36,1)]",
        sideOpen ? "w-[248px] min-w-[248px] px-4 pb-4 pt-6" : "w-[60px] min-w-[60px] px-1.5 pb-4 pt-6"
      )}
      style={{ background: "color-mix(in srgb, var(--side) 92%, transparent)", backdropFilter: "blur(20px)" }}
    >
      {/* logo — ohista nafas oladi */}
      <div className={clsx("flex items-center gap-2.5 border-b border-white/10 pb-5", !sideOpen && "justify-center")}>
        <motion.div
          animate={{ rotate: [-6, -2, -6], scale: [1, 1.04, 1] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          className="flex h-[34px] w-[34px] items-center justify-center rounded-xl text-white"
          style={{ background: "var(--acc)" }}
        >
          <Icon name="logo" />
        </motion.div>
        {sideOpen && (
          <div>
            <div className="font-serif-lux text-[19px] tracking-tight text-[#F7F1E8]">EuroFlowers</div>
            <div className="text-[9px] font-bold uppercase tracking-[3.5px]" style={{ color: "var(--accL)" }}>
              AI · Boutique
            </div>
          </div>
        )}
      </div>

      {/* nav */}
      <nav className="mt-4 flex flex-1 flex-col gap-0.5 overflow-auto">
        {NAV.filter((n) => n.roles.includes(role)).map((n) => {
          const active = pathname === n.href;
          return (
            <button
              key={n.id}
              onClick={() => router.push(n.href)}
              className={clsx(
                "group relative flex items-center rounded-xl text-[13.5px] transition-[padding] duration-[550ms]",
                sideOpen ? "gap-2.5 px-3 py-[11px]" : "justify-center py-[11px]",
                active ? "font-bold text-[#2b221d]" : "font-medium text-[#F7F1E8]/65 hover:text-[#F7F1E8]"
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  transition={{ type: "spring", stiffness: 320, damping: 32 }}
                  className="absolute inset-0 rounded-xl bg-white/92"
                  style={{ boxShadow: "0 8px 22px rgba(0,0,0,.22)" }}
                />
              )}
              <span className="relative z-10 transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] group-hover:rotate-[8deg] group-hover:scale-110">
                <Icon name={n.id} />
              </span>
              {sideOpen && <span className="relative z-10 flex-1 whitespace-nowrap text-left">{n.label}</span>}
              {sideOpen && n.id === "crm" && yangiLead > 0 && (
                <span className="relative z-10 rounded-full px-2 py-px text-[11px] font-bold text-white" style={{ background: "var(--acc)" }}>
                  {yangiLead}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* user + chiqish */}
      <div className="mt-2.5 border-t border-white/10 pt-3.5">
        <div className={clsx("flex items-center gap-2.5 px-2.5", !sideOpen && "justify-center px-0")}>
          <div className="flex h-9 w-9 shrink-0 rotate-3 items-center justify-center rounded-xl text-sm font-bold text-white transition-transform duration-500 hover:rotate-0" style={{ background: "var(--acc)" }}>
            {fullName[0]?.toUpperCase() ?? "?"}
          </div>
          {sideOpen && (
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-[#F7F1E8]">{fullName}</div>
              <div className="text-[11.5px] text-[#F7F1E8]/50">{ROLE_LABEL[role] ?? role}</div>
            </div>
          )}
          {sideOpen && (
            <button onClick={logout} title="Chiqish" className="rounded-lg px-2 py-1 text-[11px] font-bold text-[#F7F1E8]/55 transition-colors hover:bg-white/10 hover:text-white">
              Chiqish
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
