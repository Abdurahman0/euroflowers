"use client";
import { create } from "zustand";
import { THEMES } from "./data";
import { api } from "./api";
import { notifSocketUrl } from "./ws";
import type { DateFilter, Notification, PagePermission, PermissionPage, Role, ThemeId, User } from "./types";

type State = {
  // sessiya
  user: User | null;
  userLoading: boolean;
  /** sahifa ruxsatlari — login/me javobidan (kontrakt) */
  permissions: PagePermission[];
  notifs: Notification[];
  /** bildirishnoma WS ulangan — polling shunda o'chadi */
  wsConnected: boolean;
  // ui
  themeId: ThemeId;
  dark: boolean;
  sideOpen: boolean;
  dateFilter: DateFilter;
  toast: string;
  // actions
  loadMe: () => Promise<void>;
  loadNotifs: () => Promise<void>;
  markNotifRead: (id: number) => Promise<void>;
  markAllNotifsRead: () => Promise<void>;
  connectNotifWS: () => void;
  disconnectNotifWS: () => void;
  setUser: (u: User | null) => void;
  setTheme: (t: ThemeId) => void;
  setDark: (d: boolean) => void;
  toggleSide: () => void;
  setDateFilter: (f: DateFilter) => void;
  showToast: (t: string) => void;
};

let toastTimer: ReturnType<typeof setTimeout>;

// WS holati — store'dan tashqarida (re-render kerak emas)
let notifWS: WebSocket | null = null;
let wsRetryTimer: ReturnType<typeof setTimeout> | null = null;
let wsRetryDelay = 1000;
let wsWanted = false;

export const useStore = create<State>((set, get) => ({
  user: null,
  userLoading: true,
  permissions: [],
  notifs: [],
  wsConnected: false,
  themeId: "pushti",
  // standart — tungi mavzu; foydalanuvchi tanlovi (ef_theme) buni bosib o'tadi
  dark: true,
  sideOpen: true,
  dateFilter: "oy",
  toast: "",

  loadMe: async () => {
    set({ userLoading: true });
    try {
      const user = await api.me();
      set({ user, permissions: user.permissions ?? [], userLoading: false });
    } catch {
      set({ user: null, permissions: [], userLoading: false });
    }
  },

  loadNotifs: async () => {
    try {
      const notifs = await api.notifications({ ordering: "-created_at" });
      set({ notifs });
    } catch {
      /* header notifikatsiyasi — jim o'tkazamiz */
    }
  },

  markNotifRead: async (id) => {
    set((s) => ({ notifs: s.notifs.map((n) => (n.id === id ? { ...n, is_read: true } : n)) }));
    try {
      await api.markNotificationRead(id);
    } catch {
      get().loadNotifs();
    }
  },

  markAllNotifsRead: async () => {
    set((s) => ({ notifs: s.notifs.map((n) => ({ ...n, is_read: true })) }));
    try {
      await api.markAllNotificationsRead();
    } catch {
      get().loadNotifs();
    }
  },

  /**
   * Jonli bildirishnomalar — wss://…/ws/notifications/?token=<access>.
   * Ulanandi: polling o'chadi; uzilsa eksponensial backoff bilan qayta
   * ulanadi (1s→30s) va polling fallback yana ishlaydi. Idempotent.
   */
  connectNotifWS: () => {
    wsWanted = true;
    if (notifWS && (notifWS.readyState === WebSocket.OPEN || notifWS.readyState === WebSocket.CONNECTING)) return;
    const url = notifSocketUrl();
    if (!url) return;

    const ws = new WebSocket(url);
    notifWS = ws;

    ws.onopen = () => {
      wsRetryDelay = 1000;
      set({ wsConnected: true });
      // uzilish paytida o'tkazib yuborilganlarni sinxronlaymiz
      get().loadNotifs();
    };

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string);
        // moslashuvchan format: {notification: {...}} yoki bildirishnomaning o'zi
        const n = (data?.notification ?? data) as Partial<Notification>;
        if (n && typeof n.id === "number" && n.notification_type) {
          set((s) => ({
            notifs: s.notifs.some((x) => x.id === n.id)
              ? s.notifs.map((x) => (x.id === n.id ? ({ ...x, ...n } as Notification) : x))
              : [n as Notification, ...s.notifs],
          }));
          if (!n.is_read) get().showToast(`🔔 ${n.title_uz || n.title_ru || "Yangi bildirishnoma"}`);
        } else {
          // noma'lum xabar turi — ro'yxatni qayta o'qish arzon va doim to'g'ri
          get().loadNotifs();
        }
      } catch {
        get().loadNotifs();
      }
    };

    ws.onclose = () => {
      set({ wsConnected: false });
      notifWS = null;
      if (!wsWanted) return;
      if (wsRetryTimer) clearTimeout(wsRetryTimer);
      wsRetryTimer = setTimeout(async () => {
        wsRetryDelay = Math.min(wsRetryDelay * 2, 30000);
        // access muddati o'tgan bo'lishi mumkin — REST chaqiruv 401→refresh
        // zanjirini ishga tushiradi, keyin yangi token bilan ulanamiz
        await get().loadNotifs();
        get().connectNotifWS();
      }, wsRetryDelay);
    };

    ws.onerror = () => ws.close();
  },

  disconnectNotifWS: () => {
    wsWanted = false;
    if (wsRetryTimer) clearTimeout(wsRetryTimer);
    notifWS?.close();
    notifWS = null;
    set({ wsConnected: false });
  },

  setUser: (user) => set({ user, permissions: user?.permissions ?? [], userLoading: false }),
  setTheme: (themeId) => set({ themeId }),
  setDark: (dark) => set({ dark }),
  toggleSide: () => set((s) => ({ sideOpen: !s.sideOpen })),
  setDateFilter: (dateFilter) => set({ dateFilter }),

  showToast: (toast) => {
    clearTimeout(toastTimer);
    set({ toast });
    toastTimer = setTimeout(() => set({ toast: "" }), 3800);
  },
}));

