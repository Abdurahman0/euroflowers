"use client";
import { create } from "zustand";
import { THEMES } from "./data";
import { api } from "./api";
import { notifSocketUrl } from "./ws";
import type { DateFilter, DateRange, Notification, PagePermission, PermissionPage, Role, ThemeId, User } from "./types";

type State = {
  // sessiya
  user: User | null;
  userLoading: boolean;
  /** sahifa ruxsatlari — login/me javobidan (kontrakt) */
  permissions: PagePermission[];
  notifs: Notification[];
  /** bildirishnoma WS ulangan — polling shunda o'chadi */
  wsConnected: boolean;
  /** fon bog' videosi ovozi (sessiya ichida saqlanadi, reload'da mute) */
  soundOn: boolean;
  setSoundOn: (v: boolean) => void;
  /** past quvvat rejimi — video o'rniga poster, ovoz tugmasi yashirin */
  gardenPosterOnly: boolean;
  setGardenPosterOnly: (v: boolean) => void;
  /** interfeys rejimi: "premium" — to'liq dekor/effektlar, "yengil" — tez va oddiy */
  uiMode: "premium" | "yengil";
  setUiMode: (m: "premium" | "yengil") => void;
  /** orqa fon rejimi: "rasm" — statik gul dekor (standart), "video" — bog' videosi */
  bgMode: "rasm" | "video";
  setBgMode: (m: "rasm" | "video") => void;
  // ui
  themeId: ThemeId;
  dark: boolean;
  sideOpen: boolean;
  dateFilter: DateFilter;
  /** null — segment (bugun/7/30) amalda; aks holda maxsus kalendar oraliq */
  dateRange: DateRange | null;
  toast: string;
  /** yangi kelgan bildirishnoma uchun bosiladigan toast-karta */
  notifToast: Notification | null;
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
  setDateRange: (r: DateRange | null) => void;
  showToast: (t: string) => void;
  pushNotifToast: (n: Notification) => void;
  clearNotifToast: () => void;
};

let toastTimer: ReturnType<typeof setTimeout>;
let notifToastTimer: ReturnType<typeof setTimeout>;
// polling orqali kelganda 'yangi'ni aniqlash uchun — oldin ko'rilgan idlar
let seenNotifIds: Set<number> | null = null;

// WS holati — store'dan tashqarida (re-render kerak emas)
let notifWS: WebSocket | null = null;
let wsRetryTimer: ReturnType<typeof setTimeout> | null = null;
let wsRetryDelay = 1000;
let wsWanted = false;
/** ⚠️ Ketma-ket muvaffaqiyatsiz urinishlar — cheksiz aylanishning oldini oladi. */
let wsFailures = 0;
/** Shundan keyin qayta ulanish TO'XTAYDI: 60 s lik polling zaxirasi ishlaydi. */
const WS_MAX_FAILURES = 6;
/** Ulanish shu muddat TURIB QOLSAgina «muvaffaqiyatli» deb hisoblanadi. */
const WS_STABLE_MS = 10_000;
let wsOpenedAt = 0;
/** Oxirgi bildirishnoma sinxroni — titragan soket qayta-qayta so'ratmasin. */
let lastNotifSyncAt = 0;
const NOTIF_SYNC_MIN_GAP_MS = 30_000;
/** Eng ko'pi 30 soniyada bir marta bildirishnomalarni qayta o'qish. */
const syncNotifsThrottled = (get: () => State) => {
  if (Date.now() - lastNotifSyncAt < NOTIF_SYNC_MIN_GAP_MS) return;
  lastNotifSyncAt = Date.now();
  get().loadNotifs();
};

