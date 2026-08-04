"use client";
import type {
  Accounting, AdjustDirection, AdjustInput, AdjustPreview, AdjustResult,
  CloseIssuePreview, CloseIssueInput, CloseIssueResult,
  AISettings, Analytics, AuditLog, BatchUsage, Branch, BranchReport, BusinessSettings, CatalogItem, CatalogTransfer, CatalogTransferInput, Conversation, Customer, Dashboard, Debt, DebtByCustomer,
  Expense, ExpenseCategories, ExpenseSummary, Flower, FloristAttendance, FloristInput, FloristProfile, FloristSalaryEntry, FloristStockBalance, FloristStockIssue, FloristStockIssueInput, FloristStockReturnInput, FloristVolumeRate, FlowerVariant,
  InstagramEvent, InstagramSettings, IntegrationSettings, Lead, LeadInput,
  LeadStatusDef, MaterialDelivery, MaterialDeliveryInput, MaterialMovement, MaterialReceiveInput, Message, Notification, Packaging, PagePermission, Paginated, PaymentType,
  Reservation, ReservationInput, ReservationPayment, ReservationPaymentInput, CatalogRestoreFlowersInput, FloristStockBulkIssueInput,
  CatalogSalesPage, CatalogSalesList, SocialPost, StockBatch, StockDelivery, StockDeliveryInput, StockMovement, Supplier, SupplierInput, SupplierPayment, SupplierPaymentInput, FloristStats, UploadResponse, User, VolumeRateInput,
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

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers, signal: ctrl.signal });
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === "AbortError";
    throw new ApiError(0, {
      detail: aborted ? "So'rov vaqti tugadi — internet sekin yoki server javob bermayapti" : "Server bilan aloqa yo'q — tarmoqni tekshiring",
    });
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 401 && retry && t) {
    const ok = await refreshAccess();
    if (ok) return request<T>(path, init, false);
    toLogin();
    throw new ApiError(401, { detail: "Sessiya tugadi — qayta kiring" });
  }

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
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

