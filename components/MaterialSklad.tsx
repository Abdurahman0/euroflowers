"use client";
import { ArrowDown, ArrowUp, Box, Newspaper, Pencil, Plus, ShoppingBasket, ShoppingCart, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import SearchInput from "./SearchInput";
import FilterSelect from "./FilterSelect";
import ClearFilters from "./ClearFilters";
import EmptyState from "./EmptyState";
import FlowerLoader from "./FlowerLoader";
import Modal, { ModalFooter, ModalHeader, Section, Field } from "./Modal";
import Select from "./Select";
import ImageInput from "./ImageInput";
import { api, ApiError } from "@/lib/api";
import { notifyReportDataChanged } from "@/lib/reportCache";
import { usePerm, useStore } from "@/lib/store";
import useAutoRefresh from "@/lib/useAutoRefresh";
import { useRouter } from "next/navigation";
import { fmt, fmtDate, fmtTime, movementLeadId } from "@/lib/format";
import { PACKAGING_LABEL, MATERIAL_DELIVERY } from "@/lib/inventory";
import { MATERIAL_UNIT_LABEL, BASKET_MATERIAL_LABEL, UNIT_CONFIG, configFor, quantityDual, receivePreview } from "@/lib/materialUnit";
import { Icon } from "./icons";
import type { BasketMaterial, MaterialDelivery, MaterialMovement, MaterialUnit, Packaging, PackagingType } from "@/lib/types";

/**
 * Material sklad — Buket qog'ozi / Savat / Quti / Aksessuarlar bo'yicha bo'limlangan
 * (backend: /api/materials/*, ichkarida Packaging modeli, packaging_type enum:
 * wrap|basket|box|other). Kirim-chiqim movement orqali yuritiladi.
 */

// backend enumi: wrap|basket|box|other (accessory YO'Q — eski qiymat other'ga tushiriladi)
const GROUP_ORDER: PackagingType[] = ["wrap", "basket", "box", "other"];
const GROUP_ICON: Record<string, LucideIcon> = { wrap: Newspaper, basket: ShoppingBasket, box: Box, other: Sparkles };
const TYPE_LABEL = PACKAGING_LABEL;
/** har qanday qiymatni backend enumiga tushiradi (eski "accessory" → "other") */
const normType = (t: string): PackagingType => (GROUP_ORDER.includes(t as PackagingType) ? (t as PackagingType) : "other");

/**
 * MATERIAL yaratish/tahrirlash. §3: yangi material YARATILAYOTGANDA uni darrov bir yukka
 * bog'lab kirim qilish mumkin (POST /api/materials/ `delivery` + birlikka mos maydonlar).
 * `lockedDelivery` berilsa (yuk detalidan ochilgan) — yuk oldindan tanlangan va QULFLANGAN.
 */
export function MaterialModal({ material, onClose, onSaved, lockedDelivery = null }: {
  material: Packaging | null;
  onClose: () => void;
  onSaved: (m: Packaging) => void;
  lockedDelivery?: MaterialDelivery | null;
}) {
  const { showToast } = useStore();
  const [f, setF] = useState({
    name_uz: material?.name_uz ?? "",
    name_ru: material?.name_ru ?? "",
    packaging_type: normType(material?.packaging_type ?? "wrap"),
    size: material?.size ?? "",
    unit: (material?.unit === "bunch" ? "bunch" : "piece") as MaterialUnit,
    units_per_bunch: material?.units_per_bunch ? String(material.units_per_bunch) : "",
    basket_material: (material?.basket_material ?? "") as BasketMaterial | "",
    cost_price: material ? String(Math.round(+(material.cost_price ?? 0))) : "",
    sale_price: material ? String(Math.round(+(material.sale_price ?? 0))) : "",
    quantity: material ? String(material.quantity) : "",
    image_url: material?.image_url ?? "",
  });
  // §3 YUKGA BOG'LASH — faqat YANGI materialda (mavjudini yukka kiritish «Material kiritish» orqali)
  const [linkOn, setLinkOn] = useState(!!lockedDelivery);
  const [deliveries, setDeliveries] = useState<MaterialDelivery[]>([]);
  const [deliveryId, setDeliveryId] = useState<number>(lockedDelivery?.id ?? 0);
  const [recvQty, setRecvQty] = useState("");   // piece: dona · bunch: POCHKA
  const [recvCost, setRecvCost] = useState(""); // piece: dona narxi · bunch: pochka narxi
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (material || lockedDelivery) return; // qulflangan yoki tahrir — ro'yxat kerak emas
    api.materialDeliveries({ ordering: "-received_at", page_size: 50 }).then(setDeliveries).catch(() => {});
  }, [material, lockedDelivery]);

  const upb = Math.round(+f.units_per_bunch || 0);
  const cfg = UNIT_CONFIG[f.unit];
  // ⚠️ BUKET QOG'OZI (wrap): «O'lcham» va «Sotuv narxi» bu turga ma'nosiz — so'ralmaydi.
  // Ikkalasi ham API'da IXTIYORIY (jonli OpenAPI: Packaging.required = [name_uz, packaging_type]).
  const hidesSizeAndSale = f.packaging_type === "wrap";
  // kirim preview — mavjud material qoldig'i 0 dan boshlanadi (yangi material)
  const preview = linkOn && recvQty.trim() !== ""
    ? receivePreview({ unit: f.unit, units_per_bunch: upb, quantity: 0, cost_price: "0" }, recvQty, recvCost)
    : null;

  const save = async () => {
    if (!f.name_uz.trim()) return showToast("Nomini kiriting");
    if (f.unit === "bunch" && upb <= 1) return showToast("Pochkadagi dona sonini (1 pochka = nechta dona) kiriting");
    if (linkOn && !deliveryId) return showToast("Yukni tanlang");
    if (linkOn && preview && !preview.ok) return showToast(preview.reason);
    setBusy(true);
    try {
      const n = Math.floor(parseFloat(recvQty) || 0);
      const payload: Record<string, unknown> = {
        name_uz: f.name_uz.trim(),
        name_ru: f.name_ru.trim() || f.name_uz.trim(),
        packaging_type: f.packaging_type,
        unit: f.unit,
        ...(f.unit === "bunch" ? { units_per_bunch: upb } : {}),
        ...(f.packaging_type === "basket" && f.basket_material ? { basket_material: f.basket_material } : {}),
        // ⚠️ WRAP (buket qog'ozi): «O'lcham» va «Sotuv narxi» so'ralMAYDI va kalitlari
        // UMUMAN YUBORILMAYDI (bo'sh satr/0 emas — zero-is-a-value intizomi). Mavjud wrap
        // materialini tahrirlaganda saqlangan qiymatlar SHU SABABLI tegilmay qoladi.
        ...(hidesSizeAndSale ? {} : { size: f.size.trim(), sale_price: f.sale_price ? String(+f.sale_price) : "0" }),
        is_active: true,
        image_url: f.image_url,
      };
      if (!material) {
        if (linkOn && deliveryId && n > 0) {
          // ⚠️ YUKGA BOG'LAB KIRIM — birlikka mos shakl; backend qoldiq/tannarxni O'ZI hisoblaydi
          payload.delivery = deliveryId;
          if (f.unit === "bunch") { payload.bunches = n; if (recvCost.trim() !== "") payload.cost_per_bunch = String(+recvCost); }
          else { payload.quantity = n; if (recvCost.trim() !== "") payload.cost_price = String(+recvCost); }
        } else {
          payload.quantity = +f.quantity || 0;
          payload.cost_price = f.cost_price ? String(+f.cost_price) : "0";
        }
      } else {
        payload.cost_price = f.cost_price ? String(+f.cost_price) : "0";
      }
      const saved = material ? await api.updateMaterial(material.id, payload) : await api.createMaterial(payload);
      showToast(material ? "✓ Material yangilandi" : linkOn ? `✓ Material qo'shildi va yukka kiritildi` : "✓ Material qo'shildi");
      onSaved(saved);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Saqlab bo'lmadi");
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={480}>
      <ModalHeader icon={<Icon name="sklad" size={20} />} title={material ? "Materialni tahrirlash" : "Yangi material"} sub="O'ram, savat, quti yoki aksessuar" onClose={onClose} />
      <Section>Asosiy</Section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nomi (uz)" span>
          <input className="inp" value={f.name_uz} onChange={(e) => setF({ ...f, name_uz: e.target.value })} placeholder="Masalan: Kraft o'ram" autoFocus={!material} />
        </Field>
        <Field label="Rasm" span><ImageInput value={f.image_url} onChange={(image_url) => setF({ ...f, image_url })} /></Field>
        <Field label="Turi">
          <Select
            value={f.packaging_type}
            onChange={(v) => setF({ ...f, packaging_type: v as PackagingType })}
            options={GROUP_ORDER.map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
          />
        </Field>
        {/* O'LCHOV BIRLIGI — kirim shakli SHUNDAN kelib chiqadi (dona vs pochka) */}
        <Field label="O'lchov birligi">
          <Select value={f.unit} onChange={(v) => setF({ ...f, unit: v as MaterialUnit })} options={(["piece", "bunch"] as const).map((u) => ({ value: u, label: MATERIAL_UNIT_LABEL[u] }))} />
        </Field>
        {f.unit === "bunch" && (
          <Field label="1 pochka = nechta dona" span>
            <input className="inp" inputMode="numeric" value={f.units_per_bunch} onChange={(e) => setF({ ...f, units_per_bunch: e.target.value.replace(/\D/g, "") })} placeholder="Masalan: 20" />
            <span className="mt-0.5 block text-[11px]" style={{ color: upb > 1 ? "var(--muted)" : "var(--warning-ink, #8a6d1f)" }}>
              {upb > 1 ? `Kirimda: pochka × ${upb} = dona; pochka narxi ÷ ${upb} = dona narxi` : "Pochkada kirim qilish uchun majburiy (1 dan katta)"}
            </span>
          </Field>
        )}
        {/* SAVAT materiali — faqat basket turida */}
        {f.packaging_type === "basket" && (
          <Field label="Savat materiali">
            <Select value={f.basket_material} onChange={(v) => setF({ ...f, basket_material: v as BasketMaterial | "" })}
              options={[{ value: "", label: "—" }, ...(["wooden", "plastic_handle", "woven"] as const).map((b) => ({ value: b, label: BASKET_MATERIAL_LABEL[b] }))]} />
          </Field>
        )}
        {/* ⚠️ O'LCHAM — buket qog'ozida so'ralmaydi (o'lcham tushunchasi yo'q) */}
        {!hidesSizeAndSale && (
          <Field label="O'lcham">
            <input className="inp" value={f.size} onChange={(e) => setF({ ...f, size: e.target.value })} placeholder="Masalan: M" />
          </Field>
        )}
        {/* yukka bog'lanmaganda — qo'lda tannarx/boshlang'ich son (yukka bog'lansa backend yozadi) */}
        {(!linkOn || material) && (
          <Field label="Tannarx (so'm)">
            <input className="inp" type="number" value={f.cost_price} onChange={(e) => setF({ ...f, cost_price: e.target.value })} placeholder="Masalan: 8000" />
          </Field>
        )}
        {/* ⚠️ SOTUV NARXI — buket qog'ozi sotilmaydi (faqat ishlatiladi) → so'ralmaydi */}
        {!hidesSizeAndSale && (
          <Field label="Sotuv narxi (so'm)">
            <input className="inp" type="number" value={f.sale_price} onChange={(e) => setF({ ...f, sale_price: e.target.value })} placeholder="Masalan: 20000" />
          </Field>
        )}
        {!material && !linkOn && (
          <Field label="Boshlang'ich soni">
            <input className="inp" type="number" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} placeholder="Masalan: 50" />
          </Field>
        )}
      </div>

      {/* ═══ §3 YUKGA BOG'LASH — yangi materialni darrov kirim qilish ═══ */}
      {!material && (
        <>
          <Section>Yukga bog&apos;lash</Section>
          {lockedDelivery ? (
            <p className="mb-2 rounded-[11px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
              {MATERIAL_DELIVERY.label(lockedDelivery.number, fmtDate(lockedDelivery.received_at))} — shu yukka kiritiladi
            </p>
          ) : (
            <label className="mb-2 flex cursor-pointer items-center justify-between gap-3 rounded-[13px] border px-3.5 py-2.5" style={{ borderColor: linkOn ? "var(--primary)" : "var(--border)", background: linkOn ? "var(--primary-soft)" : undefined }}>
              <span className="min-w-0">
                <span className="block text-[13px] font-bold">Yukka bog&apos;lab kirim qilish</span>
                <span className="block text-[11.5px]" style={{ color: "var(--muted)" }}>Qoldiq va tannarx kirimdan yoziladi</span>
              </span>
              <input type="checkbox" checked={linkOn} onChange={(e) => setLinkOn(e.target.checked)} className="h-4 w-4 shrink-0 accent-[var(--primary)]" />
            </label>
          )}
          {linkOn && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {!lockedDelivery && (
                <Field label="Qaysi yuk" span>
                  <Select value={deliveryId} onChange={(v) => setDeliveryId(+v)} placeholder="Yukni tanlang" searchable
                    options={deliveries.map((d) => ({ value: d.id, label: MATERIAL_DELIVERY.label(d.number, fmtDate(d.received_at)), sub: d.supplier_detail?.name ?? "postavshiksiz" }))} />
                </Field>
              )}
              <Field label={cfg.qtyLabel}>
                <input className="inp" inputMode="numeric" value={recvQty} onChange={(e) => setRecvQty(e.target.value.replace(/\D/g, ""))} placeholder={cfg.qtyPlaceholder} />
              </Field>
              <Field label={cfg.costLabel}>
                <input className="inp" inputMode="numeric" value={recvCost} onChange={(e) => setRecvCost(e.target.value.replace(/\D/g, ""))} placeholder={cfg.costPlaceholder} />
              </Field>
              {/* derivatsiya — receive formasidagi bilan AYNAN bir xil manba */}
              {preview && (preview.ok ? (
                <div className="col-span-full flex flex-col gap-1 rounded-[12px] px-3 py-2.5 text-[12.5px] font-semibold" style={{ background: "var(--surface-2)" }}>
                  {preview.lines.map((l, i) => <div key={i} className="tabular-nums" style={{ color: "var(--text-2)" }}><span style={{ color: "var(--primary)" }}>=</span> {l}</div>)}
                  <div className="flex items-center justify-between"><span style={{ color: "var(--text-2)" }}>Skladga</span><b className="tabular-nums" style={{ color: "var(--primary)" }}>{preview.quantity.toLocaleString("ru")} dona</b></div>
                  {preview.total != null && <div className="flex items-center justify-between border-t pt-1" style={{ borderColor: "var(--line2)" }}><span style={{ color: "var(--text-2)" }}>Jami</span><b className="tabular-nums" style={{ color: "var(--acc)" }}>{fmt(preview.total)}</b></div>}
                </div>
              ) : (
                <p className="col-span-full rounded-[10px] px-2.5 py-2 text-[12px] font-bold" style={{ background: "var(--danger-soft, rgba(160,74,74,.14))", color: "var(--danger-ink)" }}>{preview.reason}</p>
              ))}
            </div>
          )}
        </>
      )}

      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : material ? "Saqlash" : "Qo'shish"}</button>
      </ModalFooter>
    </Modal>
  );
}

