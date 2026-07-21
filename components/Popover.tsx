"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Yakor elementga bog'langan suzuvchi qatlam (dropdown/kalendar) — body'ga
 * portal qilinadi, shuning uchun drawer/modal'larning overflow skrolli uni
 * HECH QACHON kesib qo'ymaydi (o'lcham muammolarining ildiz yechimi):
 *   • pastda joy yetmasa yakorning USTIDA ochiladi
 *   • gorizontal viewport chetiga siqib moslanadi (8px chekka)
 *   • skroll/resize'da qayta joylashadi; tashqi bosish/ESC yopadi
 *   • ESC capture'da ushlanadi — ochiq popover turib drawer yopilib ketmaydi
 * Select va DatePicker shu qatlamda ishlaydi; yangi anchored komponentlar ham
 * absolute o'rniga SHU komponentni ishlatsin.
 */
export default function Popover({
  anchor,
  open,
  onClose,
  width = "anchor",
  children,
  className,
  style,
  ariaLabel,
}: {
  anchor: React.RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  /** "anchor" — yakor kengligi; son — qat'iy px (viewportga siqiladi) */
  width?: number | "anchor";
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const place = () => {
    const a = anchor.current;
    const el = boxRef.current;
    if (!a || !el) return;
    const r = a.getBoundingClientRect();
    // yakor skroll bilan ko'rinishdan chiqib ketsa — popover maydonidan uzilib
    // "bir o'zi" osilib qolmasin, yopiladi
    if (r.bottom < 0 || r.top > window.innerHeight) {
      onClose();
      return;
    }
    const w = Math.min(width === "anchor" ? r.width : width, window.innerWidth - 16);
    const h = el.offsetHeight;
    const left = Math.min(Math.max(r.left, 8), Math.max(window.innerWidth - w - 8, 8));
    const fitsBelow = r.bottom + 6 + h <= window.innerHeight - 8;
    const top = fitsBelow ? r.bottom + 6 : Math.max(r.top - h - 6, 8);
    // qiymat o'zgarmagan bo'lsa eski obyekt qaytadi — render sikli yuzaga kelmaydi
    setPos((prev) => (prev && prev.top === top && prev.left === left && prev.width === w ? prev : { top, left, width: w }));
  };

  // har renderda qayta o'lchash — kontent (filtr, oy almashishi) balandlikni o'zgartirsa ham to'g'ri turadi
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    if (open) place();
    else setPos(null);
  });

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      if (boxRef.current?.contains(e.target as Node)) return;
      if (anchor.current?.contains(e.target as Node)) return;
      onClose();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // drawer'ning window'dagi ESC ishlovchisiga yetib bormasin
        e.stopPropagation();
        onClose();
      }
    };
    const move = () => place();
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", esc, true);
    window.addEventListener("resize", move);
    window.addEventListener("scroll", move, true);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", esc, true);
      window.removeEventListener("resize", move);
      window.removeEventListener("scroll", move, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={boxRef}
      data-lenis-prevent
      role={ariaLabel ? "dialog" : undefined}
      aria-label={ariaLabel}
      className={className}
      style={{
        position: "fixed",
        zIndex: 95,
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        width: pos?.width,
        visibility: pos ? "visible" : "hidden",
        ...style,
      }}
    >
      {children}
    </div>,
    document.body
  );
}
