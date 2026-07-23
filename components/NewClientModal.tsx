"use client";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Section, Field } from "./Modal";
import Select from "./Select";
import { Icon } from "./icons";
import type { Customer } from "@/lib/types";

/**
 * Mijoz yaratish/tahrirlash (bitta forma). Yaratishda backend
 * `instagram_user_id`ni majburiy qiladi — username bo'lmasa
 * "manual_<vaqt>" placeholder yuboriladi. Tahrirda PATCH /api/customers/{id}/.
 */
export default function NewClientModal({
  client = null,
  onClose,
  onSaved,
}: {
  /** berilsa — tahrirlash rejimi */
  client?: Customer | null;
  onClose: () => void;
  onSaved: (c: Customer) => void;
}) {
  const { showToast } = useStore();
  const [f, setF] = useState({
    name: client?.name ?? "",
    phone: client?.phone ?? "",
    instagram_username: client?.instagram_username ?? "",
    language: client?.language ?? "uz",
    notes: client?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF({ ...f, [k]: e.target.value });

  const save = async () => {
    if (!f.name.trim()) return showToast("Mijoz ismini kiriting");
    setBusy(true);
    const ig = f.instagram_username.trim().replace(/^@/, "");
    try {
      const c = client
        ? await api.updateCustomer(client.id, {
            name: f.name.trim(),
            phone: f.phone.trim(),
            instagram_username: ig,
            language: f.language as Customer["language"],
            notes: f.notes.trim(),
          })
        : await api.createCustomer({
            name: f.name.trim(),
            phone: f.phone.trim(),
            instagram_username: ig,
            instagram_user_id: ig || `manual_${Date.now()}`,
            language: f.language as Customer["language"],
            notes: f.notes.trim(),
          });
      showToast(client ? "✓ Mijoz yangilandi" : `✓ Mijoz qo'shildi: ${c.name}`);
      onSaved(c);
    } catch (e) {
      showToast(e instanceof ApiError ? `Saqlab bo'lmadi: ${JSON.stringify(e.body)}` : "Saqlashda xatolik");
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={520}>
      <ModalHeader
        icon={<Icon name="crm" />}
        title={client ? "Mijozni tahrirlash" : "Yangi mijoz"}
        sub={client ? `${client.name || "@" + (client.instagram_username || "—")} · #${client.id}` : "Qo'lda kiritish — telefon yoki do'kondan kelganlar"}
        onClose={onClose}
      />
      <Section>Mijoz ma&apos;lumotlari</Section>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ism" span><input className="inp" value={f.name} onChange={set("name")} placeholder="Aziza Karimova" autoFocus /></Field>
        <Field label="Telefon"><input className="inp" value={f.phone} onChange={set("phone")} placeholder="+998901234567" inputMode="tel" /></Field>
        <Field label="Instagram (ixtiyoriy)"><input className="inp" value={f.instagram_username} onChange={set("instagram_username")} placeholder="@username" /></Field>
        <Field label="Til" span>
          <Select
            value={f.language}
            onChange={(v) => setF({ ...f, language: String(v) as Customer["language"] })}
            options={[{ value: "uz", label: "O'zbekcha" }, { value: "ru", label: "Ruscha" }]}
          />
        </Field>
        <Field label="Izoh" span>
          <textarea className="inp min-h-[70px] resize-y" value={f.notes} onChange={set("notes")} placeholder="Qo'shimcha ma'lumot…" />
        </Field>
      </div>
      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : client ? "Saqlash" : "Mijozni qo'shish"}</button>
      </ModalFooter>
    </Modal>
  );
}
