"use client";
import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import Lenis from "lenis";
import { useStore, useTheme } from "@/lib/store";
import { useSeason } from "@/components/three/engine/SeasonController";
import { isLoggedIn } from "@/lib/api";
import Sidebar from "./Sidebar";
import Header from "./Header";
import Toast from "./Toast";
import FlowerLoader from "./FlowerLoader";
import PetalBurst from "./PetalBurst";

const AmbientScene = dynamic(() => import("./three/AmbientScene"), { ssr: false });
const ParallaxController = dynamic(() => import("./three/engine/ParallaxController"), { ssr: false });
const BotanicalGarden = dynamic(() => import("./three/engine/BotanicalGarden"), { ssr: false });
const PremiumPeony = dynamic(() => import("./flowers/PremiumPeony"), { ssr: false });

/** Butun ilova qobig'i: tema CSS o'zgaruvchilari, tirik fon, auth-guard, sidebar + main panel. */
export default function Shell({ children }: { children: React.ReactNode }) {
  const { theme, dark } = useTheme();
  const season = useSeason();
  const pathname = usePathname();
  const router = useRouter();
  const { user, userLoading, loadMe, loadNotifs } = useStore();
  const isLogin = pathname.startsWith("/login");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", dark);
    root.style.setProperty("--acc", theme.accent);
    root.style.setProperty("--accL", theme.accL);
    root.style.setProperty("--side", theme.dark);
    root.style.setProperty("--bg", dark ? theme.dark : theme.light);
  }, [theme, dark]);

  // fasl ranglari — @property ro'yxatidan o'tgan, shuning uchun silliq oqadi
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--glow-a", season.glowA);
    root.style.setProperty("--glow-b", season.glowB);
    root.style.setProperty("--glow-c", season.glowC);
    root.style.setProperty("--fog-k", String(season.fog));
  }, [season]);

  useEffect(() => {
    if (isLogin) return;
    if (!isLoggedIn()) {
      router.replace("/login");
      return;
    }
    if (!user) loadMe();
    loadNotifs();
    const t = setInterval(loadNotifs, 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLogin]);

  // silliq scroll — asosiy kontent panelida
  useEffect(() => {
    if (isLogin || !scrollRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({
      wrapper: scrollRef.current,
      duration: 1.1,
      easing: (t: number) => 1 - Math.pow(1 - t, 3),
    });
    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, [isLogin, pathname]);

  if (isLogin) {
    return (
      <div className="relative min-h-screen">
        <div className="relative z-10">{children}</div>
        <Toast />
      </div>
    );
  }

  return (
    <div className="relative flex h-screen gap-4 overflow-hidden p-3.5 box-border">
      <ParallaxController />

      {/* ===== FON STEKI (z-0) — barcha botanika shu yerda, "fonga bosilgan" ===== */}
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
        {/* atmosfera: gradientlar, tuman, siyrak gulbarglar */}
        <AmbientScene />
        {/* botanika bog'i: daraxtlar, barglar, uzoq gul (kuchli blur) */}
        <BotanicalGarden />
        {/* yaqin fon guli: premium piyon — biroz tiniqroq, baribir fonda */}
        <PremiumPeony />
      </div>

      {/* ===== SHISHA VUAL (z-[1]) — juda yengil tekislovchi qatlam (blur YO'Q, gullar ko'rinadi) ===== */}
      <div
        className="pointer-events-none absolute inset-0 z-[1]"
        aria-hidden
        style={{ background: "color-mix(in srgb, var(--bg) 6%, transparent)" }}
      />

      <PetalBurst />

      {/* ===== UI (z-10+) — har doim fokusda ===== */}
      <Sidebar />
      <main className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden rounded-[26px]">
        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <Header />
          <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden px-6 pb-10 pt-6">
            {userLoading && !user ? <FlowerLoader /> : children}
          </div>
        </div>
      </main>
      <Toast />
    </div>
  );
}
