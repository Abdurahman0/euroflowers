"use client";
import { Clock, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import Popover from "./Popover";

/**
 * Qo'lda yasalgan VAQT tanlagich — native <input type="time"> o'rniga hamma
 * joyda shu ishlatiladi. Ikki "baraban" ustuni (Soat 00-23, Daqiqa 00-55/5),
 * tanlangan qiymat markazda rose pill'da, qo'shnilar so'nadi. Tez chiplar,
 * "Hozir" va tozalash. Desktopda Popover (body portal), <768px da pastki varaq.
 * Tanlanganda darhol qo'llaniladi (OK tugmasi yo'q). Barcha ranglar tokenlarda.
 */

const pad = (n: number) => String(n).padStart(2, "0");
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
const buzz = () => { try { (navigator as Navigator & { vibrate?: (n: number) => void }).vibrate?.(8); } catch { /* noop */ } };

function Drum({
  items, value, onPick, label, big,
}: { items: number[]; value: number; onPick: (v: number) => void; label: string; big: boolean }) {
  const boxRef = useRef<HTMLDivElement>(null);
  // ochilganda / qiymat o'zgarganda tanlangan qiymatni markazga suradi
  useEffect(() => {
    boxRef.current?.querySelector<HTMLButtonElement>(`[data-v="${value}"]`)?.scrollIntoView({ block: "center" });
  }, [value]);
  const onKey = (e: React.KeyboardEvent, v: number) => {
    const idx = items.indexOf(v);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = items[Math.min(Math.max(idx + (e.key === "ArrowDown" ? 1 : -1), 0), items.length - 1)];
      onPick(next); buzz();
    }
  };
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="pb-1.5 text-center text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{label}</span>
      <div className="relative">
        {/* markaziy tanlov chizig'i */}
        <div className="pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 rounded-[10px]" style={{ height: big ? 40 : 34, background: "var(--hover)" }} />
        <div
          ref={boxRef}
          data-lenis-prevent
          role="listbox"
          aria-label={label}
          className="relative flex flex-col items-stretch gap-0.5 overflow-y-auto overscroll-contain rounded-[12px] border px-1"
          style={{
            height: big ? 200 : 168,
            borderColor: "var(--border)",
            background: "var(--surface-2)",
            scrollSnapType: "y mandatory",
            // baraban his: chetlar so'nadi
            maskImage: "linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent, #000 22%, #000 78%, transparent)",
          }}
        >
          {/* markazlashishi uchun tepa/past bo'shliq */}
          <span aria-hidden className="shrink-0" style={{ height: big ? 80 : 67 }} />
          {items.map((v) => {
            const sel = v === value;
            return (
              <button
                key={v}
                type="button"
                data-v={v}
                role="option"
                aria-selected={sel}
                onClick={() => { onPick(v); buzz(); }}
                onKeyDown={(e) => onKey(e, v)}
                className={clsx(
                  "shrink-0 rounded-[9px] text-center font-bold transition-all duration-150 active:scale-90",
                  big ? "py-2 text-[17px]" : "py-1.5 text-[14px]",
                  sel ? "text-white" : "hover:bg-[var(--hover)]"
                )}
                style={{
                  scrollSnapAlign: "center",
                  ...(sel
                    ? { background: "linear-gradient(135deg, var(--primary), var(--primary-strong, var(--acc)))", boxShadow: "0 2px 8px color-mix(in srgb, var(--primary) 35%, transparent)" }
                    : { color: "var(--text-2)" }),
                }}
              >
                {pad(v)}
              </button>
            );
          })}
          <span aria-hidden className="shrink-0" style={{ height: big ? 80 : 67 }} />
        </div>
      </div>
    </div>
  );
}

