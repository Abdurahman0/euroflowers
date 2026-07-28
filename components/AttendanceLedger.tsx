"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LogIn, LogOut, MapPin } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import useAutoRefresh from "@/lib/useAutoRefresh";
import FilterSelect from "./FilterSelect";
import ClearFilters from "./ClearFilters";
import DateChips from "./DateChips";
import EmptyState from "./EmptyState";
import { dateAfterParam, fmtDate, fmtTime, initials, rangeParams } from "@/lib/format";
import type { FloristAttendance, FloristProfile } from "@/lib/types";

/**
 * KELDI-KETDI jurnali — florist ishga kelganini belgilaganda adminga
 * bildirishnoma boradi, bildirishnoma esa shu yerga (?attendance=<id>)
 * olib keladi: tegishli qator ajratib ko'rsatiladi.
 */

const hhmm = (iso?: string | null) => (iso ? fmtTime(iso).split("·").pop()!.trim() : "—");

/** Ish davomiyligi — "6 s 20 daq" (hali ketmagan bo'lsa "—") */
const durationOf = (a: FloristAttendance): string => {
  if (!a.check_in_at || !a.check_out_at) return "—";
  const ms = new Date(a.check_out_at).getTime() - new Date(a.check_in_at).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const mins = Math.round(ms / 60000);
  return `${Math.floor(mins / 60)} s ${String(mins % 60).padStart(2, "0")} daq`;
};

export default function AttendanceLedger() {
  const { showToast, dateFilter, dateRange, setDateFilter } = useStore();
  const [rows, setRows] = useState<FloristAttendance[] | null>(null);
  const [florists, setFlorists] = useState<FloristProfile[]>([]);
  const [floristId, setFloristId] = useState("");
  // bildirishnomadan kelgan yozuv — ajratib ko'rsatiladi va ko'rinishga suriladi
  const [focusId, setFocusId] = useState<number | null>(null);
  const focusRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = Number(new URLSearchParams(window.location.search).get("attendance"));
    if (id) setFocusId(id);
  }, []);

  const load = useCallback(() => {
    api.attendance({
      ordering: "-check_in_at",
      florist: floristId || undefined,
      ...(dateRange ? rangeParams(dateRange) : { created_at_after: dateAfterParam(dateFilter) }),
    })
      .then(setRows)
      .catch((e) => showToast(e instanceof Error ? e.message : "Yuklashda xatolik"));
  }, [showToast, floristId, dateFilter, dateRange]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);
  useEffect(() => { api.florists({ ordering: "user" }).then(setFlorists).catch(() => {}); }, []);

  useEffect(() => {
    if (focusId && focusRef.current) focusRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusId, rows]);

  const floristName = (fp?: FloristProfile) => {
    const u = fp?.user_detail;
    return u ? [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username : `Florist #${fp?.id ?? "?"}`;
  };

  // kunlar bo'yicha guruh — eng yangi kun tepada
  const grouped = useMemo(() => {
    const g = new Map<string, FloristAttendance[]>();
    (rows ?? []).forEach((r) => {
      const d = r.work_date || (r.check_in_at ?? r.created_at ?? "").slice(0, 10);
      (g.get(d) ?? g.set(d, []).get(d)!).push(r);
    });
    return Array.from(g.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [rows]);

  const todayIn = (rows ?? []).filter((r) => r.check_in_at && !r.check_out_at).length;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="note-chip text-[14px]" style={{ color: "var(--mut)" }}>
          Keldi-ketdi{todayIn > 0 ? ` — hozir ishda ${todayIn} kishi` : ""}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <FilterSelect
            value={floristId}
            options={[{ value: "", label: "Barcha floristlar" }, ...florists.map((fp) => ({ value: String(fp.id), label: floristName(fp) }))]}
            onChange={setFloristId}
            label="Florist"
          />
          <DateChips />
          <ClearFilters show={!!(floristId || dateRange || dateFilter !== "oy")} onClear={() => { setFloristId(""); setDateFilter("oy"); }} />
        </div>
      </div>

      {rows === null && <p className="py-6 text-center text-[13px]" style={{ color: "var(--muted)" }}>Yuklanmoqda…</p>}
      {rows?.length === 0 && <EmptyState title="Yozuv yo'q" sub="Tanlangan davrda keldi-ketdi yozuvi topilmadi." />}

      <div className="flex flex-col gap-4">
        {grouped.map(([date, items]) => (
          <section key={date} className="glass !rounded-[18px] p-4">
            <div className="mb-2 text-[13px] font-bold" style={{ color: "var(--text-2)" }}>{fmtDate(date)}</div>
            {items.map((r) => {
              const active = r.check_in_at && !r.check_out_at;
              const focused = focusId === r.id;
              return (
                <div
                  key={r.id}
                  ref={focused ? focusRef : undefined}
                  className={clsx("flex flex-wrap items-center gap-3 border-t py-2.5 first:border-t-0", focused && "rounded-[12px] px-2")}
                  style={{
                    borderColor: "var(--line2)",
                    background: focused ? "color-mix(in srgb, var(--primary) 10%, transparent)" : undefined,
                    boxShadow: focused ? "inset 0 0 0 1.5px var(--primary)" : undefined,
                  }}
                >
                  <span className="avatar-lead flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[11px] font-bold">
                    {initials(floristName(r.florist_detail))}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold" title={floristName(r.florist_detail)}>
                    {floristName(r.florist_detail)}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11.5px] font-bold" style={{ background: "var(--success-soft)", color: "var(--success-ink)" }}>
                    <LogIn size={11} strokeWidth={2.4} /> {hhmm(r.check_in_at)}
                  </span>
                  <span
                    className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11.5px] font-bold"
                    style={active ? { background: "var(--surface-2)", color: "var(--muted)" } : { background: "var(--warning-soft)", color: "var(--warning-ink)" }}
                  >
                    <LogOut size={11} strokeWidth={2.4} /> {hhmm(r.check_out_at)}
                  </span>
                  <span className="hidden w-[92px] shrink-0 text-right text-[12px] tabular-nums sm:block" style={{ color: "var(--muted)" }}>
                    {active ? "ishda" : durationOf(r)}
                  </span>
                  {r.check_in_latitude && (
                    <a
                      href={`https://maps.google.com/?q=${r.check_in_latitude},${r.check_in_longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Kelgan joyi"
                      aria-label="Kelgan joyini xaritada ochish"
                      className="icon-btn !h-7 !w-7 shrink-0"
                    >
                      <MapPin size={13} strokeWidth={1.9} />
                    </a>
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </>
  );
}
