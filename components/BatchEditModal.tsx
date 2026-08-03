"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, Truck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { notifyReportDataChanged } from "@/lib/reportCache";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Section, Field } from "./Modal";
import DatePicker from "./DatePicker";
import ImageInput from "./ImageInput";
import { PriceHint } from "./BatchPriceFields";
import FreeBatchToggle from "./FreeBatchToggle";
import DualQtyInput, { defaultQtyMode, type QtyMode } from "./DualQtyInput";
import { Icon } from "./icons";
import { fmt, fmtDate } from "@/lib/format";
import { perStemFromBunch, roundingNote, buildBatchEditPayload, batchEditIsRetroactive, formatStemsAndBunches, receivedEditConsequence, type BatchEditForm, type BatchEditOriginal } from "@/lib/inventory";
import type { StockBatch } from "@/lib/types";

const num = (n: string | number | undefined | null) => (n == null || n === "" ? "" : String(Math.round(+n)));
const formFrom = (b: StockBatch): BatchEditForm => ({
  batch_number: b.batch_number ?? "",
  received_at: (b.received_at ?? "").slice(0, 10),
  height_cm: b.height_cm ? String(b.height_cm) : "",
  received_stems: b.received_stems != null ? String(b.received_stems) : "",
  is_free: !!b.is_free,
  stems_per_bunch: b.stems_per_bunch ? String(b.stems_per_bunch) : "",
  minimum_sale_stems: b.minimum_sale_stems ? String(b.minimum_sale_stems) : "",
  notes: b.notes ?? "",
  image_url: b.image_url ?? "",
  cost_per_bunch: num(b.cost_per_bunch),
  sale_price_per_bunch: num(b.sale_price_per_bunch),
  cost_per_stem: num(b.cost_per_stem),
  sale_price_per_stem: num(b.sale_price_per_stem),
  costManual: false,
  saleManual: false,
});

/**
 * PARTIYANI TAHRIRLASH — create modal bilan BIR XIL narx mantiqi (pochka asosiy, dona preview,
 * yaxlitlash izohi, «qo'lda kiritish» override — PriceHint qayta ishlatilgan). FAQAT o'zgargan
 * maydonlar PATCH qilinadi (buildBatchEditPayload). ⚠️ Tannarx/pochka-dona o'zgarsa RETROAKTIV
 * ogohlantirish ko'rsatiladi (avval yasalgan kataloglar tannarxiga ta'sir — adjust bilan bir xil).
 * Provenance (Yuk/raqam/sana/postavshik/nav/qoldiq) TAHRIRLANMAYDI — desync xavfli (read-only ko'rsatiladi).
 */
