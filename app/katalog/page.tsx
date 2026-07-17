"use client";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import { fmt, fmtTime } from "@/lib/format";
import { CATALOG_STATUS_LABEL, ARRANGEMENT_LABEL } from "@/components/badges";
import KatalogModal from "@/components/KatalogModal";
import type { CatalogItem } from "@/lib/types";

const compositionText = (k: CatalogItem) =>
  k.composition
    .map((c) => `${c.batch_detail?.variant_detail?.flower_detail?.name_uz ?? ""} ${c.batch_detail?.variant_detail?.name_uz ?? ""} ${c.quantity_stems} dona`.trim())
    .join(" · ") || "Tarkib kiritilmagan";

export default function KatalogPage() {
  const { showToast, loadNotifs } = useStore();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await api.catalog({ ordering: "-created_at" }));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const patchItem = (upd: CatalogItem) => setItems((xs) => xs.map((x) => (x.id === upd.id ? upd : x)));

  const markSold = async (k: CatalogItem) => {
    setBusyId(k.id);
    try {
      patchItem(await api.sellCatalogItem(k.id));
      showToast(`✓ «${k.name_uz}» sotildi deb belgilandi`);
      loadNotifs();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Belgilab bo'lmadi");
    } finally {
      setBusyId(null);
    }
  };

  const deduct = async (k: CatalogItem) => {
    setBusyId(k.id);
    try {
      patchItem(await api.deductCatalogStock(k.id));
      showToast(`✓ Sklad kamaytirildi: ${k.name_uz}`);
      loadNotifs();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Kamaytirib bo'lmadi");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <FlowerLoader />;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="text-[14px]" style={{ color: "var(--mut)" }}>
          Tayyor gullar katalogi — har biri Instagram story bilan birga tizimga kiritiladi
        </p>
        <button onClick={() => setFormOpen(true)} className="btn-primary ml-auto !flex-none rounded-[13px] px-4 py-2.5 text-[14px]">
          ＋ Katalogga qo&apos;shish
        </button>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(275px,1fr))" }}>
        {items.map((k) => {
          const pendingDeduct = k.status === "sold" && !k.stock_deducted_at;
          return (
            <article key={k.id} className="glass card-hover flex flex-col overflow-hidden !rounded-[20px]">
              <div className="relative h-[190px] bg-bg2">
                {k.image_url && <img src={k.image_url} alt={k.name_uz} className="h-full w-full object-cover" />}
                <span className={`absolute left-2.5 top-2.5 -rotate-2 rounded-full border border-[color:var(--border-strong)] px-2.5 py-1 text-[11px] font-bold ${k.status === "available" ? "bg-white/85 text-[#221833]" : "text-white"}`} style={k.status !== "available" ? { background: "var(--acc)" } : undefined}>
                  {(CATALOG_STATUS_LABEL[k.status] ?? k.status).toUpperCase()}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-[16px] font-bold tracking-tight">{k.name_uz || k.name_ru}</h3>
                  <span className="whitespace-nowrap text-[14px] font-bold" style={{ color: "var(--acc)" }}>{fmt(k.price)}</span>
                </div>
                <p className="text-[13px] leading-relaxed" style={{ color: "var(--mut)" }}>
                  {compositionText(k)}
                  {k.height_cm ? ` · bo'yi ${k.height_cm} sm` : ""} · {ARRANGEMENT_LABEL[k.arrangement_type] ?? k.arrangement_type}
                </p>
                {(k.description_uz || k.description_ru) && (
                  <p className="text-[13px] italic" style={{ color: "var(--mut)" }}>{k.description_uz || k.description_ru}</p>
                )}
                {k.instagram_story_url && (
                  <a href={k.instagram_story_url.startsWith("http") ? k.instagram_story_url : `https://${k.instagram_story_url}`} target="_blank" className="text-[13px] font-semibold">
                    ↗ Instagram story ({fmtTime(k.created_at)})
                  </a>
                )}

                {pendingDeduct && (
                  <div className="rounded-[13px] border-[1.5px] bg-tint p-3" style={{ borderColor: "var(--line)" }}>
                    <p className="mb-2 text-[13px] font-bold">⚠ Skladdan hali kamaytirilmagan. Kamaytirilsinmi?</p>
                    <div className="flex gap-2">
                      <button onClick={() => deduct(k)} disabled={busyId === k.id} className="flex-1 rounded-[10px] py-2 text-[13px] font-bold text-white disabled:opacity-60" style={{ background: "var(--side)" }}>
                        {busyId === k.id ? "…" : "Ha, kamaytirish"}
                      </button>
                    </div>
                  </div>
                )}

                {k.status === "sold" && k.stock_deducted_at && (
                  <div className="rounded-[11px] bg-mint px-3 py-2 text-xs font-bold text-mintink">✓ Sklad kamaytirilgan · {fmtTime(k.stock_deducted_at)}</div>
                )}

                {(k.status === "available" || k.status === "reserved" || k.status === "draft") && (
                  <button onClick={() => markSold(k)} disabled={busyId === k.id} className="mt-auto rounded-xl border-[1.5px] py-2 text-[13px] font-bold hover:bg-mint disabled:opacity-60" style={{ borderColor: "var(--line)" }}>
                    {busyId === k.id ? "…" : "Sotildi deb belgilash"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
        {items.length === 0 && <div className="col-span-full"><EmptyState title="Katalog hozircha bo&apos;sh" sub="Birinchi tayyor guldastani qo&apos;shing — story havolasi bilan." /></div>}
      </div>

      {formOpen && <KatalogModal onClose={() => setFormOpen(false)} onSaved={load} />}
    </>
  );
}
