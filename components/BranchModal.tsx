"use client";
import { useState } from "react";
import clsx from "clsx";
import Modal, { ModalFooter, ModalHeader, Section, Field } from "./Modal";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Icon } from "./icons";
import type { Branch } from "@/lib/types";

/** Filial yaratish/tahrirlash — nom, kod, manzil, telefon, faollik. */
export default function BranchModal({
  branch,
  onClose,
  onSaved,
}: {
  branch: Branch | null;
  onClose: () => void;
  onSaved: (b: Branch) => void;
}) {
  const showToast = useStore((s) => s.showToast);
  const [name, setName] = useState(branch?.name ?? "");
  const [code, setCode] = useState(branch?.code ?? "");
  const [address, setAddress] = useState(branch?.address ?? "");
  const [phone, setPhone] = useState(branch?.phone ?? "");
  const [active, setActive] = useState(branch?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = async () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Filial nomini kiriting";
    if (!code.trim()) errs.code = "Qisqa kod kiriting (masalan: CHIL-P)";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const payload: Partial<Branch> = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        address: address.trim(),
        phone: phone.trim(),
        is_active: active,
      };
      const saved = branch ? await api.updateBranch(branch.id, payload) : await api.createBranch(payload);
      showToast(branch ? "✓ Filial yangilandi" : "✓ Filial qo'shildi");
      onSaved(saved);
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) setErrors(e.fieldErrors);
      else showToast(e instanceof Error ? e.message : "Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} width={480}>
      <ModalHeader
        icon={<Icon name="sklad" size={20} />}
        title={branch ? "Filialni tahrirlash" : "Yangi filial"}
        sub="Nomi, kodi va aloqa ma'lumotlari"
        onClose={onClose}
      />
      <Section>Asosiy</Section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nomi" span>
          <input className="inp" value={name} onChange={(e) => { setName(e.target.value); setErrors((x) => ({ ...x, name: "" })); }} placeholder="EuroFlowers Chilonzor" autoFocus={!branch} />
        </Field>
        <Field label="Qisqa kod">
          <input className="inp uppercase" value={code} onChange={(e) => { setCode(e.target.value); setErrors((x) => ({ ...x, code: "" })); }} placeholder="CHIL-P" maxLength={12} />
        </Field>
        <Field label="Telefon">
          <input className="inp" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998 90 000 00 00" inputMode="tel" />
        </Field>
        <Field label="Manzil" span>
          <input className="inp" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Toshkent, ..." />
        </Field>
      </div>
      {(errors.name || errors.code) && (
        <p className="mt-1.5 text-[12px] font-semibold text-[color:var(--danger-ink)]" role="alert">{errors.name || errors.code}</p>
      )}
      <label className="mt-4 flex cursor-pointer items-center gap-2 text-[13px]">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
        Faol filial
      </label>
      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor qilish</button>
        <button onClick={save} disabled={saving} className={clsx("btn-primary", saving && "btn-loading")}>
          {branch ? "Saqlash" : "Qo'shish"}
        </button>
      </ModalFooter>
    </Modal>
  );
}
