"use client";
import FilterSelect from "@/components/FilterSelect";
import SharedDataNotice from "@/components/SharedDataNotice";
import ClearFilters from "@/components/ClearFilters";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Bell } from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { usePerm, useStore } from "@/lib/store";
import useAutoRefresh from "@/lib/useAutoRefresh";
import { fmtTime } from "@/lib/format";
import { NOTIF_TYPE_FILTERS, notifHref, notifMeta } from "@/lib/notifications";
import type { Notification, NotificationType } from "@/lib/types";

/**
 * Bildirishnomalar sahifasi — to'liq ro'yxat, tur va o'qilganlik filtrlari,
 * bittalab yoki barchasini o'qilgan qilish. Filtrlash server tomonda.
 * Har qator BOSILADI: o'qilgan qilinadi va tegishli obyektga o'tadi
 * (reference_type/reference_id → katalog, buyurtma, davomat, partiya…).
 */

export default function BildirishnomalarPage() {
  const router = useRouter();
  const { showToast, loadNotifs } = useStore();
  const me = useStore((s) => s.user);
  const { canControl } = usePerm();
  const control = canControl("notifications");
  const [items, setItems] = useState<Notification[] | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [type, setType] = useState<"" | NotificationType>("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    setLoadErr("");
    try {
      const ns = await api.notifications({
        ordering: "-created_at",
        notification_type: type || undefined,
        is_read: onlyUnread ? false : undefined,
      });
      setItems(ns);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Yuklashda xatolik");
    }
  }, [type, onlyUnread]);

  useEffect(() => { setItems(null); }, [type, onlyUnread]);
  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load); // jimgina davriy yangilash — real vaqt hissi

  const markOne = async (n: Notification) => {
    if (n.is_read || !control) return;
    setItems((xs) => xs?.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)) ?? null);
    try {
      await api.markNotificationRead(n.id);
      loadNotifs(); // header hisoblagichi sinxron
    } catch (e) {
      setItems((xs) => xs?.map((x) => (x.id === n.id ? { ...x, is_read: false } : x)) ?? null);
      showToast(e instanceof ApiError ? e.message : "Belgilab bo'lmadi");
    }
  };

  /** Qator bosilishi: o'qilgan qilamiz va bog'liq obyektga o'tamiz */
  const open = (n: Notification) => {
    markOne(n);
    const href = notifHref(n);
    if (href && href !== "/bildirishnomalar") router.push(href);
  };

  const markAll = async () => {
    setMarkingAll(true);
    try {
      await api.markAllNotificationsRead();
      setItems((xs) => xs?.map((x) => ({ ...x, is_read: true })) ?? null);
      loadNotifs();
      showToast("✓ Barchasi o'qilgan deb belgilandi");
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Belgilab bo'lmadi");
    } finally {
      setMarkingAll(false);
    }
  };

  const shown = (items ?? []).filter((n) => !onlyMine || (n.target_user != null && n.target_user === me?.id));
  const unread = items?.filter((n) => !n.is_read).length ?? 0;
  const mineCount = (items ?? []).filter((n) => n.target_user != null && n.target_user === me?.id).length;

  return (
    <>
      <SharedDataNotice screen="bildirishnomalar" className="mb-3" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterSelect
          value={type}
          onChange={(v) => setType(v as typeof type)}
          label="Turi"
          align="left"
          options={NOTIF_TYPE_FILTERS.map((f) => ({ value: f.value, label: f.label }))}
        />
        <button onClick={() => setOnlyUnread((v) => !v)} className={clsx("chip", onlyUnread && "chip-active")} aria-pressed={onlyUnread}>
          Faqat o&apos;qilmagan
        </button>
        {mineCount > 0 && (
          <button onClick={() => setOnlyMine((v) => !v)} className={clsx("chip", onlyMine && "chip-active")} aria-pressed={onlyMine}>
            Menga ({mineCount})
          </button>
        )}
        <ClearFilters show={!!(type || onlyUnread || onlyMine)} onClear={() => { setType(""); setOnlyUnread(false); setOnlyMine(false); }} />
        {control && unread > 0 && (
          <button onClick={markAll} disabled={markingAll} className={clsx("btn-secondary ml-auto !h-8 !flex-none px-4 !text-[12px]", markingAll && "btn-loading")}>
            Barchasini o&apos;qish ({unread})
          </button>
        )}
      </div>

      {loadErr && (
        <div className="mt-14 flex flex-col items-center gap-3">
          <p className="text-[14px] font-semibold" style={{ color: "var(--danger-ink)" }}>{loadErr}</p>
          <button onClick={load} className="btn-secondary !flex-none px-6">Qayta urinish</button>
        </div>
      )}

      {!loadErr && items === null && <FlowerLoader />}

      {items && (
        <div className="glass reading-glass !rounded-[18px] p-2">
          {shown.map((n, i) => {
            const meta = notifMeta(n.notification_type);
            const mine = n.target_user != null && n.target_user === me?.id;
            const href = notifHref(n);
            const linked = href !== "/bildirishnomalar";
            return (
              <button
                key={n.id}
                onClick={() => open(n)}
                className={clsx(
                  "row-lux notif-row group flex w-full items-start gap-3 rounded-[12px] px-3.5 py-3 text-left",
                  n.is_read && "opacity-60"
                )}
                style={{ animationDelay: `${Math.min(i * 35, 420)}ms` }}
                title={linked ? "Ochish" : undefined}
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: meta.soft, color: meta.color }}>
                  <Bell size={14} strokeWidth={2.2} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <b className="min-w-0 max-w-full truncate text-[14px]" title={n.title_uz || n.title_ru}>{n.title_uz || n.title_ru}</b>
                    <span className="rounded-full border px-2 py-px text-[11px] font-bold" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>{meta.label}</span>
                    {mine && (
                      <span className="rounded-full px-2 py-px text-[11px] font-bold text-white" style={{ background: "var(--primary)" }}>Sizga</span>
                    )}
                    {!n.is_read && <span className="h-2 w-2 rounded-full" style={{ background: "var(--primary)" }} aria-label="o'qilmagan" />}
                  </span>
                  {(n.body_uz || n.body_ru) && (
                    <span className="mt-0.5 block text-[13px] leading-relaxed" style={{ color: "var(--text-2)" }}>{n.body_uz || n.body_ru}</span>
                  )}
                  <span className="mt-0.5 block text-[12px]" style={{ color: "var(--muted)" }}>{fmtTime(n.created_at)}</span>
                </span>
                {linked && (
                  <span className="mt-1 shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-60" style={{ color: "var(--primary)" }}>
                    <ArrowUpRight size={16} strokeWidth={2} />
                  </span>
                )}
              </button>
            );
          })}
          {shown.length === 0 && (
            <EmptyState
              title={onlyUnread ? "O'qilmagan bildirishnoma yo'q" : onlyMine ? "Sizga yo'naltirilgan bildirishnoma yo'q" : "Bildirishnoma yo'q"}
              sub={type ? "Boshqa tur filtrini tanlab ko'ring." : "Yangi hodisalar shu yerda ko'rinadi."}
            />
          )}
        </div>
      )}
    </>
  );
}
