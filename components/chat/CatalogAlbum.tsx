"use client";
import Link from "next/link";
import { AlertTriangle, EyeOff, Images } from "lucide-react";
import { fmt } from "@/lib/format";
import { ARRANGEMENT_LABEL } from "@/components/badges";
import { SENT_AS_LABEL, type AlbumItem, type AlbumView } from "@/lib/aiAlbum";

/**
 * KATALOG ALBOMI — AI mijozga yuborgan rasmlar galereyasi (system xabar).
 *
 * ⚠️ RAQAM — ENG MUHIM ELEMENT. Mijoz keyin «1chisi qancha» deb yozadi; operator
 * shu raqamdan mahsulotni ZUDLIK bilan topishi kerak. Shuning uchun raqam plitkadagi
 * eng yirik, eng kontrast element va u 38+ da ham buzilmaydi (tabular-nums, o'ralmaydi).
 *
 * ⚠️ RASMSIZ HAM ISHLAYDI: jonli javobda `image_url` YO'Q (lib/aiAlbum.ts izohi).
 * Rasm bo'lmasa raqamli plashka chiziladi — plitka ham, xabar ham bo'shab qolmaydi.
 */

function Tile({ it }: { it: AlbumItem }) {
  const inner = (
    <>
      <span className="relative block aspect-square w-full overflow-hidden rounded-md"
        style={{ background: "var(--surface-2)" }}>
        {it.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={it.image_url} alt={it.name} loading="lazy"
            className="h-full w-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} />
        ) : null}
        {/* ⚠️ RAQAM — rasm bor-yo'qligidan QAT'I NAZAR doim ko'rinadi */}
        <span
          className="absolute left-1 top-1 inline-flex min-w-[26px] items-center justify-center rounded-sm px-1.5 py-0.5 text-[15px] font-extrabold leading-none tabular-nums"
          style={{ background: "var(--primary)", color: "var(--primary-contrast, #fff)" }}
        >
          {it.position}
        </span>
        {!it.delivered && (
          <span className="absolute bottom-1 right-1 inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-[9.5px] font-bold"
            style={{ background: "var(--danger-ink)", color: "#fff" }}>
            <EyeOff size={9} strokeWidth={2.4} /> yetmadi
          </span>
        )}
      </span>
      <span className="mt-1 block truncate text-[11px] font-bold leading-tight" title={it.name}>{it.name}</span>
      <span className="block truncate text-[11px] tabular-nums" style={{ color: "var(--acc)" }}>
        {it.price ? fmt(it.price) : "narx yo'q"}
      </span>
      {it.type && (
        <span className="block truncate text-[10px]" style={{ color: "var(--muted)" }}>
          {ARRANGEMENT_LABEL[it.type] ?? it.type}
        </span>
      )}
    </>
  );
  const cls = "block min-w-0 text-left transition-opacity duration-150";
  // yetkazilmagan — XIRA (mijozga bu rasm bormagan)
  const style = it.delivered ? undefined : { opacity: 0.45 };
  // `catalog_id` bo'lsa — mahsulotga havola (operator darhol ocha oladi)
  return it.catalog_id ? (
    <Link href={`/katalog?item=${it.catalog_id}`} className={`${cls} hover:opacity-80`} style={style} title={`${it.position}. ${it.name}`}>
      {inner}
    </Link>
  ) : (
    <span className={cls} style={style}>{inner}</span>
  );
}

export default function CatalogAlbum({ album }: { album: AlbumView }) {
  // ⚠️ ok:false — galereya CHIZILMAYDI, faqat xato (spec)
  if (!album.ok) {
    return (
      <div className="rounded-md border px-3 py-2.5 text-[12.5px] font-bold"
        style={{ borderColor: "color-mix(in srgb, var(--danger-ink) 40%, var(--border))", background: "var(--danger-soft, rgba(160,74,74,.10))", color: "var(--danger-ink)" }}>
        <span className="flex items-center gap-1.5"><AlertTriangle size={14} strokeWidth={2.2} /> Katalog rasmlari yuborilmadi</span>
        {album.notSent.length > 0 && (
          <ul className="mt-1 list-none space-y-0.5 text-[11.5px] font-semibold">
            {album.notSent.map((n, i) => <li key={i}>· {n.label}{n.reason ? ` — ${n.reason}` : ""}</li>)}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-md border p-2.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="flex items-center gap-1.5 text-[12.5px] font-bold">
          <Images size={14} strokeWidth={2} style={{ color: "var(--primary)" }} />
          {album.header}
        </span>
        {album.sentAs && (
          <span className="rounded-sm px-1.5 py-0.5 text-[10.5px] font-bold"
            style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
            {SENT_AS_LABEL[album.sentAs] ?? album.sentAs}
          </span>
        )}
        {album.undelivered > 0 && (
          <span className="rounded-sm px-1.5 py-0.5 text-[10.5px] font-bold"
            style={{ background: "color-mix(in srgb, var(--danger-ink) 14%, transparent)", color: "var(--danger-ink)" }}>
            {album.undelivered} ta yetmadi
          </span>
        )}
      </div>

      {album.items.length === 0 ? (
        <p className="text-[12px]" style={{ color: "var(--muted)" }}>Ro&apos;yxat bo&apos;sh — mahsulot qaytmadi.</p>
      ) : (
        /* ⚠️ 38+ plitka: mobilda 3, keyin 5, kengda 7 ustun — raqam har doim o'qiladi */
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5 lg:grid-cols-7">
          {album.items.map((it) => <Tile key={`${it.position}-${it.catalog_id ?? "x"}`} it={it} />)}
        </div>
      )}

      {album.notSent.length > 0 && (
        <p className="mt-2 text-[11.5px] font-semibold" style={{ color: "var(--warning-ink, #8a6d1f)" }}>
          {album.notSent.length} ta mahsulot yuborilmadi
          {album.notSent.some((n) => n.reason) ? ` — ${album.notSent.filter((n) => n.reason).map((n) => `${n.label}: ${n.reason}`).join(" · ")}` : ""}
        </p>
      )}
      <p className="mt-1.5 text-[10.5px] leading-snug" style={{ color: "var(--muted)" }}>
        Mijoz shu raqamlarni ko&apos;rgan — «1chisi qancha» degani shu ro&apos;yxatdagi 1-raqam.
      </p>
    </div>
  );
}
