"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Copy, Plus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Select from "./Select";
import { ARRANGEMENTS, ARRANGEMENT_UZ, VOLUMES, VOLUME_LABEL, buildVolumeRatesPayload, ratesForFlorist, type RateCell } from "@/lib/inventory";
import type { FloristProfile, FloristVolumeRate } from "@/lib/types";

const KEY = (a: string, v: string) => `${a}:${v}`;
type Cell = { fee: string; stems: string };
type Grid = Record<string, Cell>;
const emptyGrid = (): Grid => {
  const g: Grid = {};
  for (const a of ARRANGEMENTS) for (const v of VOLUMES) g[KEY(a, v)] = { fee: "", stems: "" };
  return g;
};
const gridFromRates = (rates: FloristVolumeRate[]): Grid => {
  const g = emptyGrid();
  for (const r of rates) {
    const k = KEY(r.arrangement_type, r.volume);
    if (k in g) g[k] = { fee: r.florist_fee ? String(Math.round(+r.florist_fee)) : "", stems: r.default_stems != null ? String(r.default_stems) : "" };
  }
  return g;
};
const toCells = (g: Grid): RateCell[] =>
  ARRANGEMENTS.flatMap((a) => VOLUMES.map((v) => ({ arrangement_type: a, volume: v, fee: g[KEY(a, v)].fee, stems: g[KEY(a, v)].stems })));
const digits = (s: string) => s.replace(/\D/g, "");
const grouped = (raw: string) => (raw ? Number(raw).toLocaleString("ru") : "");

/**
 * PER-FLORIST hajm tariflari matritsasi (Buket/Savat × Kichik/O'rta/Katta).
 * ⚠️ TO'LIQ ALMASHTIRISH: saqlashda barcha 6 katak birga `PATCH /florists/{id}/`
 * `volume_rates` sifatida ketadi — ro'yxatda bo'lmagan katak nofaol bo'ladi. Shu bois
 * grid OCHILGANDA doim YANGI GET qilinadi (eskirgan grid begunoh tariflarni o'chirmasin).
 */
