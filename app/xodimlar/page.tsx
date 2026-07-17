"use client";
import { Pencil, Plus, Power } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { usePerm, useStore } from "@/lib/store";
import UserModal from "@/components/UserModal";
import EmptyState from "@/components/EmptyState";
import { Icon } from "@/components/icons";
import { initials } from "@/lib/format";
import { ROLE_LABEL } from "@/components/badges";
import type { Branch, User } from "@/lib/types";

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
  const [branches, setBranches] = useState<Branch[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [userModal, setUserModal] = useState<{ open: boolean; edit: User | null }>({ open: false, edit: null });

  useEffect(() => {
    Promise.all([api.users(), api.branches()])
      .then(([us, bs]) => {
        setTeam(us);
        setBranches(bs);
      })
      .catch((e) => {
        setTeam([]);
        showToast(e instanceof Error ? e.message : "Yuklashda xatolik");
      });
  }, [showToast]);

  const fullName = (u: User) => [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username;

  const deactivate = async (u: User) => {
    try {
      const upd = await api.deactivateUser(u.id);
      setTeam((ts) => (ts ?? []).map((x) => (x.id === u.id ? { ...x, ...upd, is_active: false } : x)));
      showToast(`✓ ${fullName(u)} nofaollashtirildi`);
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
        <p className="text-[14px]" style={{ color: "var(--muted)" }}>
          {team ? `${team.length} xodim · ${team.filter((u) => u.is_active !== false).length} faol` : "Yuklanmoqda…"}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="glass flex items-center gap-2 !rounded-[12px] px-3 py-0.5 text-[13px]" style={{ color: "var(--muted)" }}>
            <Icon name="search" size={14} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ism, login yoki email…"
              className="w-[180px] bg-transparent py-1.5 outline-none placeholder:text-[color:var(--muted)]"
              style={{ color: "var(--text)" }}
              aria-label="Xodim qidirish"
            />
          </div>
          {ROLE_OPTIONS.map((r) => (
            <button key={r || "all"} onClick={() => setRoleFilter(r)} className={`chip ${roleFilter === r ? "chip-active" : ""}`}>
              {r ? ROLE_LABEL[r] ?? r : "Barchasi"}
            </button>
          ))}
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
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tint text-[13px] font-semibold text-tintink">{initials(fullName(u))}</div>
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
                      onClick={(e) => { e.stopPropagation(); deactivate(u); }}
                      title="Nofaollashtirish"
                      aria-label="Nofaollashtirish"
                      className="icon-btn icon-btn-danger"
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
        <UserModal editUser={userModal.edit} branches={branches} onClose={() => setUserModal({ open: false, edit: null })} onSaved={onUserSaved} />
      )}
    </>
  );
}