/** ⚠️ CHIQIM (out) modali — KIRIM endi «Material yuki → Material kiritish» (receive) orqali
    (delivery + postavshik bilan). Stock qo'shishning IKKINCHI yo'li bo'lmasligi uchun bu yerda
    faqat chiqim/tuzatish qoladi (§0c). */
function MoveModal({ material, onClose, onDone }: { material: Packaging; onClose: () => void; onDone: () => void }) {
  const showToast = useStore((s) => s.showToast);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const n = +qty || 0;
    if (n <= 0) return showToast("Sonini kiriting");
    if (n > material.quantity) return showToast(`Qoldiq yetarli emas: ${material.quantity} dona bor`);
    setBusy(true);
    try {
      await api.materialMovement(material.id, { movement_type: "out", quantity: n, reason: reason.trim() });
      showToast(`✓ Chiqim: ${material.name_uz} × ${n}`);
      onDone();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Saqlab bo'lmadi");
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} width={420}>
      <ModalHeader icon={<Icon name="sklad" size={20} />} title={material.name_uz} sub={`Qoldiq: ${material.quantity} dona — chiqim kiriting`} onClose={onClose} />
      <p className="mb-3 rounded-[11px] px-3 py-2 text-[12px] font-semibold" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>
        Kirim endi «Material yuklari → Material kiritish» orqali (postavshik va tannarx bilan).
      </p>
      <div className="grid grid-cols-1 gap-3">
        <Field label="Chiqim soni (dona)">
          <input className="inp" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} placeholder="Masalan: 10" autoFocus />
        </Field>
        <Field label="Sabab">
          <input className="inp" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Masalan: buyurtmaga ishlatildi" />
        </Field>
      </div>
      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : "Chiqim"}</button>
      </ModalFooter>
    </Modal>
  );
}

