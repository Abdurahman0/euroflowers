"use client";
import type {
  Accounting, AdjustDirection, AdjustInput, AdjustPreview, AdjustResult, AICatalogInput, AICatalogItem,
  CloseIssuePreview, CloseIssueInput, CloseIssueResult,
  AISettings, Analytics, AuditLog, BatchUsage, Branch, BranchReport, BusinessSettings, CatalogItem, CatalogTransfer, CatalogTransferInput, Conversation, Customer, Dashboard, Debt, DebtByCustomer,
  Expense, ExpenseOptions, ExpenseSummary, Flower, FloristAttendance, FloristInput, FloristProfile, FloristSalaryEntry, FloristStockBalance, FloristStockIssue, FloristStockIssueInput, FloristStockReturnInput, FloristVolumeRate, FlowerVariant,
  InstagramEvent, InstagramSettings, IntegrationSettings, Lead, LeadInput,
  LeadStatusDef, MaterialDelivery, MaterialDeliveryInput, MaterialMovement, MaterialReceiveInput, Message, Notification, Packaging, PagePermission, Paginated, PaymentType,
  Reservation, ReservationInput, ReservationPayment, ReservationPaymentInput, CatalogRestoreFlowersInput, FloristStockBulkIssueInput,
  CatalogSalesPage, CatalogSalesList, CatalogRework, SocialPost, StockBatch, StockDelivery, StockDeliveryInput, StockMovement, Supplier, SupplierInput, SupplierPayment, SupplierDebt, SupplierDebtInput, SupplierPaymentInput, FloristPayment, FloristPaymentInput, FloristStats, UploadResponse, User, VolumeRateInput,
} from "./types";
import { dashboardDateTo, accountingDateTo } from "./format";

/**
 * API asosi:
 *   production — https://euroflowers.api.cognilabs.org (Swagger: /api/docs/)
 *   lokal      — NEXT_PUBLIC_API_URL=http://192.168.1.5:8000 (kontraktdagi dev manzil)
 */
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://euroflowers.api.cognilabs.org";

/**
 * DEMO REJIM — faqat NEXT_PUBLIC_DEMO=1 bo'lganda yoqiladi (dizayn ko'rish uchun).
 * Standart: haqiqiy backend.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO === "1";

const TOKEN_KEY = "ef_tokens";
const REQUEST_TIMEOUT_MS = 20000;

type Tokens = { access: string; refresh: string };

export function getTokens(): Tokens | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

/** remember=false — token faqat joriy sessiyada saqlanadi ("Meni eslab qol" o'chiq) */
export function setTokens(t: Tokens, remember = true) {
  const target = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;
  target.setItem(TOKEN_KEY, JSON.stringify(t));
  other.removeItem(TOKEN_KEY);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  if (DEMO_MODE) return true; // demo: to'g'ridan-to'g'ri kirish mumkin
  return getTokens() != null;
}

/**
 * DRF xatolarini nuqtali kalitli tekis {maydon: xabar} ko'rinishiga keltiradi.
 * Ichma-ich serializer xatolarini ham ochadi (masalan katalog kompozitsiyasi:
 *   {"composition":[{"quantity_stems":["..."]}]} → {"composition.0.quantity_stems":"..."}),
 * shu bilan formalar aynan mos inputga xatoni ko'rsata oladi (nafaqat umumiy toast).
 */
function flattenErrors(body: unknown, prefix: string, out: Record<string, string>): Record<string, string> {
  if (body == null) return out;
  if (typeof body === "string") {
    if (prefix) out[prefix] = body;
    return out;
  }
  if (Array.isArray(body)) {
    if (body.length && body.every((x) => typeof x === "string")) {
      if (prefix) out[prefix] = (body as string[]).join(" ");
    } else {
      body.forEach((x, i) => flattenErrors(x, prefix ? `${prefix}.${i}` : String(i), out));
    }
    return out;
  }
  if (typeof body === "object") {
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
      flattenErrors(v, prefix ? `${prefix}.${k}` : k, out);
    }
  }
  return out;
}

function extractFieldErrors(body: unknown): Record<string, string> | undefined {
  if (typeof body !== "object" || body == null) return undefined;
  const flat = flattenErrors(body, "", {});
  delete flat.detail; // umumiy xabar — maydon emas
  return Object.keys(flat).length ? flat : undefined;
}

function statusMessage(status: number, body: unknown): string {
  if (typeof body === "object" && body != null && "detail" in body) {
    // `detail` MASSIV bo'lishi mumkin (["Skladda yetarli qoldiq yo'q", …]) —
    // elementlar qatorma-qator ko'rsatiladi (kontrakt: xatolarni ko'rsatish qoidasi)
    const d = (body as { detail: unknown }).detail;
    if (Array.isArray(d)) return d.map((x) => String(x)).join("\n");
    return String(d);
  }
  const fields = extractFieldErrors(body);
  if (fields) {
    // takrorlanmas xabarlarni birlashtiramiz (masalan dublikat: {"media_id": "..."})
    return Array.from(new Set(Object.values(fields))).join(" · ");
  }
  switch (status) {
    case 400: return "So'rov noto'g'ri — maydonlarni tekshiring";
    case 401: return "Sessiya tugadi — qayta kiring";
    case 403: return "Ruxsat yo'q — bu amal uchun huquqingiz yetarli emas";
    case 404: return "Topilmadi";
    case 409: return "Konflikt — yozuv boshqa joyda o'zgartirilgan, sahifani yangilang";
    case 422: return "Ma'lumot qabul qilinmadi — maydonlarni tekshiring";
    case 429: return "Juda ko'p so'rov — bir necha soniyadan so'ng urinib ko'ring";
    default:
      if (status >= 500) return "Server xatosi — birozdan so'ng urinib ko'ring";
      return `API xatosi (${status})`;
  }
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  /** forma maydonlariga bog'lash uchun: {media_id: "Bu Instagram media allaqachon ..."} */
  fieldErrors?: Record<string, string>;
  constructor(status: number, body: unknown) {
    super(statusMessage(status, body));
    this.status = status;
    this.body = body;
    this.fieldErrors = extractFieldErrors(body);
  }
}

/**
 * KATALOG SOTUV TANASI — sof funksiya (jonli sxema: `CatalogSellRequest`).
 *
 * ⚠️ SHU YER JIMGINA MAYDON YO'QOTGAN EDI. Ilgari tana OQ RO'YXAT bo'yicha qurilardi
 * va ro'yxatda bo'lmagan kalitlar TASHLAB YUBORILARDI. Chaqiruvchi
 * `cash_amount`/`card_amount`/`delivery_amount`/mijoz maydonlarini BERSA ham
 * serverga faqat `{"payment_type":"mixed"}` ketardi, server esa haqli ravishda
 * «Aralash to'lovda naqd va karta summasini kiriting» deb 400 qaytarardi —
 * forma yashil ✓ ko'rsatib turgani holda. QARZ ham xuddi shunday buzilgan edi
 * (`customer_name`/`customer_phone`/`debt_note` yo'qolardi).
 *
 * ⚠️ Yangi maydon qo'shilsa SHU YERGA ham qo'shilishi shart — aks holda u yana
 * jimgina yo'qoladi va nosozlik SERVER xatosi bo'lib ko'rinadi.
 * Bo'sh qiymat YUBORILMAYDI («nol — qiymat» qoidasi).
 */
export type SellInput = {
  quantity?: number; sale_price?: string; discount_reason?: string;
  payment_type?: PaymentType; sold_at?: string; reservation?: number;
  materials?: { packaging: number; quantity: number }[]; decoration_florist?: number;
  /** ARALASH — ikkalasi ham majburiy va > 0 */
  cash_amount?: string; card_amount?: string;
  /** sotuv summasining ICHIDAGI dastafka (ustiga qo'shilmaydi) */
  delivery_amount?: string;
  /** QARZ — `customer` YOKI `customer_name` + `customer_phone` */
  customer?: number; customer_name?: string; customer_phone?: string; debt_note?: string;
  /** sotuv rasmi — Telegram guruhiga ketadi */
  sale_image_url?: string;
};

