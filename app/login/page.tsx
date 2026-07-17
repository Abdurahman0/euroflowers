"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { login, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Icon } from "@/components/icons";

/**
 * Login — Ghibli uslubidagi to'liq ekran sahna:
 * jonli piyon natyurmorti butun ekranni qoplaydi (buket chapga langar),
 * o'ng tomonda muzli shisha karta "suzadi" — rasm karta orqali jilolanadi.
 * Video to'liq kadr (watermark delogo bilan olib tashlangan), 1s krossfeyd
 * bilan uzluksiz aylanadi; ambient ovoz sukut bo'yicha o'chiq, pastki-chap
 * chip orqali yoqiladi. Mobil / saveData / reduced-motion — video umuman
 * yuklanmaydi, faqat poster.
 */

const VIDEO = "/videos/login-scene-full.mp4";
const POSTER = "/videos/login-scene-full-poster.webp";

/* rasm palitrasi bilan uyg'un qat'iy ranglar — mavzudan mustaqil */
const CREAM = "#FAF6F2";
const ROSE = "#C9909A";
const INK = "#4a3f38";
const MUTED = "#9a8a80";
const LINE = "rgba(120, 95, 80, 0.18)";

export default function LoginPage() {
  const router = useRouter();
  const loadMe = useStore((s) => s.loadMe);
  const setUser = useStore((s) => s.setUser);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  // video faqat shu bayroq true bo'lganda DOM'ga qo'yiladi — mobil qurilma
  // mp4'ni umuman yuklab olmasligi kerak (display:none emas, shartli render)
  const [showVideo, setShowVideo] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fadeRef = useRef(0);

  useEffect(() => {
    const conn = (navigator as { connection?: { saveData?: boolean } }).connection;
    const desktop = window.matchMedia("(min-width: 768px)").matches;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setShowVideo(desktop && !reduce && !conn?.saveData);
    return () => cancelAnimationFrame(fadeRef.current);
  }, []);

  /* ovoz: 1.5s davomida 0 ↔ 0.35 orasida silliq o'tish, hech qachon balandroq emas */
  const fadeVolume = (to: number) => {
    const v = videoRef.current;
    if (!v) return;
    cancelAnimationFrame(fadeRef.current);
    if (to > 0 && v.muted) {
      v.volume = 0;
      v.muted = false;
    }
    const from = v.volume;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 1500);
      v.volume = from + (to - from) * t;
      if (t < 1) fadeRef.current = requestAnimationFrame(step);
      else if (to === 0) v.muted = true;
    };
    fadeRef.current = requestAnimationFrame(step);
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    fadeVolume(next ? 0.35 : 0);
  };

  const fail = (msg: string) => {
    setErr(msg);
    setShake((n) => n + 1); // har xatoda silkinish qayta ishga tushadi
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return fail("Login va parolni kiriting");
    setBusy(true);
    setErr("");
    try {
      const u = await login(username.trim(), password);
      // kontrakt: token javobida user+permissions keladi; bo'lmasa /api/me/
      if (u) setUser(u);
      else await loadMe();
      setSuccess(true);
      setTimeout(() => router.replace("/"), 650);
    } catch (ex) {
      fail(
        ex instanceof ApiError && ex.status === 401
          ? "Login yoki parol noto'g'ri"
          : ex instanceof Error
            ? ex.message
            : "Kirishda xatolik"
      );
      setBusy(false);
    }
  };

  const inputBase: React.CSSProperties = {
    height: 46,
    width: "100%",
    boxSizing: "border-box",
    borderRadius: 12,
    border: `1px solid ${LINE}`,
    background: "rgba(255,255,255,0.65)",
    color: INK,
    fontSize: 14,
    paddingLeft: 42,
    outline: "none",
    transition: "border-color 220ms var(--ease), box-shadow 220ms var(--ease)",
  };

  return (
    <div className="relative min-h-dvh overflow-hidden" style={{ background: CREAM }}>
      {/* ==== FON: to'liq ekran jonli natyurmort ==== */}
      <div className="absolute inset-0" aria-hidden>
        {/* poster har doim ostida — mobil/saveData/reduced-motion uchun yagona fon */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={POSTER} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: "left center" }} />
        {showVideo && (
          <video
            ref={videoRef}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: "left center" }}
            src={VIDEO}
            poster={POSTER}
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            tabIndex={-1}
          />
        )}
      </div>

      {/* ==== OVOZ TUGMASI — faqat video bor desktopda ==== */}
      {showVideo && (
        <button
          type="button"
          onClick={toggleSound}
          className="sound-chip fixed bottom-5 left-5 z-20 flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-200 hover:scale-105 active:scale-95"
          style={{ color: INK }}
          title={soundOn ? "Tovushni o'chirish" : "Tovushni yoqish"}
          aria-label={soundOn ? "Tovushni o'chirish" : "Tovushni yoqish"}
          aria-pressed={soundOn}
        >
          <Icon name={soundOn ? "volumeOn" : "volumeOff"} size={17} />
        </button>
      )}

      {/* ==== SUZUVCHI SHISHA KARTA — o'ng 40% ichida markazda ==== */}
      <div className="relative z-10 flex min-h-dvh items-center justify-center px-5 py-10 md:justify-end">
        <div className="flex w-full justify-center md:w-[40%]">
        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: 22 }}
          animate={success ? { opacity: 0, y: -10 } : { opacity: 1, y: 0 }}
          transition={{ duration: success ? 0.4 : 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="login-card w-[min(420px,100%)]"
          key={shake === 0 ? "form" : `form-${shake}`}
          style={shake > 0 && !busy && !success ? { animation: "gentleShake 0.4s var(--ease)" } : undefined}
        >
          {/* brend */}
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/flowers/textures/peony.webp" alt="" className="h-11 w-11 object-contain" style={{ filter: "saturate(0.95) drop-shadow(0 3px 8px rgba(150,90,90,0.25))" }} />
            <div>
              <div className="font-serif-lux text-[21px] leading-tight" style={{ color: INK }}>EuroFlowers</div>
              <div className="text-[9.5px] font-semibold uppercase tracking-[3.5px]" style={{ color: ROSE }}>AI · Boutique</div>
            </div>
          </div>

          <h1 className="mt-9 text-[30px]" style={{ color: INK }}>Xush kelibsiz!</h1>
          <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: MUTED }}>
            Hisobingizga kirish uchun ma&apos;lumotlaringizni kiriting
          </p>

          {/* login/email */}
          <label className="mt-8 block">
            <span className="mb-1.5 block text-[12px] font-semibold" style={{ color: INK }}>Email yoki login</span>
            <span className="relative block">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: MUTED }}>
                <Icon name="mail" size={16} />
              </span>
              <input
                style={inputBase}
                className="login-inp"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setErr(""); }}
                placeholder="email@misol.uz"
                autoComplete="username"
                autoFocus
                aria-label="Email yoki login"
              />
            </span>
          </label>

          {/* parol */}
          <label className="mt-4 block">
            <span className="mb-1.5 block text-[12px] font-semibold" style={{ color: INK }}>Parolingiz</span>
            <span className="relative block">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: MUTED }}>
                <Icon name="lock" size={16} />
              </span>
              <input
                style={{ ...inputBase, paddingRight: 44 }}
                className="login-inp"
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErr(""); }}
                placeholder="••••••••"
                autoComplete="current-password"
                aria-label="Parol"
              />
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg transition-colors duration-200 hover:bg-black/[0.05]"
                style={{ color: MUTED }}
                aria-label={showPass ? "Parolni yashirish" : "Parolni ko'rsatish"}
                aria-pressed={showPass}
              >
                <Icon name={showPass ? "eyeOff" : "eye"} size={16} />
              </button>
            </span>
          </label>


          {/* xato */}
          {err && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className="mt-5 text-[12.5px] font-semibold"
              style={{ color: "#c26a74" }}
              role="alert"
            >
              {err}
            </motion.p>
          )}

          {/* kirish */}
          <button
            type="submit"
            disabled={busy}
            className={`mt-6 flex h-[46px] w-full items-center justify-center rounded-[13px] text-[14px] font-bold text-white transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] hover:-translate-y-px active:scale-[0.98] disabled:pointer-events-none ${busy && !success ? "btn-loading" : ""}`}
            style={{
              background: "linear-gradient(135deg, #D4949E, #B87E88)",
              boxShadow: "0 10px 24px rgba(184, 126, 136, 0.35), inset 0 1px 0 rgba(255,255,255,0.25)",
            }}
          >
            {success ? "Xush kelibsiz" : "Kirish"}
          </button>
        </motion.form>
        </div>
      </div>

      {/* faqat shu sahifa uchun karta va input holatlari */}
      <style jsx global>{`
        .login-card {
          background: rgba(250, 246, 242, 0.92); /* backdrop-filter yo'q brauzerlar uchun */
          border: 1px solid rgba(255, 255, 255, 0.5);
          border-radius: 22px;
          box-shadow: 0 20px 60px rgba(180, 130, 120, 0.18);
          padding: 40px;
        }
        @supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
          .login-card {
            background: rgba(250, 246, 242, 0.7);
            -webkit-backdrop-filter: blur(16px) saturate(1.15);
            backdrop-filter: blur(16px) saturate(1.15);
          }
          @media (max-width: 767px) {
            .login-card {
              background: rgba(250, 246, 242, 0.85);
            }
          }
        }
        .sound-chip {
          background: rgba(250, 246, 242, 0.92);
          border: 1px solid rgba(255, 255, 255, 0.5);
          box-shadow: 0 8px 24px rgba(180, 130, 120, 0.22);
        }
        @supports (backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)) {
          .sound-chip {
            background: rgba(250, 246, 242, 0.55);
            -webkit-backdrop-filter: blur(16px) saturate(1.15);
            backdrop-filter: blur(16px) saturate(1.15);
          }
        }
        .login-inp::placeholder {
          color: #b9aca3 !important;
        }
        .login-inp:hover {
          border-color: rgba(120, 95, 80, 0.32) !important;
        }
        .login-inp:focus {
          border-color: ${ROSE} !important;
          box-shadow: 0 0 0 3.5px rgba(201, 144, 154, 0.22) !important;
        }
      `}</style>
    </div>
  );
}
