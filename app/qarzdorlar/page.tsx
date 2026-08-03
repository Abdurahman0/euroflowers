"use client";
import { useCallback, useEffect, useState } from "react";
import { ChevronDown, HandCoins, Info, Phone, User } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";
import { useStore, usePerm } from "@/lib/store";
import useAutoRefresh from "@/lib/useAutoRefresh";
import { fmt, fmtDate } from "@/lib/format";
import SearchInput from "@/components/SearchInput";
import FilterSelect from "@/components/FilterSelect";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import DebtPayModal from "@/components/DebtPayModal";
import ClientModal from "@/components/ClientModal";
import { VOLUME_LABEL } from "@/lib/inventory";
import { debtNum, debtQtyLabel, DEBT_METHOD_LABEL } from "@/lib/debt";
import type { Customer, Debt, DebtByCustomer, DebtCustomerGroup } from "@/lib/types";

/**
 * QARZDORLAR — kimga qanaqa gul qarzga berilgani, qancha summaga, qachon.
 *
 * ⚠️ Ruxsat: `crm` (inventory EMAS).
 * ⚠️ Guruhlangan ko'rinishni server ENG KATTA QARZDAN saralab beradi — qayta
 *    saralamaymiz va `totals` ni qayta hisoblamaymiz.
 * ⚠️ To'lanmagan qarz /api/accounting/ da KO'RINMAYDI — pul kassaga tushmagan.
 *    Shuning uchun bu sahifa «savdo» emas, «kutilayotgan pul» sahifasi.
 */
