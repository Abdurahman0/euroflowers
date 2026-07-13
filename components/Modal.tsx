"use client";
import { motion } from "framer-motion";

/** Umumiy modal qobiq: frosted overlay + liquid glass karta, chuqurlikdan suzib ochiladi. */
export default function Modal({ children, onClose, width = 540 }: { children: React.ReactNode; onClose: () => void; width?: number }) {
  return (
    <motion.div
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 z-[85] flex items-center justify-center p-5"
      style={{ background: "rgba(30, 20, 14, .32)", backdropFilter: "blur(12px) saturate(1.2)" }}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 34, scale: 0.94, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="glass-modal max-h-[90vh] overflow-auto p-6"
        style={{ width: `min(${width}px, 100%)` }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export const ModalHeader = ({ icon, title, sub, onClose }: { icon: React.ReactNode; title: string; sub: string; onClose: () => void }) => (
  <div className="flex items-center gap-3">
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-white" style={{ background: "linear-gradient(135deg,var(--acc),var(--accL))" }}>{icon}</div>
    <div className="flex-1">
      <div className="font-serif-lux text-[20px]">{title}</div>
      <div className="text-[12.5px] text-white/60">{sub}</div>
    </div>
    <button onClick={onClose} className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-white/10 text-sm transition-all duration-300 hover:rotate-90 hover:bg-white/25">✕</button>
  </div>
);

export const Section = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-2.5 mt-5 text-[10.5px] font-extrabold uppercase tracking-[2px]" style={{ color: "var(--accL)" }}>{children}</div>
);

export const Field = ({ label, span, children }: { label: string; span?: boolean; children: React.ReactNode }) => (
  <label className={`flex flex-col gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-white/60 ${span ? "col-span-full" : ""}`}>
    {label}
    {children}
  </label>
);
