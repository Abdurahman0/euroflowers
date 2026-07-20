"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { usePerm, useStore, useTheme } from "@/lib/store";
import type { PermissionPage } from "@/lib/types";
import { isLoggedIn } from "@/lib/api";
import Sidebar from "./Sidebar";
import Header from "./Header";
import Toast from "./Toast";
import NotifToast from "./NotifToast";
import GardenBackground from "./GardenBackground";
import SoundToggle from "./SoundToggle";
import FlowerLoader from "./FlowerLoader";
import PetalBurst from "./PetalBurst";

const AmbientScene = dynamic(() => import("./three/AmbientScene"), { ssr: false });
const ParallaxController = dynamic(() => import("./three/engine/ParallaxController"), { ssr: false });
const BotanicalGarden = dynamic(() => import("./three/engine/BotanicalGarden"), { ssr: false });
const PremiumPeony = dynamic(() => import("./flowers/PremiumPeony"), { ssr: false });

/** Marshrut → ruxsat sahifasi — Sidebar NAV bilan bir xil xarita.
    Ruxsati yo'q sahifa to'g'ridan-to'g'ri URL orqali ham ochilmaydi. */
const ROUTE_PERM: Record<string, PermissionPage> = {
  "/": "dashboard",
  "/chat": "conversations",
  "/ai": "settings",
  "/crm": "crm",
  "/sklad": "inventory",
  "/gullar": "inventory",
  "/katalog": "catalog",
  "/postlar": "social_posts",
  "/bildirishnomalar": "notifications",
  "/xodimlar": "users",
  "/integratsiyalar": "integrations",
  "/audit": "audit",
  "/sozlamalar": "settings",
};

