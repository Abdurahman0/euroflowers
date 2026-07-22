"use client";
import { ArrowLeft, MoonStar, Trash2 } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { InstagramIcon, TelegramIcon } from "@hugeicons/core-free-icons";
import SearchInput from "@/components/SearchInput";
import ClearFilters from "@/components/ClearFilters";
import FilterSelect from "@/components/FilterSelect";
import PauseAIModal from "@/components/PauseAIModal";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import useAutoRefresh from "@/lib/useAutoRefresh";
import { fmtTime, initials } from "@/lib/format";
import { CONV_STATUS_LABEL } from "@/components/badges";
import { Icon } from "@/components/icons";
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
}: {
  m: Message;
  custName: string;
  groupWithPrev: boolean;
  groupWithNext: boolean;
  onCopy: (text: string) => void;
}) {
  const side = sideOf(m);

  if (side === "center")
    return (
      <div className="flex justify-center">
        <span className="rounded-full border px-3 py-1 text-[11px] font-medium" style={{ borderColor: "var(--border)", color: "var(--muted)", background: "var(--surface)" }}>
          {m.text} · {fmtTime(m.created_at)}
        </span>
      </div>
    );

  const isLeft = side === "left";
  const bubbleStyle =
    m.sender === "customer"
      ? { background: "var(--surface-solid)", border: "1px solid var(--border)", color: "var(--text)" }
      : m.sender === "ai"
        ? { background: "var(--primary)", color: "#fff" }
        : { background: "var(--side)", color: "#F5F0E8" };

  const img = typeof m.metadata?.image_url === "string" ? (m.metadata.image_url as string) : null;
  const fileName = typeof m.metadata?.file_name === "string" ? (m.metadata.file_name as string) : null;

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
            title="Nusxalash"
            className="flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-200 hover:bg-[var(--hover)]"
            style={{ color: "var(--text-2)" }}
          >
            <Icon name="copy" size={13} />
          </button>
        </div>

        {/* pufak */}
        <div
          className={clsx(
            "whitespace-pre-line break-words px-4 py-2.5 text-[14px] leading-relaxed",
            isLeft
              ? clsx("rounded-[16px]", !groupWithNext && "rounded-bl-[6px]")
              : clsx("rounded-[16px]", !groupWithNext && "rounded-br-[6px]")
          )}
          style={bubbleStyle}
        >
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt="" className="mb-2 max-h-[260px] w-full rounded-[10px] object-cover" />
          )}
          {fileName && (
            <span className="mb-2 flex items-center gap-2.5 rounded-[10px] border border-[color:var(--border)] bg-[color:var(--hover)] px-3 py-2.5">
              <Icon name="attachment" size={15} />
              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{fileName}</span>
            </span>
          )}
          {m.text}
        </div>

        {/* guruh oxiridagi vaqt */}
        {!groupWithNext && (
          <span className={clsx("mt-1 text-[11px] font-medium", isLeft ? "ml-1" : "mr-1")} style={{ color: "var(--muted)" }}>
            {m.sender === "ai" ? "AI · " : m.sender === "operator" ? "Operator · " : ""}
            {fmtTime(m.created_at)}
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
  const [selId, setSelId] = useState<number | null>(null);
  const [conv, setConv] = useState<Conversation | null>(null);
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
  const bottomRef = useRef<HTMLDivElement>(null);
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
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Suhbatlarni yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, [showToast, statusF, chanF]);

  const loadConv = useCallback(async (id: number) => {
    try {
      setConv(await api.conversation(id));
    } catch {
      /* ro'yxat yangilanganda qayta urinadi */
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);
  // suhbatlar ro'yxati ham jimgina yangilanib turadi (ochiq suhbat quyida 7s'da)
  useAutoRefresh(loadList, 15000);

  useEffect(() => {
    if (selId == null) return;
    setConv(null);
    loadConv(selId);
    const t = setInterval(() => loadConv(selId), 7000);
    return () => clearInterval(t);
  }, [selId, loadConv]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conv?.messages.length]);

  const send = async () => {
    if (!text.trim() || selId == null || sending) return;
    const t = text.trim();
    setSending(true);
    try {
      await api.sendMessage(selId, t);
      setText("");
      await loadConv(selId);
      loadList();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Yuborib bo'lmadi");
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
                  {c.status === "closed" && <span className="rounded-full px-1.5 text-[11px] font-bold" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>YOPIQ</span>}
                </div>
                <div className="truncate text-xs" style={{ color: "var(--muted)" }}>{c.last_message?.text ?? "…"}</div>
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
                {conv.ai_summary && <div className="truncate text-xs font-semibold" style={{ color: "var(--text-2)" }}>{conv.ai_summary}</div>}
                <div className="truncate text-xs" style={{ color: "var(--muted)" }}>{channelOf(conv) === "telegram" ? "Telegram" : "Instagram DM"} · {conv.customer_detail?.phone || conv.customer_detail?.masked_phone || "tel yo'q"}</div>
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
              {conv.ai_paused_until != null || (conv.status !== "ai" && conv.ai_pause_reason) ? (
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

            {/* xabarlar */}
            <div data-lenis-prevent className="flex flex-1 flex-col overflow-y-auto overscroll-contain px-5 pb-4 pt-2">
              {conv.messages.map((m, i) => {
                const prev = conv.messages[i - 1];
                const next = conv.messages[i + 1];
                return (
                  <MessageRow
                    key={m.id}
                    m={m}
                    custName={custName(conv)}
                    groupWithPrev={!!prev && prev.sender === m.sender}
                    groupWithNext={!!next && next.sender === m.sender}
                    onCopy={copyText}
                  />
                );
              })}
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
