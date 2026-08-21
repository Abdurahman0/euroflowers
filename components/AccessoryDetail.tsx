"use client";
import { useEffect, useState } from "react";
import { ArrowDownToLine, History, Pencil, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import { fmt, fmtTime } from "@/lib/format";
import type { MaterialMovement, Packaging } from "@/lib/types";

/**
 * AKSESSUAR TAFSILOTI — narx, TANNARX, qoldiq va harakatlar tarixi.
 *
 * ⚠️ TANNARX FAQAT SHU YERDA: ro'yxat kartochkasida ko'rsatilmaydi (so'rov) — sotuvchi
 *    ekranida mijoz oldida tannarx turmasin.
 *
 * ⚠️ QOLDIQ IKKI XIL O'ZGARADI va ular ARALASHTIRILMAYDI:
 *      «Kirim qilish»  → POST /api/packaging/{id}/movement/ {movement_type:"in"} —
 *                        mavjud qoldiqqa QO'SHADI va tarixda «KIRIM» bo'lib qoladi.
 *      «To'g'rilash»   → PATCH /api/packaging/{id}/ {quantity} — sanoq xatosini tuzatadi,
 *                        qoldiqni AYNAN shu songa qo'yadi (kirim yozuvi yaratmaydi).
 *
 * ⚠️ Yozuv yo'llari JONLI SINALMAGAN (loyiha qoidasi: faqat GET).
 */
export default function AccessoryDetail({
  item, control, onClose, onEdit, onChanged,
}: {
  item: Packaging;
  control: boolean;
  onClose: () => void;
  onEdit: () => void;
  /** qoldiq o'zgardi — ro'yxat qayta yuklansin */
  onChanged: (updated?: Packaging) => void;
}) {
  const { showToast } = useStore();
  const [body, setBody] = useState<{ results: MaterialMovement[]; totals?: Record<string, unknown> } | null>(null);
  const [qty, setQty] = useState(item.quantity);
  const [mode, setMode] = useState<"" | "in" | "fix">("");
  const [val, setVal] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const loadMoves = () =>
    api.packagingMovementsPage({ packaging: item.id, ordering: "-created_at", page_size: 50 })
      .then(setBody)
      .catch(() => setBody({ results: [] }));
  useEffect(() => { loadMoves(); }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const saleTotal = Number(body?.totals?.sale_total ?? 0);
  const n = Math.floor(+val || 0);

  const submit = async () => {
    if (busy) return;
    if (mode === "in" && n <= 0) return showToast("Nechta kirim qilinayotganini kiriting");
    if (mode === "fix" && (val.trim() === "" || n < 0)) return showToast("Yangi qoldiqni kiriting");
    setBusy(true);
    try {
      if (mode === "in") {
        // ⚠️ MAVJUD aksessuarga QO'SHILADI — yangi aksessuar YARATILMAYDI
        await api.materialMovement(item.id, { movement_type: "in", quantity: n, reason: reason.trim() || "Kirim" });
        setQty((q) => q + n);
        showToast(`✓ ${n} dona kirim qilindi`);
      } else {
        const saved = await api.updateMaterial(item.id, { quantity: n });
        setQty(n);
        showToast(`✓ Qoldiq ${n} dona qilib to'g'rilandi`);
        onChanged(saved);
        setMode(""); setVal(""); setReason(""); setBusy(false); loadMoves();
        return;
      }
      onChanged();
      setMode(""); setVal(""); setReason("");
      loadMoves();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Saqlab bo'lmadi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 p-4 backdrop-blur-md" onMouseDown={onClose}>
      <div className="glass-modal max-h-[88vh] w-[min(640px,100%)] overflow-y-auto p-6" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[18px] font-extrabold tracking-tight">{item.name_uz || item.name_ru}</div>
            <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--muted)" }}>Aksessuar · qoldiq va harakatlar</p>
          </div>
          <span className="flex shrink-0 items-center gap-1">
            {control && <button onClick={onEdit} className="icon-btn" title="Tahrirlash"><Pencil size={16} /></button>}
            <button className="icon-btn" onClick={onClose} aria-label="Yopish"><X size={17} /></button>
          </span>
        </div>

        {/* ⚠️ TANNARX SHU YERDA (ro'yxatda ko'rsatilmaydi) */}
        <div className="mb-4 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
          {[
            { k: "Qoldiq", v: `${qty} dona`, hue: "var(--acc)" },
            { k: "Sotuv narxi", v: +(item.sale_price ?? 0) > 0 ? fmt(item.sale_price) : "—" },
            { k: "Tannarx", v: +(item.cost_price ?? 0) > 0 ? fmt(item.cost_price) : "—" },
            { k: "Sotuv jami", v: saleTotal ? fmt(saleTotal) : "—" },
          ].map((c) => (
            <div key={c.k} className="rounded-[13px] border p-3" style={{ borderColor: "var(--border)" }}>
              <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>{c.k}</div>
              <b className="text-[15px] tabular-nums" style={{ color: c.hue ?? "var(--text)" }}>{c.v}</b>
            </div>
          ))}
        </div>

        {control && (
          <div className="mb-4 rounded-[14px] border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => { setMode(mode === "in" ? "" : "in"); setVal(""); }}
                aria-pressed={mode === "in"}
                className="flex items-center gap-1.5 rounded-full border-[1.5px] px-3.5 py-1.5 text-[12.5px] font-bold transition-colors duration-150"
                style={mode === "in" ? { background: "var(--primary)", borderColor: "var(--primary)", color: "#fff" } : { borderColor: "var(--border)", color: "var(--text-2)" }}>
                <ArrowDownToLine size={13} strokeWidth={2.2} /> Kirim qilish
              </button>
              <button type="button" onClick={() => { setMode(mode === "fix" ? "" : "fix"); setVal(String(qty)); }}
                aria-pressed={mode === "fix"}
                className="rounded-full border-[1.5px] px-3.5 py-1.5 text-[12.5px] font-bold transition-colors duration-150"
                style={mode === "fix" ? { background: "var(--primary)", borderColor: "var(--primary)", color: "#fff" } : { borderColor: "var(--border)", color: "var(--text-2)" }}>
                Sonini to&apos;g&apos;rilash
              </button>
              <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                {mode === "fix" ? "Qoldiq aynan shu songa qo'yiladi" : "Yangi kelgan tovar mavjud qoldiqqa qo'shiladi"}
              </span>
            </div>

            {mode && (
              <div className="mt-2.5 flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1 text-[12px] font-bold" style={{ color: "var(--muted)" }}>
                  {mode === "in" ? "Nechta keldi" : "Yangi qoldiq"}
                  <input className="inp !h-9 w-[130px]" type="number" min={0} value={val} onChange={(e) => setVal(e.target.value)} autoFocus />
                </label>
                <label className="flex min-w-[150px] flex-1 flex-col gap-1 text-[12px] font-bold" style={{ color: "var(--muted)" }}>
                  Izoh (ixtiyoriy)
                  <input className="inp !h-9" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={mode === "in" ? "Masalan: yangi partiya" : "Masalan: sanoq"} />
                </label>
                <button onClick={submit} disabled={busy} className={`btn-primary !h-9 !px-4 disabled:opacity-60 ${busy ? "btn-loading" : ""}`}>
                  {mode === "in" ? `Kirim (${n > 0 ? qty + n : qty} bo'ladi)` : "To'g'rilash"}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
          <History size={13} strokeWidth={2.2} /> Harakatlar tarixi
        </div>
        {body === null ? <FlowerLoader /> : body.results.length === 0 ? <EmptyState title="Harakat yo'q" /> : (
          <div>
            {body.results.map((m) => {
              const sale = m.reference_type === "packaging_sale";
              const isIn = m.movement_type === "in";
              return (
                <div key={m.id} className="flex flex-wrap items-center gap-3 border-t py-3 first:border-t-0" style={{ borderColor: "var(--line2)" }}>
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full ${isIn ? "bg-mint text-mintink" : "bg-peach text-peachink"}`}>{isIn ? "+" : "−"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold">{sale ? "Alohida sotuv" : isIn ? "Kirim" : "Chiqim"} · {Math.abs(m.quantity)} dona</div>
                    <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>{m.reason || "—"} · {fmtTime(m.created_at)}</div>
                  </div>
                  {sale && <span className="rounded-full bg-mint px-2.5 py-1 text-[11px] font-bold text-mintink">{m.payment_type ?? "—"} · {+(m.unit_price ?? 0) > 0 ? fmt(m.unit_price) : "—"}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