export default function QarzdorlarPage() {
  const { showToast } = useStore();
  const { canView } = usePerm();
  const allowed = canView("crm");

  const [tab, setTab] = useState<"guruh" | "royxat">("guruh");
  const [includePaid, setIncludePaid] = useState(false);
  const [grouped, setGrouped] = useState<DebtByCustomer | null>(null);
  const [flat, setFlat] = useState<Debt[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<Set<number>>(new Set());
  const [pay, setPay] = useState<Debt | null>(null);
  const [client, setClient] = useState<Customer | null>(null);

  // ro'yxat (§4) — SERVER filtrlari
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [paidF, setPaidF] = useState("");        // ?is_paid=
  const [methodF, setMethodF] = useState("");    // ?paid_method=
  const [ordering, setOrdering] = useState("-created_at");
  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(t); }, [search]);

  // URL'da saqlash (chuqur havola + yangilashda yo'qolmasin)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("tab") === "royxat") setTab("royxat");
    if (p.get("paid") === "true") setIncludePaid(true);
    const ip = p.get("is_paid"); if (ip === "true" || ip === "false") setPaidF(ip);
    const pm = p.get("paid_method"); if (pm === "cash" || pm === "card") setMethodF(pm);
    const s = p.get("search"); if (s) { setSearch(s); setQ(s); }
    const o = p.get("ordering"); if (o) setOrdering(o);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    tab === "royxat" ? u.searchParams.set("tab", "royxat") : u.searchParams.delete("tab");
    includePaid ? u.searchParams.set("paid", "true") : u.searchParams.delete("paid");
    paidF ? u.searchParams.set("is_paid", paidF) : u.searchParams.delete("is_paid");
    methodF ? u.searchParams.set("paid_method", methodF) : u.searchParams.delete("paid_method");
    q ? u.searchParams.set("search", q) : u.searchParams.delete("search");
    ordering !== "-created_at" ? u.searchParams.set("ordering", ordering) : u.searchParams.delete("ordering");
    window.history.replaceState(null, "", u);
  }, [tab, includePaid, paidF, methodF, q, ordering]);

  const load = useCallback(() => {
    if (!allowed) return;
    if (tab === "guruh") {
      api.debtsByCustomer(includePaid)
        .then((d) => { setGrouped(d); setErr(""); })
        .catch((e) => setErr(e instanceof Error ? e.message : "Yuklab bo'lmadi"))
        .finally(() => setLoading(false));
    } else {
      // ⚠️ FILTRLASH FAQAT SERVERDA (klientda qayta filtrlamaymiz)
      api.debts({
        is_paid: paidF || undefined,
        paid_method: methodF || undefined,
        search: q || undefined,
        ordering,
        page_size: 200,
      })
        .then((d) => { setFlat(d); setErr(""); })
        .catch((e) => setErr(e instanceof Error ? e.message : "Yuklab bo'lmadi"))
        .finally(() => setLoading(false));
    }
  }, [allowed, tab, includePaid, paidF, methodF, q, ordering]);
  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);

  const openClient = async (id: number) => {
    try { setClient(await api.customer(id)); } catch { showToast("Mijozni ochib bo'lmadi"); }
  };

  if (!allowed) return <div className="p-8"><EmptyState title="Ruxsat yo'q" sub="Bu sahifa «crm» ruxsatini talab qiladi." /></div>;
  if (loading) return <FlowerLoader />;

  const t = grouped?.totals;

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-5 sm:px-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[22px] font-extrabold tracking-tight">
            <HandCoins size={20} strokeWidth={1.9} style={{ color: "var(--primary)" }} /> Qarzdorlar
          </h1>
          <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--muted)" }}>
            Qarzga berilgan gul — pul kelganda savdoga qo&apos;shiladi
          </p>
        </div>
        {tab === "guruh" && t && (
          <div className="flex flex-wrap items-center gap-2">
            <Chip label="Jami qarz" value={fmt(debtNum(t.unpaid_total))} strong />
            <Chip label="Qarzdor" value={`${t.customer_count} ta`} />
            <Chip label="Qarz yozuvi" value={`${t.debt_count} ta`} />
          </div>
        )}
      </header>

      {/* TAB — guruhlangan (sukut) / tekis ro'yxat */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {([["guruh", "Mijoz bo'yicha"], ["royxat", "Ro'yxat"]] as const).map(([k, lab]) => (
          <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k}
            className={clsx("rounded-full border-[1.5px] px-5 py-2 text-[13px] font-bold", tab === k ? "text-white" : "bg-sfc")}
            style={tab === k ? { background: "var(--acc)", borderColor: "var(--acc)" } : { borderColor: "var(--line)", color: "var(--mut)" }}>
            {lab}
          </button>
        ))}
        {tab === "guruh" && (
          <label className="ml-1 flex cursor-pointer items-center gap-2 rounded-full border-[1.5px] px-4 py-2 text-[12.5px] font-bold"
            style={{ borderColor: includePaid ? "var(--primary)" : "var(--line)", color: includePaid ? "var(--primary)" : "var(--mut)" }}>
            <input type="checkbox" checked={includePaid} onChange={(e) => { setIncludePaid(e.target.checked); setLoading(true); }} className="h-3.5 w-3.5 accent-[var(--primary)]" />
            To&apos;langanlarni ham
          </label>
        )}
      </div>

      {err && <p className="mb-3 rounded-[11px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>{err}</p>}

      {tab === "guruh" ? (
        !grouped || grouped.customers.length === 0 ? (
          <EmptyState
            title={includePaid ? "Qarz yozuvi yo'q" : "Qarzdor yo'q"}
            sub="Katalogdan sotishda to'lov turini «Qarz» qilib mijoz tanlansangiz, yozuv shu yerda paydo bo'ladi."
          />
        ) : (
          <div className="grid gap-2.5">
            {/* ⚠️ Server tartibi (eng katta qarzdan) — QAYTA SARALAMAYMIZ */}
            {grouped.customers.map((c) => (
              <CustomerBlock
                key={c.customer}
                c={c}
                open={open.has(c.customer)}
                onToggle={() => setOpen((s) => { const n = new Set(s); n.has(c.customer) ? n.delete(c.customer) : n.add(c.customer); return n; })}
                onPay={setPay}
                onOpenClient={openClient}
              />
            ))}
          </div>
        )
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Ism, telefon, izoh yoki katalog nomi…" />
            {/* ⚠️ `label` — tanlanmagan holatdagi yozuv. Berilmasa hammasi «Filtr» bo'lib
                qoladi va qaysi biri nima ekani bilinmaydi. */}
            <FilterSelect value={paidF} label="Holat" onChange={(v) => { setPaidF(v); setLoading(true); }} options={[
              { value: "", label: "Holat: hammasi" }, { value: "false", label: "To'lanmagan" }, { value: "true", label: "To'langan" },
            ]} />
            <FilterSelect value={methodF} label="To'lov usuli" onChange={(v) => { setMethodF(v); setLoading(true); }} options={[
              { value: "", label: "Usul: hammasi" }, { value: "cash", label: "Naqd bilan to'langan" }, { value: "card", label: "Karta bilan to'langan" },
            ]} />
            <FilterSelect value={ordering} label="Tartib" onChange={(v) => { setOrdering(v); setLoading(true); }} options={[
              { value: "-created_at", label: "Eng yangi" }, { value: "created_at", label: "Eng eski" },
              { value: "-amount", label: "Katta summa" }, { value: "amount", label: "Kichik summa" },
            ]} />
          </div>
          {!flat || flat.length === 0 ? (
            <EmptyState title="Qarz topilmadi" sub="Filtrlarni kengaytiring yoki katalogdan «Qarz» bilan soting." />
          ) : (
            <div className="grid gap-2">
              {flat.map((d) => (
                <div key={d.id} className="rounded-[14px] border p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface-solid)", opacity: d.is_paid ? 0.62 : 1 }}>
                  <DebtRow d={d} onPay={setPay} showCustomer onOpenClient={openClient} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {pay && <DebtPayModal debt={pay} onClose={() => setPay(null)} onPaid={() => { setPay(null); setLoading(true); load(); }} />}
      {client && <ClientModal client={client} onClose={() => setClient(null)} />}
    </div>
  );
}

function Chip({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-[13px] border px-3.5 py-2" style={{ borderColor: strong ? "var(--primary)" : "var(--border)", background: strong ? "var(--primary-soft)" : "var(--surface-solid)" }}>
      <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="mt-0.5 text-[16px] font-extrabold tabular-nums" style={{ color: strong ? "var(--danger-ink)" : "var(--text)" }}>{value}</div>
    </div>
  );
}

/** Mijoz bloki — akkordeon (bizdagi mavjud naqsh). */
function CustomerBlock({ c, open, onToggle, onPay, onOpenClient }: {
  c: DebtCustomerGroup;
  open: boolean;
  onToggle: () => void;
  onPay: (d: Debt) => void;
  onOpenClient: (id: number) => void;
}) {
  return (
    <div className="overflow-hidden rounded-[16px] border" style={{ borderColor: open ? "var(--primary)" : "var(--border)", background: "var(--surface-solid)" }}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: "var(--primary-soft)" }}>
          <User size={16} strokeWidth={2} style={{ color: "var(--primary)" }} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-bold">{c.name || `Mijoz #${c.customer}`}</span>
          {c.phone && (
            <span className="mt-0.5 flex items-center gap-1 text-[11.5px]" style={{ color: "var(--muted)" }}>
              <Phone size={11} strokeWidth={2} /> {c.phone}
            </span>
          )}
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-[15px] font-extrabold tabular-nums" style={{ color: "var(--danger-ink)" }}>{fmt(debtNum(c.unpaid_total))}</span>
          <span className="block text-[11px]" style={{ color: "var(--muted)" }}>{c.debt_count} ta qarz</span>
        </span>
        <ChevronDown size={17} className="shrink-0 transition-transform" style={{ color: "var(--muted)", transform: open ? "rotate(180deg)" : undefined }} />
      </button>

      {open && (
        <div className="border-t px-3 pb-3 pt-2.5" style={{ borderColor: "var(--line2, var(--border))" }}>
          <button type="button" onClick={() => onOpenClient(c.customer)}
            className="mb-2 text-[11.5px] font-bold underline underline-offset-2" style={{ color: "var(--primary)" }}>
            Mijoz kartochkasini ochish →
          </button>
          <div className="grid gap-2">
            {c.items.map((d) => (
              <div key={d.id} className="rounded-[13px] border p-2.5" style={{ borderColor: "var(--line2, var(--border))", opacity: d.is_paid ? 0.6 : 1 }}>
                <DebtRow d={d} onPay={onPay} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Bitta qarz qatori — rasm, nom, hajm, «N ta · M gul», summa, sana, izoh, «To'landi». */
function DebtRow({ d, onPay, showCustomer, onOpenClient }: {
  d: Debt;
  onPay: (d: Debt) => void;
  showCustomer?: boolean;
  onOpenClient?: (id: number) => void;
}) {
  const cd = d.catalog_detail;
  const vol = cd?.volume ? (VOLUME_LABEL[cd.volume as keyof typeof VOLUME_LABEL] ?? cd.volume) : "";
  return (
    <div className="flex items-start gap-2.5">
      {/* ⚠️ image_url BO'LMASLIGI mumkin — qatorni bo'shatmaymiz, o'rniga belgi qo'yamiz */}
      {cd?.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cd.image_url} alt="" className="h-12 w-12 shrink-0 rounded-[10px] object-cover" style={{ background: "var(--surface-2)" }} />
      ) : (
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[10px]" style={{ background: "var(--surface-2)" }} aria-hidden>
          <HandCoins size={16} strokeWidth={1.9} style={{ color: "var(--muted)" }} />
        </span>
      )}

      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold">
          {cd?.name_uz || "Katalog"}{vol ? <span style={{ color: "var(--muted)" }}> · {vol}</span> : null}
        </div>
        <div className="mt-0.5 text-[11.5px]" style={{ color: "var(--muted)" }}>
          {debtQtyLabel(d.quantity, cd?.stems_total)} · {fmtDate(d.created_at)}
        </div>
        {showCustomer && d.customer_detail && (
          <button type="button" onClick={() => onOpenClient?.(d.customer_detail!.id)}
            className="mt-0.5 block max-w-full truncate text-[11.5px] font-bold underline underline-offset-2" style={{ color: "var(--primary)" }}>
            {d.customer_detail.name || `Mijoz #${d.customer_detail.id}`}
          </button>
        )}
        {d.note ? <div className="mt-0.5 text-[11.5px] italic" style={{ color: "var(--text-2)" }}>«{d.note}»</div> : null}
        {d.is_paid && (
          <div className="mt-1 flex items-center gap-1 text-[11px] font-bold" style={{ color: "var(--success-ink, #3d8a5f)" }}>
            <Info size={11} strokeWidth={2.2} />
            To&apos;langan{d.paid_method ? ` · ${d.paid_method_label || DEBT_METHOD_LABEL[d.paid_method as "cash" | "card"] || d.paid_method}` : ""}{d.paid_at ? ` · ${fmtDate(d.paid_at)}` : ""}
          </div>
        )}
      </div>

      <div className="shrink-0 text-right">
        <div className="text-[14px] font-extrabold tabular-nums" style={{ color: d.is_paid ? "var(--muted)" : "var(--danger-ink)" }}>{fmt(d.amount)}</div>
        {!d.is_paid && (
          <button type="button" onClick={() => onPay(d)}
            className="mt-1 rounded-full border-[1.5px] px-3 py-1 text-[11.5px] font-bold"
            style={{ borderColor: "var(--primary)", color: "var(--primary)" }}>
            To&apos;landi
          </button>
        )}
      </div>
    </div>
  );
}
