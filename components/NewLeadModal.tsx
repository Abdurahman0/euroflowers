"use client";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Section, Field } from "./Modal";
import Select from "./Select";
import { Icon } from "./icons";
import type { Customer, Lead } from "@/lib/types";

/**
 * Operator leadni qo'lda qo'shadi — telefon qo'ng'irog'i yoki do'kondagi
 * so'rov uchun. Mijoz mavjudlaridan tanlanadi (yo'q bo'lsa avval
 * «Mijoz qo'shish» orqali yaratiladi).
 */
export default function NewLeadModal({
  customers,
  onClose,
  onSaved,
}: {
  customers: Customer[];
  onClose: () => void;
  onSaved: (l: Lead) => void;
}) {
  const { user, showToast } = useStore();
  const branches = user?.profile.branches ?? [];
  const [f, setF] = useState({
    customer: customers[0]?.id ?? 0,
    branch: branches[0]?.id ?? 0,
    request_uz: "",
    arrangement_type: "",
    estimated_price: "",
    desired_date: "",
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!f.customer) return showToast("Mijozni tanlang");
    if (!f.request_uz.trim()) return showToast("So'rov matnini kiriting");
    setBusy(true);
    try {
      const l = await api.createLead({
        customer: f.customer,
        branch: f.branch,
        request_uz: f.request_uz.trim(),
        arrangement_type: (f.arrangement_type || "") as Lead["arrangement_type"],
        estimated_price: f.estimated_price ? String(+f.estimated_price) : null,
        desired_date: f.desired_date || null,
        source: "manual",
        status: "new",
      });
      showToast("✓ Lead qo'shildi");
      onSaved(l);
    } catch (e) {
      showToast(e instanceof ApiError ? `Saqlab bo'lmadi: ${JSON.stringify(e.body)}` : "Saqlashda xatolik");
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={520}>
      <ModalHeader icon={<Icon name="crm" />} title="Yangi lead" sub="Qo'lda kiritish — qo'ng'iroq yoki do'kondagi so'rov" onClose={onClose} />
      <Section>Lead ma&apos;lumotlari</Section>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Mijoz" span>
          <Select
            value={f.customer}
            onChange={(v) => setF({ ...f, customer: +v })}
            placeholder={customers.length ? "Mijozni tanlang" : "Avval mijoz qo'shing"}
            options={customers.map((c) => ({
              value: c.id,
              label: c.name || `@${c.instagram_username}` || c.phone || c.masked_phone || `#${c.id}`,
              sub: c.phone || c.masked_phone || undefined,
            }))}
          />
        </Field>
        <Field label="So'rov" span>
          <textarea
            className="inp min-h-[80px] resize-y"
            value={f.request_uz}
            onChange={(e) => setF({ ...f, request_uz: e.target.value })}
            placeholder="Masalan: 25 dona qizil atirgul, yubiley uchun"
            autoFocus
          />
        </Field>
        <Field label="Turi">
          <Select
            value={f.arrangement_type}
            onChange={(v) => setF({ ...f, arrangement_type: String(v) })}
            placeholder="Tanlang"
            options={[
              { value: "bouquet", label: "Buket" },
              { value: "basket", label: "Savat" },
              { value: "stems", label: "Donalab" },
              { value: "catalog", label: "Katalog" },
            ]}
          />
        </Field>
        <Field label="Taxminiy narx (so'm)">
          <input className="inp" type="number" value={f.estimated_price} onChange={(e) => setF({ ...f, estimated_price: e.target.value })} placeholder="750000" />
        </Field>
        <Field label="Kerakli sana">
          <input className="inp" type="date" value={f.desired_date} onChange={(e) => setF({ ...f, desired_date: e.target.value })} />
        </Field>
        <Field label="Filial">
          <Select
            value={f.branch}
            onChange={(v) => setF({ ...f, branch: +v })}
            options={branches.map((b) => ({ value: b.id, label: b.name, sub: b.code }))}
          />
        </Field>
      </div>
      <ModalFooter>
        <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : "Leadni qo'shish"}</button>
        <button onClick={onClose} className="rounded-[14px] border border-[color:var(--border-strong)] bg-[color:var(--hover)] px-5 py-3 text-sm font-bold">Bekor</button>
      </ModalFooter>
    </Modal>
  );
}
