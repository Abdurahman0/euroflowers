"use client";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useRef, useState } from "react";
import clsx from "clsx";
import Popover from "./Popover";

/**
 * Qo'lda yasalgan sana (va ixtiyoriy vaqt) tanlagich — native type="date"
 * o'rniga hamma joyda shu ishlatiladi. Kalendar Popover orqali body'ga portal
 * qilinadi — drawer ichida ham kesilmaydi, joy yetmasa tepada ochiladi.
 *   • withTime: kalendar ostida soat/daqiqa ustunlari; qiymat "YYYY-MM-DDTHH:mm"
 *   • disablePast: yetkazish kabi kelajak sanalar uchun o'tmish yopiladi
 */

const MONTHS_S = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
const MONTHS_F = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
const WEEKDAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
const pad = (n: number) => String(n).padStart(2, "0");

const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtTrigger = (s: string, withTime: boolean) => {
  const d = new Date(withTime ? s : s + "T00:00:00");
  if (Number.isNaN(d.getTime())) return s;
  const date = `${d.getDate()}-${MONTHS_S[d.getMonth()]} ${d.getFullYear()}`;
  return withTime ? `${date}, ${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

function TimeCol({ items, value, onPick, label }: { items: number[]; value: number; onPick: (v: number) => void; label: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="pb-1 text-center text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>{label}</span>
      <div
        data-lenis-prevent
        ref={(el) => {
          // ochilganda tanlangan qiymat ko'rinadigan joyga suriladi
          el?.querySelector<HTMLButtonElement>(`[data-v="${value}"]`)?.scrollIntoView({ block: "center" });
        }}
        className="flex max-h-[132px] flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-[10px] border p-1"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
      >
        {items.map((v) => (
          <button
            key={v}
            type="button"
            data-v={v}
            onClick={() => onPick(v)}
            className={clsx("shrink-0 rounded-[7px] py-1 text-center text-[12.5px] font-semibold transition-colors duration-150", v === value ? "text-white" : "hover:bg-[var(--hover)]")}
            style={v === value ? { background: "linear-gradient(135deg, var(--primary), var(--primary-strong))" } : { color: "var(--text-2)" }}
          >
            {pad(v)}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function DatePicker({
  value,
  onChange,
  placeholder = "Sana tanlang",
  disablePast = false,
  withTime = false,
  ariaLabel,
}: {
  /** withTime: "YYYY-MM-DDTHH:mm" | ""; aks holda "YYYY-MM-DD" | "" */
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disablePast?: boolean;
  withTime?: boolean;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const todayS = ymd(new Date());
  const parsed = value ? new Date(withTime ? value : value + "T00:00:00") : null;
  const valid = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;

  const [cursor, setCursor] = useState(() => {
    const d = valid ? new Date(valid) : new Date();
    d.setDate(1);
    return d;
  });
  // vaqtli rejimda kun/soat/daqiqa alohida yig'iladi
  const [day, setDay] = useState<string>(valid ? ymd(valid) : "");
  const [hour, setHour] = useState<number>(valid ? valid.getHours() : 18);
  const [minute, setMinute] = useState<number>(valid ? valid.getMinutes() - (valid.getMinutes() % 5) : 0);

  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const firstOffset = (new Date(y, m, 1).getDay() + 6) % 7; // Dushanba = 0
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const emit = (d: string, h: number, min: number) => onChange(`${d}T${pad(h)}:${pad(min)}`);

  const pickDay = (dstr: string) => {
    if (withTime) {
      setDay(dstr);
      emit(dstr, hour, minute);
    } else {
      onChange(dstr);
      setOpen(false);
    }
  };

  const selDay = withTime ? day : value;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel ?? placeholder}
        aria-expanded={open}
        className="inp flex items-center gap-2 text-left normal-case tracking-normal"
      >
        {withTime ? (
          <Clock size={15} strokeWidth={1.75} className="shrink-0" style={{ color: "var(--muted)" }} />
        ) : (
          <CalendarDays size={15} strokeWidth={1.75} className="shrink-0" style={{ color: "var(--muted)" }} />
        )}
        <span className={clsx("min-w-0 flex-1 truncate text-[13px] font-semibold", !value && "opacity-50 font-normal")}>
          {value ? fmtTrigger(value, withTime) : placeholder}
        </span>
      </button>
      <Popover
        anchor={rootRef}
        open={open}
        onClose={() => setOpen(false)}
        width={withTime ? 336 : 272}
        ariaLabel="Sana tanlash"
        className="rounded-[16px] border p-3 shadow-lg"
        style={{ background: "var(--surface-solid)", borderColor: "var(--border)", boxShadow: "var(--shadow-md)" }}
      >
        <div className={withTime ? "flex gap-3" : undefined}>
          <div className={withTime ? "w-[212px] shrink-0" : undefined}>
            <div className="mb-2 flex items-center justify-between">
              <button type="button" onClick={() => setCursor(new Date(y, m - 1, 1))} className="icon-btn !h-8 !w-8" aria-label="Oldingi oy">
                <ChevronLeft size={16} strokeWidth={1.75} />
              </button>
              <span className="text-[13px] font-semibold">{MONTHS_F[m]} {y}</span>
              <button type="button" onClick={() => setCursor(new Date(y, m + 1, 1))} className="icon-btn !h-8 !w-8" aria-label="Keyingi oy">
                <ChevronRight size={16} strokeWidth={1.75} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-y-0.5 text-center">
              {WEEKDAYS.map((w) => (
                <span key={w} className="pb-1 text-[10.5px] font-semibold uppercase" style={{ color: "var(--muted)" }}>{w}</span>
              ))}
              {Array.from({ length: firstOffset }).map((_, i) => <span key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const dstr = ymd(new Date(y, m, i + 1));
                const disabled = disablePast && dstr < todayS;
                const sel = dstr === selDay;
                return (
                  <button
                    key={dstr}
                    type="button"
                    disabled={disabled}
                    onClick={() => pickDay(dstr)}
                    className={clsx(
                      "mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[12.5px] font-medium transition-colors duration-150",
                      disabled ? "cursor-not-allowed opacity-30" : "hover:bg-[var(--hover)]",
                      sel && "text-white"
                    )}
                    style={sel ? { background: "linear-gradient(135deg, var(--primary), var(--primary-strong))" } : dstr === todayS ? { boxShadow: "inset 0 0 0 1.5px var(--primary)" } : undefined}
                    aria-pressed={sel}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>
          {withTime && (
            <div className="flex min-w-0 flex-1 gap-1.5">
              <TimeCol items={HOURS} value={hour} onPick={(h) => { setHour(h); if (day) emit(day, h, minute); }} label="Soat" />
              <TimeCol items={MINUTES} value={minute} onPick={(min) => { setMinute(min); if (day) emit(day, hour, min); }} label="Daq" />
            </div>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between border-t pt-2" style={{ borderColor: "var(--line2)" }}>
          <span className="text-[12px] font-medium" style={{ color: "var(--text-2)" }}>
            {withTime ? (day ? `${fmtTrigger(`${day}T${pad(hour)}:${pad(minute)}`, true)}` : "Kun va vaqtni tanlang") : value ? fmtTrigger(value, false) : "Kunni tanlang"}
          </span>
          <span className="flex gap-1.5">
            {value && (
              <button type="button" onClick={() => { onChange(""); setDay(""); setOpen(false); }} className="chip !h-8 px-3 !text-[12px]">
                Tozalash
              </button>
            )}
            {withTime && (
              <button
                type="button"
                disabled={!day}
                onClick={() => setOpen(false)}
                className="chip chip-active !h-8 px-3 !text-[12px] disabled:opacity-50"
              >
                OK
              </button>
            )}
          </span>
        </div>
      </Popover>
    </div>
  );
}
