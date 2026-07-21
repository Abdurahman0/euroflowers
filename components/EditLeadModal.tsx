"use client";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Section, Field } from "./Modal";
import Select from "./Select";
import DatePicker from "./DatePicker";
import { Icon } from "./icons";
import type { Lead } from "@/lib/types";

/**
 * Leadni tahrirlash — kanban kartadagi qalam orqali ochiladi.
 * Backend PATCH /api/leads/{id}/ ni qo'llaydi: so'rov matni, turi, narxlar,
 * sana va filial shu yerda o'zgartiriladi. (Sklad sarfi lead panelida — LeadModal.)
 */
export default function EditLeadModal({
  lead,
  onClose,
  onSaved,
}: {
  lead: Lead;
  onClose: () => void;
  onSaved: (l: Lead) => void;
}) {
  const { user, showToast } = useStore();
  const branches = user?.profile.branches ?? [];
  const [f, setF] = useState({
    request_uz: lead.request_uz || "",
    arrangement_type: lead.arrangement_type || "",
    estimated_price: lead.estimated_price ? String(Math.round(+lead.estimated_price)) : "",
    florist_fee: lead.florist_fee ? String(Math.round(+lead.florist_fee)) : "",
    desired_date: lead.desired_date ? lead.desired_date.slice(0, 10) : "",
    branch: lead.branch,
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!f.request_uz.trim()) return showToast("So'rov matnini kiriting");
    setBusy(true);
    try {
      const upd = await api.updateLead(lead.id, {
        request_uz: f.request_uz.trim(),
        arrangement_type: (f.arrangement_type || "") as Lead["arrangement_type"],
        estimated_price: f.estimated_price ? String(+f.estimated_price) : null,
        florist_fee: f.florist_fee ? String(+f.florist_fee) : null,
        desired_date: f.desired_date || null,
        branch: f.branch,
      });
      showToast("✓ Lead yangilandi");
      onSaved(upd);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Saqlab bo'lmadi");
      setBusy(false);
    }
  };

  const name = lead.customer_detail?.name || `@${lead.customer_detail?.instagram_username ?? "—"}`;

  return (
    <Modal onClose={onClose} width={500}>
      <ModalHeader icon={<Icon name="crm" />} title="Leadni tahrirlash" sub={`${name} · #${lead.id}`} onClose={onClose} />
      <Section>Lead ma&apos;lumotlari</Section>
      <div className="grid grid-cols-2 gap-3">
        <Field label="So'rov" span>
          <textarea
            className="inp min-h-[90px] resize-y"
            value={f.request_uz}
            onChange={(e) => setF({ ...f, request_uz: e.target.value })}
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
        <Field label="Florist haqi (so'm)">
          <input className="inp" type="number" value={f.florist_fee} onChange={(e) => setF({ ...f, florist_fee: e.target.value })} placeholder="50000" />
        </Field>
        <Field label="Taxminiy narx (so'm)">
          <input className="inp" type="number" value={f.estimated_price} onChange={(e) => setF({ ...f, estimated_price: e.target.value })} placeholder="750000" />
        </Field>
        <Field label="Kerakli sana">
          <DatePicker value={f.desired_date} onChange={(v) => setF({ ...f, desired_date: v })} disablePast placeholder="Yetkazish sanasi" ariaLabel="Kerakli sana" />
        </Field>
        <Field label="Filial" span>
          <Select
            value={f.branch}
            onChange={(v) => setF({ ...f, branch: +v })}
            options={branches.map((b) => ({ value: b.id, label: b.name, sub: b.code }))}
          />
        </Field>
      </div>
      <ModalFooter>
        <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : "Saqlash"}</button>
        <button onClick={onClose} className="rounded-[14px] border border-[color:var(--border-strong)] bg-[color:var(--hover)] px-5 py-3 text-sm font-bold">Bekor</button>
      </ModalFooter>
    </Modal>
  );
}
