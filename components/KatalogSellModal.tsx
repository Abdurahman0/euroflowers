"use client";
import { useEffect, useMemo, useState } from "react";
import { Banknote, CalendarClock, Check, ChevronDown, CreditCard, HandCoins, Image as ImageIcon, Info, Minus, Package, Plus, Sparkles, Split, Tag, X } from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalFooter, ModalHeader, Field } from "./Modal";
import Select from "./Select";
import DatePicker from "./DatePicker";
import CustomerPicker, { customerPayload, type CustomerPick } from "./CustomerPicker";
import ImageInput from "./ImageInput";
import { debtSellPayload, debtCustomerReady, DEBT_CUSTOMER_REQUIRED, DEBT_NONE_DISABLED_REASON } from "@/lib/debt";
import { applyMixedEdit, focusMixedField, blurMixedField, recalcOnTotalChange, validateMixed, mixedSellPayload, formatMoneyInput, deliveryPayload, deliveryGoods, deliveryTooLarge, deliveryTooLargeMessage, parseMoney, emptyMixed, type MixedState } from "@/lib/mixedPayment";
import { fmt } from "@/lib/format";
import { PACKAGING_LABEL } from "@/lib/inventory";
import { usableInCatalog } from "@/lib/materialUnit";
import { paymentProgress } from "@/lib/reservation";
import { catalogRemaining } from "@/lib/rework";
import { withTashkentOffset, todayTashkent } from "@/lib/backdate";
import type { CatalogItem, FloristProfile, Packaging, PaymentType, Reservation } from "@/lib/types";

type SaleMat = { packaging: number; qty: string };
const floristName = (fp: FloristProfile) => { const u = fp.user_detail; return [u?.first_name, u?.last_name].filter(Boolean).join(" ") || u?.username || `#${fp.id}`; };

const custLabel = (r: Reservation) => r.customer_detail?.name || r.customer_name || `Bron #${r.id}`;

const PAYMENTS: { value: PaymentType; label: string; icon: typeof Banknote }[] = [
  { value: "cash", label: "Naqd", icon: Banknote },
  { value: "card", label: "Karta", icon: CreditCard },
  // ⚠️ QARZ — to'lov turi emas, to'lovning KEYINGA SURILISHI: bugungi savdo o'zgarmaydi.
  { value: "debt", label: "Qarz", icon: HandCoins },
  // ⚠️ ARALASH — pul HAQIQATDA qayerga tushgan bo'lsa o'sha ustunga yoziladi
  { value: "mixed", label: "Aralash", icon: Split },
];

/**
 * KATALOGDAN SOTISH — soni, ixtiyoriy chegirma narxi va sabab.
 * Kontrakt (POST /api/catalog/{id}/sell/):
 *   {quantity}                                   — oddiy sotuv
 *   {quantity, sale_price, discount_reason}      — arzonroq sotuv
 * `sale_price` DONA narxi. U katalog narxidan PAST bo'lsa `discount_reason`
 * MAJBURIY — backend chegirmani hisoblab sotuv tarixiga yozadi.
 *
 * MIJOZ: sell endpoint mijoz maydonlarini QABUL QILMAYDI (CatalogSellRequest'da yo'q),
 * shuning uchun mijoz o'zgargan bo'lsa avval PATCH /api/catalog/{id}/ (customer /
 * customer_name+customer_phone / null), so'ng sell. PATCH muvaffaqiyatsiz bo'lsa —
 * sotuv umuman yuborilmaydi (yarim holat yo'q).
 */
