"use client";
import { AlertCircle, ArrowLeft, Clock3, MoonStar, RotateCw, Sparkles, Trash2 } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { InstagramIcon, TelegramIcon } from "@hugeicons/core-free-icons";
import SearchInput from "@/components/SearchInput";
import ClearFilters from "@/components/ClearFilters";
import FilterSelect from "@/components/FilterSelect";
import PauseAIModal from "@/components/PauseAIModal";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import useVisiblePoll from "@/lib/useVisiblePoll";
import { fmtTime, initials } from "@/lib/format";
import { CONV_STATUS_LABEL } from "@/components/badges";
import { Icon } from "@/components/icons";
import MessageMedia, { MediaLightbox, mediaBodyText, parseMedia } from "@/components/chat/MessageMedia";
import RichText from "@/components/chat/RichText";
import { readDeepLinkConv, chatUrlFor } from "@/lib/chatDeepLink";
import CatalogAlbum from "@/components/chat/CatalogAlbum";
import { parseAlbum } from "@/lib/aiAlbum";
import type { Conversation, Message } from "@/lib/types";

/**
 * Zamonaviy AI-chat maketi:
 *   • mijoz xabarlari — CHAPDA (neytral yuzada)
 *   • AI javoblari — O'NGDA (brend rangida)
 *   • operator javoblari — O'NGDA (to'q yuzada)
 * Guruhlash, hover amallar (nusxa/vaqt), sticky kiritish.
 */


type Side = "left" | "right" | "center";
const sideOf = (m: Message): Side => (m.sender === "customer" ? "left" : m.sender === "system" ? "center" : "right");

function Avatar({ m, custName }: { m: Message; custName: string }) {
  if (m.sender === "customer")
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-bold" style={{ background: "var(--surface-solid)", borderColor: "var(--border)", color: "var(--text-2)" }}>
        {initials(custName)}
      </span>
    );
  if (m.sender === "ai")
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-extrabold text-white" style={{ background: "var(--primary)" }}>
        AI
      </span>
    );
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-extrabold text-[#F5F0E8]" style={{ background: "var(--side)" }}>
      OP
    </span>
  );
}

