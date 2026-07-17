"use client";
import { X } from "lucide-react";
import Drawer, { useDrawerClose } from "./Drawer";

/**
 * Modal — endi o'ng tomondan chiquvchi Drawer'ning yupqa o'rami.
 * Barcha mavjud iste'molchilar (forma va batafsil dialoglar) API'ni
 * o'zgartirmasdan slide-over bo'lib ochiladi:
 *   • ModalHeader — qadalgan sarlavha (sticky top)
 *   • ModalFooter — qadalgan amal tugmalari (sticky bottom)
 *   • Section/Field — forma bloklari, mavzu tokenlarida
 * Standart kenglik 480 (formalar); batafsil ko'rinishlar 560 uzatadi.
 */

export const useModalClose = useDrawerClose;

export default function Modal({ children, onClose, width = 480 }: { children: React.ReactNode; onClose: () => void; width?: number }) {
  return (
    <Drawer onClose={onClose} width={width}>
      {children}
    </Drawer>
  );
}

export const ModalHeader = ({ icon, title, sub, onClose }: { icon: React.ReactNode; title: string; sub: string; onClose: () => void }) => {
  const ctxClose = useDrawerClose();
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
        <X size={18} strokeWidth={1.75} />
      </button>
    </div>
  );
};

/** Pastga yopishgan amal tugmalari qatori — barcha formalarda bir xil. */
export const ModalFooter = ({ children }: { children: React.ReactNode }) => (
  <div
    className="sticky bottom-0 z-10 -mx-6 -mb-6 mt-auto flex gap-2.5 border-t px-6 py-4 pt-4 [margin-top:auto]"
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
