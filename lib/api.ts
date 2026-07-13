"use client";
import type {
  AuditLog, Branch, BusinessSettings, CatalogItem, Conversation, Customer, Dashboard, Flower,
  FlowerVariant, InstagramSettings, Lead, Message, Notification, Packaging, Paginated, SocialPost,
  StockBatch, StockMovement, UploadResponse, User,
} from "./types";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://192.168.1.5:8000";

const TOKEN_KEY = "ef_tokens";

type Tokens = { access: string; refresh: string };

export function getTokens(): Tokens | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

export function setTokens(t: Tokens) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(t));
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  return getTokens() != null;
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(typeof body === "object" && body != null && "detail" in body
      ? String((body as { detail: unknown }).detail)
      : `API xatosi (${status})`);
    this.status = status;
    this.body = body;
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
      setTokens({ access: data.access, refresh: data.refresh ?? t.refresh });
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
  const t = getTokens();
  const headers: Record<string, string> = {
    ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...(init.headers as Record<string, string> | undefined),
  };
  if (t) headers.Authorization = `Bearer ${t.access}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, { detail: "Server bilan aloqa yo'q — tarmoqni tekshiring" });
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

// fetch one big page; enough for this CRM's data volumes
const list = <T,>(path: string, params?: Params) =>
  request<Paginated<T>>(`${path}${qs({ page_size: 200, ...params })}`).then((r) => r.results);

// ===== Auth =====

export async function login(username: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/auth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  setTokens(body as Tokens);
}

export function logout() {
  const t = getTokens();
  if (t) {
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
  dashboard: () => request<Dashboard>("/api/dashboard/"),

  branches: (p?: Params) => list<Branch>("/api/branches/", p),

  leads: (p?: Params) => list<Lead>("/api/leads/", p),
  lead: (id: number) => request<Lead>(`/api/leads/${id}/`),
  createLead: (data: Partial<Lead>) =>
    request<Lead>("/api/leads/", { method: "POST", body: JSON.stringify(data) }),
  updateLead: (id: number, data: Partial<Lead>) =>
    request<Lead>(`/api/leads/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),

  customers: (p?: Params) => list<Customer>("/api/customers/", p),
  customer: (id: number) => request<Customer>(`/api/customers/${id}/`),
  updateCustomer: (id: number, data: Partial<Customer>) =>
    request<Customer>(`/api/customers/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),

  flowers: (p?: Params) => list<Flower>("/api/flowers/", p),
  flowerVariants: (p?: Params) => list<FlowerVariant>("/api/flower-variants/", p),
  createFlowerVariant: (data: Partial<FlowerVariant>) =>
    request<FlowerVariant>("/api/flower-variants/", { method: "POST", body: JSON.stringify(data) }),
  createFlower: (data: Partial<Flower>) =>
    request<Flower>("/api/flowers/", { method: "POST", body: JSON.stringify(data) }),

  stockBatches: (p?: Params) => list<StockBatch>("/api/stock-batches/", p),
  createStockBatch: (data: Partial<StockBatch>) =>
    request<StockBatch>("/api/stock-batches/", { method: "POST", body: JSON.stringify(data) }),
  updateStockBatch: (id: number, data: Partial<StockBatch>) =>
    request<StockBatch>(`/api/stock-batches/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  batchMovement: (id: number, data: Partial<StockMovement>) =>
    request<StockBatch>(`/api/stock-batches/${id}/movement/`, { method: "POST", body: JSON.stringify(data) }),

  stockMovements: (p?: Params) => list<StockMovement>("/api/stock-movements/", p),

  catalog: (p?: Params) => list<CatalogItem>("/api/catalog/", p),
  createCatalogItem: (data: Record<string, unknown>) =>
    request<CatalogItem>("/api/catalog/", { method: "POST", body: JSON.stringify(data) }),
  updateCatalogItem: (id: number, data: Record<string, unknown>) =>
    request<CatalogItem>(`/api/catalog/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),
  sellCatalogItem: (id: number) =>
    request<CatalogItem>(`/api/catalog/${id}/sell/`, { method: "POST", body: "{}" }),
  deductCatalogStock: (id: number) =>
    request<CatalogItem>(`/api/catalog/${id}/deduct_stock/`, { method: "POST", body: "{}" }),

  socialPosts: (p?: Params) => list<SocialPost>("/api/social-posts/", p),
  createSocialPost: (data: Partial<SocialPost>) =>
    request<SocialPost>("/api/social-posts/", { method: "POST", body: JSON.stringify(data) }),
  updateSocialPost: (id: number, data: Partial<SocialPost>) =>
    request<SocialPost>(`/api/social-posts/${id}/`, { method: "PATCH", body: JSON.stringify(data) }),

  conversations: (p?: Params) => list<Conversation>("/api/conversations/", p),
  conversation: (id: number) => request<Conversation>(`/api/conversations/${id}/`),
  sendMessage: (id: number, text: string) =>
    request<Message>(`/api/conversations/${id}/send/`, { method: "POST", body: JSON.stringify({ text }) }),
  simulateMessage: (id: number, text: string) =>
    request<{ reply: string }>(`/api/conversations/${id}/simulate/`, { method: "POST", body: JSON.stringify({ text }) }),
  handoff: (id: number) =>
    request<Conversation>(`/api/conversations/${id}/handoff/`, { method: "POST", body: "{}" }),
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

  instagramStatus: () => request<InstagramSettings>("/api/instagram/status/"),
  updateInstagramStatus: (data: Partial<InstagramSettings>) =>
    request<InstagramSettings>("/api/instagram/status/", { method: "PATCH", body: JSON.stringify(data) }),

  settings: () => request<BusinessSettings>("/api/settings/"),
  updateSettings: (data: Partial<BusinessSettings>) =>
    request<BusinessSettings>("/api/settings/", { method: "PATCH", body: JSON.stringify(data) }),

  upload: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<UploadResponse>("/api/uploads/", { method: "POST", body: fd });
  },

  packaging: (p?: Params) => list<Packaging>("/api/packaging/", p),

  audit: (p?: Params) => list<AuditLog>("/api/audit/", p),
};