export default function FloristRateMatrix({ florist, onSaved }: { florist: FloristProfile; onSaved?: () => void }) {
  const { showToast } = useStore();
  const isApprentice = florist.staff_type === "apprentice";
  const [loading, setLoading] = useState(true);
  const [grid, setGrid] = useState<Grid>(emptyGrid);
  const [baseline, setBaseline] = useState<Grid>(emptyGrid);
  const [activated, setActivated] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [florists, setFlorists] = useState<FloristProfile[]>([]);
  const [copyFrom, setCopyFrom] = useState<number>(0);
  const [copyOpen, setCopyOpen] = useState(false); // nusxalash paneli — faqat bosilganda ochiladi
  // KIMNING tariflari — sarlavhada aniq ko'rsatiladi (chalkashlik bo'lmasin)
  const whoseName = [florist.user_detail?.first_name, florist.user_detail?.last_name].filter(Boolean).join(" ") || florist.user_detail?.username || `Florist #${florist.id}`;
  // FAOL tarif yo'q, lekin NOFAOL tarif bor (masalan shogird→florist qaytarilgan) —
  // ⚠️ OCHIQ SAVOL: qaytarilganda eski tariflar avtomatik faollashadimi (spec/OpenAPI
  // aytmaydi, read-only aniqlab bo'lmadi). Shu bois UI HALOL: "qayta saqlang".
  const [hasInactiveOnly, setHasInactiveOnly] = useState(false);

  // OCHILGANDA — o'sha floristning FAOL tariflarini YANGIDAN oladi (kesh emas).
  // staff_type o'zgarsa ham qayta yuklaydi (florist form'dan qaytgach holat haqiqiy bo'lsin).
  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.floristVolumeRates({ florist: florist.id, is_active: true }),
      api.floristVolumeRates({ florist: florist.id }).catch(() => [] as FloristVolumeRate[]),
    ])
      .then(([activeRaw, allRaw]) => {
        // ⚠️ SERVER `?florist=` ni e'tiborga OLMAYDI — klientda ajratamiz (ratesForFlorist).
        const active = ratesForFlorist(activeRaw, florist.id);
        const all = ratesForFlorist(allRaw, florist.id);
        const g = gridFromRates(active); setGrid(g); setBaseline(g); setActivated(new Set());
        setHasInactiveOnly(active.length === 0 && all.length > 0);
      })
      .catch(() => showToast("Tariflarni yuklab bo'lmadi"))
      .finally(() => setLoading(false));
  }, [florist.id, florist.staff_type, showToast]);
  useEffect(() => { load(); }, [load]);
  // nusxalash ro'yxati (joriy floristsiz)
  useEffect(() => { api.florists({ is_active: true, ordering: "user", page_size: "all" }).then((fs) => setFlorists(fs.filter((f) => f.id !== florist.id))).catch(() => {}); }, [florist.id]);

  const dirty = useMemo(() => JSON.stringify(grid) !== JSON.stringify(baseline), [grid, baseline]);
  const setCell = (k: string, patch: Partial<Cell>) => setGrid((g) => ({ ...g, [k]: { ...g[k], ...patch } }));

  const doSave = async () => {
    const payload = buildVolumeRatesPayload(toCells(grid));
    const baseHadRates = buildVolumeRatesPayload(toCells(baseline)).length > 0;
    // ⚠️ BO'SH grid + avval tariflar bor edi → hammasi o'chadi: alohida tasdiq
    if (payload.length === 0 && baseHadRates && !confirmClear) { setConfirmClear(true); return; }
    setConfirmClear(false);
    setSaving(true);
    const snapshot = baseline; // rollback nuqtasi
    setBaseline(grid); // optimistik: dirty darhol tozalanadi
    try {
      await api.saveFloristVolumeRates(florist.id, payload);
      showToast("✓ Tariflar saqlandi");
      onSaved?.();
    } catch (e) {
      setBaseline(snapshot); // ROLLBACK — dirty qайta paydo bo'ladi
      showToast(e instanceof ApiError ? e.message : "Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  const copyFromFlorist = () => {
    if (!copyFrom) return;
    // MANBA floristga YOZILMAYDI — faqat uning tariflari o'qib, LOKAL to'ldiriladi (dirty)
    api.floristVolumeRates({ florist: copyFrom, is_active: true }).then((rates) => {
      if (!rates.length) { showToast("Bu floristda tarif yo'q"); return; }
      setGrid(gridFromRates(rates));
      setActivated(new Set(rates.map((r) => KEY(r.arrangement_type, r.volume))));
      setCopyOpen(false); setCopyFrom(0);
      showToast("Nusxalandi — tekshiring va saqlang");
    }).catch(() => showToast("Nusxalab bo'lmadi"));
  };

  if (isApprentice) {
    return (
      <div className="rounded-[16px] border border-dashed p-5 text-center" style={{ borderColor: "var(--border)", opacity: 0.85 }}>
        <div className="text-[13px] font-bold">Shogird kunlik ish haqi oladi</div>
        <p className="mt-1 text-[12px]" style={{ color: "var(--muted)" }}>Shogirdlarga hajm tariflari qo&apos;llanilmaydi — tariflari nofaol.</p>
      </div>
    );
  }
  if (loading) return <div className="py-6 text-center text-[13px]" style={{ color: "var(--muted)" }}>Tariflar yuklanmoqda…</div>;

  return (
    <div>
      {/* SARLAVHA — KIMNING tariflari ekani aniq (florist ismi bilan). Bu yerda florist
          TANLAGICH YO'Q: tariflar shu florist uchun, id drawer kontekstidan keladi. */}
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-[14px] font-bold">Hajm tariflari — <span style={{ color: "var(--primary)" }}>{whoseName}</span></div>
          <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>Barcha hajmlar birga saqlanadi</div>
        </div>
        {/* NUSXALASH — ikkilamchi amal; florist tanlovi FAQAT bosilgach chiqadi (tariflar
            "kimga tegishli" bilan adashmasligi uchun). Manbaga hech narsa yozilmaydi. */}
        {florists.length > 0 && !copyOpen && (
          <button type="button" onClick={() => setCopyOpen(true)} className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--muted)" }} title="Boshqa floristning qiymatlarini shu gridga nusxalash (saqlanmagan)">
            <Copy size={13} strokeWidth={2.2} /> Boshqa floristdan nusxalash
          </button>
        )}
      </div>

      {copyOpen && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[12px] border p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <span className="text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>Kimdan nusxalash:</span>
          <div className="min-w-[160px] flex-1"><Select value={copyFrom} onChange={(v) => setCopyFrom(+v)} placeholder="Floristni tanlang" searchable options={florists.map((f) => ({ value: f.id, label: [f.user_detail?.first_name, f.user_detail?.last_name].filter(Boolean).join(" ") || f.user_detail?.username || `#${f.id}` }))} /></div>
          <button type="button" onClick={copyFromFlorist} disabled={!copyFrom} className="rounded-[11px] px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-40" style={{ background: "var(--primary)" }}>Nusxalash</button>
          <button type="button" onClick={() => { setCopyOpen(false); setCopyFrom(0); }} className="rounded-[11px] border px-2.5 py-1.5 text-[12px] font-bold" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>Yopish</button>
        </div>
      )}

      {hasInactiveOnly && (
        <div className="mb-2 rounded-[11px] px-3 py-2 text-[12px] font-semibold" style={{ background: "var(--surface-2)", color: "var(--warning-ink)" }}>
          Bu floristning tariflari nofaol — qiymatlarni kiritib qayta saqlang.
        </div>
      )}

      {/* 2×3 grid: qator=turi, ustun=hajm */}
      <div className="overflow-x-auto thin-scroll">
        <div className="grid min-w-[440px] gap-2" style={{ gridTemplateColumns: "72px repeat(3, 1fr)" }}>
          <div />
          {VOLUMES.map((v) => (
            <div key={v} className="pb-0.5 text-center text-[12px] font-bold" style={{ color: "var(--text-2)" }}>{VOLUME_LABEL[v]}</div>
          ))}
          {ARRANGEMENTS.map((a) => (
            <div key={a} className="contents">
              <div className="flex items-center text-[12.5px] font-bold" style={{ color: "var(--primary)" }}>{ARRANGEMENT_UZ[a]}</div>
              {VOLUMES.map((v) => {
                const k = KEY(a, v);
                const c = grid[k];
                const shown = c.fee !== "" || c.stems !== "" || activated.has(k);
                return (
                  <div key={k} className="rounded-[12px] border p-1.5" style={{ borderColor: c.fee ? "var(--primary)" : "var(--border)", background: c.fee ? "var(--primary-soft)" : undefined }}>
                    {shown ? (
                      <div className="flex flex-col gap-1">
                        <input inputMode="numeric" value={grouped(c.fee)} onChange={(e) => setCell(k, { fee: digits(e.target.value) })} placeholder="so'm" className="inp !h-8 !py-1 text-center !text-[13px] font-bold" aria-label={`${ARRANGEMENT_UZ[a]} ${VOLUME_LABEL[v]} — ish haqi`} />
                        <input inputMode="numeric" value={c.stems} onChange={(e) => setCell(k, { stems: digits(e.target.value) })} placeholder="dona" className="inp !h-7 !py-0.5 text-center !text-[11.5px]" style={{ color: "var(--muted)" }} aria-label={`${ARRANGEMENT_UZ[a]} ${VOLUME_LABEL[v]} — gul soni`} />
                      </div>
                    ) : (
                      <button type="button" onClick={() => setActivated((s) => new Set(s).add(k))} className="flex h-[62px] w-full items-center justify-center rounded-[9px] text-[color:var(--muted)] transition-colors hover:bg-[var(--hover)]" title="Tarif qo'shish" aria-label={`${ARRANGEMENT_UZ[a]} ${VOLUME_LABEL[v]} — tarif qo'shish`}>
                        <Plus size={16} strokeWidth={2} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {confirmClear && (
        <div className="mt-3 flex items-start gap-2 rounded-[12px] px-3 py-2.5 text-[12.5px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>
          <AlertTriangle size={16} strokeWidth={2} className="mt-px shrink-0" />
          <span>Barcha tariflar o&apos;chiriladi (bo&apos;sh grid saqlanmoqda). Davom etilsinmi?</span>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[12px] font-semibold" style={{ color: dirty ? "var(--warning-ink)" : "var(--muted)" }}>
          {dirty ? "Saqlanmagan o'zgarishlar bor" : "Barchasi saqlangan"}
        </span>
        <button type="button" onClick={doSave} disabled={saving || !dirty} className="btn-primary disabled:opacity-50">
          {saving ? "Saqlanmoqda…" : confirmClear ? "Ha, o'chirish" : <><Check size={15} strokeWidth={2.4} /> Saqlash</>}
        </button>
      </div>
    </div>
  );
}
