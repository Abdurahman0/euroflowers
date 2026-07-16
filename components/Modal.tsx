"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

/**
 * Umumiy modal qobiq — barcha dialoglar bir xil ishlaydi:
 *   • tashqariga bosish yopadi (backdrop)
 *   • ESC yopadi
 *   • silliq ochilish/yopilish animatsiyasi
 *   • yopilayotganda qayta yopish bloklanadi (ikki marta ochilish/yopilish yo'q)
 *   • ochiq payt body skroll qulflanadi, yopilganda tiklanadi
 */

const ModalCtx = createContext<(() => void) | null>(null);
/** Modal ichidan animatsiyali yopish — ModalHeader ✕ shundan foydalanadi. */
export const useModalClose = () => useContext(ModalCtx);

export default function Modal({ children, onClose, width = 540 }: { children: React.ReactNode; onClose: () => void; width?: number }) {
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);

  const requestClose = useCallback(() => {
    if (closingRef.current) return; // qayta bosishdan himoya
    closingRef.current = true;
    setClosing(true);
    setTimeout(onClose, 220);
  }, [onClose]);

  // ESC + body skroll qulfi
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [requestClose]);

  return (
    <ModalCtx.Provider value={requestClose}>
      <motion.div
        onClick={requestClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: closing ? 0 : 1 }}
        transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
        className="fixed inset-0 z-[85] flex items-center justify-center p-5"
        style={{ background: "rgba(24, 17, 12, .4)", backdropFilter: "blur(10px) saturate(1.15)" }}
        role="dialog"
        aria-modal="true"
        data-lenis-prevent
      >
        <motion.div
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, y: 26, scale: 0.96 }}
          animate={closing ? { opacity: 0, y: 12, scale: 0.97 } : { opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: closing ? 0.2 : 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="glass-modal max-h-[90vh] overflow-y-auto overscroll-contain p-6"
          style={{ width: `min(${width}px, 100%)` }}
        >
          {children}
        </motion.div>
      </motion.div>
    </ModalCtx.Provider>
  );
}

export const ModalHeader = ({ icon, title, sub, onClose }: { icon: React.ReactNode; title: string; sub: string; onClose: () => void }) => {
  const ctxClose = useModalClose();
  const close = ctxClose ?? onClose;
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-white" style={{ background: "var(--primary)" }}>{icon}</div>
      <div className="flex-1">
        <div className="font-serif-lux text-[20px]">{title}</div>
        <div className="text-[12.5px] text-white/60">{sub}</div>
      </div>
      <button
        onClick={close}
        aria-label="Yopish"
        className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white/10 text-sm text-white/80 transition-colors duration-200 hover:bg-white/20 hover:text-white"
      >
        ✕
      </button>
    </div>
  );
};

export const Section = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-2.5 mt-5 text-[10.5px] font-extrabold uppercase tracking-[2px]" style={{ color: "var(--accL)" }}>{children}</div>
);

export const Field = ({ label, span, children }: { label: string; span?: boolean; children: React.ReactNode }) => (
  <label className={`flex flex-col gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-white/60 ${span ? "col-span-full" : ""}`}>
    {label}
    {children}
  </label>
);