/** Material batafsil — oxirgi postavshik bloki + kirim tarixi (delivery + unit_cost, eng yangi birinchi). */
function MaterialDetailModal({ material, onClose }: { material: Packaging; onClose: () => void }) {
  const [moves, setMoves] = useState<MaterialMovement[] | null>(null);
  useEffect(() => { api.materialMovements({ packaging: material.id, ordering: "-created_at", page_size: 50 }).then(setMoves).catch(() => setMoves([])); }, [material.id]);
  const ld = material.last_delivery;
  // ⚠️ STAT STRIP — kirim/chiqim harakatlaridan (gul partiyasi kabi izlanuvchanlik). O'rtacha narx =
  // KIRIMlarning og'irlikli o'rtachasi (narx tarixi shu harakatlarda). Qoldiq — materialning joriy soni.
  const stat = useMemo(() => {
    const ins = (moves ?? []).filter((m) => m.movement_type === "in");
    const totIn = ins.reduce((s, m) => s + (m.quantity || 0), 0);
    const totOut = (moves ?? []).filter((m) => m.movement_type === "out" || m.movement_type === "waste").reduce((s, m) => s + (m.quantity || 0), 0);
    const priced = ins.filter((m) => m.unit_cost != null && +m.unit_cost > 0);
    const costQty = priced.reduce((s, m) => s + (m.quantity || 0), 0);
    const avg = costQty > 0 ? priced.reduce((s, m) => s + (m.quantity || 0) * +(m.unit_cost ?? 0), 0) / costQty : 0;
    return { totIn, totOut, avg };
  }, [moves]);
  // §4 NARX TARIXI — narxi bor KIRIMlar, ESKIdan yangiga (movements -created_at bilan keladi → teskari)
  const priceHist = useMemo(() => (moves ?? [])
    .filter((m) => m.movement_type === "in" && m.unit_cost != null && +m.unit_cost > 0)
    .map((m) => ({ date: m.created_at, cost: Math.round(+(m.unit_cost ?? 0)) }))
    .reverse()
    .slice(-12), [moves]); // oxirgi 12 kirim — mini-ko'rinish uchun yetarli
  const priceMax = useMemo(() => priceHist.reduce((a, p) => Math.max(a, p.cost), 0), [priceHist]);
  return (
    <Modal onClose={onClose} width={520}>
      <ModalHeader icon={<Icon name="sklad" size={20} />} title={material.name_uz || material.name_ru} sub={`${TYPE_LABEL[normType(material.packaging_type)]}${material.size ? ` · ${material.size.toUpperCase()}` : ""} · ${configFor(material).label} · qoldiq ${quantityDual(material)}`} onClose={onClose} />

      {/* STAT STRIP — jami olingan · sarflangan · qoldiq · o'rtacha narx */}
      <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { k: "Jami olingan", v: `${stat.totIn} dona`, hue: "var(--text)" },
          { k: "Sarflangan", v: `${stat.totOut} dona`, hue: "var(--text)" },
          { k: "Qoldiq", v: quantityDual(material), hue: "var(--acc)" },
          { k: "O'rtacha narx", v: stat.avg > 0 ? `${fmt(stat.avg)}/dona` : "—", hue: "var(--text)" },
        ].map((c) => (
          <div key={c.k} className="rounded-[12px] border p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>{c.k}</div>
            <div className="mt-0.5 text-[14px] font-extrabold tabular-nums" style={{ color: c.hue }}>{c.v}</div>
          </div>
        ))}
      </div>

      <Section>Oxirgi postavshik</Section>
      {ld ? (
        <div className="rounded-[13px] border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <div className="text-[13px] font-bold">{ld.supplier ?? "postavshiksiz"}</div>
          <div className="mt-0.5 text-[12px]" style={{ color: "var(--muted)" }}>
            Material yuki {ld.number} · {fmtDate(ld.received_at)}{ld.quantity != null ? ` · ${ld.quantity} dona` : ""}{ld.unit_cost != null && +ld.unit_cost > 0 ? ` · ${fmt(ld.unit_cost)}/dona` : ""}
          </div>
        </div>
      ) : (
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>Hali kirim bo&apos;lmagan — postavshik ma&apos;lumoti yo&apos;q.</p>
      )}

      {/* §4 NARX TARIXI — dona tannarxi vaqt bo'yicha (postavshik bilan savdolashish uchun).
          FAQAT narxi bor kirimlar; eng eskisidan yangisiga. Bar balandligi eng qimmatiga nisbatan. */}
      {priceHist.length > 1 && (
        <>
          <Section>Narx tarixi (dona tannarxi)</Section>
          <div className="rounded-[13px] border p-3" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-end gap-1.5">
              {priceHist.map((p, i) => {
                // ⚠️ PIKSEL balandlik (foiz emas: flex-ustun ichida % ba'zan hal bo'lmaydi va chiziq ko'rinmay qoladi)
                const px = priceMax > 0 ? Math.max(Math.round((p.cost / priceMax) * 48), 4) : 4;
                const prev = i > 0 ? priceHist[i - 1].cost : null;
                const up = prev != null && p.cost > prev;
                const down = prev != null && p.cost < prev;
                const hue = up ? "var(--danger-ink)" : down ? "var(--success-ink, #3d8a5f)" : "var(--primary)";
                return (
                  <div key={i} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${fmtDate(p.date)} · ${fmt(p.cost)}/dona`}>
                    {/* yorliq: 1 250 → "1.25k" (hammasi "1k" bo'lib qolmasin) */}
                    <span className="text-[9.5px] font-bold tabular-nums" style={{ color: hue }}>{p.cost >= 1000 ? `${(p.cost / 1000).toFixed(p.cost % 1000 === 0 ? 0 : 2).replace(/0$/, "")}k` : p.cost}</span>
                    <div className="w-full rounded-t-[3px]" style={{ height: px, background: hue, opacity: 0.9 }} />
                  </div>
                );
              })}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px]" style={{ color: "var(--muted)" }}>
              <span>{fmtDate(priceHist[0].date)}</span>
              <span className="font-semibold" style={{ color: priceHist[priceHist.length - 1].cost > priceHist[0].cost ? "var(--danger-ink)" : "var(--success-ink, #3d8a5f)" }}>
                {priceHist[0].cost > 0 ? `${priceHist[priceHist.length - 1].cost > priceHist[0].cost ? "+" : ""}${Math.round(((priceHist[priceHist.length - 1].cost - priceHist[0].cost) / priceHist[0].cost) * 100)}%` : ""}
              </span>
              <span>{fmtDate(priceHist[priceHist.length - 1].date)}</span>
            </div>
          </div>
        </>
      )}

      <Section>Kirim tarixi</Section>
      {moves === null ? <p className="text-[13px]" style={{ color: "var(--muted)" }}>Yuklanmoqda…</p> : moves.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>Harakatlar hali yo&apos;q.</p>
      ) : (
        <div className="flex flex-col">
          {moves.map((mv) => {
            const isIn = mv.movement_type === "in";
            return (
              <div key={mv.id} className="flex flex-wrap items-center justify-between gap-2 border-t py-2.5 first:border-t-0" style={{ borderColor: "var(--line2)" }}>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold">{isIn ? "KIRIM" : "CHIQIM"} · {mv.quantity} dona{mv.reason ? <span className="font-normal" style={{ color: "var(--text-2)" }}> — {mv.reason}</span> : null}</div>
                  <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>{fmtTime(mv.created_at)}</div>
                </div>
                <div className="text-right text-[12px]">
                  {/* ⚠️ ESKI yozuvlarda delivery/unit_cost null — bo'sh joy yoki "null" ko'rsatmaymiz */}
                  {mv.unit_cost != null && +mv.unit_cost > 0 && <span className="font-semibold tabular-nums" style={{ color: "var(--text-2)" }}>{fmt(mv.unit_cost)}/dona</span>}
                  {mv.delivery != null && <span className="ml-2 rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>yuk #{mv.delivery}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

/** Material harakatlari jurnali — Sklad sahifasining «Jurnal» bo'limida ko'rsatiladi. */
export function MaterialMovesJournal() {
  const router = useRouter();
  const [moves, setMoves] = useState<MaterialMovement[]>([]);
  const load = useCallback(() => {
    api.materialMovements({ ordering: "-created_at" }).then(setMoves).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load); // jimgina davriy yangilash — real vaqt hissi

  return (
    <section className="glass mt-5 !rounded-[20px] p-5">
      <div className="mb-1.5 flex items-center justify-between">
        <h2 className="text-base font-bold">Material harakatlari</h2>
        <span className="text-xs" style={{ color: "var(--mut)" }}>so&apos;nggi kirim-chiqimlar</span>
      </div>
      {moves.map((mv, i) => {
        const isIn = mv.movement_type === "in";
        const md = mv.packaging_detail ?? mv.material_detail;
        const leadId = movementLeadId(mv);
        const who = mv.performed_by_detail
          ? [mv.performed_by_detail.first_name, mv.performed_by_detail.last_name].filter(Boolean).join(" ") || mv.performed_by_detail.username
          : "Tizim";
        return (
          <div
            key={mv.id}
            onClick={leadId ? () => router.push(`/buyurtmalar?order=${leadId}`) : undefined}
            role={leadId ? "link" : undefined}
            tabIndex={leadId ? 0 : undefined}
            onKeyDown={leadId ? (e) => e.key === "Enter" && router.push(`/buyurtmalar?order=${leadId}`) : undefined}
            title={leadId ? `Buyurtma #${leadId} kartasini ochish` : undefined}
            className={`row-lux flex items-center gap-3.5 border-t py-3 ${leadId ? "cursor-pointer" : ""}`}
            style={{ borderColor: "var(--line2)", animationDelay: `${Math.min(i * 40, 480)}ms` }}
          >
            <div className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full ${isIn ? "bg-mint text-mintink" : "bg-peach text-peachink"}`}>
              {isIn ? <ArrowDown size={16} strokeWidth={2} /> : <ArrowUp size={16} strokeWidth={2} />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-semibold">
                {md?.name_uz || md?.name_ru || `Material #${mv.packaging ?? "—"}`} — {mv.quantity} dona
                {mv.reason ? ` · ${mv.reason}` : ""}
              </div>
              <div className="mt-0.5 truncate text-xs" style={{ color: "var(--mut)" }}>{who} · {fmtTime(mv.created_at)}</div>
            </div>
            {leadId != null && (
              <span className="shrink-0 whitespace-nowrap text-[11.5px] font-bold" style={{ color: "var(--primary)" }}>Buyurtma #{leadId} ↗</span>
            )}
            <span className={`min-w-[52px] rounded-full border px-2.5 py-0.5 text-center text-[11px] font-bold ${isIn ? "bg-mint text-mintink" : "bg-peach text-peachink"}`} style={{ borderColor: "var(--line2)" }}>
              {isIn ? "KIRIM" : "CHIQIM"}
            </span>
          </div>
        );
      })}
      {moves.length === 0 && <EmptyState title="Harakatlar hali yo'q" sub="Kirim yoki chiqim kiritilganda shu yerda ko'rinadi." />}
    </section>
  );
}

