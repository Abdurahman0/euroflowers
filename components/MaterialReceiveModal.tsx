"use client";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Plus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { notifyReportDataChanged } from "@/lib/reportCache";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Section, Field } from "./Modal";
import Select from "./Select";
import { MaterialModal } from "./MaterialSklad";
import { fmt, fmtDate } from "@/lib/format";
import { PACKAGING_LABEL, MATERIAL_DELIVERY } from "@/lib/inventory";
import { configFor, quantityDual, receivePreview, buildReceivePayload, receiveZeroCost } from "@/lib/materialUnit";
import type { MaterialDelivery, Packaging, PackagingType } from "@/lib/types";

const GROUP_ORDER: PackagingType[] = ["wrap", "basket", "box", "other"];
const normType = (t: string): PackagingType => (GROUP_ORDER.includes(t as PackagingType) ? (t as PackagingType) : "other");

/**
 * MATERIAL KIRITISH (receive) — bitta yukka ketma-ket bir necha material kiritiladi.
 * ⚠️ CONSEQUENCE preview: «Soni 50 → 150», «Tannarx 6 000 → 7 000» (cost berilsa) yoki
 * «Tannarx o'zgarmaydi» (bo'sh). Tannarx berilsa — materialning tannarxi QAYTA YOZILADI
 * (retroaktiv: shu materialdan yasalgan eski kataloglar tannarxiga ta'sir).
 * Muvaffaqiyatdan keyin modal OCHIQ qoladi (faqat item maydonlari tozalanadi) + qo'shilganlar ro'yxati.
 */
