"use client";
import { Bell, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

/**
 * Yangi bildirishnoma toast-kartasi — o'ng yuqoridan suzib chiqadi,
 * 6s'da o'zi yo'qoladi. Bosilsa: o'qildi + /bildirishnomalar sahifasiga
 * o'tadi. WS orqali ham, polling fallback orqali ham keladi (store).
 * Oddiy matnli Toast (pastdagi pill) o'z joyida qoladi.
 */
export default function NotifToast() {
  const n = useStore((s) => s.notifToast);
  const clear = useStore((s) => s.clearNotifToast);
  const markRead = useStore((s) => s.markNotifRead);
  const router = useRouter();

  return (
    <AnimatePresence>
      {n && (
        <motion.div
          initial={{ opacity: 0, x: 48, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 28, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          className="fixed right-3 top-[84px] z-[95] w-[min(360px,calc(100vw-24px))] sm:right-5"
          role="status"
          aria-live="polite"
        >
          <button
            onClick={() => {
              if (!n.is_read) markRead(n.id);
              clear();
              router.push("/bildirishnomalar");
            }}
            className="flex w-full items-start gap-3 rounded-[16px] border p-3.5 text-left transition-transform duration-200 hover:-translate-y-0.5"
            style={{ background: "var(--surface-solid)", borderColor: "var(--border)", boxShadow: "var(--shadow-lg)" }}
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--primary-strong))", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)" }}
            >
              <Bell size={16} strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold" style={{ color: "var(--text)" }}>
                {n.title_uz || n.title_ru || "Yangi bildirishnoma"}
              </span>
              {(n.body_uz || n.body_ru) && (
                <span className="mt-0.5 block truncate text-[12px]" style={{ color: "var(--text-2)" }}>{n.body_uz || n.body_ru}</span>
              )}
              <span className="mt-1 block text-[11px] font-semibold" style={{ color: "var(--primary)" }}>Ko&apos;rish →</span>
            </span>
            <span
              role="button"
              tabIndex={0}
              aria-label="Yopish"
              onClick={(e) => { e.stopPropagation(); clear(); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); clear(); } }}
              className="icon-btn !h-7 !w-7 !min-h-0 !min-w-0"
            >
              <X size={14} strokeWidth={1.75} />
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
