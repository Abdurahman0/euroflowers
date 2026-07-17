"use client";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { usePerm, useStore } from "@/lib/store";
import { fmtTime } from "@/lib/format";
import type { Notification, NotificationType } from "@/lib/types";

/**
 * Bildirishnomalar sahifasi — to'liq ro'yxat, tur va o'qilganlik filtrlari,
 * bittalab yoki barchasini o'qilgan qilish. Filtrlash server tomonda.
 */

const TYPE_META: Record<NotificationType, { label: string; color: string; soft: string }> = {
  lead: { label: "Lead", color: "var(--success)", soft: "var(--success-soft)" },
  handoff: { label: "Operator", color: "var(--warning)", soft: "var(--warning-soft)" },
  low_stock: { label: "Kam qoldiq", color: "var(--danger)", soft: "var(--danger-soft)" },
  stock_pending: { label: "Sklad yechimi", color: "var(--info)", soft: "var(--info-soft)" },
};

const TYPE_FILTERS: { value: "" | NotificationType; label: string }[] = [
  { value: "", label: "Hammasi" },
  { value: "lead", label: "Leadlar" },
  { value: "handoff", label: "Operator" },
  { value: "low_stock", label: "Kam qoldiq" },
  { value: "stock_pending", label: "Sklad" },
];

export default function BildirishnomalarPage() {
  const { showToast, loadNotifs } = useStore();
  const { canControl } = usePerm();
  const control = canControl("notifications");
  const [items, setItems] = useState<Notification[] | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [type, setType] = useState<"" | NotificationType>("");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    setItems(null);
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

  useEffect(() => { load(); }, [load]);

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

  const unread = items?.filter((n) => !n.is_read).length ?? 0;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {TYPE_FILTERS.map((f) => (
          <button key={f.value || "all"} onClick={() => setType(f.value)} className={clsx("chip", type === f.value && "chip-active")}>
            {f.label}
          </button>
        ))}
        <button onClick={() => setOnlyUnread((v) => !v)} className={clsx("chip", onlyUnread && "chip-active")} aria-pressed={onlyUnread}>
          Faqat o&apos;qilmagan
        </button>
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
        <div className="glass !rounded-[18px] p-2">
          {items.map((n, i) => {
            const meta = TYPE_META[n.notification_type] ?? TYPE_META.lead;
            return (
              <button
                key={n.id}
                onClick={() => markOne(n)}
                className={clsx(
                  "row-lux flex w-full items-start gap-3 rounded-[12px] px-3.5 py-3 text-left",
                  n.is_read && "opacity-60"
                )}
                style={{ animationDelay: `${Math.min(i * 35, 420)}ms` }}
              >
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold" style={{ background: meta.soft, color: meta.color }}>
                  !
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <b className="text-[14px]">{n.title_uz || n.title_ru}</b>
                    <span className="rounded-full border px-2 py-px text-[11px] font-bold" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>{meta.label}</span>
                    {!n.is_read && <span className="h-2 w-2 rounded-full" style={{ background: "var(--primary)" }} aria-label="o'qilmagan" />}
                  </span>
                  {(n.body_uz || n.body_ru) && (
                    <span className="mt-0.5 block text-[13px] leading-relaxed" style={{ color: "var(--text-2)" }}>{n.body_uz || n.body_ru}</span>
                  )}
                  <span className="mt-0.5 block text-[12px]" style={{ color: "var(--muted)" }}>{fmtTime(n.created_at)}</span>
                </span>
              </button>
            );
          })}
          {items.length === 0 && (
            <EmptyState
              title={onlyUnread ? "O'qilmagan bildirishnoma yo'q" : "Bildirishnoma yo'q"}
              sub={type ? "Boshqa tur filtrini tanlab ko'ring." : "Yangi hodisalar shu yerda ko'rinadi."}
            />
          )}
        </div>
      )}
    </>
  );
}
