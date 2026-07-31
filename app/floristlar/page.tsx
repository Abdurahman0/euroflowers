"use client";
import { useCallback, useEffect, useState } from "react";
import { Clock, Download, Pencil, Plus, Scissors, Trash2, User } from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { usePerm, useStore } from "@/lib/store";
import useAutoRefresh from "@/lib/useAutoRefresh";
import { initials, fmt, dateAfterParam } from "@/lib/format";
import { STAFF_LABEL } from "@/lib/inventory";
import SearchInput from "@/components/SearchInput";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import FloristModal from "@/components/FloristModal";
import FloristStatsView from "@/components/FloristStats";
import FloristRateMatrix from "@/components/FloristRateMatrix";
import Drawer from "@/components/Drawer";
import DateChips from "@/components/DateChips";
import type { FloristStats } from "@/lib/types";
import SalaryLedger from "@/components/SalaryLedger";
import AttendanceLedger from "@/components/AttendanceLedger";
import ConfirmDialog from "@/components/ConfirmDialog";
import type { FloristProfile } from "@/lib/types";

// «Hajm tariflari» tabi OLIB TASHLANDI — tariflar endi PER-FLORIST, har floristning
// batafsil drawer'ida (FloristDetailDrawer → FloristRateMatrix). Umumiy tarif yo'q.
const TAB_LABEL = { profillar: "Profillar", oyliklar: "Oyliklar", davomat: "Keldi-ketdi" } as const;
type Tab = keyof typeof TAB_LABEL;

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Oyliklar tabidagi Excel eksport paneli — KLIENT tomonda (SheetJS), joriy davr. */
function SalaryExport({ control }: { control: boolean }) {
  const { showToast, dateFilter, dateRange } = useStore();
  const [busy, setBusy] = useState<"me" | "all" | null>(null);
  const from = dateRange ? dateRange.from : dateAfterParam(dateFilter);
  const to = dateRange ? dateRange.to : ymd(new Date());
  const run = async (which: "me" | "all") => {
    setBusy(which);
    try {
      // SERVER-tomon eksport (6 varaqli xlsx) — Content-Disposition'dagi fayl nomi bilan
      if (which === "all") await api.exportFlorists({ date_from: from, date_to: to });
      else await api.exportFlorist({ date_from: from, date_to: to }); // florist param yo'q → o'z hisoboti
      showToast("✓ Excel yuklab olindi");
    } catch (e) {
      const msg = e instanceof ApiError ? (e.status === 404 ? "Siz florist emassiz — o'z hisoboti faqat floristlar uchun" : e.message) : "Eksport qilib bo'lmadi";
      showToast(msg);
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="text-[13px] font-semibold" style={{ color: "var(--mut)" }}>Excel hisobot:</span>
      <button onClick={() => run("me")} disabled={busy !== null} className="flex items-center gap-1.5 rounded-[12px] border-[1.5px] px-3 py-1.5 text-[12.5px] font-bold transition-colors duration-150 hover:bg-[var(--hover)] disabled:opacity-60" style={{ borderColor: "var(--border-strong)", color: "var(--text-2)" }}>
        <User size={14} strokeWidth={2} /> {busy === "me" ? "Yuklanmoqda…" : "O'z hisobotim"}
      </button>
      {control && (
        <button onClick={() => run("all")} disabled={busy !== null} className="flex items-center gap-1.5 rounded-[12px] border-[1.5px] px-3 py-1.5 text-[12.5px] font-bold transition-colors duration-150 hover:bg-[var(--hover)] disabled:opacity-60" style={{ borderColor: "var(--border-strong)", color: "var(--text-2)" }}>
          <Download size={14} strokeWidth={2} /> {busy === "all" ? "Yuklanmoqda…" : "Barcha floristlar"}
        </button>
      )}
    </div>
  );
}

export default function FloristlarPage() {
  const { showToast } = useStore();
  const { canControl } = usePerm();
  const control = canControl("florists", "settings");
  // ?tab=davomat&attendance=<id> — check-in bildirishnomasidan kirish
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === "undefined") return "profillar";
    const t = new URLSearchParams(window.location.search).get("tab");
    return t && t in TAB_LABEL ? (t as Tab) : "profillar";
  });
  const [rows, setRows] = useState<FloristProfile[] | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<{ open: boolean; edit: FloristProfile | null }>({ open: false, edit: null });
  const [confirmOff, setConfirmOff] = useState<FloristProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [statFor, setStatFor] = useState<FloristProfile | null>(null); // batafsil statistika drawer

  const load = useCallback(() => {
    api.florists({ ordering: "user" }).then(setRows).catch((e) => showToast(e instanceof Error ? e.message : "Yuklashda xatolik"));
  }, [showToast]);
  useEffect(() => { load(); }, [load]);
  // ?rateFor=<id> — composer «Tarif qo'shish» yorlig'idan: o'sha floristning drawer'ini
  // ochamiz (tarif matritsasi shu yerda). Ro'yxat yuklangach bir marta.
  useEffect(() => {
    if (typeof window === "undefined" || !rows) return;
    const id = Number(new URLSearchParams(window.location.search).get("rateFor"));
    if (id) { const fp = rows.find((r) => r.id === id); if (fp) setStatFor(fp); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);
  useAutoRefresh(load);

  const name = (fp: FloristProfile) => {
    const u = fp.user_detail;
    return u ? [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username : `Florist #${fp.id}`;
  };
  const q = search.trim().toLowerCase();
  const filtered = (rows ?? []).filter((fp) => !q || name(fp).toLowerCase().includes(q) || (fp.phone ?? "").includes(q));

  const deactivate = async () => {
    if (!confirmOff) return;
    setBusy(true);
    try {
      const upd = await api.updateFlorist(confirmOff.id, { is_active: !confirmOff.is_active });
      setRows((rs) => rs?.map((r) => (r.id === upd.id ? upd : r)) ?? null);
      setConfirmOff(null);
      showToast(upd.is_active ? "✓ Florist faollashtirildi" : "✓ Florist nofaollashtirildi");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Bajarib bo'lmadi");
    } finally {
      setBusy(false);
    }
  };

  const tabBar = (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
        <button
          key={t}
          onClick={() => setTab(t)}
          aria-pressed={tab === t}
          className={clsx("rounded-full border-[1.5px] px-5 py-2 text-[13px] font-bold", tab === t ? "text-white" : "bg-sfc")}
          style={tab === t ? { background: "var(--acc)", borderColor: "var(--acc)" } : { borderColor: "var(--line)", color: "var(--mut)" }}
        >
          {TAB_LABEL[t]}
        </button>
      ))}
    </div>
  );

  if (rows === null && tab === "profillar") return <FlowerLoader />;

  if (tab === "oyliklar") return <>{tabBar}<SalaryExport control={control} /><SalaryLedger /></>;
  if (tab === "davomat") return <>{tabBar}<AttendanceLedger /></>;

  return (
    <>
      {tabBar}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="note-chip text-[14px]" style={{ color: "var(--mut)" }}>Floristlar ({filtered.length}) — profil, ish vaqti va geofence</p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} ariaLabel="Florist qidirish" />
          {control && (
            <button onClick={() => setForm({ open: true, edit: null })} className="btn-primary !flex-none rounded-[13px] px-4 py-2.5 text-[13.5px]">
              <Plus size={17} strokeWidth={1.75} /> Yangi
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Florist yo'q" sub="Birinchi floristni qo'shing — katalog yaratishda tanlanadi." />
      ) : (
        <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))" }}>
          {filtered.map((fp) => {
            const isApp = fp.staff_type === "apprentice";
            return (
              <article key={fp.id} onClick={() => setStatFor(fp)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") setStatFor(fp); }} title="Batafsil statistika" className="glass card-hover group flex cursor-pointer flex-col gap-3 !rounded-[18px] p-4" style={{ opacity: fp.is_active ? 1 : 0.55 }}>
                <div className="flex items-center gap-3">
                  <span className="avatar-lead flex h-11 w-11 shrink-0 -rotate-3 items-center justify-center rounded-[13px] text-[14px] font-bold">{initials(name(fp))}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-bold" title={name(fp)}>{name(fp)}</div>
                    <div className="truncate text-[12.5px]" style={{ color: "var(--muted)" }}>{fp.phone || "telefon yo'q"}</div>
                  </div>
                  <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: isApp ? "color-mix(in srgb, #b3873a 15%, transparent)" : "var(--primary-soft)", color: isApp ? "#b3873a" : "var(--primary)" }}>
                    {STAFF_LABEL[fp.staff_type]}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[12px]">
                  {(fp.work_start_time || fp.work_end_time) && (
                    <span className="flex items-center gap-1 rounded-full bg-sfc px-2.5 py-0.5 font-semibold" style={{ color: "var(--text-2)" }}>
                      <Clock size={11} strokeWidth={2} /> {fp.work_start_time?.slice(0, 5) ?? "—"}–{fp.work_end_time?.slice(0, 5) ?? "—"}
                    </span>
                  )}
                  <span className="rounded-full bg-sfc px-2.5 py-0.5 font-semibold" style={{ color: "var(--text-2)" }}>Kunlik {fmt(fp.daily_pay)}</span>
                </div>
                <div className="mt-auto flex items-end justify-between border-t pt-2.5" style={{ borderColor: "var(--line2)" }}>
                  <div>
                    <div className="text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>Oylik jami</div>
                    <div className="text-[15px] font-bold" style={{ color: "var(--acc)" }}>{fmt(fp.salary_total)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>Buketlar</div>
                    <div className="text-[15px] font-bold tabular-nums">{fp.catalog_count} ta</div>
                  </div>
                  {control && (
                    <span className="ml-2 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100">
                      <button onClick={(e) => { e.stopPropagation(); setForm({ open: true, edit: fp }); }} className="icon-btn !h-8 !w-8" title="Tahrirlash" aria-label={`${name(fp)} — tahrirlash`}><Pencil size={14} strokeWidth={1.75} /></button>
                      <button onClick={(e) => { e.stopPropagation(); setConfirmOff(fp); }} className="icon-btn icon-btn-danger !h-8 !w-8" title={fp.is_active ? "Nofaollashtirish" : "Faollashtirish"} aria-label="Holatni o'zgartirish"><Trash2 size={14} strokeWidth={1.75} /></button>
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {statFor && <FloristDetailDrawer florist={statFor} onClose={() => setStatFor(null)} />}

      {form.open && (
        <FloristModal
          florist={form.edit}
          onClose={() => setForm({ open: false, edit: null })}
          onSaved={(fp) => {
            setForm({ open: false, edit: null });
            setRows((rs) => { const list = rs ?? []; const i = list.findIndex((x) => x.id === fp.id); return i >= 0 ? list.map((x) => (x.id === fp.id ? fp : x)) : [fp, ...list]; });
            // ochiq drawer'ni ham yangilaymiz — staff_type o'zgarsa matritsa darhol to'g'ri
            // holatga o'tadi (matritsa florist.id o'zgarganda tariflarni qayta yuklaydi)
            setStatFor((cur) => (cur && cur.id === fp.id ? fp : cur));
          }}
        />
      )}
      {confirmOff && (
        <ConfirmDialog
          title={confirmOff.is_active ? "Floristni nofaollashtirish" : "Floristni faollashtirish"}
          body={`«${name(confirmOff)}» ${confirmOff.is_active ? "nofaollashtirilsinmi" : "faollashtirilsinmi"}? Keyin xohlagan payt qaytarish mumkin.`}
          confirmLabel={confirmOff.is_active ? "Ha, nofaollashtirish" : "Ha, faollashtirish"}
          danger={confirmOff.is_active}
          busy={busy}
          onConfirm={deactivate}
          onCancel={() => setConfirmOff(null)}
        />
      )}
    </>
  );
}

/** Florist batafsil statistikasi — o'ng drawer. /florists/{id}/stats/ + server Excel eksport. */
function FloristDetailDrawer({ florist, onClose }: { florist: FloristProfile; onClose: () => void }) {
  const { showToast, dateFilter, dateRange } = useStore();
  const [stats, setStats] = useState<FloristStats | null>(null);
  const [err, setErr] = useState("");
  const [exporting, setExporting] = useState(false);
  const from = dateRange ? dateRange.from : dateAfterParam(dateFilter);
  const to = dateRange ? dateRange.to : ymd(new Date());
  const nm = florist.user_detail ? [florist.user_detail.first_name, florist.user_detail.last_name].filter(Boolean).join(" ") || florist.user_detail.username : `Florist #${florist.id}`;
  useEffect(() => {
    setStats(null); setErr("");
    api.floristStats(florist.id, { from, to }).then(setStats).catch((e) => setErr(e instanceof Error ? e.message : "Yuklab bo'lmadi"));
  }, [florist.id, from, to]);
  const doExport = async () => {
    setExporting(true);
    try { await api.exportFlorist({ florist: florist.id, date_from: from, date_to: to }); showToast("✓ Excel yuklab olindi"); }
    catch (e) { showToast(e instanceof ApiError ? e.message : "Eksport qilib bo'lmadi"); }
    finally { setExporting(false); }
  };
  return (
    <Drawer onClose={onClose} width={720} title={nm} sub="florist statistikasi (server)">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <DateChips />
        <button onClick={doExport} disabled={exporting} className="flex items-center gap-1.5 rounded-[12px] border-[1.5px] px-3 py-1.5 text-[12.5px] font-bold transition-colors hover:bg-[var(--hover)] disabled:opacity-60" style={{ borderColor: "var(--border-strong)", color: "var(--text-2)" }}>
          <Download size={14} strokeWidth={2} /> {exporting ? "Yuklanmoqda…" : "Excel (6 varaq)"}
        </button>
      </div>
      {err ? <p className="py-6 text-center text-[13px] font-bold" style={{ color: "var(--danger-ink)" }}>{err}</p>
        : !stats ? <p className="py-6 text-center text-[13px]" style={{ color: "var(--muted)" }}>Yuklanmoqda…</p>
        : <FloristStatsView stats={stats} />}

      {/* PER-FLORIST hajm tariflari — shu floristning drawer'ida (umumiy tarif yo'q) */}
      <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--border)" }}>
        <FloristRateMatrix florist={florist} />
      </div>
    </Drawer>
  );
}
