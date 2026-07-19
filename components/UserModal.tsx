"use client";
import { useState } from "react";
import Modal, { ModalFooter, ModalHeader, Section, Field } from "./Modal";
import Select from "./Select";
import { api, ApiError } from "@/lib/api";
import { usePerm, useStore } from "@/lib/store";
import { Icon } from "./icons";
import { ROLE_LABEL } from "./badges";
import type { Branch, Language, PagePermission, PermissionPage, Role, User } from "@/lib/types";

/**
 * Xodim yaratish/tahrirlash — kontrakt bo'yicha nested payload:
 *   { username, password?, first_name, profile: {role, language, branch_ids}, permissions: [...] }
 * Ruxsatlar jadvali: har sahifa uchun can_view / can_control.
 */

const PAGES: { page: PermissionPage; label: string }[] = [
  { page: "dashboard", label: "Dashboard" },
  { page: "inventory", label: "Sklad" },
  { page: "catalog", label: "Katalog" },
  { page: "crm", label: "CRM" },
  { page: "customers", label: "Mijozlar" },
  { page: "conversations", label: "Instagram inbox" },
  { page: "social_posts", label: "Postlar" },
  { page: "notifications", label: "Bildirishnomalar" },
  { page: "settings", label: "Sozlamalar" },
  { page: "users", label: "Xodimlar" },
  { page: "audit", label: "Audit" },
  { page: "ai_settings", label: "AI sozlamalari" },
  { page: "integrations", label: "Integratsiyalar" },
  { page: "mini_app", label: "Mini ilova" },
];

const ROLES: Role[] = ["admin", "operator", "florist", "warehouse", "content", "developer"];

type PermState = Record<PermissionPage, { can_view: boolean; can_control: boolean }>;

const emptyPerms = (): PermState =>
  Object.fromEntries(PAGES.map((p) => [p.page, { can_view: false, can_control: false }])) as PermState;

const permsFromUser = (u: User | null): PermState => {
  const st = emptyPerms();
  for (const p of u?.permissions ?? []) {
    if (st[p.page]) st[p.page] = { can_view: p.can_view, can_control: p.can_control };
  }
  return st;
};