function Panel({
  hour, minute, setHM, quick, onClear, big, onDone,
}: {
  hour: number; minute: number; setHM: (h: number, m: number) => void;
  quick: string[]; onClear: () => void; big: boolean; onDone: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Drum items={HOURS} value={hour} onPick={(h) => setHM(h, minute)} label="Soat" big={big} />
        <span className="self-center text-[20px] font-black" style={{ color: "var(--muted)" }}>:</span>
        <Drum items={MINUTES} value={minute} onPick={(m) => setHM(hour, m)} label="Daqiqa" big={big} />
      </div>
      {quick.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {quick.map((q) => {
            const [h, m] = q.split(":").map(Number);
            const active = h === hour && m === minute;
            return (
              <button
                key={q}
                type="button"
                onClick={() => { setHM(h, m); buzz(); onDone(); }}
                className="rounded-full border px-3 py-1 text-[12px] font-bold transition-colors duration-150"
                style={active
                  ? { background: "var(--primary)", borderColor: "var(--primary)", color: "#fff" }
                  : { borderColor: "var(--border)", color: "var(--text-2)" }}
              >
                {q}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex items-center justify-between border-t pt-2.5" style={{ borderColor: "var(--line2)" }}>
        <button
          type="button"
          onClick={() => { const d = new Date(); setHM(d.getHours(), Math.round(d.getMinutes() / 5) * 5 % 60); buzz(); onDone(); }}
          className="chip !h-8 px-3 !text-[12px]"
        >
          Hozir
        </button>
        <button type="button" onClick={onClear} className="chip !h-8 px-3 !text-[12px]" style={{ color: "var(--danger-ink)" }}>
          Tozalash
        </button>
      </div>
    </div>
  );
}

export default function TimePicker({
  value,
  onChange,
  placeholder = "Vaqt tanlang",
  ariaLabel,
  quickTimes = ["09:00", "12:00", "18:00"],
}: {
  /** "HH:MM" | "" (yoki "HH:MM:SS" — sekundlar tashlanadi) */
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  quickTimes?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const hh = value ? parseInt(value.slice(0, 2), 10) : 9;
  const mmRaw = value ? parseInt(value.slice(3, 5), 10) : 0;
  const hour = Number.isNaN(hh) ? 9 : hh;
  const minute = Number.isNaN(mmRaw) ? 0 : Math.round(mmRaw / 5) * 5 % 60;

  const setHM = (h: number, m: number) => onChange(`${pad(h)}:${pad(m)}`);
  const clear = () => { onChange(""); setOpen(false); };
  const display = value ? `${pad(hour)}:${pad(minute)}` : placeholder;

  const trigger = (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-label={ariaLabel ?? placeholder}
      aria-expanded={open}
      className="inp flex items-center gap-2 text-left normal-case tracking-normal"
    >
      <Clock size={15} strokeWidth={1.75} className="shrink-0" style={{ color: "var(--muted)" }} />
      <span className={clsx("min-w-0 flex-1 truncate text-[13px] font-semibold", !value && "opacity-50 font-normal")}>{display}</span>
    </button>
  );

  return (
    <div ref={rootRef} className="relative">
      {trigger}

      {/* DESKTOP — anchored popover */}
      {!mobile && (
        <Popover
          anchor={rootRef}
          open={open}
          onClose={() => setOpen(false)}
          width={264}
          ariaLabel="Vaqt tanlash"
          className="rounded-[16px] border p-3"
          style={{ background: "var(--surface-solid)", borderColor: "var(--border)", boxShadow: "var(--shadow-md, 0 12px 40px rgba(0,0,0,.18))" }}
        >
          <Panel hour={hour} minute={minute} setHM={setHM} quick={quickTimes} onClear={clear} big={false} onDone={() => setOpen(false)} />
        </Popover>
      )}

      {/* MOBILE — pastki varaq */}
      {mobile && open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[96] flex items-end" role="dialog" aria-label="Vaqt tanlash">
          <button aria-label="Yopish" onClick={() => setOpen(false)} className="absolute inset-0" style={{ background: "color-mix(in srgb, #000 45%, transparent)", backdropFilter: "blur(2px)" }} />
          <div
            data-lenis-prevent
            className="relative w-full rounded-t-[22px] border-t p-4 pb-6"
            style={{ background: "var(--surface-solid)", borderColor: "var(--border)", boxShadow: "0 -12px 40px rgba(0,0,0,.25)" }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: "var(--border-strong, var(--border))" }} />
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[14px] font-bold">Vaqtni tanlang</span>
              <button type="button" onClick={() => setOpen(false)} className="icon-btn !h-8 !w-8" aria-label="Yopish"><X size={16} strokeWidth={2} /></button>
            </div>
            <Panel hour={hour} minute={minute} setHM={setHM} quick={quickTimes} onClear={clear} big onDone={() => setOpen(false)} />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