export default function MaterialReceiveModal({ delivery, onClose, onReceived }: {
  delivery: MaterialDelivery;
  onClose: () => void;
  onReceived: () => void;
}) {
  const { showToast } = useStore();
  const [materials, setMaterials] = useState<Packaging[]>([]);
  const [newMaterial, setNewMaterial] = useState(false);
  const [packaging, setPackaging] = useState(0);
  const [qty, setQty] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  // shu yukda SHU SESSIYADA nima kiritildi (yopmasdan ko'rsatamiz)
  const [added, setAdded] = useState<{ name: string; qty: number; costChanged: boolean }[]>([]);

  const loadMaterials = () => api.materials({ is_active: true, page_size: "all" }).then(setMaterials).catch(() => {});
  useEffect(() => { loadMaterials(); }, []);

  const sel = materials.find((m) => m.id === packaging);
  // ⚠️ FORMA KONFIGURATSIYASI — materialning `unit`idan (yagona manba: lib/materialUnit.ts).
  // Tarqoq if/else yo'q: yorliqlar, placeholder'lar va preview formulasi SHU config'dan keladi.
  const cfg = configFor(sel);
  // ⚠️ picker: composer'dagi kabi TURI bo'yicha guruhlangan, qoldiq (ikki birlikda) + joriy tannarx bilan
  const opts = useMemo(() => [...materials]
    .sort((a, b) => GROUP_ORDER.indexOf(normType(a.packaging_type)) - GROUP_ORDER.indexOf(normType(b.packaging_type)) || (a.name_uz || "").localeCompare(b.name_uz || ""))
    .map((m) => ({ value: m.id, label: m.name_uz || m.name_ru, sub: `${PACKAGING_LABEL[normType(m.packaging_type)]} · ${configFor(m).label} · qoldiq ${quantityDual(m)} · ${fmt(m.cost_price)}` })), [materials]);

  // preview = backend AYNAN nima hisoblashini ko'rsatadi (derivatsiya yashirilmaydi)
  const preview = receivePreview(sel, qty, costPrice);
  const zeroCost = receiveZeroCost(costPrice);

  const submit = async () => {
    const built = buildReceivePayload({ packaging, material: sel, qty, cost: costPrice || null, reason });
    if (!built.ok) { setErrs({ [!packaging ? "packaging" : "quantity"]: built.reason }); return showToast(built.reason); }
    setBusy(true); setErrs({});
    try {
      await api.materialReceive(delivery.id, built.req); // ⚠️ POST — tasdiqdan keyin
      const costChanged = "cost_price" in built.req || "cost_per_bunch" in built.req;
      // ro'yxatda SKLADGA QO'SHILGAN dona ko'rsatiladi (pochkada ham) — preview'dan olamiz
      const addedQty = preview.ok ? preview.quantity : (built.req.quantity ?? 0);
      setAdded((a) => [{ name: sel?.name_uz || sel?.name_ru || `#${packaging}`, qty: addedQty, costChanged }, ...a]);
      showToast(`✓ ${sel?.name_uz ?? "Material"} × ${addedQty} dona kiritildi`);
      // MODAL OCHIQ qoladi — faqat item maydonlari tozalanadi
      setPackaging(0); setQty(""); setCostPrice(""); setReason("");
      loadMaterials(); // qoldiq/tannarx yangilansin (keyingi kirim preview'i uchun)
      notifyReportDataChanged();
      onReceived(); // yuk item'lari + jamilarini yangilaydi
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) { setErrs(e.fieldErrors); showToast(e.message); }
      else showToast(e instanceof ApiError ? e.message : "Kiritib bo'lmadi");
      setBusy(false);
      return;
    }
    setBusy(false);
  };

  const Err = ({ k }: { k: string }) => errs[k] ? <p className="mt-1 text-[11.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>{errs[k]}</p> : null;

  return (
    <>
      <Modal onClose={onClose} width={520}>
        <ModalHeader icon={<Plus size={19} strokeWidth={1.9} />} title={MATERIAL_DELIVERY.receive} sub={MATERIAL_DELIVERY.labelFull(delivery.number, fmtDate(delivery.received_at), delivery.supplier_detail?.name)} onClose={onClose} />

        <Section>Material</Section>
        <Field label="Qaysi material" span>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Select value={packaging} onChange={(v) => { setPackaging(+v); setErrs((x) => { const n = { ...x }; delete n.packaging; return n; }); }} placeholder="Materialni tanlang" searchable options={opts} />
            </div>
            {/* ⚠️ material OLDIN yaratilishi kerak — shu yerda ochish (nested modal, receive holati saqlanadi) */}
            <button type="button" onClick={() => setNewMaterial(true)} className="icon-btn border shrink-0" style={{ borderColor: "var(--border-strong)", color: "var(--text-2)" }} title="Yangi material" aria-label="Yangi material">
              <Plus size={16} strokeWidth={2} />
            </button>
          </div>
          <Err k="packaging" />
        </Field>

        {/* ⚠️ MAYDONLAR BIRLIKKA QARAB — yorliq/placeholder config'dan (piece: dona+dona narxi, bunch: pochka+pochka narxi) */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={cfg.qtyLabel}><input className="inp" inputMode="numeric" value={qty} onChange={(e) => { setQty(e.target.value.replace(/\D/g, "")); if (errs.quantity) setErrs((x) => { const n = { ...x }; delete n.quantity; return n; }); }} placeholder={cfg.qtyPlaceholder} /><Err k="quantity" /></Field>
          <Field label={cfg.costLabel}><input className="inp" inputMode="numeric" value={costPrice} onChange={(e) => setCostPrice(e.target.value.replace(/[^\d]/g, ""))} placeholder={cfg.costPlaceholder} /><Err k="cost_price" /><Err k="cost_per_bunch" /></Field>
        </div>
        <Field label="Izoh (ixtiyoriy)" span><input className="inp" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Masalan: yangi partiya" /></Field>

        {/* ⚠️ units_per_bunch yo'q bo'lsa TAXMIN QILMAYMIZ — aniq xabar bilan bloklaymiz */}
        {sel && !preview.ok && qty.trim() !== "" && (
          <p className="mt-3 flex items-start gap-1.5 rounded-[10px] px-2.5 py-2 text-[12px] font-bold" style={{ background: "var(--danger-soft, rgba(160,74,74,.14))", color: "var(--danger-ink)" }}>
            <AlertTriangle size={14} strokeWidth={2.2} className="mt-px shrink-0" /> {preview.reason}
          </p>
        )}

        {/* ⚠️ CONSEQUENCE — submit'dan OLDIN backend AYNAN nima hisoblashini ko'rsatamiz.
            Pochkada derivatsiya YASHIRILMAYDI: «5 pochka × 20 = 100 dona · 60 000 ÷ 20 = 3 000 so'm/dona». */}
        {sel && preview.ok && (
          <div className="mt-3 flex flex-col gap-1 rounded-[12px] px-3 py-2.5 text-[13px] font-semibold" style={{ background: "var(--surface-2)" }}>
            {preview.lines.length > 0 && (
              <div className="mb-0.5 flex flex-col gap-0.5 border-b pb-1.5" style={{ borderColor: "var(--line2)" }}>
                {preview.lines.map((l, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[12.5px] tabular-nums" style={{ color: "var(--text-2)" }}>
                    <span style={{ color: "var(--primary)" }}>=</span> {l}
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between"><span style={{ color: "var(--text-2)" }}>Qoldiq</span><span className="tabular-nums">{sel.quantity.toLocaleString("ru")} → <b style={{ color: "var(--primary)" }}>{preview.newQuantity.toLocaleString("ru")}</b> dona</span></div>
            <div className="flex items-center justify-between">
              <span style={{ color: "var(--text-2)" }}>Dona tannarxi</span>
              {preview.costPerPiece != null
                ? <span className="tabular-nums">{fmt(sel.cost_price)} → <b style={{ color: "var(--acc)" }}>{fmt(preview.costPerPiece)}</b></span>
                : <span style={{ color: "var(--muted)" }}>o&apos;zgarmaydi</span>}
            </div>
            {preview.total != null && (
              <div className="flex items-center justify-between border-t pt-1" style={{ borderColor: "var(--line2)" }}>
                <span style={{ color: "var(--text-2)" }}>Bu kirim jami</span><b className="tabular-nums" style={{ color: "var(--acc)" }}>{fmt(preview.total)}</b>
              </div>
            )}
          </div>
        )}
        {zeroCost && (
          <p className="mt-2 flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[12px] font-bold" style={{ background: "var(--danger-soft, rgba(160,74,74,.14))", color: "var(--danger-ink)" }}>
            <AlertTriangle size={14} strokeWidth={2.2} className="shrink-0" /> Tannarx 0 qilinadi — bu materialdan yasalgan katalog tannarxi kam ko&apos;rinadi.
          </p>
        )}

        {added.length > 0 && (
          <div className="mt-4">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[2px]" style={{ color: "var(--primary)" }}>Shu yukka kiritildi ({added.length})</div>
            <div className="flex flex-col gap-1">
              {added.map((a, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="flex items-center gap-1.5"><CheckCircle2 size={13} strokeWidth={2.2} style={{ color: "var(--success-ink, #3d8a5f)" }} /> {a.name}</span>
                  <span className="tabular-nums" style={{ color: "var(--text-2)" }}>× {a.qty}{a.costChanged ? " · tannarx yangilandi" : ""}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <ModalFooter>
          <button onClick={onClose} className="btn-ghost">Yopish</button>
          <button onClick={submit} disabled={busy || !packaging || !preview.ok} className="btn-primary disabled:opacity-60">{busy ? "Kiritilmoqda…" : "Kiritish"}</button>
        </ModalFooter>
      </Modal>

      {newMaterial && (
        <MaterialModal material={null} onClose={() => setNewMaterial(false)} onSaved={(m) => { setMaterials((ms) => [m, ...ms]); setPackaging(m.id); setNewMaterial(false); }} />
      )}
    </>
  );
}