export default function BatchEditModal({ batch, onClose, onSaved }: {
  batch: StockBatch;
  onClose: () => void;
  onSaved: (b: StockBatch) => void;
}) {
  const { showToast } = useStore();
  const [f, setF] = useState<BatchEditForm>(() => formFrom(batch));
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const set = (k: keyof BatchEditForm) => (e: React.ChangeEvent<HTMLInputElement>) => { setF((p) => ({ ...p, [k]: e.target.value })); if (errs[k]) setErrs((x) => { const n = { ...x }; delete n[k]; return n; }); };

  // ⚠️ KELGAN MIQDOR — pochka sukut bo'yicha (create formadagi konvensiya)
  const [qtyMode, setQtyMode] = useState<QtyMode>(() => defaultQtyMode(batch.stems_per_bunch));
  const orig: BatchEditOriginal = batch;
  const v = batch.variant_detail;
  const spb = +f.stems_per_bunch || batch.stems_per_bunch || 20;

  // NARX preview (create bilan bir xil)
  const costBunch = +f.cost_per_bunch || 0;
  const saleBunch = +f.sale_price_per_bunch || 0;
  const costNote = roundingNote(costBunch, spb);
  const saleNote = roundingNote(saleBunch, spb);
  const costPerStem = f.costManual ? (+f.cost_per_stem || 0) : perStemFromBunch(costBunch, spb);
  const salePerStem = f.saleManual ? (+f.sale_price_per_stem || 0) : perStemFromBunch(saleBunch, spb);

  // OQIBAT — kelgan/ishlatilgan/qoldiq (sof funksiyadan; manfiy qoldiq → saqlash BLOKLANADI)
  const rc = receivedEditConsequence(batch.received_stems, batch.remaining_stems, f.received_stems);
  const payload = useMemo(() => buildBatchEditPayload(orig, f), [orig, f]);
  const changedKeys = Object.keys(payload);
  const retroactive = batchEditIsRetroactive(payload);

  const save = async () => {
    if (!(+f.height_cm > 0)) { setErrs({ height_cm: "Bo'yini kiriting (majburiy)" }); return showToast("Gul bo'yini kiriting"); }
    if (rc.negative) { showToast("Kelgan miqdor ishlatilgandan kam bo'lishi mumkin emas"); return; }
    if (changedKeys.length === 0) { showToast("O'zgarish yo'q"); onClose(); return; }
    setBusy(true); setErrs({});
    try {
      const upd = await api.updateStockBatch(batch.id, payload as Partial<StockBatch>); // PATCH — faqat o'zgargan maydonlar
      showToast("✓ Partiya yangilandi");
      notifyReportDataChanged(); // tannarx o'zgargan bo'lsa hisobot raqamlari siljiydi
      onSaved(upd);
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) { setErrs(e.fieldErrors); showToast(e.message); }
      else showToast(e instanceof ApiError ? e.message : "Saqlashda xatolik");
      setBusy(false);
    }
  };

  const Err = ({ k }: { k: string }) => errs[k] ? <p className="mt-1 text-[11.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>{errs[k]}</p> : null;

  return (
    <Modal onClose={onClose} width={560}>
      <ModalHeader icon={<Icon name="sklad" size={20} />} title="Partiyani tahrirlash" sub={`${v?.flower_detail?.name_uz ?? ""} — ${v?.name_uz ?? ""} · №${batch.batch_number}`} onClose={onClose} />

      {/* PROVENANCE — read-only (Yuk/nav/qoldiq desync xavfli, o'zgartirilmaydi) */}
      <div className="mt-1 flex items-center gap-2.5 rounded-[13px] border p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
        <Truck size={15} strokeWidth={2} style={{ color: "var(--primary)" }} />
        <div className="min-w-0 flex-1 text-[12px]">
          <div className="font-bold">{batch.delivery_detail ? `Yuk ${batch.delivery_detail.number} · ${fmtDate(batch.delivery_detail.received_at)}` : `№${batch.batch_number} · ${fmtDate(batch.received_at)}`}</div>
          <div style={{ color: "var(--muted)" }}>{batch.supplier_detail?.name ?? "postavshiksiz"} · Qoldiq {formatStemsAndBunches(batch.remaining_stems, batch.stems_per_bunch)} / {batch.received_stems} dona</div>
        </div>
        <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: "var(--hover)", color: "var(--muted)" }}>o&apos;zgartirilmaydi</span>
      </div>

      <Section>Ma&apos;lumot</Section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Gul bo'yi (sm)"><input className="inp" type="number" value={f.height_cm} onChange={set("height_cm")} placeholder="Masalan: 60" /><Err k="height_cm" /></Field>
        <Field label="Kelgan sana"><DatePicker value={f.received_at} onChange={(vv) => setF((p) => ({ ...p, received_at: vv }))} placeholder="Sana" ariaLabel="Kelgan sana" /></Field>
        <Field label="Minimal sotuv (dona)"><input className="inp" type="number" value={f.minimum_sale_stems} onChange={set("minimum_sale_stems")} placeholder="Masalan: 5" /></Field>
        <Field label="Pochkada dona"><input className="inp" type="number" value={f.stems_per_bunch} onChange={set("stems_per_bunch")} placeholder="Masalan: 25" /></Field>
        <Field label="Izoh" span><input className="inp" value={f.notes} onChange={set("notes")} placeholder="Ixtiyoriy" /></Field>
      </div>

      {/* ⚠️ KELGAN MIQDORNI TO'G'RILASH — xato kiritishni tuzatish uchun. RETROAKTIV: partiya jami,
          yuk jamilari va tannarx raqamlari siljiydi. Ishlatilgandan kam qilib bo'lmaydi. */}
      <Section>Kelgan miqdor — to&apos;g&apos;rilash</Section>
      <div className="grid grid-cols-1 gap-3">
        <DualQtyInput
          mode={qtyMode}
          value={qtyMode === "bunches" ? (spb > 0 ? String(Math.round(((+f.received_stems || 0) / spb) * 100) / 100) : f.received_stems) : f.received_stems}
          stemsPerBunch={spb}
          onMode={setQtyMode}
          onValue={(vv) => {
            // DualQtyInput pochkada pochka sonini beradi — DONAga aylantirib saqlaymiz (yagona manba)
            const n = parseFloat(vv) || 0;
            const stems = qtyMode === "bunches" ? Math.round(n * spb) : Math.round(n);
            setF((p) => ({ ...p, received_stems: vv === "" ? "" : String(Math.max(stems, 0)) }));
            setErrs((x) => { const n2 = { ...x }; delete n2.received_stems; delete n2.received_bunches; return n2; });
          }}
          label="Kelgan miqdor"
        />
        <Err k="received_stems" />
        <Err k="received_bunches" />

        {/* OQIBAT — submitdan OLDIN joriy qiymatlardan hisoblanadi */}
        {rc.changed && (
          <div className="flex flex-col gap-1 rounded-[12px] px-3.5 py-2.5 text-[13px] font-semibold"
            style={rc.negative
              ? { background: "var(--danger-soft, rgba(160,74,74,.14))", color: "var(--danger-ink)" }
              : { background: "var(--surface-2)" }}>
            <div className="flex items-center justify-between"><span style={{ color: "var(--text-2)" }}>Kelgan</span>
              <span className="tabular-nums">{rc.receivedFrom.toLocaleString("ru")} → <b style={{ color: "var(--primary)" }}>{rc.receivedTo.toLocaleString("ru")}</b> dona</span></div>
            <div className="flex items-center justify-between"><span style={{ color: "var(--text-2)" }}>Ishlatilgan</span>
              <span className="tabular-nums">{rc.used.toLocaleString("ru")} dona</span></div>
            <div className="flex items-center justify-between border-t pt-1" style={{ borderColor: "var(--line2)" }}>
              <span style={{ color: "var(--text-2)" }}>Qoldiq</span>
              <span className="tabular-nums">{rc.remainingFrom.toLocaleString("ru")} → <b style={{ color: rc.negative ? "var(--danger-ink)" : "var(--acc)" }}>{rc.remainingTo.toLocaleString("ru")}</b> dona</span>
            </div>
          </div>
        )}

        {/* BLOK — ishlatilgandan kam; muqobilini AYTAMIZ */}
        {rc.negative && (
          <div className="rounded-[12px] px-3.5 py-2.5 text-[12.5px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.14))", color: "var(--danger-ink)" }}>
            <div className="flex items-start gap-1.5">
              <AlertTriangle size={15} strokeWidth={2.2} className="mt-px shrink-0" />
              <span>
                Bu partiyadan <b>{rc.used.toLocaleString("ru")} dona</b> allaqachon ishlatilgan — kelgan miqdorni
                undan kam qilib bo&apos;lmaydi (qoldiq manfiy bo&apos;lib qoladi).
                <span className="mt-1 block font-medium">
                  Buning o&apos;rniga: farqni <b>chiqitga yozing</b> (partiya → Chiqim/Chiqit), yoki noto&apos;g&apos;ri
                  harakatlarni (florist chiqimi/qaytarish) to&apos;g&apos;rilang. Eng kami: <b>{rc.used.toLocaleString("ru")} dona</b>.
                </span>
              </span>
            </div>
          </div>
        )}
      </div>

      <Section>Narx — pochkadan hisoblanadi</Section>
      {/* ⚠️ TEKIN GUL — API PATCH'da ham yoziladi (is_free readOnly EMAS), shuning uchun tahrirlanadi;
          mavjud partiyada RETROAKTIV (tannarx asosi qayta yoziladi) → ogohlantirish bilan. */}
      <FreeBatchToggle checked={f.is_free} onChange={(v) => setF((p) => ({ ...p, is_free: v }))} retroactive={!batch.is_free} />
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {!f.is_free && (
        <div>
          <Field label="Pochka tannarxi (so'm)"><input className="inp" type="number" value={f.cost_per_bunch} onChange={set("cost_per_bunch")} placeholder="Masalan: 25 000" /></Field>
          <PriceHint label="dona tannarxi" perStem={costPerStem} note={costNote} manual={f.costManual} manualVal={f.cost_per_stem} onManualToggle={() => setF((p) => ({ ...p, costManual: !p.costManual }))} onManualChange={(vv) => setF((p) => ({ ...p, cost_per_stem: vv }))} />
        </div>
        )}
        <div>
          <Field label="Pochka sotuv narxi (so'm)"><input className="inp" type="number" value={f.sale_price_per_bunch} onChange={set("sale_price_per_bunch")} placeholder="Masalan: 50 000" /></Field>
          <PriceHint label="dona sotuv narxi" perStem={salePerStem} note={saleNote} manual={f.saleManual} manualVal={f.sale_price_per_stem} onManualToggle={() => setF((p) => ({ ...p, saleManual: !p.saleManual }))} onManualChange={(vv) => setF((p) => ({ ...p, sale_price_per_stem: vv }))} />
        </div>
      </div>

      <Section>Rasm</Section>
      <ImageInput value={f.image_url} onChange={(url) => setF((p) => ({ ...p, image_url: url }))} />

      {/* ⚠️ RETROAKTIV OGOHLANTIRISH — tannarx/pochka-dona o'zgarsa (adjust'ning sotilgan-tannarx ogohi bilan bir xil) */}
      {retroactive && (
        <div className="mt-4 flex items-start gap-2.5 rounded-[13px] border-[1.5px] p-3" style={{ borderColor: "var(--danger-ink)", background: "var(--danger-soft, rgba(160,74,74,.12))" }}>
          <AlertTriangle size={18} strokeWidth={2.2} className="mt-px shrink-0" style={{ color: "var(--danger-ink)" }} />
          <p className="text-[12.5px] font-bold leading-snug" style={{ color: "var(--danger-ink)" }}>
            Bu o&apos;zgarish avval yasalgan kataloglar tannarxiga ta&apos;sir qiladi — hisob-kitobdagi sof foyda (sotilganlar ham) siljiydi.
            {/* kelgan miqdor o'zgarsa — yuk jamilari ham siljiydi (alohida aytamiz) */}
            {"received_stems" in payload && (
              <span className="mt-1 block font-semibold">
                Kelgan miqdor o&apos;zgargani uchun partiya jami va <b>yuk jamilari</b> (dona va tannarx) ham qayta hisoblanadi.
              </span>
            )}
          </p>
        </div>
      )}
      {changedKeys.length > 0 && !retroactive && (
        <p className="mt-3 text-[11.5px]" style={{ color: "var(--muted)" }}>Faqat o&apos;zgargan maydon(lar) saqlanadi: {changedKeys.join(", ")}.</p>
      )}

      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={save} disabled={busy || changedKeys.length === 0} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : "Saqlash"}</button>
      </ModalFooter>
    </Modal>
  );
}
