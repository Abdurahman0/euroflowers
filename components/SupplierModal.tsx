"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { batchTitle, batchTitleNoHeight } from "@/lib/stockLabel";
import { CalendarRange, HandCoins, Package, Truck, Wallet } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import { notifyReportDataChanged } from "@/lib/reportCache";
import Modal, { ModalFooter, ModalHeader, Section, Field } from "./Modal";
import StemGauge from "./StemGauge";
import { fmt, fmtDate, fmtLocalDate } from "@/lib/format";
import { stems, freshness, MOVEMENT_LABEL, DELIVERY, compareBatchNewestFirst, isFreeBatch } from "@/lib/inventory";
import FreeBatchChip from "./FreeBatchChip";
import DatePicker from "./DatePicker";
import SupplierBalance from "./SupplierBalance";
import SupplierDebtModal from "./SupplierDebtModal";
import {
  EMPTY_RANGE, createdAtQuery, hasRange, inDateRange, rangeLabel, rangeToParams, readRange,
  supplierTotals, type DateRange,
} from "@/lib/supplierRange";
import type { MaterialDelivery, MovementType, StockBatch, StockMovement, Supplier, SupplierDebt, SupplierPayment } from "@/lib/types";

/** Yetkazib beruvchi — yaratish/tahrirlash (o'ng drawer). */
export function SupplierForm({ supplier, onClose, onSaved }: { supplier: Supplier | null; onClose: () => void; onSaved: (s: Supplier) => void }) {
  const { showToast } = useStore();
  const [f, setF] = useState({
    name: supplier?.name ?? "",
    phone: supplier?.phone ?? "",
    notes: supplier?.notes ?? "",
    is_active: supplier?.is_active ?? true,
  });
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!f.name.trim()) return showToast("Nomini kiriting");
    setBusy(true);
    try {
      const payload = { name: f.name.trim(), phone: f.phone.trim(), notes: f.notes.trim(), is_active: f.is_active };
      const saved = supplier ? await api.updateSupplier(supplier.id, payload) : await api.createSupplier(payload);
      showToast(supplier ? "✓ Yetkazib beruvchi yangilandi" : "✓ Yetkazib beruvchi qo'shildi");
      onSaved(saved);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Saqlab bo'lmadi");
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={480}>
      <ModalHeader icon={<Truck size={20} strokeWidth={1.75} />} title={supplier ? "Yetkazib beruvchini tahrirlash" : "Yangi yetkazib beruvchi"} sub="Partiyalar shu manbaga bog'lanadi" onClose={onClose} />
      <Section>Ma&apos;lumot</Section>
      <div className="grid grid-cols-1 gap-3">
        <Field label="Nomi" span>
          <input className="inp" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Masalan: Golland Flora" autoFocus />
        </Field>
        <Field label="Telefon" span>
          <input className="inp" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="Masalan: +998901234567" inputMode="tel" />
        </Field>
        <Field label="Izoh" span>
          <textarea className="inp min-h-[70px] resize-y" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Masalan: haftada 2 marta yetkazadi" />
        </Field>
        <label className="flex cursor-pointer items-center gap-2 text-[13px]" style={{ color: "var(--text-2)" }}>
          <input type="checkbox" checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} className="h-4 w-4 accent-[var(--primary)]" />
          Faol
        </label>
      </div>
      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : supplier ? "Saqlash" : "Qo'shish"}</button>
      </ModalFooter>
    </Modal>
  );
}

const StatChip = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-[13px] border px-3 py-2 text-center" style={{ borderColor: "var(--border)" }}>
    <div className="text-[15px] font-bold tabular-nums">{value}</div>
    <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{label}</div>
  </div>
);

