"use client";
import { useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import clsx from "clsx";
import Drawer from "./Drawer";
import Select from "./Select";
import DatePicker from "./DatePicker";
import ImageInput from "./ImageInput";
import { Field } from "./Modal";
import { BatchMovementModal } from "./BatchMovementModal";
import { api, ApiError } from "@/lib/api";
import { usePerm, useStore } from "@/lib/store";
import { fmt, fmtDate, fmtTime } from "@/lib/format";
import { formatStemsAndBunches } from "@/lib/inventory";
import type { StockBatch, StockMovement, Supplier } from "@/lib/types";

/**
 * Partiya batafsil (VIEW) modali — barcha amallar shu yerda:
 * meta-ma'lumot + harakatlar tarixi (timeline), "Harakat / Chiqit" (BatchMovementModal),
 * "Tahrirlash" (partiya ma'lumotlari PATCH orqali o'zgaradi — qoldiq/qabul soni
 * bundan mustasno, ular harakatlar orqali) va nofaollashtirish (PATCH is_active=false).
 */

const MOVE_LABEL: Record<string, string> = {
  in: "KIRIM", out: "CHIQIM", adjustment: "TUZATISH", waste: "CHIQIT", transfer_out: "O'TKAZMA →", transfer_in: "→ O'TKAZMA",
};
const MOVE_IN = new Set(["in", "transfer_in", "adjustment"]);

const formFrom = (x: StockBatch) => ({
  batch_number: x.batch_number ?? "",
  received_at: (x.received_at ?? "").slice(0, 10),
  height_cm: x.height_cm ? String(x.height_cm) : "",
  stems_per_bunch: x.stems_per_bunch ? String(x.stems_per_bunch) : "",
  cost_per_stem: x.cost_per_stem ? String(Math.round(+x.cost_per_stem)) : "",
  sale_price_per_stem: x.sale_price_per_stem ? String(Math.round(+x.sale_price_per_stem)) : "",
  sale_price_per_bunch: x.sale_price_per_bunch ? String(Math.round(+x.sale_price_per_bunch)) : "",
  minimum_sale_stems: x.minimum_sale_stems ? String(x.minimum_sale_stems) : "",
  notes: x.notes ?? "",
  image_url: x.image_url ?? "",
  supplier: x.supplier ?? 0,
});

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[12px] border border-[color:var(--border)] bg-[color:var(--surface-2)] px-3 py-2.5">
      <div className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--muted)]">{label}</div>
      <div className="mt-0.5 text-[14px] font-semibold">{value}</div>
    </div>
  );
}

