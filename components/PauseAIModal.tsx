"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Clock, Infinity as InfinityIcon, MoonStar } from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Section } from "./Modal";
import type { Conversation } from "@/lib/types";

/**
 * AI'ni pauza qilish — qo'lda yasalgan kalendar va soat tanlagichlar bilan.
 *   • tez presetlar (30 daqiqa … ertagacha) va ∞ doimiy
 *   • "Aniq sana va vaqt": custom oy kalendari + soat/daqiqa ustunlari
 * Backend: POST /conversations/{id}/pause_ai/ {minutes | paused_until}
 */

type Preset = { key: string; label: string; sub?: string; minutes?: number; forever?: boolean };

const PRESETS: Preset[] = [
  { key: "30m", label: "30 daqiqa", minutes: 30 },
  { key: "1h", label: "1 soat", minutes: 60 },
  { key: "3h", label: "3 soat", minutes: 180 },
  { key: "eod", label: "Kun oxirigacha", sub: "23:59" },
  { key: "tom", label: "Ertagacha", sub: "09:00" },
  { key: "inf", label: "Doimiy", sub: "operator qaytarguncha", forever: true },
];

const MONTHS = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
const WEEKDAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];
const pad = (n: number) => String(n).padStart(2, "0");
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/* ================= Qo'lda yasalgan KALENDAR ================= */
function CalendarPicker({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const [view, setView] = useState(() => new Date(value.getFullYear(), value.getMonth(), 1));

  // oy katagi: Dushanba'dan boshlanadigan 6×7 to'r
  const cells = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const startOffset = (first.getDay() + 6) % 7; // Du=0
    const start = new Date(first);
    start.setDate(1 - startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [view]);

  const prevDisabled = view.getFullYear() === today.getFullYear() && view.getMonth() === today.getMonth();

  return (
    <div className="rounded-[16px] border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
      {/* sarlavha: oy + navigatsiya */}
      <div className="mb-2 flex items-center justify-between px-1">
        <button
          type="button"
          disabled={prevDisabled}
          onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}
          className="flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-150 hover:bg-[var(--hover)] disabled:opacity-25"
          style={{ color: "var(--text-2)" }}
          aria-label="Oldingi oy"
        >
          <ChevronLeft size={16} strokeWidth={2} />
        </button>
        <span className="text-[13.5px] font-bold">{MONTHS[view.getMonth()]} {view.getFullYear()}</span>
        <button
          type="button"
          onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}
          className="flex h-7 w-7 items-center justify-center rounded-full transition-colors duration-150 hover:bg-[var(--hover)]"
          style={{ color: "var(--text-2)" }}
          aria-label="Keyingi oy"
        >
          <ChevronRight size={16} strokeWidth={2} />
        </button>
      </div>
      {/* hafta kunlari */}
      <div className="grid grid-cols-7 gap-0.5 px-0.5 pb-1">
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-1 text-center text-[10.5px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>{w}</span>
        ))}
      </div>
      {/* kunlar */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === view.getMonth();
          const past = d < today;
          const selected = sameDay(d, value);
          const isToday = sameDay(d, today);
          return (
            <button
              key={i}
              type="button"
              disabled={past}
              onClick={() => onChange(d)}
              className={clsx(
                "relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[12.5px] font-semibold transition-all duration-150",
                past && "cursor-not-allowed opacity-25",
                !past && !selected && "hover:bg-[var(--hover)]",
                selected && "text-white shadow-md"
              )}
              style={selected ? { background: "linear-gradient(135deg, var(--acc), var(--accL))" } : { color: past || inMonth ? "var(--text)" : "var(--muted)" }}
            >
              {d.getDate()}
              {isToday && !selected && <span className="absolute bottom-0.5 h-1 w-1 rounded-full" style={{ background: "var(--primary)" }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ================= Qo'lda yasalgan SOAT tanlagich ================= */
function TimeColumn({
  items,
  value,
  onPick,
  label,
}: {
  items: number[];
  value: number;
  onPick: (v: number) => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // ochilganda tanlangan qiymat markazga suriladi
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLButtonElement>(`[data-v="${value}"]`);
    el?.scrollIntoView({ block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="pb-1.5 text-center text-[10.5px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>{label}</span>
      <div ref={ref} data-lenis-prevent className="flex max-h-[168px] flex-col gap-1 overflow-y-auto overscroll-contain rounded-[12px] border p-1.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
        {items.map((v) => (
          <button
            key={v}
            type="button"
            data-v={v}
            onClick={() => onPick(v)}
            className={clsx(
              "shrink-0 rounded-[9px] py-1.5 text-center text-[13px] font-bold transition-all duration-150",
              v === value ? "text-white shadow" : "hover:bg-[var(--hover)]"
            )}
            style={v === value ? { background: "linear-gradient(135deg, var(--acc), var(--accL))" } : { color: "var(--text-2)" }}
          >
            {pad(v)}
          </button>
        ))}
      </div>
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

/* ================= Modal ================= */
export default function PauseAIModal({
  conv,
  onClose,
  onPaused,
}: {
  conv: Conversation;
  onClose: () => void;
  onPaused: (c: Conversation) => void;
}) {
  const showToast = useStore((s) => s.showToast);
  const [mode, setMode] = useState<string>("1h");
  const [busy, setBusy] = useState(false);

  // custom tanlov: standart — bir soat keyin, 5 daqiqaga yaxlitlangan
  const init = useMemo(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
    return d;
  }, []);
  const [day, setDay] = useState<Date>(() => { const d = new Date(init); d.setHours(0, 0, 0, 0); return d; });
  const [hour, setHour] = useState(init.getHours());
  const [minute, setMinute] = useState(init.getMinutes() % 60);

  const buildPayload = (): { minutes?: number; paused_until?: string } | null => {
    if (mode === "custom") {
      const d = new Date(day);
      d.setHours(hour, minute, 0, 0);
      if (d.getTime() <= Date.now()) return null;
      return { paused_until: d.toISOString() };
    }
    const p = PRESETS.find((x) => x.key === mode);
    if (!p) return null;
    if (p.forever) return {};
    if (p.minutes) return { minutes: p.minutes };
    const d = new Date();
    if (p.key === "eod") d.setHours(23, 59, 0, 0);
    else { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); }
    return { paused_until: d.toISOString() };
  };

  const payload = buildPayload();
  const untilPreview = useMemo(() => {
    if (!payload) return null;
    if (payload.minutes) return new Date(Date.now() + payload.minutes * 60000);
    if (payload.paused_until) return new Date(payload.paused_until);
    return null;
  }, [payload]);

  const save = async () => {
    if (!payload) return showToast("Kelajakdagi sana/vaqtni tanlang");
    setBusy(true);
    try {
      const upd = await api.pauseAi(conv.id, payload);
      showToast(
        untilPreview
          ? `⏸ AI pauzada — ${pad(untilPreview.getDate())}.${pad(untilPreview.getMonth() + 1)} ${pad(untilPreview.getHours())}:${pad(untilPreview.getMinutes())} gacha`
          : "⏸ AI doimiy pauzada"
      );
      onPaused(upd);
    } catch (e) {
      showToast(e instanceof ApiError ? `Amalga oshmadi: ${JSON.stringify(e.body)}` : "Amalga oshmadi");
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={520}>
      <ModalHeader
        icon={<MoonStar size={18} strokeWidth={1.75} />}
        title="AI'ni pauza qilish"
        sub={`${conv.customer_detail?.name || "@" + (conv.customer_detail?.instagram_username ?? "")} suhbatida AI javob bermaydi`}
        onClose={onClose}
      />

      <Section>Qancha vaqtga?</Section>
      <div className="grid grid-cols-3 gap-2">
        {PRESETS.map((p) => {
          const active = mode === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setMode(p.key)}
              className={clsx(
                "flex flex-col items-center gap-0.5 rounded-[14px] border px-2 py-3 text-center transition-all duration-200",
                active ? "scale-[1.02] border-transparent text-white shadow-lg" : "hover:bg-[var(--hover)]"
              )}
              style={
                active
                  ? { background: "linear-gradient(135deg, var(--acc), var(--accL))" }
                  : { borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-2)" }
              }
            >
              <span className="flex items-center gap-1 text-[13px] font-bold">
                {p.forever && <InfinityIcon size={14} strokeWidth={2} />}
                {p.label}
              </span>
              {p.sub && <span className="text-[10.5px]" style={{ color: active ? "rgba(255,255,255,.85)" : "var(--muted)" }}>{p.sub}</span>}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setMode("custom")}
        className={clsx(
          "mt-2 flex w-full items-center gap-2.5 rounded-[14px] border px-3.5 py-3 text-left transition-all duration-200",
          mode === "custom" ? "border-transparent text-white shadow-lg" : "hover:bg-[var(--hover)]"
        )}
        style={
          mode === "custom"
            ? { background: "linear-gradient(135deg, var(--acc), var(--accL))" }
            : { borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-2)" }
        }
      >
        <CalendarClock size={17} strokeWidth={1.75} />
        <span className="text-[13px] font-bold">Aniq sana va vaqtgacha</span>
        {mode === "custom" && (
          <span className="ml-auto rounded-full bg-white/20 px-2.5 py-0.5 text-[12px] font-bold">
            {pad(day.getDate())}.{pad(day.getMonth() + 1)} · {pad(hour)}:{pad(minute)}
          </span>
        )}
      </button>

      {mode === "custom" && (
        <div className="mt-3 grid grid-cols-[1.5fr_1fr] gap-3 animate-[rowIn_0.2s_ease_both]">
          <CalendarPicker value={day} onChange={setDay} />
          <div className="flex gap-2">
            <TimeColumn items={HOURS} value={hour} onPick={setHour} label="Soat" />
            <TimeColumn items={MINUTES} value={minute} onPick={setMinute} label="Daqiqa" />
          </div>
        </div>
      )}

      {/* jonli xulosa */}
      <div className="mt-4 flex items-center gap-2.5 rounded-[13px] border px-3.5 py-2.5 text-[13px]" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-2)" }}>
        <Clock size={15} strokeWidth={1.75} className="shrink-0 opacity-70" />
        {payload ? (
          untilPreview ? (
            <span>
              AI <b style={{ color: "var(--text)" }}>{pad(untilPreview.getDate())}.{pad(untilPreview.getMonth() + 1)}.{untilPreview.getFullYear()} · {pad(untilPreview.getHours())}:{pad(untilPreview.getMinutes())}</b> gacha javob bermaydi, keyin o&apos;zi qaytadi.
            </span>
          ) : (
            <span>AI <b style={{ color: "var(--text)" }}>doimiy</b> pauzada — «AI&apos;ga qaytarish» bosilguncha.</span>
          )
        ) : (
          <span style={{ color: "var(--muted)" }}>Kelajakdagi sana va vaqtni tanlang.</span>
        )}
      </div>

      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">
          Bekor
        </button>
        <button onClick={save} disabled={busy || !payload} className="btn-primary disabled:opacity-60">
          {busy ? "Saqlanmoqda…" : "Pauza qilish"}
        </button>
      </ModalFooter>
    </Modal>
  );
}