export const useStore = create<State>((set, get) => ({
  user: null,
  userLoading: true,
  permissions: [],
  notifs: [],
  wsConnected: false,
  soundOn: false,
  setSoundOn: (soundOn) => set({ soundOn }),
  gardenPosterOnly: false,
  setGardenPosterOnly: (gardenPosterOnly) => set({ gardenPosterOnly }),
  uiMode: "premium",
  setUiMode: (uiMode) => {
    if (typeof window !== "undefined") localStorage.setItem("ef_uimode", uiMode);
    set({ uiMode });
  },
  // standart fon — video ("liquid glass"); foydalanuvchi tanlovi (ef_bgmode) buni bosib o'tadi
  bgMode: "video",
  setBgMode: (bgMode) => set({ bgMode }),
  themeId: "pushti",
  // standart — tungi mavzu; foydalanuvchi tanlovi (ef_theme) buni bosib o'tadi
  dark: true,
  sideOpen: true,
  dateFilter: "oy",
  dateRange: null,
  toast: "",
  notifToast: null,

  loadMe: async () => {
    set({ userLoading: true });
    try {
      const user = await api.me();
      // ⚠️ FILIAL GATING FAIL-OPEN himoyasi: /api/me/ profile'da `branch` kaliti bo'lmasa
      // (schema uni majburiy demaydi) — biz ASOSIY deb olamiz, bu filial userni CHEKLAMAY
      // butun CRM'ni ochib qo'yishi mumkin. Shu holatni baland ovoz bilan ogohlantiramiz.
      if (user?.profile && !("branch" in user.profile)) {
        console.warn("[branch] /api/me/ profile has no `branch` key — treating as MAIN (unrestricted). If this is a branch user, nav/route gating FAILS OPEN.");
      }
      set({ user, permissions: user.permission_matrix ?? user.permissions ?? [], userLoading: false });
      // /api/me va notificationlar parallel boshlanishi mumkin; user aniqlangach
      // florist workspace uchun ruxsat etilgan notificationlarni qayta sinxronlaymiz.
      if (user.profile.role === "florist" || user.profile.role === "apprentice") get().loadNotifs();
    } catch {
      set({ user: null, permissions: [], userLoading: false });
    }
  },

  loadNotifs: async () => {
    try {
      const rawNotifs = await api.notifications({ ordering: "-created_at" });
      const role = get().user?.profile.role;
      const notifs = role === "florist" || role === "apprentice"
        ? rawNotifs.filter((n) => ["florist_salary", "attendance", "florist_catalog"].includes(n.notification_type))
        : rawNotifs;
      // polling fallback ham yangi bildirishnomani toast qiladi (WS'siz rejim)
      if (seenNotifIds) {
        const fresh = notifs.find((n) => !n.is_read && !seenNotifIds!.has(n.id));
        if (fresh) get().pushNotifToast(fresh);
      }
      seenNotifIds = new Set(notifs.map((n) => n.id));
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
      wsOpenedAt = Date.now();
      set({ wsConnected: true });
      /**
       * ⚠️ Bildirishnomalar FAQAT ulanish muvaffaqiyatli bo'lganda sinxronlanadi
       * (uzilishda o'tkazib yuborilganini olish uchun) VA eng ko'pi 30 soniyada
       * bir marta. Soket ochilib-uzilib turganda (jonli holat) har «onopen» da
       * so'rov yuborilsa, 9 soniyada 13 ta so'rov chiqardi — endi 1 ta.
       */
      syncNotifsThrottled(get);
    };

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string);
        // moslashuvchan format: {notification: {...}} yoki bildirishnomaning o'zi
        const n = (data?.notification ?? data) as Partial<Notification>;
        if (n && typeof n.id === "number" && n.notification_type) {
          const staff = get().user?.profile.role === "florist" || get().user?.profile.role === "apprentice";
          if (staff && !["florist_salary", "attendance", "florist_catalog"].includes(n.notification_type)) return;
          set((s) => ({
            notifs: s.notifs.some((x) => x.id === n.id)
              ? s.notifs.map((x) => (x.id === n.id ? ({ ...x, ...n } as Notification) : x))
              : [n as Notification, ...s.notifs],
          }));
          if (!n.is_read) get().pushNotifToast(n as Notification);
          // supplier_stock — yangi partiya keldi: ochiq sklad sahifalari darhol
          // yangilanadi (query-cache yo'q — window hodisasi bilan xabar beramiz)
          if (n.notification_type === "supplier_stock" && typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("ef:stock-changed", { detail: n }));
          }
        } else {
          /**
           * ⚠️ NOMA'LUM KADR — «arzon» emas ekan. Server ulanish tasdig'i va
           * keepalive kabi bildirishnoma BO'LMAGAN kadrlarni ham yuboradi; har
           * biriga to'liq ro'yxatni qayta so'rash jonli o'lchovda 9 soniyada
           * 13 ta so'rov bergan edi. Endi bunday kadr eng ko'pi 30 soniyada bir
           * marta sinxronga sabab bo'ladi (haqiqiy bildirishnoma yuqorida,
           * to'g'ridan-to'g'ri qo'shiladi va bu yo'lga umuman tushmaydi).
           */
          syncNotifsThrottled(get);
        }
      } catch {
        syncNotifsThrottled(get);
      }
    };

    /**
     * ⚠️ TUZATILDI — qayta ulanish yo'lida BILDIRISHNOMA SO'RALMAYDI.
     * Ilgari har urinishdan oldin `await loadNotifs()` bajarilardi. Soket umuman
     * ko'tarilmaydigan holatda (muddati o'tgan token, wss'ni bloklaydigan proksi)
     * bu foydalanuvchi hech narsa qilmasa ham 30 soniyada bir marta abadiy
     * takrorlanadigan so'rov halqasiga aylanardi.
     * Endi: ro'yxat FAQAT `onopen` da bir marta o'qiladi; soket tushib qolgan
     * holatni Shell'dagi 60 soniyalik zaxira polling qoplaydi (u allaqachon
     * `wsConnected` ni tekshiradi).
     * ⚠️ Urinishlar CHEKLANGAN: WS_MAX_FAILURES dan keyin to'xtaymiz — aks holda
     * auth muammosi cheksiz aylanardi.
     */
    ws.onclose = () => {
      set({ wsConnected: false });
      notifWS = null;
      if (!wsWanted) return;
      /**
       * ⚠️ «TITRAGAN» SOKET. Hisoblagichni `onopen` da nolga tushirish YETMAYDI:
       * server qo'l siqishdan keyin darhol uzsa, ochilish-uzilish aylanmasi
       * cheksiz davom etardi va HAR ochilishda bildirishnomalar qayta so'ralardi
       * (jonli o'lchov: 9 soniyada 13 ta so'rov). Shu bois ulanish FAQAT
       * WS_STABLE_MS dan uzoq turgan bo'lsa muvaffaqiyatli sanaladi.
       */
      const stable = wsOpenedAt > 0 && Date.now() - wsOpenedAt >= WS_STABLE_MS;
      if (stable) { wsFailures = 0; wsRetryDelay = 1000; }
      wsOpenedAt = 0;
      if (++wsFailures > WS_MAX_FAILURES) return;   // zaxira polling ishlayveradi
      if (wsRetryTimer) clearTimeout(wsRetryTimer);
      wsRetryTimer = setTimeout(() => {
        wsRetryDelay = Math.min(wsRetryDelay * 2, 30000);
        get().connectNotifWS();
      }, wsRetryDelay);
    };

    ws.onerror = () => ws.close();
  },

  disconnectNotifWS: () => {
    wsWanted = false;
    wsFailures = 0;
    wsRetryDelay = 1000;
    wsOpenedAt = 0;
    if (wsRetryTimer) clearTimeout(wsRetryTimer);
    notifWS?.close();
    notifWS = null;
    set({ wsConnected: false });
  },

  setUser: (user) => set({ user, permissions: user?.permission_matrix ?? user?.permissions ?? [], userLoading: false }),
  setTheme: (themeId) => set({ themeId }),
  setDark: (dark) => set({ dark }),
  toggleSide: () => set((s) => ({ sideOpen: !s.sideOpen })),
  setDateFilter: (dateFilter) => set({ dateFilter, dateRange: null }),
  setDateRange: (dateRange) => set({ dateRange }),

  showToast: (toast) => {
    clearTimeout(toastTimer);
    set({ toast });
    toastTimer = setTimeout(() => set({ toast: "" }), 3800);
  },

  pushNotifToast: (n) => {
    seenNotifIds?.add(n.id); // keyingi poll qayta toast qilmasin
    clearTimeout(notifToastTimer);
    set({ notifToast: n });
    notifToastTimer = setTimeout(() => set({ notifToast: null }), 6000);
  },
  clearNotifToast: () => {
    clearTimeout(notifToastTimer);
    set({ notifToast: null });
  },
}));

