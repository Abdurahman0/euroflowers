"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Minus, Package, Pencil, Plus, ShoppingBag, Trash2, Move } from "lucide-react";
import { api } from "@/lib/api";
import { usePerm, useStore } from "@/lib/store";
import useAutoRefresh from "@/lib/useAutoRefresh";
import { fmtTime } from "@/lib/format";
import { auditAction, auditActor, auditChanges, auditSummary, entityName, KIND_HUE, KIND_LABEL, type AuditKind } from "@/lib/audit";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import SearchInput from "@/components/SearchInput";
import FilterSelect from "@/components/FilterSelect";
import ClearFilters from "@/components/ClearFilters";
import Modal from "@/components/Modal";
import { initials } from "@/lib/format";
import type { AuditLog, User } from "@/lib/types";

const userName = (u: User) => [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || `#${u.id}`;

/**
 * Audit jurnali — kim, nima qilgani va NIMA O'ZGARGANI.
 * Xom backend kalitlari (`stock_movement`, `CatalogItem`, before/after JSON)
 * lib/audit.ts orqali o'zbekchaga o'giriladi. Ruxsat: audit.
 */

const KIND_ICON: Record<AuditKind, typeof Plus> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
  stock: Package,
  sale: ShoppingBag,
  move: Move,
};

const KIND_OPTS = [
  { value: "", label: "Barcha amallar" },
  ...(Object.keys(KIND_LABEL) as AuditKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] })),
];

