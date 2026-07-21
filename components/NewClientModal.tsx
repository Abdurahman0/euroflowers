"use client";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Section, Field } from "./Modal";
import Select from "./Select";
import { Icon } from "./icons";
import type { Customer } from "@/lib/types";

/**
 * Operator mijozni qo'lda qo'shadi (Instagram'siz kelganlar uchun).
 * Backend `instagram_user_id`ni majburiy qiladi — username bo'lmasa
 * "manual_<vaqt>" placeholder yuboriladi.
 */
export default function NewClientModal({ onClose, onSaved }: { onClose: () => void; onSaved: (c: Customer) => void }) {
  const { user, showToast } = useStore();
  const branches = user?.profile.branches ?? [];
  const [f, setF] = useState({
    name: "", phone: "", instagram_username: "", language: "uz", notes: "",
    branch: branches[0]?.id ?? 0,
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  const save = async () => {
    if (!f.name.trim()) return showToast("Mijoz ismini kiriting");
    setBusy(true);
    try {
      const c = await api.createCustomer({
        name: f.name.trim(),
        phone: f.phone.trim(),
        instagram_username: f.instagram_username.trim().replace(/^@/, ""),
        instagram_user_id: f.instagram_username.trim().replace(/^@/, "") || `manual_${Date.now()}`,
        language: f.language as Customer["language"],
        notes: f.notes.trim(),
        branch: f.branch || null,
      });
      showToast(`✓ Mijoz qo'shildi: ${c.name}`);
      onSaved(c);
    } catch (e) {
      showToast(e instanceof ApiError ? `Saqlab bo'lmadi: ${JSON.stringify(e.body)}` : "Saqlashda xatolik");
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={520}>
      <ModalHeader icon={<Icon name="crm" />} title="Yangi mijoz" sub="Qo'lda kiritish — telefon yoki do'kondan kelganlar" onClose={onClose} />
      <Section>Mijoz ma&apos;lumotlari</Section>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ism" span><input className="inp" value={f.name} onChange={set("name")} placeholder="Aziza Karimova" autoFocus /></Field>
        <Field label="Telefon"><input className="inp" value={f.phone} onChange={set("phone")} placeholder="+998901234567" inputMode="tel" /></Field>
        <Field label="Instagram (ixtiyoriy)"><input className="inp" value={f.instagram_username} onChange={set("instagram_username")} placeholder="@username" /></Field>
        <Field label="Til">
          <Select
            value={f.language}
            onChange={(v) => setF({ ...f, language: String(v) })}
            options={[{ value: "uz", label: "O'zbekcha" }, { value: "ru", label: "Ruscha" }]}
          />
        </Field>
        <Field label="Filial">
          <Select
            value={f.branch}
            onChange={(v) => setF({ ...f, branch: +v })}
            options={branches.map((b) => ({ value: b.id, label: b.name, sub: b.code }))}
          />
        </Field>
        <Field label="Izoh" span>
          <textarea className="inp min-h-[70px] resize-y" value={f.notes} onChange={set("notes")} placeholder="Qo'shimcha ma'lumot…" />
        </Field>
      </div>
      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : "Mijozni qo'shish"}</button>
      </ModalFooter>
    </Modal>
  );
}