/**
 * Yetkazib beruvchi tafsiloti — sana oralig'i + 3 tab (Partiyalar / Harakatlar / To'lovlar).
 *
 * ⚠️ IKKI XIL DAVR BIR EKRANDA — ADASHTIRMASLIK SHART:
 *   • YUQORIDAGI CHIPLAR (`batches_count`, `total_received_stems`) — butun davr.
 *   • BALANS BLOKI — endi SERVERDAN va DAVRGA ERGASHADI: `/api/suppliers/{id}/`
 *     `date_from`/`date_to` ni QABUL QILADI (20.08.2026 deploy). ⚠️ Bu fayldagi
 *     eski izoh «sana parametri YO'Q» der edi — u endi TO'G'RI EMAS, shu bois
 *     balansni klientda yig'ish kerak emas.
 *   • PASTDAGI RO'YXATLAR — tanlangan oraliq bo'yicha, sarlavhada davr ko'rsatiladi.
 * Ikkalasi bir xil davrni tasvirlayotgandek ko'rinmasligi uchun har biri O'Z yorlig'i
 * bilan chiqadi (talab §3).
 *
 * Filtr qayerda bajariladi (jonli auditga qarang: lib/supplierRange.ts):
 *   Harakatlar → SERVERDA (`created_at_after/_before` — ekranda ham `created_at`).
 *   Partiyalar/Yuklar → KLIENTDA `received_at` bo'yicha; serverda bu maydon uchun
 *     oraliq filtri YO'Q, `created_at` esa BOSHQA kun (bir kun farq jonli topilgan).
 *   To'lovlar → KLIENTDA `paid_at` bo'yicha; serverda faqat ANIQ kun (`paid_at=`).
 */