export default function AuditPage() {
  const { canView } = usePerm();
  const showToast = useStore((s) => s.showToast);
  const visible = canView("audit");
  const [rows, setRows] = useState<AuditLog[] | null>(null);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("");
  const [entity, setEntity] = useState("");
  const [user, setUser] = useState(""); // xodim bo'yicha SERVER filtri (?user=id)
  const [users, setUsers] = useState<User[]>([]);
  const [sel, setSel] = useState<AuditLog | null>(null);
  const [shown, setShown] = useState(50); // «Yana ko'rsatish» qadami

  const load = useCallback(() => {
    if (!visible) return;
    // xodim filtri server tomonda — tanlangan xodimning BARCHA amallari keladi
    api.audit({ page_size: 100, user: user || undefined })
      .then((r) => setRows(r))
      .catch((e) => setErr(e instanceof Error ? e.message : "Yuklab bo'lmadi"));
  }, [visible, user]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load); // jimgina davriy yangilash

  // xodimlar ro'yxati — filtr uchun (bir marta)
  useEffect(() => {
    if (!visible) return;
    api.users({ page_size: 100, ordering: "username" }).then(setUsers).catch(() => {});
  }, [visible]);

  const entityOpts = useMemo(() => {
    const uniq = Array.from(new Set((rows ?? []).map((r) => r.entity_type)));
    return [{ value: "", label: "Barcha obyektlar" }, ...uniq.map((e) => ({ value: e, label: entityName(e) }))];
  }, [rows]);

  const userOpts = useMemo(
    () => [{ value: "", label: "Barcha xodimlar" }, ...users.map((u) => ({ value: String(u.id), label: userName(u) }))],
    [users]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      const def = auditAction(r.action);
      if (kind && def.kind !== kind) return false;
      if (entity && r.entity_type !== entity) return false;
      if (!q) return true;
      return [def.label, entityName(r.entity_type), auditActor(r), r.entity_id, auditSummary(r)]
        .some((x) => (x ?? "").toLowerCase().includes(q));
    });
  }, [rows, search, kind, entity]);

  if (!visible) return <EmptyState title="Ruxsat yo'q" sub="Bu sahifa uchun sizda ko'rish huquqi yo'q." />;
  if (err) return <p className="mt-10 text-center text-sm font-bold" style={{ color: "var(--danger-ink)" }}>{err}</p>;
  if (rows === null) return <FlowerLoader />;

  const page = filtered.slice(0, shown);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="note-chip text-[14px]" style={{ color: "var(--mut)" }}>
          Audit jurnali ({filtered.length < rows.length ? `${filtered.length} / ${rows.length}` : rows.length}) — kim, nima qilgani va nima o&apos;zgargani
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} ariaLabel="Jurnaldan qidirish" />
          {users.length > 0 && <FilterSelect value={user} options={userOpts} onChange={(v) => { setUser(v); setShown(50); }} label="Xodim" />}
          <FilterSelect value={kind} options={KIND_OPTS} onChange={setKind} label="Amal" />
          <FilterSelect value={entity} options={entityOpts} onChange={setEntity} label="Obyekt" />
          <ClearFilters show={!!(search || kind || entity || user)} onClear={() => { setSearch(""); setKind(""); setEntity(""); setUser(""); }} />
        </div>
      </div>

      <div className="glass overflow-hidden !rounded-[20px] max-md:overflow-x-auto">
        <div className="grid min-w-[860px] grid-cols-[150px_1.1fr_1fr_1.5fr_140px] gap-2.5 border-b-[1.5px] bg-tint px-4 py-3.5 text-[11px] font-bold uppercase tracking-widest text-tintink" style={{ borderColor: "var(--line)" }}>
          <span>Xodim</span><span>Amal</span><span>Obyekt</span><span>O&apos;zgarish</span><span>Vaqt</span>
        </div>
        {page.map((r, ri) => {
          const def = auditAction(r.action);
          const hue = KIND_HUE[def.kind];
          const Icon = KIND_ICON[def.kind];
          const changes = auditChanges(r);
          return (
            <button
              key={r.id}
              onClick={() => setSel(r)}
              className="row-lux grid w-full min-w-[860px] grid-cols-[150px_1.1fr_1fr_1.5fr_140px] items-center gap-2.5 border-t px-4 py-3 text-left text-[13px]"
              style={{ borderColor: "var(--line2)", animationDelay: `${Math.min(ri * 30, 400)}ms` }}
              title="Batafsil ko'rish"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="avatar-lead flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[9px] text-[11px] font-bold">
                  {initials(auditActor(r))}
                </span>
                <span className="truncate font-semibold" title={auditActor(r)}>{auditActor(r)}</span>
              </span>
              <span className="min-w-0">
                <span
                  className="inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-2 py-[3px] text-[11.5px] font-bold leading-none"
                  style={{
                    background: `color-mix(in srgb, ${hue} 13%, transparent)`,
                    borderColor: `color-mix(in srgb, ${hue} 28%, transparent)`,
                    color: `color-mix(in srgb, ${hue} 72%, var(--text))`,
                  }}
                >
                  <Icon size={11} strokeWidth={2.2} /> {def.label}
                </span>
              </span>
              <span className="min-w-0 truncate" style={{ color: "var(--text-2)" }} title={`${entityName(r.entity_type)} #${r.entity_id}`}>
                {entityName(r.entity_type)} <span style={{ color: "var(--muted)" }}>#{r.entity_id}</span>
              </span>
              <span className="min-w-0 truncate" style={{ color: "var(--muted)" }} title={auditSummary(r)}>
                {changes.length ? (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate">{changes[0].label}:</span>
                    {changes[0].from !== undefined && <span className="shrink-0 line-through opacity-70">{changes[0].from}</span>}
                    {changes[0].from !== undefined && changes[0].to !== undefined && <ArrowRight size={11} strokeWidth={2.2} className="shrink-0" />}
                    {changes[0].to !== undefined && <b className="shrink-0" style={{ color: "var(--text-2)" }}>{changes[0].to}</b>}
                    {changes.length > 1 && <span className="shrink-0 opacity-70">+{changes.length - 1}</span>}
                  </span>
                ) : (
                  "—"
                )}
              </span>
              <span style={{ color: "var(--mut)" }}>{fmtTime(r.created_at)}</span>
            </button>
          );
        })}
        {filtered.length === 0 && <EmptyState title="Yozuv topilmadi" sub="Filtrlarni tozalab ko'ring — jurnal barcha amallarni saqlaydi." />}
        {shown < filtered.length && (
          <button
            onClick={() => setShown((n) => n + 50)}
            className="w-full border-t py-3 text-center text-[13px] font-bold transition-colors duration-150 hover:bg-[var(--hover)]"
            style={{ borderColor: "var(--line2)", color: "var(--primary)" }}
          >
            Yana {Math.min(50, filtered.length - shown)} ta ko&apos;rsatish
          </button>
        )}
      </div>

      {sel && <AuditDetail row={sel} onClose={() => setSel(null)} onCopy={() => showToast("✓ JSON nusxalandi")} />}
    </>
  );
}