export function buildSellPayload(data?: SellInput): Record<string, unknown> {
  const d = data ?? {};
  return {
    // ⚠️ 1 dona — sukut; yuborilmaydi
    ...(d.quantity && d.quantity > 1 ? { quantity: d.quantity } : {}),
    // ⚠️ BIR DONA narxi (jami EMAS). Berilmasa katalog narxi olinadi.
    ...(d.sale_price ? { sale_price: d.sale_price } : {}),
    ...(d.discount_reason ? { discount_reason: d.discount_reason } : {}),
    ...(d.payment_type ? { payment_type: d.payment_type } : {}),
    ...(d.sold_at ? { sold_at: d.sold_at } : {}),
    // ⚠️ BRON: backend history'ga bron ID + paid_amount + remaining_due yozadi
    ...(d.reservation ? { reservation: d.reservation } : {}),
    // ⚠️ material quantity — 1 DONA sotuv uchun (backend × quantity qiladi)
    ...(d.materials?.length ? { materials: d.materials } : {}),
    // ⚠️ sotuv oformleniyasi — katalog yaratishdagi decoration'dan ALOHIDA
    ...(d.decoration_florist ? { decoration_florist: d.decoration_florist } : {}),
    ...(d.cash_amount ? { cash_amount: d.cash_amount } : {}),
    ...(d.card_amount ? { card_amount: d.card_amount } : {}),
    // ⚠️ operator ATAYLAB "0" yozsa — yuboriladi (ongli tanlov)
    ...(d.delivery_amount != null && d.delivery_amount !== "" ? { delivery_amount: d.delivery_amount } : {}),
    ...(d.customer ? { customer: d.customer } : {}),
    ...(d.customer_name ? { customer_name: d.customer_name } : {}),
    ...(d.customer_phone ? { customer_phone: d.customer_phone } : {}),
    ...(d.debt_note ? { debt_note: d.debt_note } : {}),
    ...(d.sale_image_url ? { sale_image_url: d.sale_image_url } : {}),
  };
}

/** oxirgi HTTP javob kodi — `requestWithStatus` uchun (200 va 201 farqi). */
let lastStatus = 0;

let refreshing: Promise<boolean> | null = null;

async function refreshAccess(): Promise<boolean> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const t = getTokens();
    if (!t) return false;
    try {
      const res = await fetch(`${API_BASE}/api/auth/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: t.refresh }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { access: string; refresh?: string };
      setTokens({ access: data.access, refresh: data.refresh ?? t.refresh }, localStorage.getItem(TOKEN_KEY) != null);
      return true;
    } catch {
      return false;
    }
  })();
  const ok = await refreshing;
  refreshing = null;
  return ok;
}

function toLogin() {
  clearTokens();
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  if (DEMO_MODE) {
    const { demoRequest } = await import("./demo");
    return demoRequest<T>(path, init);
  }
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    throw new ApiError(0, { detail: "Internet aloqasi yo'q — tarmoqni tekshiring" });
  }

  const t = getTokens();
  const headers: Record<string, string> = {
    ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(init.headers as Record<string, string> | undefined),
  };
  if (t) headers.Authorization = `Bearer ${t.access}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  // ⚠️ CHAQIRUVCHI signali (masalan kalendar oy almashtirgani) ichki taymer
  // kontrolleriga BOG'LANADI — aks holda `init.signal` bosib ketilardi va bekor
  // qilish umuman ishlamasdi.
  const outer = (init as { signal?: AbortSignal }).signal;
  const onOuterAbort = () => ctrl.abort();
  if (outer) {
    if (outer.aborted) ctrl.abort();
    else outer.addEventListener("abort", onOuterAbort, { once: true });
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers, signal: ctrl.signal });
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === "AbortError";
    // chaqiruvchi ATAYLAB bekor qilgan bo'lsa — AbortError'ni O'ZIDEK uzatamiz
    // (chaqiruvchi uni jimgina e'tiborsiz qoldiradi; bu xato EMAS).
    if (aborted && outer?.aborted) throw e;
    throw new ApiError(0, {
      detail: aborted ? "So'rov vaqti tugadi — internet sekin yoki server javob bermayapti" : "Server bilan aloqa yo'q — tarmoqni tekshiring",
    });
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", onOuterAbort);
  }

  if (res.status === 401 && retry && t) {
    const ok = await refreshAccess();
    if (ok) return request<T>(path, init, false);
    toLogin();
    throw new ApiError(401, { detail: "Sessiya tugadi — qayta kiring" });
  }

  // ⚠️ OXIRGI JAVOB KODI — `requestWithStatus` shu yerdan oladi. Alohida fetch
  // qilinmaydi: ikkinchi so'rov yuborish yozuvni IKKI MARTA yaratib qo'yardi.
  lastStatus = res.status;

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

/**
 * `request` bilan AYNAN bir xil, lekin HOLAT KODINI ham qaytaradi.
 *
 * ⚠️ Kerak, chunki oformleniya qo'shishda 200 va 201 BOSHQA-BOSHQA ma'no beradi
 * (200 = o'sha kunning qatoriga qo'shildi, 201 = yangi qator ochildi) va operatorga
 * aynan shu farq aytilishi kerak — aks holda u «ishlamadi» deb yana qo'shadi.
 *
 * ⚠️ Ikkinchi so'rov YUBORILMAYDI (u yozuvni ikki marta yaratardi) — kod
 * `request` ning o'zidan, modul darajasidagi `lastStatus` orqali olinadi.
 */
export async function requestWithStatus<T>(path: string, init: RequestInit = {}): Promise<{ status: number; data: T }> {
  const data = await request<T>(path, init);
  return { status: lastStatus, data };
}

const qs = (params?: Record<string, string | number | boolean | undefined>) => {
  if (!params) return "";
  const p = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
  if (!p.length) return "";
  return "?" + p.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&");
};

type Params = Record<string, string | number | boolean | undefined>;

/**
 * Excel/fayl EKSPORTI — JSON emas, BLOB. Auth bilan yuklab olib, brauzerda
 * yuklashni ishga tushiradi. Fayl nomi Content-Disposition'dan (bo'lsa) yoki
 * fallback + davr + .xlsx'dan yasaladi. Demo rejimda ishlamaydi (real backend).
 */
