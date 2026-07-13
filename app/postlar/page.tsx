"use client";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import { fmt } from "@/lib/format";
import type { SocialPost } from "@/lib/types";

const TYPE_LABEL: Record<string, string> = { post: "POST", reel: "REEL", story: "STORY", ad: "REKLAMA" };

export default function PostlarPage() {
  const showToast = useStore((s) => s.showToast);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.socialPosts({ ordering: "-created_at" })
      .then(setPosts)
      .catch((e) => showToast(e instanceof Error ? e.message : "Yuklashda xatolik"))
      .finally(() => setLoading(false));
  }, [showToast]);

  if (loading) return <FlowerLoader />;

  return (
    <>
      <p className="mb-4 text-[13.5px]" style={{ color: "var(--mut)" }}>
        AI post reply&apos;larga shu bazadan javob beradi — har bir post havolasi bilan gul tarkibi va narxi kiritiladi.
      </p>
      <div className="flex flex-col gap-3.5">
        {posts.map((p) => (
          <article key={p.id} className="glass card-hover flex flex-wrap items-center gap-4 !rounded-[18px] p-4">
            <div className="h-20 w-20 shrink-0 -rotate-2 overflow-hidden rounded-[14px] border-[1.5px] bg-bg2" style={{ borderColor: "var(--line)" }}>
              {p.image_url && <img src={p.image_url} alt={p.title_uz} className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-[220px] flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold">{p.title_uz || p.title_ru}</h3>
                <span className={`rounded-full border px-2.5 py-0.5 text-[9.5px] font-bold tracking-wide ${p.is_targeted ? "text-white" : "bg-bg2"}`} style={p.is_targeted ? { background: "var(--side)", borderColor: "var(--side)" } : { borderColor: "var(--line2)", color: "var(--mut)" }}>
                  {p.is_targeted ? "TARGET YOQILGAN" : TYPE_LABEL[p.post_type] ?? p.post_type.toUpperCase()}
                </span>
                {!p.is_active && <span className="rounded-full bg-rose px-2.5 py-0.5 text-[9.5px] font-bold text-roseink">NOFAOL</span>}
              </div>
              <p className="mt-1 text-[12.5px]" style={{ color: "var(--mut)" }}>{p.description_uz || p.description_ru || "Tavsif kiritilmagan"}</p>
              <p className="mt-0.5 text-xs" style={{ color: "var(--mut)" }}>
                {p.flower_count > 0 && <>Gul soni: {p.flower_count} · </>}
                {p.permalink ? (
                  <a href={p.permalink.startsWith("http") ? p.permalink : `https://${p.permalink}`} target="_blank">{p.permalink.replace(/^https?:\/\//, "")}</a>
                ) : (
                  <>media: {p.media_id}</>
                )}
              </p>
            </div>
            <div className="flex gap-6 text-center">
              <div>
                <div className="text-[17px] font-extrabold">{p.price ? fmt(p.price).replace(" so'm", "") : "—"}</div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--mut)" }}>narx</div>
              </div>
              <div>
                <div className="text-[17px] font-extrabold">{p.reply_count}</div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--mut)" }}>reply</div>
              </div>
              <div>
                <div className="text-[17px] font-extrabold" style={{ color: "var(--acc)" }}>{p.lead_count}</div>
                <div className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--mut)" }}>lead</div>
              </div>
            </div>
          </article>
        ))}
        {posts.length === 0 && <EmptyState title="Post kiritilmagan" sub="Instagram postlarini ulang — AI reply&apos;larga shu bazadan javob beradi." />}
      </div>
    </>
  );
}