/** Bitta material kartasi — qoldiq, narx, oxirgi postavshik, chiqim. Karta bosilsa batafsil. */
function MaterialCard({ m, control, onEdit, onMove, onDetail }: { m: Packaging; control: boolean; onEdit: () => void; onMove: () => void; onDetail: () => void }) {
  const low = m.quantity > 0 && m.quantity <= 10;
  const ld = m.last_delivery;
  return (
    <article className="glass card-hover relative flex cursor-pointer flex-col gap-2 !rounded-[18px] p-4" role="button" tabIndex={0} onClick={onDetail} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onDetail(); } }} title="Batafsil va tarix">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold" title={m.name_uz || m.name_ru}>{m.name_uz || m.name_ru}</div>
          <div className="flex flex-wrap items-center gap-1 text-xs" style={{ color: "var(--mut)" }}>
            <span>{TYPE_LABEL[normType(m.packaging_type)]}{m.size ? ` · ${m.size.toUpperCase()}` : ""}</span>
            {/* O'LCHOV BIRLIGI chipi — pochka materiallari darrov ajralib tursin */}
            <span className="rounded-full px-1.5 py-px text-[10px] font-bold" style={configFor(m).unit === "bunch"
              ? { background: "color-mix(in srgb, var(--acc) 15%, transparent)", color: "var(--acc)" }
              : { background: "var(--hover)", color: "var(--text-2)" }}>{configFor(m).label}</span>
            {m.basket_material && <span className="rounded-full px-1.5 py-px text-[10px] font-bold" style={{ background: "var(--hover)", color: "var(--text-2)" }}>{BASKET_MATERIAL_LABEL[m.basket_material as BasketMaterial] ?? m.basket_material}</span>}
          </div>
        </div>
        {control && (
          <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="icon-btn shrink-0" title="Tahrirlash" aria-label="Tahrirlash">
            <Pencil size={15} strokeWidth={1.75} />
          </button>
        )}
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-[12px]" style={{ color: "var(--mut)" }}>Qoldiq</div>
          {/* IKKI BIRLIKDA — pochka materialida "100 dona · 5 pochka" */}
          <div className="text-sm font-bold">
            {quantityDual(m)}
            {m.quantity === 0 && <span className="ml-1.5 rounded-full bg-rose px-2 py-0.5 text-[10.5px] font-bold text-roseink">TUGADI</span>}
            {low && <span className="ml-1.5 rounded-full bg-peach px-2 py-0.5 text-[10.5px] font-bold text-peachink">KAM</span>}
          </div>
        </div>
        <div className="text-right">
          {/* ⚠️ TANNARX (oxirgi kirimdan) — materiallarda sotuv narxi 0, tannarx esa ma'noli */}
          <div className="text-[12px]" style={{ color: "var(--mut)" }}>Tannarx / dona</div>
          <div className="text-sm font-bold" style={{ color: "var(--acc)" }}>{+(m.cost_price ?? 0) > 0 ? fmt(m.cost_price) : "—"}</div>
        </div>
      </div>
      {/* ⚠️ OXIRGI POSTAVSHIK — last_delivery.supplier; null bo'lsa TOZA tire (bo'sh/crash emas) */}
      <div className="truncate text-[11.5px]" style={{ color: "var(--mut)" }} title={ld ? `${MATERIAL_DELIVERY.lastSupplier}: ${ld.supplier ?? "—"} · ${ld.number} · ${fmtDate(ld.received_at)}` : undefined}>
        {MATERIAL_DELIVERY.lastSupplier}: {ld ? (
          <><b style={{ color: "var(--text-2)" }}>{ld.supplier ?? "—"}</b> <span style={{ color: "var(--mut)" }}>· {ld.number} · {fmtDate(ld.received_at)}</span></>
        ) : "—"}
      </div>
      {control && (
        <div className="flex gap-2"><button onClick={(e) => { e.stopPropagation(); onMove(); }} className="flex-1 rounded-xl border-[1.5px] py-2 text-[13px] font-bold hover:bg-tint" style={{ borderColor: "var(--line)" }}>Chiqim</button>{normType(m.packaging_type) === "other" && <button onClick={(e) => { e.stopPropagation(); (m as Packaging & { __sell?: () => void }).__sell?.(); }} className="flex-1 rounded-xl border-[1.5px] py-2 text-[13px] font-bold hover:bg-mint" style={{ borderColor: "var(--primary)", color: "var(--primary)" }}><ShoppingCart size={14} className="mr-1 inline" /> Sotish</button>}</div>
      )}
    </article>
  );
}

