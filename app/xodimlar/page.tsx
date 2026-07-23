"use client";
import SearchInput from "@/components/SearchInput";
import ClearFilters from "@/components/ClearFilters";
import FilterSelect from "@/components/FilterSelect";
import { Pencil, Plus, Power } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { usePerm, useStore } from "@/lib/store";
import useAutoRefresh from "@/lib/useAutoRefresh";
import UserModal from "@/components/UserModal";
import Modal, { ModalFooter, ModalHeader } from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import { Icon } from "@/components/icons";
import { initials } from "@/lib/format";
import { ROLE_LABEL } from "@/components/badges";
import type { User } from "@/lib/types";

/**
 * Xodimlar (jamoa) — alohida sahifa. Ilgari Sozlamalar ichida edi;
 * qo'shish/tahrirlash/nofaollashtirish va ruxsatlar (UserModal) o'sha-o'sha,
 * faqat joyi ko'chdi. Ruxsat: users.
 */

const ROLE_OPTIONS = ["", "developer", "admin", "operator", "florist", "warehouse", "content"] as const;

export default function XodimlarPage() {
  const { user, showToast } = useStore();
  const { canControl } = usePerm();
  const control = canControl("users");
  const [team, setTeam] = useState<User[] | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [userModal, setUserModal] = useState<{ open: boolean; edit: User | null }>({ open: false, edit: null });
  const [confirmU, setConfirmU] = useState<User | null>(null); // nofaollashtirish tasdig'i
  const [confirmBusy, setConfirmBusy] = useState(false);

  const load = useCallback(() => {
    api.users()
      .then(setTeam)
      .catch((e) => {
        setTeam((t) => t ?? []);
        showToast(e instanceof Error ? e.message : "Yuklashda xatolik");
      });
  }, [showToast]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load); // jimgina davriy yangilash — real vaqt hissi

  const fullName = (u: User) => [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username;

  const deactivate = async (u: User) => {
    setConfirmBusy(true);
    try {
      const upd = await api.deactivateUser(u.id);
      setTeam((ts) => (ts ?? []).map((x) => (x.id === u.id ? { ...x, ...upd, is_active: false } : x)));
      showToast(`✓ ${fullName(u)} nofaollashtirildi`);
      setConfirmU(null);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Amalga oshmadi");
    } finally {
      setConfirmBusy(false);
    }
  };

  const reactivate = async (u: User) => {
    try {
      const upd = await api.updateUser(u.id, { is_active: true });
      setTeam((ts) => (ts ?? []).map((x) => (x.id === u.id ? { ...x, ...upd, is_active: true } : x)));
      showToast(`✓ ${fullName(u)} qayta faollashtirildi`);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Amalga oshmadi");
    }
  };

  const onUserSaved = (u: User) => {
    setTeam((ts) => {
      const list = ts ?? [];
      const i = list.findIndex((x) => x.id === u.id);
      return i >= 0 ? list.map((x) => (x.id === u.id ? u : x)) : [...list, u];
    });
    setUserModal({ open: false, edit: null });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (team ?? []).filter((u) => {
      if (roleFilter && u.profile?.role !== roleFilter) return false;
      if (!q) return true;
      return [fullName(u), u.username, u.email ?? ""].some((x) => x.toLowerCase().includes(q));
    });
  }, [team, search, roleFilter]);

  return (
    <>
      {/* qidiruv/filtr qatori + asosiy amal */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="note-chip text-[14px]" style={{ color: "var(--muted)" }}>
          {team ? `${team.length} xodim · ${team.filter((u) => u.is_active !== false).length} faol` : "Yuklanmoqda…"}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Ism, login yoki email…" width={180} ariaLabel="Xodim qidirish" />
          <FilterSelect
            value={roleFilter}
            onChange={setRoleFilter}
            label="Rol"
            options={ROLE_OPTIONS.map((r) => ({ value: r, label: r ? ROLE_LABEL[r] ?? r : "Barcha rollar" }))}
          />
          <ClearFilters show={!!(search || roleFilter)} onClear={() => { setSearch(""); setRoleFilter(""); }} />
          {control && (
            <button onClick={() => setUserModal({ open: true, edit: null })} className="btn-primary !flex-none px-5">
              <Plus size={18} strokeWidth={1.75} /> Xodim qo&apos;shish
            </button>
          )}
        </div>
      </div>

      <section className="glass p-5">
        <div className="flex flex-col">
          {filtered.map((u, i) => (
            <div
              key={u.id}
              onClick={() => control && setUserModal({ open: true, edit: u })}
              className={`row-lux group flex items-center gap-3 border-t py-3 first:border-t-0 ${u.id === user?.id ? "row-lux-active" : ""}`}
              style={{ borderColor: "var(--line2)", animationDelay: `${Math.min(i * 35, 350)}ms` }}
            >
              <div className="avatar-lead flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[13px] font-semibold">{initials(fullName(u))}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-semibold" title={fullName(u)}>
                  {fullName(u)}
                  {u.id === user?.id && <span className="ml-1.5 text-[12px] font-medium" style={{ color: "var(--muted)" }}>(siz)</span>}
                </div>
                <div className="truncate text-[12px]" style={{ color: "var(--muted)" }} title={u.email || u.username}>{u.email || u.username}</div>
              </div>
              {u.is_active === false && <span className="rounded-full bg-rose px-2 py-0.5 text-[11px] font-bold text-roseink">NOFAOL</span>}
              <span className="hidden rounded-full border bg-tint px-3 py-0.5 text-[11px] font-semibold text-tintink sm:inline" style={{ borderColor: "var(--line2)" }}>
                {ROLE_LABEL[u.profile?.role] ?? u.profile?.role ?? "—"}
              </span>
              {control && (
                <span className="row-actions flex gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); setUserModal({ open: true, edit: u }); }}
                    title="Tahrirlash"
                    aria-label="Tahrirlash"
                    className="icon-btn"
                  >
                    <Pencil size={16} strokeWidth={1.75} />
                  </button>
                  {u.is_active !== false && u.id !== user?.id && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmU(u); }}
                      title="Nofaollashtirish"
                      aria-label="Nofaollashtirish"
                      className="icon-btn icon-btn-danger"
                    >
                      <Power size={16} strokeWidth={1.75} />
                    </button>
                  )}
                  {u.is_active === false && (
                    <button
                      onClick={(e) => { e.stopPropagation(); reactivate(u); }}
                      title="Qayta faollashtirish"
                      aria-label="Qayta faollashtirish"
                      className="icon-btn"
                      style={{ color: "var(--mintink, #3d6b52)" }}
                    >
                      <Power size={16} strokeWidth={1.75} />
                    </button>
                  )}
                </span>
              )}
            </div>
          ))}
          {team && filtered.length === 0 && (
            <EmptyState title={search || roleFilter ? "Topilmadi" : "Xodim yo'q"} sub={search || roleFilter ? "Filtrni o'zgartirib ko'ring." : "Birinchi xodimni qo'shing."} />
          )}
          {team == null && <p className="py-2 text-[14px]" style={{ color: "var(--muted)" }}>Yuklanmoqda…</p>}
        </div>
      </section>

      {userModal.open && (
        <UserModal editUser={userModal.edit} onClose={() => setUserModal({ open: false, edit: null })} onSaved={onUserSaved} />
      )}

      {/* nofaollashtirish tasdig'i */}
      {confirmU && (
        <Modal onClose={() => setConfirmU(null)} width={420}>
          <ModalHeader
            icon={<Power size={18} strokeWidth={1.75} />}
            title="Nofaollashtirish"
            sub="Xodim tizimga kira olmaydigan bo'ladi"
            onClose={() => setConfirmU(null)}
          />
          {/* matn TEMA tokenlarida — qattiq oq rang light temada ko'rinmay qolardi */}
          <p className="mt-5 text-[14px] leading-relaxed" style={{ color: "var(--text-2)" }}>
            <b style={{ color: "var(--text)" }}>{fullName(confirmU)}</b> ({ROLE_LABEL[confirmU.profile?.role] ?? confirmU.profile?.role})
            haqiqatan nofaollashtirilsinmi? Keyin xohlagan payt qayta faollashtirish mumkin.
          </p>
          <ModalFooter>
            <button
              onClick={() => deactivate(confirmU)}
              disabled={confirmBusy}
              className={`btn-danger flex-1 ${confirmBusy ? "btn-loading" : ""}`}
            >
              {confirmBusy ? "Bajarilmoqda…" : "Ha, nofaollashtirish"}
            </button>
            <button onClick={() => setConfirmU(null)} className="rounded-[14px] border border-[color:var(--border-strong)] bg-[color:var(--hover)] px-5 py-3 text-sm font-bold">
              Bekor
            </button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
}