export function SupplierDetail({ supplier, onClose, onEdit, onOpenBatch }: { supplier: Supplier; onClose: () => void; onEdit?: () => void; onOpenBatch?: (b: StockBatch) => void }) {
  const [tab, setTab] = useState<"batches" | "materials" | "moves" | "payments" | "debts">("batches");
  const [batches, setBatches] = useState<StockBatch[] | null>(null);
  const [materialDeliveries, setMaterialDeliveries] = useState<MaterialDelivery[]>(supplier.material_deliveries ?? []);
  const [moves, setMoves] = useState<StockMovement[] | null>(null);
  const [payments, setPayments] = useState<SupplierPayment[] | null>(null);
  /**
   * ⚠️ BALANS SERVERDAN — `/api/suppliers/{id}/?date_from=&date_to=`.
   * Bu endpoint ilgari sana filtrini QABUL QILMASDI (shu fayldagi eski izohga
   * qarang) va jamilar klientda yig'ilardi. 20.08.2026 deploy'idan keyin server
   * balansni davr bo'yicha O'ZI hisoblaydi — biz endi faqat ko'rsatamiz.
   */
  const [srv, setSrv] = useState<Supplier | null>(null);
  const [debts, setDebts] = useState<SupplierDebt[] | null>(null);
  const [debtOpen, setDebtOpen] = useState(false);
  // ⚠️ URL'dan boshlang'ich oraliq — ulashilgan havola/yangilash oralig'ni SAQLAYDI
  const [range, setRange] = useState<DateRange>(() => (typeof window === "undefined" ? EMPTY_RANGE : readRange(window.location.search)));
  const filtered = hasRange(range);
  const setFrom = (v: string) => setRange((r) => ({ ...r, from: v }));
  const setTo = (v: string) => setRange((r) => ({ ...r, to: v }));
  const clearRange = () => setRange(EMPTY_RANGE);

  // URL'ga yozish — `?supplier=` bilan birga, shunda havola drawer'ni QAYTA OCHADI
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    u.searchParams.set("supplier", String(supplier.id));
    for (const k of ["date_from", "date_to"]) u.searchParams.delete(k);
    for (const [k, v] of Object.entries(rangeToParams(range))) u.searchParams.set(k, v);
    window.history.replaceState(null, "", u);
  }, [supplier.id, range]);

  const reloadBalance = useCallback(() => {
    api.supplier(supplier.id, rangeToParams(range)).then(setSrv).catch(() => {});
    api.supplierDebts({ supplier: supplier.id, ordering: "-adjusted_at", page_size: "all" })
      .then(setDebts).catch(() => setDebts([]));
  }, [supplier.id, range]);
  useEffect(() => { reloadBalance(); }, [reloadBalance]);

  useEffect(() => {
    // ⚠️ PARTIYALAR — server'ga sana YUBORILMAYDI. Yagona oraliq filtri `created_at`
    // bo'yicha bo'lardi, ekranda esa `received_at` ko'rinadi (jonli farq: 04.08 kelgan
    // 27 partiya 05.08 kiritilgan) — ya'ni server filtri ko'rinib turgan sanaga
    // MOS TUSHMASDI va qatorlar jimgina yo'qolardi. Klientda `received_at` bo'yicha.
    api.stockBatches({ supplier: supplier.id, ordering: "-received_at" }).then((bs) => setBatches([...bs].sort(compareBatchNewestFirst))).catch(() => setBatches([]));
    // TO'LOVLAR — serverda faqat ANIQ kun filtri bor (`paid_at=`), oraliq yo'q → klientda
    api.supplierPayments({ supplier: supplier.id, ordering: "-paid_at" }).then(setPayments).catch(() => setPayments([]));
    api.supplier(supplier.id).then((s) => setMaterialDeliveries(s.material_deliveries ?? [])).catch(() => {});
  }, [supplier.id]);

  useEffect(() => {
    // HARAKATLAR — SERVERDA filtrlanadi (`created_at_*` mavjud va ekranda ham `created_at`)
    setMoves(null);
    api.stockMovements({ supplier: supplier.id, ordering: "-created_at", ...createdAtQuery(range) }).then(setMoves).catch(() => setMoves([]));
  }, [supplier.id, range]);

  // ⚠️ KO'RINADIGAN partiyalar — sarlavha jamilari AYNAN shu ro'yxatdan hisoblanadi,
  // shuning uchun «sarlavha = ko'ringan qatorlar yig'indisi» tengligi buzilmaydi.
  const shownBatches = useMemo(() => (batches ?? []).filter((b) => inDateRange(b.received_at, range)), [batches, range]);

  // §4 YUK bo'yicha guruhlar — tartib partiya tartibidan meros (batches allaqachon saralangan)
  const batchGroups = useMemo(() => {
    const m = new Map<string, { key: string; title: string; rows: StockBatch[]; totalStems: number }>();
    // ⚠️ ORALIQ partiyaning O'Z `received_at`iga qo'llanadi — yuk sanasiga EMAS. Yuk
    // sarlavhasi shu bois guruhda QOLGAN partiyalarni sanaydi, «5 partiya» deb yozib
    // 2 tasini ko'rsatmaydi.
    for (const b of shownBatches) {
      const dd = b.delivery_detail;
      const key = dd ? `d${dd.id}` : "none";
      const title = dd ? DELIVERY.label(dd.number, fmtDate(dd.received_at)) : "Yuksiz partiyalar (eski yozuvlar)";
      const g = m.get(key) ?? { key, title, rows: [], totalStems: 0 };
      g.rows.push(b);
      g.totalStems += b.received_stems || 0;
      m.set(key, g);
    }
    // «Yuksiz» guruh DOIM oxirida; qolganlari birinchi qatorining tartibini saqlaydi (yangi birinchi)
    return Array.from(m.values()).sort((a, b) => (a.key === "none" ? 1 : b.key === "none" ? -1 : 0));
  }, [shownBatches]);

  const shownPayments = useMemo(() => (payments ?? []).filter((p) => inDateRange(p.paid_at, range)), [payments, range]);

  /**
   * SARLAVHA JAMILARI.
   * ⚠️ FILTRSIZ — SERVER raqamlari (avtoritativ; ro'yxat 500 qatorda cheklangani uchun
   * klient yig'indisi katta yetkazib beruvchida kam chiqishi mumkin edi).
   * ⚠️ ORALIQ TANLANGANDA — server sana bo'yicha kesa olmaydi, shuning uchun jamilar
   * KO'RINAYOTGAN qatorlardan hisoblanadi (`supplierTotals`, Vitest bilan qulflangan).
   */
  const derived = useMemo(() => supplierTotals(shownBatches, shownPayments), [shownBatches, shownPayments]);
  const head = filtered ? derived : {
    batchesCount: supplier.batches_count ?? 0,
    stems: supplier.total_received_stems ?? 0,
    purchase: parseFloat(supplier.purchase_total ?? "0") || 0,
    paid: parseFloat(supplier.paid_total ?? "0") || 0,
  };
  const paidInRange = derived.paid;

  /** Bo'sh holat — oraliq aybdor bo'lsa oralig'ni TOZALASH yo'li darhol beriladi */
  const Empty = ({ all }: { all: string }) => (
    <div className="py-6 text-center">
      <p className="text-[13px]" style={{ color: "var(--muted)" }}>{filtered ? "Bu davrda yozuv yo'q" : all}</p>
      {filtered && (
        <>
          <p className="mt-1 text-[12px]" style={{ color: "var(--muted)" }}>Tanlangan davr: <b>{rangeLabel(range)}</b></p>
          <button type="button" onClick={clearRange} className="mt-2 rounded-full border px-3.5 py-1.5 text-[12px] font-bold transition-colors duration-150 hover:bg-[var(--hover)]" style={{ borderColor: "var(--border-strong)", color: "var(--primary)" }}>
            Butun davrni ko&apos;rsatish
          </button>
        </>
      )}
    </div>
  );

  return (
    <Modal onClose={onClose} width={560}>
      <div className="flex flex-wrap items-center gap-3 pt-6">
        <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
          <Truck size={24} strokeWidth={1.75} />
        </span>
        <div className="min-w-[140px] flex-1">
          <div className="text-[18px] font-extrabold">{supplier.name}</div>
          <div className="text-[13px]" style={{ color: "var(--text-2)" }}>{supplier.phone || "telefon yo'q"}</div>
        </div>
        {!supplier.is_active && <span className="rounded-full bg-rose px-3 py-1 text-[11px] font-extrabold text-roseink">NOFAOL</span>}
        {onEdit && (
          <button type="button" onClick={onEdit} className="icon-btn border !h-8 !w-8" style={{ borderColor: "var(--border)" }} aria-label="Tahrirlash">
            <Package size={15} strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* ⚠️ JAMILAR DAVRGA ERGASHADI. Sarlavhada DOIM qaysi davr ekani yozilgan:
          filtrsiz «Butun davr» (server raqamlari), oraliqda esa aynan tanlangan davr
          (ko'rinayotgan qatorlardan hisoblangan). Ikkalasi hech qachon aralashmaydi. */}
      <div className="mt-4 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: filtered ? "var(--primary)" : "var(--muted)" }}>
        {rangeLabel(range)}
        <span className="h-px flex-1" style={{ background: "var(--line2, var(--border))" }} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2.5">
        <StatChip label="Partiya" value={`${head.batchesCount}`} />
        <StatChip label="Jami kelgan" value={stems(head.stems)} />
        {(head.purchase > 0 || filtered) && <StatChip label="Sotib olingan" value={fmt(head.purchase)} />}
        {(head.paid > 0 || filtered) && <StatChip label="To'langan" value={fmt(head.paid)} />}
      </div>

      {/* ⚠️ BALANS — SERVERNING raqamlari (biz hisoblamaymiz). Oraliq tanlansa
          `/api/suppliers/{id}/?date_from=&date_to=` o'sha davr bo'yicha qaytaradi. */}
      <SupplierBalance s={srv ?? supplier} note={filtered ? rangeLabel(range) : "butun davr"} />
      {filtered && (
        // ⚠️ Bu raqamlar SERVERDAN kelmadi — quyidagi qatorlardan yig'ildi. Aytib qo'yamiz.
        <p className="mt-1.5 text-[11px] leading-snug" style={{ color: "var(--muted)" }}>
          Tanlangan davr bo&apos;yicha — quyidagi <b>{head.batchesCount} partiya</b>
          {shownPayments.length > 0 ? <> va <b>{shownPayments.length} to&apos;lov</b></> : null} yig&apos;indisi.
        </p>
      )}
      {supplier.notes && (
        <p className="mt-3.5 rounded-[14px] bg-[color:var(--surface-2)] px-4 py-3 text-[13px] leading-relaxed">{supplier.notes}</p>
      )}

      {/* SANA ORALIG'I — pastdagi HAMMA ro'yxatga qo'llanadi. Sukut: filtrsiz. */}
      <div className="mt-4 rounded-[14px] border p-2.5" style={{ borderColor: filtered ? "var(--primary)" : "var(--border)", background: "var(--surface-2)" }}>
        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11.5px] font-bold" style={{ color: "var(--text-2)" }}>
          <CalendarRange size={13} strokeWidth={2} style={{ color: "var(--primary)" }} />
          Davr: {rangeLabel(range)}
          {filtered && (
            <button type="button" onClick={clearRange} className="ml-auto text-[11.5px] font-bold underline underline-offset-2" style={{ color: "var(--primary)" }}>Tozalash</button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <DatePicker value={range.from} onChange={setFrom} placeholder="Sanadan" ariaLabel="Sanadan" maxDate={range.to || undefined} />
          <DatePicker value={range.to} onChange={setTo} placeholder="Sanagacha" ariaLabel="Sanagacha" />
        </div>
      </div>

      {/* segment: tashqi --r-md, ichki --r-sm (modal tugmalari bilan bir oila) */}
      <div className="mt-3 flex gap-1 rounded-md border p-1" style={{ borderColor: "var(--border)" }}>
        {(["batches", "materials", "moves", "payments", "debts"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className="flex-1 rounded-sm py-1.5 text-[12.5px] font-bold transition-colors duration-150" style={tab === t ? { background: "var(--primary)", color: "#fff" } : { color: "var(--muted)" }}>
            {t === "batches" ? "Gul yuklari" : t === "materials" ? "Material / accessory" : t === "moves" ? "Harakatlar" : t === "payments" ? "To'lovlar" : "Qo'lda qarz"}
          </button>
        ))}
      </div>

      {tab === "batches" ? (
        <div className="mt-3 flex flex-col gap-3">
          {batches == null && <p className="py-4 text-center text-[13px]" style={{ color: "var(--muted)" }}>Yuklanmoqda…</p>}
          {batches != null && batchGroups.length === 0 && <Empty all="Partiya yo'q." />}
          {/* ⚠️ §4 YUK BO'YICHA GURUHLASH — yuk detali bilan AYNAN bir grammatika
              (sarlavha: yuk raqami · sana · jamilar). Guruhlar ham «yangi birinchi».
              Yuksiz (eski) partiyalar alohida guruhga tushadi — jimgina tushib qolmaydi. */}
          {batchGroups.map((g) => (
            <div key={g.key} className="rounded-[14px] border" style={{ borderColor: "var(--border)" }}>
              <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                <span className="flex min-w-0 items-center gap-1.5">
                  <Truck size={13} strokeWidth={2} style={{ color: "var(--primary)" }} />
                  <span className="truncate text-[12.5px] font-bold">{g.title}</span>
                </span>
                <span className="shrink-0 text-[11.5px] font-semibold" style={{ color: "var(--muted)" }}>
                  {g.rows.length} partiya · {stems(g.totalStems)}
                </span>
              </div>
              <div className="flex flex-col gap-2 p-2">
                {g.rows.map((b: StockBatch) => {
                  const fr = freshness(b.received_at);
                  return (
                    <button key={b.id} type="button" onClick={() => onOpenBatch?.(b)} className="rounded-[12px] border p-3 text-left transition-colors duration-150 hover:border-[color:var(--primary)]" style={{ borderColor: "var(--border)" }}>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-[13px] font-bold">{batchTitle(b)}</span>
                          {isFreeBatch(b) && <FreeBatchChip />}
                        </span>
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: `color-mix(in srgb, ${fr.hue} 15%, transparent)`, color: fr.hue }}>{fr.label}</span>
                      </div>
                      <StemGauge batch={b} compact />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : tab === "materials" ? (
        <div className="mt-3 flex flex-col gap-3">
          {materialDeliveries.length === 0 && <Empty all="Material/accessory yuki yo'q." />}
          {materialDeliveries.map((d) => (
            <div key={d.id} className="rounded-[14px] border p-3" style={{ borderColor: "var(--border)" }}>
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-bold">{d.number}</span><span className="text-[12px]" style={{ color: "var(--muted)" }}>{fmtDate(d.received_at)}</span></div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11.5px] font-bold"><span className="rounded-full bg-tint px-2.5 py-1">{d.total_quantity} dona</span><span className="rounded-full bg-mint px-2.5 py-1 text-mintink">{fmt(d.total_cost)}</span><span className="rounded-full bg-tint px-2.5 py-1">{d.item_count} tur</span></div>
              {d.items?.length ? <div className="mt-2 border-t pt-2" style={{ borderColor: "var(--line2)" }}>{d.items.map((x) => <div key={x.movement_id} className="flex justify-between gap-2 py-1 text-[12px]"><span className="truncate">{x.name_uz} <span style={{ color: "var(--muted)" }}>· {x.packaging_type ?? "material"}</span></span><span className="shrink-0 font-semibold">{x.quantity} · {fmt(x.unit_cost)}</span></div>)}</div> : null}
            </div>
          ))}
        </div>
      ) : tab === "moves" ? (
        <div className="mt-3 flex flex-col gap-1.5">
          {moves == null && <p className="py-4 text-center text-[13px]" style={{ color: "var(--muted)" }}>Yuklanmoqda…</p>}
          {moves?.length === 0 && <Empty all="Harakat yo'q." />}
          {moves?.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 border-t py-2 text-[13px] first:border-t-0" style={{ borderColor: "var(--line2)" }}>
              <span className="min-w-0 truncate">{MOVEMENT_LABEL[m.movement_type as MovementType] ?? m.movement_type} · {batchTitleNoHeight(m.batch_detail, `#${m.batch}`)}</span>
              <span className="shrink-0 font-semibold tabular-nums">{stems(m.quantity_stems)}</span>
              <span className="shrink-0 text-[12px]" style={{ color: "var(--muted)" }}>{fmtDate(m.created_at)}</span>
            </div>
          ))}
        </div>
      ) : tab === "payments" ? (
        <div className="mt-3 flex flex-col gap-1.5">
          {payments == null && <p className="py-4 text-center text-[13px]" style={{ color: "var(--muted)" }}>Yuklanmoqda…</p>}
          {payments != null && shownPayments.length === 0 && <Empty all="To'lov yo'q." />}
          {shownPayments.length > 0 && (
            <div className="mb-1 flex items-center justify-between gap-2 rounded-[12px] px-3 py-2 text-[12.5px] font-bold" style={{ background: "var(--surface-2)" }}>
              <span className="flex items-center gap-1.5"><Wallet size={13} strokeWidth={2} style={{ color: "var(--primary)" }} />{rangeLabel(range)}</span>
              <span className="tabular-nums" style={{ color: "var(--acc)" }}>{shownPayments.length} ta · {fmt(paidInRange)}</span>
            </div>
          )}
          {shownPayments.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 border-t py-2 text-[13px] first:border-t-0" style={{ borderColor: "var(--line2)" }}>
              <span className="min-w-0 truncate">{p.method_label || p.method}{p.note ? ` · ${p.note}` : ""}</span>
              <span className="shrink-0 font-semibold tabular-nums" style={{ color: "var(--acc)" }}>{fmt(p.amount)}</span>
              {/* ⚠️ `paid_at` — KUN (YYYY-MM-DD), mintaqa o'girilmaydi */}
              <span className="shrink-0 text-[12px]" style={{ color: "var(--muted)" }}>{fmtLocalDate(p.paid_at)}</span>
            </div>
          ))}
        </div>
      ) : (
        /* QO'LDA QO'SHILGAN QARZLAR — /api/supplier-debts/ */
        <div className="mt-3 flex flex-col gap-1.5">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[12px] leading-snug" style={{ color: "var(--muted)" }}>
              Tizimga kirmagan eski qarzlar. Balansga <b>qo&apos;shiladi</b>.
            </span>
            <button type="button" onClick={() => setDebtOpen(true)} className="btn-secondary btn-sm !flex-none">
              <HandCoins size={13} strokeWidth={2} /> Qarz qo&apos;shish
            </button>
          </div>
          {debts == null && <p className="py-4 text-center text-[13px]" style={{ color: "var(--muted)" }}>Yuklanmoqda…</p>}
          {debts != null && debts.length === 0 && (
            <p className="py-6 text-center text-[13px]" style={{ color: "var(--muted)" }}>Qo&apos;lda qo&apos;shilgan qarz yo&apos;q.</p>
          )}
          {(debts ?? []).map((x) => (
            <div key={x.id} className="flex items-center justify-between gap-3 border-t py-2 text-[13px] first:border-t-0" style={{ borderColor: "var(--line2)" }}>
              <span className="min-w-0 truncate">{x.note || "Qo'lda qo'shilgan qarz"}</span>
              <span className="shrink-0 font-semibold tabular-nums" style={{ color: "var(--danger-ink)" }}>+{fmt(x.amount)}</span>
              <span className="shrink-0 text-[12px]" style={{ color: "var(--muted)" }}>{fmtLocalDate(x.adjusted_at ?? x.created_at)}</span>
            </div>
          ))}
        </div>
      )}

      {debtOpen && (
        <SupplierDebtModal
          supplier={srv ?? supplier}
          onClose={() => setDebtOpen(false)}
          onSaved={() => { setDebtOpen(false); reloadBalance(); notifyReportDataChanged(); }}
        />
      )}
    </Modal>
  );
}