export default function KatalogSellModal({
  item,
  onClose,
  onSold,
  presetReservation = null,
}: {
  item: CatalogItem;
  onClose: () => void;
  onSold: (updated: CatalogItem) => void;
  /** §2: bronni ulash — detail drawer «Katalogdan sotish»dan yoki ?reservation= orqali oldindan tanlanadi */
  presetReservation?: Reservation | null;
}) {
  const showToast = useStore((s) => s.showToast);
  const total = item.quantity_total ?? 1;
  // ⚠️ QOLDIQ — YAGONA manba (sotilgan + chiqit + RESTAVRATSIYA ayriladi).
  // Ilgari faqat total − sold edi: buzilgan buketni sotishga urinish mumkin edi.
  const left = Math.max(catalogRemaining(item), 0) || 1;
  const listPrice = Math.round(+item.price || 0);

  const [qty, setQty] = useState(1);
  const [payment, setPayment] = useState<PaymentType>("cash");
  const [discountOn, setDiscountOn] = useState(false);
  const [price, setPrice] = useState(String(listPrice));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});

  // MIJOZ — item'da biriktirilgan bo'lsa oldindan tanlanadi
  const hadCustomer = !!(item.customer_detail || item.customer);
  const [cust, setCust] = useState<CustomerPick>(
    item.customer_detail
      ? { mode: "existing", id: item.customer_detail.id, detail: item.customer_detail }
      : { mode: "none" }
  );
  // SOTUV SANASI — ixtiyoriy; yoqilib o'zgartirilsagina yuboriladi (aks holda backend: hozir)
  const [dateOn, setDateOn] = useState(false);
  const [soldAt, setSoldAt] = useState("");

  // ===== QARZGA SOTISH =====
  const isDebt = payment === "debt";
  const [debtNote, setDebtNote] = useState("");
  // Qarzda mijoz MAJBURIY: «Biriktirmayman»dan avtomatik chiqamiz (rejim o'chirilgan bo'ladi).
  useEffect(() => {
    if (isDebt && cust.mode === "none") setCust({ mode: "existing", id: 0, detail: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDebt]);
  // ⚠️ Qarzda SOTUV SANASI ma'nosini yo'qotadi — `sold_at` ni backend TO'LOV kuniga
  // qo'yadi, shuning uchun bu yerda sana tanlash chalg'ituvchi bo'lardi.
  useEffect(() => {
    if (isDebt && dateOn) { setDateOn(false); setSoldAt(""); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDebt]);
  const debtBlocked = isDebt && !debtCustomerReady(cust);

  // ===== DASTAFKA — ixtiyoriy; TOVAR SAVDOSIGA KIRMAYDI, foydaga ta'sir qilmaydi =====
  const [delivery, setDelivery] = useState("");
  const deliveryNum = parseMoney(delivery);

  // ===== ARALASH TO'LOV (naqd + karta) =====
  // ⚠️ `mixed` va `debt` BIRGA BO'LMAYDI — payment_type bitta enum qiymat.
  const isMixed = payment === "mixed";
  const [mixed, setMixed] = useState<MixedState>(emptyMixed);
  // rejimdan chiqilsa eski ajratma qolib ketmasin
  useEffect(() => { if (!isMixed) setMixed(emptyMixed); }, [isMixed]);

  // §4 SOTUVDA QO'SHILGAN — ixtiyoriy qo'shimcha material + oformleniya (yig'ilmagan holda tez sotuv uchun).
  const [extraOpen, setExtraOpen] = useState(false);
  const [materials, setMaterials] = useState<Packaging[]>([]);
  const [florists, setFlorists] = useState<FloristProfile[]>([]);
  const [saleMats, setSaleMats] = useState<SaleMat[]>([]);
  const [saleDeco, setSaleDeco] = useState<number>(0);
  // ⚠️ SOTUV RASMI — katalogning O'Z rasmidan ALOHIDA. Spec: Telegram guruhiga ketadi
  // (`sale_image_url`). Ilgari biz uni sotuvlar ro'yxatida KO'RSATARDIK, lekin
  // yubormasdik — ya'ni u hech qachon to'lmasdi.
  const [saleImage, setSaleImage] = useState("");
  useEffect(() => {
    // ⚠️ §5: SARFLANADIGANLAR (Gupka/Lenta/Lak) sotuvda qo'shilmaydi — tanlagichdan chiqarib tashlanadi.
    api.materials({ is_active: true }).then((ms) => setMaterials(usableInCatalog(ms))).catch(() => {});
    api.florists({ is_active: true, ordering: "user" }).then(setFlorists).catch(() => {});
  }, []);
  const matOf = (id: number) => materials.find((m) => m.id === id);
  const matGroups = useMemo(() => {
    const g = new Map<string, Packaging[]>();
    materials.forEach((m) => { (g.get(m.packaging_type) ?? g.set(m.packaging_type, []).get(m.packaging_type)!).push(m); });
    return g;
  }, [materials]);
  const addSaleMat = () => { const used = new Set(saleMats.map((m) => m.packaging)); const next = materials.find((p) => !used.has(p.id)); setSaleMats([...saleMats, { packaging: next?.id ?? 0, qty: "1" }]); };
  const decoObj = florists.find((fp) => fp.id === saleDeco);
  const decoFee = Math.round(+(decoObj?.decoration_fee ?? 0) || 0);
  const decoFeeMissing = saleDeco > 0 && decoFee <= 0;

  // §2 BRON — ulanган bo'lsa: to'liq sotuv narxi daromad, oldingi zaklad esa ALLAQACHON cashflow (ikki marta sanamang).
  const [resv, setResv] = useState<Reservation | null>(presetReservation);
  const [pickerOn, setPickerOn] = useState(false);
  const [resvList, setResvList] = useState<Reservation[] | null>(null);
  const [resvQ, setResvQ] = useState("");

  // Bron tanlanganda: mijozni va (chegirma yoqilmagan bo'lsa) narxni oldindan to'ldiramiz
  useEffect(() => {
    if (!resv) return;
    if (resv.customer_detail && !hadCustomer) setCust({ mode: "existing", id: resv.customer_detail.id, detail: resv.customer_detail });
    const est = Math.round(+(resv.estimated_price ?? 0) || 0);
    if (est > 0 && est !== listPrice && !discountOn) { setDiscountOn(true); setPrice(String(est)); }
    setQty(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resv?.id]);

  const openPicker = async () => {
    setPickerOn(true);
    if (resvList) return;
    try { const d = await api.reservations({ status: "active", ordering: "desired_date", page_size: 100 }); setResvList(d); }
    catch { setResvList([]); }
  };
  const pickable = useMemo(() => {
    const xs = resvList ?? [];
    const q = resvQ.trim().toLowerCase();
    return q ? xs.filter((r) => custLabel(r).toLowerCase().includes(q) || (r.request_uz || "").toLowerCase().includes(q)) : xs;
  }, [resvList, resvQ]);

  const salePrice = discountOn ? Math.round(+price || 0) : listPrice;
  const calc = useMemo(() => {
    const unitDiscount = Math.max(listPrice - salePrice, 0);
    return {
      unitDiscount,
      percent: listPrice > 0 ? Math.round((unitDiscount / listPrice) * 1000) / 10 : 0,
      totalSum: salePrice * qty,
      totalDiscount: unitDiscount * qty,
    };
  }, [listPrice, salePrice, qty]);

  const needsReason = discountOn && calc.unitDiscount > 0;

  // ⚠️ JAMI o'zgardi (dona / chegirma) → FAQAT tegilmagan maydon qayta hisoblanadi.
  // ⚠️ 2026-08-04 QOIDA O'ZGARDI: `sale_price` MIJOZDAN OLINADIGAN TO'LIQ pul bo'lib,
  // dastafka uning ICHIDA. Shuning uchun taqqoslash summasi — sotuv summasining O'ZI;
  // dastafkani qo'shish IKKI MARTA hisoblash bo'lardi.
  const payTarget = calc.totalSum;
  // TOVAR SAVDOSI — hosila (ko'rsatiladi, kiritilmaydi)
  const goodsTotal = deliveryGoods(calc.totalSum, delivery);
  const deliveryBad = deliveryTooLarge(calc.totalSum, delivery);
  useEffect(() => {
    if (!isMixed) return;
    setMixed((p) => recalcOnTotalChange(p, payTarget));
  }, [isMixed, payTarget]);
  const mixedV = validateMixed(mixed, payTarget);
  const mixedBlocked = isMixed && !mixedV.ok;

  /**
   * ⚠️ SAQLANGAN XATOLARNI TOZALASH — YAGONA joy.
   *
   * `errs` ichida SERVER 400 maydonlari ham bo'ladi (masalan backend'ning
   * «Aralash to'lovda naqd va karta summasini kiriting» xabari). Ilgari ular faqat
   * ikkita pul maydonining `onChange` ida tozalanardi — dona, chegirma, to'lov turi
   * yoki dastafka o'zgarganda esa QOLIB KETARDI va yaroqli holat ustida turardi.
   * Endi tegishli kiritmalardan BIRORTASI o'zgarsa — hammasi tozalanadi.
   */
  useEffect(() => {
    setErrs((x) => (Object.keys(x).length ? {} : x));
  }, [payment, mixed.cash, mixed.card, qty, discountOn, price, delivery, cust.mode]);

  // §4 SOTUVDA QO'SHILGAN iqtisodi: material qoldiqni × qty (server ko'paytiradi), tannarx va oformleniya haqi.
  const validSaleMats = saleMats.filter((m) => m.packaging > 0 && +m.qty > 0);
  const extraMatCost = validSaleMats.reduce((s, m) => { const p = matOf(m.packaging); return s + (p ? Math.round(+(p.cost_price ?? 0)) * (+m.qty || 0) * qty : 0); }, 0);
  const decoPay = decoFee * qty;
  const extraTotal = extraMatCost + decoPay;

  const submit = async () => {
    const next: Record<string, string> = {};
    if (discountOn && (!price || salePrice <= 0)) next.sale_price = "Narxni kiriting";
    if (needsReason && !reason.trim()) next.discount_reason = "Chegirma sababini yozing";
    // ⚠️ QARZ: mijoz majburiy — serverning 400'ini kutmasdan shu yerda to'xtatamiz
    // (matn AYNAN serverникi, ikki xil ibora bo'lmasin).
    const debtBody = debtSellPayload(isDebt, cust, debtNote);
    if (debtBody === null) next.customer = DEBT_CUSTOMER_REQUIRED;
    // ⚠️ DASTAFKA sotuv summasidan kichik bo'lishi SHART (server 400)
    if (deliveryBad) next.delivery_amount = deliveryTooLargeMessage(calc.totalSum, delivery);
    // ⚠️ ARALASH xatosi HOLATDA SAQLANMAYDI — u `mixedV` dan HOSILA bo'lib, forma
    // ostida doim ko'rinib turadi. Ilgari u `errs.cash_amount` ga yozilardi va
    // keyingi tahrirlar uni TOZALAMASDI: natijada yashil «Jami … ✓» bilan qizil
    // xato BIR VAQTDA turardi (mobil skrinshotda aynan shu). Ikki validator — ikki javob.
    const mixedBody = mixedSellPayload(isMixed, mixed, payTarget);
    if (mixedBody === null) return;   // tugma allaqachon o'chiq; sabab pastda ko'rinadi
    if (Object.keys(next).length) return setErrs(next);
    setBusy(true);
    setErrs({});
    // 1-QADAM: mijoz o'zgargan bo'lsa katalog itemni PATCH qilamiz.
    //          ⚠️ QARZDA bu qadam O'TKAZIB YUBORILADI — sell endpoint mijoz maydonlarini
    //          O'ZI qabul qiladi (CatalogSellRequest: customer / customer_name+customer_phone),
    //          ya'ni bitta yozuv yetarli va yarim holat (mijoz ulandi, sotuv yo'q) bo'lmaydi.
    const custBody = isDebt ? null : customerPayload(cust, hadCustomer);
    let patched: CatalogItem | null = null;
    if (custBody) {
      try {
        patched = await api.updateCatalogItem(item.id, custBody);
      } catch (e) {
        if (e instanceof ApiError && e.fieldErrors) setErrs(e.fieldErrors);
        showToast(e instanceof ApiError ? e.message : "Mijozni biriktirib bo'lmadi");
        setBusy(false);
        return;
      }
    }
    // 2-QADAM: sotuv
    try {
      const updated = await api.sellCatalogItem(item.id, {
        quantity: qty,
        payment_type: payment,
        ...(discountOn ? { sale_price: salePrice.toFixed(2), discount_reason: reason.trim() || undefined } : {}),
        // ⚠️ DatePicker offsetsiz "YYYY-MM-DDTHH:mm" beradi — server uni UTC deb o'qib
        // 23:30 ni ERTANGI kunga tashlab yuborishi mumkin. Offset ANIQ yoziladi.
        ...(dateOn && soldAt ? { sold_at: withTashkentOffset(soldAt) } : {}),
        ...(resv ? { reservation: resv.id } : {}),
        // §4: quantity PER 1 sotuv dona (backend × quantity qiladi — oldindan ko'paytirmang).
        ...(validSaleMats.length ? { materials: validSaleMats.map((m) => ({ packaging: m.packaging, quantity: +m.qty })) } : {}),
        ...(saleDeco ? { decoration_florist: saleDeco } : {}),
        // bo'sh bo'lsa kalit UMUMAN yuborilmaydi (bizdagi «nol — qiymat» qoidasi)
        ...(saleImage.trim() ? { sale_image_url: saleImage.trim() } : {}),
        // QARZ: customer | customer_name+customer_phone (+ debt_note). Qarz bo'lmasa — bo'sh.
        ...debtBody,
        // ARALASH: cash_amount + card_amount. Boshqa rejimda kalitlar UMUMAN yo'q.
        ...mixedBody,
        // DASTAFKA: bo'sh bo'lsa kalit UMUMAN yuborilmaydi ("0" ham emas).
        ...deliveryPayload(delivery),
      });
      // customer_detail — PATCH javobidan (backend mavjud mijozga ULAGAN bo'lsa ismi ko'rinsin)
      const linked = updated.customer_detail || patched?.customer_detail;
      const who = linked ? ` → ${linked.name}${linked.masked_phone ? ` (${linked.masked_phone})` : ""}` : "";
      // ⚠️ QARZDA operator «savdo tushmadi» deb o'ylamasligi kerak — toast buni AYTADI
      // va mijozni nomlaydi (kimdan undirish kerakligi darhol ko'rinsin).
      const debtWho = linked?.name || (cust.mode === "new" ? cust.name.trim() : "") || "mijoz";
      showToast(
        isDebt
          ? `✓ Qarzga berildi → ${debtWho} · ${fmt(calc.totalSum)}. Bu summa QARZ TO'LANGAN kuni savdoga qo'shiladi.`
          : calc.totalDiscount > 0
            ? `✓ ${qty} ta sotildi · chegirma ${fmt(calc.totalDiscount)}${who}`
            : `✓ «${item.name_uz || item.name_ru}»: ${qty} ta sotildi${who}`
      );
      onSold(updated);
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) setErrs(e.fieldErrors);
      showToast(e instanceof ApiError ? e.message : "Sotib bo'lmadi");
      setBusy(false);
    }
  };

  const step = (d: number) => setQty((n) => Math.min(Math.max(n + d, 1), left));

  return (
    <Modal onClose={onClose} width={460}>
      <ModalHeader
        icon={<Tag size={19} strokeWidth={1.8} />}
        title="Katalogdan sotish"
        sub={`${item.name_uz || item.name_ru} · ${fmt(listPrice)} / dona`}
        onClose={onClose}
      />

      {/* §2 BRON ULASH + HISOB-KITOB */}
      {!resv ? (
        <button type="button" onClick={openPicker} className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-md border-[1.5px] border-dashed py-2.5 text-[12.5px] font-bold transition-colors" style={{ borderColor: "var(--border)", color: "var(--primary)" }}>
          <Tag size={14} strokeWidth={1.9} /> Bronga bog&apos;lash (ixtiyoriy)
        </button>
      ) : (
        <div className="mt-1 rounded-[16px] border p-3.5" style={{ borderColor: "var(--primary)", background: "var(--primary-soft)" }}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: "var(--primary)" }}>Bronga bog&apos;landi</div>
              <div className="truncate text-[14px] font-bold">{custLabel(resv)}</div>
            </div>
            <button type="button" onClick={() => setResv(null)} className="icon-btn !h-7 !w-7 shrink-0" aria-label="Bronni uzish"><X size={14} /></button>
          </div>
          {(() => {
            const est = Math.round(+(resv.estimated_price ?? 0) || 0);
            const prog = paymentProgress(resv.paid_amount, resv.estimated_price);
            const diff = calc.totalSum - est;
            return (
              <>
                <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                  <SettleCell label="Bron summasi" value={fmt(est)} />
                  <SettleCell label="Oldindan to'langan" value={fmt(prog.paid)} hue="var(--acc)" />
                  <SettleCell label="Qolgan to'lov" value={fmt(prog.remaining)} hue={prog.remaining > 0 ? "var(--danger-ink)" : "var(--success-ink, #3d8a5f)"} />
                </div>
                {est > 0 && diff !== 0 && (
                  <p className="mt-2 text-[11.5px] font-semibold" style={{ color: "var(--text-2)" }}>
                    Sotuv narxi bron summasidan {diff > 0 ? "yuqori" : "past"}: <b style={{ color: diff > 0 ? "var(--success-ink, #3d8a5f)" : "var(--danger-ink)" }}>{diff > 0 ? "+" : "−"}{fmt(Math.abs(diff))}</b>
                  </p>
                )}
                <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-snug" style={{ color: "var(--muted)" }}>
                  <Info size={13} className="mt-px shrink-0" />
                  To&apos;liq sotuv narxi <b>daromad</b> sifatida yoziladi. Oldindan olingan zaklad ({fmt(prog.paid)}) esa allaqachon cashflow&apos;ga kirgan — hisob-kitobda uni ikki marta sanamang.
                </p>
              </>
            );
          })()}
        </div>
      )}

      {/* BRON TANLASH — ro'yxat (faol bronlar) */}
      {pickerOn && !resv && (
        <div className="mt-2 rounded-[14px] border" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 border-b px-2.5 py-2" style={{ borderColor: "var(--border)" }}>
            <input className="inp !h-9 flex-1" autoFocus value={resvQ} onChange={(e) => setResvQ(e.target.value)} placeholder="Bron qidirish (mijoz, so'rov)…" />
            <button type="button" onClick={() => setPickerOn(false)} className="icon-btn !h-8 !w-8 shrink-0" aria-label="Yopish"><X size={14} /></button>
          </div>
          <div className="max-h-56 overflow-y-auto p-1.5">
            {resvList === null ? <p className="px-2 py-3 text-[12.5px]" style={{ color: "var(--muted)" }}>Yuklanmoqda…</p>
              : pickable.length === 0 ? <p className="px-2 py-3 text-[12.5px]" style={{ color: "var(--muted)" }}>Faol bron topilmadi</p>
              : pickable.map((r) => (
                <button key={r.id} type="button" onClick={() => { setResv(r); setPickerOn(false); }} className="flex w-full items-center justify-between gap-2 rounded-[10px] px-2.5 py-2 text-left transition-colors hover:bg-[var(--hover)]">
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-bold">{custLabel(r)}</span>
                    <span className="block truncate text-[11px]" style={{ color: "var(--muted)" }}>{r.request_uz || "—"}</span>
                  </span>
                  <span className="shrink-0 text-[11.5px] font-semibold tabular-nums" style={{ color: "var(--acc)" }}>{fmt(r.estimated_price)}</span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* SONI — stepper */}
      <Field label="Nechta sotiladi" span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => step(-1)} disabled={qty <= 1} className="icon-btn !h-10 !w-10 shrink-0 disabled:opacity-40" aria-label="Kamaytirish">
            <Minus size={16} strokeWidth={2} />
          </button>
          <input
            className="inp !h-10 min-w-0 flex-1 text-center !text-[16px] font-bold"
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(Math.min(Math.max(+e.target.value.replace(/\D/g, "") || 1, 1), left))}
            aria-label="Soni"
          />
          <button type="button" onClick={() => step(1)} disabled={qty >= left} className="icon-btn !h-10 !w-10 shrink-0 disabled:opacity-40" aria-label="Ko'paytirish">
            <Plus size={16} strokeWidth={2} />
          </button>
        </div>
        <span className="mt-1 block text-[11.5px] font-semibold" style={{ color: "var(--muted)" }}>Sotuvda {left} ta bor</span>
      </Field>

      {/* TO'LOV TURI — naqd / karta */}
      <Field label="To'lov turi" span>
        <div className="grid grid-cols-4 gap-2">
          {PAYMENTS.map((p) => {
            const on = payment === p.value;
            const PIcon = p.icon;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => setPayment(p.value)}
                aria-pressed={on}
                className={clsx("flex items-center justify-center gap-1.5 rounded-md border-[1.5px] py-2.5 text-[13px] font-bold transition-colors duration-150", on ? "text-white" : "")}
                style={on ? { background: "var(--primary)", borderColor: "var(--primary)" } : { borderColor: "var(--border)", color: "var(--text-2)" }}
              >
                <PIcon size={16} strokeWidth={2} /> {p.label}
              </button>
            );
          })}
        </div>
        {/* ARALASH — ikkita summa; jami CHEGIRMADAN KEYINGI summaga teng bo'lishi shart */}
        {isMixed && (
          <div className="mt-2 rounded-md border p-3" style={{ borderColor: mixedV.ok ? "var(--acc)" : "var(--border)", background: "var(--surface-2)" }}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>Mijozdan olinadi</span>
              <span className="text-[14px] font-extrabold tabular-nums" style={{ color: "var(--acc)" }}>{fmt(payTarget)}</span>
            </div>
            {/* ⚠️ Dastafka summaning ICHIDA — naqd+karta baribir TO'LIQ summaga tenglashadi */}
            {deliveryNum > 0 && (
              <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                shundan {fmt(deliveryNum)} dastafka · tovar savdosi {fmt(goodsTotal)}
              </div>
            )}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <div className="mb-1 text-[11.5px] font-semibold" style={{ color: "var(--text-2)" }}>Naqd</div>
                {/* ⚠️ FOKUSDA TOZALANADI — avtomatik qoldiq ustiga yozilib ketmasin (lib izohiga qarang) */}
                <input className="inp" inputMode="numeric" value={mixed.cash} placeholder="0" aria-label="Naqd summasi"
                  onFocus={() => setMixed((p) => focusMixedField(p, "cash"))}
                  onBlur={() => setMixed((p) => blurMixedField(p, "cash", payTarget))}
                  onChange={(e) => { setMixed((p) => applyMixedEdit(p, "cash", e.target.value, payTarget)); setErrs((x) => { const n = { ...x }; delete n.cash_amount; delete n.card_amount; delete n.detail; return n; }); }} />
                {!mixed.cashTouched && mixed.cash !== "" && <div className="mt-0.5 text-[10.5px]" style={{ color: "var(--muted)" }}>avtomatik qoldiq</div>}
              </div>
              <div>
                <div className="mb-1 text-[11.5px] font-semibold" style={{ color: "var(--text-2)" }}>Karta</div>
                <input className="inp" inputMode="numeric" value={mixed.card} placeholder="0" aria-label="Karta summasi"
                  onFocus={() => setMixed((p) => focusMixedField(p, "card"))}
                  onBlur={() => setMixed((p) => blurMixedField(p, "card", payTarget))}
                  onChange={(e) => { setMixed((p) => applyMixedEdit(p, "card", e.target.value, payTarget)); setErrs((x) => { const n = { ...x }; delete n.cash_amount; delete n.card_amount; delete n.detail; return n; }); }} />
                {!mixed.cardTouched && mixed.card !== "" && <div className="mt-0.5 text-[10.5px]" style={{ color: "var(--muted)" }}>avtomatik qoldiq</div>}
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2" style={{ borderColor: "var(--line2, var(--border))" }}>
              <span className="text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>Jami</span>
              <span className="flex items-center gap-1.5 text-[13px] font-extrabold tabular-nums"
                style={{ color: mixedV.ok ? "var(--success-ink, #3d8a5f)" : "var(--danger-ink)" }}>
                {fmt(mixedV.sum)}
                {mixedV.ok ? <Check size={14} strokeWidth={2.6} /> : null}
              </span>
            </div>
            {/* YAGONA MANBA — yashil ✓ ham, qizil sabab ham AYNAN shu `mixedV` dan.
                Ular hech qachon bir-biriga zid bo'la olmaydi. */}
            {!mixedV.ok && mixedV.message && (
              <p id="mixed-reason" className="mt-1.5 text-[11.5px] font-bold" style={{ color: "var(--danger-ink)" }}>{mixedV.message}</p>
            )}
            {/* SERVER 400 maydonlari — faqat holat YAROQLI bo'lsa ko'rsatiladi
                (aks holda o'zimizning sabab bilan ikkilanib ketardi). */}
            {mixedV.ok && (errs.cash_amount || errs.card_amount) && (
              <p className="mt-1 text-[11.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>{errs.cash_amount || errs.card_amount}</p>
            )}
            <p className="mt-1.5 text-[11px]" style={{ color: "var(--muted)" }}>
              Pul haqiqatda qayerga tushgan bo&apos;lsa o&apos;sha ustunga yoziladi. Sotuv soni BIR MARTA sanaladi.
            </p>
          </div>
        )}

        {/* ⚠️ ENG MUHIM JUMLA: qarz «yo'qolgan sotuv» EMAS — pul keyinroq keladi. */}
        {isDebt && (
          <p className="mt-2 flex items-start gap-1.5 rounded-[12px] px-3 py-2 text-[11.5px] font-semibold leading-[1.45]"
            style={{ background: "var(--primary-soft)", color: "var(--text-2)" }}>
            <Info size={13} strokeWidth={2.2} className="mt-px shrink-0" style={{ color: "var(--primary)" }} />
            <span>Bugungi savdo o&apos;zgarmaydi. Bu summa <b>qarz to&apos;langan kuni</b>, to&apos;langan usul (naqd yoki karta) bilan savdoga qo&apos;shiladi. Gul esa <b>hozir</b> skladdan yechiladi.</span>
          </p>
        )}
      </Field>

      {/* CHEGIRMA — ixtiyoriy */}
      <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-[14px] border px-3.5 py-3" style={{ borderColor: discountOn ? "var(--primary)" : "var(--border)", background: discountOn ? "var(--primary-soft)" : undefined }}>
        <span className="min-w-0">
          <span className="block text-[13px] font-bold">Arzonroq sotish</span>
          <span className="block text-[11.5px]" style={{ color: "var(--muted)" }}>Chegirma sotuv tarixiga yoziladi</span>
        </span>
        <input
          type="checkbox"
          checked={discountOn}
          onChange={(e) => { setDiscountOn(e.target.checked); if (!e.target.checked) { setPrice(String(listPrice)); setReason(""); setErrs({}); } }}
          className="h-4 w-4 shrink-0 accent-[var(--primary)]"
        />
      </label>

      {discountOn && (
        <div className="mt-3 grid grid-cols-1 gap-3">
          <Field label="Sotuv narxi — dona (so'm)" span>
            <input
              className="inp"
              inputMode="numeric"
              value={price}
              onChange={(e) => { setPrice(e.target.value.replace(/\D/g, "")); setErrs((x) => { const n = { ...x }; delete n.sale_price; return n; }); }}
              placeholder={String(listPrice)}
              autoFocus
            />
            {errs.sale_price && <span className="mt-1 block text-[11.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>{errs.sale_price}</span>}
          </Field>
          <Field label={needsReason ? "Chegirma sababi (majburiy)" : "Chegirma sababi"} span>
            <input
              className="inp"
              value={reason}
              onChange={(e) => { setReason(e.target.value); setErrs((x) => { const n = { ...x }; delete n.discount_reason; return n; }); }}
              placeholder="Masalan: Doimiy mijoz"
            />
            {errs.discount_reason && <span className="mt-1 block text-[11.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>{errs.discount_reason}</span>}
          </Field>
        </div>
      )}

      {/* MIJOZ — odatda ixtiyoriy; QARZDA MAJBURIY («Biriktirmayman» o'chiriladi) */}
      <div className="mt-4">
        <CustomerPicker
          value={cust}
          onChange={setCust}
          label={isDebt ? "Mijoz (majburiy)" : "Mijoz (ixtiyoriy)"}
          disabledModes={isDebt ? ["none"] : undefined}
          disabledReason={isDebt ? DEBT_NONE_DISABLED_REASON : undefined}
          requirePhone={isDebt}
        />
        {errs.customer && <p className="mt-1.5 text-[11.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>{errs.customer}</p>}
      </div>

      {/* QARZ IZOHI — ixtiyoriy (debt_note) */}
      {isDebt && (
        <div className="mt-3">
          <Field label="Izoh (ixtiyoriy)" span>
            <input className="inp" value={debtNote} onChange={(e) => setDebtNote(e.target.value)} placeholder="Masalan: Juma kuni to'laydi" />
          </Field>
        </div>
      )}

      {/* §4 SOTUVDA QO'SHILGAN — yig'iq (tez sotuv buzilmasin); qo'shimcha material + oformleniya */}
      <div className="mt-4 rounded-[14px] border" style={{ borderColor: extraOpen ? "var(--primary)" : "var(--border)" }}>
        <button type="button" onClick={() => setExtraOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left">
          <span className="flex min-w-0 items-center gap-2">
            <Package size={16} strokeWidth={2} style={{ color: extraOpen ? "var(--primary)" : "var(--muted)" }} />
            <span className="min-w-0">
              <span className="block text-[13px] font-bold">Sotuvda qo&apos;shilgan</span>
              <span className="block text-[11.5px]" style={{ color: "var(--muted)" }}>Qo&apos;shimcha material va oformleniya — ixtiyoriy</span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-2">
            {(validSaleMats.length > 0 || saleDeco > 0 || !!saleImage) && <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>{validSaleMats.length + (saleDeco > 0 ? 1 : 0) + (saleImage ? 1 : 0)}</span>}
            <ChevronDown size={16} className="transition-transform duration-200" style={{ transform: extraOpen ? "rotate(180deg)" : undefined, color: "var(--muted)" }} />
          </span>
        </button>
        {extraOpen && (
          <div className="border-t px-3.5 py-3" style={{ borderColor: "var(--border)" }}>
            {/* MATERIALLAR — 1 dona sotuvga; server × quantity qiladi */}
            <div className="mb-1 text-[12px] font-bold" style={{ color: "var(--text-2)" }}>Qo&apos;shimcha materiallar</div>
            <div className="flex flex-col gap-2">
              {saleMats.map((m, i) => {
                const p = matOf(m.packaging);
                const need = (+m.qty || 0) * qty;
                const over = p ? need > p.quantity : false;
                return (
                  <div key={i}>
                    <div className="grid grid-cols-[1fr_74px_30px] items-center gap-2">
                      <Select value={m.packaging} onChange={(v) => setSaleMats(saleMats.map((x, j) => (j === i ? { ...x, packaging: +v } : x)))} options={Array.from(matGroups.entries()).flatMap(([g, list]) => list.map((pk) => ({ value: pk.id, label: pk.name_uz, sub: `${PACKAGING_LABEL[g as keyof typeof PACKAGING_LABEL] ?? g} · ${pk.quantity} dona bor` })))} />
                      <input className="inp !py-1.5" type="number" value={m.qty} onChange={(e) => setSaleMats(saleMats.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} placeholder="1" />
                      <button type="button" onClick={() => setSaleMats(saleMats.filter((_, j) => j !== i))} className="icon-btn icon-btn-danger !h-8 !w-8" title="Olib tashlash"><X size={14} strokeWidth={1.75} /></button>
                    </div>
                    {p && (
                      <p className="mt-0.5 px-0.5 text-[11px]" style={{ color: over ? "#b3873a" : "var(--muted)" }}>
                        {m.qty || 0} × {qty} sotuv = <b style={{ color: over ? "#b3873a" : "var(--text-2)" }}>{need}</b> dona yechiladi{over ? ` — qoldiqdan ko'p (${p.quantity})` : ` · ${p.quantity} bor`}
                      </p>
                    )}
                  </div>
                );
              })}
              <button type="button" onClick={addSaleMat} disabled={materials.length === 0} className="self-start rounded-full border border-[color:var(--border-strong)] bg-[color:var(--hover)] px-3 py-1.5 text-[12px] font-bold disabled:opacity-50">
                <Plus size={14} strokeWidth={1.75} /> Material qo&apos;shish
              </button>
            </div>

            {/* OFORMLENIYA floristi — sale_decoration salary (catalog-yaratishdagi decoration'dan ALOHIDA) */}
            <div className="mb-1 mt-4 flex items-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--text-2)" }}><Sparkles size={13} style={{ color: "var(--acc)" }} /> Oformleniya floristi</div>
            <Select value={saleDeco} onChange={(v) => setSaleDeco(+v)} placeholder="Tanlang" options={[{ value: 0, label: "— (tanlanmasa haq yozilmaydi)" }, ...florists.map((fp) => ({ value: fp.id, label: floristName(fp), sub: Math.round(+(fp.decoration_fee ?? 0)) > 0 ? `${fmt(fp.decoration_fee)} / dona` : "narx belgilanmagan" }))]} />
            {saleDeco > 0 && (decoFeeMissing ? (
              <p className="mt-1 text-[11.5px] font-semibold" style={{ color: "var(--warning-ink, #8a6d1f)" }}>⚠ Bu floristda oformleniya narxi belgilanmagan — haq yozilmaydi.</p>
            ) : (
              <p className="mt-1 text-[11.5px] font-semibold" style={{ color: "var(--text-2)" }}>Oformleniya haqi: {decoFee.toLocaleString("ru")} × {qty} = <b style={{ color: "var(--acc)" }}>{fmt(decoPay)}</b></p>
            ))}

            {/* SOTUV RASMI — guruhga ketadi (spec: `sale_image_url`) */}
            <div className="mb-1 mt-4 flex items-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--text-2)" }}><ImageIcon size={13} style={{ color: "var(--acc)" }} /> Sotuv rasmi</div>
            <ImageInput value={saleImage} onChange={setSaleImage} />
            <p className="mt-1 text-[11.5px]" style={{ color: "var(--muted)" }}>Ixtiyoriy — sotuv xabari bilan birga Telegram guruhiga yuboriladi.</p>

            {/* IQTISODIY TA'SIR — bu sotuvga */}
            {extraTotal > 0 && (
              <div className="mt-3 rounded-sm px-3 py-2 text-[12px]" style={{ background: "var(--surface-2)" }}>
                <div className="flex items-center justify-between"><span style={{ color: "var(--muted)" }}>Qo&apos;shimcha material tannarxi</span><span className="font-semibold tabular-nums">{fmt(extraMatCost)}</span></div>
                <div className="flex items-center justify-between"><span style={{ color: "var(--muted)" }}>Oformleniya haqi (oylikka)</span><span className="font-semibold tabular-nums" style={{ color: "var(--acc)" }}>{fmt(decoPay)}</span></div>
                <div className="mt-1 flex items-center justify-between border-t pt-1 font-bold" style={{ borderColor: "var(--border)" }}><span>Bu sotuvga qo&apos;shimcha xarajat</span><span className="tabular-nums" style={{ color: "var(--danger-ink)" }}>−{fmt(extraTotal)}</span></div>
                <p className="mt-1 flex items-start gap-1 text-[10.5px] leading-snug" style={{ color: "var(--muted)" }}><Info size={11} className="mt-px shrink-0" /> Material tannarxi sotuv foydasini kamaytiradi; oformleniya haqi floristga oylik sifatida yoziladi (source: sotuv oformleniyasi).</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SOTUV SANASI — ixtiyoriy; default hozir.
          ⚠️ QARZDA KO'RSATILMAYDI: `sold_at` ni backend TO'LOV kuniga qo'yadi, ya'ni bu yerda
          tanlangan sana baribir ustidan yozilardi — chalg'itmaslik uchun butunlay yashiramiz. */}
      {isDebt ? (
        <p className="mt-4 rounded-[14px] border px-3.5 py-2.5 text-[11.5px] font-semibold" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
          Sotuv sanasi qarzda tanlanmaydi — u <b>to&apos;lov kuni</b> bilan belgilanadi.
        </p>
      ) : (
      <label className="mt-4 flex cursor-pointer items-center justify-between gap-3 rounded-[14px] border px-3.5 py-3" style={{ borderColor: dateOn ? "var(--primary)" : "var(--border)", background: dateOn ? "var(--primary-soft)" : undefined }}>
        <span className="flex min-w-0 items-center gap-2">
          <CalendarClock size={16} strokeWidth={2} style={{ color: dateOn ? "var(--primary)" : "var(--muted)" }} />
          <span className="min-w-0">
            <span className="block text-[13px] font-bold">Boshqa sotuv sanasi</span>
            <span className="block text-[11.5px]" style={{ color: "var(--muted)" }}>Belgilanmasa — hozirgi vaqt</span>
          </span>
        </span>
        <input type="checkbox" checked={dateOn} onChange={(e) => { setDateOn(e.target.checked); if (!e.target.checked) setSoldAt(""); }} className="h-4 w-4 shrink-0 accent-[var(--primary)]" />
      </label>
      )}
      {dateOn && !isDebt && (
        <div className="mt-2.5">
          <DatePicker value={soldAt} onChange={setSoldAt} withTime maxDate={todayTashkent()} placeholder="Sotuv sanasi va vaqti" ariaLabel="Sotuv sanasi" />
        </div>
      )}

      {/* DASTAFKA — ixtiyoriy. ⚠️ TOVAR SAVDOSIGA KIRMAYDI va SOF FOYDAGA TA'SIR QILMAYDI. */}
      <div className="mt-4">
        <Field label="Shundan dastafka (ixtiyoriy)" span>
          <input className="inp" inputMode="numeric" value={delivery} placeholder="0" aria-label="Dastafka summasi"
            onChange={(e) => { setDelivery(formatMoneyInput(e.target.value)); setErrs((x) => { const n = { ...x }; delete n.delivery_amount; delete n.detail; return n; }); }} />
          {/* ⚠️ Server 400 beradi: dastafka sotuv summasidan QAT'IY kichik bo'lishi shart */}
          {deliveryBad && (
            <span className="mt-1 block text-[11.5px] font-bold" style={{ color: "var(--danger-ink)" }}>
              {deliveryTooLargeMessage(calc.totalSum, delivery)}
            </span>
          )}
          {errs.delivery_amount && <span className="mt-1 block text-[11.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>{errs.delivery_amount}</span>}
        </Field>
        <p className="mt-1 text-[11.5px]" style={{ color: "var(--muted)" }}>
          Sotuv summasining <b>ichidan</b> kuryerga ketadigan pul — ustiga qo&apos;shilmaydi.
          Tovar savdosiga kirmaydi va sof foydaga ta&apos;sir qilmaydi.
        </p>
        {/* TOVAR SAVDOSI — HOSILA qiymat (kiritilmaydi) */}
        {deliveryNum > 0 && !deliveryBad && (
          <div className="mt-2 flex items-baseline justify-between gap-2 rounded-[12px] px-3 py-2"
            style={{ background: "var(--surface-2)" }}>
            <span className="text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>
              Tovar savdosi <span className="font-medium" style={{ color: "var(--muted)" }}>(hisoblanadi)</span>
            </span>
            <span className="text-[13px] font-extrabold tabular-nums">{fmt(goodsTotal)}</span>
          </div>
        )}
      </div>

      {/* HISOB — jonli */}
      <div className="mt-4 rounded-[16px] border px-4 py-3" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-baseline justify-between gap-2 text-[13px]">
          <span style={{ color: "var(--text-2)" }}>Asl narx</span>
          <span className={clsx("tabular-nums font-semibold", calc.unitDiscount > 0 && "line-through opacity-70")}>{fmt(listPrice * qty)}</span>
        </div>
        {calc.unitDiscount > 0 && (
          <div className="mt-1 flex items-baseline justify-between gap-2 text-[13px]">
            <span style={{ color: "var(--text-2)" }}>Chegirma ({calc.percent}%)</span>
            <span className="tabular-nums font-semibold" style={{ color: "var(--danger-ink)" }}>−{fmt(calc.totalDiscount)}</span>
          </div>
        )}
        {/* ⚠️ DASTAFKA chegirmadan KEYIN qo'shiladi — hech qachon chegirmaga tushmaydi */}
        {deliveryNum > 0 && (
          <>
            <div className="mt-1 flex items-baseline justify-between gap-2 text-[13px]">
              <span style={{ color: "var(--text-2)" }}>Shundan dastafka</span>
              <span className="tabular-nums font-semibold" style={{ color: "var(--muted)" }}>− {fmt(deliveryNum)}</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2 text-[13px]">
              <span style={{ color: "var(--text-2)" }}>Tovar savdosi</span>
              <span className="tabular-nums font-semibold">{fmt(goodsTotal)}</span>
            </div>
          </>
        )}
        <div className="mt-1.5 flex items-baseline justify-between gap-2 border-t pt-1.5" style={{ borderColor: "var(--border)" }}>
          <span className="text-[13px] font-semibold">{isDebt ? "Qarz summasi" : "Mijozdan olinadi"}</span>
          <span className="text-[17px] font-bold tabular-nums" style={{ color: isDebt ? "var(--danger-ink)" : "var(--acc)" }}>{fmt(payTarget)}</span>
        </div>
        {/* Chegirmali qarz: qarz CHEGIRMALI summa bo'ladi (spec §1) — ikkala qoida birga ishlaydi. */}
        {isDebt && calc.totalDiscount > 0 && (
          <p className="mt-1 text-[11px] font-semibold" style={{ color: "var(--muted)" }}>Qarz — chegirmadan keyingi summa.</p>
        )}
      </div>

      {errs.detail && (
        <p className="mt-3 whitespace-pre-line rounded-sm px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>
          {errs.detail}
        </p>
      )}

      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor</button>
        {/* ⚠️ `title` ATAYIN YO'Q: iOS Safari uni uzoq bosilganda QORA native oynacha
            qilib ko'rsatadi — foydalanuvchi buni brauzer validatsiyasi deb o'ylaydi va
            u ekrandagi xabar bilan zid tushishi mumkin. Bloklash sababi HAR DOIM
            forma ichida, matn sifatida ko'rinadi. */}
        <button onClick={submit} disabled={busy || debtBlocked || mixedBlocked || deliveryBad} aria-describedby={mixedBlocked ? "mixed-reason" : undefined} className={clsx("btn-primary disabled:opacity-60", busy && "btn-loading")}>
          {isDebt ? `${qty} ta qarzga berish` : `${qty} ta sotish`}
        </button>
      </ModalFooter>
    </Modal>
  );
}

function SettleCell({ label, value, hue }: { label: string; value: string; hue?: string }) {
  return (
    <div className="rounded-sm px-1.5 py-1.5" style={{ background: "var(--surface-solid, var(--surface))" }}>
      <div className="text-[9.5px] font-semibold uppercase leading-tight tracking-wide" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="mt-0.5 text-[12.5px] font-extrabold tabular-nums" style={{ color: hue ?? "var(--text)" }}>{value}</div>
    </div>
  );
}
