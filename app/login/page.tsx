"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { login, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";

const LoginScene = dynamic(() => import("@/components/three/LoginScene"), { ssr: false });
const CinematicVideo = dynamic(() => import("@/components/CinematicVideo"), { ssr: false });

export default function LoginPage() {
  const router = useRouter();
  const loadMe = useStore((s) => s.loadMe);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return setErr("Login va parolni kiriting");
    setBusy(true);
    setErr("");
    try {
      await login(username, password);
      await loadMe();
      // gulbarglar uchadi, kamera ichkariga suzadi — so'ng dashboard
      setSuccess(true);
      setTimeout(() => router.replace("/"), 1600);
    } catch (ex) {
      setErr(
        ex instanceof ApiError && ex.status === 401
          ? "Login yoki parol noto'g'ri"
          : ex instanceof Error
            ? ex.message
            : "Kirishda xatolik"
      );
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-5">
      {/* kinematik bog' atmosferasi (video bo'lsa) + 3D gul sahnasi */}
      <div className="absolute inset-0">
        <CinematicVideo opacity={0.15} blur={8} />
        <LoginScene success={success} />
      </div>

      {/* forma */}
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 36, filter: "blur(8px)" }}
        animate={success ? { opacity: 0, y: -30, scale: 0.96, filter: "blur(10px)" } : { opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: success ? 0 : 0.5 }}
        className="glass-modal relative z-10 mt-[30vh] w-[min(420px,100%)] p-8"
      >
        <div className="text-center">
          <h1 className="text-[30px] tracking-tight">EuroFlowers</h1>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-[4px]" style={{ color: "var(--accL)" }}>
            AI · Boutique · CRM
          </div>
        </div>

        <p className="mt-4 text-center text-[13px] text-white/60">Tizimga kirish uchun login va parolingizni kiriting.</p>

        <label className="mt-6 flex flex-col gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-white/60">
          Login
          <input className="inp" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" autoFocus autoComplete="username" />
        </label>
        <label className="mt-3.5 flex flex-col gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-white/60">
          Parol
          <input className="inp" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
        </label>

        {err && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3.5 rounded-[12px] border border-[#c26565]/60 bg-rose px-3.5 py-2.5 text-[12.5px] font-bold text-roseink"
          >
            {err}
          </motion.div>
        )}

        <button type="submit" disabled={busy} className="btn-primary mt-6 w-full disabled:opacity-60">
          {success ? "Xush kelibsiz 🌸" : busy ? "Kirilmoqda…" : "Kirish"}
        </button>
      </motion.form>
    </div>
  );
}
