"use client";
import { AlertTriangle, Building2, CheckCircle2, Info, Plus, X } from "lucide-react";
import { batchTitle, batchTitleNoHeight, flowerName } from "@/lib/stockLabel";
import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { notifyReportDataChanged } from "@/lib/reportCache";
import { useStore } from "@/lib/store";
import { isBranchUser } from "@/lib/branch";
import Modal, { ModalHeader, Section, Field } from "./Modal";
import Select from "./Select";
import CustomerPicker, { customerPayload, type CustomerPick } from "./CustomerPicker";
import BackdateField from "./BackdateField";
import { backdatePayload, backdateEditPayload } from "@/lib/backdate";
import ImageInput from "./ImageInput";
import { Icon } from "./icons";
import { ARRANGEMENT_LABEL } from "./badges";
import { fmt } from "@/lib/format";
import { KIND_LABEL, PACKAGING_LABEL, VOLUME_LABEL, stems as stemsFmt, formatStemsAndBunches, normalizeComposition, normalizeMaterials, rateSalaryForCatalog, catalogRateMissing, rateToCatalogSalary, catalogSalaryPayload, catalogFlowRules, ratesForFlorist, batchDeliveryTag, buildFloristComposition, catalogClosed } from "@/lib/inventory";
import { usableInCatalog } from "@/lib/materialUnit";
import FloristCompositionPicker from "./FloristCompositionPicker";
import type { ArrangementType, Branch, CatalogItem, CatalogKind, CatalogVolume, FloristProfile, FloristVolumeRate, Packaging, PaymentType, StockBatch } from "@/lib/types";

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
  const [kind, setKind] = useState<CatalogKind>(item?.catalog_kind ?? "standard");
  const [volume, setVolume] = useState<CatalogVolume | "">(item?.volume ?? "");
  /**
   * ⚠️ `florist` IKKI XIL KELADI va bu tanlagichni buzardi:
   *      RO'YXAT javobi  → "Abror"  (ISM, satr)
   *      DETAL javobi    → 4        (id, son)
   * Tahrirlash oynasi RO'YXAT qatoridan ochiladi, ya'ni bu yerga ism tushardi —
   * `<Select value="Abror">` hech bir variantga mos kelmay, florist TANLANMAGAN
   * bo'lib ko'rinardi. Shu bois id DOIM `florist_detail.id` dan olinadi.
   */
  const floristId = (v: unknown, det?: { id?: number | null } | null): number =>
    typeof v === "number" ? v : det?.id ?? 0;
  const [florist, setFlorist] = useState<number>(floristId(item?.florist, item?.florist_detail));
  // OFORMLENIYA floristi — yasagandan ALOHIDA, ixtiyoriy. Haq = decoration_fee × quantity_total (backend yozadi).
  const [decorationFlorist, setDecorationFlorist] = useState<number>(floristId(item?.decoration_florist, item?.decoration_florist_detail));
  // ORQAGA SANA — create'da yig'iq (sukut bugun); TAHRIRda doim ochiq (mavjud sanadan boshlanadi).
  // ⚠️ Bu KATALOG YARATILGAN sana (created_at). SOTUV sanasi (sold_at) — ALOHIDA maydon, sotish oynasida.
  const [dateOn, setDateOn] = useState(false);
  const [createdAt, setCreatedAt] = useState(item ? (item.created_at ?? "").slice(0, 10) : "");
  // ⚠️ FILIAL — TO'G'RIDAN-TO'G'RI filial katalogi (spec FILIAL_UCHUN_KATALOG_QOSHISH).
  // 0 = asosiy filial (branch yuborilmaydi). Faqat ASOSIY foydalanuvchi + YANGI item'da.
  const branchUser = isBranchUser(useStore((s) => s.user?.profile.branch));
  const canPickBranch = !branchUser && !item; // tanlagich faqat asosiy foydalanuvchiga, yaratishda
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branch, setBranch] = useState<number>(0);
  const branchMode = branch > 0;
  // saqlangandan keyin (branch rejimida) natija kartasi — modal shu bilan ochiq qoladi
  const [branchResult, setBranchResult] = useState<{ branchName: string; qty: number; perUnit: number; total: number; name: string; sourcePrice: string | null } | null>(null);
  // operator florist haqini QO'LDA yozdimi — true bo'lsa auto-fill uni HECH QACHON bosib o'tmaydi.
  // ⚠️ MAVJUD item'ni tahrirlashda saqlangan qiymatni saqlash uchun boshlang'ich = haq bor-yo'qligi.
  const [salaryTouched, setSalaryTouched] = useState(!!item?.florist_salary_amount);
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
  // ⚠️ MAVJUD kompozitsiya qatorlari DONADA yuklanadi (ular absolyut dona qiymatini saqlaydi —
  // pochka'ga aylantirish sonni noto'g'ri talqin qilardi). Faqat YANGI/bo'sh qator POCHKA default'da.
  const [comp, setComp] = useState<CompRow[]>(
    item?.composition?.length ? item.composition.map((c) => ({ stock_batch: c.stock_batch, mode: "stems" as const, qty: String(c.quantity_stems) })) : [{ stock_batch: 0, mode: "bunches", qty: "" }]
  );
  const [mats, setMats] = useState<MatRow[]>(item?.materials?.length ? item.materials.map((m) => ({ packaging: m.packaging, qty: String(m.quantity) })) : []);
  // ⚠️ FLORIST katalogi: gul(lar) tanlanadi (soni EMAS). Kutayotgan (soni 0) itemni tahrirlashда
  // gullar prefill; yopilgan (soni > 0) item read-only (isFloristClosed). Yangi item → bo'sh.
  const [floristBatches, setFloristBatches] = useState<number[]>(
    item?.florist && item.composition?.length && !catalogClosed(item) ? item.composition.map((c) => c.stock_batch) : []
  );
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  // yetarli qoldiq yo'q — backend `detail` (ko'p qatorli) alohida holatda ko'rsatiladi
  const [stockError, setStockError] = useState<{ lines: string[]; batchId: number | null; shortage?: boolean } | null>(null);
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
    api.stockBatches({ is_active: true, page_size: "all" }).then((bs) => {
      const used = new Set((item?.composition ?? []).map((c) => c.stock_batch));
      const usable = bs.filter((b) => b.remaining_stems > 0 || used.has(b.id));
      setBatches(bs);
      setComp((c) => c.map((r) => ({ ...r, stock_batch: r.stock_batch || usable[0]?.id || 0 })));
    }).catch(() => showToast("Sklad partiyalarini yuklab bo'lmadi"));
    // ⚠️ §5: SARFLANADIGANLAR (Gupka/Lenta/Lak) katalogda ishlatilmaydi — tanlagichdan chiqarib tashlanadi.
    api.materials({ is_active: true, page_size: "all" }).then((ms) => setMaterials(usableInCatalog(ms))).catch(() => {});
    api.florists({ is_active: true, ordering: "user", page_size: "all" }).then(setFlorists).catch(() => {});
    // FILIALLAR — faqat asosiy foydalanuvchi + yangi item uchun (tanlagich shu holatda chiqadi).
    if (canPickBranch) api.branches({ is_main: false, is_active: true }).then(setBranches).catch(() => setBranches([]));
  }, [showToast, item, canPickBranch]);

  // TARIFLAR — TANLANGAN floristning FAOL tariflari (backend auto-to'ldirishi bilan
  // AYNAN bir manba: ?florist=<id>&is_active=true). Drift bo'lmasligi uchun shu yerdan.
  useEffect(() => {
    if (!florist) { setRates([]); return; }
    // ⚠️ SERVER `?florist=` filtrini e'tiborga OLMAYDI (hamma floristning tarifi keladi) —
    // klientda ajratamiz, aks holda «Tarifdan olindi» BOSHQA floristning summasini qo'yardi.
    api.floristVolumeRates({ florist, is_active: true })
      .then((raw) => setRates(ratesForFlorist(raw, florist)))
      .catch(() => setRates([]));
  }, [florist]);

  // FLORIST rejimi — katalog florist qo'lidagi gul(lar)dan yasaladi (soni chiqim yopilganda).
  const floristMode = florist > 0;
  // ⚠️ §8 (backend 20.08.2026) — MAXSUS (custom) KATALOG ENDI FLORIST BALANSIDAN YECHMAYDI.
  //    Custom'da real dona soni aniq kiritiladi, shuning uchun gul TO'G'RIDAN-TO'G'RI
  //    stock_batch qoldig'idan kamayadi — florist tanlangan bo'lsa HAM. Ya'ni
  //    «florist balansidan tanlash» oqimi (soni yo'q, chiqim yopilganda taqsimlanadi)
  //    FAQAT STANDART katalogda qoladi.
  // ⚠️ Qoidalar YAGONA joyda (lib/inventory: catalogFlowRules) — Vitest bilan qamralgan:
  //    volumeRequired (§9 hajm majburiy), stemsRequired (§8 soni majburiy), floristIssueMode.
  const { floristIssueMode, volumeRequired, stemsRequired } = catalogFlowRules(kind, florist, branch);
  // YOPILGAN florist katalogi (hamma qatorda soni > 0) — tarkib READ-ONLY (adjust bilan tuzatiladi).
  // Kutayotgan (soni 0) — gul o'zgartirilishi mumkin.
  const isFloristClosed = !!item && catalogClosed(item);
  // ⚠️ Florist ALMASHSA — tanlangan gul(lar) TOZALANADI (yangi floristda bo'lmasligi mumkin;
  //  hech qachon jimgina noto'g'ri tanlov saqlanmaydi).
  const prevFlorist = useRef(item?.florist ?? 0);
  useEffect(() => {
    if (florist !== prevFlorist.current) { setFloristBatches([]); prevFlorist.current = florist; }
  }, [florist]);
  // ⚠️ FILIAL rejimi florist katalogi EMAS — filial tanlansa floristni tozalab, warehouse-rejimga qaytaramiz.
  useEffect(() => {
    if (branchMode && florist) setFlorist(0);
    if (branchMode && decorationFlorist) setDecorationFlorist(0);
  }, [branchMode, florist, decorationFlorist]);

  // ⚠️ §8 — STANDART → MAXSUS almashtirilganda florist balansidan tanlangan gul(lar) YO'QOLMASIN:
  //    o'sha partiyalar sklad qatorlariga ko'chiriladi (soni bo'sh — operator kiritadi).
  useEffect(() => {
    if (kind !== "custom" || floristBatches.length === 0) return;
    setComp((rows) => {
      const filled = rows.filter((r) => r.stock_batch > 0 && (parseFloat(r.qty) || 0) > 0);
      const have = new Set(filled.map((r) => r.stock_batch));
      const added = floristBatches.filter((id) => id > 0 && !have.has(id)).map((id) => ({ stock_batch: id, mode: "stems" as const, qty: "" }));
      return added.length ? [...filled, ...added] : rows;
    });
  }, [kind, floristBatches]);

  // ⚠️ Operator xatoni TUZATGACH qizil banner turib qolmasin: gul/material qatorlari
  //    o'zgarishi bilan tegishli xato darrov so'nadi (saqlashni kutmaymiz).
  useEffect(() => {
    setErrs((x) => { if (!x.composition) return x; const n = { ...x }; delete n.composition; return n; });
  }, [comp]);
  useEffect(() => {
    setErrs((x) => { if (!x.materials) return x; const n = { ...x }; delete n.materials; return n; });
  }, [mats]);

  const batchOf = (id: number) => batches.find((b) => b.id === id);
  const matOf = (id: number) => materials.find((m) => m.id === id);
  const accessories = useMemo(() => materials.filter((m) => m.packaging_type === "other"), [materials]);
  const catalogMaterials = useMemo(() => materials.filter((m) => m.packaging_type !== "other"), [materials]);
  const spbOf = (id: number) => batchOf(id)?.stems_per_bunch || 1;
  // MAVJUD miqdor — sklad qoldig'idan (warehouse rejimi)
  const availOf = (id: number) => batchOf(id)?.remaining_stems ?? 0;
  const stemsOfRow = (r: CompRow) => {
    const n = parseFloat(r.qty) || 0;
    return r.mode === "bunches" ? Math.round(n * spbOf(r.stock_batch)) : Math.round(n);
  };
  // bitta partiyaga tegishli BARCHA qatorlar yig'indisi — warehouse over-validatsiya yig'indi bo'yicha
  const stemsForBatchNow = (batchId: number) => comp.reduce((s, r) => s + (r.stock_batch === batchId ? stemsOfRow(r) : 0), 0);

  // WAREHOUSE tanlagichi — faqat qoldig'i bor (yoki allaqachon tanlangan) partiyalar
  const usableBatches = useMemo(() => {
    const used = new Set(comp.map((r) => r.stock_batch));
    return batches.filter((b) => b.remaining_stems > 0 || used.has(b.id));
  }, [batches, comp]);
  const compOptions = useMemo(() => usableBatches.map((bb) => {
    const dtag = batchDeliveryTag(bb.delivery_detail); // ikki o'xshash partiyani ajratish
    return {
      value: bb.id,
      label: batchTitle(bb, ""),
      sub: `${formatStemsAndBunches(bb.remaining_stems, bb.stems_per_bunch)} · ${fmt(bb.sale_price_per_stem)}/dona${dtag ? ` · ${dtag}` : ""}`,
    };
  }), [usableBatches]);

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
    setComp([...comp, { stock_batch: +next, mode: "bunches", qty: "" }]); // yangi qator POCHKA default
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
  const addMaterial = () => {
    const used = new Set(mats.map((m) => m.packaging));
    const next = catalogMaterials.find((p) => !used.has(p.id));
    if (next) setMats([...mats, { packaging: next.id, qty: "1" }]);
  };
  const addAccessory = () => {
    const used = new Set(mats.map((m) => m.packaging));
    const next = accessories.find((p) => !used.has(p.id));
    if (next) setMats([...mats, { packaging: next.id, qty: "1" }]);
  };

  // TANLANGAN FLORISTNING hajm+turi uchun tarifini topadi (per-florist model).
  // Florist tanlanmasa tarif qidirilmaydi. Moslik faqat lib/inventory'da.
  const rateFor = (vol: CatalogVolume | "", arr: ArrangementType) =>
    rateSalaryForCatalog(rates, florist || null, vol, arr);
  // florist+hajm tanlangan, lekin mos FAOL tarif yo'q — operatorga aniq aytamiz + matritsaga yo'l.
  // ⚠️ Endi tarif YARATISHDA BLOKLAYDI (server volume 400): default_stems taqsimot og'irligi.
  const currentRate = rateFor(volume, f.arrangement_type);
  // ⚠️ FAQAT STANDART bloklanadi — custom'da haq qo'lda kiritiladi (spec §3)
  const rateMissing = catalogRateMissing(kind, florist, volume, f.arrangement_type, rates);
  // Florist haqi ENDI TAHRIRLANADI (har ikki rejim). effectiveSalary DOIM forma maydonidan.
  const effectiveSalary = +f.florist_salary_amount || 0;
  const selectedFlorist = florists.find((fp) => fp.id === florist);
  // OFORMLENIYA — tanlangan bezovchi floristning decoration_fee'si (× soni) — alohida oylik yozuvi (source=decoration).
  const decoFloristObj = florists.find((fp) => fp.id === decorationFlorist);
  const decoFee = Math.round(+(decoFloristObj?.decoration_fee ?? 0) || 0);
  const decoPay = decoFee * qtyTotal;
  const decoFeeMissing = decorationFlorist > 0 && decoFee <= 0;
  // maydondagi qiymat AYNAN tarifdagi summa (auto-fill'dan) — "Tarifdan olindi" belgisi uchun
  const salaryFromRate = !salaryTouched && !!currentRate && f.florist_salary_amount === rateToCatalogSalary(currentRate);

  // AVTO-FILL — florist/hajm/turi o'zgarganda florist haqini tarifdan oladi.
  // ⚠️ Operator QO'LDA yozgach (salaryTouched) HECH QACHON bosib o'tilmaydi; tarif yo'q → bo'shatiladi
  //    (aniq «tarif yo'q» holati). MAVJUD item tahrirlashda salaryTouched=true bilan boshlanadi → saqlanadi.
  useEffect(() => {
    if (salaryTouched) return;
    const rate = rateFor(volume, f.arrangement_type);
    setF((p) => ({ ...p, florist_salary_amount: rate ? rateToCatalogSalary(rate) : "" }));
  }, [volume, f.arrangement_type, florist, rates, salaryTouched]); // eslint-disable-line react-hooks/exhaustive-deps

  // «Tarifga qaytarish» — qo'lda yozilgandan keyin tarif qiymatini tiklaydi (auto-fill'ni qayta yoqadi).
  const reapplyRate = () => {
    if (!currentRate) return;
    setF((p) => ({ ...p, florist_salary_amount: rateToCatalogSalary(currentRate) }));
    setSalaryTouched(false);
  };

  // JONLI NARX (klient preview — server calculated_* bilan solishtiriladi)
  const price = useMemo(() => {
    const compPrice = comp.reduce((s, r) => { const b = batchOf(r.stock_batch); return s + (b ? Math.round(+(b.sale_price_per_stem ?? 0)) * stemsOfRow(r) : 0); }, 0);
    const compCost = comp.reduce((s, r) => { const b = batchOf(r.stock_batch); return s + (b ? Math.round(+(b.cost_per_stem ?? 0)) * stemsOfRow(r) : 0); }, 0);
    const matPrice = mats.reduce((s, m) => { const p = matOf(m.packaging); return s + (p ? Math.round(+(p.sale_price ?? 0)) * (+m.qty || 0) : 0); }, 0);
    const matCost = mats.reduce((s, m) => { const p = matOf(m.packaging); return s + (p ? Math.round(+(p.cost_price ?? 0)) * (+m.qty || 0) : 0); }, 0);
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
    // OYLIK: STANDART → hajm tarifidan, CUSTOM → qo'lda kiritilgan (effectiveSalary) × soni.
    // Katalogning florist_fee (mijozdan xizmat) OYLIKKA kirmaydi — bu alohida tushuncha.
    const salary = effectiveSalary * qtyTotal;
    return { componentPrice, cost, sale, fee: fee * qtyTotal, salary, discount: Math.max(0, componentPrice - sale), profit: sale - cost, qty: qtyTotal };
  }, [comp, mats, f.price, f.florist_fee, effectiveSalary, f.quantity_total, kind, qtyTotal, batches, materials]); // eslint-disable-line react-hooks/exhaustive-deps

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
    // FLORIST katalogi: hajm VA turi MAJBURIY (gul shu bo'yicha taqsimlanadi). Turi doim
    // qiymatga ega; hajm bo'sh bo'lishi mumkin → oldindan aniq aytamiz (server 400 ham beradi).
    if (volumeRequired && !volume) {
      const why = floristIssueMode
        ? "Florist katalogida hajmni tanlash kerak — gul shu bo'yicha taqsimlanadi"
        : kind === "standard"
          ? "Standart katalogda hajm majburiy — florist tarifi va hajm hisoboti shu bo'yicha yuritiladi"
          : "Florist tanlangan — oylik hajm tarifidan hisoblanadi, hajmni tanlang";
      setErrs((x) => ({ ...x, volume: why }));
      return showToast("Hajmni tanlang");
    }
    // ⚠️ §3 HAJM TARIFI YO'Q — backend 400 beradi ({volume: [...]}), shuning uchun SHU YERDA to'xtatamiz.
    if (rateMissing) {
      const who = selectedFlorist ? floristName(selectedFlorist) : "Bu florist";
      const vol = VOLUME_LABEL[volume as CatalogVolume] ?? volume;
      setErrs((x) => ({ ...x, volume: `${who} uchun «${vol}» hajm tarifi belgilanmagan — avval tarifni kiriting` }));
      return showToast(`${who} uchun «${vol}» hajm tarifi yo'q`);
    }
    // §9 STANDART florist katalogi: gul MAJBURIY (kutayotgan/yangi holatda; yopilgan read-only). Soni EMAS.
    if (floristIssueMode && !isFloristClosed && floristBatches.filter((id) => id > 0).length === 0) {
      setErrs((x) => ({ ...x, composition: "Floristga chiqarilgan qaysi guldan yasalganini tanlang" }));
      return showToast("Gulni tanlang");
    }
    // ⚠️ §2 MATERIAL SONI MAJBURIY (guldan farqli): material tanlangan bo'lsa soni > 0 shart.
    if (!compLocked && mats.some((m) => m.packaging > 0 && !(+m.qty > 0))) {
      setErrs((x) => ({ ...x, materials: "Material sonini kiriting (har dona uchun, 0 emas)" }));
      return showToast("Material sonini kiriting");
    }
    // ⚠️ §8 CUSTOM va FILIAL katalogi: gul SONI (quantity_stems) MAJBURIY — florist-chiqim
    //    oqimi yo'q, son darrov SKLAD partiyasidan yechiladi.
    if (stemsRequired && !compLocked && !comp.some((r) => r.stock_batch && stemsOfRow(r) > 0)) {
      setErrs((x) => ({
        ...x,
        composition: kind === "custom"
          ? "Maxsus katalogda gul va soni majburiy — gul to'g'ridan-to'g'ri skladdan yechiladi"
          : "Filial katalogida gul va soni majburiy — qaysi guldan necha dona ketishini kiriting",
      }));
      return showToast("Gul sonini kiriting");
    }
    // ⚠️ Tanlangan, ammo SONI YO'Q qator jimgina tushib qolmasin — aniq aytamiz.
    if (stemsRequired && !compLocked && comp.some((r) => r.stock_batch > 0 && stemsOfRow(r) <= 0)) {
      setErrs((x) => ({ ...x, composition: "Har bir tanlangan gulning sonini kiriting (0 emas)" }));
      return showToast("Gul sonini kiriting");
    }
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
      // OFORMLENIYA floristi — ixtiyoriy. decoration_salary_amount YUBORILMAYDI (read-only kabi:
      // backend decoration_fee × quantity_total ni O'ZI yozadi). Tozalash uchun tahrirlashda null yuboramiz.
      ...(!branchMode ? { decoration_florist: decorationFlorist || null } : {}),
      // ⚠️ FILIAL — branch>0 bo'lsa YUBORILADI (asosiy filial = 0 → kalit tushiriladi).
      // source_price YUBORILMAYDI — backend bir donaga tannarxni avtomatik yozadi (spec).
      ...(branch ? { branch } : {}),
      height_cm: +f.height_cm || null,
      price: String(+f.price),
      // ⚠️ Floristika xizmati (florist_fee) — FAQAT CUSTOM'da (standartda input olib tashlandi).
      ...(kind === "custom" ? { florist_fee: f.florist_fee ? String(+f.florist_fee) : undefined } : {}),
      // ⚠️ Florist haqi — STANDART hech qachon yubormaydi (tarifdan olinadi); CUSTOM: "0"≠bo'sh.
      // ⚠️ Florist haqi — HAR IKKI rejimda AYNAN yuboriladi (backend tarif bilan bosib o'tmaydi); "0"≠bo'sh.
      ...catalogSalaryPayload(f.florist_salary_amount),
      ...(f.discount_reason.trim() ? { discount_reason: f.discount_reason.trim() } : {}),
      ...(f.note.trim() ? { note: f.note.trim() } : {}),
      quantity_total: Math.max(+f.quantity_total || 1, 1),
      ...(kind === "custom" ? {} : { instagram_story_url: f.instagram_story_url }),
      description_uz: f.description_uz,
      image_url: f.image_url,
      // ⚠️ STANDART florist katalogi: composition = FAQAT gul (stock_batch), quantity_stems
      // YUBORILMAYDI (u 0 bo'lib turadi, chiqim yopilganda hisoblanadi).
      // ⚠️ §8 CUSTOM (florist tanlangan bo'lsa ham) va warehouse rejimi: composition SONI BILAN
      // yuboriladi — bir xil stock_batch qatorlari normalizeComposition bilan BITTAGA jamlanadi.
      // Yopilgan florist katalogi (read-only) tahrirlansa — composition TEGILMAYDI (server saqlaydi).
      ...(compLocked ? {} : { materials: materialsPayload }),
      ...(!compLocked && !(floristIssueMode && isFloristClosed)
        ? { composition: floristIssueMode ? buildFloristComposition(floristBatches) : composition }
        : {}),
      // MIJOZ — FAQAT CUSTOM'da (standartda bo'lim olib tashlandi; mijoz sotuv paytida biriktiriladi).
      // existing→{customer}, new→{customer_name,customer_phone}, tozalash→{customer:null}
      ...(kind === "custom" ? (customerPayload(cust, hadCustomer) ?? {}) : {}),
      // ⚠️ SANA — create: bugun bo'lsa kalit YO'Q; tahrir: FAQAT o'zgargan bo'lsa
      ...(item ? backdateEditPayload(item.created_at, createdAt) : backdatePayload(dateOn ? createdAt : "")),
    };
    // maxsus: mijoz do'konda tanladi → sotilgan sifatida yoziladi; to'lov turi shu paytda
    if (kind === "custom" && !item) { payload.status = "sold"; payload.payment_type = payment; }
    else if (!item) payload.status = "available";
    try {
      const saved = await (item ? api.updateCatalogItem(item.id, payload) : api.createCatalogItem(payload));
      // DIQQAT: create javobida calculated_*/discount_amount 0 keladi (kompozitsiya
      // keyin saqlanadi, GET'da to'g'ri qiymat chiqadi). Shu bois preview'ga tayanamiz
      // — preview matematikasi endi backend bilan aynan mos (fee ham qo'shilgan).
      notifyReportDataChanged(); // katalog tannarxi/tarkibi o'zgardi → hisobot keshi + mount sahifalar
      onSaved();
      // ⚠️ §3 FILIAL rejimi: modalni YOPMAYMIZ — natija kartasi ko'rsatiladi (item asosiy
      // ro'yxatda ko'rinmaydi, shuning uchun operator nima yaratilганini bir zumda ko'rsin).
      if (branchMode) {
        const branchName = branches.find((b) => b.id === branch)?.name ?? "filial";
        showToast(`✓ Katalog ${branchName} filialiga qo'shildi`);
        setBranchResult({ branchName, qty: qtyTotal, perUnit: perUnitStems, total: perUnitStems * qtyTotal, name: f.name_uz, sourcePrice: saved?.source_price ?? null });
        setBusy(false);
        return;
      }
      const disc = price.discount;
      showToast(item ? "✓ Katalog yozuvi yangilandi" : `✓ Katalogga qo'shildi${disc > 0 ? ` · chegirma ${fmt(disc)}` : ""}`);
      onClose();
    } catch (e) {
      // backend `detail` MASSIV yoki KO'P QATORLI string bo'lishi mumkin — bitta matnga yig'amiz.
      // (Florist-balans yetishmovchilik xatosi ENDI CHIQMAYDI — florist katalogi composition
      // yubormaydi; qolgan sklad-yetishmovchilik warehouse rejimida ishlaydi.)
      const rawDetail = e instanceof ApiError && e.body && typeof e.body === "object" && "detail" in e.body ? (e.body as { detail: unknown }).detail : null;
      const detail = Array.isArray(rawDetail) ? rawDetail.join("\n") : rawDetail != null ? String(rawDetail) : null;
      // Yetishmovchilik belgilari — FAQAT sarlavha/affordance uchun. O'qiladigan blok
      // HECH QACHON shu mos kelishga bog'lanmaydi (backend matni o'zgarsa ham AYNAN chiqadi).
      const stockText = [detail, e instanceof ApiError ? e.message : null, ...(e instanceof ApiError && e.fieldErrors ? Object.values(e.fieldErrors) : [])]
        .find((s) => s && /(yetarli qoldiq|yetarli emas|yetmayapti|qoldiq yo|dona bor|kerak)/i.test(s)) || null;
      if (detail) {
        const all = detail.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        const labeled = all.filter((l) => l.includes(":"));
        const lines = labeled.length ? labeled : all;
        // aybdor partiyani topamiz — matnda partiya raqami yoki gul nomi bo'lsa (warehouse, best-effort)
        const off = comp.find((r) => { const b = batchOf(r.stock_batch); return b?.batch_number && detail.includes(b.batch_number); })
          ?? comp.find((r) => { const nm = flowerName(batchOf(r.stock_batch)); return nm && detail.includes(nm); });
        setStockError({ lines, batchId: off?.stock_batch ?? null, shortage: !!stockText });
        showToast(stockText ? "Skladda yetarli qoldiq yo'q" : (e instanceof ApiError ? e.message : "Saqlab bo'lmadi"));
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
  // §3 filial natija kartasi qatori (k → v), ixtiyoriy tooltip + qiymat rangi
  const ResultRow = ({ k, v, hue, title }: { k: string; v: string; hue?: string; title?: string }) => (
    <div className="flex items-start justify-between gap-3 border-t px-3 py-2 first:border-t-0 text-[12.5px]" style={{ borderColor: "var(--line2)" }} title={title}>
      <span className="shrink-0" style={{ color: "var(--muted)" }}>{k}{title ? " ⓘ" : ""}</span>
      <span className="text-right font-semibold tabular-nums" style={{ color: hue ?? "var(--text)" }}>{v}</span>
    </div>
  );

  // ⚠️ §3 FILIAL NATIJA KARTASI — saqlangandan keyin (branch rejimi). Item asosiy ro'yxatda
  // KO'RINMAGANI uchun operator nima yaratilганini, qancha gul yechilганini va qayoqqa ketганини ko'radi.
  if (branchResult) {
    const r = branchResult;
    return (
      <Modal onClose={onClose} width={520}>
        <ModalHeader icon={<CheckCircle2 size={20} strokeWidth={2} />} title="Filialga qo'shildi" sub={r.branchName} onClose={onClose} />
        <div className="mt-1 flex items-start gap-2 rounded-[13px] px-3.5 py-3 text-[13px] font-bold" style={{ background: "var(--mint, rgba(61,138,95,.12))", color: "var(--success-ink, #3d8a5f)" }}>
          <CheckCircle2 size={18} strokeWidth={2.2} className="mt-px shrink-0" />
          <span>Katalog <b>{r.branchName}</b> filialiga qo&apos;shildi.</span>
        </div>
        <div className="mt-3 flex flex-col rounded-[13px] border" style={{ borderColor: "var(--border)" }}>
          <ResultRow k="Katalog" v={`${r.name} · ${r.qty} dona`} />
          <ResultRow k="Skladdan yechildi" v={`${stemsFmt(r.perUnit)} × ${r.qty} dona = ${stemsFmt(r.total)}`} hue="var(--acc)" />
          {r.sourcePrice != null && +r.sourcePrice > 0 && (
            <ResultRow k="Kelib chiqish narxi" v={`${fmt(r.sourcePrice)} / dona`} title="Bir donaga to'g'ri keladigan tannarx — filial hisobotidagi ustama (sotuv − kelib chiqishi) shundan hisoblanadi." />
          )}
          <ResultRow k="Qayerda" v="Asosiy ro'yxatda ko'rinmaydi — filial foydalanuvchisi ko'radi va sotadi." />
        </div>
        <div className="mt-5 flex justify-end gap-2.5 max-sm:[&>*]:flex-1">
          <button onClick={onClose} className="btn-ghost">Yopish</button>
          <button onClick={() => { if (typeof window !== "undefined") window.location.assign("/filial-hisoboti"); }} className="btn-primary">Filial hisobotini ochish</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} width={640}>
      <ModalHeader icon={<Icon name="katalog" />} title={item ? "Katalog yozuvini tahrirlash" : "Katalog yaratish"} sub={item ? `${item.name_uz} · #${item.id}` : "Standart yoki maxsus kompozitsiya"} onClose={onClose} />

      {/* ⚠️ §1 QAYSI FILIAL UCHUN — formaning ENG TEPASIDA (item qayoqqa ketishini belgilaydi).
          Faqat ASOSIY foydalanuvchi + YANGI item + non-main filial(lar) mavjud bo'lsa. */}
      {canPickBranch && branches.length > 0 && (
        <div className="mt-1">
          <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold" style={{ color: "var(--text-2)" }}>
            <Building2 size={14} strokeWidth={2.2} style={{ color: "var(--primary)" }} /> Qaysi filial uchun
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[{ id: 0, name: "Asosiy filial" }, ...branches].map((b) => (
              <button key={b.id} type="button" onClick={() => setBranch(b.id)} aria-pressed={branch === b.id}
                className="rounded-[11px] border-[1.5px] px-3.5 py-1.5 text-[12.5px] font-bold transition-colors duration-150"
                style={branch === b.id ? { background: "var(--primary)", borderColor: "var(--primary)", color: "#fff" } : { borderColor: "var(--border)", color: "var(--text-2)" }}>
                {b.name}
              </button>
            ))}
          </div>
          {branchMode && (
            <div className="mt-2 flex items-start gap-1.5 rounded-[11px] px-3 py-2 text-[12px] font-semibold" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
              <Info size={13} strokeWidth={2.2} className="mt-px shrink-0" style={{ color: "var(--muted)" }} />
              <span>Bu katalog <b>{branches.find((b) => b.id === branch)?.name}</b> filialiga qo&apos;shiladi va asosiy ro&apos;yxatda ko&apos;rinmaydi.</span>
            </div>
          )}
        </div>
      )}

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
          {/* ⚠️ FLORIST rejimida QUTI (box) YO'Q: tarif enum'i box'ni qabul qilmaydi (E15Enum
              = bouquet/basket) → box florist katalogini YOPIB BO'LMAYDI. Warehouse'da uchtasi ham bor. */}
          <Select value={f.arrangement_type} onChange={(v) => { const a = v as ArrangementType; setF((p) => ({ ...p, arrangement_type: a })); setErrs((x) => { const n = { ...x }; delete n.arrangement_type; return n; }); }} options={(floristIssueMode ? (["bouquet", "basket"] as const) : (["bouquet", "basket", "box"] as const)).map((t) => ({ value: t, label: ARRANGEMENT_LABEL[t] }))} />
          <Err k="arrangement_type" />
        </Field>
        <Field label={volumeRequired ? "Hajm (majburiy)" : "Hajm"}>
          <Select value={volume} onChange={(v) => { const vol = v as CatalogVolume | ""; setVolume(vol); setErrs((x) => { const n = { ...x }; delete n.volume; return n; }); }} placeholder="Tanlang" options={[{ value: "", label: "—" }, ...(["small", "medium", "large"] as const).map((v) => ({ value: v, label: VOLUME_LABEL[v] }))]} />
          <Err k="volume" />
        </Field>
        {/* ⚠️ FILIAL rejimida FLORIST YO'Q — filial katalogi florist katalogi emas (chiqim yopish
            bosqichi yo'q); gul to'g'ridan-to'g'ri asosiy skladdan yechiladi. */}
        {branchMode ? (
          <Field label="Florist">
            <div className="flex h-[42px] items-center rounded-[11px] px-3 text-[12px] font-semibold" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>
              Filial katalogi — florist tanlanmaydi (gul skladdan)
            </div>
          </Field>
        ) : (
          <Field label="Florist">
            <Select value={florist} onChange={(v) => setFlorist(+v)} placeholder="Tanlang" options={[{ value: 0, label: "—" }, ...florists.map((fp) => ({ value: fp.id, label: floristName(fp) }))]} />
          </Field>
        )}
        {/* OFORMLENIYA floristi — yasagandan ALOHIDA, ixtiyoriy. Filial rejimida yo'q. */}
        {!branchMode && (
          <Field label="Oformleniya floristi" span>
            <Select value={decorationFlorist} onChange={(v) => setDecorationFlorist(+v)} placeholder="Tanlang" options={[{ value: 0, label: "— (tanlanmasa haq yozilmaydi)" }, ...florists.map((fp) => ({ value: fp.id, label: floristName(fp), sub: Math.round(+(fp.decoration_fee ?? 0)) > 0 ? `${fmt(fp.decoration_fee)} / dona` : "narx belgilanmagan" }))]} />
            {decorationFlorist === 0 ? (
              <span className="mt-1 block text-[11.5px]" style={{ color: "var(--muted)" }}>Ixtiyoriy — tanlanmasa oformleniya uchun haq yozilmaydi.</span>
            ) : decoFeeMissing ? (
              <span className="mt-1 flex flex-wrap items-center gap-1 text-[11.5px] font-semibold" style={{ color: "var(--warning-ink, #8a6d1f)" }}>
                ⚠ Bu floristda oformleniya narxi belgilanmagan.
                <a href={`/floristlar/${decorationFlorist}`} target="_blank" rel="noreferrer" className="underline" style={{ color: "var(--primary)" }}>Profilda belgilash</a>
              </span>
            ) : (
              <span className="mt-1 block text-[11.5px] font-semibold" style={{ color: "var(--text-2)" }}>
                Oformleniya haqi: {decoFee.toLocaleString("ru")} × {qtyTotal} dona = <b style={{ color: "var(--acc)" }}>{fmt(decoPay)}</b>
              </span>
            )}
          </Field>
        )}
        <Field label={kind === "custom" ? "Soni" : "Soni (nechta bir xil tayyorlandi)"} span>
          <input className="inp" type="number" min={1} value={f.quantity_total} onChange={set("quantity_total")} placeholder="Masalan: 1" />
          {/* ⚠️ §2 SKLADDAN YECHILADIGAN GUL — filial rejimida (yoki standart) doim ko'rsatiladi:
              operator saqlashdan oldin AYNAN shu sonni ko'radi (30 × 2 = 60 dona). */}
          {!floristIssueMode && perUnitStems > 0 && (
            <p className="mt-1 text-[11.5px] font-semibold" style={{ color: "var(--text-2)" }}>
              {qtyTotal} dona × {stemsFmt(perUnitStems)} gul = <b style={{ color: "var(--acc)" }}>{stemsFmt(qtyTotal * perUnitStems)}</b> skladdan yechiladi
            </p>
          )}
          {/* ⚠️ §1 SON TAHRIRI: kutayotgan florist katalogda bemalol; yopilgandan keyin oshirish gul talab qiladi. */}
          {item && floristIssueMode && (
            isFloristClosed ? (
              <p className="mt-1 text-[11.5px] font-semibold" style={{ color: "var(--warning-ink, #8a6d1f)" }}>
                Chiqim yopilgan — sonni <b>oshirsangiz gul kerak bo&apos;ladi</b>. Avval floristga gul chiqaring yoki «To&apos;g&apos;rilash» (adjust).
              </p>
            ) : (
              <p className="mt-1 text-[11.5px] font-semibold" style={{ color: "var(--text-2)" }}>
                Chiqim yopilmagan — sonni <b>bemalol o&apos;zgartirasiz</b>, gul yopilganda shu songa qarab taqsimlanadi.
              </p>
            )
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

        {/* ⚠️ SANA (created_at) — katalog YARATILGAN kun. Sotuv sanasi EMAS (u sotish oynasida, sold_at).
            Tahrirda doim ochiq: mavjud sana ko'rinib tursin va o'zgartirilsa oqibati aytilsin. */}
        <Field label="Sana" span>
          <BackdateField
            value={createdAt} onChange={setCreatedAt} open={dateOn} onOpenChange={setDateOn}
            always={!!item}
            label="Sana" toggleTitle="Boshqa sana (ish qolib ketgan bo'lsa)"
            retroNote={item
              ? "Katalog, tarix yozuvi VA floristning ish haqi sanasi birga siljiydi. Sotuv sanasi (sold_at) o'zgarmaydi."
              : "Katalog, tarix yozuvi VA floristning ish haqi sanasi o'sha kunga tushadi. Sotuv sanasi (sold_at) alohida."}
          />
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
              <div className="text-[13px] font-bold" style={{ color: "var(--danger-ink)" }}>{!stockError.shortage ? "Saqlab bo'lmadi" : stockError.lines.some((l) => /material/i.test(l)) ? "Material qoldig'i yetarli emas" : floristIssueMode ? "Florist qo'lida yetarli gul yo'q" : "Skladda yetarli qoldiq yo'q"}</div>
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
              {/* ⚠️ §1 YOPILGAN florist katalog sonini oshirdi → gul yetmadi. IKKI YECHIM: gul chiqarish yoki adjust. */}
              {stockError.shortage && floristIssueMode ? (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button type="button" onClick={() => { if (typeof window !== "undefined") window.location.assign(`/floristlarga-chiqarilgan?florist=${florist}`); }} className="rounded-full border px-3 py-1 text-[12px] font-bold transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--danger-ink)", color: "var(--danger-ink)" }}>Floristga gul chiqarish →</button>
                  <button type="button" onClick={() => { if (typeof window !== "undefined") window.location.assign(`/floristlarga-chiqarilgan?tab=balanslar`); }} className="rounded-full border px-3 py-1 text-[12px] font-bold transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--border-strong)", color: "var(--text-2)" }}>Hisobni to&apos;g&apos;rilash (adjust) →</button>
                </div>
              ) : stockError.shortage && stockError.batchId != null ? (
                <button
                  type="button"
                  onClick={() => { if (typeof window !== "undefined") window.location.assign(`/sklad?tab=partiyalar&batch=${stockError.batchId}`); }}
                  className="mt-2.5 rounded-full border px-3 py-1 text-[12px] font-bold transition-colors duration-150 hover:bg-[var(--hover)]"
                  style={{ borderColor: "var(--danger-ink)", color: "var(--danger-ink)" }}
                >
                  Partiyani ochish
                </button>
              ) : null}
            </div>
            <button type="button" onClick={() => setStockError(null)} className="icon-btn !h-7 !w-7 shrink-0" aria-label="Yopish"><X size={14} strokeWidth={2} /></button>
          </div>
        </div>
      )}

      {/* GULLAR — STANDART florist katalogida gul TANLANADI, SONI EMAS (chiqim yopilganda
          taqsimlanadi). Warehouse/filial VA §8 bo'yicha MAXSUS (custom) katalogda esa gul
          skladdan soni bilan tanlanadi. */}
      {floristIssueMode ? (
        <>
          <Section>Gullar (florist qo&apos;lidan)</Section>
          {isFloristClosed ? (
            // YOPILGAN katalog — gul allaqachon taqsimlangan, tarkib READ-ONLY (adjust bilan tuzatiladi)
            <div className="rounded-[14px] border p-3.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
              <p className="text-[12.5px] font-semibold">Chiqim yopilgan — gul taqsimlangan, tarkib faqat ko&apos;rish uchun.</p>
              <div className="mt-2 flex flex-col gap-1">
                {(item?.composition ?? []).map((c) => (
                  <div key={c.stock_batch} className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="truncate">{batchTitleNoHeight(c.batch_detail, `Partiya #${c.stock_batch}`)}</span>
                    <span className="shrink-0 tabular-nums" style={{ color: "var(--text-2)" }}>{c.quantity_stems} dona</span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11.5px]" style={{ color: "var(--muted)" }}>Sonlarni tuzatish kerak bo&apos;lsa «Kimda qancha gul bor» dagi <b>To&apos;g&apos;rilash</b> (adjust) amalidan foydalaning.</p>
            </div>
          ) : (
            // KUTAYOTGAN/YANGI — gul(lar) tanlanadi (soni EMAS); butun mantiq FloristCompositionPicker'da
            <FloristCompositionPicker florist={florist} value={floristBatches} onChange={(ids) => { setFloristBatches(ids); setErrs((x) => { const n = { ...x }; delete n.composition; return n; }); }} error={errs.composition} />
          )}
          {rateMissing && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-[12px] px-3 py-2.5 text-[12px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>
              {/* ⚠️ §0b: tarif YARATISHDA bloklaydi (server volume 400). Florist+hajmni ATAB, matritsaga yo'l. */}
              <span>
                <b>{selectedFlorist ? floristName(selectedFlorist) : "Bu florist"}</b> uchun <b>{VOLUME_LABEL[volume as CatalogVolume] ?? volume}</b> hajm tarifi belgilanmagan — katalog saqlanmaydi. Avval shu hajm narxini kiriting.
                {/* ⚠️ SHOGIRD — tariflari kunlik haq sababli avtomatik nofaol; sababini aytamiz, aks holda
                    operator tarif qo'shib ham nega ishlamayotganini tushunmaydi. */}
                {selectedFlorist?.staff_type === "apprentice" && (
                  <span className="mt-1 block font-medium">
                    Bu xodim <b>shogird</b> — shogird kunlik haq oladi va hajm tariflari nofaol bo&apos;ladi.
                    Standart katalogni tarifi bor floristga yozing, yoki uni floristga o&apos;tkazib tarif kiriting.
                  </span>
                )}
              </span>
              <button type="button" onClick={() => { if (typeof window !== "undefined") window.location.assign(`/floristlar/${florist}#rates`); }} className="shrink-0 rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--danger-ink)" }}>Tarif qo&apos;shish →</button>
            </div>
          )}
        </>
      ) : (
      <>
      <Section>Gullar (skladdan)</Section>
      {/* ⚠️ §8 — MAXSUS katalogda florist tanlangan bo'lsa ham gul SKLADDAN yechiladi.
          Operator buni saqlashdan OLDIN bilishi shart: standart katalogda xuddi shu tanlov
          floristning balansidan yechilardi, custom'da esa balansga TEGILMAYDI. */}
      {kind === "custom" && floristMode && !compLocked && (
        <div className="mb-2 flex items-start gap-1.5 rounded-[11px] px-3 py-2 text-[12px] font-semibold" style={{ background: "var(--primary-soft, var(--surface-2))", color: "var(--text-2)" }}>
          <Info size={13} strokeWidth={2.2} className="mt-px shrink-0" style={{ color: "var(--primary)" }} />
          <span>
            Maxsus katalog — gul <b>to&apos;g&apos;ridan-to&apos;g&apos;ri skladdan</b> yechiladi, florist balansiga tegilmaydi.
            Har bir gulning <b>soni majburiy</b>, florist ish haqi esa qo&apos;lda kiritiladi.
          </span>
        </div>
      )}
      {compLocked ? (
        <div className="rounded-[13px] bg-mint px-3.5 py-2.5 text-[12.5px] font-semibold text-mintink">✓ Sotuv boshlangan — tarkib o&apos;zgartirilmaydi.</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {comp.map((r, i) => {
            const b = batchOf(r.stock_batch);
            const st = stemsOfRow(r);
            const avail = availOf(r.stock_batch);
            // validatsiya SHU partiyaga tegishli BARCHA qatorlar yig'indisi bo'yicha (sklad qoldig'i)
            const over = r.stock_batch > 0 ? stemsForBatchNow(r.stock_batch) > avail : false;
            const under = b ? st > 0 && st < b.minimum_sale_stems : false;
            const sub = b ? Math.round(+(b.sale_price_per_stem ?? 0)) * st : 0;
            const spb = spbOf(r.stock_batch);
            const flashing = flashBatch != null && r.stock_batch === flashBatch;
            const offending = stockError?.batchId != null && r.stock_batch === stockError.batchId;
            return (
              <div
                key={i}
                className="rounded-[13px] border p-2.5 transition-colors duration-300"
                style={{
                  borderColor: offending ? "var(--danger-ink)" : over || under ? "color-mix(in srgb, #b3873a 45%, var(--border))" : "var(--border)",
                  background: flashing ? "color-mix(in srgb, var(--primary) 12%, transparent)" : offending ? "var(--danger-soft, rgba(160,74,74,.10))" : undefined,
                  boxShadow: flashing ? "inset 0 0 0 1.5px var(--primary)" : undefined,
                }}
              >
                {/* ⚠️ MOBIL (375px): tanlagich alohida qatorga tushadi — aks holda 4 ta ustun
                    sig'may, qator gorizontal toshib ketardi (o'lchangan: +203px). */}
                {/* ⚠️ MOBIL (≤420px): FLEX-WRAP — tanlagich butun qatorni egallaydi, «Dona/Pochka»,
                    soni va o'chirish keyingi qatorga tushadi. Grid'da 4 ustun sig'may, qator
                    gorizontal toshib ketardi (o'lchangan: +203px). */}
                <div className="flex flex-wrap items-center gap-2 sm:grid sm:grid-cols-[1fr_auto_72px_32px]">
                  <div className="w-full min-w-0 sm:w-auto"><Select searchable value={r.stock_batch} onChange={(v) => setBatchAt(i, +v)} options={compOptions} placeholder="Gulni tanlang" /></div>
                  <button type="button" onClick={() => setComp(comp.map((x, j) => (j === i ? { ...x, mode: x.mode === "stems" ? "bunches" : "stems" } : x)))} className="shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold" style={{ borderColor: "var(--border)", color: "var(--text-2)" }} title="Dona/Pochka">
                    {r.mode === "stems" ? "Dona" : "Pochka"}
                  </button>
                  <input className="inp !py-1.5 w-[72px] flex-1 sm:w-auto sm:flex-none" type="number" value={r.qty} onChange={(e) => setComp(comp.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} placeholder={r.mode === "stems" ? "25" : "1"} />
                  <button type="button" onClick={() => setComp(comp.length > 1 ? comp.filter((_, j) => j !== i) : comp)} className="icon-btn icon-btn-danger !h-8 !w-8 shrink-0" title="Olib tashlash"><X size={15} strokeWidth={1.75} /></button>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11.5px]">
                  <span style={{ color: over || under ? "#b3873a" : "var(--muted)" }}>
                    {r.mode === "bunches" && r.stock_batch > 0 ? `${r.qty || 0} × ${spb} = ${st} dona · ` : ""}
                    {over
                      ? `Qoldiqdan ko'p (${formatStemsAndBunches(avail, spb)})`
                      : under
                        ? `Min. ${b?.minimum_sale_stems} dona`
                        : r.stock_batch > 0
                          ? `${formatStemsAndBunches(avail, spb)} bor`
                          : ""}
                  </span>
                  {sub > 0 && <span className="font-semibold" style={{ color: "var(--acc)" }}>{fmt(sub)}</span>}
                </div>
              </div>
            );
          })}
          <button type="button" onClick={addComp} className="btn-secondary btn-sm self-start">
            <Plus size={15} strokeWidth={1.75} /> Yana gul
          </button>
          {/* ⚠️ §8 — xato TOAST bilan birga SHU YERDA ham turadi: soni kiritilmagan qator
              qaysi bo'limda ekani ko'rinib tursin (toast 4 soniyada yo'qoladi). */}
          <Err k="composition" />
        </div>
      )}
      </>
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
          {/* ⚠️ §2: son HAR BITTA DONAGA (server × quantity_total qiladi); gulから farqli MAJBURIY; darrov yechiladi. */}
          <p className="-mt-1 mb-1 text-[11.5px]" style={{ color: "var(--muted)" }}>
            Son — <b>har bitta dona</b> katalogga ketadigan miqdor (jami = son × {qtyTotal} dona, skladdan <b>darrov</b> yechiladi).
          </p>
          <div className="flex flex-col gap-2.5">
            {mats.map((m, i) => {
              const p = matOf(m.packaging);
              const sub = p ? Math.round(+(p.sale_price ?? 0)) * (+m.qty || 0) : 0;
              // ⚠️ §3: skladdan yechiladigan HAQIQIY miqdor = son × quantity_total (backend ko'paytiradi).
              const need = (+m.qty || 0) * qtyTotal;
              const overMat = p ? need > p.quantity : false;
              const flashing = flashMat != null && m.packaging === flashMat;
              return (
                <div
                  key={i}
                  className="rounded-[13px] p-1.5 transition-colors duration-300"
                  style={{ background: flashing ? "color-mix(in srgb, var(--primary) 12%, transparent)" : undefined, boxShadow: flashing ? "inset 0 0 0 1.5px var(--primary)" : undefined }}
                >
                  <div className="grid grid-cols-[1fr_72px_32px] items-center gap-2">
                    <div className="min-w-0"><Select value={m.packaging} onChange={(v) => setMatAt(i, +v)} options={Array.from(matGroups.entries()).flatMap(([g, list]) => list.map((pk) => ({ value: pk.id, label: pk.name_uz, sub: `${PACKAGING_LABEL[g as keyof typeof PACKAGING_LABEL] ?? g} · ${pk.quantity} dona bor` })))} /></div>
                    <input className="inp !py-1.5" type="number" value={m.qty} onChange={(e) => setMats(mats.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} placeholder="1" />
                    <button type="button" onClick={() => setMats(mats.filter((_, j) => j !== i))} className="icon-btn icon-btn-danger !h-8 !w-8" title="Olib tashlash"><X size={15} strokeWidth={1.75} /></button>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 px-0.5 text-[11.5px]">
                    <span style={{ color: overMat ? "#b3873a" : "var(--muted)" }}>
                      {p ? (
                        overMat
                          ? `${m.qty || 0} × ${qtyTotal} = ${need} dona kerak — qoldiqdan ko'p (${p.quantity} dona)`
                          : <>{m.qty || 0} × {qtyTotal} = <b style={{ color: "var(--text-2)" }}>{need}</b> dona skladdan yechiladi · {p.quantity} bor</>
                      ) : ""}
                    </span>
                    {sub > 0 && <span className="shrink-0 font-semibold" style={{ color: "var(--acc)" }}>{fmt(sub)}</span>}
                  </div>
                </div>
              );
            })}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={addMaterial} disabled={!catalogMaterials.length} className="btn-secondary btn-sm self-start disabled:opacity-50">
                <Plus size={15} strokeWidth={1.75} /> Material qo&apos;shish
              </button>
              <button type="button" onClick={addAccessory} disabled={!accessories.length} className="btn-secondary btn-sm self-start disabled:opacity-50" style={{ borderColor: "var(--primary)", color: "var(--primary)" }}>
                <Plus size={15} strokeWidth={1.75} /> Aksessuar qo&apos;shish
              </button>
            </div>
          </div>
        </>
      )}

      {/* MIJOZ — FAQAT CUSTOM'da (standart katalog sotuv emas; mijoz sotuv paytida biriktiriladi). */}
      {kind === "custom" && (
        <>
          <Section>Mijoz</Section>
          <div className="mb-1">
            <CustomerPicker value={cust} onChange={setCust} label={!item ? "Mijoz (ixtiyoriy — kim sotib oldi)" : "Mijoz (ixtiyoriy)"} />
          </div>
        </>
      )}

      <Section>Narx va tavsif</Section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Sotuv narxi (so'm)"><input className="inp" type="number" value={f.price} onChange={set("price")} placeholder="Masalan: 850000" /><Err k="price" /></Field>
        {/* MIJOZDAN olinadigan floristika XIZMATI — FAQAT CUSTOM (standartda olib tashlandi). */}
        {kind === "custom" && (
          <Field label="Floristika xizmati (mijozdan)">
            <input className="inp" type="number" value={f.florist_fee} onChange={(e) => setF({ ...f, florist_fee: e.target.value })} placeholder="Masalan: 50000" />
            <span className="mt-0.5 block text-[11px] font-medium" style={{ color: "var(--muted)" }}>
              Mijozdan olinadi — foydaga kiradi, oylikka QO&apos;SHILMAYDI
            </span>
            <Err k="florist_fee" />
          </Field>
        )}

        {/* ⚠️ §3 FLORIST HAQI — STANDART: faqat KO'RSATILADI (hajm tarifidan; backend qo'lda kiritilganni
            qabul qilmaydi). CUSTOM: tahrirlanadi (ish hajmi oldindan noma'lum, operator kiritadi). */}
        {(kind === "custom" || florist > 0) && (
          <Field label={kind === "custom" ? "Florist ish haqi (oylikka)" : "Florist ish haqi (tarifdan)"}>
            {kind === "custom" ? (
              <input
                className="inp"
                type="number"
                value={f.florist_salary_amount}
                onChange={(e) => { setSalaryTouched(true); setF({ ...f, florist_salary_amount: e.target.value }); }}
                placeholder="Masalan: 50000"
              />
            ) : (
              // ⚠️ O'ZGARTIRIB BO'LMAYDIGAN MATN — summa TARIFDAN keladi va u YERDA o'zgartiriladi.
              // Jonli tekshiruv (2026-08-04): OpenAPI `florist_salary_amount` ni yoziladigan deb
              // ko'rsatadi, ammo standart katalogda server baribir hajm tarifidan qo'yadi —
              // shuning uchun maydon QAYTA OCHILMADI (qiymati jimgina yo'qoladigan input —
              // umuman yo'qidan battar).
              <div className="inp flex items-center" style={{ background: "var(--surface-2)", color: currentRate ? "var(--text)" : "var(--muted)" }}>
                {currentRate ? `Tarifdan: ${fmt(+f.florist_salary_amount || 0)}` : "— tarif belgilanmagan"}
              </div>
            )}
            {/* holat qatori: Tarifdan olindi / Qo'lda kiritilgan (+ Tarifga qaytarish) / tarif yo'q */}
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-semibold">
              {!florist ? (
                <span style={{ color: "var(--muted)" }}>Florist tanlanmagan — oylik yozilmaydi</span>
              ) : !volume ? (
                <span style={{ color: "var(--muted)" }}>Hajmni tanlang — tarifdan olinadi</span>
              ) : !currentRate ? (
                <>
                  <span style={{ color: "var(--warning-ink, #8a6d1f)" }}>Bu florist uchun bu hajmda tarif yo&apos;q</span>
                  <a href={`/floristlar/${florist}`} target="_blank" rel="noopener"
                    className="underline underline-offset-2" style={{ color: "var(--primary)" }}>
                    Tarif belgilash →
                  </a>
                </>
              ) : kind === "standard" ? (
                <>
                  <span style={{ color: "var(--text-2)" }}>
                    Summa <b>hajm tarifidan</b> olinadi va shu yerda o&apos;zgartirilmaydi — tarifni floristning tarif jadvalida tahrirlang.
                  </span>
                  <a href={`/floristlar/${florist}`} target="_blank" rel="noopener"
                    className="underline underline-offset-2" style={{ color: "var(--primary)" }}>
                    Tarif jadvalini ochish →
                  </a>
                </>
              ) : salaryFromRate ? (
                <span style={{ color: "var(--primary)" }}>Tarifdan olindi</span>
              ) : (
                <>
                  <span style={{ color: "var(--text-2)" }}>Qo&apos;lda kiritilgan</span>
                  <button type="button" onClick={reapplyRate} className="underline-offset-2 hover:underline" style={{ color: "var(--primary)" }}>Tarifga qaytarish</button>
                </>
              )}
            </div>
            {/* ⚠️ §8 — CUSTOM'da summa BO'SH qoldirilsa backend hajm tarifidan oladi (yozilgan bo'lsa AYNAN shu ketadi). */}
            {kind === "custom" && florist > 0 && f.florist_salary_amount === "" && (
              <span className="mt-0.5 block text-[11.5px] font-semibold" style={{ color: "var(--muted)" }}>
                Bo&apos;sh qoldirilsa — server <b>hajm tarifidan</b> oladi (tarif bo&apos;lmasa oylik yozilmaydi).
              </span>
            )}
            {florist > 0 && f.florist_salary_amount !== "" && (
              <span className="mt-0.5 block text-[11.5px] font-semibold" style={{ color: "var(--text-2)" }}>
                Florist oyligiga: {qtyTotal > 1 ? `${(+f.florist_salary_amount).toLocaleString("ru")} × ${qtyTotal} dona = ` : ""}<b style={{ color: "var(--acc)" }}>{fmt(+f.florist_salary_amount * qtyTotal)}</b>
              </span>
            )}
            <Err k="florist_salary_amount" />
          </Field>
        )}

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
          {price.salary > 0 && florist > 0 && <PriceLine label="Florist haqi (oylikka)" value={price.salary} hue="var(--acc)" />}
          {decoPay > 0 && <PriceLine label="Oformleniya haqi (oylikka)" value={decoPay} hue="var(--acc)" />}
          <PriceLine label="Taxminiy foyda" value={price.profit} hue={price.profit >= 0 ? "var(--success-ink, #3d8a5f)" : "var(--danger-ink)"} strong />
          {(price.salary > 0 && florist > 0) || decoPay > 0 ? (
            <PriceLine label="Foyda — haqlardan keyin" value={price.profit - (florist > 0 ? price.salary : 0) - decoPay} hue={price.profit - (florist > 0 ? price.salary : 0) - decoPay >= 0 ? "var(--success-ink, #3d8a5f)" : "var(--danger-ink)"} />
          ) : null}
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
