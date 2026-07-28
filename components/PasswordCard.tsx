"use client";
import { useState } from "react";
import { Check, Eye, EyeOff, KeyRound, ShieldCheck } from "lucide-react";
import clsx from "clsx";
import { changePassword, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";

/**
 * PAROLNI O'ZGARTIRISH — foydalanuvchi o'ziniki (backend: POST
 * /api/me/change-password/, body: old_password, new_password,
 * new_password_confirm). Tasdiq mosligini avval KLIENT tekshiradi,
 * server xatolari esa tegishli input ostida ko'rsatiladi.
 */

const MIN_LEN = 8;

type FieldKey = "old_password" | "new_password" | "new_password_confirm";

const LABEL: Record<FieldKey, string> = {
  old_password: "Eski parol",
  new_password: "Yangi parol",
  new_password_confirm: "Yangi parolni qayta yozing",
};

/** Oddiy kuch bahosi — uzunlik + belgi xilma-xilligi */
function strengthOf(pw: string): { pct: number; label: string; hue: string } {
  if (!pw) return { pct: 0, label: "—", hue: "var(--muted)" };
  let score = 0;
  if (pw.length >= MIN_LEN) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^\w\s]/.test(pw)) score++;
  const steps = [
    { pct: 20, label: "Juda zaif", hue: "var(--danger-ink)" },
    { pct: 40, label: "Zaif", hue: "#b3873a" },
    { pct: 60, label: "O'rtacha", hue: "#b3873a" },
    { pct: 80, label: "Yaxshi", hue: "var(--success-ink, #3d8a5f)" },
    { pct: 100, label: "Kuchli", hue: "var(--success-ink, #3d8a5f)" },
  ];
  return steps[Math.min(Math.max(score - 1, 0), steps.length - 1)];
}

export default function PasswordCard() {
  const showToast = useStore((s) => s.showToast);
  const [f, setF] = useState<Record<FieldKey, string>>({ old_password: "", new_password: "", new_password_confirm: "" });
  const [show, setShow] = useState<Record<FieldKey, boolean>>({ old_password: false, new_password: false, new_password_confirm: false });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k: FieldKey) => (v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    setDone(false);
    if (errs[k] || errs.detail) setErrs((x) => { const n = { ...x }; delete n[k]; delete n.detail; return n; });
  };

  const strength = strengthOf(f.new_password);
  const mismatch = !!f.new_password_confirm && f.new_password !== f.new_password_confirm;
  const tooShort = !!f.new_password && f.new_password.length < MIN_LEN;
  const ready = !!f.old_password && !!f.new_password && !!f.new_password_confirm && !mismatch && !tooShort;

  const save = async () => {
    // klient tekshiruvi — server so'roviga chiqishdan oldin
    if (f.new_password.length < MIN_LEN) return setErrs({ new_password: `Kamida ${MIN_LEN} ta belgi bo'lsin` });
    if (f.new_password !== f.new_password_confirm) return setErrs({ new_password_confirm: "Parollar mos kelmadi" });
    if (f.new_password === f.old_password) return setErrs({ new_password: "Yangi parol eskisidan farq qilsin" });
    setBusy(true);
    setErrs({});
    try {
      await changePassword(f);
      setF({ old_password: "", new_password: "", new_password_confirm: "" });
      setDone(true);
      showToast("✓ Parol muvaffaqiyatli o'zgartirildi");
    } catch (e) {
      if (e instanceof ApiError) {
        // maydon xatolari inputlar ostida; umumiy `detail` — panel ostida
        const fields = e.fieldErrors ?? {};
        setErrs(Object.keys(fields).length ? fields : { detail: e.message });
        showToast(e.message);
      } else {
        showToast("Parolni o'zgartirib bo'lmadi");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="glass p-5" id="parol">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
          <KeyRound size={17} strokeWidth={1.9} />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-bold">Parolni o&apos;zgartirish</h2>
          <p className="text-[12.5px]" style={{ color: "var(--muted)" }}>Faqat o&apos;z hisobingiz uchun — kamida {MIN_LEN} ta belgi</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {(["old_password", "new_password", "new_password_confirm"] as FieldKey[]).map((k) => {
          const err = errs[k] ?? (k === "new_password_confirm" && mismatch ? "Parollar mos kelmadi" : k === "new_password" && tooShort ? `Kamida ${MIN_LEN} ta belgi` : "");
          return (
            <label key={k} className="flex flex-col gap-1.5 text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>
              {LABEL[k]}
              <span className="relative block">
                <input
                  className="inp !pr-10"
                  type={show[k] ? "text" : "password"}
                  value={f[k]}
                  autoComplete={k === "old_password" ? "current-password" : "new-password"}
                  onChange={(e) => set(k)(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && ready && !busy) save(); }}
                  placeholder="••••••••"
                  aria-invalid={!!err}
                />
                <button
                  type="button"
                  onClick={() => setShow((p) => ({ ...p, [k]: !p[k] }))}
                  title={show[k] ? "Yashirish" : "Ko'rsatish"}
                  aria-label={show[k] ? "Parolni yashirish" : "Parolni ko'rsatish"}
                  className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[9px] transition-colors duration-150 hover:bg-[var(--hover)]"
                  style={{ color: "var(--muted)" }}
                >
                  {show[k] ? <EyeOff size={15} strokeWidth={1.9} /> : <Eye size={15} strokeWidth={1.9} />}
                </button>
              </span>
              {err && <span className="text-[11.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>{err}</span>}
              {k === "new_password" && !!f.new_password && !err && (
                <span className="flex items-center gap-2">
                  <span className="h-[5px] flex-1 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                    <span className="block h-full rounded-full transition-[width,background-color] duration-300" style={{ width: `${strength.pct}%`, background: strength.hue }} />
                  </span>
                  <span className="text-[11px] font-bold" style={{ color: strength.hue }}>{strength.label}</span>
                </span>
              )}
            </label>
          );
        })}
      </div>

      {errs.detail && (
        <p className="mt-3 rounded-[11px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>
          {errs.detail}
        </p>
      )}
      {done && (
        <p className="mt-3 flex items-center gap-1.5 rounded-[11px] bg-mint px-3 py-2 text-[12.5px] font-semibold text-mintink">
          <ShieldCheck size={14} strokeWidth={2} /> Parol muvaffaqiyatli o&apos;zgartirildi.
        </p>
      )}

      <button
        onClick={save}
        disabled={!ready || busy}
        className={clsx("btn-primary mt-4 w-full disabled:opacity-50", busy && "btn-loading")}
      >
        {done ? <><Check size={16} strokeWidth={2} /> Saqlandi</> : "Parolni yangilash"}
      </button>
    </section>
  );
}
