"use client";
import { useEffect, useMemo, useState } from "react";
import Modal, { ModalFooter, ModalHeader, Section, Field } from "./Modal";
import ImageInput from "./ImageInput";
import Select from "./Select";
import { StockUsagePicker, type StockRow } from "./UsagePicker";
import { api, ApiError } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Icon } from "./icons";
import type { PostType, SocialPost, StockBatch } from "@/lib/types";

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
  onClose,
  onSaved,
}: {
  post: SocialPost | null;
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
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // === TAYYOR GUL (katalog) — post bilan bitta payloadda (kontrakt) ===
  const ci = post?.catalog_items?.[0];
  const [withCatalog, setWithCatalog] = useState(!!ci);
  const [ciName, setCiName] = useState(ci?.name_uz ?? "");
  const [ciType, setCiType] = useState(ci?.arrangement_type ?? "bouquet");
  const [ciQty, setCiQty] = useState(ci ? String(ci.quantity_total) : "1");
  const [ciPrice, setCiPrice] = useState(ci?.price ? String(Math.round(+ci.price)) : "");
  const [ciHeight, setCiHeight] = useState(ci?.height_cm ? String(ci.height_cm) : "");
  const [comp, setComp] = useState<StockRow[]>(
    ci?.composition?.map((c) => ({ stock_batch: c.stock_batch, quantity_stems: c.quantity_stems })) ?? []
  );
  const [batches, setBatches] = useState<StockBatch[]>([]);
  useEffect(() => {
    if (!withCatalog || batches.length) return;
    api.stockBatches({ is_active: true }).then((bs) => setBatches(bs.filter((b) => b.remaining_stems > 0))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withCatalog]);

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
    if (withCatalog && comp.length === 0) errs.catalog_items = "Tayyor gul tarkibini kiriting — kamida bitta sklad partiyasi";
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
        // tayyor gul + tarkibi — bitta payloadda; backend sklad qoldig'ini
        // quantity_total × quantity_stems bo'yicha tekshiradi (400 — yetmasa)
        ...(withCatalog && comp.length
          ? {
              catalog_items: [
                {
                  name_uz: (ciName || titleUz || titleRu).trim(),
                  name_ru: (titleRu || ciName || titleUz).trim(),
                  arrangement_type: ciType,
                  price: String(+(ciPrice || price || 0)),
                  quantity_total: Math.max(+ciQty || 1, 1),
                  status: "available",
                  height_cm: +ciHeight || null,
                  composition: comp.map((r) => {
                    const b = batches.find((x) => x.id === r.stock_batch);
                    const per = b?.stems_per_bunch || 0;
                    return {
                      stock_batch: r.stock_batch,
                      quantity_stems: r.quantity_stems,
                      ...(per > 0 ? { quantity_bunches: (r.quantity_stems / per).toFixed(2) } : {}),
                    };
                  }),
                },
              ],
            }
          : { catalog_items: [] }),
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
    <Modal onClose={onClose} width={560}>
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
      {linkError && <p className="mt-1.5 text-[12px] font-semibold text-[color:var(--danger-ink)]" role="alert">{linkError}</p>}
      {!linkError && linkHint && <p className="mt-1.5 text-[12px] text-[color:var(--muted)]">{linkHint}</p>}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Tur" span>
          <Select
            value={postType}
            options={TYPE_OPTIONS}
            onChange={(v) => { setPostType(String(v) as PostType); setTypeTouched(true); }}
          />
        </Field>
      </div>

      <Section>Kontent</Section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      {errors.title_uz && <p className="mt-1.5 text-[12px] font-semibold text-[color:var(--danger-ink)]" role="alert">{errors.title_uz}</p>}

      <Section>Narx va maqsad</Section>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Narx (so'm)">
          <input className="inp" inputMode="numeric" value={price} onChange={(e) => { setPrice(e.target.value.replace(/\D/g, "")); setErrors((x) => ({ ...x, price: "" })); }} placeholder="850000" />
        </Field>
        <Field label="Gul soni">
          <input className="inp" inputMode="numeric" value={flowerCount} onChange={(e) => setFlowerCount(e.target.value.replace(/\D/g, ""))} placeholder="25" />
        </Field>
      </div>
      {errors.price && <p className="mt-1.5 text-[12px] font-semibold text-[color:var(--danger-ink)]" role="alert">{errors.price}</p>}
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

      <Section>Tayyor gul (katalog)</Section>
      <label className="flex cursor-pointer items-center gap-2 text-[13px] normal-case tracking-normal">
        <input type="checkbox" checked={withCatalog} onChange={(e) => setWithCatalog(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
        Post bilan birga katalogga tayyor gul qo&apos;shish
        <span style={{ color: "var(--muted)" }}>— AI reply&apos;larda shu tarkibdan foydalanadi</span>
      </label>
      {withCatalog && (
        <div className="mt-3 flex flex-col gap-3 rounded-[14px] border p-3.5" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Gul nomi" span>
              <input className="inp" value={ciName} onChange={(e) => setCiName(e.target.value)} placeholder={titleUz || "Qizil atirgul buket"} />
            </Field>
            <Field label="Turi">
              <Select
                value={ciType}
                onChange={(v) => setCiType(String(v))}
                options={[
                  { value: "bouquet", label: "Buket" },
                  { value: "basket", label: "Savat" },
                  { value: "box", label: "Quti" },
                ]}
              />
            </Field>
            <Field label="Soni (nechta tayyor)">
              <input className="inp" inputMode="numeric" value={ciQty} onChange={(e) => setCiQty(e.target.value.replace(/\D/g, ""))} placeholder="4" />
            </Field>
            <Field label="Narxi (so'm)">
              <input className="inp" inputMode="numeric" value={ciPrice} onChange={(e) => setCiPrice(e.target.value.replace(/\D/g, ""))} placeholder={price || "400000"} />
            </Field>
            <Field label="Bo'yi (sm)">
              <input className="inp" inputMode="numeric" value={ciHeight} onChange={(e) => setCiHeight(e.target.value.replace(/\D/g, ""))} placeholder="60" />
            </Field>
          </div>
          <Field label="BITTA buket/savat tarkibi (skladdan)" span>
            <StockUsagePicker batches={batches} rows={comp} onChange={setComp} />
          </Field>
          <p className="text-[12px] normal-case tracking-normal" style={{ color: "var(--muted)" }}>
            Sklad tekshiruvi: soni × tarkibdagi dona &le; partiya qoldig&apos;i — yetmasa saqlanmaydi.
          </p>
        </div>
      )}
      {errors.catalog_items && (
        <p className="mt-1.5 text-[12px] font-semibold text-[color:var(--danger-ink)]" role="alert">{errors.catalog_items}</p>
      )}

      <Section>Rasm</Section>
      <ImageInput value={image} onChange={setImage} />

      <ModalFooter>
        <button onClick={onClose} className="btn-ghost">Bekor qilish</button>
        <button onClick={save} disabled={saving} className={`btn-primary ${saving ? "btn-loading" : ""}`}>
          {post ? "Saqlash" : "Qo'shish"}
        </button>
      </ModalFooter>
    </Modal>
  );
}
