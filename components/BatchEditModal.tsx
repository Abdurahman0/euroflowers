"use client";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Archive, Lock, Truck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { notifyReportDataChanged } from "@/lib/reportCache";
import { useStore, usePerm } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Section, Field } from "./Modal";
import DatePicker from "./DatePicker";
import Select from "./Select";
import ImageInput from "./ImageInput";
import { PriceHint } from "./BatchPriceFields";
import FreeBatchToggle from "./FreeBatchToggle";
import DualQtyInput, { defaultQtyMode, type QtyMode } from "./DualQtyInput";
import { Icon } from "./icons";
import { fmt, fmtDate } from "@/lib/format";
import { batchTitleNoHeight } from "@/lib/stockLabel";
import { DELIVERY, perStemFromBunch, roundingNote, buildBatchEditPayload, batchEditIsRetroactive, formatStemsAndBunches, receivedEditConsequence, spbPriceRecompute, describeBatchDeleteResult, type BatchEditForm, type BatchEditOriginal } from "@/lib/inventory";
import type { StockBatch, StockDelivery, Supplier } from "@/lib/types";

const num = (n: string | number | undefined | null) => (n == null || n === "" ? "" : String(Math.round(+n)));
const formFrom = (b: StockBatch): BatchEditForm => ({
  batch_number: b.batch_number ?? "",
  received_at: (b.received_at ?? "").slice(0, 10),
  height_cm: b.height_cm ? String(b.height_cm) : "",
  received_stems: b.received_stems != null ? String(b.received_stems) : "",
  delivery: b.delivery ?? 0,
  height_from_cm: b.height_from_cm ? String(b.height_from_cm) : "",
  height_to_cm: b.height_to_cm ? String(b.height_to_cm) : "",
  supplier: b.supplier ?? b.supplier_detail?.id ?? 0,
  is_active: b.is_active !== false,
  is_free: !!b.is_free,
  remainingManual: false,
  remaining_stems: b.remaining_stems != null ? String(b.remaining_stems) : "",
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
  const { canControl } = usePerm();
  // 403 oldini olish: adjust/close-issue bilan BIR XIL darvoza
  const canManage = canControl("inventory");
  const [f, setF] = useState<BatchEditForm>(() => formFrom(batch));
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const set = (k: keyof BatchEditForm) => (e: React.ChangeEvent<HTMLInputElement>) => { setF((p) => ({ ...p, [k]: e.target.value })); if (errs[k]) setErrs((x) => { const n = { ...x }; delete n[k]; return n; }); };

  // ⚠️ KELGAN MIQDOR — pochka sukut bo'yicha (create formadagi konvensiya)
  const [qtyMode, setQtyMode] = useState<QtyMode>(() => defaultQtyMode(batch.stems_per_bunch));
  // §3 — nav va yuk tahriri uchun ro'yxatlar
  const [deliveries, setDeliveries] = useState<StockDelivery[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  useEffect(() => {
    api.stockDeliveries({ is_active: true, ordering: "-received_at" }).then(setDeliveries).catch(() => {});
    api.suppliers({ is_active: true }).then(setSuppliers).catch(() => {});
  }, []);
  const [confirmDel, setConfirmDel] = useState(false);
  const [delBusy, setDelBusy] = useState(false);
  const orig: BatchEditOriginal = batch;
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
  // ⚠️ POCHKADA DONA o'zgarsa — dona narxi QAYTA hisoblanadi (pochka narxi / yangi spb).
  // ⚠️ TEKIN partiyada dona TANNARXI baribir 0 — «arvoh» qayta hisob ko'rsatilmaydi.
  const spbOrig = batch.stems_per_bunch || 0;
  const recompute = spbPriceRecompute(costBunch, saleBunch, spbOrig, spb, f.is_free);
  const spbChanged = recompute.changed;
  const deliveryChanged = f.delivery > 0 && f.delivery !== (batch.delivery ?? 0);
  const nextDelivery = deliveries.find((d) => d.id === f.delivery);
  // ⚠️ Yuk bor bo'lsa postavshik va kelgan sana UNDAN keladi — bu yerda o'qish uchun.
  const hasDelivery = f.delivery > 0 || (batch.delivery ?? 0) > 0;
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
      // ⚠️ Bizning qulf — ZAIF TAXMIN (faqat qoldiq≠kelgan). Server «ishlatilgan»ni
      // kengroq biladi (katalog/florist/lead/harakat), shuning uchun 400 kelsa
      // matnni AYNAN ko'rsatamiz VA maydonni o'shandan keyin qulflaymiz.
      if (e instanceof ApiError && e.fieldErrors) {
        setErrs(e.fieldErrors);
        showToast(e.message);
      } else showToast(e instanceof ApiError ? e.message : "Saqlashda xatolik");
      setBusy(false);
    }
  };

  /** O'CHIRISH — server tarixi bo'lsa ARXIVLAYDI (200), bo'lmasa o'chiradi (204). */
  const doDelete = async () => {
    setDelBusy(true);
    try {
      const body = await api.deleteStockBatch(batch.id);
      const r = describeBatchDeleteResult(body);
      notifyReportDataChanged();
      // ⚠️ Natija AYNAN nima bo'lganini aytadi — «o'chirildi» deb aldamaymiz.
      showToast(r.archived ? `✓ ${r.message}` : "✓ Partiya o'chirildi");
      onSaved({ ...batch, is_active: r.archived ? false : batch.is_active });
      onClose();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "O'chirib bo'lmadi");
      setDelBusy(false);
      setConfirmDel(false);
    }
  };

  const Err = ({ k }: { k: string }) => errs[k] ? <p className="mt-1 text-[11.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>{errs[k]}</p> : null;

  return (
    <Modal onClose={onClose} width={560}>
      <ModalHeader icon={<Icon name="sklad" size={20} />} title="Partiyani tahrirlash" sub={`${batchTitleNoHeight(batch)} · №${batch.batch_number}`} onClose={onClose} />

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
        {/* ⚠️ KELGAN SANA — yuk tanlangan bo'lsa YUKDAN keladi, tahrirlanmaydi (desync bo'lardi) */}
        {hasDelivery ? (
          <Field label="Kelgan sana">
            <div className="flex items-center gap-2 rounded-[12px] border px-3 py-2.5 text-[13px] font-semibold"
              style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-2)" }}>
              <Lock size={14} strokeWidth={2.1} style={{ color: "var(--muted)" }} />
              {fmtDate(batch.delivery_detail?.received_at ?? batch.received_at)}
            </div>
            <span className="mt-1 block text-[11.5px]" style={{ color: "var(--muted)" }}>Yukdan olinadi</span>
          </Field>
        ) : (
          <Field label="Kelgan sana"><DatePicker value={f.received_at} onChange={(vv) => setF((p) => ({ ...p, received_at: vv }))} placeholder="Sana" ariaLabel="Kelgan sana" /></Field>
        )}
        <Field label="Bo'y — dan (sm)"><input className="inp" type="number" value={f.height_from_cm} onChange={set("height_from_cm")} placeholder="Ixtiyoriy" /></Field>
        <Field label="Bo'y — gacha (sm)"><input className="inp" type="number" value={f.height_to_cm} onChange={set("height_to_cm")} placeholder="Ixtiyoriy" /></Field>
        <Field label="Minimal sotuv (dona)"><input className="inp" type="number" value={f.minimum_sale_stems} onChange={set("minimum_sale_stems")} placeholder="Masalan: 5" /></Field>
        <Field label="Pochkada dona"><input className="inp" type="number" value={f.stems_per_bunch} onChange={set("stems_per_bunch")} placeholder="Masalan: 25" /></Field>
        {/* ⚠️ GUL NAVI MAYDONI OLIB TASHLANDI — kirim endi navsiz (`flower`), nav esa
            API'da ixtiyoriy. Eski partiyaning navi sarlavhada KO'RINADI (batchTitleNoHeight),
            lekin TAHRIRLANMAYDI va `variant` HECH QACHON yuborilmaydi.
            ⚠️ Xato yozilgan gulni tuzatish → `change-flower` amali (hali ulanmagan). */}
        <Field label="Qaysi yukka" span>
          <Select value={f.delivery} onChange={(vv) => setF((p) => ({ ...p, delivery: +vv }))} searchable placeholder="Yukni tanlang"
            options={deliveries.map((d) => ({ value: d.id, label: DELIVERY.label(d.number, fmtDate(d.received_at)), sub: d.supplier_detail?.name ?? "postavshiksiz" }))} />
          {deliveryChanged && (
            <span className="mt-1 block text-[11.5px] font-bold" style={{ color: "var(--danger-ink)" }}>
              ⚠️ Partiya boshqa yukka ko&apos;chadi — yuk raqami, sanasi va <b>POSTAVSHIK</b> o&apos;zgaradi
              ({batch.supplier_detail?.name ?? "postavshiksiz"} → {nextDelivery?.supplier_detail?.name ?? "postavshiksiz"}).
              Shu bilan qaysi postavshikning «Umumiy sotib olingan» summasiga kirishi ham o&apos;zgaradi.
            </span>
          )}
        </Field>
        {/* ⚠️ POSTAVSHIK — FAQAT yuksiz partiyada tahrirlanadi (yuk bo'lsa undan keladi) */}
        <Field label="Postavshik" span>
          {hasDelivery ? (
            <>
              <div className="flex items-center gap-2 rounded-[12px] border px-3 py-2.5 text-[13px] font-semibold"
                style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-2)" }}>
                <Lock size={14} strokeWidth={2.1} style={{ color: "var(--muted)" }} />
                {(nextDelivery ?? batch.delivery_detail) ? (nextDelivery?.supplier_detail?.name ?? batch.supplier_detail?.name ?? "postavshiksiz") : "postavshiksiz"}
              </div>
              <span className="mt-1 block text-[11.5px]" style={{ color: "var(--muted)" }}>
                Yukdan olinadi — o&apos;zgartirish uchun «Qaysi yukka»ni almashtiring.
              </span>
            </>
          ) : (
            <Select value={f.supplier} onChange={(vv) => setF((p) => ({ ...p, supplier: +vv }))} searchable placeholder="Postavshikni tanlang"
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))} />
          )}
        </Field>
        <Field label="Izoh" span><input className="inp" value={f.notes} onChange={set("notes")} placeholder="Ixtiyoriy" /></Field>
      </div>

      {/* FAOL — arxivdan qaytarish uchun ham kerak (o'chirish EMAS) */}
      <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-[13px] border px-3.5 py-3"
        style={{ borderColor: f.is_active ? "var(--border)" : "var(--warning-ink, #8a6d1f)" }}>
        <span className="min-w-0">
          <span className="block text-[13px] font-bold">Faol partiya</span>
          <span className="block text-[11.5px]" style={{ color: "var(--muted)" }}>
            {f.is_active ? "Sklad ro'yxatida ko'rinadi." : "⚠️ Arxivlangan — sklad ro'yxatidan yashiriladi (tarixi saqlanadi)."}
          </span>
        </span>
        <input type="checkbox" checked={f.is_active} onChange={(e) => setF((p) => ({ ...p, is_active: e.target.checked }))} className="h-4 w-4 shrink-0 accent-[var(--primary)]" />
      </label>

      {/* ⚠️ POCHKADA DONA o'zgarsa dona narxi qayta hisoblanadi — submitdan OLDIN ko'rsatamiz */}
      {spbChanged && (
        <div className="mt-2 rounded-[12px] px-3.5 py-2.5 text-[12.5px] font-semibold" style={{ background: "color-mix(in srgb, #b3873a 12%, transparent)", color: "var(--warning-ink, #8a6d1f)" }}>
          <div>Pochkada dona: {spbOrig} → <b>{spb}</b> — pochka narxi o&apos;zgarmaydi, dona narxi qayta hisoblanadi:</div>
          <div className="mt-1 flex flex-wrap gap-x-4 tabular-nums">
            {recompute.showCost
              ? <span>Dona tannarx {fmt(recompute.costFrom)} → <b>{fmt(recompute.costTo)}</b></span>
              : <span>Dona tannarx <b>0</b> (tekin gul — o&apos;zgarmaydi)</span>}
            <span>Dona sotuv {fmt(recompute.saleFrom)} → <b>{fmt(recompute.saleTo)}</b></span>
          </div>
          <div className="mt-0.5 font-medium">Eng yaqin 100 ga yaxlitlanadi; aniq hisob ham yangilanadi.</div>
        </div>
      )}

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
        {/* SPEC izohi — maydon ostida DOIM turadi (faqat o'zgarganda emas) */}
        <p className="-mt-1 text-[11.5px]" style={{ color: "var(--muted)" }}>
          Bu partiyadan <b style={{ color: "var(--text-2)" }}>{rc.used.toLocaleString("ru")} dona</b> ishlatilgan.
          Kamida shuncha bo&apos;lishi kerak.
        </p>

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

        {/* ⚠️ QOLDIQNI QO'LDA BELGILASH — inventarizatsiya uchun; SUKUT BO'YICHA O'CHIQ.
            Yoqilmasa qoldiq payload'ga kirmaydi va SERVER uni o'zi qayta hisoblaydi. */}
        <label className="flex cursor-pointer items-start gap-2.5 rounded-[13px] border px-3.5 py-3"
          style={f.remainingManual ? { borderColor: "var(--warning-ink, #8a6d1f)", background: "color-mix(in srgb, #b3873a 10%, transparent)" } : { borderColor: "var(--border)" }}>
          <input type="checkbox" checked={f.remainingManual}
            onChange={(e) => setF((p) => ({ ...p, remainingManual: e.target.checked, remaining_stems: e.target.checked ? String(batch.remaining_stems ?? 0) : "" }))}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--warning-ink,#8a6d1f)]" />
          <span className="min-w-0">
            <span className="block text-[13px] font-bold">Qoldiqni qo&apos;lda belgilash (inventarizatsiya)</span>
            <span className="mt-0.5 block text-[11.5px]" style={{ color: "var(--muted)" }}>
              {f.remainingManual
                ? "⚠️ Server avtomatik hisobi BEKOR QILINADI — aynan siz yozgan son qo'yiladi."
                : "Belgilanmasa qoldiqni server o'zi hisoblaydi (kelgan farqi qancha bo'lsa, qoldiq o'shancha siljiydi)."}
            </span>
          </span>
        </label>
        {f.remainingManual && (
          <div>
            <div className="mb-1 text-[12px] font-bold" style={{ color: "var(--text-2)" }}>Qoldiq (dona)</div>
            <input className="inp" inputMode="numeric" value={f.remaining_stems}
              onChange={(e) => setF((p) => ({ ...p, remaining_stems: e.target.value.replace(/\D/g, "") }))} placeholder="Masalan: 65" />
            <Err k="remaining_stems" />
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

      {/* ARXIVLASH / O'CHIRISH — nav xato bo'lgan holatning yagona chorasi */}
      {confirmDel ? (
        <div className="mt-4 rounded-[13px] border-[1.5px] p-3.5" style={{ borderColor: "var(--danger-ink)", background: "var(--danger-soft, rgba(160,74,74,.12))" }}>
          <p className="text-[12.5px] font-bold" style={{ color: "var(--danger-ink)" }}>Bu partiyani o&apos;chirasizmi?</p>
          {/* ⚠️ IKKALA NATIJANI ham rostini aytamiz — qaysi biri bo'lishi partiya tarixiga bog'liq */}
          <ul className="mt-1.5 list-disc pl-4 text-[11.5px] font-medium leading-relaxed" style={{ color: "var(--danger-ink)" }}>
            <li>Sklad tarixi <b>bo&apos;lsa</b> — partiya o&apos;chmaydi, <b>arxivlanadi</b> (ro&apos;yxatdan yashiriladi, tarix saqlanadi).</li>
            <li>Tarixi <b>bo&apos;lmasa</b> — butunlay <b>o&apos;chadi</b>.</li>
          </ul>
          <p className="mt-1.5 text-[11.5px] font-medium" style={{ color: "var(--danger-ink)" }}>Qaysi biri bo&apos;lgani saqlangandan keyin aytiladi.</p>
          <div className="mt-2.5 flex gap-2">
            <button onClick={() => setConfirmDel(false)} className="btn-ghost !py-1.5 !text-[12.5px]">Bekor</button>
            <button onClick={doDelete} disabled={delBusy}
              className="rounded-[11px] px-3 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-60"
              style={{ background: "var(--danger-ink)" }}>
              {delBusy ? "Bajarilmoqda…" : "Ha, davom etish"}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setConfirmDel(true)}
          className="mt-4 flex items-center gap-1.5 text-[12px] font-bold underline underline-offset-2"
          style={{ color: "var(--danger-ink)" }}>
          <Archive size={13} strokeWidth={2.1} /> Partiyani arxivlash / o&apos;chirish
        </button>
      )}

      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={save} disabled={busy || changedKeys.length === 0} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : "Saqlash"}</button>
      </ModalFooter>
    </Modal>
  );
}