/** Bitta yozuvning to'liq tafsiloti — barcha maydonlar, oldin → keyin */
function AuditDetail({ row, onClose, onCopy }: { row: AuditLog; onClose: () => void; onCopy: () => void }) {
  const def = auditAction(row.action);
  const hue = KIND_HUE[def.kind];
  const Icon = KIND_ICON[def.kind];
  const changes = auditChanges(row, true);

  return (
    <Modal onClose={onClose} width={520}>
      <div className="pt-6">
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px]"
            style={{ background: `color-mix(in srgb, ${hue} 15%, transparent)`, color: `color-mix(in srgb, ${hue} 72%, var(--text))` }}
          >
            <Icon size={19} strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-semibold leading-tight tracking-tight">{def.label}</div>
            <div className="mt-0.5 text-[12.5px]" style={{ color: "var(--muted)" }}>
              {entityName(row.entity_type)} #{row.entity_id} · {fmtTime(row.created_at)}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-[color:var(--border)]">
        <div className="flex justify-between gap-3.5 px-4 py-3">
          <span className="text-[13px]" style={{ color: "var(--text-2)" }}>Kim</span>
          <span className="text-right text-[13px] font-semibold">
            {auditActor(row)}
            {row.user_detail?.username && <span className="ml-1.5 font-medium" style={{ color: "var(--muted)" }}>@{row.user_detail.username}</span>}
          </span>
        </div>
        <div className="flex justify-between gap-3.5 border-t border-[color:var(--border)] px-4 py-3">
          <span className="text-[13px]" style={{ color: "var(--text-2)" }}>Amal kaliti</span>
          <code className="text-right text-[12px]" style={{ color: "var(--muted)" }}>{row.action}</code>
        </div>
      </div>

      <div className="mt-3.5 rounded-2xl border border-[color:var(--border)] px-4 py-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[1.5px]" style={{ color: "var(--primary)" }}>O&apos;zgarishlar</div>
        {changes.length ? (
          <div className="flex flex-col gap-1.5">
            {changes.map((c) => (
              <div key={c.key} className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate" style={{ color: "var(--text-2)" }}>{c.label}</span>
                <span className="flex shrink-0 items-baseline gap-1.5">
                  {c.from !== undefined && <span className="line-through" style={{ color: "var(--muted)" }}>{c.from}</span>}
                  {c.from !== undefined && c.to !== undefined && <ArrowRight size={11} strokeWidth={2.2} style={{ color: "var(--muted)" }} />}
                  {c.to !== undefined ? <b>{c.to}</b> : <Minus size={12} strokeWidth={2} style={{ color: "var(--muted)" }} />}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>Bu amalda maydon o&apos;zgarishi qayd etilmagan.</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => { navigator.clipboard?.writeText(JSON.stringify({ before: row.before, after: row.after }, null, 2)); onCopy(); }}
        className="mt-3.5 w-full rounded-[14px] border py-2.5 text-[12.5px] font-bold transition-colors duration-150 hover:bg-[var(--hover)]"
        style={{ borderColor: "var(--border)", color: "var(--text-2)" }}
      >
        Xom JSON nusxalash
      </button>
    </Modal>
  );
}