export default function BatchDrawer({
  batch,
  onClose,
  onChanged,
}: {
  batch: StockBatch;
  onClose: () => void;
  onChanged: (b: StockBatch | null) => void;
}) {
  const showToast = useStore((s) => s.showToast);
  const { canControl } = usePerm();
  const control = canControl("inventory");
  const [b, setB] = useState(batch);
  const [moves, setMoves] = useState<StockMovement[] | null>(null);
  const [movesErr, setMovesErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  // amallar — barchasi shu view modal ichida
  const [wasteOpen, setWasteOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [f, setF] = useState(formFrom(batch));
  const [errs, setErrs] = useState<Record<string, string>>({});
  const set = (k: keyof ReturnType<typeof formFrom>) => (e: React.ChangeEvent<HTMLInputElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const Err = ({ k }: { k: string }) => (errs[k] ? <p className="mt-1 text-[12px] font-semibold text-[color:var(--danger-ink)]">{errs[k]}</p> : null);

  const v = b.variant_detail;

  const loadMoves = () =>
    api.stockMovements({ batch: batch.id, ordering: "-created_at", page_size: 50 })
      .then(setMoves)
      .catch((e) => setMovesErr(e instanceof Error ? e.message : "Tarixni yuklab bo'lmadi"));

  // tarix HAR DOIM asl partiya id'si bilan so'raladi (batch.id — o'zgarmas prop)
  useEffect(() => { loadMoves(); /* eslint-disable-next-line */ }, [batch.id]);
  // yetkazib beruvchilar — tahrirlashdagi select uchun
  useEffect(() => { api.suppliers({ is_active: true }).then(setSuppliers).catch(() => {}); }, []);

  const startEdit = () => { setF(formFrom(b)); setErrs({}); setEditing(true); };

  const saveEdit = async () => {
    if (!f.batch_number.trim()) return setErrs({ batch_number: "Partiya raqamini kiriting" });
    if (!(+f.height_cm > 0)) return setErrs({ height_cm: "Bo'yini kiriting (majburiy)" });
    setSaving(true);
    setErrs({});
    try {
      const payload: Partial<StockBatch> = {
        batch_number: f.batch_number.trim(),
        ...(f.received_at ? { received_at: f.received_at.slice(0, 10) } : {}),
        height_cm: +f.height_cm,
        stems_per_bunch: +f.stems_per_bunch || b.stems_per_bunch,
        cost_per_stem: String(+f.cost_per_stem || 0),
        sale_price_per_stem: String(+f.sale_price_per_stem || 0),
        sale_price_per_bunch: String(+f.sale_price_per_bunch || (+f.sale_price_per_stem || 0) * (+f.stems_per_bunch || b.stems_per_bunch || 1)),
        minimum_sale_stems: +f.minimum_sale_stems || 1,
        notes: f.notes,
        image_url: f.image_url,
        supplier: f.supplier || null,
      };
      const upd = await api.updateStockBatch(b.id, payload);
      setB(upd);
      onChanged(upd);
      setEditing(false);
      showToast("✓ Partiya yangilandi");
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) setErrs(e.fieldErrors);
      showToast(e instanceof ApiError ? e.message : "Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  // chiqit/harakat modalidan qaytgach — partiya + tarix yangilanadi
  const onMovementDone = (upd: StockBatch) => {
    setB(upd);
    onChanged(upd);
    loadMoves().catch(() => {});
    setWasteOpen(false);
  };

  const deactivate = async () => {
    setSaving(true);
    try {
      await api.deactivateStockBatch(batch.id);
      showToast("✓ Partiya nofaollashtirildi");
      onChanged(null);
      onClose();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Amalga oshmadi");
    } finally {
      setSaving(false);
      setConfirmOff(false);
    }
  };

  const low = b.remaining_stems > 0 && b.remaining_stems <= b.minimum_sale_stems * 2;

  return (
    <Drawer
      onClose={onClose}
      width={560}
      title={`${v?.flower_detail?.name_uz ?? ""} — ${v?.name_uz ?? ""}`}
      sub={`Partiya №${b.batch_number}`}
      badges={
        <>
          {b.remaining_stems === 0 && <span className="rounded-full bg-[color:var(--surface-2)] px-2.5 py-0.5 text-[11px] font-bold">TUGADI</span>}
          {low && <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white" style={{ background: "var(--danger)" }}>KAM QOLDI</span>}
          {!b.is_active && <span className="rounded-full bg-[color:var(--surface-2)] px-2.5 py-0.5 text-[11px] font-bold">NOFAOL</span>}
          <span className="rounded-full bg-[color:var(--hover)] px-2.5 py-0.5 text-[11px] font-bold text-[color:var(--text-2)]">{v?.color_uz}</span>
          <span className="rounded-full bg-[color:var(--hover)] px-2.5 py-0.5 text-[11px] font-bold text-[color:var(--text-2)]">{b.height_cm} sm</span>
        </>
      }
    >
      {/* rasm */}
      {(b.image_url || v?.image_url) && (
        <div className="mb-4 h-[160px] overflow-hidden rounded-[14px] border border-[color:var(--border)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.image_url || v.image_url} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      {/* AMALLAR — barchasi shu view modal ichida */}
      {control && b.is_active && !editing && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button onClick={() => setWasteOpen(true)} className="flex items-center gap-1.5 rounded-[12px] border-[1.5px] px-3.5 py-2 text-[13px] font-bold transition-colors duration-150 hover:bg-[var(--hover)]" style={{ borderColor: "var(--border-strong)", color: "var(--danger-ink)" }}>
            <Plus size={15} strokeWidth={2} /> Harakat / Chiqit
          </button>
          <button onClick={startEdit} className="flex items-center gap-1.5 rounded-[12px] border-[1.5px] px-3.5 py-2 text-[13px] font-bold transition-colors duration-150 hover:bg-[var(--hover)]" style={{ borderColor: "var(--border-strong)", color: "var(--text-2)" }}>
            <Pencil size={15} strokeWidth={2} /> Tahrirlash
          </button>
        </div>
      )}

      {editing ? (
        /* TAHRIRLASH — partiya ma'lumotlari o'zgartiriladi (PATCH) */
        <div className="flex flex-col gap-3">
          <div className="text-[11px] font-semibold uppercase tracking-[2px]" style={{ color: "var(--primary)" }}>Partiyani tahrirlash</div>
          <p className="-mt-1.5 text-[12px]" style={{ color: "var(--muted)" }}>Qoldiq va qabul soni harakatlar orqali o&apos;zgaradi — bu yerda narx, bo&apos;yi va boshqa ma&apos;lumotlar.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Partiya raqami"><input className="inp" value={f.batch_number} onChange={set("batch_number")} placeholder="Masalan: EF-260726-1" /><Err k="batch_number" /></Field>
            <Field label="Kelgan sana"><DatePicker value={f.received_at} onChange={(vv) => setF((p) => ({ ...p, received_at: vv }))} placeholder="Sana" ariaLabel="Kelgan sana" /></Field>
            <Field label="Yetkazib beruvchi" span>
              <Select value={f.supplier} onChange={(vv) => setF((p) => ({ ...p, supplier: +vv }))} placeholder="Tanlang (ixtiyoriy)" options={[{ value: 0, label: "—" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]} />
            </Field>
            <Field label="Gul bo'yi (sm)"><input className="inp" type="number" value={f.height_cm} onChange={set("height_cm")} placeholder="Masalan: 60" /><Err k="height_cm" /></Field>
            <Field label="Pochkada dona"><input className="inp" type="number" value={f.stems_per_bunch} onChange={set("stems_per_bunch")} placeholder="Masalan: 25" /><Err k="stems_per_bunch" /></Field>
            <Field label="Tannarx / dona (so'm)"><input className="inp" type="number" value={f.cost_per_stem} onChange={set("cost_per_stem")} placeholder="Masalan: 21000" /><Err k="cost_per_stem" /></Field>
            <Field label="Sotuv / dona (so'm)"><input className="inp" type="number" value={f.sale_price_per_stem} onChange={set("sale_price_per_stem")} placeholder="Masalan: 35000" /><Err k="sale_price_per_stem" /></Field>
            <Field label="Pochka sotuv narxi (so'm)"><input className="inp" type="number" value={f.sale_price_per_bunch} onChange={set("sale_price_per_bunch")} placeholder="Avto" /><Err k="sale_price_per_bunch" /></Field>
            <Field label="Minimal sotuv (dona)"><input className="inp" type="number" value={f.minimum_sale_stems} onChange={set("minimum_sale_stems")} placeholder="Masalan: 5" /><Err k="minimum_sale_stems" /></Field>
            <Field label="Izoh" span><input className="inp" value={f.notes} onChange={set("notes")} placeholder="Ixtiyoriy" /></Field>
            <Field label="Rasm" span><ImageInput value={f.image_url} onChange={(url) => setF((p) => ({ ...p, image_url: url }))} /></Field>
          </div>
          <div className="mt-1 flex gap-2.5">
            <button onClick={() => { setEditing(false); setErrs({}); }} className="btn-ghost flex-1">Bekor</button>
            <button onClick={saveEdit} disabled={saving} className={clsx("btn-primary flex-1", saving && "btn-loading")}>Saqlash</button>
          </div>
        </div>
      ) : (
        <>
          {/* meta */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <Meta label="Qoldiq" value={formatStemsAndBunches(b.remaining_stems, b.stems_per_bunch)} />
            <Meta label="Qabul qilingan" value={`${b.received_stems} dona`} />
            <Meta label="Dona narxi" value={fmt(b.sale_price_per_stem)} />
            <Meta label="Pochka narxi" value={fmt(b.sale_price_per_bunch)} />
            <Meta label="Tannarx (dona)" value={fmt(b.cost_per_stem)} />
            <Meta label="Sklad qiymati" value={fmt(b.stock_value)} />
            <Meta label="Keldi" value={fmtDate(b.received_at)} />
            <Meta label="Minimal sotuv" value={`${b.minimum_sale_stems} dona`} />
          </div>
          {b.notes && (
            <div className="mt-3 rounded-[12px] border border-[color:var(--border)] bg-[color:var(--surface-2)] px-3 py-2.5 text-[13px] leading-relaxed text-[color:var(--text-2)]">
              {b.notes}
            </div>
          )}
        </>
      )}

      {!editing && (<>
      {/* tarix — timeline */}
      <div className="mt-5">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[2px]" style={{ color: "var(--primary)" }}>Harakatlar tarixi</div>
        {movesErr && <p className="text-[13px] font-semibold text-[color:var(--danger-ink)]">{movesErr}</p>}
        {!movesErr && moves === null && <p className="text-[13px] text-[color:var(--muted)]">Yuklanmoqda…</p>}
        {moves && moves.length === 0 && <p className="text-[13px] text-[color:var(--muted)]">Bu partiyada hali harakat yo&apos;q.</p>}
        {moves && moves.length > 0 && (
          <ol className="relative ml-2 border-l border-[color:var(--border)] pl-4">
            {moves.map((m) => {
              const isIn = MOVE_IN.has(m.movement_type);
              const who = m.performed_by_detail
                ? [m.performed_by_detail.first_name, m.performed_by_detail.last_name].filter(Boolean).join(" ") || m.performed_by_detail.username
                : "Tizim";
              return (
                <li key={m.id} className="relative pb-3.5 last:pb-0">
                  <span className={clsx("absolute -left-[21.5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-[color:var(--surface-solid)]", isIn ? "bg-[var(--success)]" : "bg-[var(--warning)]")} />
                  <div className="text-[13px] font-semibold">
                    {MOVE_LABEL[m.movement_type] ?? m.movement_type} · {m.quantity_stems} dona
                    {m.reason ? <span className="font-normal text-[color:var(--text-2)]"> — {m.reason}</span> : null}
                  </div>
                  <div className="text-[12px] text-[color:var(--muted)]">{who} · {fmtTime(m.created_at)}</div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* audit */}
      <div className="mt-5 grid grid-cols-2 gap-2.5 border-t border-[color:var(--border)] pt-4 text-[12px] text-[color:var(--muted)]">
        <span>Yaratilgan: {fmtTime(b.created_at)}</span>
        <span className="text-right">Yangilangan: {fmtTime(b.updated_at)}</span>
      </div>

      {/* xavfli amal */}
      {control && b.is_active && (
        <div className="mt-4">
          {!confirmOff ? (
            <button onClick={() => setConfirmOff(true)} className="w-full rounded-[12px] border border-[color:var(--border)] py-2.5 text-[13px] font-bold text-[color:var(--danger-ink)] transition-colors duration-200 hover:bg-[color:var(--hover)]">
              Partiyani nofaollashtirish
            </button>
          ) : (
            <div className="flex gap-2.5">
              <button onClick={() => setConfirmOff(false)} className="btn-ghost flex-1">Bekor</button>
              <button onClick={deactivate} disabled={saving} className={clsx("btn-danger flex-1", saving && "btn-loading")}>Tasdiqlash</button>
            </div>
          )}
        </div>
      )}
      </>)}

      {/* chiqit / harakat modali — view modal ichidan ochiladi */}
      {wasteOpen && <BatchMovementModal batch={b} onClose={() => setWasteOpen(false)} onDone={onMovementDone} />}
    </Drawer>
  );
}