function MessageRow({
  m,
  custName,
  groupWithPrev,
  groupWithNext,
  onCopy,
  onOpenImage,
  onMediaReady,
  onRetry,
  onEditFailed,
}: {
  m: Message;
  custName: string;
  groupWithPrev: boolean;
  groupWithNext: boolean;
  onCopy: (text: string) => void;
  /** rasm bosilganda lightbox (sahifa boshqaradi) */
  onOpenImage: (url: string) => void;
  /** media yuklanib bubble balandligi o'zgardi — skroll pastda qolsin */
  onMediaReady: () => void;
  /** yuborilmagan xabarni qayta yuborish */
  onRetry?: () => void;
  /** yuborilmagan matnni kiritish maydoniga qaytarish */
  onEditFailed?: () => void;
}) {
  // MEDIA: rasm / video / ovoz / reel / fayl / IG story / AI katalog rasmi
  // (aniqlash MessageMedia'da — real backend attachments[]/image_tool_result — MEDIA_NOTES.md)
  const media = parseMedia(m);
  // media URL(lar)i va bo'sh yorliq satrlari matndan olib tashlanadi
  const bodyText = mediaBodyText(m, media);

  // AI/tizim yuborgan media (image_tool_result) — CHIQAYOTGAN pufak (o'ngda)
  const side: Side = m.sender === "system" && media ? "right" : sideOf(m);

  /* ⚠️ KATALOG ALBOMI — `text` BO'SH bo'lgani uchun bu xabar quyidagi
     «bo'sh tizim yozuvi ko'rsatilmaydi» sharti bilan BUTUNLAY yo'qolardi:
     operator mijoz qaysi rasmlarni va qaysi raqamlar ostida ko'rganini bilmasdi.
     Shu bois u shartdan OLDIN, o'z galereyasi bilan chiziladi.
     ⚠️ `image_tool_result` bunga TEGMAYDI — u avvalgidek `parseMedia` orqali. */
  const album = m.sender === "system" ? parseAlbum(m.metadata) : null;
  if (album) {
    return (
      <div className="mt-4 flex justify-center">
        <div className="w-full max-w-[92%]">
          <CatalogAlbum album={album} />
          <div className="mt-1 text-center text-[10.5px]" style={{ color: "var(--muted)" }}>{fmtTime(m.created_at)}</div>
        </div>
      </div>
    );
  }

  if (side === "center") {
    if (!m.text.trim()) return null; // bo'sh tizim yozuvi ko'rsatilmaydi
    return (
      <div className="flex justify-center">
        <span className="max-w-full break-words rounded-full border px-3 py-1 text-center text-[11px] font-medium" style={{ borderColor: "var(--border)", color: "var(--muted)", background: "var(--surface)", overflowWrap: "anywhere" }}>
          <RichText text={m.text} /> · {fmtTime(m.created_at)}
        </span>
      </div>
    );
  }

  const isLeft = side === "left";
  const bubbleStyle =
    m.sender === "customer"
      ? { background: "var(--surface-solid)", border: "1px solid var(--border)", color: "var(--text)" }
      : m.sender === "ai"
        ? { background: "var(--primary)", color: "#fff" }
        : { background: "var(--side)", color: "#F5F0E8" };

  const fileName = typeof m.metadata?.file_name === "string" ? (m.metadata.file_name as string) : null;
  const mediaOnly = !!media && !bodyText;

  return (
    <div className={clsx("group/msg flex items-end gap-2", isLeft ? "justify-start" : "justify-end", groupWithPrev ? "mt-1" : "mt-4")}>
      {/* chap avatar — guruh oxirida */}
      {isLeft && <span className={clsx(!groupWithNext ? "opacity-100" : "opacity-0")}><Avatar m={m} custName={custName} /></span>}

      <div className={clsx("relative flex max-w-[72%] flex-col", isLeft ? "items-start" : "items-end")}>
        {/* hover amallar paneli */}
        <div
          className={clsx(
            "pointer-events-none absolute -top-8 z-10 flex items-center gap-1 rounded-full border px-1.5 py-1 opacity-0 shadow-sm transition-opacity duration-200 group-hover/msg:pointer-events-auto group-hover/msg:opacity-100",
            isLeft ? "left-0" : "right-0"
          )}
          style={{ background: "var(--surface-solid)", borderColor: "var(--border)" }}
        >
          <span className="px-1.5 text-[11px] font-medium" style={{ color: "var(--muted)" }}>{fmtTime(m.created_at)}</span>
          <button
            onClick={() => onCopy(m.text)}
            data-copy
            title="Nusxalash"
            className="flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-200 hover:bg-[var(--hover)]"
            style={{ color: "var(--text-2)" }}
          >
            <Icon name="copy" size={13} />
          </button>
        </div>

        {/* pufak — overflowWrap:anywhere: probelsiz uzun matn/URL pufakdan
            toshib chiqmaydi, aksincha o'raladi (min-w-0 flex ichida ham) */}
        <div
          className={clsx(
            "min-w-0 max-w-full whitespace-pre-line break-words text-[14px] leading-relaxed",
            // media-only pufak ixcham: ortiqcha padding yo'q (Telegram uslubi)
            mediaOnly ? "p-1.5" : "px-4 py-2.5",
            isLeft
              ? clsx("rounded-[16px]", !groupWithNext && "rounded-bl-[6px]")
              : clsx("rounded-[16px]", !groupWithNext && "rounded-br-[6px]")
          )}
          style={{
            ...bubbleStyle,
            overflowWrap: "anywhere",
            wordBreak: "break-word",
            // optimistik holatlar: yuborilmoqda — sustroq, yuborilmadi — qizil kontur
            ...(m.ui_status === "sending" ? { opacity: 0.6 } : {}),
            ...(m.ui_status === "failed" ? { boxShadow: "inset 0 0 0 1.5px var(--danger-ink)" } : {}),
          }}
        >
          {media && (
            <div className={bodyText ? "mb-2" : undefined}>
              <MessageMedia
                media={media}
                seed={m.id}
                onLight={m.sender === "customer"}
                onOpenImage={onOpenImage}
                onReady={onMediaReady}
              />
            </div>
          )}
          {fileName && !media && (
            <span className="mb-2 flex items-center gap-2.5 rounded-[10px] border border-[color:var(--border)] bg-[color:var(--hover)] px-3 py-2.5">
              <Icon name="attachment" size={15} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{fileName}</span>
            </span>
          )}
          {/* ⚠️ Havolalar BOSILADIGAN — AI media handoff'da mijozning story/reel havolasi
              shu pufakda keladi (MEDIA pufagida URL matndan olib tashlangan bo'ladi). */}
          <RichText text={bodyText} tone={isLeft ? "plain" : "brand"} />
        </div>

        {/* YUBORILMADI — aniq xato, qayta yuborish va matnni tahrirlash */}
        {m.ui_status === "failed" && (
          <div className="mt-1 flex max-w-full flex-col items-end gap-1">
            <span className="flex items-center gap-1.5 text-[11.5px] font-semibold" style={{ color: "var(--danger-ink)" }}>
              <AlertCircle size={12} strokeWidth={2.2} />
              {m.ui_error || "Message yuborilmadi. Qayta urinib ko'ring."}
            </span>
            <span className="flex items-center gap-1.5">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition-colors duration-150 hover:bg-[var(--hover)]"
                  style={{ borderColor: "var(--danger-ink)", color: "var(--danger-ink)" }}
                >
                  <RotateCw size={11} strokeWidth={2.2} /> Qayta yuborish
                </button>
              )}
              {onEditFailed && (
                <button
                  onClick={onEditFailed}
                  className="rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition-colors duration-150 hover:bg-[var(--hover)]"
                  style={{ borderColor: "var(--border)", color: "var(--text-2)" }}
                >
                  Tahrirlash
                </button>
              )}
            </span>
          </div>
        )}

        {/* guruh oxiridagi vaqt */}
        {!groupWithNext && m.ui_status !== "failed" && (
          <span className={clsx("mt-1 flex items-center gap-1 text-[11px] font-medium", isLeft ? "ml-1" : "mr-1")} style={{ color: "var(--muted)" }}>
            {m.ui_status === "sending" && <Clock3 size={10} strokeWidth={2.2} />}
            {m.sender === "ai" ? "AI · " : m.sender === "operator" ? "Operator · " : ""}
            {m.ui_status === "sending" ? "yuborilmoqda…" : fmtTime(m.created_at)}
          </span>
        )}
      </div>

      {/* o'ng avatar — guruh oxirida */}
      {!isLeft && <span className={clsx(!groupWithNext ? "opacity-100" : "opacity-0")}><Avatar m={m} custName={custName} /></span>}
    </div>
  );
}

