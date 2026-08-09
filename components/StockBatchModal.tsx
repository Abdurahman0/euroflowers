"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Truck } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Section, Field } from "./Modal";
import Select from "./Select";
import ImageInput from "./ImageInput";
import DualQtyInput, { type QtyMode } from "./DualQtyInput";
import DeliveryModal from "./DeliveryModal";
import { PriceHint } from "./BatchPriceFields";
import FreeBatchToggle from "./FreeBatchToggle";
import { Icon } from "./icons";
import { fmt, fmtDate } from "@/lib/format";
import { DELIVERY, buildBatchPayload, perStemFromBunch, roundingNote } from "@/lib/inventory";
import type { Flower, StockBatch, StockDelivery } from "@/lib/types";

/**
 * GUL PARTIYASI (StockBatch) yaratish — HAR DOIM bir YUK (delivery) ichida.
 *   • `delivery` prop berilsa (DeliveryDrawer'dan) — yuk BOG'LANGAN, o'zgarmaydi;
 *     raqam/sana/postavshik yuborilMAYDI, matn qilib ko'rsatiladi.
 *   • prop bo'lmasa (Partiyalar tabidagi «Yangi partiya») — yuk SELECT'i chiqadi
 *     (mavjud yuklar + «Yangi yuk»). Baribir yuk-bog'langan bo'ladi (bitta oqim).
 * NARX: pochka ASOSIY; dona narxi PREVIEW (yaxlitlangan). Standartda pochka only
 * yuboriladi; «qo'lda kiritish» bosilsa dona narxi ham (server verbatim oladi).
 */
