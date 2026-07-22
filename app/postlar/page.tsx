"use client";
import { Clapperboard, Flower2, Megaphone, MessageCircle, Pencil, Plus, Sprout, Trash2 } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import PostModal from "@/components/PostModal";
import SearchInput from "@/components/SearchInput";
import FilterSelect from "@/components/FilterSelect";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { usePerm, useStore } from "@/lib/store";
import useAutoRefresh from "@/lib/useAutoRefresh";
import { fmt } from "@/lib/format";
import type { Branch, SocialPost } from "@/lib/types";

/** Postlar — Instagram uslubida: tepada STORIES doiralari (gradient halqa),
    pastda post/reel/reklama to'ri — rasm, hover'da statistika. */

const TYPE_LABEL: Record<string, string> = { post: "POST", reel: "REEL", story: "STORY", ad: "REKLAMA" };

/** Instagram'dagi kabi gradient halqali story doirasi; hover'da tahrirlash/o'chirish. */
function StoryCircle({ p, onOpen, onEdit, onDelete }: { p: SocialPost; onOpen: () => void; onEdit?: () => void; onDelete?: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="group flex w-[86px] shrink-0 flex-col items-center gap-1.5" title={p.title_uz || p.title_ru}>
      <span
        className="relative block rounded-full p-[2.5px] transition-transform duration-200 group-hover:scale-105"
        style={{
          background: p.is_active
            ? "conic-gradient(from 210deg, var(--accL), var(--primary), var(--primary-strong), var(--accL))"
            : "var(--border)",
        }}
      >
        <span className="block rounded-full p-[2.5px]" style={{ background: "var(--surface-solid)" }}>
          <span className="flex h-[64px] w-[64px] items-center justify-center overflow-hidden rounded-full bg-bg2">
            {p.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image_url} alt={p.title_uz} className="h-full w-full object-cover" />
            ) : (
              <Flower2 size={22} strokeWidth={1.5} style={{ color: "var(--muted)" }} />
            )}
          </span>
        </span>
        {/* hover: doira ustida tahrirlash/o'chirish */}
        {(onEdit || onDelete) && (
          <span className="absolute inset-[2.5px] flex items-center justify-center gap-1.5 rounded-full bg-black/45 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
            {onEdit && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onEdit(); } }}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-[#221833] shadow"
                title="Tahrirlash"
                aria-label="Story'ni tahrirlash"
              >
                <Pencil size={12.5} strokeWidth={1.75} />
              </span>
            )}
            {onDelete && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onDelete(); } }}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/95 shadow"
                style={{ color: "var(--danger)" }}
                title="O'chirish"
                aria-label="Story'ni o'chirish"
              >
                <Trash2 size={12.5} strokeWidth={1.75} />
              </span>
            )}
          </span>
        )}
      </span>
      <span className="w-full truncate text-center text-[11px] font-semibold" style={{ color: "var(--text-2)" }}>
        {p.title_uz || p.title_ru || "Story"}
      </span>
      <span className="-mt-1 text-[10px] font-medium" style={{ color: "var(--muted)" }}>
        {p.reply_count} reply · {p.lead_count} lead
      </span>
    </button>
  );
}

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
  // server filtrlari
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [postType, setPostType] = useState("");
  const [target, setTarget] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoadErr("");
    try {
      const [ps, bs] = await Promise.all([
        api.socialPosts({
          search: q || undefined,
          post_type: postType || undefined,
          is_targeted: target === "" ? undefined : target === "1",
        }),
        api.branches(),
      ]);
      setPosts(ps);
      setBranches(bs);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  }, [q, postType, target]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load); // jimgina davriy yangilash — real vaqt hissi

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
        <p className="note-chip text-[14px]" style={{ color: "var(--muted)" }}>
          AI post reply&apos;larga shu bazadan javob beradi — har bir post havolasi bilan gul tarkibi va narxi kiritiladi.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} ariaLabel="Post qidirish" />
          <FilterSelect
            value={postType}
            onChange={setPostType}
            label="Turi"
            options={[
              { value: "", label: "Barcha turlar" },
              { value: "post", label: "Post" },
              { value: "reel", label: "Reel" },
              { value: "story", label: "Story" },
              { value: "ad", label: "Reklama" },
            ]}
          />
          <FilterSelect
            value={target}
            onChange={setTarget}
            label="Target"
            options={[
              { value: "", label: "Hammasi" },
              { value: "1", label: "Target yoqilgan" },
              { value: "0", label: "Oddiy post" },
            ]}
          />
        </div>
        {control && (
          <button onClick={() => setModal({ open: true, post: null })} className="btn-primary !flex-none px-5">
            <Plus size={18} strokeWidth={1.75} /> Post qo&apos;shish
          </button>
        )}
      </div>

      {/* ===== STORIES — Instagram uslubidagi doiralar ===== */}
      {(() => {
        const stories = posts.filter((p) => p.post_type === "story");
        if (!stories.length) return null;
        return (
          <section className="glass mb-4 !rounded-[20px] px-4 py-3.5">
            <div className="mb-2.5 text-[12px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Stories</div>
            <div data-lenis-prevent className="flex gap-3 overflow-x-auto overscroll-x-contain pb-1">
              {stories.map((p) => (
                <StoryCircle
                  key={p.id}
                  p={p}
                  onOpen={() => (control ? setModal({ open: true, post: p }) : undefined)}
                  onEdit={control ? () => setModal({ open: true, post: p }) : undefined}
                  onDelete={control ? () => setConfirmDel(p) : undefined}
                />
              ))}
            </div>
          </section>
        );
      })()}

      {/* ===== POST / REEL / REKLAMA — rasmli to'r ===== */}
      {(() => {
        const feed = posts.filter((p) => p.post_type !== "story");
        return (
          <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(225px,1fr))" }}>
            {feed.map((p) => (
              <article
                key={p.id}
                onClick={() => control && setModal({ open: true, post: p })}
                role={control ? "button" : undefined}
                tabIndex={control ? 0 : undefined}
                onKeyDown={(e) => control && e.key === "Enter" && setModal({ open: true, post: p })}
                className="group relative aspect-square cursor-pointer overflow-hidden rounded-[18px] border"
                style={{ borderColor: "var(--border)", background: "var(--bg2)", opacity: p.is_active ? 1 : 0.55 }}
                title={p.title_uz || p.title_ru}
              >
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt={p.title_uz} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Flower2 size={40} strokeWidth={1.25} style={{ color: "var(--muted)" }} />
                  </div>
                )}

                {/* tur belgisi — Instagram'dagi kabi o'ng yuqorida */}
                <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[10.5px] font-bold text-white backdrop-blur-sm">
                  {p.post_type === "reel" && <Clapperboard size={12} strokeWidth={2} />}
                  {p.post_type === "ad" && <Megaphone size={12} strokeWidth={2} />}
                  {TYPE_LABEL[p.post_type] ?? p.post_type.toUpperCase()}
                </span>
                {p.is_targeted && (
                  <span className="absolute left-2.5 top-2.5 rounded-full px-2 py-1 text-[10px] font-bold text-white" style={{ background: "var(--primary)" }}>
                    TARGET
                  </span>
                )}
                {!p.is_active && (
                  <span className="absolute left-2.5 top-9 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white">NOFAOL</span>
                )}

                {/* pastki gradient: nomi + narxi doim ko'rinadi */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent px-3 pb-2.5 pt-8">
                  <div className="truncate text-[13px] font-bold text-white">{p.title_uz || p.title_ru}</div>
                  <div className="text-[11.5px] font-semibold text-white/80">
                    {p.price ? fmt(p.price) : "narx kiritilmagan"}
                    {(p.catalog_items?.length ?? 0) > 0 && <span title="Tayyor katalog guli biriktirilgan"> · 🌸 katalog</span>}
                  </div>
                </div>

                {/* hover: Instagram uslubidagi statistika markazda */}
                <div className="absolute inset-0 flex items-center justify-center gap-5 bg-black/45 opacity-0 backdrop-blur-[2px] transition-opacity duration-200 group-hover:opacity-100">
                  <span className="flex items-center gap-1.5 text-[14px] font-extrabold text-white">
                    <MessageCircle size={17} strokeWidth={2.25} /> {p.reply_count}
                  </span>
                  <span className="flex items-center gap-1.5 text-[14px] font-extrabold text-white">
                    <Sprout size={17} strokeWidth={2.25} /> {p.lead_count}
                  </span>
                </div>

                {/* boshqaruv — hover'da yuqori chapda */}
                {control && (
                  <div className="absolute bottom-2.5 right-2.5 flex gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <button
                      onClick={(e) => { e.stopPropagation(); setModal({ open: true, post: p }); }}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-[#221833] shadow"
                      title="Tahrirlash"
                      aria-label="Tahrirlash"
                    >
                      <Pencil size={14} strokeWidth={1.75} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDel(p); }}
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow"
                      style={{ color: "var(--danger)" }}
                      title="O'chirish"
                      aria-label="O'chirish"
                    >
                      <Trash2 size={14} strokeWidth={1.75} />
                    </button>
                  </div>
                )}
              </article>
            ))}
            {posts.length === 0 && (
              <div className="col-span-full">
                <EmptyState title="Post kiritilmagan" sub="Instagram postlarini ulang — AI reply'larga shu bazadan javob beradi." />
              </div>
            )}
          </div>
        );
      })()}

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
