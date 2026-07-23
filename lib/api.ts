"use client";
import type {
  AISettings, Analytics, AuditLog, BusinessSettings, CatalogItem, Conversation, Customer, Dashboard,
  Flower, FlowerVariant, InstagramEvent, InstagramSettings, IntegrationSettings, Lead, LeadInput,
  LeadStatusDef, MaterialMovement, Message, Notification, Packaging, PagePermission, Paginated,
  SocialPost, StockBatch, StockMovement, UploadResponse, User,
} from "./types";

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

/** DRF maydon xatolarini {maydon: xabar} ko'rinishiga tekislaydi. */
function extractFieldErrors(body: unknown): Record<string, string> | undefined {
  if (typeof body !== "object" || body == null || Array.isArray(body)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v;
    else if (Array.isArray(v) && v.length && typeof v[0] === "string") out[k] = v.join(" ");
  }
  return Object.keys(out).length ? out : undefined;
}

function statusMessage(status: number, body: unknown): string {
  if (typeof body === "object" && body != null && "detail" in body) {
    return String((body as { detail: unknown }).detail);
  }
  const fields = extractFieldErrors(body);
  if (fields) {
    // masalan, dublikat post: {"media_id": "Bu Instagram media allaqachon ..."}
    return Object.values(fields).join(" · ");
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

export const api = {
  me: () => request<User>("/api/me/"),
  /** davr statistikasi uchun ?from=YYYY-MM-DD&to=YYYY-MM-DD berish mumkin */
  dashboard: (p?: { from?: string; to?: string }) => request<Dashboard>(`/api/dashboard/${qs(p)}`),
  /** Analitika — dashboard bilan bir xil ko'rish ruxsati */
  analytics: (p?: { from?: string; to?: string }) => request<Analytics>(`/api/analytics/${qs(p)}`),

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

  stockBatches: (p?: Params) => list<StockBatch>("/api/stock-batches/", p),
  stockBatch: (id: number) => request<StockBatch>(`/api/stock-batches/${id}/`),
  createStockBatch: (data: Partial<StockBatch>) =>
    request<StockBatch>("/api/stock-batches/", { method: "POST", body: JSON.stringify(data) }),
  updateStockBatch: (id: number, data: Partial<StockBatch>) =>
    request<StockBatch>(`/api/stock-batches/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  /** kontrakt tavsiyasi: o'chirish o'rniga PATCH {is_active:false} */
  deactivateStockBatch: (id: number) =>
    request<StockBatch>(`/api/stock-batches/${id}/`, { method: "PATCH", body: JSON.stringify({ is_active: false }) }),
  /** DIQQAT: javob shakli kafolatlanmagan (harakat obyekti qaytishi mumkin) —
      yangilangan partiya kerak bo'lsa api.stockBatch(id) bilan qayta o'qing */
  batchMovement: (id: number, data: Partial<StockMovement>) =>
    request<unknown>(`/api/stock-batches/${id}/movement/`, { method: "POST", body: JSON.stringify(data) }),

  stockMovements: (p?: Params) => list<StockMovement>("/api/stock-movements/", p),

  catalog: (p?: Params) => list<CatalogItem>("/api/catalog/", p),
  createCatalogItem: (data: Record<string, unknown>) =>
    request<CatalogItem>("/api/catalog/", { method: "POST", body: JSON.stringify(data) }),
  updateCatalogItem: (id: number, data: Record<string, unknown>) =>
    request<CatalogItem>(`/api/catalog/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  /** quantity berilmasa backend 1 ta deb oladi */
  sellCatalogItem: (id: number, quantity?: number) =>
    request<CatalogItem>(`/api/catalog/${id}/sell/`, { method: "POST", body: JSON.stringify(quantity ? { quantity } : {}) }),
  /** quantity berilmasa sotilgan-u hali yechilmagan hamma son yechiladi */
  deductCatalogStock: (id: number, quantity?: number) =>
    request<CatalogItem>(`/api/catalog/${id}/deduct_stock/`, { method: "POST", body: JSON.stringify(quantity ? { quantity } : {}) }),

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
  markNotificationRead: (id: number) =>
    request<Notification>(`/api/notifications/${id}/read/`, { method: "POST", body: "{}" }),
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
  materialMovement: (id: number, data: { movement_type: string; quantity: number; reason?: string }) =>
    request<Packaging>(`/api/materials/${id}/movement/`, { method: "POST", body: JSON.stringify(data) }),
  materialMovements: (p?: Params) => list<MaterialMovement>("/api/material-movements/", p),

  audit: (p?: Params) => list<AuditLog>("/api/audit/", p),

  // Eslatma: /api/mini-app/* endpointlari Telegram mini-ilova uchun
  // (init_data imzosi talab qilinadi) — CRM interfeysidan chaqirilmaydi.
};
