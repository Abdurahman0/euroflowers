"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { login, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";

const LoginVideo = dynamic(() => import("@/components/login/LoginVideo"), { ssr: false });

/**
 * Ghibli uslubidagi premium login:
 *   chapda 60% — piyon buketi video sahnasi (poster fallback bilan),
 *   o'ngda 40% — iliq krem forma paneli, video chekkasi unga "erib" o'tadi.
 * Mobil: video yuqorida ~35vh hero, forma pastda.
 * Auth mantig'i o'zgarmagan (JWT login → /).
 */

const CREAM = "#FAF6F2";
const ROSE = "#C9909A";
const ROSE_D = "#B87E88";
const INK = "#4a3a34";
const MUT = "#9a857c";

const PETALS = [
  { left: "18%", delay: "0s", dur: "9s", size: 13 },
  { left: "52%", delay: "3.2s", dur: "11s", size: 10 },
  { left: "78%", delay: "6.4s", dur: "10s", size: 12 },
];

export default function LoginPage() {
  const router = useRouter();
  const loadMe = useStore((s) => s.loadMe);
  const setUser = useStore((s) => s.setUser);
  const showToast = useStore((s) => s.showToast);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [err, setErr] = useState("");
  const [shaking, setShaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  const fail = (msg: string) => {
    setErr(msg);
    setShaking(true); // onAnimationEnd tozalaydi — har xatoda qayta silkinadi
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return fail("Login va parolni kiriting");
    setBusy(true);
    setErr("");
    try {
      const u = await login(username, password);
      // kontrakt: token javobida user+permissions keladi; bo'lmasa /api/me/
      if (u) setUser(u);
      else await loadMe();
      setSuccess(true);
      setTimeout(() => router.replace("/"), 700);
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

  const soon = () => showToast("Tez orada — hozircha login va parol bilan kiring");

  return (
    <div className="flex min-h-screen flex-col md:flex-row" style={{ background: CREAM }}>
      {/* ===== VIDEO PANEL: desktop 60% / tablet 50% / mobil 35vh hero ===== */}
      <div className="relative h-[35vh] w-full md:h-auto md:min-h-screen md:w-1/2 lg:w-[60%]">
        <LoginVideo meltColor={CREAM} />
      </div>

      {/* ===== FORMA PANELI ===== */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-10 md:min-h-screen">
        {/* videodan "kirib kelgan" shabada — 3 ta mayin gulbarg */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {PETALS.map((p, i) => (
            <span
              key={i}
              className="petal-drift absolute rounded-full"
              style={{
                left: p.left,
                width: p.size,
                height: p.size * 1.3,
                background: `radial-gradient(ellipse at 35% 30%, #f0cdd2, ${ROSE})`,
                borderRadius: "72% 16% 80% 14% / 64% 24% 76% 20%",
                animationDelay: p.delay,
                animationDuration: p.dur,
              }}
            />
          ))}
        </div>

        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: 22 }}
          animate={success ? { opacity: 0, y: -10 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.25, 0.8, 0.35, 1], delay: success ? 0 : 0.15 }}
          className={`relative w-[min(400px,100%)] ${shaking ? "form-shake" : ""}`}
          onAnimationEnd={() => setShaking(false)}
        >
          {/* brend */}
          <div className="mb-8 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl shadow-md" style={{ background: `linear-gradient(135deg, ${ROSE}, ${ROSE_D})` }}>
              {/* mitti piyon belgisi */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                {[0, 72, 144, 216, 288].map((d) => (
                  <ellipse key={d} cx="12" cy="8.2" rx="3" ry="4.6" fill="#fff" opacity="0.9" transform={`rotate(${d} 12 12)`} />
                ))}
                <circle cx="12" cy="12" r="2.4" fill="#f3d9a8" />
              </svg>
            </span>
            <span>
              <span className="block font-serif-lux text-[21px] leading-tight" style={{ color: INK }}>EuroFlowers</span>
              <span className="block text-[9.5px] font-bold uppercase tracking-[3.5px]" style={{ color: ROSE_D }}>AI · Boutique</span>
            </span>
          </div>

          <h1 className="text-[26px] tracking-tight" style={{ color: INK }}>Xush kelibsiz!</h1>
          <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: MUT }}>
            Hisobingizga kirish uchun ma&apos;lumotlaringizni kiriting
          </p>

          {/* login/email */}
          <label className="mt-7 block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider" style={{ color: MUT }}>Email manzilingiz</span>
            <span className="relative block">
              <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={MUT} strokeWidth="1.8" aria-hidden>
                <rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m4 7 8 6 8-6" />
              </svg>
              <input
                className="inp-lux"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoFocus
                autoComplete="username email"
                inputMode="email"
              />
            </span>
          </label>

          {/* parol */}
          <label className="mt-4 block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider" style={{ color: MUT }}>Parolingiz</span>
            <span className="relative block">
              <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={MUT} strokeWidth="1.8" aria-hidden>
                <rect x="4" y="10" width="16" height="10" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              <input
                className="inp-lux !pr-11"
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                aria-label={showPass ? "Parolni yashirish" : "Parolni ko'rsatish"}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 transition-colors duration-200 hover:bg-black/5"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={MUT} strokeWidth="1.8" aria-hidden>
                  <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z" />
                  <circle cx="12" cy="12" r="2.6" />
                  {showPass && <path d="M4 4l16 16" />}
                </svg>
              </button>
            </span>
          </label>

          {/* eslab qolish + unutdingizmi */}
          <div className="mt-4 flex items-center justify-between text-[12.5px]">
            <label className="flex cursor-pointer items-center gap-2" style={{ color: MUT }}>
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded accent-[#C9909A]"
              />
              Meni eslab qol
            </label>
            <button type="button" onClick={soon} className="font-semibold transition-colors duration-200 hover:underline" style={{ color: ROSE_D }}>
              Parolni unutdingizmi?
            </button>
          </div>

          {err && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className="mt-4 text-[12.5px] font-semibold"
              style={{ color: "#c26565" }}
              role="alert"
            >
              {err}
            </motion.p>
          )}

          {/* kirish */}
          <button
            type="submit"
            disabled={busy}
            className="btn-rose mt-6 w-full"
          >
            {busy && !success ? (
              <span className="spin-lux" aria-hidden />
            ) : success ? (
              "Xush kelibsiz 🌸"
            ) : (
              "Kirish"
            )}
          </button>

          {/* yoki */}
          <div className="mt-6 flex items-center gap-3 text-[11.5px] font-semibold" style={{ color: MUT }}>
            <span className="h-px flex-1" style={{ background: "rgba(74,58,52,0.14)" }} />
            yoki
            <span className="h-px flex-1" style={{ background: "rgba(74,58,52,0.14)" }} />
          </div>

          {/* Google */}
          <button type="button" onClick={soon} className="btn-ghost mt-5 w-full">
            <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9Z" />
              <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7Z" />
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.6 39.6 16.3 44 24 44Z" />
              <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.2 5.2C41.4 34.8 44 29.9 44 24c0-1.3-.1-2.6-.4-3.9Z" />
            </svg>
            Google bilan kirish
          </button>

          {/* ro'yxatdan o'tish */}
          <p className="mt-7 text-center text-[13px]" style={{ color: MUT }}>
            Hisobingiz yo&apos;qmi?{" "}
            <button type="button" onClick={soon} className="font-bold transition-colors duration-200 hover:underline" style={{ color: ROSE_D }}>
              Ro&apos;yxatdan o&apos;tish
            </button>
          </p>
        </motion.form>
      </div>

      <style jsx global>{`
        .inp-lux {
          width: 100%;
          box-sizing: border-box;
          border-radius: 13px;
          padding: 11px 14px 11px 40px;
          font-size: 14px;
          color: ${INK};
          background: #fff;
          border: 1.5px solid rgba(74, 58, 52, 0.12);
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .inp-lux::placeholder {
          color: rgba(154, 133, 124, 0.55);
        }
        .inp-lux:focus {
          border-color: ${ROSE};
          box-shadow: 0 0 0 4px rgba(201, 144, 154, 0.18);
        }
        .btn-rose {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border-radius: 14px;
          padding: 13px;
          font-size: 14.5px;
          font-weight: 700;
          color: #fff;
          background: linear-gradient(135deg, ${ROSE}, ${ROSE_D});
          box-shadow: 0 10px 24px rgba(184, 126, 136, 0.35);
          transition: transform 0.2s ease, box-shadow 0.25s ease, filter 0.25s ease;
        }
        .btn-rose:hover:not(:disabled) {
          transform: translateY(-1.5px);
          filter: brightness(1.04);
          box-shadow: 0 14px 30px rgba(184, 126, 136, 0.45);
        }
        .btn-rose:active:not(:disabled) {
          transform: scale(0.98);
        }
        .btn-rose:disabled {
          opacity: 0.75;
        }
        .btn-ghost {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border-radius: 14px;
          padding: 12px;
          font-size: 13.5px;
          font-weight: 600;
          color: ${INK};
          background: #fff;
          border: 1.5px solid rgba(74, 58, 52, 0.13);
          transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
        }
        .btn-ghost:hover {
          border-color: rgba(74, 58, 52, 0.28);
          box-shadow: 0 6px 18px rgba(74, 58, 52, 0.1);
          transform: translateY(-1px);
        }
        .spin-lux {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2.5px solid rgba(255, 255, 255, 0.4);
          border-top-color: #fff;
          animation: spinLux 0.8s linear infinite;
        }
        @keyframes spinLux {
          to { transform: rotate(360deg); }
        }
        .form-shake {
          animation: formShake 0.4s ease;
        }
        @keyframes formShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-7px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(2px); }
        }
        .petal-drift {
          top: -24px;
          opacity: 0;
          animation-name: petalDriftDown;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
        @keyframes petalDriftDown {
          0% { transform: translateY(0) translateX(0) rotate(0deg); opacity: 0; }
          12% { opacity: 0.5; }
          55% { transform: translateY(55vh) translateX(-26px) rotate(190deg); opacity: 0.45; }
          92% { opacity: 0.3; }
          100% { transform: translateY(104vh) translateX(10px) rotate(340deg); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .petal-drift, .form-shake { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