async function downloadFile(path: string, params?: { date_from?: string; date_to?: string; florist?: number }, fallback = "hisobot"): Promise<void> {
  if (DEMO_MODE) throw new ApiError(0, { detail: "Eksport demo rejimda ishlamaydi — real backendga kiring" });
  const t = getTokens();
  const res = await fetch(`${API_BASE}${path}${qs(params)}`, {
    headers: t ? { Authorization: `Bearer ${t.access}` } : undefined,
  }).catch(() => { throw new ApiError(0, { detail: "Server bilan aloqa yo'q — tarmoqni tekshiring" }); });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body);
  }
  const blob = await res.blob();
  // fayl nomi: Content-Disposition'dagi filename yoki fallback-davr.xlsx
  const cd = res.headers.get("Content-Disposition") || "";
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  const span = [params?.date_from, params?.date_to].filter(Boolean).join("_");
  const name = m ? decodeURIComponent(m[1]) : `euroflowers-${fallback}${span ? `-${span}` : ""}.xlsx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// bitta katta sahifa yetarli; count oshsa keyingi sahifalar ham olinadi (maks 5)
const list = async <T,>(path: string, params?: Params): Promise<T[]> => {
  // maksimal page_size 100 (leads kontrakti); kattaroq qiymat 400 berishi mumkin
  const first = await request<Paginated<T>>(`${path}${qs({ page_size: 100, ...params })}`);
  const out = [...first.results];
  let next = first.next;
  let guard = 0;
  while (next && guard < 4) {
    const url = next.startsWith("http") ? next.slice(next.indexOf("/api/")) : next;
    const page = await request<Paginated<T>>(url);
    out.push(...page.results);
    next = page.next;
    guard++;
  }
  return out;
};

/**
 * ⚠️ BOSQICHMA-BOSQICH RO'YXAT — sahifalarni KETMA-KET emas, BIRINCHISINI DARHOL berib,
 * qolganini ORQA FONDA yuklaydi.
 *
 * NEGA: `list()` 100 talik sahifalarni ketma-ket so'raydi va HAMMASI kelguncha ekran bo'sh
 * turadi. Jonli o'lchov (2026-08-08):
 *     /api/catalog/       146 qator → 2 ketma-ket sahifa ≈ 8.1 s
 *     /api/stock-movements/ 423 qator → 5 ketma-ket sahifa ≈ 8.6 s
 * So'rov narxi sahifa HAJMIGA qarab o'sadi (catalog: 20 ta → 1.3 s, 100 ta → 3.9 s),
 * shuning uchun KICHIK birinchi sahifa ekranga tez chiqadi.
 *
 * ⚠️ JAMILAR BUZILMAYDI: chaqiruvchi to'liq ro'yxatni baribir oladi (`done: true` bilan
 * ikkinchi marta). Sarlavha jamilari, chip sonlari va klient filtrlari o'zgarishsiz
 * ishlaydi — faqat ular biroz KEYINROQ aniqlashadi. Server tomonda filtrlashga
 * O'TKAZILMADI: katalogda `status` serverniki UI bilan MOS EMAS (jonli: 6 ta yozuv
 * `available` bo'lsa-da soni to'lgan — server bo'yicha filtrlasak sotilgan buket
 * «Sotuvda» javonига qaytib chiqardi).
 *
 * `onPage(rows, done)` KAMIDA IKKI marta chaqiriladi (bitta sahifa bo'lsa — bir marta,
 * `done: true` bilan). Xato bo'lsa promise REJECT bo'ladi (birinchi sahifada) yoki
 * yetib kelgan qismi qaytadi (keyingi sahifalarda) — ro'yxat jimgina BO'SHAB qolmaydi.
 */
const PAGED_MAX_ROWS = 500;    // `list()` dagi bilan bir xil shift (5 × 100)
const PAGED_BULK_SIZE = 100;   // ⚠️ SERVER SHIFTI — 200/500 so'ralsa ham 100 qaytaradi (jonli tekshirildi)
/** ⚠️ Sahifalash uchun BARQAROR tartib — pastdagi izohga qarang. */
const PAGED_STABLE_ORDERING = "-id";

/** `id` bo'yicha takrorlarni tashlaydi, BIRINCHI uchraganini saqlaydi (tartib buzilmaydi). */
const dedupeById = <T,>(rows: T[]): T[] => {
  const seen = new Set<unknown>();
  const out: T[] = [];
  for (const r of rows) {
    const id = (r as { id?: unknown })?.id;
    if (id === undefined) return rows;   // `id`siz shakl — aralashmaymiz
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(r);
  }
  return out;
};

export const listPaged = async <T,>(
  path: string,
  params: Params | undefined,
  onPage: (rows: T[], done: boolean) => void,
  pageSize = 24,
): Promise<T[]> => {
  const url = (size: number, page: number, over?: Params) =>
    // ⚠️ `page`/`page_size` SPREAD'DAN KEYIN — chaqiruvchi ularni bersa ham sahifalash buzilmaydi
    `${path}${qs({ ...params, ...over, page_size: size, page })}`;

  // 1) KICHIK birinchi sahifa — ekran shu bilan to'ladi
  const head = await request<Paginated<T>>(url(pageSize, 1));
  const count = head.count ?? head.results.length;
  const expected = Math.min(count, PAGED_MAX_ROWS);
  if (count <= head.results.length) {
    const only = dedupeById(head.results);
    onPage([...only], true);
    return only;
  }
  onPage([...head.results], false);

  /**
   * 2) QOLGANI — KETMA-KET va KATTA sahifalar bilan.
   *
   * ⚠️ BIR VAQTDA BITTA SO'ROV. Ilgari qolgan sahifalar parallel olinardi va bitta
   * ro'yxat uchun 6–12 ta bir xil so'rov bir vaqtda ketardi; server ularni baribir
   * navbatga qo'yadi (jonli o'lchov: 6 parallel × 25 ta = 6.3 s, ketma-ket 2 × 100 = 5.4 s),
   * ya'ni parallellik FOYDA BERMAGAN, shunchaki so'rovlar to'dasini yasagan.
   * ⚠️ page_size 100 dan katta so'ralsa ham server 100 qaytaradi — shu bois shift.
   */
  const bulk = async (over?: Params) => {
    const rows: T[] = [];
    for (let page = 1; rows.length < expected; page++) {
      // ⚠️ bitta sahifa yiqilsa BUTUN ro'yxat yo'qolmasin — yetib kelgani qaytadi
      const p = await request<Paginated<T>>(url(PAGED_BULK_SIZE, page, over)).catch(() => null);
      if (!p) break;
      rows.push(...p.results);
      if (!p.next || p.results.length === 0) break;
    }
    return dedupeById(rows).slice(0, expected);
  };

  let all = await bulk();
  /**
   * ⚠️ BEQAROR TARTIB — QATOR JIMGINA YO'QOLADI.
   * Server ba'zi tartiblarda TENG qiymatli qatorlarni har so'rovda boshqacha joylashtiradi;
   * sahifa chegarasida bir qator IKKI marta, boshqasi esa UMUMAN chiqmaydi.
   * Jonli o'lchov (08.08.2026, /api/stock-batches/, 141 qator, sahifa 24):
   *     ordering=-received_at → 6 dublikat va 6 qator TUSHIB QOLGAN (ekranda «Jami qoldiq»
   *                             225 o'rniga 175 dona ko'rsatgan edi)
   *     ordering=-id / id / -created_at → dublikat 0, tushib qolgan 0
   * Shuning uchun: kam kelgani ANIQLANADI va BARQAROR tartib bilan bir marta qayta olinadi.
   */
  if (all.length < expected) {
    const retry = await bulk({ ordering: PAGED_STABLE_ORDERING }).catch(() => null);
    if (retry && retry.length > all.length) all = retry;
  }
  onPage([...all], true);
  return all;
};

// ===== Auth =====

/**
 * Kirish. Kontrakt bo'yicha javobda `user` va `permissions` ham keladi
 * (Swagger sxemasi buni ko'rsatmaydi — kontrakt ustuvor, shu sababli
 * user'ni ixtiyoriy sifatida o'qiymiz; bo'lmasa /api/me/ ga tayaniladi).
 */
export async function login(username: string, password: string, remember = true): Promise<User | null> {
  if (DEMO_MODE) {
    await new Promise((r) => setTimeout(r, 600));
    setTokens({ access: "demo-access", refresh: "demo-refresh" }, remember);
    return null;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/auth/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      signal: ctrl.signal,
    });
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === "AbortError";
    throw new ApiError(0, { detail: aborted ? "So'rov vaqti tugadi" : "Server bilan aloqa yo'q — tarmoqni tekshiring" });
  } finally {
    clearTimeout(timer);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  const data = body as Tokens & { user?: User; permissions?: PagePermission[]; permission_matrix?: PagePermission[] };
  setTokens({ access: data.access, refresh: data.refresh }, remember);
  if (data.user) {
    // permission_matrix (to'liq, avtoritativ) > permissions — qaysi biri bo'lsa
    return {
      ...data.user,
      permission_matrix: data.user.permission_matrix ?? data.permission_matrix,
      permissions: data.user.permissions ?? data.permissions,
    };
  }
  return null;
}

/**
 * Foydalanuvchi O'Z parolini almashtiradi.
 * DIQQAT: jonli backendda manzil `/api/me/change-password/` (hujjatdagi
 * `/api/auth/change-password/` 404 qaytaradi) va `new_password_confirm`
 * MAJBURIY — shu sababli tasdiq maydoni serverga ham yuboriladi.
 */
export function changePassword(data: { old_password: string; new_password: string; new_password_confirm: string }) {
  return request<{ detail: string }>("/api/me/change-password/", { method: "POST", body: JSON.stringify(data) });
}

export function logout() {
  const t = getTokens();
  if (t && !DEMO_MODE) {
    // refresh tokenni serverda bekor qilamiz; javobini kutmasak ham bo'ladi
    fetch(`${API_BASE}/api/auth/token/blacklist/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: t.refresh }),
    }).catch(() => {});
  }
  toLogin();
}

// ===== Endpoints =====

/**
 * DAVR SANA KONVENSIYASI — YAGONA (2026-07-30).
 * Chaqiruvchi HAR DOIM inklyuziv `to` yuboradi = hisobga olinishi kerak bo'lgan
 * OXIRGI kun (masalan bugungi sana). Off-by-one xatolarining oldini olish uchun
 * eksklyuziv/inklyuziv farqini FAQAT shu qatlam hal qiladi — sahifalar hech
 * qachon o'zi `+1 kun` qilmaydi:
 *   • /dashboard/ va /analytics/ — backend `date_to`ni kun BOSHIga oladi
 *     (eksklyuziv) → shu yerda +1 kun qo'shiladi.
 *   • /accounting/ — backend `date_to`ni kun OXIRIga oladi (inklyuziv) →
 *     o'zgarishsiz yuboriladi.
 * Ko'rinishlar `{ from, to }` (ikkalasi inklyuziv YYYY-MM-DD) yuboradi, xolos.
 */
type Period = { from?: string; to?: string };

/**
 * SAHIFALANGAN so'rov — `Paginated<T>` ni AYNAN serverdan qaytaradi
 * (`page` / `total_pages` / `has_next` / `totals` bilan birga).
 *
 * ⚠️ `list()` dan FARQI: bu HECH QANDAY sahifani aylanib chiqmaydi va hech narsani
 * kesmaydi — bitta so'rov, bitta sahifa. Jamilar `count` / `totals` dan olinadi.
 * ⚠️ `signal` MAJBURIY emas, lekin ro'yxatlarda DOIM uzatiladi (eskirgan javob
 * yangisining ustiga yozib ketmasin).
 */
const paged = <T,>(path: string) => (p?: Params, signal?: AbortSignal) =>
  request<Paginated<T>>(`${path}${qs(p)}`, { signal });

