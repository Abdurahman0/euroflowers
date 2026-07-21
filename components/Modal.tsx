"use client";
import { X } from "lucide-react";
import Drawer, { useDrawerClose } from "./Drawer";

/**
 * Modal — o'ng tomondan chiquvchi Drawer'ning yupqa o'rami.
 * Barcha mavjud iste'molchilar (forma va batafsil dialoglar) API'ni
 * o'zgartirmasdan slide-over bo'lib ochiladi:
 *   • ModalHeader — qadalgan sarlavha (sticky top)
 *   • ModalFooter — qadalgan amal tugmalari (sticky bottom, amallar O'NGDA)
 *   • Section/Field — forma bloklari, mavzu tokenlarida
 * DIZAYN QOIDALARI (UI/UX): yorliqlar normal-case (katta-harf siqilishi yo'q),
 * bo'lim sarlavhalari aksent chiziqcha bilan, asosiy tugma o'ng tomonda.
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
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]"
        style={{ background: "var(--primary-soft)", color: "var(--primary)" }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[17px] font-semibold leading-tight tracking-tight">{title}</div>
        <div className="mt-0.5 truncate text-[12.5px]" style={{ color: "var(--muted)" }}>{sub}</div>
      </div>
      <button
        onClick={close}
        aria-label="Yopish"
        className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-sm transition-colors duration-200 hover:bg-[var(--hover)]"
        style={{ color: "var(--text-2)" }}
      >
        <X size={18} strokeWidth={1.75} />
      </button>
    </div>
  );
};

/** Amal tugmalari — QADALMAGAN: kontentdan keyin oddiy oqimda turadi
    (foydalanuvchi talabi). Asosiy tugma o'ngda. */
export const ModalFooter = ({ children }: { children: React.ReactNode }) => (
  <div
    className="mt-6 flex justify-end gap-2.5 border-t pt-4 max-sm:[&>*]:flex-1"
    style={{ borderColor: "var(--border)" }}
  >
    {children}
  </div>
);

export const Section = ({ children }: { children: React.ReactNode }) => (
  <div className="mb-2.5 mt-6 flex items-center gap-2 first:mt-1">
    <span className="h-[14px] w-[3px] shrink-0 rounded-full" style={{ background: "var(--primary)" }} aria-hidden />
    <span className="text-[13px] font-bold tracking-tight">{children}</span>
  </div>
);

export const Field = ({ label, span, children }: { label: string; span?: boolean; children: React.ReactNode }) => (
  <label className={`flex flex-col gap-1.5 text-[12px] font-semibold ${span ? "col-span-full" : ""}`} style={{ color: "var(--text-2)" }}>
    {label}
    {children}
  </label>
);