export default function ChatPage() {
  const showToast = useStore((s) => s.showToast);
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  /**
   * ⚠️ DEEP-LINK — `?conversation_id=<id>` (AI media handoff: operator Telegram
   *    guruhidagi «CRM chatni ochish» tugmasi) va eski `?conv=<id>`.
   *    Faqat MOUNT paytida o'qiladi: keyin URL ochiq suhbat bo'yicha yangilanadi.
   */
  const deepConv = useMemo(() => (typeof window !== "undefined" ? readDeepLinkConv(window.location.search) : null), []);
  const [selId, setSelId] = useState<number | null>(deepConv);
  const [conv, setConv] = useState<Conversation | null>(null);
  /** Suhbatni ochib bo'lmadi (o'chirilgan/noto'g'ri id) — deep-link uchun ANIQ xato kerak,
      aks holda operator «Suhbat yuklanmoqda…» yozuvi bilan qolib ketardi. */
  const [convErr, setConvErr] = useState<{ id: number; msg: string } | null>(null);
  /** Deep-link suhbati ro'yxatda ko'rinmayapti (filtr yoki eskirgan ro'yxat) — chap panelda tanlangan qator yo'q. */
  const [deepMissing, setDeepMissing] = useState(false);
  const deepDone = useRef(false);
  const deepRowRef = useRef<HTMLButtonElement | null>(null);
  const deepScrolled = useRef(false);
  const [confirmDel, setConfirmDel] = useState(false);
  // <768px: bitta panel ko'rinadi — ro'yxat yoki suhbat (orqaga bilan qaytiladi)
  const [mobileConv, setMobileConv] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState(""); // suhbat holati — server filtri
  const [chanF, setChanF] = useState<"" | "instagram" | "telegram">(""); // platforma filtri
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  /** Optimistik (hali serverga tushmagan) operator xabarlari — suhbat bo'yicha.
      Gateway/Instagram xatosida yozuv YO'QOLMAYDI: pufak "failed" bo'lib qoladi,
      qayta yuborish yoki matnni inputga qaytarish mumkin (kontrakt: 6fa3c47, 2d10b96). */
  const [pending, setPending] = useState<{ key: number; conv: number; text: string; created_at: string; status: "sending" | "failed"; error?: string }[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  // media lightbox (rasm) + xabarlar ro'yxati skrolli
  const [lightbox, setLightbox] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [chatH, setChatH] = useState<number | null>(null);

  // chat pastki chegarasi sidebar pastki chegarasi bilan bir xil:
  // sidebar viewport pastidan 14px (Shell p-3.5) yuqorida tugaydi —
  // balandlikni o'lchab, aynan shu chiziqqacha cho'zamiz
  useEffect(() => {
    const measure = () => {
      const top = rootRef.current?.getBoundingClientRect().top ?? 0;
      setChatH(Math.max(window.innerHeight - top - 14, 420));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [loading]);

  const loadList = useCallback(async () => {
    try {
      // manba filtri server tomonda (backend `source` bo'yicha filtrlaydi)
      const cs = await api.conversations({ ordering: "-last_message_at", status: statusF || undefined, source: chanF || undefined });
      setConvs(cs);
      setSelId((id) => id ?? cs[0]?.id ?? null);
      // ⚠️ DEEP-LINK: mobil ko'rinishda suhbat paneli DARHOL ochiladi — ro'yxatda
      //    topilmasa ham (detal API orqali ochiladi). Ilgari faqat ro'yxatda bor
      //    suhbat uchun ochilardi: Telegramdan kelgan operator telefonida ro'yxatni
      //    ko'rib, qaysi chatga tushishini o'zi qidirishga majbur bo'lardi.
      if (deepConv && !deepDone.current) {
        deepDone.current = true;
        setMobileConv(true);
      }
      if (deepConv) setDeepMissing(!cs.some((c) => c.id === deepConv));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Suhbatlarni yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, [showToast, statusF, chanF, deepConv]);

  /**
   * Suhbat detali. `strict` — deep-link uchun: xato JIM YUTILMAYDI, operatorga aytiladi.
   * ⚠️ Jonli tekshiruv (2026-08-20): `GET /api/conversations/{id}/` mavjud va yo'q id uchun
   *    404 beradi — shuning uchun spec §3 dagi «detal API bo'lmasa» zaxira yo'li kerak emas.
   *    404 da BIR MARTA ro'yxat qayta so'raladi (endigina yaratilgan suhbat holati uchun).
   */
  const loadConv = useCallback(async (id: number, strict = false) => {
    try {
      setConv(await api.conversation(id));
      setConvErr(null);
    } catch (e) {
      if (!strict) return; // fon so'rovi — ro'yxat yangilanganda qayta urinadi
      const notFound = e instanceof ApiError && e.status === 404;
      setConvErr({
        id,
        msg: notFound
          ? "Bu suhbat topilmadi — o'chirilgan bo'lishi yoki havoladagi raqam noto'g'ri bo'lishi mumkin."
          : e instanceof Error ? e.message : "Suhbatni ochib bo'lmadi.",
      });
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);
  // ⚠️ Ro'yxat — 30 s, FAQAT varaq ko'rinib turganda (ilgari 15 s va fonda ham ishlardi)
  useVisiblePoll(loadList, 30_000, true);

  useEffect(() => {
    if (selId == null) return;
    setConv(null);
    setConvErr(null);
    // deep-link suhbati — xato JIM YUTILMAYDI (strict)
    loadConv(selId, deepConv === selId);
  }, [selId, loadConv, deepConv]);

  /** ⚠️ URL ochiq suhbatni ko'rsatib turadi: yangilash/ulashish o'sha chatni ochadi,
      Telegramdan kelgan uzun `?conversation_id=` esa qisqa `?conv=` ga normallashadi.
      `replaceState` — tarixga yozuv qo'shmaydi (orqaga tugmasi buzilmaydi). */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const next = chatUrlFor(selId);
    if (window.location.pathname + window.location.search !== next) window.history.replaceState(null, "", next);
  }, [selId]);
  /**
   * ⚠️ OCHIQ SUHBAT — 10 s (ilgari 7 s va varaq yashiringanda ham ishlardi).
   * Suhbat tanlanmagan bo'lsa taymer UMUMAN yaratilmaydi.
   */
  useVisiblePoll(() => { if (selId != null) loadConv(selId); }, 10_000, selId != null && convErr == null);

  // deep-link qatori chizilishi bilan BIR MARTA ko'rinadigan joyga suriladi
  useEffect(() => {
    if (deepConv == null || deepScrolled.current || !deepRowRef.current) return;
    deepScrolled.current = true;
    deepRowRef.current.scrollIntoView({ block: "nearest" });
  }, [deepConv, convs]);

  /** joriy suhbatning yuborilmagan/yuborilayotgan xabarlari */
  const convPending = pending.filter((p) => p.conv === selId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conv?.messages.length, convPending.length]);

  /** Media yuklanib bubble balandligi o'zgardi: foydalanuvchi pastda bo'lsa
      pastga yopishib turamiz, yuqorini o'qiyotgan bo'lsa joyini saqlaymiz. */
  const keepPinned = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (atBottom) el.scrollTop = el.scrollHeight;
  }, []);

  /**
   * Xabar yuborish — optimistik. Backend endi gateway xatosida 500 bermaydi,
   * boshqariladigan xato qaytaradi: uni odam o'qiydigan holatga aylantiramiz.
   */
  const deliver = useCallback(async (key: number, convId: number, body: string) => {
    setPending((ps) => ps.map((p) => (p.key === key ? { ...p, status: "sending", error: undefined } : p)));
    try {
      await api.sendMessage(convId, body);
      setPending((ps) => ps.filter((p) => p.key !== key)); // haqiqiy xabar ro'yxatdan keladi
      await loadConv(convId);
      loadList();
    } catch (e) {
      // `detail` massiv bo'lsa ApiError uni qatorlarga yig'ib beradi
      const msg = e instanceof ApiError ? e.message : "Message yuborilmadi. Qayta urinib ko'ring.";
      setPending((ps) => ps.map((p) => (p.key === key ? { ...p, status: "failed", error: msg } : p)));
      showToast(msg);
    }
  }, [loadConv, loadList, showToast]);

  const send = async () => {
    if (!text.trim() || selId == null || sending) return;
    const t = text.trim();
    const key = Date.now();
    const convId = selId;
    setSending(true);
    // matn darhol pufak bo'lib chiqadi va input bo'shaydi — xato bo'lsa
    // pufakda "failed" holatida saqlanadi (yozuv yo'qolmaydi)
    setPending((ps) => [...ps, { key, conv: convId, text: t, created_at: new Date().toISOString(), status: "sending" }]);
    setText("");
    try {
      await deliver(key, convId, t);
    } finally {
      setSending(false);
    }
  };

  const doDelete = async () => {
    if (selId == null || deleting) return;
    setDeleting(true);
    try {
      await api.deleteConversation(selId);
      setConvs((cs) => {
        const rest = cs.filter((c) => c.id !== selId);
        setSelId(rest[0]?.id ?? null);
        return rest;
      });
      setConv(null);
      setConfirmDel(false);
      showToast("✓ Suhbat o'chirildi");
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "O'chirib bo'lmadi");
    } finally {
      setDeleting(false);
    }
  };

  const doResumeAi = async () => {
    if (selId == null) return;
    try {
      setConv(await api.resumeAi(selId));
      showToast("AI qayta yoqildi");
      loadList();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Yoqib bo'lmadi");
    }
  };

  const copyText = (t: string) => {
    navigator.clipboard?.writeText(t).then(
      () => showToast("Nusxalandi"),
      () => showToast("Nusxalab bo'lmadi")
    );
  };

  const q = search.trim().toLowerCase();
  // manba: backend `source` maydoni AVTORITATIV; eski `channel` va mijoz
  // ma'lumotidan aniqlash — faqat zaxira yo'l
  const chanOfRaw = (c: Conversation): "instagram" | "telegram" => {
    if (c.source === "telegram" || c.source === "instagram") return c.source;
    if (c.channel === "telegram" || c.channel === "instagram") return c.channel;
    return c.customer_detail?.instagram_username || c.customer_detail?.instagram_user_id ? "instagram" : "telegram";
  };
  const fConvs = convs.filter((c) => {
    if (chanF && chanOfRaw(c) !== chanF) return false;
    if (!q) return true;
    return (
      (c.customer_detail?.name ?? "").toLowerCase().includes(q) ||
      (c.customer_detail?.instagram_username ?? "").toLowerCase().includes(q)
    );
  });

  const custName = (c: Conversation) => c.customer_detail?.name || `@${c.customer_detail?.instagram_username ?? "—"}`;

  /** Suhbat platformasi: backend `channel` bersa — o'sha; aks holda mijozning
      Instagram ma'lumoti bo'yicha aniqlanadi (yo'q bo'lsa Telegram). */
  const channelOf = chanOfRaw;

  const IG_GRADIENT = "linear-gradient(45deg, #f9ce34, #ee2a7b, #6228d7)";
  const TG_BLUE = "#229ED9";

  /** Avatar burchagidagi mini platforma belgisi — Instagram gradienti / Telegram ko'ki. */
  const ChannelDot = ({ c }: { c: Conversation }) => {
    const ch = channelOf(c);
    return (
      <span
        className="absolute -bottom-0.5 -right-0.5 flex h-[16px] w-[16px] items-center justify-center rounded-full border-2"
        style={{ borderColor: "var(--surface-solid)", background: ch === "instagram" ? IG_GRADIENT : TG_BLUE }}
        title={ch === "instagram" ? "Instagram" : "Telegram"}
        aria-label={ch === "instagram" ? "Instagram suhbati" : "Telegram suhbati"}
      >
        {ch === "instagram" ? (
          <HugeiconsIcon icon={InstagramIcon} size={10} strokeWidth={2.5} className="text-white" />
        ) : (
          <HugeiconsIcon icon={TelegramIcon} size={10} strokeWidth={2.5} className="text-white" />
        )}
      </span>
    );
  };

  if (loading) return <FlowerLoader />;

  return (
    <div
      ref={rootRef}
      className="mb-[-40px] flex min-h-[460px] flex-col items-stretch gap-4 overflow-hidden md:flex-row"
      style={{ height: chatH ?? "calc(100dvh - 173px)" }}
    >
      {/* suhbatlar ro'yxati */}
      <div className={clsx("flex min-h-0 min-w-0 flex-1 flex-col gap-3 md:h-full md:min-w-[230px] md:max-w-[340px] md:basis-60", mobileConv && "max-md:hidden")}>
        <div className="flex items-center gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Qidirish — ism yoki @username" width="full" className="min-w-0 flex-1 !rounded-[14px] px-3.5 py-1" />
          <FilterSelect
            value={statusF}
            onChange={setStatusF}
            label="Holat"
            options={[
              { value: "", label: "Barcha suhbatlar" },
              { value: "ai", label: "AI faol" },
              { value: "operator", label: "Operatorda" },
              { value: "closed", label: "Yopilgan" },
            ]}
          />
          <ClearFilters show={!!(search || statusF || chanF)} onClear={() => { setSearch(""); setStatusF(""); setChanF(""); }} />
        </div>
        {/* platforma filtri — Instagram gradienti / Telegram ko'ki bilan segment */}
        <div className="bg-sfc flex items-center rounded-full border p-1" style={{ borderColor: "var(--border)" }} role="tablist" aria-label="Platforma filtri">
          {([
            { value: "" as const, label: "Barchasi", icon: null, bg: "var(--primary)" },
            { value: "instagram" as const, label: "Instagram", icon: InstagramIcon, bg: IG_GRADIENT },
            { value: "telegram" as const, label: "Telegram", icon: TelegramIcon, bg: TG_BLUE },
          ]).map((ch) => {
            const active = chanF === ch.value;
            return (
              <button
                key={ch.value || "all"}
                onClick={() => setChanF(ch.value)}
                aria-pressed={active}
                className={clsx(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-[12px] font-bold transition-all duration-200",
                  active ? "text-white shadow-sm" : "hover:bg-[var(--hover)]"
                )}
                style={active ? { background: ch.bg } : { color: "var(--muted)" }}
              >
                {ch.icon && <HugeiconsIcon icon={ch.icon} size={13} strokeWidth={2} />}
                {ch.label}
              </button>
            );
          })}
        </div>
        <div data-lenis-prevent className="glass flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain !rounded-[16px] p-2">
          {fConvs.map((c) => (
            <button
              key={c.id}
              /* ⚠️ Deep-link suhbati uzun ro'yxatning ichida qolib ketmasin — ko'rinadigan joyga suriladi */
              ref={c.id === deepConv ? deepRowRef : undefined}
              onClick={() => { setSelId(c.id); setMobileConv(true); }}
              className={clsx(
                "flex items-center gap-2.5 rounded-[12px] p-2.5 text-left transition-colors duration-200",
                selId === c.id ? "bg-[var(--primary-soft)]" : "hover:bg-[var(--hover)]"
              )}
            >
              <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-bold" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-2)" }}>
                {initials(custName(c))}
                <ChannelDot c={c} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[14px] font-semibold" style={{ color: "var(--text)" }}>{custName(c)}</span>
                  {c.status === "operator" && <span className="rounded-full px-1.5 text-[11px] font-bold" style={{ background: "var(--warning-soft)", color: "var(--warning-ink)" }}>OPERATOR</span>}
                  {c.is_ai_paused && <span className="rounded-full px-1.5 text-[11px] font-bold" style={{ background: "var(--warning-soft)", color: "var(--warning-ink)" }}>AI PAUZA</span>}
                  {c.status === "closed" && <span className="rounded-full px-1.5 text-[11px] font-bold" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>YOPIQ</span>}
                </div>
                {/* ⚠️ AI XULOSASI — operator uchun ro'yxatdagi ENG foydali satr: suhbatni
                    ochmasdan nima gapligini ko'rsatadi. Lead hali yaratilmagan suhbatda
                    bo'sh satr keladi → o'sha yerda oxirgi xabar ko'rinadi (bo'sh qator EMAS).
                    Bir qatorda, to'lig'i tooltipda. */}
                {c.ai_summary?.trim() ? (
                  <div className="flex items-center gap-1" title={c.ai_summary}>
                    <Sparkles size={10} strokeWidth={2.4} className="shrink-0" style={{ color: "var(--primary)" }} />
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold" style={{ color: "var(--text-2)" }}>{c.ai_summary}</span>
                  </div>
                ) : (
                  <div className="truncate text-xs" style={{ color: "var(--muted)" }}>{c.last_message?.text ?? "…"}</div>
                )}
              </div>
              <div className="text-right text-[11px]" style={{ color: "var(--muted)" }}>{fmtTime(c.last_message_at)}</div>
            </button>
          ))}
          {fConvs.length === 0 && <EmptyState title="Suhbat topilmadi" sub="Qidiruvni o'zgartirib ko'ring." />}
        </div>
      </div>

      {/* suhbat oynasi */}
      <div className={clsx("glass flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden !rounded-[18px] md:h-full md:min-w-[300px] md:flex-[2] md:basis-80", !mobileConv && "max-md:hidden")}>
        {conv ? (
          <>
            {/* sarlavha */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-3 py-3 sm:px-5 sm:py-3.5" style={{ borderColor: "var(--border)" }}>
              <button onClick={() => setMobileConv(false)} className="icon-btn md:hidden" aria-label="Suhbatlar ro'yxatiga qaytish" title="Orqaga">
                <ArrowLeft size={18} strokeWidth={1.75} />
              </button>
              <div className="relative hidden h-[42px] w-[42px] items-center justify-center rounded-full border font-bold sm:flex" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-2)" }}>
                {initials(custName(conv))}
                <ChannelDot c={conv} />
              </div>
              <div className="min-w-[150px] flex-1">
                <div className="truncate text-[14px] font-bold" style={{ color: "var(--text)" }}>
                  {custName(conv)}{" "}
                  <span className="text-[13px] font-medium" style={{ color: "var(--muted)" }}>@{conv.customer_detail?.instagram_username}</span>
                </div>
                {/* ⚠️ Xulosa — ro'yxatdagi ENG foydali satr. `truncate` bir qatorda qoldiradi,
                    lekin blok butun kenglikni egallaydi va to'lig'i tooltipda ko'rinadi. */}
                {conv.ai_summary?.trim() && (
                  <div className="mt-0.5 flex items-center gap-1.5" title={conv.ai_summary}>
                    <Sparkles size={11} strokeWidth={2.4} className="shrink-0" style={{ color: "var(--primary)" }} />
                    <span className="min-w-0 flex-1 truncate text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>{conv.ai_summary}</span>
                  </div>
                )}
                <div className="truncate text-xs" style={{ color: "var(--muted)" }}>{channelOf(conv) === "telegram" ? "Telegram" : "Instagram DM"} · {conv.customer_detail?.phone || conv.customer_detail?.masked_phone || "tel yo'q"}</div>
                {/* ⚠️ Havola orqali ochilgan, ammo chap ro'yxatda qatori YO'Q (filtr yoki
                    eskirgan ro'yxat) — operator «qaysi chatdaman?» deb qolmasin. */}
                {deepMissing && deepConv != null && conv.id === deepConv && selId === deepConv && (
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] font-semibold" style={{ color: "var(--warning-ink, #8a6d1f)" }}>
                    <span className="rounded-full px-2 py-0.5" style={{ background: "var(--warning-soft)" }}>Havola orqali ochildi · #{conv.id}</span>
                    <span style={{ color: "var(--muted)" }}>chap ro&apos;yxatda ko&apos;rinmaydi</span>
                    {!!(search || statusF || chanF) && (
                      <button onClick={() => { setSearch(""); setStatusF(""); setChanF(""); }} className="underline underline-offset-2" style={{ color: "var(--primary)" }}>
                        Filtrlarni tozalash
                      </button>
                    )}
                  </div>
                )}
              </div>
              <span
                className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-bold"
                style={
                  conv.status === "ai"
                    ? { background: "var(--success-soft)", color: "var(--success-ink)", borderColor: "color-mix(in srgb, var(--success) 25%, transparent)" }
                    : conv.status === "operator"
                      ? { background: "var(--warning-soft)", color: "var(--warning-ink)", borderColor: "color-mix(in srgb, var(--warning) 25%, transparent)" }
                      : { background: "var(--surface-2)", color: "var(--muted)", borderColor: "var(--border)" }
                }
              >
                <span className="h-[7px] w-[7px] rounded-full" style={{ background: conv.status === "ai" ? "var(--success)" : conv.status === "operator" ? "var(--warning)" : "var(--muted)" }} />
                {CONV_STATUS_LABEL[conv.status]}
              </span>
              {/* AI pauzada — badge (vaqtli yoki doimiy) */}
              {conv.is_ai_paused || conv.ai_paused_until != null || (conv.status !== "ai" && conv.ai_pause_reason) ? (
                <span
                  className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-bold"
                  style={{ background: "var(--warning-soft)", color: "var(--warning-ink)", borderColor: "color-mix(in srgb, var(--warning) 25%, transparent)" }}
                  title={conv.ai_pause_reason || undefined}
                >
                  <MoonStar size={12} strokeWidth={2} />
                  {conv.ai_paused_until ? `Pauza · ${fmtTime(conv.ai_paused_until)} gacha` : "Pauza"}
                </span>
              ) : null}
              {conv.status === "ai" && (
                <button
                  onClick={() => setPauseOpen(true)}
                  className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors duration-200 hover:bg-[var(--warning-soft)]"
                  style={{ borderColor: "var(--border)", color: "var(--text-2)" }}
                  title="AI'ni vaqtincha yoki doimiy o'chirish"
                >
                  <MoonStar size={13} strokeWidth={1.75} /> Pauza
                </button>
              )}
              {(conv.status === "operator" || conv.ai_paused_until != null) && (
                <button onClick={doResumeAi} className="rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors duration-200 hover:bg-[var(--success-soft)]" style={{ borderColor: "var(--border)", color: "var(--text-2)" }}>
                  AI&apos;ga qaytarish
                </button>
              )}
              <button onClick={() => setConfirmDel(true)} className="icon-btn icon-btn-danger border" style={{ borderColor: "var(--border)" }} title="Suhbatni o'chirish" aria-label="Suhbatni o'chirish">
                <Trash2 size={16} strokeWidth={1.75} />
              </button>
            </div>

            {/* ⚠️ AI XULOSASI — operator suhbatni ochmasdan nima gapligini bilishi uchun.
                Lead hali yaratilmagan suhbatda bo'sh satr keladi → qator UMUMAN chizilmaydi
                (bo'sh joy qoldirmaydi). Bir qator, to'lig'i tooltipda. */}
            {conv.ai_summary?.trim() && (
              <div
                className="flex items-center gap-2 border-b px-5 py-2"
                style={{ borderColor: "var(--line2)", background: "var(--surface-2)" }}
                title={conv.ai_summary}
              >
                <Sparkles size={13} strokeWidth={2.2} className="shrink-0" style={{ color: "var(--primary)" }} />
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold" style={{ color: "var(--text-2)" }}>
                  {conv.ai_summary}
                </span>
              </div>
            )}

            {/* xabarlar */}
            <div ref={listRef} data-lenis-prevent className="flex flex-1 flex-col overflow-y-auto overscroll-contain px-5 pb-4 pt-2">
              {conv.messages.map((m, i) => {
                const prev = conv.messages[i - 1];
                const next = conv.messages[i + 1];
                const lastReal = i === conv.messages.length - 1;
                return (
                  <MessageRow
                    key={m.id}
                    m={m}
                    custName={custName(conv)}
                    groupWithPrev={!!prev && prev.sender === m.sender}
                    groupWithNext={(!!next && next.sender === m.sender) || (lastReal && convPending.length > 0 && m.sender === "operator")}
                    onCopy={copyText}
                    onOpenImage={setLightbox}
                    onMediaReady={keepPinned}
                  />
                );
              })}
              {/* optimistik xabarlar — yuborilmoqda / yuborilmadi */}
              {convPending.map((p, i) => (
                <MessageRow
                  key={`p${p.key}`}
                  m={{
                    id: -p.key,
                    created_at: p.created_at,
                    updated_at: p.created_at,
                    sender: "operator",
                    text: p.text,
                    instagram_message_id: "",
                    metadata: {},
                    conversation: p.conv,
                    ui_status: p.status,
                    ui_error: p.error,
                  }}
                  custName={custName(conv)}
                  groupWithPrev={i > 0}
                  groupWithNext={i < convPending.length - 1}
                  onCopy={copyText}
                  onOpenImage={setLightbox}
                  onMediaReady={keepPinned}
                  onRetry={p.status === "failed" ? () => deliver(p.key, p.conv, p.text) : undefined}
                  onEditFailed={
                    p.status === "failed"
                      ? () => { setText((cur) => (cur ? `${cur} ${p.text}` : p.text)); setPending((ps) => ps.filter((x) => x.key !== p.key)); }
                      : undefined
                  }
                />
              ))}
              <div ref={bottomRef} />
            </div>

            {/* sticky kiritish paneli */}
            <div className="border-t px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => { if (e.target.files?.length) showToast(`"${e.target.files[0].name}" — ilova yuborish backend ulanganda ishlaydi`); e.target.value = ""; }} />
                <button
                  onClick={() => fileRef.current?.click()}
                  title="Fayl biriktirish"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 hover:bg-[var(--hover)]"
                  style={{ borderColor: "var(--border)", color: "var(--text-2)", background: "var(--surface-solid)" }}
                >
                  <Icon name="attachment" size={16} />
                </button>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                  placeholder="Operator javobi…"
                  className="h-10 flex-1 rounded-full border px-4 text-[13px] outline-none transition-shadow duration-200 placeholder:text-[color:var(--muted)] focus:shadow-[0_0_0_3px_var(--focus)]"
                  style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface-solid)" }}
                />
                <button
                  onClick={send}
                  disabled={sending || !text.trim()}
                  aria-label="Yuborish"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-xs transition-all duration-200 hover:-translate-y-px hover:shadow-sm disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none"
                  style={{ background: "var(--primary)" }}
                >
                  <Icon name="send" size={16} />
                </button>
              </div>
            </div>
          </>
        ) : convErr ? (
          /* ⚠️ DEEP-LINK XATOSI — Telegramdagi «CRM chatni ochish» eskirgan/o'chirilgan
             suhbatga olib kelishi mumkin. Ilgari bu holat «Suhbat yuklanmoqda…» bo'lib
             abadiy osilib turardi: operator nima bo'lganini bilmasdi. */
          <div className="m-auto flex max-w-[340px] flex-col items-center gap-3 px-5 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>
              <AlertCircle size={20} strokeWidth={2} />
            </span>
            <div>
              <p className="text-[14px] font-bold" style={{ color: "var(--text)" }}>Suhbat ochilmadi · #{convErr.id}</p>
              <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--text-2)" }}>{convErr.msg}</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => loadConv(convErr.id, true)}
                className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-bold transition-colors duration-150 hover:bg-[var(--hover)]"
                style={{ borderColor: "var(--border)", color: "var(--text-2)" }}
              >
                <RotateCw size={12} strokeWidth={2.2} /> Qayta urinish
              </button>
              {convs.length > 0 && (
                <button
                  onClick={() => { setConvErr(null); setDeepMissing(false); setSelId(convs[0]?.id ?? null); setMobileConv(false); }}
                  className="rounded-full px-3 py-1.5 text-[12.5px] font-bold text-white transition-opacity duration-150 hover:opacity-90"
                  style={{ background: "var(--primary)" }}
                >
                  Suhbatlar ro&apos;yxati
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="m-auto max-w-[290px] text-center text-[14px] leading-relaxed" style={{ color: "var(--muted)" }}>
            {convs.length ? "Suhbat yuklanmoqda…" : "Hozircha suhbat yo'q — Instagram webhook ulanganda DM'lar shu yerda ko'rinadi."}
          </p>
        )}
      </div>
      {pauseOpen && conv && (
        <PauseAIModal
          conv={conv}
          onClose={() => setPauseOpen(false)}
          onPaused={(c) => { setPauseOpen(false); setConv(c); loadList(); }}
        />
      )}
      {/* rasm ko'rinishi — frosted lightbox (Esc/overlay yopadi) */}
      {lightbox && <MediaLightbox url={lightbox} onClose={() => setLightbox(null)} />}
      {confirmDel && conv && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-5" style={{ background: "rgba(24,17,12,.4)", backdropFilter: "blur(8px)" }} onClick={() => setConfirmDel(false)} role="dialog" aria-modal="true" data-lenis-prevent>
          <div className="glass-modal w-[min(380px,100%)] p-6 animate-[rowIn_0.22s_var(--ease)_both]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[16px] font-bold">Suhbatni o&apos;chirish</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--text-2)]">
              «{custName(conv)}» bilan suhbat butunlay o&apos;chirilsinmi? Bu amalni bekor qilib bo&apos;lmaydi.
            </p>
            <div className="mt-5 flex gap-2.5">
              <button onClick={() => setConfirmDel(false)} className="btn-ghost flex-1">Bekor qilish</button>
              <button onClick={doDelete} disabled={deleting} className={`btn-danger flex-1 ${deleting ? "btn-loading" : ""}`}>O&apos;chirish</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
