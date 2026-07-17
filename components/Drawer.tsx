"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

/**
 * Umumiy yon panel (drawer) — batafsil ko'rinishlar uchun:
 *   • o'ngdan silliq suzib chiqadi, yopilishda ham animatsiya
 *   • backdrop bosish va ESC yopadi, ikki marta yopishdan himoya
 *   • body skroll qulflanadi, ichki kontent mustaqil skroll bo'ladi
 *   • Lenis'dan himoyalangan (data-lenis-prevent)
 */
export default function Drawer({
  children,
  onClose,
  width = 520,
  title,
  sub,
  badges,
}: {
  children: React.ReactNode;
  onClose: () => void;
  width?: number;
  title: string;
  sub?: string;
  badges?: React.ReactNode;
}) {
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);

  const requestClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    setTimeout(onClose, 240);
  }, [onClose]);

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
    <motion.div
      onClick={requestClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: closing ? 0 : 1 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      className="fixed inset-0 z-[85] flex justify-end"
      style={{ background: "rgba(24, 17, 12, .35)", backdropFilter: "blur(8px) saturate(1.1)" }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-lenis-prevent
    >
      <motion.aside
        onClick={(e) => e.stopPropagation()}
        initial={{ x: 60, opacity: 0 }}
        animate={closing ? { x: 40, opacity: 0 } : { x: 0, opacity: 1 }}
        transition={{ duration: closing ? 0.22 : 0.38, ease: [0.22, 1, 0.36, 1] }}
        className="glass-modal m-3 flex max-h-[calc(100dvh-24px)] flex-col !rounded-[20px]"
        style={{ width: `min(${width}px, calc(100vw - 24px))` }}
      >
        {/* sarlavha — sticky */}
        <div className="flex items-start gap-3 border-b border-[color:var(--border)] p-5 pb-4">
          <div className="min-w-0 flex-1">
            <div className="text-[18px] font-semibold leading-tight tracking-tight">{title}</div>
            {sub && <div className="mt-0.5 text-[13px] text-[color:var(--muted)]">{sub}</div>}
            {badges && <div className="mt-2 flex flex-wrap items-center gap-1.5">{badges}</div>}
          </div>
          <button
            onClick={requestClose}
            aria-label="Yopish"
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[color:var(--hover)] text-sm text-[color:var(--text-2)] transition-colors duration-200 hover:bg-[color:var(--hover)] hover:text-[color:var(--text)]"
          >
            ✕
          </button>
        </div>
        {/* kontent — mustaqil skroll */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">{children}</div>
      </motion.aside>
    </motion.div>
  );
}