function AccessorySellModal({ material, onClose, onDone }: { material: Packaging; onClose: () => void; onDone: () => void }) {
  const showToast = useStore((s) => s.showToast); const [quantity, setQuantity] = useState("1"); const [price, setPrice] = useState(String(material.sale_price ?? "")); const [reason, setReason] = useState(""); const [payment, setPayment] = useState("cash"); const [busy, setBusy] = useState(false);
  const save = async () => { const q = Math.floor(+quantity || 0); if (q < 1 || q > material.quantity) return showToast(`Qoldiq ${material.quantity} dona`); setBusy(true); try { await api.sellPackaging(material.id, { quantity: q, sale_price: price || undefined, payment_type: payment, reason: reason.trim() || undefined, sold_at: new Date().toISOString() }); showToast("✓ Accessory sotildi"); onDone(); } catch (e) { showToast(e instanceof ApiError ? e.message : "Sotib bo'lmadi"); } finally { setBusy(false); } };
  return <Modal onClose={onClose} width={440}><ModalHeader icon={<ShoppingCart size={20} />} title="Accessory sotish" sub={`${material.name_uz || material.name_ru} · qoldiq ${material.quantity} dona`} onClose={onClose} /><div className="grid gap-3"><Field label="Soni"><input className="inp" type="number" min="1" max={material.quantity} value={quantity} onChange={(e) => setQuantity(e.target.value)} /></Field><Field label="Sotuv narxi"><input className="inp" type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} /></Field><Field label="To'lov turi"><select className="inp" value={payment} onChange={(e) => setPayment(e.target.value)}><option value="cash">Naqd</option><option value="card">Karta</option><option value="debt">Qarz</option><option value="mixed">Aralash</option></select></Field><Field label="Sabab"><input className="inp" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ixtiyoriy" /></Field></div><ModalFooter><button onClick={onClose} className="btn-ghost">Bekor</button><button onClick={save} disabled={busy} className="btn-primary">{busy ? "Saqlanmoqda…" : "Sotish"}</button></ModalFooter></Modal>;
}

