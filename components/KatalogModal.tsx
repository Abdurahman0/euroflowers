"use client";
import { AlertTriangle, Info, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import Modal, { ModalHeader, Section, Field } from "./Modal";
import Select from "./Select";
import CustomerPicker, { customerPayload, type CustomerPick } from "./CustomerPicker";
import ImageInput from "./ImageInput";
import { Icon } from "./icons";
import { ARRANGEMENT_LABEL } from "./badges";
import { fmt } from "@/lib/format";
import { KIND_LABEL, PACKAGING_LABEL, VOLUME_LABEL, stems as stemsFmt, formatStemsAndBunches, normalizeComposition, normalizeMaterials, rateSalaryForCatalog, rateToCatalogSalary, catalogSalaryPayload } from "@/lib/inventory";
import { balanceRemaining, batchHeldByFlorist, stemsForBatch, type CompStemRow } from "@/lib/floristStock";
import type { ArrangementType, CatalogItem, CatalogKind, CatalogVolume, FloristProfile, FloristStockBalance, FloristVolumeRate, Packaging, PaymentType, StockBatch } from "@/lib/types";

type CompRow = { stock_batch: number; mode: "stems" | "bunches"; qty: string };
type MatRow = { packaging: number; qty: string };

const EMPTY = {
  name_uz: "", arrangement_type: "bouquet" as ArrangementType, height_cm: "",
  price: "", florist_fee: "", florist_salary_amount: "", discount_reason: "", note: "",
  quantity_total: "1", instagram_story_url: "", description_uz: "", image_url: "",
};

/** KATALOG KOMPOZITSIYA QURUVCHI — Standart/Maxsus, hajm tarifi, materiallar,
    jonli narx paneli. Yaratish/tahrirlash (backend: /api/catalog/). */
export default function KatalogModal({ item = null, onClose, onSaved }: { item?: CatalogItem | null; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useStore();
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [materials, setMaterials] = useState<Packaging[]>([]);
  const [florists, setFlorists] = useState<FloristProfile[]>([]);
  const [rates, setRates] = useState<FloristVolumeRate[]>([]);
  // FLORIST BALANSI — florist tanlanganda kompozitsiya SHUNDAN olinadi (skladdan emas)
  const [balances, setBalances] = useState<FloristStockBalance[]>([]);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [kind, setKind] = useState<CatalogKind>(item?.catalog_kind ?? "standard");
  const [volume, setVolume] = useState<CatalogVolume | "">(item?.volume ?? "");
  const [florist, setFlorist] = useState<number>(item?.florist ?? 0);
  const [salaryFromRate, setSalaryFromRate] = useState(false);
  // operator ish haqini QO'LDA tahrirladimi — true bo'lsa tarif uni bosib o'tmaydi
  const [salaryTouched, setSalaryTouched] = useState(false);
  const [stemsFromRate, setStemsFromRate] = useState(false);
  const [f, setF] = useState({
    ...EMPTY,
    ...(item ? {
      name_uz: item.name_uz ?? "", arrangement_type: item.arrangement_type, height_cm: item.height_cm ? String(item.height_cm) : "",
      price: item.price ? String(Math.round(+item.price)) : "", florist_fee: item.florist_fee ? String(Math.round(+item.florist_fee)) : "",
      florist_salary_amount: item.florist_salary_amount ? String(Math.round(+item.florist_salary_amount)) : "",
      discount_reason: item.discount_reason ?? "", note: item.note ?? "",
      quantity_total: String(item.quantity_total ?? 1), instagram_story_url: item.instagram_story_url ?? "",
      description_uz: item.description_uz ?? "", image_url: item.image_url ?? "",
    } : {}),
  });
  // maxsus katalog auto-sotiladi → to'lov turi shu paytda yoziladi
  const [payment, setPayment] = useState<PaymentType>("cash");
  // MIJOZ — walk-in yoki mavjud; item'da biriktirilgan bo'lsa oldindan tanlanadi
  const hadCustomer = !!(item?.customer_detail || item?.customer);
  const [cust, setCust] = useState<CustomerPick>(
    item?.customer_detail
      ? { mode: "existing", id: item.customer_detail.id, detail: item.customer_detail }
      : { mode: "none" }
  );
  const [comp, setComp] = useState<CompRow[]>(
    item?.composition?.length ? item.composition.map((c) => ({ stock_batch: c.stock_batch, mode: "stems" as const, qty: String(c.quantity_stems) })) : [{ stock_batch: 0, mode: "stems", qty: "" }]
  );
  const [mats, setMats] = useState<MatRow[]>(item?.materials?.length ? item.materials.map((m) => ({ packaging: m.packaging, qty: String(m.quantity) })) : []);
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  // yetarli qoldiq yo'q — backend `detail` (ko'p qatorli) alohida holatda ko'rsatiladi
  const [stockError, setStockError] = useState<{ lines: string[]; batchId: number | null; florist?: boolean; shortage?: boolean } | null>(null);
  // dublikat qator birlashganda qisqa yorug'lik (flash) beriladi
  const [flashBatch, setFlashBatch] = useState<number | null>(null);
  const [flashMat, setFlashMat] = useState<number | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>();
  const flash = (kind: "comp" | "mat", id: number) => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    if (kind === "comp") setFlashBatch(id); else setFlashMat(id);
    showToast("Mavjud qatorga qo'shildi");
    flashTimer.current = setTimeout(() => { setFlashBatch(null); setFlashMat(null); }, 600);
  };
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => { setF({ ...f, [k]: e.target.value }); if (errs[k]) setErrs((x) => { const n = { ...x }; delete n[k]; return n; }); };
  const compLocked = !!item && ((item.quantity_sold ?? 0) > 0 || !!item.stock_deducted_at);
  const qtyTotal = Math.max(+f.quantity_total || 1, 1);

  useEffect(() => {
    // BARCHA faol partiyalar saqlanadi (narx uchun kerak — florist rejimida sklad
    // qoldig'i 0 bo'lsa ham partiya narxi topilishi shart). Warehouse-rejim tanlagichi
    // usableBatches memo orqali faqat qoldig'i borlarni ko'rsatadi.
    api.stockBatches({ is_active: true }).then((bs) => {
      const used = new Set((item?.composition ?? []).map((c) => c.stock_batch));
      const usable = bs.filter((b) => b.remaining_stems > 0 || used.has(b.id));
      setBatches(bs);
      setComp((c) => c.map((r) => ({ ...r, stock_batch: r.stock_batch || usable[0]?.id || 0 })));
    }).catch(() => showToast("Sklad partiyalarini yuklab bo'lmadi"));
    api.materials({ is_active: true }).then(setMaterials).catch(() => {});
    api.florists({ is_active: true, ordering: "user" }).then(setFlorists).catch(() => {});
  }, [showToast, item]);

  // TARIFLAR — TANLANGAN floristning FAOL tariflari (backend auto-to'ldirishi bilan
  // AYNAN bir manba: ?florist=<id>&is_active=true). Drift bo'lmasligi uchun shu yerdan.
  useEffect(() => {
    if (!florist) { setRates([]); return; }
    api.floristVolumeRates({ florist, is_active: true }).then(setRates).catch(() => setRates([]));
  }, [florist]);

  // BALANS — florist tanlanganda gul RO'YXATI shundan (skladdan emas). Florist
  // o'zgarsa qayta yuklanadi → mavjud qatorlar yangi balansga qayta tekshiriladi.
  const floristMode = florist > 0;
  useEffect(() => {
    if (!florist) { setBalances([]); return; }
    setBalancesLoading(true);
    api.floristStockBalances({ florist }).then(setBalances).catch(() => setBalances([])).finally(() => setBalancesLoading(false));
  }, [florist]);

  const batchOf = (id: number) => batches.find((b) => b.id === id);
  const balanceOf = (id: number) => balances.find((b) => b.batch === id);
  const matOf = (id: number) => materials.find((m) => m.id === id);
  const spbOf = (id: number) => batchOf(id)?.stems_per_bunch || balanceOf(id)?.batch_detail?.stems_per_bunch || 1;
  // MAVJUD miqdor: florist rejimida balansdan, aks holda sklad qoldig'idan
  const availOf = (id: number) => (floristMode ? balanceRemaining(balances, id) : batchOf(id)?.remaining_stems ?? 0);
  const stemsOfRow = (r: CompRow) => {
    const n = parseFloat(r.qty) || 0;
    return r.mode === "bunches" ? Math.round(n * spbOf(r.stock_batch)) : Math.round(n);
  };
  // bitta partiyaga tegishli BARCHA qatorlar yig'indisi — validatsiya yig'indi bo'yicha
  // (lib/floristStock — Vitest bilan qamrab olingan, YAGONA manba)
  const compStemRows = (): CompStemRow[] => comp.map((r) => ({ stock_batch: r.stock_batch, stems: stemsOfRow(r) }));
  const stemsForBatchNow = (batchId: number) => stemsForBatch(compStemRows(), batchId);
  // florist bu partiyani TUTMAYDI (florist o'zgarganda yoki noto'g'ri tanlovda)
  const rowInvalidFlorist = (batchId: number) => floristMode && !balancesLoading && batchId > 0 && !batchHeldByFlorist(balances, batchId);

  // WAREHOUSE-rejim tanlagichi — faqat qoldig'i bor (yoki allaqachon tanlangan) partiyalar
  const usableBatches = useMemo(() => {
    const used = new Set(comp.map((r) => r.stock_batch));
    return batches.filter((b) => b.remaining_stems > 0 || used.has(b.id));
  }, [batches, comp]);
  // KOMPOZITSIYA tanlagich variantlari — florist rejimida BALANSDAN (gul bo'yicha
  // saralangan, «mavjud: N dona»), aks holda skladdan.
  const compOptions = useMemo(() => {
    if (floristMode) {
      return [...balances]
        .sort((a, b) => `${a.batch_detail?.flower ?? ""}`.localeCompare(`${b.batch_detail?.flower ?? ""}`))
        .map((bl) => ({
          value: bl.batch,
          label: `${bl.batch_detail?.flower ?? ""} ${bl.batch_detail?.variant ?? ""}${bl.batch_detail?.color ? ` · ${bl.batch_detail.color}` : ""}`.trim() || `Partiya #${bl.batch}`,
          sub: `№${bl.batch_detail?.batch_number ?? bl.batch} · mavjud: ${formatStemsAndBunches(bl.remaining_stems, bl.batch_detail?.stems_per_bunch)}`,
        }));
    }
    return usableBatches.map((bb) => ({
      value: bb.id,
      label: `${bb.variant_detail?.flower_detail?.name_uz ?? ""} ${bb.variant_detail?.name_uz ?? ""}`.trim(),
      sub: `${formatStemsAndBunches(bb.remaining_stems, bb.stems_per_bunch)} · ${fmt(bb.sale_price_per_stem)}/dona`,
    }));
  }, [floristMode, balances, usableBatches]);
  const anyInvalidRow = floristMode && comp.some((r) => rowInvalidFlorist(r.stock_batch));

  // DUBLIKAT: bir xil stock_batch tanlansa — ikkinchi qator qo'shilmaydi,
  // mavjud qatorga miqdor qo'shiladi (qator qisqa yonib chiqadi + toast).
  const setBatchAt = (i: number, newBatch: number) => {
    setComp((rows) => {
      const dupIdx = rows.findIndex((r, j) => j !== i && r.stock_batch === newBatch);
      if (dupIdx === -1) return rows.map((r, j) => (j === i ? { ...r, stock_batch: newBatch } : r));
      const spb = batchOf(newBatch)?.stems_per_bunch || 1;
      const r = rows[i];
      const incStems = r.mode === "bunches" ? Math.round((parseFloat(r.qty) || 0) * spb) : Math.round(parseFloat(r.qty) || 0);
      const merged = rows
        .map((x, j) => {
          if (j !== dupIdx) return x;
          const cur = x.mode === "bunches" ? (parseFloat(x.qty) || 0) + incStems / spb : (parseFloat(x.qty) || 0) + incStems;
          return { ...x, qty: x.mode === "bunches" ? String(+cur.toFixed(2)) : String(Math.round(cur)) };
        })
        .filter((_, j) => j !== i);
      flash("comp", newBatch);
      return merged;
    });
  };
  const addComp = () => {
    const used = new Set(comp.map((r) => r.stock_batch));
    // keyingi bo'sh variant — joriy rejim manbasidan (florist balansi yoki sklad)
    const next = compOptions.find((o) => !used.has(+o.value))?.value ?? compOptions[0]?.value ?? 0;
    setComp([...comp, { stock_batch: +next, mode: "stems", qty: "" }]);
  };
  const setMatAt = (i: number, newPack: number) => {
    setMats((rows) => {
      const dupIdx = rows.findIndex((r, j) => j !== i && r.packaging === newPack);
      if (dupIdx === -1) return rows.map((r, j) => (j === i ? { ...r, packaging: newPack } : r));
      const inc = +rows[i].qty || 0;
      const merged = rows
        .map((x, j) => (j === dupIdx ? { ...x, qty: String((+x.qty || 0) + inc) } : x))
        .filter((_, j) => j !== i);
      flash("mat", newPack);
      return merged;
    });
  };
  const addMat = () => {
    const used = new Set(mats.map((m) => m.packaging));
    const next = materials.find((p) => !used.has(p.id)) ?? materials[0];
    setMats([...mats, { packaging: next?.id ?? 0, qty: "1" }]);
  };

  // TANLANGAN FLORISTNING hajm+turi uchun tarifini topadi (per-florist model).
  // Florist tanlanmasa tarif qidirilmaydi. Moslik faqat lib/inventory'da.
  const rateFor = (vol: CatalogVolume | "", arr: ArrangementType) =>
    rateSalaryForCatalog(rates, florist || null, vol, arr);
  // florist+hajm tanlangan, lekin mos FAOL tarif yo'q — operatorga aniq aytamiz
  const rateMissing = !!florist && !!volume && !rateFor(volume, f.arrangement_type);

  // tarifning "standart dona"sini kompozitsiyaga bir marta yozadi — FAQAT bitta
  // gul qatori dona rejimida bo'lsa. force=false → faqat bo'sh bo'lsa; force=true
  // (hajm/turi almashdi) → bo'sh yoki avval tarifdan yozilgan bo'lsa yangilaydi.
  const writeStems = (defaultStems: number, force: boolean) => {
    if (!defaultStems) return;
    if (comp.length !== 1 || comp[0].mode !== "stems") return;
    if (comp[0].qty && !(force && stemsFromRate)) return; // qo'lda kiritilgan — tegilmaydi
    setComp([{ ...comp[0], qty: String(defaultStems) }]);
    setStemsFromRate(true);
  };

  // AVTO-TUZATISH: hajm/turini tanlaganda florist ISH HAQI (salary) tarifdan olinadi.
  // ⚠️ Operator QO'LDA yozgan qiymat HECH QACHON bosib o'tilmaydi (salaryTouched).
  // Tarifning florist_fee → katalog salary (rateToCatalogSalary), katalog florist_fee'ga EMAS.
  const applyRate = (vol: CatalogVolume | "", arr: ArrangementType) => {
    const rate = rateFor(vol, arr);
    if (!rate) return;
    if (!salaryTouched) { setF((p) => ({ ...p, florist_salary_amount: rateToCatalogSalary(rate) })); setSalaryFromRate(true); }
    writeStems(rate.default_stems, true); // default_stems — TAVSIYA; mavjud qatorni clobber qilmaydi (writeStems ichida himoya)
  };
  // "tarifdan qayta olish" — operator qo'lda yozib, keyin tarif qiymatini xohlasa
  const reapplyRate = () => {
    const rate = rateFor(volume, f.arrangement_type);
    if (!rate) return;
    setF((p) => ({ ...p, florist_salary_amount: rateToCatalogSalary(rate) }));
    setSalaryFromRate(true); setSalaryTouched(false);
  };

  // tariflar KEYIN yuklansa yoki bo'sh qiymatda — birinchi to'ldirish. FAQAT operator
  // tegmagan VA maydon bo'sh bo'lsa (override qoidasi: "0"/"" bilan hech qachon).
  useEffect(() => {
    const rate = rateFor(volume, f.arrangement_type);
    if (!rate) return;
    if (!salaryTouched && f.florist_salary_amount === "") {
      setF((p) => ({ ...p, florist_salary_amount: rateToCatalogSalary(rate) }));
      setSalaryFromRate(true);
    }
    writeStems(rate.default_stems, false);
  }, [volume, f.arrangement_type, florist, rates]); // eslint-disable-line react-hooks/exhaustive-deps

  // JONLI NARX (klient preview — server calculated_* bilan solishtiriladi)
  const price = useMemo(() => {
    const compPrice = comp.reduce((s, r) => { const b = batchOf(r.stock_batch); return s + (b ? Math.round(+b.sale_price_per_stem) * stemsOfRow(r) : 0); }, 0);
    const compCost = comp.reduce((s, r) => { const b = batchOf(r.stock_batch); return s + (b ? Math.round(+b.cost_per_stem) * stemsOfRow(r) : 0); }, 0);
    const matPrice = mats.reduce((s, m) => { const p = matOf(m.packaging); return s + (p ? Math.round(+p.sale_price) * (+m.qty || 0) : 0); }, 0);
    const matCost = mats.reduce((s, m) => { const p = matOf(m.packaging); return s + (p ? Math.round(+p.cost_price) * (+m.qty || 0) : 0); }, 0);
    const fee = +f.florist_fee || 0;
    // BACKEND kontrakti (jonli tekshiruvda tasdiqlangan):
    //  • florist_fee HAM component narxiga, HAM tannarxga qo'shiladi
    //  • component, cost, sotuv — HAMMASI quantity_total ga ko'paytiriladi
    //  • discount = componentTotal − sotuvTotal
    const perUnitComponent = compPrice + matPrice + fee;
    const perUnitCost = compCost + matCost + fee;
    const componentPrice = perUnitComponent * qtyTotal;
    const cost = perUnitCost * qtyTotal;
    const sale = (+f.price || 0) * qtyTotal;
    // OYLIK: HAR IKKI kind uchun `florist_salary_amount` × soni floristga yoziladi.
    // Katalogning florist_fee (mijozdan xizmat) OYLIKKA kirmaydi — bu alohida tushuncha.
    const salary = (+f.florist_salary_amount || 0) * qtyTotal;
    return { componentPrice, cost, sale, fee: fee * qtyTotal, salary, discount: Math.max(0, componentPrice - sale), profit: sale - cost, qty: qtyTotal };
  }, [comp, mats, f.price, f.florist_fee, f.florist_salary_amount, f.quantity_total, kind, qtyTotal, batches, materials]); // eslint-disable-line react-hooks/exhaustive-deps

  // MAXSUS katalog komponent narxidan arzon sotilsa — sabab MAJBURIY
  // (backend ham talab qiladi: 4471e90 catalog discount sale history)
  const needsDiscountReason = kind === "custom" && price.discount > 0;

  const save = async () => {
    if (!f.name_uz) return showToast("Nomini kiriting");
    if (!f.price) return showToast("Narxini kiriting");
    if (needsDiscountReason && !f.discount_reason.trim()) {
      setErrs((x) => ({ ...x, discount_reason: "Chegirma sababini yozing" }));
      return showToast("Chegirma sababini yozing");
    }
    // florist rejimi: bu florist tutmaydigan gul qatorlari bo'lsa yubormaymiz
    // (backend ham 400 beradi, lekin oldindan aniq aytamiz)
    if (anyInvalidRow) return showToast("Ba'zi gullar bu floristda yo'q — o'zgartiring");
    // NORMALLASHTIRISH: bir xil stock_batch/packaging qatorlari BITTAGA
    // birlashtiriladi (bitta buket = bitta item, ko'p qatorli composition).
    const composition = normalizeComposition(
      comp.filter((r) => r.stock_batch && stemsOfRow(r) > 0).map((r) => {
        const b = batchOf(r.stock_batch);
        const st = stemsOfRow(r);
        return r.mode === "bunches"
          ? { stock_batch: r.stock_batch, quantity_stems: st, quantity_bunches: (parseFloat(r.qty) || 0).toFixed(2) }
          : { stock_batch: r.stock_batch, quantity_stems: st, ...(b?.stems_per_bunch ? { quantity_bunches: (st / b.stems_per_bunch).toFixed(2) } : {}) };
      })
    );
    const materialsPayload = normalizeMaterials(mats.filter((m) => m.packaging && +m.qty > 0).map((m) => ({ packaging: m.packaging, quantity: +m.qty })));
    setBusy(true);
    setErrs({});
    setStockError(null);
    const payload: Record<string, unknown> = {
      name_uz: f.name_uz,
      name_ru: f.name_uz,
      arrangement_type: f.arrangement_type,
      catalog_kind: kind,
      ...(volume ? { volume } : {}),
      ...(florist ? { florist } : {}),
      height_cm: +f.height_cm || null,
      price: String(+f.price),
      florist_fee: f.florist_fee ? String(+f.florist_fee) : undefined,
      // ⚠️ OVERRIDE QOIDASI (spec §4): "" → kalit tushiriladi (backend tarifdan
      // avto-to'ldiradi); "0" → "0" yuboriladi (operator ataylab nol qildi). Zero ≠ bo'sh.
      ...catalogSalaryPayload(f.florist_salary_amount),
      ...(f.discount_reason.trim() ? { discount_reason: f.discount_reason.trim() } : {}),
      ...(f.note.trim() ? { note: f.note.trim() } : {}),
      quantity_total: Math.max(+f.quantity_total || 1, 1),
      ...(kind === "custom" ? {} : { instagram_story_url: f.instagram_story_url }),
      description_uz: f.description_uz,
      image_url: f.image_url,
      ...(compLocked ? {} : { composition, materials: materialsPayload }),
      // MIJOZ: existing→{customer}, new→{customer_name,customer_phone}, tozalash→{customer:null}
      ...(customerPayload(cust, hadCustomer) ?? {}),
    };
    // maxsus: mijoz do'konda tanladi → sotilgan sifatida yoziladi; to'lov turi shu paytda
    if (kind === "custom" && !item) { payload.status = "sold"; payload.payment_type = payment; }
    else if (!item) payload.status = "available";
    try {
      await (item ? api.updateCatalogItem(item.id, payload) : api.createCatalogItem(payload));
      // DIQQAT: create javobida calculated_*/discount_amount 0 keladi (kompozitsiya
      // keyin saqlanadi, GET'da to'g'ri qiymat chiqadi). Shu bois preview'ga tayanamiz
      // — preview matematikasi endi backend bilan aynan mos (fee ham qo'shilgan).
      const disc = price.discount;
      showToast(item ? "✓ Katalog yozuvi yangilandi" : `✓ Katalogga qo'shildi${disc > 0 ? ` · chegirma ${fmt(disc)}` : ""}`);
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ef:stock-changed"));
      onSaved();
      onClose();
    } catch (e) {
      // backend `detail` MASSIV yoki KO'P QATORLI string bo'lishi mumkin — bitta matnga yig'amiz.
      // Yangi florist-balans xatosi ko'p qatorli labelled blok:
      //   "Katalogni saqlash uchun floristdagi gul yetarli emas. Gul Abror qo'lida.
      //    Gul: … / Partiya: … / Kerak: … / Bor: … / Yetmayapti: …"
      const rawDetail = e instanceof ApiError && e.body && typeof e.body === "object" && "detail" in e.body ? (e.body as { detail: unknown }).detail : null;
      const detail = Array.isArray(rawDetail) ? rawDetail.join("\n") : rawDetail != null ? String(rawDetail) : null;
      // Yetishmovchilik belgilari — FAQAT sarlavha va affordance (yo'l-yo'riq) uchun.
      // ⚠️ O'qiladigan blokni HECH QACHON shu mos kelishga bog'lamaymiz: backend matni
      // yana o'zgarsa ham server `detail` AYNAN, jim qolmasdan ko'rsatiladi.
      const stockText = [detail, e instanceof ApiError ? e.message : null, ...(e instanceof ApiError && e.fieldErrors ? Object.values(e.fieldErrors) : [])]
        .find((s) => s && /(yetarli qoldiq|yetarli gul|yetarli emas|yetmayapti|qoldiq yo|qo'lida|floristda|dona bor|kerak)/i.test(s)) || null;
      const floristShortage = !!stockText && /(qo'lida|floristda|yetarli gul)/i.test(stockText);
      if (detail) {
        // ko'p qatorli labelled blokni o'qiladigan qilib ajratamiz (qator tuzilishi saqlanadi);
        // labelli qatorlar bo'lsa o'shalarni, bo'lmasa butun matnni ko'rsatamiz — hech biri yo'qolmaydi
        const all = detail.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const labeled = all.filter((l) => l.includes(":"));
        const lines = labeled.length ? labeled : all;
        // aybdor partiyani topamiz — matnda partiya raqami yoki gul nomi bo'lsa (best-effort)
        const off = comp.find((r) => { const b = batchOf(r.stock_batch); return b?.batch_number && detail.includes(b.batch_number); })
          ?? comp.find((r) => { const nm = batchOf(r.stock_batch)?.variant_detail?.flower_detail?.name_uz; return nm && detail.includes(nm); });
        setStockError({ lines, batchId: off?.stock_batch ?? null, florist: floristShortage, shortage: !!stockText });
        showToast(floristShortage ? "Florist qo'lida yetarli gul yo'q" : stockText ? "Skladda yetarli qoldiq yo'q" : (e instanceof ApiError ? e.message : "Saqlab bo'lmadi"));
      } else if (e instanceof ApiError && e.fieldErrors) {
        setErrs(e.fieldErrors);
        showToast(e.message);
      } else {
        showToast(e instanceof ApiError ? e.message : "Saqlashda xatolik");
      }
      setBusy(false);
    }
  };

  const floristName = (fp: FloristProfile) => { const u = fp.user_detail; return u ? [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username : `#${fp.id}`; };
  const matGroups = useMemo(() => {
    const g = new Map<string, Packaging[]>();
    materials.forEach((m) => { const k = m.packaging_type; (g.get(k) ?? g.set(k, []).get(k)!).push(m); });
    return g;
  }, [materials]);

  // bitta mahsulotga ketadigan jami gul (skladdan yechish hisobi uchun)
  const perUnitStems = comp.reduce((s, r) => s + (r.stock_batch ? stemsOfRow(r) : 0), 0);

  const Err = ({ k }: { k: string }) =>
    errs[k] ? <p className="mt-1 text-[11.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>{errs[k]}</p> : null;
  // ichma-ich (kompozitsiya/material) xatolari — bitta inputga bog'lab bo'lmaydi, banner sifatida
  const nestedErrs = Object.entries(errs).filter(([k]) => k.startsWith("composition") || k.startsWith("materials") || k === "non_field_errors");

  const PriceLine = ({ label, value, hue, strong }: { label: string; value: number; hue?: string; strong?: boolean }) => (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[12.5px]" style={{ color: "var(--text-2)" }}>{label}</span>
      <span className={clsx("tabular-nums", strong ? "text-[15px] font-bold" : "text-[13px] font-semibold")} style={{ color: hue ?? "var(--text)" }}>{fmt(value)}</span>
    </div>
  );

  return (
    <Modal onClose={onClose} width={640}>
      <ModalHeader icon={<Icon name="katalog" />} title={item ? "Katalog yozuvini tahrirlash" : "Katalog yaratish"} sub={item ? `${item.name_uz} · #${item.id}` : "Standart yoki maxsus kompozitsiya"} onClose={onClose} />

      {/* kind toggle */}
      {!item && (
        <div className="mt-1 flex gap-1 rounded-full border p-1" style={{ borderColor: "var(--border)" }}>
          {(["standard", "custom"] as const).map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} className="flex-1 rounded-full py-2 text-[13px] font-bold transition-colors duration-150" style={kind === k ? { background: "var(--primary)", color: "#fff" } : { color: "var(--muted)" }}>
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      )}
      <p className="mt-2 text-[12px]" style={{ color: "var(--muted)" }}>
        {kind === "standard" ? "Standart — florist tayyorlagan buket/savat." : "Maxsus — mijoz do'konda o'zi tanladi."}
      </p>
      {kind === "custom" && !item && (
        <>
          <div className="mt-2 flex items-center gap-1.5 rounded-[11px] bg-peach px-3 py-2 text-[12.5px] font-semibold text-peachink">
            <Info size={14} strokeWidth={2} /> Sotilgan sifatida yoziladi (status = sotildi).
          </div>
          {/* to'lov turi — maxsus katalog darhol sotilgani uchun shu paytda yoziladi */}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>To&apos;lov:</span>
            <div className="flex flex-1 gap-1.5">
              {(["cash", "card"] as const).map((pv) => (
                <button
                  key={pv}
                  type="button"
                  onClick={() => setPayment(pv)}
                  aria-pressed={payment === pv}
                  className="flex-1 rounded-[11px] border-[1.5px] py-1.5 text-[12.5px] font-bold transition-colors duration-150"
                  style={payment === pv ? { background: "var(--primary)", borderColor: "var(--primary)", color: "#fff" } : { borderColor: "var(--border)", color: "var(--text-2)" }}
                >
                  {pv === "cash" ? "Naqd" : "Karta"}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <Section>Asosiy</Section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nomi (uz)" span><input className="inp" value={f.name_uz} onChange={set("name_uz")} placeholder="Masalan: Gortenziya savat" /><Err k="name_uz" /></Field>
        <Field label="Turi">
          <Select value={f.arrangement_type} onChange={(v) => { const a = v as ArrangementType; setF((p) => ({ ...p, arrangement_type: a })); applyRate(volume, a); }} options={(["bouquet", "basket", "box"] as const).map((t) => ({ value: t, label: ARRANGEMENT_LABEL[t] }))} />
        </Field>
        <Field label="Hajm">
          <Select value={volume} onChange={(v) => { const vol = v as CatalogVolume | ""; setVolume(vol); applyRate(vol, f.arrangement_type); }} placeholder="Tanlang" options={[{ value: "", label: "—" }, ...(["small", "medium", "large"] as const).map((v) => ({ value: v, label: VOLUME_LABEL[v] }))]} />
        </Field>
        <Field label="Florist">
          <Select value={florist} onChange={(v) => setFlorist(+v)} placeholder="Tanlang" options={[{ value: 0, label: "—" }, ...florists.map((fp) => ({ value: fp.id, label: floristName(fp) }))]} />
        </Field>
        <Field label={kind === "custom" ? "Soni" : "Soni (nechta bir xil tayyorlandi)"} span>
          <input className="inp" type="number" min={1} value={f.quantity_total} onChange={set("quantity_total")} placeholder="Masalan: 1" />
          {kind === "standard" && perUnitStems > 0 && (
            <p className="mt-1 text-[11.5px] font-semibold" style={{ color: "var(--text-2)" }}>
              {qtyTotal} dona × {stemsFmt(perUnitStems)} gul = <b style={{ color: "var(--acc)" }}>{stemsFmt(qtyTotal * perUnitStems)}</b> skladdan yechiladi
            </p>
          )}
        </Field>
        {/* IZOH — ko'p qatorli, ixtiyoriy (maks 500), mijozga ko'rinmaydi */}
        <Field label="Izoh" span>
          <textarea
            className="inp min-h-[68px] resize-y leading-relaxed"
            value={f.note}
            onChange={(e) => setF({ ...f, note: e.target.value.slice(0, 500) })}
            placeholder="Ixtiyoriy — ichki izoh yoki nazoratchi izohi (mijozga ko'rinmaydi)"
            maxLength={500}
            rows={2}
          />
          {f.note.length > 0 && (
            <span className="mt-0.5 block text-right text-[11px] font-medium" style={{ color: f.note.length >= 500 ? "var(--danger-ink)" : "var(--muted)" }}>{f.note.length}/500</span>
          )}
        </Field>
      </div>

      {nestedErrs.length > 0 && (
        <div className="mt-3 rounded-[11px] px-3 py-2 text-[12px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>
          {nestedErrs.map(([k, v]) => (
            <div key={k}>{k.startsWith("composition") ? "Gullar: " : k.startsWith("materials") ? "Materiallar: " : ""}{v}</div>
          ))}
        </div>
      )}

      {/* YETARLI QOLDIQ YO'Q — backend `detail` (ko'p qatorli) to'liq ko'rsatiladi */}
      {stockError && (
        <div className="mt-3 rounded-[14px] border p-3.5" style={{ borderColor: "color-mix(in srgb, var(--danger-ink) 40%, var(--border))", background: "var(--danger-soft, rgba(160,74,74,.10))" }}>
          <div className="flex items-start gap-2">
            <AlertTriangle size={16} strokeWidth={2} className="mt-0.5 shrink-0" style={{ color: "var(--danger-ink)" }} />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold" style={{ color: "var(--danger-ink)" }}>{stockError.florist ? "Florist qo'lida yetarli gul yo'q" : stockError.shortage ? "Skladda yetarli qoldiq yo'q" : "Saqlab bo'lmadi"}</div>
              <div className="mt-1.5 flex flex-col gap-0.5 text-[12.5px]" style={{ color: "var(--text-2)" }}>
                {stockError.lines.map((ln, i) => {
                  const ci = ln.indexOf(":");
                  return ci > 0 && ci < 24 ? (
                    <div key={i}><b style={{ color: "var(--text)" }}>{ln.slice(0, ci + 1)}</b>{ln.slice(ci + 1)}</div>
                  ) : (
                    <div key={i}>{ln}</div>
                  );
                })}
              </div>
              {stockError.florist ? (
                <button
                  type="button"
                  onClick={() => { if (typeof window !== "undefined") window.location.assign(`/floristlarga-chiqarilgan?florist=${florist}`); }}
                  className="mt-2.5 rounded-full border px-3 py-1 text-[12px] font-bold transition-colors duration-150 hover:bg-[var(--hover)]"
                  style={{ borderColor: "var(--danger-ink)", color: "var(--danger-ink)" }}
                >
                  Floristga gul chiqarish
                </button>
              ) : stockError.shortage && stockError.batchId != null && (
                <button
                  type="button"
                  onClick={() => { if (typeof window !== "undefined") window.location.assign(`/sklad?tab=partiyalar&batch=${stockError.batchId}`); }}
                  className="mt-2.5 rounded-full border px-3 py-1 text-[12px] font-bold transition-colors duration-150 hover:bg-[var(--hover)]"
                  style={{ borderColor: "var(--danger-ink)", color: "var(--danger-ink)" }}
                >
                  Partiyani ochish
                </button>
              )}
            </div>
            <button type="button" onClick={() => setStockError(null)} className="icon-btn !h-7 !w-7 shrink-0" aria-label="Yopish"><X size={14} strokeWidth={2} /></button>
          </div>
        </div>
      )}

      {/* KOMPOZITSIYA — florist tanlansa gul UNING QO'LIDAN, aks holda skladdan */}
      <Section>{floristMode ? "Gullar (florist qo'lidan)" : "Gullar (skladdan)"}</Section>
      {compLocked ? (
        <div className="rounded-[13px] bg-mint px-3.5 py-2.5 text-[12.5px] font-semibold text-mintink">✓ Sotuv boshlangan — tarkib o&apos;zgartirilmaydi.</div>
      ) : floristMode && !balancesLoading && balances.length === 0 ? (
        // FLORIST hech narsa tutmaydi — yangi oqim tushuntiriladi + chiqarish sahifasiga yo'l
        <div className="rounded-[14px] border border-dashed p-4 text-center" style={{ borderColor: "var(--border)" }}>
          <p className="text-[13px] font-semibold">Bu floristga hali gul chiqarilmagan</p>
          <p className="mt-1 text-[12px]" style={{ color: "var(--muted)" }}>Endi katalog florist qo&apos;lidagi guldan yasaladi. Avval unga skladdan gul chiqaring.</p>
          <button type="button" onClick={() => { if (typeof window !== "undefined") window.location.assign(`/floristlarga-chiqarilgan?florist=${florist}`); }} className="btn-primary mt-3 !inline-flex">Floristga gul chiqarish</button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {anyInvalidRow && (
            <div className="flex items-start gap-2 rounded-[12px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>
              <AlertTriangle size={15} strokeWidth={2} className="mt-px shrink-0" />
              <span>Ba&apos;zi gullar bu floristda yo&apos;q — ularni o&apos;zgartiring yoki olib tashlang (hech narsa o&apos;zi o&apos;chirilmadi).</span>
            </div>
          )}
          {comp.map((r, i) => {
            const b = batchOf(r.stock_batch);
            const st = stemsOfRow(r);
            const avail = availOf(r.stock_batch);
            const invalid = rowInvalidFlorist(r.stock_batch);
            // validatsiya SHU partiyaga tegishli BARCHA qatorlar yig'indisi bo'yicha
            const over = !invalid && r.stock_batch > 0 ? stemsForBatchNow(r.stock_batch) > avail : false;
            const under = !floristMode && b ? st > 0 && st < b.minimum_sale_stems : false;
            const sub = b ? Math.round(+b.sale_price_per_stem) * st : 0;
            const spb = spbOf(r.stock_batch);
            const flashing = flashBatch != null && r.stock_batch === flashBatch;
            const offending = stockError?.batchId != null && r.stock_batch === stockError.batchId;
            return (
              <div
                key={i}
                className="rounded-[13px] border p-2.5 transition-colors duration-300"
                style={{
                  borderColor: offending || invalid ? "var(--danger-ink)" : over || under ? "color-mix(in srgb, #b3873a 45%, var(--border))" : "var(--border)",
                  background: flashing ? "color-mix(in srgb, var(--primary) 12%, transparent)" : offending || invalid ? "var(--danger-soft, rgba(160,74,74,.10))" : undefined,
                  boxShadow: flashing ? "inset 0 0 0 1.5px var(--primary)" : undefined,
                }}
              >
                <div className="grid grid-cols-[1fr_auto_92px_32px] items-center gap-2">
                  <Select searchable value={r.stock_batch} onChange={(v) => setBatchAt(i, +v)} options={compOptions} placeholder={floristMode ? "Florist gulini tanlang" : "Gulni tanlang"} />
                  <button type="button" onClick={() => setComp(comp.map((x, j) => (j === i ? { ...x, mode: x.mode === "stems" ? "bunches" : "stems" } : x)))} className="rounded-full border px-2.5 py-1 text-[11px] font-bold" style={{ borderColor: "var(--border)", color: "var(--text-2)" }} title="Dona/Pochka">
                    {r.mode === "stems" ? "Dona" : "Pochka"}
                  </button>
                  <input className="inp !py-1.5" type="number" value={r.qty} onChange={(e) => { setStemsFromRate(false); setComp(comp.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x))); }} placeholder={r.mode === "stems" ? "25" : "1"} />
                  <button type="button" onClick={() => setComp(comp.length > 1 ? comp.filter((_, j) => j !== i) : comp)} className="icon-btn icon-btn-danger !h-8 !w-8" title="Olib tashlash"><X size={15} strokeWidth={1.75} /></button>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11.5px]">
                  <span style={{ color: invalid || over || under ? "#b3873a" : "var(--muted)" }}>
                    {invalid ? (
                      "Bu florist bu gulni tutmaydi"
                    ) : (
                      <>
                        {r.mode === "bunches" && r.stock_batch > 0 ? `${r.qty || 0} × ${spb} = ${st} dona · ` : ""}
                        {over
                          ? (floristMode ? `Floristda yetarli emas (mavjud: ${formatStemsAndBunches(avail, spb)})` : `Qoldiqdan ko'p (${formatStemsAndBunches(avail, spb)})`)
                          : under
                            ? `Min. ${b?.minimum_sale_stems} dona`
                            : r.stock_batch > 0
                              ? (floristMode ? `mavjud: ${formatStemsAndBunches(avail, spb)}` : `${formatStemsAndBunches(avail, spb)} bor`)
                              : ""}
                      </>
                    )}
                  </span>
                  {sub > 0 && <span className="font-semibold" style={{ color: "var(--acc)" }}>{fmt(sub)}</span>}
                </div>
              </div>
            );
          })}
          <button type="button" onClick={addComp} className="self-start rounded-full border border-[color:var(--border-strong)] bg-[color:var(--hover)] px-3.5 py-1.5 text-[12px] font-bold">
            <Plus size={15} strokeWidth={1.75} /> Yana gul
          </button>
        </div>
      )}

      {/* MATERIALLAR — materiallar bazasi bo'sh bo'lsa bo'lim yashirinmaydi, ko'rsatma beriladi */}
      {!compLocked && materials.length === 0 && (
        <>
          <Section>Materiallar</Section>
          <p className="text-[13px]" style={{ color: "var(--muted)" }}>Faol material yo&apos;q — avval <b>Sklad → Materiallar</b> bo&apos;limida qo&apos;shing.</p>
        </>
      )}
      {!compLocked && materials.length > 0 && (
        <>
          <Section>Materiallar</Section>
          <div className="flex flex-col gap-2.5">
            {mats.map((m, i) => {
              const p = matOf(m.packaging);
              const sub = p ? Math.round(+p.sale_price) * (+m.qty || 0) : 0;
              const overMat = p ? (+m.qty || 0) > p.quantity : false;
              const flashing = flashMat != null && m.packaging === flashMat;
              return (
                <div
                  key={i}
                  className="rounded-[13px] p-1.5 transition-colors duration-300"
                  style={{ background: flashing ? "color-mix(in srgb, var(--primary) 12%, transparent)" : undefined, boxShadow: flashing ? "inset 0 0 0 1.5px var(--primary)" : undefined }}
                >
                  <div className="grid grid-cols-[1fr_92px_32px] items-center gap-2">
                    <Select value={m.packaging} onChange={(v) => setMatAt(i, +v)} options={Array.from(matGroups.entries()).flatMap(([g, list]) => list.map((pk) => ({ value: pk.id, label: pk.name_uz, sub: `${PACKAGING_LABEL[g as keyof typeof PACKAGING_LABEL] ?? g} · ${pk.quantity} dona bor` })))} />
                    <input className="inp !py-1.5" type="number" value={m.qty} onChange={(e) => setMats(mats.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} placeholder="1" />
                    <button type="button" onClick={() => setMats(mats.filter((_, j) => j !== i))} className="icon-btn icon-btn-danger !h-8 !w-8" title="Olib tashlash"><X size={15} strokeWidth={1.75} /></button>
                  </div>
                  <div className="mt-1 flex items-center justify-between px-0.5 text-[11.5px]">
                    <span style={{ color: overMat ? "#b3873a" : "var(--muted)" }}>{p ? (overMat ? `Qoldiqdan ko'p (${p.quantity} dona)` : `${p.quantity} dona bor`) : ""}</span>
                    {sub > 0 && <span className="font-semibold" style={{ color: "var(--acc)" }}>{fmt(sub)}</span>}
                  </div>
                </div>
              );
            })}
            <button type="button" onClick={addMat} className="self-start rounded-full border border-[color:var(--border-strong)] bg-[color:var(--hover)] px-3.5 py-1.5 text-[12px] font-bold">
              <Plus size={15} strokeWidth={1.75} /> Material qo&apos;shish
            </button>
          </div>
        </>
      )}

      <Section>Mijoz</Section>
      <div className="mb-1">
        <CustomerPicker value={cust} onChange={setCust} label={kind === "custom" && !item ? "Mijoz (ixtiyoriy — kim sotib oldi)" : "Mijoz (ixtiyoriy)"} />
      </div>

      <Section>Narx va tavsif</Section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Sotuv narxi (so'm)"><input className="inp" type="number" value={f.price} onChange={set("price")} placeholder="Masalan: 850000" /><Err k="price" /></Field>
        {/* MIJOZDAN olinadigan floristika XIZMATI — narx/foydaga kiradi, OYLIK EMAS */}
        <Field label="Floristika xizmati (mijozdan)">
          <input className="inp" type="number" value={f.florist_fee} onChange={(e) => setF({ ...f, florist_fee: e.target.value })} placeholder="Masalan: 50000" />
          <span className="mt-0.5 block text-[11px] font-medium" style={{ color: "var(--muted)" }}>
            Mijozdan olinadi — foydaga kiradi, oylikka QO&apos;SHILMAYDI
          </span>
          <Err k="florist_fee" />
        </Field>

        {/* Floristning ISH HAQI (oylikka yoziladi) — tarifdan yoki qo'lda. Alohida tushuncha. */}
        <Field label="Florist ish haqi (oylikka)">
          <input
            className="inp"
            type="number"
            value={f.florist_salary_amount}
            onChange={(e) => { setSalaryFromRate(false); setSalaryTouched(true); setF({ ...f, florist_salary_amount: e.target.value }); }}
            placeholder="Masalan: 60000"
          />
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {salaryFromRate && <span className="text-[11px] font-semibold" style={{ color: "var(--primary)" }}>Tarifdan olindi</span>}
            {/* operator qo'lda yozgan, lekin tarif mavjud → istasa qайta olsin */}
            {!salaryFromRate && !!rateFor(volume, f.arrangement_type) && (
              <button type="button" onClick={reapplyRate} className="text-[11px] font-bold underline-offset-2 hover:underline" style={{ color: "var(--primary)" }}>Tarifdan qayta olish</button>
            )}
          </div>
          <span className="mt-0.5 block text-[11.5px] font-semibold" style={{ color: florist ? "var(--text-2)" : "var(--muted)" }}>
            {!florist
              ? "Florist tanlanmagan — oylik yozilmaydi"
              : f.florist_salary_amount !== ""
                ? <>Florist oyligiga: {qtyTotal > 1 ? `${(+f.florist_salary_amount).toLocaleString("ru")} × ${qtyTotal} dona = ` : ""}<b style={{ color: "var(--acc)" }}>{fmt(+f.florist_salary_amount * qtyTotal)}</b></>
                : rateMissing
                  ? <>Bu florist uchun tarif yo&apos;q — qo&apos;lda kiriting · <button type="button" onClick={() => { if (typeof window !== "undefined") window.location.assign(`/floristlar?rateFor=${florist}`); }} className="font-bold underline-offset-2 hover:underline" style={{ color: "var(--primary)" }}>Tarif qo&apos;shish</button></>
                  : "Bo'sh — tarif topilsa avtomatik, aks holda oylik yozilmaydi"}
          </span>
          <Err k="florist_salary_amount" />
        </Field>

        {/* CHEGIRMA SABABI — komponent narxidan arzon sotilganda majburiy */}
        {(kind === "custom" || f.discount_reason) && (
          <Field label={needsDiscountReason ? "Chegirma sababi (majburiy)" : "Chegirma sababi"} span>
            <input
              className="inp"
              value={f.discount_reason}
              onChange={set("discount_reason")}
              placeholder="Masalan: Mijozga kelishilgan chegirma"
              style={needsDiscountReason && !f.discount_reason.trim() ? { borderColor: "var(--danger-ink)" } : undefined}
            />
            {needsDiscountReason && (
              <span className="mt-0.5 block text-[11.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>
                Narx komponent narxidan {fmt(price.discount)} arzon — sabab yozilishi shart
              </span>
            )}
            <Err k="discount_reason" />
          </Field>
        )}

        {/* Story havolasi — faqat STANDART katalogda (Maxsus/custom formadan olib tashlandi) */}
        {kind !== "custom" && <Field label="Story havolasi" span><input className="inp" value={f.instagram_story_url} onChange={set("instagram_story_url")} placeholder="Masalan: https://instagram.com/stories/…" /></Field>}
        <Field label="Rasm" span><ImageInput value={f.image_url} onChange={(url) => setF({ ...f, image_url: url })} /></Field>
      </div>

      {/* JONLI NARX PANELI (sticky) */}
      <div className="sticky bottom-0 z-10 -mx-6 mt-4 border-t px-6 pb-1 pt-3" style={{ borderColor: "var(--border)", background: "var(--surface-solid)" }}>
        <div className="grid grid-cols-2 gap-x-5 gap-y-1">
          <PriceLine label="Komponentlar narxi" value={price.componentPrice} />
          <PriceLine label="Tannarx" value={price.cost} />
          <PriceLine label="Sotuv narxi" value={price.sale} strong />
          {price.discount > 0 && <PriceLine label="Chegirma" value={price.discount} hue="var(--danger-ink)" />}
          {price.fee > 0 && <PriceLine label={kind === "custom" ? "Floristika xizmati" : "Florist haqi"} value={price.fee} />}
          {price.salary > 0 && florist > 0 && <PriceLine label="Florist oyligiga" value={price.salary} hue="var(--acc)" />}
          <PriceLine label="Taxminiy foyda" value={price.profit} hue={price.profit >= 0 ? "var(--success-ink, #3d8a5f)" : "var(--danger-ink)"} strong />
        </div>
        <p className="mt-1 text-[11px]" style={{ color: "var(--muted)" }}>
          {price.qty > 1 ? `${price.qty} dona uchun jami · ` : ""}Aniq qiymatni saqlagandan so&apos;ng backend hisoblaydi.
        </p>
        <div className="mt-3 flex justify-end gap-2.5 pb-2 max-sm:[&>*]:flex-1">
          <button onClick={onClose} className="btn-ghost">Bekor</button>
          <button onClick={save} disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Saqlanmoqda…" : item ? "Saqlash" : kind === "custom" ? "Sotildi deb yozish" : "Katalogga qo'shish"}</button>
        </div>
      </div>
    </Modal>
  );
}
