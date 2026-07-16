"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { login, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";

/**
 * Login — toza, minimal, premium. Hech qanday dekorativ gul yo'q:
 * faqat sokin gradient fon, nafis shisha karta va aniq tipografiya.
 */
export default function LoginPage() {
  const router = useRouter();
  const loadMe = useStore((s) => s.loadMe);
  const setUser = useStore((s) => s.setUser);
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
      const u = await login(username, password);
      // kontrakt: token javobida user+permissions keladi; bo'lmasa /api/me/
      if (u) setUser(u);
      else await loadMe();
      setSuccess(true);
      setTimeout(() => router.replace("/"), 700);
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-5" style={{ background: "var(--side)" }}>
      {/* sokin atmosfera — ikki juda xira nur dog'i, boshqa hech narsa */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute -left-[10%] -top-[20%] h-[60vh] w-[60vh] rounded-full blur-[110px]"
          style={{ background: "color-mix(in srgb, var(--primary) 16%, transparent)" }}
        />
        <div
          className="absolute -bottom-[25%] -right-[8%] h-[55vh] w-[55vh] rounded-full blur-[120px]"
          style={{ background: "rgba(255, 246, 230, 0.05)" }}
        />
      </div>

      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 16, scale: 0.985 }}
        animate={success ? { opacity: 0, y: -10, scale: 0.985 } : { opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: success ? 0.4 : 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="glass-modal relative z-10 w-[min(400px,100%)] p-8"
      >
        <div className="text-center">
          <h1 className="text-[28px] tracking-tight">EuroFlowers</h1>
          <div className="mt-1.5 text-[10px] font-semibold uppercase tracking-[4px] text-white/40">
            AI · Boutique · CRM
          </div>
        </div>

        <p className="mt-5 text-center text-[13px] leading-relaxed text-white/55">
          Tizimga kirish uchun login va parolingizni kiriting.
        </p>

        <label className="mt-7 flex flex-col gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-white/55">
          Login
          <input className="inp" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" autoFocus autoComplete="username" />
        </label>
        <label className="mt-4 flex flex-col gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-white/55">
          Parol
          <input className="inp" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
        </label>

        {err && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="mt-4 rounded-[10px] border px-3.5 py-2.5 text-[12.5px] font-semibold"
            style={{ background: "rgba(212,106,106,0.14)", borderColor: "rgba(212,106,106,0.4)", color: "#e8a7a7" }}
            role="alert"
          >
            {err}
          </motion.div>
        )}

        <button type="submit" disabled={busy} className={`btn-primary mt-7 w-full ${busy && !success ? "btn-loading" : ""}`}>
          {success ? "Xush kelibsiz" : "Kirish"}
        </button>
      </motion.form>
    </div>
  );
}
