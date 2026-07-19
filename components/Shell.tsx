"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useStore, useTheme } from "@/lib/store";
import { isLoggedIn } from "@/lib/api";
import Sidebar from "./Sidebar";
import Header from "./Header";
import Toast from "./Toast";
import GardenBackground from "./GardenBackground";
import SoundToggle from "./SoundToggle";
import FlowerLoader from "./FlowerLoader";
import PetalBurst from "./PetalBurst";

const AmbientScene = dynamic(() => import("./three/AmbientScene"), { ssr: false });
const ParallaxController = dynamic(() => import("./three/engine/ParallaxController"), { ssr: false });
const BotanicalGarden = dynamic(() => import("./three/engine/BotanicalGarden"), { ssr: false });
const PremiumPeony = dynamic(() => import("./flowers/PremiumPeony"), { ssr: false });

/** Butun ilova qobig'i: tema CSS o'zgaruvchilari, tirik fon, auth-guard, sidebar + main panel. */
export default function Shell({ children }: { children: React.ReactNode }) {
  const { theme, dark } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const { user, userLoading, loadMe, loadNotifs, setTheme, setDark, gardenPosterOnly, bgMode, setBgMode, sideOpen, toggleSide } = useStore();
  const isLogin = pathname.startsWith("/login");

  // video rejimda element krossfeyd tugaguncha (400ms) DOM'da qoladi;
  // "rasm" bilan yangi ochilishda esa umuman mount bo'lmaydi (mp4 so'rovi yo'q)
  const showVideo = bgMode === "video";
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

  // orqa fon rejimi + ravshanligini tiklash/saqlash — mavzu bilan bir xil mexanizm
  useEffect(() => {
    const saved = localStorage.getItem("ef_bgmode");
    if (saved === "video" || saved === "rasm") setBgMode(saved);
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
      <ParallaxController />

      {/* ===== BOG' VIDEOSI + TEMA PARDASI — faqat "video" rejimda ===== */}
      {videoMounted && <GardenBackground active={showVideo} />}

      {/* ===== FON STEKI (z-0) — barcha botanika shu yerda, "fonga bosilgan" ===== */}
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
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

      {/* ===== SHISHA VUAL (z-[1]) — faqat RASM rejimda; video rejimda hech
           qanday to'liq ekranli yuvish yo'q (video ranglari fayldagidek) ===== */}
      {!showVideo && (
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          aria-hidden
          style={{ background: "color-mix(in srgb, var(--bg) 6%, transparent)" }}
        />
      )}

      <PetalBurst />

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
            {userLoading && !user ? <FlowerLoader /> : children}
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
    </div>
  );
}