export default function MaterialSklad() {
  const showToast = useStore((s) => s.showToast);
  const { canControl } = usePerm();
  const control = canControl("inventory");
  const [materials, setMaterials] = useState<Packaging[] | null>(null);
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<"" | PackagingType>("");
  // ⚠️ POSTAVSHIK filtri — material yetkazib beruvchisi oxirgi kirimdan (last_delivery.supplier) olinadi.
  const [supplierF, setSupplierF] = useState("");
  // §4 YANGI filtrlar (spec: unit / basket_material / size) — klientda (ro'yxat to'liq keladi)
  const [unitF, setUnitF] = useState("");
  const [basketF, setBasketF] = useState("");
  const [sizeF, setSizeF] = useState("");
  const [formM, setFormM] = useState<{ open: boolean; edit: Packaging | null }>({ open: false, edit: null });
  const [moveM, setMoveM] = useState<Packaging | null>(null);
  const [detailM, setDetailM] = useState<Packaging | null>(null); // batafsil + kirim tarixi
  const [sellM, setSellM] = useState<Packaging | null>(null);

  const load = useCallback(async () => {
    try {
      // barchasini olamiz — guruhlash va sanoqlar klient tomonda (chip filtri bilan)
      setMaterials(await api.materials({ is_active: true, page_size: "all" }));
    } catch (e) {
      setMaterials([]);
      showToast(e instanceof Error ? e.message : "Materiallarni yuklashda xatolik");
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load); // jimgina davriy yangilash — real vaqt hissi

  const patch = (upd: Packaging) => setMaterials((ms) => (ms ?? []).map((x) => (x.id === upd.id ? { ...x, ...upd } : x)));

  // qidiruv + guruhlash (chip filtri saqlangan holda sanoqlar to'liq bo'lishi uchun avval qidiruv)
  const q = search.trim().toLowerCase();
  // postavshik ro'yxati — materiallarning oxirgi kirimidagi noyob nomlar
  const supplierOpts = useMemo(() => {
    const names = Array.from(new Set((materials ?? []).map((m) => m.last_delivery?.supplier).filter((x): x is string => !!x))).sort();
    return [{ value: "", label: "Barcha postavshiklar" }, ...names.map((n) => ({ value: n, label: n }))];
  }, [materials]);
  // o'lchamlar ro'yxati — mavjud qiymatlardan (seed: xs/s/m/l/xl, lekin erkin matn ham bo'lishi mumkin)
  const sizeOpts = useMemo(() => {
    const xs = Array.from(new Set((materials ?? []).map((m) => (m.size ?? "").trim()).filter(Boolean))).sort();
    return [{ value: "", label: "Barcha o'lchamlar" }, ...xs.map((s) => ({ value: s, label: s.toUpperCase() }))];
  }, [materials]);
  const searched = useMemo(
    () => (materials ?? []).filter((m) =>
      (!q || [m.name_uz, m.name_ru, m.size].some((x) => (x ?? "").toLowerCase().includes(q)))
      && (!supplierF || m.last_delivery?.supplier === supplierF)
      && (!unitF || configFor(m).unit === unitF)
      && (!basketF || m.basket_material === basketF)
      && (!sizeF || (m.size ?? "").trim() === sizeF)),
    [materials, q, supplierF, unitF, basketF, sizeF]
  );
  const byGroup = useMemo(() => {
    const g = new Map<PackagingType, Packaging[]>();
    GROUP_ORDER.forEach((k) => g.set(k, []));
    searched.forEach((m) => g.get(normType(m.packaging_type))!.push(m));
    return g;
  }, [searched]);

  if (materials == null) return <FlowerLoader />;

  const totalQty = materials.reduce((a, m) => a + m.quantity, 0);
  const visibleGroups = GROUP_ORDER.filter((k) => (group ? k === group : (byGroup.get(k)!.length > 0)));
  const nothing = searched.length === 0;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="note-chip text-[14px]" style={{ color: "var(--mut)" }}>
          Material sklad: <b>{materials.length}</b> pozitsiya · jami {totalQty.toLocaleString("ru")} dona
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} ariaLabel="Material qidirish" />
          {supplierOpts.length > 1 && <FilterSelect value={supplierF} onChange={setSupplierF} label="Postavshik" options={supplierOpts} />}
          {/* §4 spec filtrlari: unit / basket_material / size */}
          <FilterSelect value={unitF} onChange={setUnitF} label="Birlik" options={[{ value: "", label: "Barcha birliklar" }, ...(["piece", "bunch"] as const).map((u) => ({ value: u, label: MATERIAL_UNIT_LABEL[u] }))]} />
          <FilterSelect value={basketF} onChange={setBasketF} label="Savat materiali" options={[{ value: "", label: "Barcha savatlar" }, ...(["wooden", "plastic_handle", "woven"] as const).map((b) => ({ value: b, label: BASKET_MATERIAL_LABEL[b] }))]} />
          {sizeOpts.length > 1 && <FilterSelect value={sizeF} onChange={setSizeF} label="O'lcham" options={sizeOpts} />}
          <ClearFilters show={!!(search || group || supplierF || unitF || basketF || sizeF)} onClear={() => { setSearch(""); setGroup(""); setSupplierF(""); setUnitF(""); setBasketF(""); setSizeF(""); }} />
          {control && (
            <button onClick={() => setFormM({ open: true, edit: null })} className="btn-primary !flex-none px-4 py-2.5 text-[14px]">
              <Plus size={18} strokeWidth={1.75} /> Material qo&apos;shish
            </button>
          )}
        </div>
      </div>

      {/* guruh chip qatori — har birida sanoq */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        <button
          onClick={() => setGroup("")}
          aria-pressed={group === ""}
          className={clsx("rounded-full border-[1.5px] px-4 py-1.5 text-[12.5px] font-bold transition-colors", group === "" ? "text-white" : "bg-sfc")}
          style={group === "" ? { background: "var(--acc)", borderColor: "var(--acc)" } : { borderColor: "var(--line)", color: "var(--mut)" }}
        >
          Barchasi <span className="opacity-70">{searched.length}</span>
        </button>
        {GROUP_ORDER.map((k) => {
          const GIcon = GROUP_ICON[k];
          const n = byGroup.get(k)!.length;
          const on = group === k;
          return (
            <button
              key={k}
              onClick={() => setGroup(on ? "" : k)}
              aria-pressed={on}
              className={clsx("flex items-center gap-1.5 rounded-full border-[1.5px] px-4 py-1.5 text-[12.5px] font-bold transition-colors", on ? "text-white" : "bg-sfc")}
              style={on ? { background: "var(--acc)", borderColor: "var(--acc)" } : { borderColor: "var(--line)", color: "var(--mut)" }}
            >
              <GIcon size={14} strokeWidth={2} /> {TYPE_LABEL[k]} <span className="opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      {nothing ? (
        <EmptyState
          title={search ? "Qidiruvga mos material topilmadi" : "Material sklad bo'sh"}
          sub={search ? "Boshqa so'z bilan urinib ko'ring." : "«Material qo'shish» orqali birinchi pozitsiyani kiriting."}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {visibleGroups.map((k) => {
            const items = byGroup.get(k)!;
            if (!items.length) return null;
            const GIcon = GROUP_ICON[k];
            const groupQty = items.reduce((a, m) => a + m.quantity, 0);
            return (
              <section key={k}>
                {/* sarlavha note-chip yuzasida — Rasm/Video fonida ham o'qiladi (kontrast kafolati) */}
                <div className="note-chip !mb-2.5 inline-flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-[8px]" style={{ background: "var(--primary-soft, var(--hover))", color: "var(--primary)" }}>
                    <GIcon size={15} strokeWidth={2} />
                  </span>
                  <h3 className="text-[14px] font-bold">{TYPE_LABEL[k]}</h3>
                  <span className="text-[12px]" style={{ color: "var(--mut)" }}>{items.length} pozitsiya · {groupQty.toLocaleString("ru")} dona</span>
                </div>
                <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(235px,1fr))" }}>
                  {items.map((m) => (
                    <MaterialCard key={m.id} m={{ ...m, __sell: () => setSellM(m) } as Packaging & { __sell: () => void }} control={control} onEdit={() => setFormM({ open: true, edit: m })} onMove={() => setMoveM(m)} onDetail={() => setDetailM(m)} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {formM.open && (
        <MaterialModal
          material={formM.edit}
          onClose={() => setFormM({ open: false, edit: null })}
          onSaved={(m) => {
            setFormM({ open: false, edit: null });
            if (formM.edit) patch(m);
            else load();
            notifyReportDataChanged(); // material tannarxi/qoldig'i → hisobot
          }}
        />
      )}
      {moveM && (
        <MoveModal
          material={moveM}
          onClose={() => setMoveM(null)}
          onDone={() => { setMoveM(null); notifyReportDataChanged(); load(); }}
        />
      )}
      {detailM && <MaterialDetailModal material={detailM} onClose={() => setDetailM(null)} />}
      {sellM && <AccessorySellModal material={sellM} onClose={() => setSellM(null)} onDone={() => { setSellM(null); notifyReportDataChanged(); load(); }} />}
    </>
  );
}
