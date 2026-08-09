"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Globe, Minus, Package, Pencil, Plus, ShoppingBag, Trash2, Move } from "lucide-react";
import { api } from "@/lib/api";
import { usePerm, useStore } from "@/lib/store";
import { fmtTime } from "@/lib/format";
import { auditActor, auditChanges, auditLabel, auditSummary, entityName, KIND_HUE, KIND_LABEL, AUDIT_ACTION_OPTIONS, AUDIT_ENTITY_VALUES, type AuditKind } from "@/lib/audit";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import SearchInput from "@/components/SearchInput";
import FilterSelect from "@/components/FilterSelect";
import ClearFilters from "@/components/ClearFilters";
import Pagination from "@/components/Pagination";
import RefreshButton from "@/components/RefreshButton";
import { usePagedList } from "@/lib/usePagedList";
import DatePicker from "@/components/DatePicker";
import Modal from "@/components/Modal";
import { initials } from "@/lib/format";
import type { AuditLog, User } from "@/lib/types";

const userName = (u: User) => [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || `#${u.id}`;

/**
 * Audit jurnali — kim, nima qilgani va NIMA O'ZGARGANI.
 * Yorliq sifatida backend `action_label`i ishlatiladi (`action` — texnik kod).
 * FILTRLAR SERVER TOMONDA: ?user=<id>, ?action=, ?entity_type=,
 * ?created_at_after= / ?created_at_before= (kontrakt: audit user filter).
 * Developer amallari backenddan umuman kelmaydi — alohida yashirish shart emas.
 * Ruxsat: audit.
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
  { value: "", label: "Barcha turkumlar" },
  ...(Object.keys(KIND_LABEL) as AuditKind[]).map((k) => ({ value: k, label: KIND_LABEL[k] })),
];

/** `to` sanasi ham qamrab olinsin — created_at_before kun OXIRI qilib yuboriladi */
const endOfDay = (ymd: string) => `${ymd}T23:59:59`;

export default function AuditPage() {
  const { canView } = usePerm();
  const showToast = useStore((s) => s.showToast);
  const visible = canView("audit");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");        // debounced — SHU SAHIFA ichida qidiradi (pastdagi izohga qarang)
  const [kind, setKind] = useState("");  // turkum — SHU SAHIFA ichida (backendda turkum tushunchasi yo'q)
  const [action, setAction] = useState("");   // server `action`
  const [entity, setEntity] = useState("");   // server `entity_type`
  const [user, setUser] = useState("");       // server `user`
  const [from, setFrom] = useState("");       // server `created_at_after`
  const [to, setTo] = useState("");           // server `created_at_before`
  const [users, setUsers] = useState<User[]>([]);
  const [sel, setSel] = useState<AuditLog | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  /**
   * ⚠️ HAQIQIY SERVER SAHIFALASHI. Ilgari `page_size: 100` bilan so'ralib,
   * `list()` 5 sahifada to'xtardi: bazada 2482 yozuv bo'lsa ham 500 tasi kelardi
   * va sarlavhada «500» deb turardi. O'tgan oydagi amalni topib bo'lmasdi va
   * hech narsa ro'yxat kesilganini bildirmasdi.
   * Endi: bitta sahifa = bitta so'rov, jami esa serverning `count`idan.
   */
  const list = usePagedList<AuditLog>({
    enabled: visible,
    fetcher: (query, signal) => api.auditPage(query, signal),
    filters: {
      ordering: "-created_at",
      user: user || undefined,
      action: action || undefined,
      entity_type: entity || undefined,
      created_at_after: from || undefined,
      created_at_before: to ? endOfDay(to) : undefined,
    },
  });
  const rows = list.rows;

  // ⚠️ TO'LIQ ro'yxat lib/audit.ts dan — ekrandagi sahifadan EMAS. Sahifada
  // ko'rinmagan amalni ham tanlab, server bo'yicha filtrlash mumkin bo'lsin.
  const actionOpts = useMemo(
    () => [{ value: "", label: "Barcha amallar" }, ...AUDIT_ACTION_OPTIONS.map(({ value, label }) => ({ value, label }))],
    []
  );
  // statik ro'yxat + shu sahifada ko'ringan noma'lum turlar (server yangi model qo'shsa ham tanlanadi)
  const entityOpts = useMemo(() => {
    const vals = Array.from(new Set<string>([...AUDIT_ENTITY_VALUES, ...rows.map((r) => r.entity_type).filter(Boolean)]));
    return [{ value: "", label: "Barcha obyektlar" },
      ...vals.map((e) => ({ value: e, label: entityName(e) })).sort((a, b) => a.label.localeCompare(b.label))];
  }, [rows]);

  const userOpts = useMemo(
    () => [{ value: "", label: "Barcha xodimlar" }, ...users.map((u) => ({ value: String(u.id), label: userName(u) }))],
    [users]
  );

  /**
   * ⚠️ TURKUM va QIDIRUV — FAQAT SHU SAHIFA ICHIDA, ataylab.
   *   • «turkum» backendda umuman yo'q (u bir nechta `action` kodining guruhi),
   *     `?action=` esa bittagina qiymat oladi (jonli tekshiruv: takroriy parametrda
   *     oxirgisi yutadi, vergul 0 qaytaradi, `action__in` e'tiborsiz qoladi).
   *   • `?search=` OpenAPI'da E'LON QILINGAN, lekin SERVER UNI E'TIBORGA OLMAYDI —
   *     `search=zzzzqwerty` ham 2482 tani qaytaradi. Ya'ni bu qidiruv hech qachon
   *     serverda ishlamagan; ilgari 500 qatorlik oynada ham hech narsa filtrlanmasdi.
   * Shuning uchun ikkalasi ham «shu sahifada» deb OCHIQ belgilangan. Butun jurnal
   * bo'yicha izlash uchun — Xodim / Amal / Obyekt / Sana (ular haqiqiy server filtri).
   */
  const filtered = useMemo(() => {
    let xs = rows;
    if (kind) xs = xs.filter((r) => auditLabel(r).kind === kind);
    const needle = q.toLowerCase();
    if (needle) xs = xs.filter((r) => `${auditActor(r)} ${auditLabel(r).label} ${entityName(r.entity_type)} ${r.summary ?? ""}`.toLowerCase().includes(needle));
    return xs;
  }, [rows, kind, q]);
  const pageFiltered = !!(kind || q);

  const hasFilter = !!(search || kind || action || entity || user || from || to);
  const clearAll = () => { setSearch(""); setQ(""); setKind(""); setAction(""); setEntity(""); setUser(""); setFrom(""); setTo(""); };

  if (!visible) return <EmptyState title="Ruxsat yo'q" sub="Bu sahifa uchun sizda ko'rish huquqi yo'q." />;
  if (list.error) return <p className="mt-10 text-center text-sm font-bold" style={{ color: "var(--danger-ink)" }}>{list.error}</p>;
  if (!list.ready) return <FlowerLoader />;

  return (
    <>
      {/* FILTR PANELI — qidiruv, xodim, amal, obyekt, sana oralig'i */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="note-chip text-[14px]" style={{ color: "var(--mut)" }}>
          {/* ⚠️ JAMI — serverning `count`i. Ilgari bu yerda 500 qatorlik oynaning
              uzunligi turardi va u «jami» deb o'qilardi (aslida 2482 ta edi). */}
          Audit jurnali ({list.info.count.toLocaleString("ru")}) — kim, nima qilgani va nima o&apos;zgargani
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* ⚠️ «shu sahifada» — server `?search=` ni E'TIBORGA OLMAYDI (jonli tekshirildi) */}
          <SearchInput value={search} onChange={setSearch} ariaLabel="Shu sahifada qidirish" placeholder="Shu sahifada qidirish…" />
          {users.length > 0 && <FilterSelect value={user} options={userOpts} onChange={(v) => { setUser(v); }} label="Xodim" />}
          <FilterSelect value={action} options={actionOpts} onChange={(v) => { setAction(v); }} label="Amal" />
          <FilterSelect value={kind} options={KIND_OPTS} onChange={setKind} label="Turkum (shu sahifada)" />
          <FilterSelect value={entity} options={entityOpts} onChange={(v) => { setEntity(v); }} label="Obyekt" />
          <div className="flex items-center gap-1.5">
            <div className="w-[140px]"><DatePicker value={from} onChange={(v) => { setFrom(v); }} placeholder="Sanadan" ariaLabel="Boshlanish sanasi" /></div>
            <span style={{ color: "var(--muted)" }}>–</span>
            <div className="w-[140px]"><DatePicker value={to} onChange={(v) => { setTo(v); }} placeholder="Sanagacha" ariaLabel="Tugash sanasi" /></div>
          </div>
          <ClearFilters show={hasFilter} onClear={clearAll} />
          <RefreshButton onRefresh={list.refresh} loadedAt={list.loadedAt} busy={list.loading} />
        </div>
      </div>

      <div className="glass overflow-hidden !rounded-[20px] max-md:overflow-x-auto">
        <div className="grid min-w-[880px] grid-cols-[150px_1.1fr_1fr_1.5fr_140px] gap-2.5 border-b-[1.5px] bg-tint px-4 py-3.5 text-[11px] font-bold uppercase tracking-widest text-tintink" style={{ borderColor: "var(--line)" }}>
          <span>Xodim</span><span>Amal</span><span>Obyekt</span><span>O&apos;zgarish</span><span>Vaqt</span>
        </div>
        {filtered.map((r, ri) => {
          const def = auditLabel(r);
          const hue = KIND_HUE[def.kind];
          const Icon = KIND_ICON[def.kind];
          const changes = auditChanges(r);
          const summary = auditSummary(r);
          return (
            <button
              key={r.id}
              onClick={() => setSel(r)}
              className="row-lux grid w-full min-w-[880px] grid-cols-[150px_1.1fr_1fr_1.5fr_140px] items-center gap-2.5 border-t px-4 py-3 text-left text-[13px]"
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
                  title={r.action}
                >
                  <Icon size={11} strokeWidth={2.2} /> {def.label}
                </span>
              </span>
              <span className="min-w-0 truncate" style={{ color: "var(--text-2)" }} title={`${entityName(r.entity_type)} #${r.entity_id}`}>
                {entityName(r.entity_type)} <span style={{ color: "var(--muted)" }}>#{r.entity_id}</span>
              </span>
              <span className="min-w-0 truncate" style={{ color: "var(--muted)" }} title={summary}>
                {r.summary?.trim() ? (
                  <span className="truncate">{r.summary}</span>
                ) : changes.length ? (
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
        {filtered.length === 0 && (
          /* ⚠️ «umuman yozuv yo'q» va «filtrga mos kelmadi» — BOSHQA-BOSHQA holat */
          list.info.count === 0 && !hasFilter
            ? <EmptyState title="Jurnal hozircha bo'sh" sub="Amallar bajarilgach shu yerda paydo bo'ladi." />
            : pageFiltered && list.info.count > 0
              ? <EmptyState title="Bu sahifada mos yozuv yo'q" sub="«Turkum» va qidiruv faqat shu sahifada ishlaydi — boshqa sahifaga o'ting yoki Xodim/Amal/Obyekt/Sana filtridan foydalaning." />
              : <EmptyState title="Filtrga mos yozuv topilmadi" sub="Filtrlarni tozalab ko'ring — jurnal barcha amallarni saqlaydi." />
        )}
      </div>

      <Pagination info={list.info} onPage={list.setPage} onPageSize={list.setPageSize} label="yozuv" busy={list.loading} />

      {sel && <AuditDetail row={sel} onClose={() => setSel(null)} onCopy={() => showToast("✓ JSON nusxalandi")} />}
    </>
  );
}

/** Bitta yozuvning to'liq tafsiloti — barcha maydonlar, oldin → keyin */
function AuditDetail({ row, onClose, onCopy }: { row: AuditLog; onClose: () => void; onCopy: () => void }) {
  const def = auditLabel(row);
  const hue = KIND_HUE[def.kind];
  const Icon = KIND_ICON[def.kind];
  const changes = auditChanges(row, true);
  const request = [row.request_method, row.request_path].filter(Boolean).join(" ");

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

      {row.summary?.trim() && (
        <p className="mt-3.5 rounded-[14px] px-4 py-3 text-[13px] leading-relaxed" style={{ background: "var(--primary-soft)", color: "var(--text)" }}>
          {row.summary}
        </p>
      )}

      <div className="mt-3.5 rounded-2xl border border-[color:var(--border)]">
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
        {row.ip_address && (
          <div className="flex justify-between gap-3.5 border-t border-[color:var(--border)] px-4 py-3">
            <span className="flex items-center gap-1.5 text-[13px]" style={{ color: "var(--text-2)" }}><Globe size={13} strokeWidth={1.9} /> IP manzil</span>
            <code className="text-right text-[12px]" style={{ color: "var(--muted)" }}>{row.ip_address}</code>
          </div>
        )}
        {request && (
          <div className="flex justify-between gap-3.5 border-t border-[color:var(--border)] px-4 py-3">
            <span className="text-[13px]" style={{ color: "var(--text-2)" }}>So&apos;rov</span>
            <code className="min-w-0 truncate text-right text-[12px]" style={{ color: "var(--muted)" }} title={request}>{request}</code>
          </div>
        )}
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
