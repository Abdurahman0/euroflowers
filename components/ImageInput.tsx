"use client";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";

/** Rasm maydoni: fayl yuklash (/api/uploads/) yoki URL qo'lda kiritish. */
export default function ImageInput({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const showToast = useStore((s) => s.showToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const { url } = await api.upload(file);
      onChange(url);
      showToast("✓ Rasm yuklandi");
    } catch {
      showToast("Rasm yuklab bo'lmadi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5">
        <input className="inp flex-1" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://… yoki fayl yuklang" />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="whitespace-nowrap rounded-xl border border-white/30 bg-white/10 px-4 py-2.5 text-[12.5px] font-bold hover:bg-white/20 disabled:opacity-60">
          {busy ? "Yuklanmoqda…" : "📁 Fayl tanlash"}
        </button>
      </div>
      {value && (
        <div className="h-[110px] w-[170px] overflow-hidden rounded-[12px] border border-white/25">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="preview" className="h-full w-full object-cover" />
        </div>
      )}
    </div>
  );
}
