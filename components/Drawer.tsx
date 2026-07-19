"use client";
import { X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";

/**
 * YAGONA o'ng tomondan chiquvchi panel (slide-over) — ilovadagi barcha
 * kontentli dialoglar (ko'rish, tahrirlash, yaratish) shu qobiqda:
 *   • o'ng chetdan translateX(100%→0), 280ms ease-out; yopilishda teskari
 *   • to'liq balandlik, chap burchaklar 20px, o'ng chet tekis
 *   • xira + blur overlay; overlay bosish / ESC / ✕ yopadi
 *   • fokus panel ichida qulflanadi (Tab aylanadi)
 *   • ichki kontent mustaqil skroll (overscroll-contain, Lenis'dan himoya)
 *   • mobil (<768px): to'liq kenglik
 * Mayda tasdiqlash dialoglari (ha/yo'q) markazda qolishi mumkin — bu qobiq
 * kontentga mo'ljallangan.
 */

const DrawerCtx = createContext<(() => void) | null>(null);
/** Panel ichidan animatsiyali yopish — sarlavha ✕ shundan foydalanadi. */
export const useDrawerClose = () => useContext(DrawerCtx);

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Drawer({
  children,
  onClose,
  width = 480,
  title,
  sub,
  badges,
}: {
  children: React.ReactNode;
  onClose: () => void;
  /** ~480 — formalar, ~560 — batafsil ko'rinishlar */
  width?: number;
  /** berilsa — o'rnatilgan qadalgan sarlavha; berilmasa children o'zi boshqaradi */
  title?: string;
  sub?: string;
  badges?: React.ReactNode;
}) {
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const panelRef = useRef<HTMLElement>(null);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    setTimeout(onClose, 260);
  }, [onClose]);

  // ESC + fokus tuzog'i + body skroll qulfi
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        requestClose();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (!active || !panelRef.current.contains(active)) {
          e.preventDefault();
          first.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => {
      if (panelRef.current && !panelRef.current.contains(document.activeElement)) {
        panelRef.current.querySelector<HTMLElement>(FOCUSABLE)?.focus();
      }
    }, 80);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      clearTimeout(t);
    };
  }, [requestClose]);

  // portal — sahifa animatsiyalari (transform/filter) fixed pozitsiyani
  // qafasga sololmasin: panel har doim to'g'ridan-to'g'ri body ostida
  return createPortal(
    <DrawerCtx.Provider value={requestClose}>
      <motion.div
        onClick={requestClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: closing ? 0 : 1 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        className="fixed inset-0 z-[85]"
        style={{ background: "rgba(24, 17, 12, .38)", backdropFilter: "blur(8px) saturate(1.1)" }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-lenis-prevent
      >
        <motion.aside
          ref={panelRef}
          onClick={(e) => e.stopPropagation()}
          initial={{ x: "100%" }}
          animate={{ x: closing ? "100%" : 0 }}
          transition={{ duration: 0.28, ease: [0, 0, 0.2, 1] }}
          className="drawer-panel fixed inset-y-0 right-0 flex flex-col border-l max-md:!w-screen max-md:rounded-none md:rounded-l-[20px]"
          style={{
            width: `min(${width}px, 90vw)`,
            background: "var(--surface-solid)",
            color: "var(--text)",
            borderColor: "var(--border)",
            boxShadow: "-20px 0 60px rgba(20, 12, 8, 0.22)",
          }}
        >
          {title ? (
            <>
              {/* qadalgan sarlavha */}
              <div className="flex items-start gap-3 border-b p-5 pb-4" style={{ borderColor: "var(--border)" }}>
                <div className="min-w-0 flex-1">
                  <div className="text-[18px] font-semibold leading-tight tracking-tight">{title}</div>
                  {sub && <div className="mt-0.5 text-[13px]" style={{ color: "var(--muted)" }}>{sub}</div>}
                  {badges && <div className="mt-2 flex flex-wrap items-center gap-1.5">{badges}</div>}
                </div>
                <button
                  onClick={requestClose}
                  aria-label="Yopish"
                  className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-sm transition-colors duration-200 hover:bg-[var(--hover)]"
                  style={{ color: "var(--text-2)" }}
                >
                  <X size={18} strokeWidth={1.75} />
                </button>
              </div>
              {/* kontent — mustaqil skroll */}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5" data-lenis-prevent>{children}</div>
            </>
          ) : (
            // sarlavhasiz rejim: children o'zi ModalHeader/ModalFooter bilan keladi
            // flex-col: qisqa kontentda ham footer (mt-auto) panel tubiga yopishadi
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-6 pb-6" data-lenis-prevent>{children}</div>
          )}
        </motion.aside>
      </motion.div>
    </DrawerCtx.Provider>,
    document.body
  );
}
