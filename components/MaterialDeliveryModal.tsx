"use client";
import { useEffect, useState } from "react";
import { Plus, PackageOpen } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Section, Field } from "./Modal";
import Select from "./Select";
import DatePicker from "./DatePicker";
import { SupplierForm } from "./SupplierModal";
import { MATERIAL_DELIVERY } from "@/lib/inventory";
import type { MaterialDelivery, Supplier } from "@/lib/types";

/**
 * MATERIAL YUKI ochish/tahrirlash — gul DeliveryModal'ining aynan twin'i (Modal qayta ishlatildi).
 * Maydonlar: raqam (takrorlanishi mumkin), sana, postavshik, izoh. Ichiga material
 * MaterialDeliveryDrawer'dagi «Material kiritish» orqali kiritiladi.
 */
export default function MaterialDeliveryModal({ delivery, onClose, onSaved }: {
  delivery?: MaterialDelivery | null;
  onClose: () => void;
  onSaved: (d: MaterialDelivery) => void;
}) {
  const { showToast } = useStore();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [newSupplier, setNewSupplier] = useState(false);
  const [number, setNumber] = useState(delivery?.number ?? "");
  const [receivedAt, setReceivedAt] = useState(delivery?.received_at ?? "");
  const [supplier, setSupplier] = useState<number>(delivery?.supplier ?? 0);
  const [note, setNote] = useState(delivery?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});

  useEffect(() => { api.suppliers({ is_active: true }).then(setSuppliers).catch(() => {}); }, []);

  const save = async () => {
    if (!number.trim()) { setErrs({ number: "Yuk raqamini kiriting" }); return showToast("Yuk raqamini kiriting"); }
    setBusy(true); setErrs({});
    try {
      const payload = {
        number: number.trim(),
        ...(receivedAt ? { received_at: receivedAt.slice(0, 10) } : {}),
        ...(supplier ? { supplier } : { supplier: null }),
        note: note.trim(),
      };
      const saved = delivery
        ? await api.updateMaterialDelivery(delivery.id, payload)
        : await api.createMaterialDelivery(payload);
      showToast(delivery ? "✓ Material yuki yangilandi" : `✓ Material yuki ochildi: ${saved.number}`);
      onSaved(saved);
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) { setErrs(e.fieldErrors); showToast(e.message); }
      else showToast(e instanceof ApiError ? e.message : "Saqlashda xatolik");
      setBusy(false);
    }
  };

  return (
    <>
      <Modal onClose={onClose} width={480}>
        <ModalHeader icon={<PackageOpen size={19} strokeWidth={1.8} />} title={delivery ? "Material yukini tahrirlash" : MATERIAL_DELIVERY.neu} sub="Avval yuk ochiladi, keyin ichiga materiallar kiritiladi" onClose={onClose} />

        <Section>Yuk ma&apos;lumoti</Section>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Yuk raqami">
            <input className="inp" value={number} onChange={(e) => { setNumber(e.target.value); if (errs.number) setErrs({}); }} placeholder="Masalan: M-1" />
            {errs.number && <p className="mt-1 text-[11.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>{errs.number}</p>}
          </Field>
          <Field label="Kelgan sana">
            <DatePicker value={receivedAt} onChange={setReceivedAt} placeholder="Bugun" ariaLabel="Kelgan sana" />
          </Field>
        </div>

        <Field label={MATERIAL_DELIVERY.supplierWord} span>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Select value={supplier} onChange={(v) => setSupplier(+v)} placeholder="Tanlang (ixtiyoriy)" searchable options={[{ value: 0, label: "—" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]} />
            </div>
            <button type="button" onClick={() => setNewSupplier(true)} className="icon-btn border shrink-0" style={{ borderColor: "var(--border-strong)", color: "var(--text-2)" }} title="Yangi postavshik" aria-label="Yangi postavshik">
              <Plus size={16} strokeWidth={2} />
            </button>
          </div>
        </Field>

        <Field label="Izoh (ixtiyoriy)" span>
          <input className="inp" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Masalan: Qog'oz va savat" />
        </Field>

        <ModalFooter>
          <button onClick={onClose} className="btn-ghost">Bekor</button>
          <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : delivery ? "Saqlash" : "Yukni ochish"}</button>
        </ModalFooter>
      </Modal>

      {newSupplier && (
        <SupplierForm supplier={null} onClose={() => setNewSupplier(false)} onSaved={(s) => { setSuppliers((ss) => [s, ...ss]); setSupplier(s.id); setNewSupplier(false); }} />
      )}
    </>
  );
}
