"use client";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import { fmtTime, initials } from "@/lib/format";
import { CONV_STATUS_LABEL } from "@/components/badges";
import { Icon } from "@/components/icons";
import type { Conversation, Message } from "@/lib/types";

/**
 * Zamonaviy AI-chat maketi:
 *   • mijoz xabarlari — CHAPDA (neytral yuzada)
 *   • AI javoblari — O'NGDA (brend rangida)
 *   • operator javoblari — O'NGDA (to'q yuzada)
 * Guruhlash, hover amallar (nusxa/reaksiya/vaqt), typing, sticky kiritish.
 */

const REACTIONS = ["❤️", "👍", "🌸", "😄"];

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
  reaction,
  onReact,
  onCopy,
}: {
  m: Message;
  custName: string;
  groupWithPrev: boolean;
  groupWithNext: boolean;
  reaction?: string;
  onReact: (id: number, emoji: string) => void;
  onCopy: (text: string) => void;
}) {
  const [reactOpen, setReactOpen] = useState(false);
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
          <div className="relative">
            <button
              onClick={() => setReactOpen((v) => !v)}
              title="Reaksiya"
              className="flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-200 hover:bg-[var(--hover)]"
              style={{ color: "var(--text-2)" }}
            >
              <Icon name="smile" size={13} />
            </button>
            {reactOpen && (
              <div className="absolute -top-9 left-1/2 z-20 flex -translate-x-1/2 gap-0.5 rounded-full border px-1.5 py-1 shadow-md animate-[rowIn_0.18s_var(--ease)_both]" style={{ background: "var(--surface-solid)", borderColor: "var(--border)" }}>
                {REACTIONS.map((e) => (
                  <button key={e} onClick={() => { onReact(m.id, e); setReactOpen(false); }} className="rounded-full px-1 text-[14px] transition-transform duration-150 hover:scale-125">
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>
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

        {/* reaksiya chipi */}
        {reaction && (
          <span
            className={clsx("-mt-2 rounded-full border px-1.5 py-px text-[12px] shadow-xs", isLeft ? "ml-2 self-start" : "mr-2 self-end")}
            style={{ background: "var(--surface-solid)", borderColor: "var(--border)" }}
          >
            {reaction}
          </span>
        )}

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
  const [search, setSearch] = useState("");
  const [text, setText] = useState("");
  const [asCustomer, setAsCustomer] = useState(false);
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [reactions, setReactions] = useState<Record<number, string>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadList = useCallback(async () => {
    try {
      const cs = await api.conversations({ ordering: "-last_message_at" });
      setConvs(cs);
      setSelId((id) => id ?? cs[0]?.id ?? null);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Suhbatlarni yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadConv = useCallback(async (id: number) => {
    try {
      setConv(await api.conversation(id));
    } catch {
      /* ro'yxat yangilanganda qayta urinadi */
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  useEffect(() => {
    if (selId == null) return;
    setConv(null);
    loadConv(selId);
    const t = setInterval(() => loadConv(selId), 7000);
    return () => clearInterval(t);
  }, [selId, loadConv]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conv?.messages.length, typing]);

  const send = async () => {
    if (!text.trim() || selId == null || sending) return;
    const t = text.trim();
    setSending(true);
    try {
      if (asCustomer) {
        // demo rejimi: mijoz nomidan yozib, AI javobini jonli ko'ramiz
        setTyping(true);
        await api.simulateMessage(selId, t);
        setTyping(false);
      } else {
        await api.sendMessage(selId, t);
      }
      setText("");
      await loadConv(selId);
      loadList();
    } catch (e) {
      setTyping(false);
      showToast(e instanceof ApiError ? e.message : "Yuborib bo'lmadi");
    } finally {
      setSending(false);
    }
  };

  const doHandoff = async () => {
    if (selId == null) return;
    try {
      setConv(await api.handoff(selId));
      showToast("Suhbat operatorga o'tkazildi");
      loadList();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "O'tkazib bo'lmadi");
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
  const fConvs = q
    ? convs.filter((c) =>
        (c.customer_detail?.name ?? "").toLowerCase().includes(q) ||
        (c.customer_detail?.instagram_username ?? "").toLowerCase().includes(q))
    : convs;

  const custName = (c: Conversation) => c.customer_detail?.name || `@${c.customer_detail?.instagram_username ?? "—"}`;

  if (loading) return <FlowerLoader />;

  return (
    <div className="flex h-[calc(100dvh-210px)] min-h-[460px] flex-col items-stretch gap-4 overflow-hidden md:flex-row">
      {/* suhbatlar ro'yxati */}
      <div className="flex max-h-[30vh] min-h-0 min-w-0 flex-col gap-3 md:max-h-none md:h-full md:min-w-[230px] md:max-w-[340px] md:flex-1 md:basis-60">
        <div className="glass flex items-center gap-2 !rounded-[14px] px-3.5 py-1 text-[13px]" style={{ color: "var(--muted)" }}>
          <Icon name="search" size={15} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Qidirish — ism yoki @username"
            className="w-full bg-transparent py-1.5 text-[13px] outline-none placeholder:text-[color:var(--muted)]"
            style={{ color: "var(--text)" }}
          />
        </div>
        <div data-lenis-prevent className="glass flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto overscroll-contain !rounded-[16px] p-2">
          {fConvs.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelId(c.id)}
              className={clsx(
                "flex items-center gap-2.5 rounded-[12px] p-2.5 text-left transition-colors duration-200",
                selId === c.id ? "bg-[var(--primary-soft)]" : "hover:bg-[var(--hover)]"
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-sm font-bold" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-2)" }}>
                {initials(custName(c))}
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
      <div className="glass flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden !rounded-[18px] md:h-full md:min-w-[300px] md:flex-[2] md:basis-80">
        {conv ? (
          <>
            {/* sarlavha */}
            <div className="flex items-center gap-3 border-b px-5 py-3.5" style={{ borderColor: "var(--border)" }}>
              <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full border font-bold" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-2)" }}>
                {initials(custName(conv))}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-bold" style={{ color: "var(--text)" }}>
                  {custName(conv)}{" "}
                  <span className="text-[13px] font-medium" style={{ color: "var(--muted)" }}>@{conv.customer_detail?.instagram_username}</span>
                </div>
                {conv.ai_summary && <div className="truncate text-xs font-semibold" style={{ color: "var(--text-2)" }}>{conv.ai_summary}</div>}
                <div className="text-xs" style={{ color: "var(--muted)" }}>Instagram DM · {conv.customer_detail?.masked_phone || "tel yo'q"}</div>
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
              {conv.status === "ai" && (
                <button onClick={doHandoff} className="rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors duration-200 hover:bg-[var(--warning-soft)]" style={{ borderColor: "var(--border)", color: "var(--text-2)" }}>
                  Operatorga olish
                </button>
              )}
              {conv.status === "operator" && (
                <button onClick={doResumeAi} className="rounded-full border px-3 py-1.5 text-[12px] font-bold transition-colors duration-200 hover:bg-[var(--success-soft)]" style={{ borderColor: "var(--border)", color: "var(--text-2)" }}>
                  AI&apos;ga qaytarish
                </button>
              )}
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
                    reaction={reactions[m.id]}
                    onReact={(id, e) => setReactions((r) => ({ ...r, [id]: r[id] === e ? "" : e }))}
                    onCopy={copyText}
                  />
                );
              })}
              {typing && (
                <div className="mt-4 flex items-end justify-end gap-2">
                  <div className="flex items-center gap-1.5 rounded-[16px] rounded-br-[6px] px-4 py-3.5" style={{ background: "var(--primary)" }}>
                    {[0, 0.2, 0.4].map((d) => <span key={d} className="h-1.5 w-1.5 animate-blink rounded-full bg-white" style={{ animationDelay: `${d}s` }} />)}
                  </div>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-extrabold text-white" style={{ background: "var(--primary)" }}>AI</span>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* sticky kiritish paneli */}
            <div className="border-t px-4 py-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div className="mb-2 flex items-center gap-2">
                <button onClick={() => setAsCustomer(false)} className={clsx("rounded-full px-3 py-1 text-[11px] font-bold transition-colors duration-200", !asCustomer ? "text-white" : "hover:bg-[var(--hover)]")} style={!asCustomer ? { background: "var(--primary)" } : { color: "var(--muted)" }}>
                  Operator sifatida
                </button>
                <button onClick={() => setAsCustomer(true)} className={clsx("rounded-full px-3 py-1 text-[11px] font-bold transition-colors duration-200", asCustomer ? "text-white" : "hover:bg-[var(--hover)]")} style={asCustomer ? { background: "var(--side)" } : { color: "var(--muted)" }}>
                  ▶ Demo: mijoz sifatida (AI javob beradi)
                </button>
              </div>
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
                  placeholder={asCustomer ? "Mijoz xabari — AI jonli javob beradi…" : "Operator javobi…"}
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
    </div>
  );
}
