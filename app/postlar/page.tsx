"use client";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import PostModal from "@/components/PostModal";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { usePerm, useStore } from "@/lib/store";
import { fmt } from "@/lib/format";
import type { Branch, SocialPost } from "@/lib/types";

const TYPE_LABEL: Record<string, string> = { post: "POST", reel: "REEL", story: "STORY", ad: "REKLAMA" };

export default function PostlarPage() {
  const showToast = useStore((s) => s.showToast);
  const { canControl } = usePerm();
  const control = canControl("social_posts");
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [modal, setModal] = useState<{ open: boolean; post: SocialPost | null }>({ open: false, post: null });
  const [confirmDel, setConfirmDel] = useState<SocialPost | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoadErr("");
    try {
      const [ps, bs] = await Promise.all([api.socialPosts(), api.branches()]);
      setPosts(ps);
      setBranches(bs);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onSaved = (p: SocialPost) => {
    setPosts((ps) => {
      const i = ps.findIndex((x) => x.id === p.id);
      if (i >= 0) return ps.map((x) => (x.id === p.id ? p : x));
      return [p, ...ps];
    });
    setModal({ open: false, post: null });
  };

  const doDelete = async () => {
    if (!confirmDel) return;
    setDeleting(true);
    const victim = confirmDel;
    try {
      await api.deleteSocialPost(victim.id);
      setPosts((ps) => ps.filter((x) => x.id !== victim.id));
      setConfirmDel(null);
      showToast("✓ Post o'chirildi");
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "O'chirib bo'lmadi");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <FlowerLoader />;

  if (loadErr)
    return (
      <div className="mt-14 flex flex-col items-center gap-3">
        <p className="text-[14px] font-semibold" style={{ color: "var(--danger-ink)" }}>{loadErr}</p>
        <button onClick={() => { setLoading(true); load(); }} className="btn-secondary !flex-none px-6">Qayta urinish</button>
      </div>
    );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px]" style={{ color: "var(--muted)" }}>
          AI post reply&apos;larga shu bazadan javob beradi — har bir post havolasi bilan gul tarkibi va narxi kiritiladi.
        </p>
        {control && (
          <button onClick={() => setModal({ open: true, post: null })} className="btn-primary !flex-none px-5">
            + Post qo&apos;shish
          </button>
        )}
      </div>

      <div className="flex flex-col gap-3.5">
        {posts.map((p) => (
          <article key={p.id} className="glass card-hover flex flex-wrap items-center gap-4 !rounded-[18px] p-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-[14px] border bg-bg2" style={{ borderColor: "var(--border)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {p.image_url && <img src={p.image_url} alt={p.title_uz} className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-[220px] flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold">{p.title_uz || p.title_ru}</h3>
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${p.is_targeted ? "text-white" : ""}`} style={p.is_targeted ? { background: "var(--side)", borderColor: "var(--side)" } : { borderColor: "var(--border)", color: "var(--muted)", background: "var(--surface-2)" }}>
                  {p.is_targeted ? "TARGET YOQILGAN" : TYPE_LABEL[p.post_type] ?? p.post_type.toUpperCase()}
                </span>
                {!p.is_active && <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: "var(--danger-soft)", color: "var(--danger-ink)" }}>NOFAOL</span>}
              </div>
              <p className="mt-1 text-[13px]" style={{ color: "var(--muted)" }}>{p.description_uz || p.description_ru || "Tavsif kiritilmagan"}</p>
              <p className="mt-0.5 text-xs" style={{ color: "var(--muted)" }}>
                {p.flower_count > 0 && <>Gul soni: {p.flower_count} · </>}
                {p.permalink ? (
                  <a href={p.permalink.startsWith("http") ? p.permalink : `https://${p.permalink}`} target="_blank" rel="noreferrer">{p.permalink.replace(/^https?:\/\//, "")}</a>
                ) : (
                  <>media: {p.media_id}</>
                )}
              </p>
            </div>
            <div className="flex gap-6 text-center">
              <div>
                <div className="text-[16px] font-extrabold">{p.price ? fmt(p.price).replace(" so'm", "") : "—"}</div>
                <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>narx</div>
              </div>
              <div>
                <div className="text-[16px] font-extrabold">{p.reply_count}</div>
                <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>reply</div>
              </div>
              <div>
                <div className="text-[16px] font-extrabold" style={{ color: "var(--primary)" }}>{p.lead_count}</div>
                <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>lead</div>
              </div>
            </div>
            {control && (
              <div className="flex flex-col gap-1.5">
                <button onClick={() => setModal({ open: true, post: p })} className="rounded-[9px] border px-3 py-1.5 text-[12px] font-bold transition-colors duration-200 hover:bg-[var(--hover)]" style={{ borderColor: "var(--border)", color: "var(--text-2)" }}>
                  Tahrirlash
                </button>
                <button onClick={() => setConfirmDel(p)} className="rounded-[9px] border px-3 py-1.5 text-[12px] font-bold transition-colors duration-200 hover:bg-[var(--danger-soft)]" style={{ borderColor: "var(--border)", color: "var(--danger-ink)" }}>
                  O&apos;chirish
                </button>
              </div>
            )}
          </article>
        ))}
        {posts.length === 0 && <EmptyState title="Post kiritilmagan" sub="Instagram postlarini ulang — AI reply'larga shu bazadan javob beradi." />}
      </div>

      {modal.open && (
        <PostModal post={modal.post} branches={branches} onClose={() => setModal({ open: false, post: null })} onSaved={onSaved} />
      )}

      {confirmDel && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-5" style={{ background: "rgba(24,17,12,.4)", backdropFilter: "blur(8px)" }} onClick={() => setConfirmDel(null)} role="dialog" aria-modal="true" data-lenis-prevent>
          <div className="glass-modal w-[min(380px,100%)] p-6 animate-[rowIn_0.22s_var(--ease)_both]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[16px] font-bold">Postni o&apos;chirish</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--text-2)]">
              «{confirmDel.title_uz || confirmDel.title_ru}» o&apos;chirilsinmi? Bu amalni bekor qilib bo&apos;lmaydi.
            </p>
            <div className="mt-5 flex gap-2.5">
              <button onClick={() => setConfirmDel(null)} className="btn-ghost flex-1">Bekor qilish</button>
              <button onClick={doDelete} disabled={deleting} className={`btn-danger flex-1 ${deleting ? "btn-loading" : ""}`}>O&apos;chirish</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
