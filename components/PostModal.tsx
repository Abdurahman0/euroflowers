"use client";
import { useMemo, useState } from "react";
import Modal, { ModalHeader, Section, Field } from "./Modal";
import ImageInput from "./ImageInput";
import Select from "./Select";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Icon } from "./icons";
import type { Branch, PostType, SocialPost } from "@/lib/types";

/**
 * SocialPost yaratish/tahrirlash — kontrakt bo'yicha:
 * Instagram havolasi (post/reel/story) yopishtiriladi, backend media ID'ni o'zi
 * aniqlaydi. Titul/tavsif UZ-RU, narx, gul soni, target, rasm, filial.
 * Dublikat havola 400 qaytaradi — maydon xatosi sifatida ko'rsatiladi.
 */

const TYPE_OPTIONS: { value: PostType; label: string }[] = [
  { value: "post", label: "Post" },
  { value: "reel", label: "Reel" },
  { value: "story", label: "Story" },
  { value: "ad", label: "Reklama (ad)" },
];

/** Havoladan post turini taxmin qilamiz — backend baribir o'zi tekshiradi. */
function detectType(link: string): PostType | null {
  if (/instagram\.com\/stories\//.test(link)) return "story";
  if (/instagram\.com\/reel\//.test(link)) return "reel";
  if (/instagram\.com\/p\//.test(link)) return "post";
  return null;
}

export default function PostModal({
  post,
  branches,
  onClose,
  onSaved,
}: {
  post: SocialPost | null;
  branches: Branch[];
  onClose: () => void;
  onSaved: (p: SocialPost) => void;
}) {
  const showToast = useStore((s) => s.showToast);
  const [link, setLink] = useState(post?.permalink ?? "");
  const [postType, setPostType] = useState<PostType>(post?.post_type ?? "post");
  const [typeTouched, setTypeTouched] = useState(!!post);
  const [titleUz, setTitleUz] = useState(post?.title_uz ?? "");
  const [titleRu, setTitleRu] = useState(post?.title_ru ?? "");
  const [descUz, setDescUz] = useState(post?.description_uz ?? "");
  const [descRu, setDescRu] = useState(post?.description_ru ?? "");
  const [price, setPrice] = useState(post?.price ? String(Math.round(+post.price)) : "");
  const [flowerCount, setFlowerCount] = useState(post?.flower_count ? String(post.flower_count) : "");
  const [targeted, setTargeted] = useState(post?.is_targeted ?? false);
  const [active, setActive] = useState(post?.is_active ?? true);
  const [image, setImage] = useState(post?.image_url ?? "");
  const [branch, setBranch] = useState<number>(post?.branch ?? branches[0]?.id ?? 1);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const linkHint = useMemo(() => {
    const t = detectType(link);
    return t ? `Aniqlangan tur: ${TYPE_OPTIONS.find((o) => o.value === t)?.label}` : "";
  }, [link]);

  const onLinkChange = (v: string) => {
    setLink(v);
    setErrors((e) => ({ ...e, permalink: "", media_id: "" }));
    const t = detectType(v);
    if (t && !typeTouched) setPostType(t);
  };

  const save = async () => {
    const errs: Record<string, string> = {};
    if (!titleUz.trim() && !titleRu.trim()) errs.title_uz = "Kamida bitta til uchun sarlavha kiriting";
    if (postType !== "ad" && !link.trim()) errs.permalink = "Instagram havolasini kiriting";
    if (price && !/^\d+$/.test(price)) errs.price = "Faqat raqam kiriting";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      const payload: Partial<SocialPost> = {
        post_type: postType,
        permalink: link.trim(),
        title_uz: titleUz.trim(),
        title_ru: titleRu.trim(),
        description_uz: descUz.trim(),
        description_ru: descRu.trim(),
        price: price ? price : null,
        flower_count: flowerCount ? +flowerCount : 0,
        is_targeted: targeted,
        is_active: active,
        image_url: image,
        branch,
      };
      const saved = post
        ? await api.updateSocialPost(post.id, payload)
        : await api.createSocialPost(payload);
      showToast(post ? "✓ Post yangilandi" : "✓ Post qo'shildi");
      onSaved(saved);
    } catch (e) {
      if (e instanceof ApiError && e.fieldErrors) {
        // dublikat media/permalink shu yerga tushadi (kontrakt: 400)
        setErrors(e.fieldErrors);
      } else {
        showToast(e instanceof Error ? e.message : "Saqlab bo'lmadi");
      }
    } finally {
      setSaving(false);
    }
  };

  const linkError = errors.permalink || errors.media_id;

  return (
    <Modal onClose={onClose} width={620}>
      <ModalHeader
        icon={<Icon name="postlar" size={20} />}
        title={post ? "Postni tahrirlash" : "Yangi Instagram post"}
        sub="AI reply'larga shu ma'lumotdan javob beradi"
        onClose={onClose}
      />

      <Section>Instagram havolasi</Section>
      <Field label="Post / Reel / Story havolasi" span>
        <input
          className="inp"
          value={link}
          onChange={(e) => onLinkChange(e.target.value)}
          placeholder="https://www.instagram.com/p/… yoki /reel/… yoki /stories/…"
          autoFocus={!post}
        />
      </Field>
      {linkError && <p className="mt-1.5 text-[12px] font-semibold text-[#e8a7a7]" role="alert">{linkError}</p>}
      {!linkError && linkHint && <p className="mt-1.5 text-[11.5px] text-white/45">{linkHint}</p>}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Tur">
          <Select
            value={postType}
            options={TYPE_OPTIONS}
            onChange={(v) => { setPostType(String(v) as PostType); setTypeTouched(true); }}
          />
        </Field>
        <Field label="Filial">
          <Select
            value={String(branch)}
            options={branches.map((b) => ({ value: String(b.id), label: b.name }))}
            onChange={(v) => setBranch(+v)}
          />
        </Field>
      </div>

      <Section>Kontent</Section>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sarlavha (UZ)">
          <input className="inp" value={titleUz} onChange={(e) => { setTitleUz(e.target.value); setErrors((x) => ({ ...x, title_uz: "" })); }} placeholder="Nafis piyonlar to'plami" />
        </Field>
        <Field label="Sarlavha (RU)">
          <input className="inp" value={titleRu} onChange={(e) => setTitleRu(e.target.value)} placeholder="Набор нежных пионов" />
        </Field>
        <Field label="Tavsif (UZ)" span>
          <textarea className="inp min-h-[64px]" value={descUz} onChange={(e) => setDescUz(e.target.value)} placeholder="Tarkib, o'lcham, yetkazish sharti…" />
        </Field>
        <Field label="Tavsif (RU)" span>
          <textarea className="inp min-h-[64px]" value={descRu} onChange={(e) => setDescRu(e.target.value)} placeholder="Состав, размер, доставка…" />
        </Field>
      </div>
      {errors.title_uz && <p className="mt-1.5 text-[12px] font-semibold text-[#e8a7a7]" role="alert">{errors.title_uz}</p>}

      <Section>Narx va maqsad</Section>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Narx (so'm)">
          <input className="inp" inputMode="numeric" value={price} onChange={(e) => { setPrice(e.target.value.replace(/\D/g, "")); setErrors((x) => ({ ...x, price: "" })); }} placeholder="850000" />
        </Field>
        <Field label="Gul soni">
          <input className="inp" inputMode="numeric" value={flowerCount} onChange={(e) => setFlowerCount(e.target.value.replace(/\D/g, ""))} placeholder="25" />
        </Field>
      </div>
      {errors.price && <p className="mt-1.5 text-[12px] font-semibold text-[#e8a7a7]" role="alert">{errors.price}</p>}
      <div className="mt-3 flex items-center gap-6 text-[13px]">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={targeted} onChange={(e) => setTargeted(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
          Target yoqilgan
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
          Faol
        </label>
      </div>

      <Section>Rasm</Section>
      <ImageInput value={image} onChange={setImage} />

      <div className="mt-6 flex gap-2.5">
        <button onClick={onClose} className="btn-ghost !text-white/70 hover:!bg-white/10 hover:!text-white">Bekor qilish</button>
        <button onClick={save} disabled={saving} className={`btn-primary ${saving ? "btn-loading" : ""}`}>
          {post ? "Saqlash" : "Qo'shish"}
        </button>
      </div>
    </Modal>
  );
}
