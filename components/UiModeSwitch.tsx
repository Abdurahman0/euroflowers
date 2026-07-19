"use client";
import { Leaf, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";

/**
 * Interfeys rejimi tanlagichi — login sahifasida ham, Sozlamalarda ham
 * bitta komponent. Tanlov store'da (ef_uimode) — darhol qo'llanadi,
 * reload kerak emas.
 */
const OPTS = [
  { id: "premium" as const, icon: Sparkles, label: "Premium", sub: "video fon, jonli effektlar" },
  { id: "yengil" as const, icon: Leaf, label: "Yengil", sub: "tez va oddiy" },
];

export default function UiModeSwitch({ hint }: { hint?: string }) {
  const uiMode = useStore((s) => s.uiMode);
  const setUiMode = useStore((s) => s.setUiMode);
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {OPTS.map((o) => {
          const on = uiMode === o.id;
          const IconC = o.icon;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => setUiMode(o.id)}
              aria-pressed={on}
              className="rounded-[12px] border px-3 py-2 text-left transition-colors duration-200 hover:border-[color:var(--border-strong)]"
              style={on ? { borderColor: "var(--primary)", background: "var(--primary-soft)", boxShadow: "0 0 0 1px var(--primary) inset" } : { borderColor: "var(--border)" }}
            >
              <span className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: on ? "var(--primary-strong)" : "var(--text)" }}>
                <IconC size={14} strokeWidth={1.75} /> {o.label}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug" style={{ color: "var(--muted)" }}>{o.sub}</span>
            </button>
          );
        })}
      </div>
      {hint && <p className="mt-1.5 text-[11px] font-medium" style={{ color: "var(--primary-strong)" }}>{hint}</p>}
    </div>
  );
}
