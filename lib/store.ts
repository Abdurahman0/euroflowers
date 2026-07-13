"use client";
import { create } from "zustand";
import { THEMES } from "./data";
import { api } from "./api";
import type { DateFilter, Notification, ThemeId, User } from "./types";

type State = {
  // sessiya
  user: User | null;
  userLoading: boolean;
  notifs: Notification[];
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
  setUser: (u: User | null) => void;
  setTheme: (t: ThemeId) => void;
  setDark: (d: boolean) => void;
  toggleSide: () => void;
  setDateFilter: (f: DateFilter) => void;
  showToast: (t: string) => void;
};

let toastTimer: ReturnType<typeof setTimeout>;

export const useStore = create<State>((set, get) => ({
  user: null,
  userLoading: true,
  notifs: [],
  themeId: "pushti",
  dark: false,
  sideOpen: true,
  dateFilter: "oy",
  toast: "",

  loadMe: async () => {
    set({ userLoading: true });
    try {
      const user = await api.me();
      set({ user, userLoading: false });
    } catch {
      set({ user: null, userLoading: false });
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

  setUser: (user) => set({ user }),
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

export const useTheme = () => {
  const themeId = useStore((s) => s.themeId);
  const dark = useStore((s) => s.dark);
  return { theme: THEMES.find((t) => t.id === themeId) ?? THEMES[0], dark };
};

export { THEMES };