/** Butun ilova qobig'i: tema CSS o'zgaruvchilari, tirik fon, auth-guard, sidebar + main panel. */
export default function Shell({ children }: { children: React.ReactNode }) {
  const { theme, dark } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const { user, userLoading, loadMe, loadNotifs, setTheme, setDark, gardenPosterOnly, bgMode, setBgMode, sideOpen, toggleSide, uiMode, setUiMode } = useStore();
  const isLogin = pathname.startsWith("/login");
  const { canView } = usePerm();
  const permPage = ROUTE_PERM[pathname];
  // foydalanuvchi yuklangach: ruxsatsiz sahifa ko'rsatilmaydi
  const routeAllowed = !user || !permPage || canView(permPage);

  // video rejimda element krossfeyd tugaguncha (400ms) DOM'da qoladi;
  // "rasm" bilan yangi ochilishda esa umuman mount bo'lmaydi (mp4 so'rovi yo'q)
  // YENGIL rejim: hech qanday dekor/video/effekt — faqat toza yuzalar
  const lite = uiMode === "yengil";
  const showVideo = bgMode === "video" && !lite;
  const [videoMounted, setVideoMounted] = useState(showVideo);
  // video rejimda shisha yuzalar zichlashadi (globals: .bg-video)
  useEffect(() => {
    document.documentElement.classList.toggle("bg-video", showVideo);
    return () => document.documentElement.classList.remove("bg-video");
  }, [showVideo]);
  useEffect(() => {
    if (showVideo) {
      setVideoMounted(true);
      return;
    }
    // rasm rejimiga qaytdik: element yo'qoladi — ovoz holati ham nolga
    // (yangi video element doim mute boshlanadi; holat mos bo'lsin)
    useStore.getState().setSoundOn(false);
    const t = setTimeout(() => setVideoMounted(false), 650);
    return () => clearTimeout(t);
  }, [showVideo]);

  // yengil rejimda ildizga ui-lite klassi — blur/animatsiyalar CSS'da o'chadi
  useEffect(() => {
    document.documentElement.classList.toggle("ui-lite", lite);
    return () => document.documentElement.classList.remove("ui-lite");
  }, [lite]);

  // dekor qatlami: yengilga o'tishda 400ms so'nib, keyin butunlay unmount
  const [decorMounted, setDecorMounted] = useState(!lite);
  useEffect(() => {
    if (!lite) {
      setDecorMounted(true);
      return;
    }
    const t = setTimeout(() => setDecorMounted(false), 450);
    return () => clearTimeout(t);
  }, [lite]);

  // orqa fon rejimi + interfeys rejimini tiklash — mavzu bilan bir xil mexanizm
  useEffect(() => {
    const saved = localStorage.getItem("ef_bgmode");
    if (saved === "video" || saved === "rasm") setBgMode(saved);
    const savedUi = localStorage.getItem("ef_uimode");
    if (savedUi === "premium" || savedUi === "yengil") {
      setUiMode(savedUi);
      // yengil saqlangan bo'lsa dekor DARHOL unmount — fade kutmaymiz,
      // aks holda gidratsiya oynasida gul teksturalari so'ralib qoladi
      if (savedUi === "yengil") setDecorMounted(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const bgSaveArmed = useRef(false);
  useEffect(() => {
    if (bgSaveArmed.current) localStorage.setItem("ef_bgmode", bgMode);
    else bgSaveArmed.current = true;
  }, [bgMode]);

  // saqlangan mavzuni tiklash — bir marta, gidratsiyadan keyin
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("ef_theme") ?? "{}") as { id?: string; dark?: boolean };
      if (saved.id) setTheme(saved.id as never);
      // faqat foydalanuvchi tanlovi — avtomatik almashish yo'q
      if (typeof saved.dark === "boolean") setDark(saved.dark);
    } catch {
      /* buzuq qiymat — standart mavzu qoladi */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const themeSaveArmed = useRef(false);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.dataset.theme = theme.id;
    // semantik tokenlar — aksent palitrasi butun tizimga tarqaladi
    root.style.setProperty("--primary", theme.accent);
    root.style.setProperty("--primary-strong", theme.strong);
    root.style.setProperty("--accL", theme.accL);
    root.style.setProperty("--side", theme.dark);
    root.style.setProperty("--bg", dark ? theme.dark : theme.light);
    // birinchi ishga tushishda YOZMAYMIZ — aks holda tiklash effekti qo'llagan
    // saqlangan qiymatni eski (standart) holat bosib o'tadi (StrictMode poygasi)
    if (themeSaveArmed.current) {
      localStorage.setItem("ef_theme", JSON.stringify({ id: theme.id, dark }));
    } else {
      themeSaveArmed.current = true;
    }
  }, [theme, dark]);

  // tab yashirin — barcha bezak animatsiyalar pauza (CPU/GPU tinim oladi)
  useEffect(() => {
    const fn = () => document.documentElement.classList.toggle("app-hidden", document.hidden);
    document.addEventListener("visibilitychange", fn);
    return () => document.removeEventListener("visibilitychange", fn);
  }, []);

  // kanonik skroll: shell ichida body qulflanadi — yagona skroll main hududda
  // (login o'zi boshqaradi, shuning uchun u yerda qulf yo'q)
  useEffect(() => {
    document.body.classList.toggle("app-locked", !isLogin);
    return () => document.body.classList.remove("app-locked");
  }, [isLogin]);

  useEffect(() => {
    if (isLogin) return;
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    if (!user) loadMe();
    loadNotifs();
    // jonli bildirishnomalar — WS; polling faqat WS uzilganda ishlaydi
    useStore.getState().connectNotifWS();
    const t = setInterval(() => {
      if (!useStore.getState().wsConnected) loadNotifs();
    }, 60000);
    return () => {
      clearInterval(t);
      useStore.getState().disconnectNotifWS();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLogin]);

  // skroll — TABIIY (native): hech qanday smooth-scroll kutubxonasi yo'q,
  // g'ildirak/trackpad aynan kutilgandek ishlaydi
  if (isLogin) {
    return (
      <div className="relative min-h-screen">
        <div className="relative z-10">{children}</div>
        <Toast />
      </div>
    );
  }

  return (
    <div className="relative flex h-dvh gap-2 overflow-hidden p-2 box-border sm:gap-3 sm:p-3 lg:gap-4 lg:p-3.5">
      {decorMounted && <ParallaxController />}

      {/* ===== BOG' VIDEOSI + TEMA PARDASI — faqat "video" rejimda ===== */}
      {videoMounted && !lite && <GardenBackground active={showVideo} />}

      {/* ===== FON STEKI (z-0) — yengil rejimda so'nib, so'ng unmount ===== */}
      {decorMounted && (
      <div
        className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-[400ms] ease-out"
        style={{ opacity: lite ? 0 : 1 }}
        aria-hidden
      >
        {/* atmosfera: gradientlar, tuman, siyrak gulbarglar (ichida statik
            gul suratlari bgMode bo'yicha o'zi yashirinadi) */}
        <AmbientScene />
        {/* STATIK dekorativ gullar — video rejimda BUTUNLAY yashirin:
            xom video ustida hech qanday surat-gul qolmasligi kerak */}
        <div
          className="transition-opacity duration-[600ms] ease-out"
          style={{ opacity: showVideo ? 0 : 1 }}
        >
          {/* botanika bog'i: daraxtlar, barglar, uzoq gul (kuchli blur) */}
          <BotanicalGarden />
          {/* yaqin fon guli: premium piyon (3D yoki surat fallback) */}
          <PremiumPeony />
        </div>
      </div>
      )}

      {/* ===== SHISHA VUAL (z-[1]) — faqat RASM rejimda; yengilda yo'q ===== */}
      {decorMounted && !showVideo && (
        <div
          className="pointer-events-none absolute inset-0 z-[1] transition-opacity duration-[400ms]"
          aria-hidden
          style={{ background: "color-mix(in srgb, var(--bg) 6%, transparent)", opacity: lite ? 0 : 1 }}
        />
      )}

      {decorMounted && <PetalBurst />}

      {/* ===== UI (z-10+) — har doim fokusda ===== */}
      {sideOpen && (
        <div
          className="fixed inset-0 z-[75] bg-black/35 backdrop-blur-[2px] md:hidden"
          onClick={toggleSide}
          aria-hidden
        />
      )}
      <Sidebar />
      <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden rounded-[26px]">
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <Header />
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-10 pt-4 sm:px-4 lg:px-6 lg:pt-6" style={{ scrollbarGutter: "stable" }}>
            {userLoading && !user ? (
              <FlowerLoader />
            ) : routeAllowed ? (
              children
            ) : (
              <div className="mt-16 flex flex-col items-center gap-2 text-center">
                <p className="text-[16px] font-semibold">Bu sahifaga ruxsatingiz yo&apos;q</p>
                <p className="text-[13px]" style={{ color: "var(--muted)" }}>
                  Administrator sizga kerakli ruxsatni berishi mumkin.
                </p>
              </div>
            )}
          </div>
        </div>
        {/* muhit tovushi — faqat video rejimda */}
        {showVideo && !gardenPosterOnly && (
          <div className="absolute bottom-3 left-3 z-20">
            <SoundToggle volume={0.55} />
          </div>
        )}
      </main>
      <Toast />
      <NotifToast />
    </div>
  );
}
