"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

/**
 * Umumiy modal qobiq — barcha dialoglar bir xil ishlaydi:
 *   • viewport markazida, max-balandlik 85vh, uzun kontent ICHKI skroll
 *   • ModalHeader tepaga, ModalFooter pastga yopishadi (sticky)
 *   • tashqariga bosish yopadi (backdrop), ESC yopadi
 *   • fokus modal ichida qulflanadi (Tab aylanadi)
 *   • 250ms fade + scale(0.97→1) kirish, yopilishda teskari
 *   • ochiq payt body skroll qulflanadi, yopilganda tiklanadi
 */

const ModalCtx = createContext<(() => void) | null>(null);
/** Modal ichidan animatsiyali yopish — ModalHeader ✕ shundan foydalanadi. */
export const useModalClose = () => useContext(ModalCtx);

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ children, onClose, width = 540 }: { children: React.ReactNode; onClose: () => void; width?: number }) {
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const requestClose = useCallback(() => {
    if (closingRef.current) return; // qayta bosishdan himoya
    closingRef.current = true;
    setClosing(true);
    setTimeout(onClose, 220);
  }, [onClose]);

  // ESC + fokus tuzog'i + body skroll qulfi
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        requestClose();
        return;
      }
      if (e.key === "Tab" && cardRef.current) {
        const items = Array.from(cardRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (!active || !cardRef.current.contains(active)) {
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
    // dastlabki fokus — modal ichiga (autoFocus'li input bo'lsa, u g'olib)
    const t = setTimeout(() => {
      if (cardRef.current && !cardRef.current.contains(document.activeElement)) {
        cardRef.current.querySelector<HTMLElement>(FOCUSABLE)?.focus();
      }
    }, 60);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      clearTimeout(t);
    };
  }, [requestClose]);

  return (
    <ModalCtx.Provider value={requestClose}>
      <motion.div
        onClick={requestClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: closing ? 0 : 1 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        className="fixed inset-0 z-[85] flex items-center justify-center overflow-y-auto p-5"
        style={{ background: "rgba(24, 17, 12, .4)", backdropFilter: "blur(10px) saturate(1.15)" }}
        role="dialog"
        aria-modal="true"
        data-lenis-prevent
      >
        <motion.div
          ref={cardRef}
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={closing ? { opacity: 0, scale: 0.97 } : { opacity: 1, scale: 1 }}
          transition={{ duration: closing ? 0.2 : 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="glass-modal m-auto flex max-h-[85vh] flex-col overflow-hidden"
          style={{ width: `min(${width}px, 100%)` }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6" data-lenis-prevent>
            {children}
          </div>
        </motion.div>
      </motion.div>
    </ModalCtx.Provider>
  );
}

export const ModalHeader = ({ icon, title, sub, onClose }: { icon: React.ReactNode; title: string; sub: string; onClose: () => void }) => {
  const ctxClose = useModalClose();
  const close = ctxClose ?? onClose;
  return (
    <div
      className="sticky top-0 z-10 -mx-6 mb-1 flex items-center gap-3 border-b px-6 pb-4 pt-5"
      style={{ background: "var(--surface-solid)", borderColor: "var(--border)" }}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-white" style={{ background: "var(--primary)" }}>{icon}</div>
      <div className="flex-1">
        <div className="text-[18px] font-semibold tracking-tight">{title}</div>
        <div className="text-[13px]" style={{ color: "var(--muted)" }}>{sub}</div>
      </div>
      <button
        onClick={close}
        aria-label="Yopish"
        className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-sm transition-colors duration-200 hover:bg-[var(--hover)]"
        style={{ color: "var(--text-2)" }}
      >
        ✕
      </button>
    </div>
  );
};

/** Pastga yopishgan amal tugmalari qatori — barcha modallarda bir xil. */
export const ModalFooter = ({ children }: { children: React.ReactNode }) => (
  <div
    className="sticky bottom-0 z-10 -mx-6 -mb-6 mt-6 flex gap-2.5 border-t px-6 py-4"
    style={{ background: "var(--surface-solid)", borderColor: "var(--border)" }}
  >
    {children}
  </div>
);

export const Section = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-2.5 mt-5 text-[11px] font-semibold uppercase tracking-[2px]" style={{ color: "var(--primary)" }}>{children}</div>
);

export const Field = ({ label, span, children }: { label: string; span?: boolean; children: React.ReactNode }) => (
  <label className={`flex flex-col gap-1.5 text-[11px] font-medium uppercase tracking-wider ${span ? "col-span-full" : ""}`} style={{ color: "var(--text-2)" }}>
    {label}
    {children}
  </label>
);