export const api = {
  /* ===== SAHIFALANGAN RO'YXATLAR (spec: FRONTEND_PAGINATION_TOTALS_API.md) ===== */
  auditPage: paged<AuditLog>("/api/audit/"),
  catalogPage: paged<CatalogItem>("/api/catalog/"),
  /** AI KATALOG sahifasi — server sahifalash + `totals` (spec §6). */
  aiCatalogPage: paged<AICatalogItem>("/api/ai-catalog/"),
  stockBatchesPage: paged<StockBatch>("/api/stock-batches/"),
  stockDeliveriesPage: paged<StockDelivery>("/api/stock-deliveries/"),
  materialsPage: paged<Packaging>("/api/materials/"),
  materialDeliveriesPage: paged<MaterialDelivery>("/api/material-deliveries/"),
  materialMovementsPage: paged<MaterialMovement>("/api/material-movements/"),
  floristsPage: paged<FloristProfile>("/api/florists/"),
  floristSalaryPage: paged<FloristSalaryEntry>("/api/florist-salary/"),
  floristStockIssuesPage: paged<FloristStockIssue>("/api/florist-stock-issues/"),
  floristStockBalancesPage: paged<FloristStockBalance>("/api/florist-stock-balances/"),
  catalogTransfersPage: paged<CatalogTransfer>("/api/catalog-transfers/"),
  customersPage: paged<Customer>("/api/customers/"),

  me: () => request<User>("/api/me/"),
  // ⚠️ date_to ASIMMETRIYASI (lib/format): dashboard/analytics EKSKLYUZIV → +1
  // (dashboardDateTo); accounting INKLYUZIV → xom (accountingDateTo). YAGONA manba.
  dashboard: (p?: Period) => request<Dashboard>(`/api/dashboard/${qs({ from: p?.from, to: dashboardDateTo(p?.to), date_from: p?.from, date_to: dashboardDateTo(p?.to) })}`),
  analytics: (p?: Period) => request<Analytics>(`/api/analytics/${qs({ from: p?.from, to: dashboardDateTo(p?.to), date_from: p?.from, date_to: dashboardDateTo(p?.to) })}`),

  /**
   * Hisob-kitob — date_to INKLYUZIV. `history` bazada sahifalanadi;
   * summary/by_* bloklari esa tanlangan davrning to'liq jamisi bo'lib qoladi.
   * branch: "all"|"main"|"<id>".
   */
  accounting: (p?: Period & { branch?: string; page?: number; page_size?: number; ordering?: string }, signal?: AbortSignal) =>
    request<Accounting>(`/api/accounting/${qs({
      date_from: p?.from, date_to: accountingDateTo(p?.to), from: p?.from, to: accountingDateTo(p?.to),
      branch: p?.branch, page: p?.page, page_size: p?.page_size, ordering: p?.ordering,
    })}`, { signal }),
  /** Excel eksportlar — fayl (blob) sifatida yuklab olinadi */
  exportFlorist: (p?: { date_from?: string; date_to?: string; florist?: number }) => downloadFile("/api/exports/florist/", p, "florist-hisobot"),
  exportFlorists: (p?: { date_from?: string; date_to?: string }) => downloadFile("/api/exports/florists/", p, "floristlar-hisobot"),
  /** ⚠️ Dashboard Excel — SOVDA / RASXOD / YANDEX varaqlari (deploy 20.08.2026).
      Fayl nomi Content-Disposition dan olinadi (downloadFile shuni o'qiydi). */
  exportDashboard: (p?: { date_from?: string; date_to?: string }) => downloadFile("/api/dashboard/export/", p, "dashboard"),
  exportProfit: (p?: { date_from?: string; date_to?: string }) => downloadFile("/api/exports/profit/", p, "hisob-kitob"),

  /** Dinamik lead statuslari — kanban ustunlari shu yerdan chiziladi.
      Javob paginatsiyali ({results}) ham, oddiy massiv ham bo'lishi mumkin. */
  leadStatuses: async (p?: Params): Promise<LeadStatusDef[]> => {
    const res = await request<Paginated<LeadStatusDef> | LeadStatusDef[]>(
      `/api/lead-statuses/${qs({ is_active: true, ordering: "order", ...p })}`
    );
    return Array.isArray(res) ? res : (res?.results ?? []);
  },
  createLeadStatus: (data: Partial<LeadStatusDef>) =>
    request<LeadStatusDef>("/api/lead-statuses/", { method: "POST", body: JSON.stringify(data) }),
  updateLeadStatus: (id: number, data: Partial<LeadStatusDef>) =>
    request<LeadStatusDef>(`/api/lead-statuses/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteLeadStatus: (id: number) =>
    request<void>(`/api/lead-statuses/${id}/`, { method: "DELETE" }),

  leads: (p?: Params) => list<Lead>("/api/leads/", p),
  /** Bitta sahifa — cheksiz skroll uchun (kontrakt: max page_size 100) */
  leadsPage: (p?: Params) => request<Paginated<Lead>>(`/api/leads/${qs({ page_size: 50, ...p })}`),
  /** Kanban ustuni tartibini BITTA so'rovda saqlash: target ustunning barcha
      lead id'lari yuqoridan-pastga tartibda (kontrakt: reorder-column).
      Status o'zgarishi ham shu yerda — won'ga o'tsa sklad kamayadi,
      won'dan chiqsa avtomatik qaytadi (single-branch: branch yuborilmaydi). */
  reorderColumn: (data: { status: string; lead_ids: number[] }) =>
    request<{ updated: number }>("/api/leads/reorder-column/", { method: "POST", body: JSON.stringify(data) }),
  lead: (id: number) => request<Lead>(`/api/leads/${id}/`),
  createLead: (data: LeadInput) =>
    request<Lead>("/api/leads/", { method: "POST", body: JSON.stringify(data) }),
  updateLead: (id: number, data: LeadInput) =>
    request<Lead>(`/api/leads/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteLead: (id: number) =>
    request<void>(`/api/leads/${id}/`, { method: "DELETE" }),

  customers: (p?: Params) => list<Customer>("/api/customers/", p),
  customer: (id: number) => request<Customer>(`/api/customers/${id}/`),

  /* ===== RESTAVRATSIYA (ruxsat: `catalog`; GET can_view, POST can_control) ===== */
  /** ⚠️ Filtr: ?florist= · ?search= · ?ordering=(-created_at | florist_amount | input_stems | output_stems) */
  catalogReworks: (p?: Params) => request<Paginated<CatalogRework>>(`/api/catalog-reworks/${qs(p)}`),
  catalogRework: (id: number) => request<CatalogRework>(`/api/catalog-reworks/${id}/`),
  /** ⚠️ QAYTMAS — OpenAPI'da `{id}/` faqat GET beradi, bekor qilish yo'li YO'Q. */
  createCatalogRework: (data: Record<string, unknown>) =>
    request<CatalogRework>("/api/catalog-reworks/", { method: "POST", body: JSON.stringify(data) }),

  /* ===== RASXODLAR (ruxsat: `expenses`) ===== */
  expenses: (p?: Params, signal?: AbortSignal) => request<Paginated<Expense>>(`/api/expenses/${qs(p)}`, { signal }),
  expense: (id: number) => request<Expense>(`/api/expenses/${id}/`),
  createExpense: (data: Record<string, unknown>) =>
    request<Expense>("/api/expenses/", { method: "POST", body: JSON.stringify(data) }),
  updateExpense: (id: number, data: Record<string, unknown>) =>
    request<Expense>(`/api/expenses/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  /** ⚠️ 204 qaytaradi — tasdiq oynasi FRONTENDDA. */
  deleteExpense: (id: number) => request<void>(`/api/expenses/${id}/`, { method: "DELETE" }),
  /** ⚠️ Ro'yxat bilan AYNAN bir xil filtr berilishi SHART (buildExpenseQuery). */
  expenseSummary: (p?: Params, signal?: AbortSignal) => request<ExpenseSummary>(`/api/expenses/summary/${qs(p)}`, { signal }),
  /** ⚠️ To'lov usullari — `/categories/` 404 bo'ldi (`category` modeldan olib tashlangan). */
  expenseOptions: () => request<ExpenseOptions>("/api/expenses/options/"),

  /* ===== QARZDORLAR (ruxsat: `crm`) ===== */
  /** Mijoz bo'yicha guruhlangan qarzlar. ⚠️ Server ENG KATTA QARZDAN saralab beradi —
      qayta saralamang, `totals` ni qayta hisoblamang. Sukut: faqat to'lanmaganlar. */
  debtsByCustomer: (includePaid = false) =>
    request<DebtByCustomer>(`/api/debts/by-customer/${includePaid ? "?include_paid=true" : ""}`),
  /** Tekis ro'yxat — filtrlar SERVER tomonida (?is_paid=&customer=&paid_method=&search=&ordering=) */
  debts: (p?: Params) => list<Debt>("/api/debts/", p),
  /** Qarzni to'lash. `method` MAJBURIY (cash|card) — savdo shu ustunga tushadi.
      `paid_at` berilmasa hozirgi vaqt. ⚠️ QAYTMAS: to'langan qarzni «to'lanmagan»ga
      qaytarish yo'li OpenAPI'da YO'Q (is_paid/paid_at/paid_method — readOnly). */
  payDebt: (id: number, data: Record<string, unknown>) =>
    request<Debt>(`/api/debts/${id}/pay/`, { method: "POST", body: JSON.stringify(data) }),
  createCustomer: (data: Partial<Customer>) =>
    request<Customer>("/api/customers/", { method: "POST", body: JSON.stringify(data) }),
  updateCustomer: (id: number, data: Partial<Customer>) =>
    request<Customer>(`/api/customers/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteCustomer: (id: number) =>
    request<void>(`/api/customers/${id}/`, { method: "DELETE" }),

  flowers: (p?: Params) => list<Flower>("/api/flowers/", p),
  flowerVariants: (p?: Params) => list<FlowerVariant>("/api/flower-variants/", p),
  createFlowerVariant: (data: Partial<FlowerVariant>) =>
    request<FlowerVariant>("/api/flower-variants/", { method: "POST", body: JSON.stringify(data) }),
  createFlower: (data: Partial<Flower>) =>
    request<Flower>("/api/flowers/", { method: "POST", body: JSON.stringify(data) }),
  updateFlower: (id: number, data: Partial<Flower>) =>
    request<Flower>(`/api/flowers/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  updateFlowerVariant: (id: number, data: Partial<FlowerVariant>) =>
    request<FlowerVariant>(`/api/flower-variants/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteFlower: (id: number) => request<void>(`/api/flowers/${id}/`, { method: "DELETE" }),
  deleteFlowerVariant: (id: number) => request<void>(`/api/flower-variants/${id}/`, { method: "DELETE" }),

  stockBatches: (p?: Params) => list<StockBatch>("/api/stock-batches/", p),
  /** bosqichma-bosqich — birinchi sahifa darhol, qolgani orqa fonda (listPaged izohiga qarang) */
  stockBatchesPaged: (p: Params | undefined, onPage: (r: StockBatch[], done: boolean) => void) => listPaged<StockBatch>("/api/stock-batches/", p, onPage),

  /* ===== YUK (stock-delivery) — partiyalarni guruhlaydi ===== */
  stockDeliveries: (p?: Params) => list<StockDelivery>("/api/stock-deliveries/", p),
  stockDelivery: (id: number) => request<StockDelivery>(`/api/stock-deliveries/${id}/`),
  /** yuk ichidagi partiyalar (gullar) */
  deliveryBatches: (id: number, p?: Params) => list<StockBatch>(`/api/stock-deliveries/${id}/batches/`, p),
  createStockDelivery: (data: StockDeliveryInput) =>
    request<StockDelivery>("/api/stock-deliveries/", { method: "POST", body: JSON.stringify(data) }),
  updateStockDelivery: (id: number, data: Partial<StockDeliveryInput>) =>
    request<StockDelivery>(`/api/stock-deliveries/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  /** ⚠️ ichida gul bo'lsa server ARXIVLAYDI (is_active=false), o'chirmaydi */
  deleteStockDelivery: (id: number) =>
    request<void>(`/api/stock-deliveries/${id}/`, { method: "DELETE" }),
  stockBatch: (id: number) => request<StockBatch>(`/api/stock-batches/${id}/`),
  createStockBatch: (data: Partial<StockBatch>) =>
    request<StockBatch>("/api/stock-batches/", { method: "POST", body: JSON.stringify(data) }),
  updateStockBatch: (id: number, data: Partial<StockBatch>) =>
    request<StockBatch>(`/api/stock-batches/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  /**
   * PARTIYANI O'CHIRISH — aslida IKKI XIL tugaydi:
   *   204 (tanasiz)                    → haqiqatan o'chdi (tegilmagan partiya)
   *   200 {detail, is_active:false}    → sklad tarixi bor edi → ARXIVLANDI
   * ⚠️ OpenAPI faqat `204` ni e'lon qiladi — 200 hujjatlashtirilmagan (LIST 2).
   * `request()` 204 da `undefined` qaytargani uchun ikkalasini ajratsa bo'ladi;
   * natijani `describeBatchDeleteResult()` talqin qiladi.
   */
  deleteStockBatch: (id: number) =>
    request<{ detail?: string; is_active?: boolean } | undefined>(`/api/stock-batches/${id}/`, { method: "DELETE" }),
  /** GET — partiya QAYERDA ishlatilgan (tasdiq oynasi raqamlari uchun).
      ⚠️ `is_used` — SERVERNING hukmi; bizdagi `remaining !== received` zaif taxmin
      (jonli auditda 14 tadan 2 tasi nomuvofiq chiqdi). Faqat shu maydonga ishoning. */
  batchUsage: (id: number) => request<BatchUsage>(`/api/stock-batches/${id}/usage/`),
  /**
   * ISHLATILGAN partiyada navni almashtirish. `reason` MAJBURIY (audit jurnaliga tushadi).
   * ⚠️ QAYTARIB BO'LMAYDI — OpenAPI'da teskari amal YO'Q. Ikkinchi marta eski navga
   * qaytarish «undo» EMAS: auditda IKKITA yozuv qoladi.
   * Javobda `variant_change` bloki keladi (OpenAPI'da e'lon qilinmagan).
   */
  changeBatchVariant: (id: number, data: { variant: number; reason: string }) =>
    request<StockBatch>(`/api/stock-batches/${id}/change-variant/`, { method: "POST", body: JSON.stringify(data) }),
  /** kontrakt tavsiyasi: o'chirish o'rniga PATCH {is_active:false} */
  deactivateStockBatch: (id: number) =>
    request<StockBatch>(`/api/stock-batches/${id}/`, { method: "PATCH", body: JSON.stringify({ is_active: false }) }),
  /** DIQQAT: javob shakli kafolatlanmagan (harakat obyekti qaytishi mumkin) —
      yangilangan partiya kerak bo'lsa api.stockBatch(id) bilan qayta o'qing.
      Body: {movement_type, quantity_stems | quantity_bunches (string), reason} */
  batchMovement: (id: number, data: { movement_type: string; quantity_stems?: number; quantity_bunches?: string; reason?: string; created_at?: string }) =>
    request<unknown>(`/api/stock-batches/${id}/movement/`, { method: "POST", body: JSON.stringify(data) }),
  sellStockBatch: (id: number, data: { quantity_stems: number; sale_amount: string; payment_type: "cash" | "card" | "debt" | "mixed"; cash_amount?: string; card_amount?: string; reason?: string; sold_at?: string }) =>
    request<StockMovement>(`/api/stock-batches/${id}/sell/`, { method: "POST", body: JSON.stringify(data) }),

  stockMovements: (p?: Params) => list<StockMovement>("/api/stock-movements/", p),
  stockMovementsPage: (p?: Params) => request<Paginated<StockMovement>>(`/api/stock-movements/${qs({ page_size: 50, ...p })}`),

  /* ===== YETKAZIB BERUVCHILAR ===== */
  suppliers: (p?: Params) => list<Supplier>("/api/suppliers/", p),
  /** Yetkazib beruvchi to'lovlari — CRUD (backend 0082). on_delete=PROTECT postavshikda. */
  supplierPayments: (p?: Params) => list<SupplierPayment>("/api/supplier-payments/", p),
  /** FLORISTGA BERILGAN PUL — /api/florist-payments/ (backend 76b3b72).
      ⚠️ Yozuv yo'llari JONLI SINALMAGAN (loyiha qoidasi: faqat GET). */
  floristPayments: (p?: Params) => list<FloristPayment>("/api/florist-payments/", p),
  floristPaymentsPage: paged<FloristPayment>("/api/florist-payments/"),
  createFloristPayment: (data: FloristPaymentInput) =>
    request<FloristPayment>("/api/florist-payments/", { method: "POST", body: JSON.stringify(data) }),
  updateFloristPayment: (id: number, data: Partial<FloristPaymentInput>) =>
    request<FloristPayment>(`/api/florist-payments/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteFloristPayment: (id: number) => request<void>(`/api/florist-payments/${id}/`, { method: "DELETE" }),

  /* ===== QO'LDA QO'SHILGAN QARZ — /api/supplier-debts/ (deploy 20.08.2026) =====
     ⚠️ Bu partiya/yuk EMAS. Tizimga kiritilmagan eski qarzni qo'lda yozish uchun;
     u postavshikning `balance_total` iga qo'shiladi. */
  supplierDebts: (p?: Params) => list<SupplierDebt>("/api/supplier-debts/", p),
  supplierDebtsPage: paged<SupplierDebt>("/api/supplier-debts/"),
  createSupplierDebt: (data: SupplierDebtInput) =>
    request<SupplierDebt>("/api/supplier-debts/", { method: "POST", body: JSON.stringify(data) }),
  updateSupplierDebt: (id: number, data: Partial<SupplierDebtInput>) =>
    request<SupplierDebt>(`/api/supplier-debts/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteSupplierDebt: (id: number) => request<void>(`/api/supplier-debts/${id}/`, { method: "DELETE" }),
  createSupplierPayment: (data: SupplierPaymentInput) =>
    request<SupplierPayment>("/api/supplier-payments/", { method: "POST", body: JSON.stringify(data) }),
  updateSupplierPayment: (id: number, data: Partial<SupplierPaymentInput>) =>
    request<SupplierPayment>(`/api/supplier-payments/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteSupplierPayment: (id: number) => request<void>(`/api/supplier-payments/${id}/`, { method: "DELETE" }),
  /** ⚠️ `date_from`/`date_to` — balans (purchase/paid/debt) SHU DAVR bo'yicha
      hisoblanadi (deploy 20.08.2026). Ilgari bu endpointda sana filtri YO'Q edi va
      jamilar klientda yig'ilardi. */
  supplier: (id: number, p?: { date_from?: string; date_to?: string }) =>
    request<Supplier>(`/api/suppliers/${id}/${qs(p)}`),
  createSupplier: (data: SupplierInput) =>
    request<Supplier>("/api/suppliers/", { method: "POST", body: JSON.stringify(data) }),
  updateSupplier: (id: number, data: SupplierInput) =>
    request<Supplier>(`/api/suppliers/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteSupplier: (id: number) => request<void>(`/api/suppliers/${id}/`, { method: "DELETE" }),

  /* ===== FLORISTLAR ===== */
  florists: (p?: Params) => list<FloristProfile>("/api/florists/", p),
  florist: (id: number) => request<FloristProfile>(`/api/florists/${id}/`),
  createFlorist: (data: FloristInput) =>
    request<FloristProfile>("/api/florists/", { method: "POST", body: JSON.stringify(data) }),
  updateFlorist: (id: number, data: FloristInput) =>
    request<FloristProfile>(`/api/florists/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteFlorist: (id: number) => request<void>(`/api/florists/${id}/`, { method: "DELETE" }),
  /** Florist statistikasi (admin/supervisor, perm=florists). date_from/date_to inklyuziv `to`. */
  floristStats: (id: number, p?: { from?: string; to?: string }) =>
    request<FloristStats>(`/api/florists/${id}/stats/${qs({ date_from: p?.from, date_to: p?.to })}`),
  /** Floristning O'Z dashboardi (token'dan aniqlanadi). Bir xil struktura. */
  floristMeDashboard: (p?: { from?: string; to?: string }) =>
    request<FloristStats>(`/api/florists/me/dashboard/${qs({ date_from: p?.from, date_to: p?.to })}`),

  // Per-florist hajm tariflari. Matritsa TO'LIQ ALMASHTIRISH orqali saqlanadi —
  // `PATCH /florists/{id}/` ga barcha 6 qatorni `volume_rates` sifatida yuboring
  // (ro'yxatda bo'lmagan qator is_active:false bo'ladi). CRUD ham mavjud.
  // GET — o'qish uchun (composer FAOL tariflarni ?florist=&is_active=true bilan oladi).
  // GET — florist tariflarini o'qish (matritsa OCHILGANDA yangi GET qiladi:
  // ?florist=&is_active=true). To'g'ridan-to'g'ri yozuv (create/update/delete) YO'Q:
  // ular ataylab olib tashlandi — yagona yozuv yo'li saveFloristVolumeRates (to'liq
  // almashtirish), shunda unique-key dublikati va qayta-faollashtirish muammosi bo'lmaydi.
  floristVolumeRates: (p?: Params) => list<FloristVolumeRate>("/api/florist-volume-rates/", p),
  /** Florist tariflarini birdaniga saqlash — YAGONA yozuv yo'li (to'liq almashtirish:
      ro'yxatda bo'lmagan hajm is_active:false bo'ladi). */
  saveFloristVolumeRates: (floristId: number, volume_rates: VolumeRateInput[]) =>
    request<FloristProfile>(`/api/florists/${floristId}/`, { method: "PATCH", body: JSON.stringify({ volume_rates }) }),

  /* ===== FILIALLAR (branch) ===== */
  branches: (p?: Params) => list<Branch>("/api/branches/", p),
  /** Katalog nusxasini filialga yuborish (asosiy filial → Parkent). */
  transferCatalog: (id: number, data: CatalogTransferInput) =>
    request<CatalogTransfer>(`/api/catalog/${id}/transfer/`, { method: "POST", body: JSON.stringify(data) }),
  catalogTransfers: (p?: Params) => list<CatalogTransfer>("/api/catalog-transfers/", p),
  /** Admin filial hisoboti. date_from/date_to INKLYUZIV (accounting kabi). */
  branchReport: (p?: { branch?: number; from?: string; to?: string }) =>
    request<BranchReport>(`/api/branch-report/${qs({ branch: p?.branch, date_from: p?.from, date_to: p?.to })}`),

  /* ===== FLORISTGA GUL CHIQARISH ===== */
  /** Sklad → florist. Skladdan minus, florist balansiga plus. */
  floristStockIssue: (data: FloristStockIssueInput) =>
    request<FloristStockIssue>("/api/florist-stock-issues/issue/", { method: "POST", body: JSON.stringify(data) }),
  /** ⚠️ KO'P GULNI BITTA TRANZAKSIYADA chiqarish — bitta rowda qoldiq yetmasa HECH BIRI chiqmaydi
      (all-or-nothing). Ketma-ket POST'lar o'rniga. Javob: yaratilgan chiqimlar ro'yxati. */
  floristStockBulkIssue: (data: FloristStockBulkIssueInput) =>
    request<Paginated<FloristStockIssue>>("/api/florist-stock-issues/bulk-issue/", { method: "POST", body: JSON.stringify(data) }),
  /** Floristdan qaytarish (skladga tiklanadi) yoki chiqit (skladga qaytmaydi).
      `kind` DOIM yuboriladi — waste destruktiv, default'ga tayanmaymiz. */
  floristStockReturn: (data: FloristStockReturnInput) =>
    request<FloristStockIssue>("/api/florist-stock-issues/return/", { method: "POST", body: JSON.stringify(data) }),
  floristStockIssues: (p?: Params) => list<FloristStockIssue>("/api/florist-stock-issues/", p),
  floristStockIssuesPaged: (p: Params | undefined, onPage: (r: FloristStockIssue[], done: boolean) => void) => listPaged<FloristStockIssue>("/api/florist-stock-issues/", p, onPage),
  /** Chiqim/qaytarish/chiqit yozuvini TAHRIRLASH — faqat son va izoh (florist/partiya o'zgarmas).
      Farq skladga va florist balansiga avtomatik siljiydi (yo'nalish kind bo'yicha). */
  floristStockIssueEdit: (id: number, data: { quantity_stems?: number; reason?: string }) =>
    request<FloristStockIssue>(`/api/florist-stock-issues/${id}/edit/`, { method: "PATCH", body: JSON.stringify(data) }),
  /** ⚠️ BEKOR QILISH — DELETE, DESTRUKTIV va QAYTMAS: yozuv o'chadi, sklad+florist qoldig'i asl
      holiga qaytadi, sklad harakati ham o'chadi. Gul katalogda ishlatilgan bo'lsa 400 (bekor bo'lmaydi). */
  floristStockIssueCancel: (id: number) =>
    request<void>(`/api/florist-stock-issues/${id}/cancel/`, { method: "DELETE" }),
  /** Kimda qancha gul bor. Sukut: faqat remaining>0; hammasi uchun only_available=false. */
  floristStockBalances: (p?: Params) => list<FloristStockBalance>("/api/florist-stock-balances/", p),
  floristStockBalancesPaged: (p: Params | undefined, onPage: (r: FloristStockBalance[], done: boolean) => void) => listPaged<FloristStockBalance>("/api/florist-stock-balances/", p, onPage),

  /** Florist hisobini to'g'rilash — OLDINDAN KO'RISH. GET, bazaga TEGMAYDI: erkin chaqirsa bo'ladi.
      to_catalog: batch ixtiyoriy (berilmasa hamma qoldiq). to_florist: batch+quantity_stems MAJBURIY. */
  floristStockAdjustPreview: (p: { florist: number; direction?: AdjustDirection; batch?: number; quantity_stems?: number }) =>
    request<AdjustPreview>(`/api/florist-stock-balances/adjust-preview/${qs({ florist: p.florist, direction: p.direction, batch: p.batch, quantity_stems: p.quantity_stems })}`),
  /** ⚠️ BAJARISH — POST, DESTRUKTIV: katalog tarkibi va tannarxini (SOTILGANLARNIKI ham)
      qayta yozadi → hisob-kitobdagi sof foyda siljiydi. Faqat foydalanuvchi tasdig'idan keyin. */
  floristStockAdjust: (data: AdjustInput) =>
    request<AdjustResult>("/api/florist-stock-balances/adjust/", { method: "POST", body: JSON.stringify(data) }),

  /** CHIQIMNI YOPISH — OLDINDAN KO'RISH. GET, bazaga TEGMAYDI: erkin chaqirsa bo'ladi.
      batch MAJBURIY (har gul alohida). return_stems ixtiyoriy (sukut 0). */
  closeIssuePreview: (p: { florist: number; batch: number; return_stems?: number }) =>
    request<CloseIssuePreview>(`/api/florist-stock-balances/close-issue-preview/${qs({ florist: p.florist, batch: p.batch, return_stems: p.return_stems })}`),
  /** ⚠️ BAJARISH — POST: return_stems skladga qaytadi, qolgani guli yozilmagan kataloglarga
      taqsimlanadi (katalog tannarxi endi paydo bo'ladi → hisobot raqamlari siljiydi).
      Faqat foydalanuvchi tasdig'idan keyin. adjust'dan OLDINGI birinchi taqsimot. */
  closeIssue: (data: CloseIssueInput) =>
    request<CloseIssueResult>("/api/florist-stock-balances/close-issue/", { method: "POST", body: JSON.stringify(data) }),

  /** Joriy foydalanuvchining florist profili (o'z hisoboti uchun). Florist bo'lmasa 404. */
  floristMe: () => request<FloristProfile>("/api/florists/me/"),
  floristSalary: (p?: Params) => list<FloristSalaryEntry>("/api/florist-salary/", p),
  /**
   * ⚠️ QO'SHIMCHA OFORMLENIYA — POST /api/florists/{id}/decoration/
   * Spec: FRONTEND_FLORIST_DECORATION_SALARY_API.md · KONTRAKT (jonli OpenAPI'da HALI YO'Q).
   * ⚠️ HOLAT KODI MUHIM: 201 = yangi qator, 200 = o'sha kunning qatoriga QO'SHILDI.
   * Shu bois `requestWithStatus` — oddiy `request` kodni yo'qotardi.
   */
  addFloristDecoration: (id: number, data: Record<string, unknown>) =>
    requestWithStatus<FloristSalaryEntry>(`/api/florists/${id}/decoration/`, { method: "POST", body: JSON.stringify(data) }),
  /** ⚠️ `amount` yuborilsa ko'paytirish BEKOR bo'ladi — tanani `buildSalaryEditPayload` quradi. */
  updateFloristSalary: (id: number, data: Record<string, unknown>) =>
    request<FloristSalaryEntry>(`/api/florist-salary/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteFloristSalary: (id: number) =>
    request<void>(`/api/florist-salary/${id}/`, { method: "DELETE" }),
  createSalaryEntry: (data: Partial<FloristSalaryEntry>) =>
    request<FloristSalaryEntry>("/api/florist-salary/", { method: "POST", body: JSON.stringify(data) }),

  catalog: (p?: Params) => list<CatalogItem>("/api/catalog/", p),
  catalogPaged: (p: Params | undefined, onPage: (r: CatalogItem[], done: boolean) => void) => listPaged<CatalogItem>("/api/catalog/", p, onPage),
  createCatalogItem: (data: Record<string, unknown>) =>
    request<CatalogItem>("/api/catalog/", { method: "POST", body: JSON.stringify(data) }),
  updateCatalogItem: (id: number, data: Record<string, unknown>) =>
    request<CatalogItem>(`/api/catalog/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteCatalogItem: (id: number) => request<void>(`/api/catalog/${id}/`, { method: "DELETE" }),
  /** Katalogdan sotish. quantity berilmasa backend 1 ta deb oladi.
      Arzonroq sotilsa: sale_price (dona narxi) + discount_reason yuboriladi —
      backend chegirmani hisoblab history'ga yozadi. */
  /**
   * KATALOGDAN SOTISH — POST /api/catalog/{id}/sell/
   * Tana `buildSellPayload` da (sof funksiya, Vitest bilan qulflangan).
   */
  sellCatalogItem: (id: number, data?: SellInput) =>
    request<CatalogItem>(`/api/catalog/${id}/sell/`, { method: "POST", body: JSON.stringify(buildSellPayload(data)) }),
  catalogItem: (id: number) => request<CatalogItem>(`/api/catalog/${id}/`),
  /**
   * KATALOG SOTUV TARIXI — sahifalangan, `totals` BUTUN FILTR bo'yicha.
   * ⚠️ O'Z FILIALI bilan chegaralangan (jonli: accounting?branch=main bilan AYNAN teng).
   * ⚠️ Tannarx/foyda maydonlari YO'Q — filial foydalanuvchisiga xavfsiz.
   * ⚠️ `totals` OpenAPI'da e'lon qilinmagan (LIST 2).
   */
  catalogSales: (p?: Params) => request<CatalogSalesPage>(`/api/catalog/sales/${qs(p)}`),
  /** Bitta katalog sotuvlari — SAHIFALANMAYDI ({results, totals}); OpenAPI Paginated deydi (nomuvofiq). */
  catalogItemSales: (id: number) => request<CatalogSalesList>(`/api/catalog/${id}/sales/`),
  /** quantity berilmasa sotilgan-u hali yechilmagan hamma son yechiladi */
  deductCatalogStock: (id: number, quantity?: number) =>
    request<CatalogItem>(`/api/catalog/${id}/deduct_stock/`, { method: "POST", body: JSON.stringify(quantity ? { quantity } : {}) }),
  /** ⚠️ RESTAVRATSIYA — so'lgan gulni almashtirish. UCH ta ish birga: eski gul CHIQITga,
      yangi gul floristga CHIQARILADI, katalog tarkibi YANGILANADI. Javob: yangilangan katalog item. */
  restoreCatalogFlowers: (id: number, data: CatalogRestoreFlowersInput) =>
    request<CatalogItem>(`/api/catalog/${id}/restore-flowers/`, { method: "POST", body: JSON.stringify(data) }),

  /* ===== BRON (reservations) — mijoz oldindan to'lov (zaklad) ===== */
  reservations: (p?: Params) => list<Reservation>("/api/reservations/", p),
  reservation: (id: number) => request<Reservation>(`/api/reservations/${id}/`),
  createReservation: (data: ReservationInput) =>
    request<Reservation>("/api/reservations/", { method: "POST", body: JSON.stringify(data) }),
  updateReservation: (id: number, data: Partial<ReservationInput>) =>
    request<Reservation>(`/api/reservations/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  /** To'lov qo'shish — javob YARATILGAN to'lov (bronni refetch qilib jami/qoldiqni yangilaymiz). */
  addReservationPayment: (id: number, data: ReservationPaymentInput) =>
    request<ReservationPayment>(`/api/reservations/${id}/add-payment/`, { method: "POST", body: JSON.stringify(data) }),
  /** Bekor qilish — javob YANGILANGAN bron (status=cancelled). */
  cancelReservation: (id: number) =>
    request<Reservation>(`/api/reservations/${id}/cancel/`, { method: "POST", body: "{}" }),

  socialPosts: (p?: Params) => list<SocialPost>("/api/social-posts/", p),
  createSocialPost: (data: Partial<SocialPost>) =>
    request<SocialPost>("/api/social-posts/", { method: "POST", body: JSON.stringify(data) }),
  updateSocialPost: (id: number, data: Partial<SocialPost>) =>
    request<SocialPost>(`/api/social-posts/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteSocialPost: (id: number) =>
    request<void>(`/api/social-posts/${id}/`, { method: "DELETE" }),

  conversations: (p?: Params) => list<Conversation>("/api/conversations/", p),
  conversation: (id: number) => request<Conversation>(`/api/conversations/${id}/`),
  sendMessage: (id: number, text: string) =>
    request<Message>(`/api/conversations/${id}/send/`, { method: "POST", body: JSON.stringify({ text }) }),
  simulateMessage: (id: number, text: string) =>
    request<{ reply: string }>(`/api/conversations/${id}/simulate/`, { method: "POST", body: JSON.stringify({ text }) }),
  handoff: (id: number) =>
    request<Conversation>(`/api/conversations/${id}/handoff/`, { method: "POST", body: "{}" }),
  deleteConversation: (id: number) =>
    request<void>(`/api/conversations/${id}/`, { method: "DELETE" }),
  /** AI'ni vaqtincha/doimiy pauza qilish: {minutes} yoki {paused_until}; ikkalasisiz — doimiy */
  pauseAi: (id: number, data: { minutes?: number; paused_until?: string; reason?: string }) =>
    request<Conversation>(`/api/conversations/${id}/pause_ai/`, { method: "POST", body: JSON.stringify(data) }),
  resumeAi: (id: number) =>
    request<Conversation>(`/api/conversations/${id}/resume_ai/`, { method: "POST", body: "{}" }),

  /**
   * ⚠️ BITTA SAHIFA — sahifalar bo'ylab YURMAYDI.
   * `list()` bilan bu chaqiruv 378 ta bildirishnomada 4 ta HTTP so'rov yasardi va
   * u har mount'da hamda har noma'lum WS kadrida takrorlanardi (jonli o'lchov:
   * bitta sahifa ochilishida 13 ta so'rov). Sarlavhadagi qo'ng'iroq ro'yxati eng
   * yangi 100 tadan boshqasini KO'RSATMAYDI ham.
   */
  notifications: (p?: Params) =>
    request<Paginated<Notification>>(`/api/notifications/${qs({ page_size: 100, ...p })}`).then((d) => d.results),
  /** Bitta bildirishnomani o'qilgan qilish (yangi kanonik endpoint: mark-read/;
      eski /read/ ham ishlaydi, ikkisi bir xil — jonli tekshirilgan). */
  markNotificationRead: (id: number) =>
    request<Notification>(`/api/notifications/${id}/mark-read/`, { method: "POST", body: "{}" }),
  markAllNotificationsRead: () =>
    request<{ updated: number }>("/api/notifications/read_all/", { method: "POST", body: "{}" }),

  users: (p?: Params) => list<User>("/api/users/", p),
  createUser: (data: Record<string, unknown>) =>
    request<User>("/api/users/", { method: "POST", body: JSON.stringify(data) }),
  updateUser: (id: number, data: Record<string, unknown>) =>
    request<User>(`/api/users/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deactivateUser: (id: number) =>
    request<User>(`/api/users/${id}/deactivate/`, { method: "POST", body: "{}" }),

  /** sahifa ruxsatlari (kontrakt: GET/POST/PATCH /api/permissions/) */
  permissions: (p?: Params) => list<PagePermission>("/api/permissions/", p),
  createPermission: (data: Partial<PagePermission>) =>
    request<PagePermission>("/api/permissions/", { method: "POST", body: JSON.stringify(data) }),
  updatePermission: (id: number, data: Partial<PagePermission>) =>
    request<PagePermission>(`/api/permissions/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),

  instagramStatus: () => request<InstagramSettings>("/api/instagram/status/"),
  updateInstagramStatus: (data: Partial<InstagramSettings>) =>
    request<InstagramSettings>("/api/instagram/status/", { method: "PATCH", body: JSON.stringify(data) }),

  /** Instagram webhook hodisalari — developer debug jadvali (kontrakt) */
  instagramEvents: (p?: Params) => list<InstagramEvent>("/api/instagram/events/", p),

  /** AI sozlamalari — faqat developer (kontrakt) */
  aiSettings: () => request<AISettings>("/api/ai/settings/"),
  updateAiSettings: (data: Partial<AISettings>) =>
    request<AISettings>("/api/ai/settings/", { method: "PATCH", body: JSON.stringify(data) }),

  /** Integratsiya kalitlari — faqat developer (kontrakt) */
  integrations: () => request<IntegrationSettings>("/api/integrations/"),
  updateIntegrations: (data: Partial<IntegrationSettings>) =>
    request<IntegrationSettings>("/api/integrations/", { method: "PATCH", body: JSON.stringify(data) }),

  settings: () => request<BusinessSettings>("/api/settings/"),
  updateSettings: (data: Partial<BusinessSettings>) =>
    request<BusinessSettings>("/api/settings/", { method: "PATCH", body: JSON.stringify(data) }),

  upload: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<UploadResponse>("/api/uploads/", { method: "POST", body: fd });
  },

  packaging: (p?: Params) => list<Packaging>("/api/packaging/", p),
  packagingPage: (p?: Params, signal?: AbortSignal) => request<Paginated<Packaging>>(`/api/packaging/${qs(p)}`, { signal }),
  createPackaging: (data: Partial<Packaging>) =>
    request<Packaging>("/api/packaging/", { method: "POST", body: JSON.stringify(data) }),
  updatePackaging: (id: number, data: Partial<Packaging>) =>
    request<Packaging>(`/api/packaging/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  /** ⚠️ ARALASH: `cash_amount` + `card_amount` (backend 21.08.2026) — yig'indisi sotuv
      summasiga TENG bo'lishi shart, aks holda server rad etadi. */
  sellPackaging: (id: number, data: { quantity?: number; sale_price?: string; payment_type?: string; cash_amount?: string; card_amount?: string; reason?: string; sold_at?: string }) =>
    request<MaterialMovement>(`/api/packaging/${id}/sell/`, { method: "POST", body: JSON.stringify(data) }),

  /** Material sklad — /api/materials/* aliaslar (ichkarida Packaging modeli) */
  materials: (p?: Params) => list<Packaging>("/api/materials/", p),
  createMaterial: (data: Partial<Packaging>) =>
    request<Packaging>("/api/materials/", { method: "POST", body: JSON.stringify(data) }),
  updateMaterial: (id: number, data: Partial<Packaging>) =>
    request<Packaging>(`/api/materials/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  /** ⚠️ movement — CHIQIM/tuzatish uchun (kirim endi receive orqali: delivery+postavshik bilan). */
  materialMovement: (id: number, data: { movement_type: string; quantity: number; reason?: string }) =>
    request<Packaging>(`/api/materials/${id}/movement/`, { method: "POST", body: JSON.stringify(data) }),
  materialMovements: (p?: Params) => list<MaterialMovement>("/api/material-movements/", p),
  packagingMovements: (p?: Params) => list<MaterialMovement>("/api/packaging-movements/", p),
  packagingMovementsPage: (p?: Params, signal?: AbortSignal) => request<Paginated<MaterialMovement>>(`/api/packaging-movements/${qs(p)}`, { signal }),

  /* ===== MATERIAL YUKI (material-deliveries) — kirimlarni guruhlaydi (gul Yuki twin'i) ===== */
  materialDeliveries: (p?: Params) => list<MaterialDelivery>("/api/material-deliveries/", p),
  materialDelivery: (id: number) => request<MaterialDelivery>(`/api/material-deliveries/${id}/`),
  /** yuk ichiga kiritilgan materiallar = kirim harakatlari (delivery + unit_cost bilan) */
  materialDeliveryItems: (id: number, p?: Params) => list<MaterialMovement>(`/api/material-deliveries/${id}/items/`, p),
  createMaterialDelivery: (data: MaterialDeliveryInput) =>
    request<MaterialDelivery>("/api/material-deliveries/", { method: "POST", body: JSON.stringify(data) }),
  updateMaterialDelivery: (id: number, data: Partial<MaterialDeliveryInput>) =>
    request<MaterialDelivery>(`/api/material-deliveries/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  /** ⚠️ material KIRITISH — cost_price berilsa materialning tannarxini QAYTA YOZADI (retroaktiv:
      shu materialdan yasalgan ESKI kataloglar tannarxiga ta'sir). Faqat tasdiqdan keyin. */
  materialReceive: (id: number, data: MaterialReceiveInput) =>
    request<MaterialMovement>(`/api/material-deliveries/${id}/receive/`, { method: "POST", body: JSON.stringify(data) }),

  /* ===== AI KATALOG — mijozga ko'rsatiladigan katalog, ichki katalogdan alohida ===== */
  aiCatalog: (p?: Params) => list<AICatalogItem>("/api/ai-catalog/", p),
  createAICatalogItem: (data: AICatalogInput) =>
    request<AICatalogItem>("/api/ai-catalog/", { method: "POST", body: JSON.stringify(data) }),
  updateAICatalogItem: (id: number, data: Partial<AICatalogInput>) =>
    request<AICatalogItem>(`/api/ai-catalog/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteAICatalogItem: (id: number) => request<void>(`/api/ai-catalog/${id}/`, { method: "DELETE" }),

  /** Audit jurnali. Filtrlar SERVER tomonda:
      user (yoki user_id), action, entity_type, created_at_after/before, search */
  audit: (p?: Params) => list<AuditLog>("/api/audit/", p),

  /** Florist keldi-ketdi yozuvlari — check-in bildirishnomasidan o'tish uchun */
  attendance: (p?: Params) => list<FloristAttendance>("/api/florist-attendance/", p),
  attendanceEntry: (id: number) => request<FloristAttendance>(`/api/florist-attendance/${id}/`),
  attendanceCheckIn: (data?: { latitude?: number; longitude?: number }) =>
    request<FloristAttendance>("/api/florist-attendance/check-in/", { method: "POST", body: JSON.stringify(data ?? {}) }),
  attendanceCheckOut: (data?: { latitude?: number; longitude?: number }) =>
    request<FloristAttendance>("/api/florist-attendance/check-out/", { method: "POST", body: JSON.stringify(data ?? {}) }),

  // Eslatma: /api/mini-app/* endpointlari Telegram mini-ilova uchun
  // (init_data imzosi talab qilinadi) — CRM interfeysidan chaqirilmaydi.
};