export default function StockBatchModal({ delivery = null, onClose, onSaved }: {
  delivery?: StockDelivery | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useStore();
  // ⚠️ NAV EMAS, GUL. Kirimda nav so'ralmaydi (jonli OpenAPI: `flower` writeOnly —
  // «Gul. Kirimda shu yuboriladi, nav so'ralmaydi»); serverning o'zi «general» nav yasaydi.
  const [flowers, setFlowers] = useState<Flower[]>([]);
  const [deliveries, setDeliveries] = useState<StockDelivery[]>([]);
  const [flowerId, setFlowerId] = useState(0);
  const [selDelivery, setSelDelivery] = useState<number>(delivery?.id ?? 0);
  const [newDelivery, setNewDelivery] = useState(false);
  const [f, setF] = useState({
    stems_per_bunch: "", height_cm: "",
    cost_per_bunch: "", sale_price_per_bunch: "",
    cost_per_stem: "", sale_price_per_stem: "", // qo'lda override
    minimum_sale_stems: "", image_url: "",
  });
  const [costManual, setCostManual] = useState(false);
  const [saleManual, setSaleManual] = useState(false);
  const [qtyMode, setQtyMode] = useState<QtyMode>("bunches");
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  // TEKIN GUL — yoqilsa tannarx maydonlari yashiriladi (qiymat formada saqlanadi)
  const [isFree, setIsFree] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => { setF({ ...f, [k]: e.target.value }); if (errs[k]) setErrs((x) => { const n = { ...x }; delete n[k]; return n; }); };

  useEffect(() => {
    // ⚠️ OLDINDAN TANLANMAYDI — operator gulni O'ZI tanlasin (tasodifan boshqa gul kirmasin)
    api.flowers({ is_active: true, ordering: "name_uz", page_size: "all" })
      .then(setFlowers)
      .catch(() => showToast("Gullarni yuklab bo'lmadi"));
    // Yuk ro'yxatini DOIM olamiz (eng yangi birinchi) — select butun modal davomida INTERAKTIV qoladi.
    // Pre-bound (prop) yuk ro'yxatda bo'lmasa oldiga qo'shamiz (o'zgartirilishi mumkin, lekin ko'rinadi).
    api.stockDeliveries({ is_active: true, ordering: "-received_at", page_size: "all" })
      .then((ds) => setDeliveries(delivery && !ds.some((d) => d.id === delivery.id) ? [delivery, ...ds] : ds))
      .catch(() => { if (delivery) setDeliveries([delivery]); });
  }, [showToast, delivery]);

  const flower = useMemo(() => flowers.find((x) => x.id === flowerId), [flowers, flowerId]);
  // ⚠️ Nav yo'q → pochkadagi dona uchun nav standarti ham yo'q; 20 — forma sukuti
  const spb = +f.stems_per_bunch || 20;
  const receivedStems = qtyMode === "bunches" ? Math.round((+qty || 0) * spb) : Math.round(+qty || 0);

  // TANLANGAN yuk — ro'yxatdan (yuklanmagunча prop'ga tayanadi). selDelivery o'zgarganda
  // darhol qayta hisoblanadi → pastdagi read-only satr eskirmaydi.
  const boundDelivery = deliveries.find((d) => d.id === selDelivery) ?? (delivery?.id === selDelivery ? delivery : null);

  // NARX preview — pochkadan dona (yaxlitlangan) yoki qo'lda kiritilgan
  const costBunch = +f.cost_per_bunch || 0;
  const saleBunch = +f.sale_price_per_bunch || 0;
  const costNote = roundingNote(costBunch, spb);
  const saleNote = roundingNote(saleBunch, spb);
  const costPerStem = costManual ? (+f.cost_per_stem || 0) : perStemFromBunch(costBunch, spb);
  const salePerStem = saleManual ? (+f.sale_price_per_stem || 0) : perStemFromBunch(saleBunch, spb);
  const margin = salePerStem - costPerStem;
  const marginPct = costPerStem ? Math.round((margin / costPerStem) * 100) : 0;

  const save = async () => {
    if (!boundDelivery) { setErrs({ delivery: "Yukni tanlang (yoki yangi yuk oching)" }); return showToast("Avval yukni tanlang"); }
    if (!flowerId) { setErrs({ flower: "Gulni tanlang" }); return showToast("Gulni tanlang"); }
    if (!qty || receivedStems <= 0) return showToast("Miqdorni kiriting");
    if (!(+f.height_cm > 0)) { setErrs({ height_cm: "Bo'yini kiriting (majburiy)" }); return showToast("Gul bo'yini kiriting"); }
    setBusy(true); setErrs({});
    try {
      const payload = buildBatchPayload({
        flower: flowerId,
        deliveryId: boundDelivery.id, // ⚠️ yuk-bog'langan → batch_number/received_at/supplier YUBORILMAYDI
        heightCm: +f.height_cm,
        stemsPerBunch: spb,
        ...(qtyMode === "bunches" ? { receivedBunches: +qty } : { receivedStems }),
        isFree,
        costPerBunch: f.cost_per_bunch || null,
        costPerStem: costManual ? (f.cost_per_stem || null) : null,
        salePerBunch: f.sale_price_per_bunch || null,
        salePerStem: saleManual ? (f.sale_price_per_stem || null) : null,
        minimumSaleStems: +f.minimum_sale_stems || 1,
        imageUrl: f.image_url || flower?.image_url || "",
      });
      await api.createStockBatch(payload as Partial<StockBatch>);
      showToast(`✓ Partiya qo'shildi: ${flower?.name_uz ?? "Gul"}`);
      onSaved();
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) { setErrs(e.fieldErrors); showToast(e.message); }
      else showToast(e instanceof ApiError ? e.message : "Saqlashda xatolik");
      setBusy(false);
    }
  };

  const Err = ({ k }: { k: string }) => errs[k] ? <p className="mt-1 text-[11.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>{errs[k]}</p> : null;

  return (
    <>
      <Modal onClose={onClose} width={560}>
        <ModalHeader icon={<Icon name="sklad" size={20} />} title="Yangi partiya" sub={boundDelivery ? DELIVERY.labelFull(boundDelivery.number, fmtDate(boundDelivery.received_at), boundDelivery.supplier_detail?.name) : "Yuk ichiga gul qo'shish"} onClose={onClose} />

        {/* YUK — select BUTUN modal davomida interaktiv (o'zgartirsa, pastdagi read-only satr
            darhol yangilanadi). Raqam/sana/postavshik shu tanlangan yukdan olinadi. */}
        <Section>Yuk</Section>
        <Field label="Qaysi yukka" span>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Select value={selDelivery} onChange={(v) => { setSelDelivery(+v); setErrs((x) => { const n = { ...x }; delete n.delivery; return n; }); }} placeholder="Yukni tanlang" searchable
                options={deliveries.map((d) => ({ value: d.id, label: DELIVERY.label(d.number, fmtDate(d.received_at)), sub: d.supplier_detail?.name ?? "postavshiksiz" }))} />
            </div>
            <button type="button" onClick={() => setNewDelivery(true)} className="icon-btn border shrink-0" style={{ borderColor: "var(--border-strong)", color: "var(--text-2)" }} title={DELIVERY.neu} aria-label={DELIVERY.neu}>
              <Plus size={16} strokeWidth={2} />
            </button>
          </div>
          <Err k="delivery" />
        </Field>
        {/* DERIVED read-only tasdiq — tanlangan yukdan (misfiling'дан saqlaydi); o'zgarsa darhol yangilanadi */}
        {boundDelivery && (
          <div className="mt-2 flex items-center gap-2.5 rounded-[13px] border p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <Truck size={15} strokeWidth={2} style={{ color: "var(--primary)" }} />
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-bold">{DELIVERY.label(boundDelivery.number, fmtDate(boundDelivery.received_at))}</div>
              <div className="text-[11px]" style={{ color: "var(--muted)" }}>{boundDelivery.supplier_detail?.name ?? "postavshiksiz"}{boundDelivery.note ? ` · ${boundDelivery.note}` : ""}</div>
            </div>
            <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>raqam · sana · postavshik shu yukdan</span>
          </div>
        )}

        {/* ⚠️ BITTA TANLAGICH — nav/rang so'ralmaydi. Ilgari «Gul turi» → «Gul navi»
            zanjiri bor edi va operator ikkinchi ro'yxatni ko'rish uchun avval turini
            tanlashi kerak edi. Server endi navni O'ZI yasaydi. */}
        <Section>Gul</Section>
        <Field label="Qaysi gul" span>
          <Select searchable value={flowerId} placeholder="Gulni tanlang" searchPlaceholder="Gul nomi…"
            onChange={(v) => { setFlowerId(+v); setErrs((x) => { const n = { ...x }; delete n.flower; return n; }); }}
            options={flowers.map((fl) => ({ value: fl.id, label: fl.name_uz }))} />
          <Err k="flower" />
        </Field>

        <Section>Miqdor</Section>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Gul bo'yi (sm)"><input className="inp" type="number" value={f.height_cm} onChange={set("height_cm")} placeholder="Masalan: 60" /><Err k="height_cm" /></Field>
          <Field label="Pochkada nechta dona"><input className="inp" type="number" value={f.stems_per_bunch} onChange={set("stems_per_bunch")} placeholder="Masalan: 20" /></Field>
          <div>
            <DualQtyInput mode={qtyMode} value={qty} stemsPerBunch={spb} onMode={setQtyMode} onValue={(v) => { setQty(v); setErrs((x) => { const n = { ...x }; delete n.received_stems; delete n.received_bunches; return n; }); }} label="Kelgan miqdor" />
            <Err k="received_stems" />
            <Err k="received_bunches" />
          </div>
        </div>
        {receivedStems > 0 && <p className="mt-2 text-[13px]" style={{ color: "var(--text-2)" }}>Jami kirim: <b>{receivedStems} dona</b></p>}

        <Section>Narx — pochkadan hisoblanadi</Section>
        {/* ⚠️ TEKIN GUL — NARX bo'limining TEPASIDA; yoqilsa tannarx ustuni CHIZILMAYDI */}
        <FreeBatchToggle checked={isFree} onChange={setIsFree} />
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* TANNARX — tekin gulda umuman ko'rsatilmaydi */}
          {!isFree && (
          <div>
            <Field label="Pochka tannarxi (so'm)"><input className="inp" type="number" value={f.cost_per_bunch} onChange={set("cost_per_bunch")} placeholder="Masalan: 25 000" /></Field>
            <PriceHint label="dona tannarxi" perStem={costPerStem} note={costNote} manual={costManual} manualVal={f.cost_per_stem} onManualToggle={() => setCostManual((m) => !m)} onManualChange={(v) => setF({ ...f, cost_per_stem: v })} />
          </div>
          )}
          {/* SOTUV */}
          <div>
            <Field label="Pochka sotuv narxi (so'm)"><input className="inp" type="number" value={f.sale_price_per_bunch} onChange={set("sale_price_per_bunch")} placeholder="Masalan: 50 000" /></Field>
            <PriceHint label="dona sotuv narxi" perStem={salePerStem} note={saleNote} manual={saleManual} manualVal={f.sale_price_per_stem} onManualToggle={() => setSaleManual((m) => !m)} onManualChange={(v) => setF({ ...f, sale_price_per_stem: v })} />
          </div>
          <Field label="Minimal sotuv (dona)"><input className="inp" type="number" value={f.minimum_sale_stems} onChange={set("minimum_sale_stems")} placeholder="Masalan: 5" /></Field>
        </div>
        {isFree && salePerStem > 0 && (
          <p className="mt-2 rounded-[11px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "color-mix(in srgb, var(--acc) 12%, transparent)", color: "var(--acc)" }}>
            Tekin gul — tannarx 0. Bundan yasalgan katalogda gul tannarxi qo&apos;shilmaydi, foyda 100% ko&apos;rinadi (bu haqiqiy).
          </p>
        )}
        {!isFree && margin !== 0 && costPerStem > 0 && (
          <p className="mt-2 rounded-[11px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: margin > 0 ? "var(--success-soft, rgba(61,138,95,.14))" : "var(--danger-soft, rgba(160,74,74,.12))", color: margin > 0 ? "var(--success-ink, #3d8a5f)" : "var(--danger-ink)" }}>
            Foyda: {margin > 0 ? "+" : ""}{fmt(margin)}/dona ({marginPct}%)
          </p>
        )}

        <Section>Rasm</Section>
        <ImageInput value={f.image_url} onChange={(url) => setF({ ...f, image_url: url })} />

        <ModalFooter>
          <button onClick={onClose} className="btn-ghost">Bekor</button>
          <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : "Partiya qo'shish"}</button>
        </ModalFooter>
      </Modal>

      {newDelivery && (
        <DeliveryModal onClose={() => setNewDelivery(false)} onSaved={(d) => { setDeliveries((ds) => [d, ...ds]); setSelDelivery(d.id); setNewDelivery(false); }} />
      )}
    </>
  );
}