export default function UserModal({
  editUser,
  branches,
  onClose,
  onSaved,
}: {
  editUser: User | null;
  branches: Branch[];
  onClose: () => void;
  onSaved: (u: User) => void;
}) {
  const showToast = useStore((s) => s.showToast);
  const myRole = useStore((s) => s.user?.profile.role);
  const { canView } = usePerm();
  const [username, setUsername] = useState(editUser?.username ?? "");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState(editUser?.first_name ?? "");
  const [lastName, setLastName] = useState(editUser?.last_name ?? "");
  const [role, setRole] = useState<Role>(editUser?.profile.role ?? "operator");
  const [language, setLanguage] = useState<Language>(editUser?.profile.language ?? "uz");
  const [branchIds, setBranchIds] = useState<number[]>(editUser?.profile.branches.map((b) => b.id) ?? []);
  const [perms, setPerms] = useState<PermState>(permsFromUser(editUser));
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // kontrakt: admin developer'larni ko'rmasligi kerak — rol tanlovida ham yashiramiz
  const roleOptions = ROLES.filter((r) => r !== "developer" || myRole === "developer").map((r) => ({
    value: r,
    label: ROLE_LABEL[r] ?? r,
  }));

  const visiblePages = PAGES.filter(
    (p) => (p.page !== "ai_settings" && p.page !== "integrations") || canView("ai_settings") || canView("integrations")
  );

  const togglePerm = (page: PermissionPage, kind: "can_view" | "can_control", v: boolean) => {
    setPerms((s) => ({
      ...s,
      [page]: {
        ...s[page],
        [kind]: v,
        // control yoqilsa view ham yoqiladi; view o'chirilsa control ham o'chadi
        ...(kind === "can_control" && v ? { can_view: true } : {}),
        ...(kind === "can_view" && !v ? { can_control: false } : {}),
      },
    }));
  };

  const save = async () => {
    const errs: Record<string, string> = {};
    if (!username.trim()) errs.username = "Login kiriting";
    if (!editUser && password.length < 8) errs.password = "Parol kamida 8 belgi bo'lsin";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const permissions: Partial<PagePermission>[] = Object.entries(perms)
      .filter(([, v]) => v.can_view || v.can_control)
      .map(([page, v]) => ({ page: page as PermissionPage, can_view: v.can_view, can_control: v.can_control }));

    const payload: Record<string, unknown> = {
      username: username.trim(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      profile: { role, language, branch_ids: branchIds },
      permissions,
    };
    if (password) payload.password = password;

    setSaving(true);
    try {
      const saved = editUser ? await api.updateUser(editUser.id, payload) : await api.createUser(payload);
      showToast(editUser ? "✓ Xodim yangilandi" : "✓ Xodim qo'shildi");
      onSaved(saved);
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) setErrors(e.fieldErrors);
      else showToast(e instanceof Error ? e.message : "Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} width={560}>
      <ModalHeader
        icon={<Icon name="user" size={20} />}
        title={editUser ? "Xodimni tahrirlash" : "Yangi xodim"}
        sub="Rol, filial va sahifa ruxsatlari"
        onClose={onClose}
      />

      <Section>Hisob</Section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Login">
          <input className="inp" value={username} onChange={(e) => { setUsername(e.target.value); setErrors((x) => ({ ...x, username: "" })); }} autoFocus={!editUser} autoComplete="off" />
        </Field>
        <Field label={editUser ? "Yangi parol (ixtiyoriy)" : "Parol"}>
          <input className="inp" type="password" value={password} onChange={(e) => { setPassword(e.target.value); setErrors((x) => ({ ...x, password: "" })); }} autoComplete="new-password" placeholder={editUser ? "o'zgartirmaslik uchun bo'sh" : ""} />
        </Field>
        <Field label="Ism">
          <input className="inp" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </Field>
        <Field label="Familiya">
          <input className="inp" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </Field>
      </div>
      {(errors.username || errors.password) && (
        <p className="mt-1.5 text-[12px] font-semibold text-[color:var(--danger-ink)]" role="alert">{errors.username || errors.password}</p>
      )}

      <Section>Rol va til</Section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Rol">
          <Select value={role} options={roleOptions} onChange={(v) => setRole(String(v) as Role)} />
        </Field>
        <Field label="Til">
          <Select value={language} options={[{ value: "uz", label: "O'zbek" }, { value: "ru", label: "Русский" }]} onChange={(v) => setLanguage(String(v) as Language)} />
        </Field>
      </div>

      <Section>Filiallar</Section>
      <div className="flex flex-wrap gap-2">
        {branches.map((b) => {
          const on = branchIds.includes(b.id);
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setBranchIds((ids) => (on ? ids.filter((x) => x !== b.id) : [...ids, b.id]))}
              className={`rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition-colors duration-200 ${on ? "text-white" : "text-[color:var(--text-2)] hover:bg-[color:var(--hover)]"}`}
              style={on ? { background: "var(--primary)", borderColor: "var(--primary)" } : { borderColor: "var(--border)" }}
              aria-pressed={on}
            >
              {b.name}
            </button>
          );
        })}
        {branches.length === 0 && <p className="text-[13px] text-[color:var(--muted)]">Filial topilmadi.</p>}
      </div>

      <Section>Sahifa ruxsatlari</Section>
      <div className="overflow-hidden rounded-[12px] border border-[color:var(--border)]">
        <div className="grid grid-cols-[1fr_84px_84px] items-center gap-2 border-b border-[color:var(--border)] bg-[color:var(--surface-2)] px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-[color:var(--muted)]">
          <span>Sahifa</span>
          <span className="text-center">Ko&apos;rish</span>
          <span className="text-center">Boshqarish</span>
        </div>
        <div className="max-h-[240px] overflow-y-auto overscroll-contain">
          {visiblePages.map(({ page, label }) => (
            <div key={page} className="grid grid-cols-[1fr_84px_84px] items-center gap-2 border-b border-[color:var(--line2)] px-3.5 py-2 text-[13px] last:border-b-0">
              <span>{label}</span>
              <span className="text-center">
                <input type="checkbox" checked={perms[page].can_view} onChange={(e) => togglePerm(page, "can_view", e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" aria-label={`${label} — ko'rish`} />
              </span>
              <span className="text-center">
                <input type="checkbox" checked={perms[page].can_control} onChange={(e) => togglePerm(page, "can_control", e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" aria-label={`${label} — boshqarish`} />
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-2 text-[12px] text-[color:var(--muted)]">Ruxsat belgilanmagan bo&apos;lsa, rol bo&apos;yicha standart qoidalar amal qiladi.</p>

      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor qilish</button>
        <button onClick={save} disabled={saving} className={`btn-primary ${saving ? "btn-loading" : ""}`}>
          {editUser ? "Saqlash" : "Qo'shish"}
        </button>
      </ModalFooter>
    </Modal>
  );
}