export const api = {
  me: () => request<User>("/api/me/"),
  // ⚠️ date_to ASIMMETRIYASI (lib/format): dashboard/analytics EKSKLYUZIV → +1
  // (dashboardDateTo); accounting INKLYUZIV → xom (accountingDateTo). YAGONA manba.
  dashboard: (p?: Period) => request<Dashboard>(`/api/dashboard/${qs({ from: p?.from, to: dashboardDateTo(p?.to), date_from: p?.from, date_to: dashboardDateTo(p?.to) })}`),
  analytics: (p?: Period) => request<Analytics>(`/api/analytics/${qs({ from: p?.from, to: dashboardDateTo(p?.to), date_from: p?.from, date_to: dashboardDateTo(p?.to) })}`),

  /** Hisob-kitob — date_to INKLYUZIV (o'zgarishsiz). branch: "all"|"main"|"<id>". */
  accounting: (p?: Period & { branch?: string }) => request<Accounting>(`/api/accounting/${qs({ date_from: p?.from, date_to: accountingDateTo(p?.to), from: p?.from, to: accountingDateTo(p?.to), branch: p?.branch })}`),
  /** Excel eksportlar — fayl (blob) sifatida yuklab olinadi */
  exportFlorist: (p?: { date_from?: string; date_to?: string; florist?: number }) => downloadFile("/api/exports/florist/", p, "florist-hisobot"),
  exportFlorists: (p?: { date_from?: string; date_to?: string }) => downloadFile("/api/exports/florists/", p, "floristlar-hisobot"),
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

  /* ===== RASXODLAR (ruxsat: `expenses`) ===== */
  expenses: (p?: Params) => request<Paginated<Expense>>(`/api/expenses/${qs(p)}`),
  expense: (id: number) => request<Expense>(`/api/expenses/${id}/`),
  createExpense: (data: Record<string, unknown>) =>
    request<Expense>("/api/expenses/", { method: "POST", body: JSON.stringify(data) }),
  updateExpense: (id: number, data: Record<string, unknown>) =>
    request<Expense>(`/api/expenses/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  /** ⚠️ 204 qaytaradi — tasdiq oynasi FRONTENDDA. */
  deleteExpense: (id: number) => request<void>(`/api/expenses/${id}/`, { method: "DELETE" }),
  /** ⚠️ Ro'yxat bilan AYNAN bir xil filtr berilishi SHART (buildExpenseQuery). */
  expenseSummary: (p?: Params) => request<ExpenseSummary>(`/api/expenses/summary/${qs(p)}`),
  /** Tur va to'lov usuli ro'yxati — QATTIQ YOZILMAYDI, shundan olinadi. */
  expenseCategories: () => request<ExpenseCategories>("/api/expenses/categories/"),

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

  stockMovements: (p?: Params) => list<StockMovement>("/api/stock-movements/", p),
  stockMovementsPage: (p?: Params) => request<Paginated<StockMovement>>(`/api/stock-movements/${qs({ page_size: 50, ...p })}`),

  /* ===== YETKAZIB BERUVCHILAR ===== */
  suppliers: (p?: Params) => list<Supplier>("/api/suppliers/", p),
  /** Yetkazib beruvchi to'lovlari — CRUD (backend 0082). on_delete=PROTECT postavshikda. */
  supplierPayments: (p?: Params) => list<SupplierPayment>("/api/supplier-payments/", p),
  createSupplierPayment: (data: SupplierPaymentInput) =>
    request<SupplierPayment>("/api/supplier-payments/", { method: "POST", body: JSON.stringify(data) }),
  updateSupplierPayment: (id: number, data: Partial<SupplierPaymentInput>) =>
    request<SupplierPayment>(`/api/supplier-payments/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteSupplierPayment: (id: number) => request<void>(`/api/supplier-payments/${id}/`, { method: "DELETE" }),
  supplier: (id: number) => request<Supplier>(`/api/suppliers/${id}/`),
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
  createSalaryEntry: (data: Partial<FloristSalaryEntry>) =>
    request<FloristSalaryEntry>("/api/florist-salary/", { method: "POST", body: JSON.stringify(data) }),

  catalog: (p?: Params) => list<CatalogItem>("/api/catalog/", p),
  createCatalogItem: (data: Record<string, unknown>) =>
    request<CatalogItem>("/api/catalog/", { method: "POST", body: JSON.stringify(data) }),
  updateCatalogItem: (id: number, data: Record<string, unknown>) =>
    request<CatalogItem>(`/api/catalog/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteCatalogItem: (id: number) => request<void>(`/api/catalog/${id}/`, { method: "DELETE" }),
  /** Katalogdan sotish. quantity berilmasa backend 1 ta deb oladi.
      Arzonroq sotilsa: sale_price (dona narxi) + discount_reason yuboriladi —
      backend chegirmani hisoblab history'ga yozadi. */
  sellCatalogItem: (id: number, data?: { quantity?: number; sale_price?: string; discount_reason?: string; payment_type?: PaymentType; sold_at?: string; reservation?: number; materials?: { packaging: number; quantity: number }[]; decoration_florist?: number }) =>
    request<CatalogItem>(`/api/catalog/${id}/sell/`, {
      method: "POST",
      body: JSON.stringify({
        ...(data?.quantity && data.quantity > 1 ? { quantity: data.quantity } : {}),
        ...(data?.sale_price ? { sale_price: data.sale_price } : {}),
        ...(data?.discount_reason ? { discount_reason: data.discount_reason } : {}),
        ...(data?.payment_type ? { payment_type: data.payment_type } : {}),
        ...(data?.sold_at ? { sold_at: data.sold_at } : {}),
        // ⚠️ BRON: berilsa backend history'ga bron ID + paid_amount + remaining_due yozadi (full narx savdoga kiradi)
        ...(data?.reservation ? { reservation: data.reservation } : {}),
        // ⚠️ SOTUVDA QO'SHILGAN: material quantity 1 DONA sotuv uchun (backend × quantity qiladi — oldindan ko'paytirmang).
        ...(data?.materials?.length ? { materials: data.materials } : {}),
        // ⚠️ SOTUV OFORMLENIYASI: catalog-yaratishdagi decoration'dan ALOHIDA (source=sale_decoration) salary yoziladi.
        ...(data?.decoration_florist ? { decoration_florist: data.decoration_florist } : {}),
      }),
    }),
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

  notifications: (p?: Params) => list<Notification>("/api/notifications/", p),
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
  createPackaging: (data: Partial<Packaging>) =>
    request<Packaging>("/api/packaging/", { method: "POST", body: JSON.stringify(data) }),
  updatePackaging: (id: number, data: Partial<Packaging>) =>
    request<Packaging>(`/api/packaging/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),

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

  /** Audit jurnali. Filtrlar SERVER tomonda:
      user (yoki user_id), action, entity_type, created_at_after/before, search */
  audit: (p?: Params) => list<AuditLog>("/api/audit/", p),

  /** Florist keldi-ketdi yozuvlari — check-in bildirishnomasidan o'tish uchun */
  attendance: (p?: Params) => list<FloristAttendance>("/api/florist-attendance/", p),
  attendanceEntry: (id: number) => request<FloristAttendance>(`/api/florist-attendance/${id}/`),

  // Eslatma: /api/mini-app/* endpointlari Telegram mini-ilova uchun
  // (init_data imzosi talab qilinadi) — CRM interfeysidan chaqirilmaydi.
};