// e2e/debug: store'ga konsoldan kirish (window.__efStore)
if (typeof window !== "undefined") {
  (window as unknown as { __efStore?: typeof useStore }).__efStore = useStore;
}

/**
 * Ruxsat tekshiruvi. Backend ruxsat ro'yxati bo'lsa — u ustuvor;
 * bo'lmasa rol bo'yicha zaxira qoida (developer/admin — hammasi).
 */
const ROLE_FALLBACK: Record<Role, PermissionPage[]> = {
  developer: ["dashboard", "inventory", "catalog", "crm", "customers", "conversations", "social_posts", "notifications", "suppliers", "florists", "attendance", "settings", "ai_settings", "integrations", "users", "mini_app", "audit"],
  admin: ["dashboard", "inventory", "catalog", "crm", "customers", "conversations", "social_posts", "notifications", "suppliers", "florists", "attendance", "settings", "users", "audit"],
  operator: ["dashboard", "crm", "customers", "conversations", "catalog", "social_posts", "notifications"],
  florist: ["notifications", "attendance", "florists"],
  apprentice: ["notifications", "attendance", "florists"],
  supervisor: ["dashboard", "inventory", "catalog", "crm", "customers", "conversations", "suppliers", "florists", "attendance", "notifications"],
  warehouse: ["dashboard", "inventory", "catalog", "notifications", "suppliers"],
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
  // backend to'liq matritsa yuborgan — unda YO'Q sahifa = ruxsat YO'Q
  // (rol bo'yicha zaxira faqat matritsa umuman kelmaganda ishlaydi)
  if (permissions.length > 0) return false;
  if (!role) return false;
  return ROLE_FALLBACK[role]?.includes(page) ?? false;
}

/** Sahifa ruxsatlari hooki: canView/canControl (bir nechta sahifa berilsa —
    ULARDAN BIRORTASI yetarli; backend ruxsat sahifalarini ajratgan: masalan
    florists/suppliers/attendance ilgari settings/inventory ostida edi). */
export const usePerm = () => {
  const permissions = useStore((s) => s.permissions);
  const role = useStore((s) => s.user?.profile.role);
  return {
    canView: (...pages: PermissionPage[]) => pages.some((p) => checkPerm(permissions, role, p, "view")),
    canControl: (...pages: PermissionPage[]) => pages.some((p) => checkPerm(permissions, role, p, "control")),
  };
};

export const useTheme = () => {
  const themeId = useStore((s) => s.themeId);
  const dark = useStore((s) => s.dark);
  return { theme: THEMES.find((t) => t.id === themeId) ?? THEMES[0], dark };
};

export { THEMES };