/**
 * Ruxsat tekshiruvi. Backend ruxsat ro'yxati bo'lsa — u ustuvor;
 * bo'lmasa rol bo'yicha zaxira qoida (developer/admin — hammasi).
 */
const ROLE_FALLBACK: Record<Role, PermissionPage[]> = {
  developer: ["dashboard", "inventory", "catalog", "crm", "customers", "conversations", "social_posts", "notifications", "settings", "ai_settings", "integrations", "users", "mini_app", "audit"],
  admin: ["dashboard", "inventory", "catalog", "crm", "customers", "conversations", "social_posts", "notifications", "settings", "users", "audit"],
  operator: ["dashboard", "crm", "customers", "conversations", "catalog", "social_posts", "notifications"],
  florist: ["dashboard", "inventory", "catalog", "notifications"],
  warehouse: ["dashboard", "inventory", "catalog", "notifications"],
  content: ["dashboard", "catalog", "social_posts", "notifications"],
};

export function checkPerm(
  permissions: PagePermission[],
  role: Role | undefined,
  page: PermissionPage,
  kind: "view" | "control" = "view"
): boolean {
  const p = permissions.find((x) => x.page === page);
  if (p) return kind === "view" ? p.can_view : p.can_control;
  if (!role) return false;
  return ROLE_FALLBACK[role]?.includes(page) ?? false;
}

/** Sahifa ruxsatlari hooki: canView/canControl */
export const usePerm = () => {
  const permissions = useStore((s) => s.permissions);
  const role = useStore((s) => s.user?.profile.role);
  return {
    canView: (page: PermissionPage) => checkPerm(permissions, role, page, "view"),
    canControl: (page: PermissionPage) => checkPerm(permissions, role, page, "control"),
  };
};

export const useTheme = () => {
  const themeId = useStore((s) => s.themeId);
  const dark = useStore((s) => s.dark);
  return { theme: THEMES.find((t) => t.id === themeId) ?? THEMES[0], dark };
};

export { THEMES };
