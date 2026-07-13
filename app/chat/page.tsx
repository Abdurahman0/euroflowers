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

function Bubble({ m }: { m: Message }) {
  if (m.sender === "customer")
    return (
      <div className="flex justify-end">
        <div className="glass max-w-[75%] whitespace-pre-line !rounded-[18px] !rounded-br-[5px] px-4 py-2.5 text-[13.5px] leading-relaxed">{m.text}</div>
      </div>
    );
  const tag = m.sender === "ai" ? "AI" : m.sender === "operator" ? "OP" : "SYS";
  return (
    <div className="flex items-end justify-start gap-2">
      <div className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full text-[9.5px] font-extrabold text-white" style={{ background: m.sender === "operator" ? "var(--side)" : "linear-gradient(135deg,var(--acc),var(--accL))" }}>{tag}</div>
      <div className="max-w-[75%] whitespace-pre-line rounded-[18px] rounded-bl-[5px] px-4 py-2.5 text-[13.5px] leading-relaxed text-white" style={{ background: m.sender === "operator" ? "var(--side)" : "linear-gradient(135deg,var(--acc),var(--accL))" }}>{m.text}</div>
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
  const bottomRef = useRef<HTMLDivElement>(null);

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

  const q = search.trim().toLowerCase();
  const fConvs = q
    ? convs.filter((c) =>
        (c.customer_detail?.name ?? "").toLowerCase().includes(q) ||
        (c.customer_detail?.instagram_username ?? "").toLowerCase().includes(q))
    : convs;

  const custName = (c: Conversation) => c.customer_detail?.name || `@${c.customer_detail?.instagram_username ?? "—"}`;

  if (loading) return <FlowerLoader />;

  return (
    <div className="flex h-[80vh] items-stretch gap-4 overflow-hidden">
      {/* chap panel */}
      <div className="flex h-full min-h-0 min-w-[230px] max-w-[340px] flex-1 basis-60 flex-col gap-3">
        <div className="glass flex items-center gap-2 !rounded-[15px] px-3.5 py-1 text-[13px]">
          <Icon name="search" size={15} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Qidirish — ism yoki @username"
            className="w-full bg-transparent py-1.5 text-[13px] outline-none placeholder:text-[color:var(--mut)]"
            style={{ color: "var(--ink)" }}
          />
        </div>
        <div className="glass flex min-h-0 flex-1 flex-col gap-1 overflow-auto !rounded-[18px] p-2">
          {fConvs.map((c) => (
            <button key={c.id} onClick={() => setSelId(c.id)} className={clsx("flex items-center gap-2.5 rounded-xl p-2.5 text-left", selId === c.id && "bg-tint")}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-tint text-sm font-bold text-tintink" style={{ borderColor: "var(--line2)" }}>{initials(custName(c))}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[13.5px] font-bold">{custName(c)}</span>
                  {c.status === "operator" && <span className="rounded-full bg-peach px-1.5 text-[9.5px] font-bold text-peachink">OPERATOR</span>}
                  {c.status === "closed" && <span className="rounded-full bg-bg2 px-1.5 text-[9.5px] font-bold" style={{ color: "var(--mut)" }}>YOPIQ</span>}
                </div>
                <div className="truncate text-xs" style={{ color: "var(--mut)" }}>{c.last_message?.text ?? "…"}</div>
              </div>
              <div className="text-right">
                <div className="text-[11px]" style={{ color: "var(--mut)" }}>{fmtTime(c.last_message_at)}</div>
              </div>
            </button>
          ))}
          {fConvs.length === 0 && <EmptyState title="Suhbat topilmadi" sub="Qidiruvni o&apos;zgartirib ko&apos;ring." />}
        </div>
      </div>

      {/* suhbat oynasi */}
      <div className="glass flex h-full min-h-0 min-w-[300px] flex-[2] basis-80 flex-col overflow-hidden !rounded-[22px]">
        {conv ? (
          <>
            <div className="flex items-center gap-3 border-b px-5 py-3.5" style={{ borderColor: "var(--line2)" }}>
              <div className="flex h-[42px] w-[42px] items-center justify-center rounded-full border bg-tint font-bold text-tintink" style={{ borderColor: "var(--line2)" }}>{initials(custName(conv))}</div>
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-bold">
                  {custName(conv)}{" "}
                  <span className="text-[12.5px] font-medium" style={{ color: "var(--mut)" }}>@{conv.customer_detail?.instagram_username}</span>
                </div>
                {conv.ai_summary && <div className="truncate text-xs font-bold" style={{ color: "var(--acc)" }}>{conv.ai_summary}</div>}
                <div className="text-xs" style={{ color: "var(--mut)" }}>Instagram DM · {conv.customer_detail?.masked_phone || "tel yo'q"}</div>
              </div>
              <span className={clsx("flex items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-bold", conv.status === "ai" ? "bg-mint text-mintink" : conv.status === "operator" ? "bg-peach text-peachink" : "bg-bg2")}>
                <span className={clsx("h-[7px] w-[7px] rounded-full", conv.status === "ai" ? "bg-mintink" : conv.status === "operator" ? "bg-peachink" : "")} style={conv.status === "closed" ? { background: "var(--mut)" } : undefined} />
                {CONV_STATUS_LABEL[conv.status]}
              </span>
              {conv.status === "ai" && (
                <button onClick={doHandoff} className="rounded-full border-[1.5px] px-3 py-1.5 text-[11.5px] font-bold hover:bg-peach" style={{ borderColor: "var(--line)" }}>
                  Operatorga olish
                </button>
              )}
              {conv.status === "operator" && (
                <button onClick={doResumeAi} className="rounded-full border-[1.5px] px-3 py-1.5 text-[11.5px] font-bold hover:bg-mint" style={{ borderColor: "var(--line)" }}>
                  AI&apos;ga qaytarish
                </button>
              )}
            </div>

            <div className="flex flex-1 flex-col gap-3 overflow-auto p-5">
              {conv.messages.map((m) => <Bubble key={m.id} m={m} />)}
              {typing && (
                <div className="flex">
                  <div className="flex items-center gap-1.5 rounded-[18px] rounded-bl-[5px] px-4 py-3.5" style={{ background: "linear-gradient(135deg,var(--acc),var(--accL))" }}>
                    {[0, 0.2, 0.4].map((d) => <span key={d} className="h-1.5 w-1.5 animate-blink rounded-full bg-white" style={{ animationDelay: `${d}s` }} />)}
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t px-4 py-3" style={{ borderColor: "var(--line2)" }}>
              <div className="mb-2 flex items-center gap-2">
                <button onClick={() => setAsCustomer(false)} className={clsx("rounded-full px-3 py-1 text-[11px] font-bold", !asCustomer ? "text-white" : "")} style={!asCustomer ? { background: "var(--acc)" } : { color: "var(--mut)" }}>
                  Operator sifatida
                </button>
                <button onClick={() => setAsCustomer(true)} className={clsx("rounded-full px-3 py-1 text-[11px] font-bold", asCustomer ? "text-white" : "")} style={asCustomer ? { background: "var(--side)" } : { color: "var(--mut)" }}>
                  ▶ Demo: mijoz sifatida (AI javob beradi)
                </button>
              </div>
              <div className="flex items-center gap-2.5">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                  placeholder={asCustomer ? "Mijoz xabari — AI jonli javob beradi…" : "Operator javobi…"}
                  className="flex-1 rounded-full border bg-bg2 px-4 py-2.5 text-[13px] outline-none placeholder:text-[color:var(--mut)]"
                  style={{ borderColor: "var(--line2)", color: "var(--ink)" }}
                />
                <button onClick={send} disabled={sending || !text.trim()} className="flex h-10 w-10 items-center justify-center rounded-full text-white disabled:opacity-50" style={{ background: "var(--acc)" }}>
                  <Icon name="send" size={16} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <p className="m-auto max-w-[290px] text-center text-[13.5px] leading-relaxed" style={{ color: "var(--mut)" }}>
            {convs.length ? "Suhbat yuklanmoqda…" : "Hozircha suhbat yo'q — Instagram webhook ulanganda DM'lar shu yerda ko'rinadi."}
          </p>
        )}
      </div>
    </div>
  );
}
