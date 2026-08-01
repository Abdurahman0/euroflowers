// ===== Backend API types (mirror DRF serializers) =====

export type Role = "developer" | "admin" | "operator" | "florist" | "apprentice" | "supervisor" | "warehouse" | "content";

/** Sahifa darajasidagi ruxsatlar (kontrakt: can_view — ochish, can_control — amallar) */
export type PermissionPage =
  | "dashboard" | "inventory" | "catalog" | "crm" | "customers" | "conversations"
  | "social_posts" | "notifications" | "suppliers" | "florists" | "attendance"
  | "settings" | "ai_settings" | "integrations"
  | "users" | "mini_app" | "audit";

export type PagePermission = {
  id?: number;
  user?: number;
  page: PermissionPage;
  label?: string;
  can_view: boolean;
  can_control: boolean;
};
export type Language = "uz" | "ru";

/** Filial (backend: /api/branches/). Asosiy filial `is_main:true`;
    boshqalari — Parkent kabi. Sklad/florist/lead BO'LINMAYDI, faqat katalog. */
export type Branch = {
  id: number;
  name: string;
  is_main: boolean;
  is_active: boolean;
  note?: string;
  created_at: string;
  updated_at: string;
};

/** `branch` — foydalanuvchi filiali (null = asosiy filial). */
export type UserProfile = {
  role: Role;
  language: Language;
  branch?: number | null;
};

export type User = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  is_active?: boolean;
  profile: UserProfile;
  /** kontrakt: har bir foydalanuvchi sahifa ruxsatlari bilan keladi */
  permissions?: PagePermission[];
  /** backend to'liq ruxsat matritsasi (/api/me) — mavjud bo'lsa AVTORITATIV */
  permission_matrix?: PagePermission[];
};

export type Customer = {
  id: number;
  masked_phone: string;
  leads_count: number;
  purchases_count: number;
  total_spent: string;
  created_at: string;
  updated_at: string;
  name: string;
  phone: string;
  language: Language;
  instagram_user_id: string;
  instagram_username: string;
  notes: string;
  is_blocked: boolean;
  branch?: number | null;
};

/** Statuslar endi backenddan boshqariladi — key ixtiyoriy string bo'lishi mumkin
    (standartlari: new/qualified/contacted/won/lost) */
export type LeadStatus = string;

/** Dinamik lead statusi (backend: /api/lead-statuses/) */
export type LeadStatusDef = {
  id: number;
  key: string;
  name_uz: string;
  name_ru: string;
  color: string; // hex, masalan #2563eb
  order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};
export type LeadArrangementType = "bouquet" | "basket" | "stems" | "catalog" | "";

/** Lead ichidagi gul sarfi qatori (backend: stock_usage) */
export type LeadStockUsage = {
  id?: number;
  stock_batch: number;
  batch_detail?: StockBatch;
  quantity_stems: number;
  quantity_bunches?: string;
};

/** Lead ichidagi material/savat sarfi qatori (backend: packaging_usage) */
export type LeadPackagingUsage = {
  id?: number;
  packaging: number;
  packaging_detail?: Packaging;
  quantity: number;
};

export type Lead = {
  id: number;
  customer_detail: Customer;
  branch_detail?: Branch;
  created_at: string;
  updated_at: string;
  status: LeadStatus;
  /** dinamik status tafsiloti (nom, rang) — mavjud bo'lsa ustuvor */
  status_detail?: LeadStatusDef | null;
  request_uz: string;
  request_ru: string;
  arrangement_type: LeadArrangementType;
  estimated_price: string | null;
  florist_fee?: string | null;
  desired_date: string | null;
  /** yetkazish vaqti (datetime); recall_at yuborilmasa backend −1 soat qiladi */
  delivery_at?: string | null;
  recall_at?: string | null;
  /** eslatma yuborilgan vaqt — faqat o'qish uchun */
  recall_sent_at?: string | null;
  source: string;
  customer: number;
  branch?: number;
  conversation: number | null;
  social_post: number | null;
  assigned_to: number | null;
  /** «won»da backend sklad kamaytirgan vaqt (null — hali yechilmagan) */
  stock_deducted_at?: string | null;
  /** ustun ichidagi tartib (backend reorder-column yozadi; ordering=sort_order) */
  sort_order?: number;
  stock_usage?: LeadStockUsage[];
  packaging_usage?: LeadPackagingUsage[];
};

/** Lead yaratish/yangilash so'rovi — backend telefon orqali mijozni topadi yoki yaratadi */
export type LeadInput = Partial<
  Omit<Lead, "customer_detail" | "branch_detail" | "status_detail" | "stock_usage" | "packaging_usage">
> & {
  customer_name?: string;
  customer_phone?: string;
  stock_usage_input?: { stock_batch: number; quantity_stems: number; quantity_bunches?: string }[];
  packaging_usage_input?: { packaging: number; quantity: number }[];
};

export type Flower = {
  id: number;
  created_at: string;
  updated_at: string;
  name_uz: string;
  name_ru: string;
  slug: string;
  description_uz: string;
  description_ru: string;
  season_start_month: number | null;
  season_end_month: number | null;
  image_url: string;
  is_active: boolean;
};

export type FlowerVariant = {
  id: number;
  flower_detail: Flower;
  created_at: string;
  updated_at: string;
  name_uz: string;
  name_ru: string;
  color_uz: string;
  color_ru: string;
  /** nav tavsifi — UI'da faqat o'zbekchasi ishlatiladi (ru backendda qoladi) */
  description_uz?: string;
  description_ru?: string;
  default_stems_per_bunch: number;
  minimum_sale_stems: number;
  image_url: string;
  is_active: boolean;
  flower: number;
};

/** Yetkazib beruvchi (backend: /api/suppliers/) */
export type Supplier = {
  id: number;
  name: string;
  phone: string;
  notes: string;
  is_active: boolean;
  /** faqat o'qish uchun statistika */
  batches_count: number;
  total_received_stems: number;
  // hisob-kitob rollup'lari (backend 0082, read-only, ?ordering= bilan saralanadi)
  purchase_total?: string;   // Σ received_stems × cost_per_stem
  paid_total?: string;       // Σ SupplierPayment.amount
  outstanding?: string;      // purchase_total − paid_total (qarz)
  last_payment_at?: string | null;
  created_at?: string;
  updated_at?: string;
};
export type SupplierInput = Partial<Pick<Supplier, "name" | "phone" | "notes" | "is_active">>;

/** Yetkazib beruvchiga to'lov (backend: /api/supplier-payments/, on_delete=PROTECT). */
export type SupplierPaymentMethod = "cash" | "card" | "transfer";
export type SupplierPayment = {
  id: number;
  supplier: number;
  amount: string;
  paid_at: string;
  method: SupplierPaymentMethod;
  method_label: string; // "Naqd" | "Karta" | "O'tkazma" — tayyor yorliq
  note: string;
  supplier_detail?: { id: number; name: string; phone?: string };
  created_by_detail?: { id: number; username: string; first_name?: string; last_name?: string };
  created_at: string;
  updated_at: string;
};
export type SupplierPaymentInput = { supplier: number; amount: string; paid_at?: string; method?: SupplierPaymentMethod; note?: string };

/** Florist statistikasi — /florists/{id}/stats/ va /florists/me/dashboard/ bir xil shakl. */
export type FloristStatsSalarySource = "catalog" | "custom_catalog" | "daily" | "manual";
export type FloristStats = {
  florist: { id: number; name: string; username: string; staff_type: StaffType; staff_type_label: string; phone: string; daily_pay: string; is_active: boolean };
  period: { date_from: string | null; date_to: string | null };
  summary: {
    salary_total: string; salary_entries_count: number;
    catalog_salary_total: string; daily_salary_total: string; manual_salary_total: string;
    catalog_count: number; bouquet_count: number; basket_count: number;
    standard_count: number; custom_count: number;
    sold_quantity: number; unsold_quantity: number;
    sale_revenue: string; avg_fee_per_item: string; attendance_days: number;
  };
  by_source: { source: FloristStatsSalarySource; source_label: string; count: number; amount: string }[];
  by_arrangement: { arrangement_type: string; arrangement_label: string; count: number; amount: string; sold_quantity: number; sale_revenue: string }[];
  by_volume: { arrangement_type: string; arrangement_label: string; volume: string; count: number; amount: string; sold_quantity: number; sale_revenue: string }[];
  by_day: { work_date: string; count: number; amount: string; bouquets: number; baskets: number; sold_quantity: number; sale_revenue: string }[];
  salary_entries: FloristStatsSalaryEntry[];
  attendance: { id: number; work_date: string; check_in_at: string | null; check_out_at: string | null; source: string; source_label: string; note: string }[];
};
export type FloristStatsSalaryEntry = {
  id: number; work_date: string; created_at: string;
  source: FloristStatsSalarySource; source_label: string;
  amount: string; note: string; added_by: string;
  catalog_item_id: number | null; catalog_name: string; catalog_kind: CatalogKind | null; catalog_kind_label: string;
  arrangement_type: string; arrangement_label: string; volume: string;
  quantity_total: number | null; quantity_sold: number | null; listed_price: string | null;
  sold_quantity: number; sale_revenue: string; last_sold_at: string | null; is_sold: boolean;
};

export type StockBatch = {
  id: number;
  variant_detail: FlowerVariant;
  branch_detail?: Branch;
  /** yetkazib beruvchi tafsiloti — mavjud bo'lsa */
  supplier_detail?: Supplier | null;
  /** qoldiq pochkada — backend hisoblab beradi (decimal string, masalan "8.00") */
  remaining_bunches?: string;
  /** "8 pochka" ko'rinishida tayyor yorliq — backend beradi */
  remaining_bunches_label?: string;
  stock_value: string;
  /** "50 sm" yoki "40–60 sm" — backend tayyorlaydi */
  height_label?: string;
  created_at: string;
  updated_at: string;
  batch_number: string;
  received_at: string;
  height_cm: number;
  height_from_cm?: number | null;
  height_to_cm?: number | null;
  stems_per_bunch: number;
  /** o'qishda doim keladi; YOZISHDA ixtiyoriy — faqat bittasini yuboring:
      received_bunches (pochka) YOKI received_stems (dona). Backend qolganini
      va remaining_stems/remaining_bunches ni O'ZI hisoblaydi. */
  received_stems: number;
  received_bunches?: string;
  remaining_stems: number;
  /** ⚠️ YAXLITLANGAN dona tannarxi — HAMMA HISOB-KITOB SHU BILAN BORADI. */
  cost_per_stem: string;
  /** pochka tannarxi — yuborilsa cost_per_stem = cost_per_bunch ÷ stems_per_bunch,
      100 ga yaxlitlanadi (server hisoblaydi). Ikkalasi yuborilsa server hech narsa hisoblamaydi. */
  cost_per_bunch?: string;
  /** ⚠️ ANIQ dona tannarxi (4 xona) — FAQAT KO'RSATISH UCHUN. Hech qanday hisobga KIRMAYDI. */
  cost_per_stem_exact?: string;
  /** ⚠️ YAXLITLANGAN dona sotuv narxi — hisob shu bilan. */
  sale_price_per_stem: string;
  sale_price_per_bunch: string;
  /** ⚠️ ANIQ dona sotuv narxi (4 xona) — FAQAT KO'RSATISH UCHUN. Hisobga KIRMAYDI. */
  sale_price_per_stem_exact?: string;
  /** ⚠️ DISPLAY-ONLY yaxlitlash bloki (server tayyor beradi — farqni O'ZIMIZ hisoblamaymiz).
      Hisob-kitob rounded (per_stem_rounded/total_rounded) bilan boradi; exact FAQAT ko'rsatish uchun.
      Agar exact hisobga sizib kirsa — bizning raqamlar serverdan jimgina farq qiladi va hech narsa
      xato bermaydi. Shu bois exact NEVER money math'ga ulanmaydi (Vitest bilan qo'riqlangan). */
  rounding?: BatchRounding;
  minimum_sale_stems: number;
  image_url: string;
  notes: string;
  is_active: boolean;
  branch?: number;
  variant: number;
  supplier?: number | null;
  /** partiya qaysi YUK (delivery) ichida — yozishda ixtiyoriy, o'qishda delivery_detail keladi */
  delivery?: number | null;
  delivery_detail?: DeliveryBrief | null;
};

/** ⚠️ DISPLAY-ONLY. Server tayyor beradi — biz hisoblamaymiz, hisobga ulamaymiz.
    `total_*` kelgan butun son (received_stems) bo'yicha. is_rounded=false → farq yo'q. */
export type RoundingSide = {
  per_stem_exact: number;
  per_stem_rounded: number;
  per_stem_diff: number;
  total_exact: number;
  total_rounded: number;
  total_diff: number;
  is_rounded: boolean;
};
export type BatchRounding = { cost: RoundingSide; sale: RoundingSide };

/** stock-batch javobidagi qisqa yuk ma'lumoti (supplier bu yerda NOM — string). */
export type DeliveryBrief = {
  id: number;
  number: string;
  received_at: string;
  supplier?: string;
  note?: string;
};

/**
 * YUK (delivery) — partiyalarni (StockBatch) guruhlaydigan yozuv: raqam + sana + postavshik.
 * ⚠️ `number` TAKRORLANADI (turli sanadagi yuklar bir xil raqamli bo'lishi normal) — HECH QACHON
 * React key / lookup / noyoblik tekshiruvi sifatida ishlatilmaydi, DOIM `id`. Sanani raqam yonida ko'rsat.
 */
export type StockDelivery = {
  id: number;
  number: string;
  received_at: string;
  supplier?: number | null;
  supplier_detail?: Supplier | null;
  note?: string;
  is_active: boolean;
  created_by?: number | null;
  created_by_detail?: User | null;
  created_at: string;
  updated_at: string;
  /** server hisoblab beradi — ro'yxat kartochkasi uchun */
  batch_count: number;
  total_stems: number;
  remaining_stems: number;
  /** ⚠️ YAXLITLANGAN narx bo'yicha jami tannarx — hisob shu bilan. */
  total_cost: string;
  /** ⚠️ ANIQ hisob bo'yicha jami tannarx — FAQAT KO'RSATISH UCHUN (number keladi). */
  total_cost_exact?: number;
  /** ⚠️ yaxlitlash jami tannarxni qanchaga o'zgartirgani — DISPLAY-ONLY (number). */
  rounding_diff?: number;
};
export type StockDeliveryInput = { number: string; received_at?: string; supplier?: number | null; note?: string };

export type MovementType = "in" | "out" | "adjustment" | "waste" | "transfer_out" | "transfer_in";

export type StockMovement = {
  id: number;
  batch_detail: StockBatch;
  performed_by_detail: User | null;
  created_at: string;
  updated_at: string;
  movement_type: MovementType;
  quantity_stems: number;
  quantity_bunches: string;
  reference_type: string;
  reference_id: number | null;
  reason: string;
  batch: number;
  performed_by: number | null;
  // backend (0082) — barcha harakat turlarida: |dona| × cost_per_stem / sale_price_per_stem
  cost_value?: string;
  sale_value?: string;
};

export type CatalogStatus = "draft" | "available" | "reserved" | "sold" | "archived";
export type ArrangementType = "bouquet" | "basket" | "box";

export type CatalogComposition = {
  id: number;
  stock_batch: number;
  batch_detail: StockBatch;
  quantity_stems: number;
  quantity_bunches: string;
};

/** Katalogga biriktirilgan material (backend: CatalogMaterialUsage) */
export type CatalogMaterialUsage = {
  id: number;
  packaging: number;
  packaging_detail?: Packaging;
  quantity: number;
};

/** Katalog turi va hajmi (backend enum) */
export type CatalogKind = "standard" | "custom";
export type CatalogVolume = "small" | "medium" | "large";

/** Katalog tarixi amali (backend: CatalogHistory.action) */
export type CatalogHistoryAction = "created" | "updated" | "sold" | "inventory_deducted" | "inventory_restored";

/**
 * Katalog SOTUV/CHEGIRMA TARIXI (backend: CatalogItem.history, faqat o'qish).
 * Har sotuvda kim sotgani, nechta, e'lon narxi, sotilgan narx va chegirma
 * (summa/foiz/sabab) yoziladi — katalog detalida jadval bo'lib chiqadi.
 */
export type CatalogHistory = {
  id: number;
  catalog_item: number;
  action: CatalogHistoryAction;
  quantity?: number;
  /** e'lon qilingan (asl) dona narxi */
  listed_unit_price?: string;
  /** haqiqatda sotilgan dona narxi */
  sold_unit_price?: string;
  discount_amount?: string;
  discount_percent?: string;
  discount_reason?: string;
  note?: string;
  snapshot?: unknown;
  created_by?: number | null;
  created_by_detail?: User | null;
  created_at: string;
  updated_at?: string;
};

export type CatalogItem = {
  id: number;
  /** katalogga qo'yilgan tayyor buket soni / sotilgani / skladdan yechilgani */
  quantity_total?: number;
  quantity_sold?: number;
  quantity_stock_deducted?: number;
  // MIJOZ biriktirish (walk-in) — backend telefon bo'yicha dedup qiladi; customer_detail read-only
  customer?: number | null;
  customer_name?: string;
  customer_phone?: string;
  customer_detail?: { id: number; name: string; masked_phone?: string } | null;
  composition: CatalogComposition[];
  branch_detail?: Branch;
  social_post_detail: SocialPost | null;
  created_at: string;
  updated_at: string;
  name_uz: string;
  name_ru: string;
  description_uz: string;
  description_ru: string;
  arrangement_type: ArrangementType;
  /** standart (florist tayyorladi) yoki maxsus (mijoz do'konda tanladi) */
  catalog_kind?: CatalogKind;
  volume?: CatalogVolume | null;
  height_cm: number | null;
  diameter_cm: number | null;
  price: string;
  /** mijozdan olinadigan floristika xizmati (foydaga kiradi) */
  florist_fee: string;
  /** florist OYLIGIGA yoziladigan summa — maxsus katalogda fee'dan AJRATILGAN
      (backend: custom'da florist_fee avtomatik oylikka qo'shilmaydi) */
  florist_salary_amount?: string;
  florist?: number | null;
  florist_detail?: FloristProfile | null;
  /** backend hisoblaydi — mijoz preview'i faqat yo'l-yo'riq */
  calculated_cost_price?: string;
  calculated_component_price?: string;
  discount_amount?: string;
  discount_percent?: string;
  /** chegirma sababi — calculated narxdan past sotilganda MAJBURIY */
  discount_reason?: string;
  /** ichki izoh / nazoratchi izohi — create/update'da yuboriladi, javobda qaytadi */
  note?: string;
  /** to'lov turi — sotishda yuboriladi (write-only), javobda qaytmaydi */
  payment_type?: PaymentType;
  /** sotuv/chegirma tarixi (faqat o'qish) */
  history?: CatalogHistory[];
  materials?: CatalogMaterialUsage[];
  status: CatalogStatus;
  image_url: string;
  instagram_story_url: string;
  sold_at: string | null;
  stock_deducted_at: string | null;
  branch?: number;
  /** filial nomi (RO) — katalog javobiga qo'shildi (asosiy/Parkent) */
  branch_name?: string;
  /** asosiy filial narxi — FILIALGA yuborilgan nusxada saqlanadi (null = yuborilmagan) */
  source_price?: string | null;
  social_post: number | null;
  created_by: number | null;
};

/** To'lov turi — katalog sotuvida (kontrakt: cash|card) */
export type PaymentType = "cash" | "card";

/* ===== HISOB-KITOB (backend: GET /api/accounting/) — barcha pul maydonlari STRING ===== */
export type AccountingPeriod = { date_from: string | null; date_to: string | null };
/** Filial ajratmasi (0-spec): `summary` VA `by_branch` qatorlari AYNAN shu shaklda —
    bitta komponent bilan ikkalasi ham chiziladi. Filial maydonlari (branch_id/is_main/
    share_percent) summary'da bo'lmasligi mumkin, shu bois ixtiyoriy. */
export type AccountingFigures = {
  branch_id?: number | null;
  branch_name?: string;
  is_main?: boolean;
  sales_count?: number; // YANGI: sotuvlar soni
  total_quantity: number;
  flower_stems?: number; // YANGI: sotilgan gul donasi
  standard_quantity: number; custom_quantity: number;
  total_sales: string;
  cash_total: string; cash_count?: number; cash_quantity?: number;
  card_total: string; card_count?: number; card_quantity?: number;
  unknown_total: string; unknown_count?: number; unknown_quantity?: number;
  discount_total: string; discounted_sales_count: number; discounted_quantity: number;
  cost_total: string;
  // backend tannarxni ajratib beradi (0082/0083): flower+material+fee === cost_total (aniq).
  // ⚠️ florist_fee_cost_total — MIJOZDAN olinadigan floristika xizmati (tannarx qismi),
  // florist OYLIGI EMAS (Stage 1 fee/salary ajratmasi bilan bir xil).
  flower_cost_total?: string; material_cost_total?: string; florist_fee_cost_total?: string;
  // chiqit FAQAT asosiy filialda — filial qatorlarida doim 0
  waste_cost_total?: string; waste_stems?: number;
  net_profit: string;
  share_percent?: string; // umumiy savdodagi ulush, % (summary'da yo'q — Jami = 100%)
};
export type AccountingSummary = AccountingFigures;
export type AccountingByBranch = AccountingFigures;
/** Filial filtri holati — SARLAVHA shundan (klient state'dan EMAS). */
export type AccountingBranchFilter = { mode: "all" | "main" | "branch"; branch_id: number | null; branch_name: string | null };
export type AccountingByKind = { catalog_kind: CatalogKind; quantity: number; sales: string; discount: string };
export type AccountingByPayment = { payment_type: string; label: string; quantity: number; sales: string };
export type AccountingByVolume = { catalog_kind: CatalogKind; volume: CatalogVolume | null; quantity: number; sales: string; discount: string };
/** history va discounted_sales bir xil shakl (discounted — chegirma > 0 bo'lganlari) */
export type AccountingSale = {
  history_id: number; catalog_id: number; catalog_name: string;
  catalog_kind: CatalogKind; arrangement_type: string; volume: CatalogVolume | null;
  quantity: number; created_at: string; catalog_created_at: string; sold_at: string;
  florist_id: number | null; florist_name: string;
  listed_unit_price: string; sold_unit_price: string; listed_total: string;
  sale_total: string; cost_total: string; net_profit: string;
  // per-sotuv tannarx ajratmasi (backend, 0082): flower+material+fee === cost_total
  flower_cost?: string; material_cost?: string; florist_fee_cost?: string;
  payment_type: string; payment_label: string;
  discount_amount: string; discount_percent: string; discount_reason: string; sold_by: string;
  // filial ajratmasi (0-spec) — history VA discounted_sales qatorlarida
  branch_id?: number | null; branch_name?: string; is_main_branch?: boolean; flower_stems?: number;
};
export type Accounting = {
  period: AccountingPeriod;
  branch_filter?: AccountingBranchFilter; // yangi — sukut bo'yicha "all"
  summary: AccountingSummary;
  by_branch?: AccountingByBranch[]; // yangi — har filial (0 sotuvli ham keladi)
  by_kind: AccountingByKind[];
  by_payment: AccountingByPayment[];
  by_volume: AccountingByVolume[];
  discounted_sales: AccountingSale[];
  history: AccountingSale[];
};

export type PostType = "post" | "reel" | "story" | "ad";

/** Postga biriktirilgan tayyor katalog guli (kontrakt: social post composition) */
export type PostCatalogItem = {
  id?: number;
  name_uz: string;
  name_ru?: string;
  arrangement_type: string;
  price: string;
  quantity_total: number;
  status?: string;
  height_cm?: number | null;
  composition: { id?: number; stock_batch: number; quantity_stems: number; quantity_bunches?: string; batch_detail?: StockBatch }[];
};

export type SocialPost = {
  id: number;
  reply_count: number;
  lead_count: number;
  created_at: string;
  updated_at: string;
  post_type: PostType;
  media_id: string;
  permalink: string;
  title_uz: string;
  title_ru: string;
  description_uz: string;
  description_ru: string;
  price: string | null;
  flower_count: number;
  image_url: string;
  is_targeted: boolean;
  is_active: boolean;
  branch?: number;
  /** postga biriktirilgan tayyor katalog gullari (bir payloadda yaratiladi) */
  catalog_items?: PostCatalogItem[];
  /** Instagram bog'lash maydonlari (kontrakt: story/post/reel linking) */
  instagram_username?: string;
  story_share_id?: string;
  webhook_story_id?: string;
  webhook_story_url?: string;
};

export type Sender = "customer" | "ai" | "operator" | "system";

export type Message = {
  id: number;
  created_at: string;
  updated_at: string;
  sender: Sender;
  text: string;
  instagram_message_id: string;
  metadata: Record<string, unknown>;
  conversation: number;
  /** AI/mijoz yuborgan media — metadata'dan tashqari top-level ham kelishi mumkin */
  media_url?: string | null;
  image_url?: string | null;
  /** FAQAT UI: optimistik yuborilgan xabar holati (backendda yo'q) */
  ui_status?: "sending" | "failed";
  /** FAQAT UI: yuborishda qaytgan xato matni */
  ui_error?: string;
};

export type ConversationStatus = "ai" | "operator" | "closed";

export type Conversation = {
  id: number;
  /** suhbat manbasi — BACKEND yuboradi (avtoritativ): "instagram" | "telegram" */
  source?: "instagram" | "telegram" | string;
  /** eski nom — ba'zi javoblarda kelishi mumkin */
  channel?: "instagram" | "telegram" | string;
  customer_detail: Customer;
  messages: Message[];
  last_message: Message | null;
  created_at: string;
  updated_at: string;
  status: ConversationStatus;
  last_message_at: string;
  ai_summary: string;
  /** AI pauzada — shu vaqtgacha (null = pauza yo'q) */
  ai_paused_until: string | null;
  ai_pause_reason: string;
  customer: number;
  branch?: number;
  social_post: number | null;
  assigned_to: number | null;
};

export type NotificationType =
  | "stock_pending" | "low_stock" | "lead" | "handoff" | "supplier_stock"
  /** floristga biriktirilgan katalog ishi */
  | "florist_catalog"
  /** florist oyligiga yozuv qo'shildi */
  | "florist_salary"
  /** florist ishga keldi / ketdi (adminlarga) */
  | "attendance";

export type Notification = {
  id: number;
  created_at: string;
  updated_at: string;
  notification_type: NotificationType;
  title_uz: string;
  title_ru: string;
  body_uz: string;
  body_ru: string;
  reference_type: string;
  reference_id: number | null;
  is_read: boolean;
  /** aynan shu foydalanuvchiga yo'naltirilgan (null — umumiy bildirishnoma) */
  target_user?: number | null;
  target_user_detail?: User | null;
  branch?: number;
};

/** Florist keldi-ketdi yozuvi (backend: /api/florist-attendance/) */
export type FloristAttendance = {
  id: number;
  florist: number;
  florist_detail?: FloristProfile;
  work_date?: string;
  check_in_at: string | null;
  check_out_at: string | null;
  check_in_latitude?: string | null;
  check_in_longitude?: string | null;
  check_out_latitude?: string | null;
  check_out_longitude?: string | null;
  source?: string;
  note?: string;
  created_at: string;
  updated_at?: string;
};

export type PackagingType = "wrap" | "basket" | "box" | "other" | "accessory";

export type Packaging = {
  id: number;
  created_at: string;
  updated_at: string;
  packaging_type: PackagingType;
  name_uz: string;
  name_ru: string;
  size: string;
  capacity_min_stems: number;
  capacity_max_stems: number;
  cost_price: string;
  sale_price: string;
  quantity: number;
  image_url: string;
  is_active: boolean;
  branch?: number;
};

/** Material sklad harakati (backend: /api/material-movements/, ichkarida Packaging) */
export type MaterialMovement = {
  id: number;
  packaging_detail?: Packaging;
  material_detail?: Packaging;
  created_at: string;
  updated_at?: string;
  movement_type: string;
  quantity: number;
  reason: string;
  reference_type?: string;
  reference_id?: number | null;
  packaging?: number;
  performed_by?: number | null;
  performed_by_detail?: User | null;
};

export type AuditLog = {
  id: number;
  user_detail: User | null;
  /** backend tayyorlagan ism — user_detail bo'lmasa ham keladi */
  actor_name?: string;
  action: string;
  /** backend tarjimasi — jadvalda ASOSIY yorliq (action — texnik kod) */
  action_label?: string;
  /** qisqa izoh (bo'sh bo'lishi mumkin) */
  summary?: string;
  entity_type: string;
  entity_id: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip_address?: string | null;
  request_method?: string;
  request_path?: string;
  created_at: string;
  user: number | null;
};

export type Dashboard = {
  /** kunlik dinamika — davrning HAR kuni (0 qiymatlar ham) */
  daily_stats?: { date: string; leads: number; conversations: number }[];
  /** eng ko'p sotilgan gullar — dashboardda birinchi 5 tasi ko'rsatiladi */
  top_selling_flowers?: { flower_id: number; name_uz: string; name_ru: string; color_uz: string; color_ru: string; stems: number; bunches: string }[];
  /** ?from&to davri statistikasi (backend qo'shgan yangi maydonlar) */
  period?: { from: string; to: string };
  period_revenue?: number | string;
  period_orders?: number;
  period_leads?: number;
  period_customers?: number;
  period_conversations?: number;
  florist_revenue?: number | string;
  flowers_sold_stems?: number;
  revenue_today: number | string;
  orders_today: number;
  revenue_7d: number | string;
  // SAVDO uchun avtoritativ (accounting bilan mos) — catalog_sales_*; lead_revenue_* = lead-pipeline (kutilayotgan)
  catalog_sales_revenue_today?: number | string; catalog_sales_revenue_7d?: number | string; period_catalog_sales_revenue?: number | string;
  catalog_sales_orders_today?: number; catalog_sales_quantity_today?: number; period_catalog_sales_orders?: number; period_catalog_sales_quantity?: number;
  lead_revenue_today?: number | string; lead_revenue_7d?: number | string; period_lead_revenue?: number | string;
  conversion_rate: number;
  active_leads: number;
  new_leads_today: number;
  available_catalog: number;
  pending_deductions: number;
  unread_notifications: number;
  ai_conversations: number;
  operator_conversations: number;
  stock_stems: number;
  low_stock: number;
  lead_pipeline: { status: LeadStatus; count: number }[];
  recent_leads: Lead[];
  recent_notifications: Notification[];
  /** YANGI bloklar — backend qo'shsa keladi (aks holda undefined) */
  net_profit?: number | string;
  catalog_revenue?: number | string;
  catalog_cost?: number | string;
  catalog_discount?: number | string;
  florist_salary_total?: number | string;
  /** chegirmada sotilgan katalog statistikasi */
  discounted_catalog_sales_count?: number;
  discounted_catalog_quantity?: number;
  discounted_catalog_amount?: number | string;
  batch_inventory_stats?: BatchInventoryStat[];
  florist_production_stats?: FloristProductionStat[];
};

/** Chegirma bloki — dashboard va analitikada bir xil ko'rinadi */
export type DiscountStats = {
  count?: number;
  quantity?: number;
  amount?: number | string;
};

/** Dashboard/Analytics: partiya bo'yicha SARF taqsimoti (jonli API shakli).
    Diqqat: bu partiyadan CHIQQAN sarf — "qolgan" maydoni yo'q. */
export type BatchInventoryStat = {
  batch_id?: number;
  batch_number?: string;
  supplier_id?: number | null;
  supplier_name?: string | null;
  flower?: string;
  variant?: string;
  color?: string;
  standard_catalog_stems?: number;
  custom_catalog_stems?: number;
  waste_stems?: number;
  total_out_stems?: number;
};

/** Dashboard/Analytics: florist ishlab chiqarish statistikasi (jonli API shakli) */
export type FloristProductionStat = {
  florist_id?: number;
  name?: string;
  staff_type?: StaffType;
  standard_bouquets?: number;
  standard_baskets?: number;
  custom_bouquets?: number;
  custom_baskets?: number;
  catalog_total?: number;
  salary_total?: number | string;
};

/** Analitika sahifasi (GET /api/analytics/) */
// daily_stats: `revenue`/`orders` = lead+katalog JAMI; per-manba maydonlar alohida (backend gap-fill qiladi)
export type AnalyticsDaily = { date: string; leads: number; conversations: number; orders: number; revenue: string;
  catalog_revenue?: number | string; catalog_orders?: number; catalog_quantity?: number; lead_revenue?: number | string; lead_orders?: number };
export type TopCatalogItem = {
  catalog_item_id: number;
  catalog_item__name_uz: string;
  catalog_item__name_ru: string;
  catalog_item__arrangement_type: string;
  catalog_item__image_url?: string;
  catalog_kind?: CatalogKind;
  quantity: number;
  orders?: number;
  revenue: string;
  last_sold_at?: string | null;
};
export type Analytics = {
  period: { from: string; to: string };
  summary: {
    leads: number; customers: number; conversations: number; orders: number;
    revenue: string; florist_revenue: string; flowers_sold_stems: number; conversion_rate: number;
    // SAVDO uchun avtoritativ (accounting bilan mos): catalog_sales_*; `revenue`/`orders` = lead+katalog JAMI
    catalog_sales_revenue?: number | string; catalog_sales_quantity?: number; catalog_sales_orders?: number;
    lead_revenue?: number | string; lead_orders?: number;
    /** jonli API: sof foyda bloklari summary ICHIDA keladi (top-level emas) */
    net_profit?: number | string; catalog_revenue?: number | string;
    catalog_cost?: number | string; catalog_discount?: number | string;
    florist_salary_total?: number | string;
    /** chegirmada sotilgan katalog statistikasi */
    discounted_catalog_sales_count?: number;
    discounted_catalog_quantity?: number;
    discounted_catalog_amount?: number | string;
  };
  daily_stats: AnalyticsDaily[];
  top_selling_flowers: { flower_id: number; name_uz: string; name_ru: string; color_uz: string; color_ru: string; stems: number; bunches: string }[];
  top_catalog_items: TopCatalogItem[];
  /** so'nggi kunlarda ko'p sotilganlar — backend alohida hisoblaydi */
  recent_top_catalog_items?: TopCatalogItem[];
  lead_statuses: { status: string; count: number }[];
  arrangement_types: { arrangement_type: string; count: number }[];
  conversation_sources: { source: string; count: number }[];
  revenue_by_source: { source: string; source_label?: string; orders: number; revenue: string }[];
  /** YANGI bloklar (defensiv — mavjud bo'lsa) */
  net_profit?: number | string;
  catalog_revenue?: number | string;
  catalog_cost?: number | string;
  catalog_discount?: number | string;
  florist_salary_total?: number | string;
  discounted_catalog_sales_count?: number;
  discounted_catalog_quantity?: number;
  discounted_catalog_amount?: number | string;
  batch_inventory_stats?: BatchInventoryStat[];
  florist_production_stats?: FloristProductionStat[];
};

/* ===== FLORISTLAR ===== */

export type StaffType = "florist" | "apprentice";

/** Florist profili (backend: /api/florists/) */
export type FloristProfile = {
  id: number;
  user: number;
  user_detail?: User;
  staff_type: StaffType;
  phone: string;
  daily_pay: string;
  work_start_time: string | null;
  work_end_time: string | null;
  shop_latitude: string | null;
  shop_longitude: string | null;
  arrival_radius_meters: number | null;
  departure_radius_meters: number | null;
  is_active: boolean;
  /** faqat o'qish */
  salary_total: string;
  catalog_count: number;
  created_at?: string;
  updated_at?: string;
};
export type FloristInput = Partial<Omit<FloristProfile, "id" | "user_detail" | "salary_total" | "catalog_count" | "created_at" | "updated_at">>;

/** Florist hajm tarifi (backend: /api/florist-volume-rates/). PER-FLORIST —
    umumiy tarif OLIB TASHLANDI, `florist` endi MAJBURIY.
    ⚠️ NOM TUZOG'I: bu yerdagi `florist_fee` — floristning ISH HAQI (u oladigan pul),
    va u KATALOGning `florist_salary_amount` maydonini to'ldiradi (katalogning
    `florist_fee` — bu MIJOZDAN olinadigan xizmat haqi, boshqa narsa). Xaritalash
    faqat lib/inventory.ts `rateSalaryForCatalog`/`rateToCatalogSalary` da. */
export type FloristVolumeRate = {
  id: number;
  florist?: number;
  florist_name?: string;
  arrangement_type: "bouquet" | "basket";
  /** DIQQAT: doim "small"|"medium"|"large" saqlanadi (aynan katalog volume bilan
      mos kelishi shart — moslik satr-tenglik). API'da erkin satr, lekin biz S/M/L
      YOZMAYMIZ — auto-to'ldirish jimgina ishlamay qolardi. */
  volume: CatalogVolume;
  /** ⚠️ endi TAQSIMOT OG'IRLIGI (close-issue): standart dona soni ulushni belgilaydi.
      Serverda IXTIYORIY (OpenAPI required emas) — null/0 bo'lsa og'irlik buziladi.
      UI himoyalangan: fee bor, stems yo'q katakni ogohlantiradi. */
  default_stems?: number | null;
  florist_fee: string;
  is_active: boolean;
};
export type VolumeRateInput = Partial<Omit<FloristVolumeRate, "id" | "florist_name">>;

/* ===== FILIAL: katalog transfer / hisobot (backend 2026-07-31) ===== */
/** Katalog nusxasini filialga yuborish yozuvi (GET /api/catalog-transfers/). */
export type CatalogTransfer = {
  id: number;
  branch: number;
  branch_name: string;
  catalog_name: string;
  quantity: number;
  source_price: string;
  target_price: string;
  note?: string;
  source_item?: number | null;
  /** filial nusxasi id — ASOSIY FILIALDAN OCHIB BO'LMAYDI (GET → 404). Link QILINMAYDI. */
  target_item?: number | null;
  created_by?: number | null;
  created_by_detail?: User | null;
  created_at: string;
  updated_at: string;
};
export type CatalogTransferInput = { branch: number; quantity: number; price?: string; note?: string };

/** Filial hisoboti bitta filial qatori (GET /api/branch-report/). Pul = STRING. */
export type BranchReportRow = {
  branch_id: number;
  branch_name: string;
  received_transfers: number;
  received_quantity: number;
  catalog_items: number;
  available_quantity: number;
  sold_quantity: number;
  sold_revenue: string;
  source_value: string;
  markup_total: string;
  discounted_sales_count: number;
  discounted_quantity: number;
  discount_total: string;
};
export type BranchReport = {
  period: { date_from: string | null; date_to: string | null };
  branches: BranchReportRow[];
  totals: {
    received_quantity: number;
    sold_quantity: number;
    sold_revenue: string;
    discounted_quantity: number;
    discount_total: string;
  };
};

/* ===== FLORISTGA GUL CHIQARISH (backend 2026-07-31) ===== */
export type FloristStockIssueKind = "issue" | "return" | "waste";
/** issue/balance javoblaridagi qisqa partiya ma'lumoti (batches endpoint'idan farqli). */
export type FloristStockBatchDetail = {
  id: number;
  batch_number: string;
  flower: string;
  variant: string;
  color: string;
  height_label?: string;
  image_url?: string;
  cost_per_stem: string;
  /** balansda bor; ISSUE javobida bo'lmasligi mumkin — balansdan o'qing */
  stems_per_bunch?: number;
};
/** Floristda hozir qancha gul bor (GET /api/florist-stock-balances/). */
export type FloristStockBalance = {
  id: number;
  florist: number;
  florist_name: string;
  batch: number;
  remaining_stems: number;
  batch_detail: FloristStockBatchDetail;
  created_at: string;
  updated_at: string;
};
/** Chiqarish / qaytarish / chiqit tarixi (GET /api/florist-stock-issues/). */
export type FloristStockIssue = {
  id: number;
  florist: number;
  florist_name: string;
  batch: number;
  batch_detail: FloristStockBatchDetail;
  kind: FloristStockIssueKind;
  kind_label: string;
  quantity_stems: number;
  reason?: string;
  performed_by?: number | null;
  performed_by_detail?: User | null;
  created_at: string;
  updated_at: string;
};
export type FloristStockIssueInput = { florist: number; batch: number; quantity_stems: number; reason?: string };
/** ⚠️ `kind` DOIM aniq yuboriladi — destruktiv `waste` uchun default'ga tayanmang. */
export type FloristStockReturnInput = { florist: number; batch: number; quantity_stems: number; kind: "return" | "waste"; reason?: string };

/* ===== FLORIST GUL HISOBINI TO'G'RILASH (adjust) =====
   Standart hajm bilan haqiqat farqi: florist standartdan ko'p/kam ishlatgan bo'lsa,
   farqni katalog tarkibiga bo'lish (to_catalog) yoki floristga qaytarish (to_florist). */
export type AdjustDirection = "to_catalog" | "to_florist";
/** ⚠️ change_per_item ≠ change_total qachonki quantity_total > 1 (2 dona → +1/dona = 2 gul).
    to_florist da IKKALASI ham MANFIY. */
export type AdjustPreviewItem = {
  catalog_item: number;
  catalog_name: string;
  quantity_total: number;
  stems_per_item_now: number;
  change_per_item: number;
  change_total: number;
  stems_per_item_after: number;
};
export type AdjustPreviewBatch = {
  batch_id: number;
  batch_number: string;
  flower: string;
  florist_stems_now: number;
  requested_stems: number;
  /** joylanmagan (hech qaysi katalogga tushmagan) gullar — 0 dan katta bo'lsa ko'rsatiladi */
  unplaced_stems: number;
  /** true bo'lsa BUTUN amal to'xtaydi (all-or-nothing) — `reason` sababni beradi */
  blocked: boolean;
  reason: string;
  items: AdjustPreviewItem[];
};
export type AdjustPreview = {
  florist: number;
  florist_name: string;
  direction: AdjustDirection;
  total_florist_stems: number;
  blocked_count: number;
  batches: AdjustPreviewBatch[];
};
/** adjust javobidagi bir katalog: stems_before → stems_after. */
export type AdjustResultItem = {
  catalog_item: number;
  catalog_name: string;
  quantity_total: number;
  stems_before: number;
  stems_after: number;
  change_total: number;
};
export type AdjustResultBatch = {
  batch_id: number;
  batch_number: string;
  flower: string;
  moved_stems: number;
  florist_stems_after: number;
  items: AdjustResultItem[];
};
export type AdjustResult = {
  /** ⚠️ bu YERDA `florist` = ism (string), preview'dagi id emas */
  florist: string;
  direction: AdjustDirection;
  moved_stems: number;
  unplaced_stems: number;
  batches: AdjustResultBatch[];
};
/** batch — to_catalog da ixtiyoriy (berilmasa hamma qoldiq), to_florist da MAJBURIY.
    quantity_stems — faqat to_florist uchun, u yerda MAJBURIY. */
export type AdjustInput = { florist: number; direction: AdjustDirection; batch?: number; quantity_stems?: number };

/* ===== CHIQIMNI YOPISH (close-issue) — florist katalogi endi faqat hajm bilan; gul chiqim
   yopilganda hajm standartiga qarab kataloglarga taqsimlanadi (adjust'dan OLDINGI birinchi taqsimot). */
export type CloseIssuePreviewItem = {
  catalog_item: number;
  catalog_name: string;
  arrangement_type: string;
  /** ⚠️ ko'rsatish qiymati — backend "S"/"M"/"L" qaytarishi mumkin (VOLUME_SHORT), katalog
      esa small/medium/large SAQLAYDI. Faqat jadval yorlig'i sifatida ishlatiladi. */
  volume: string;
  quantity_total: number;
  standard_stems: number;
  /** har bir donaga tushadigan gul */
  stems_per_item: number;
  /** butun katalogga tushadigan gul (quantity_total > 1 da stems_per_item dan FARQ qiladi) */
  stems_total: number;
};
/** hajm tarifi belgilanmagan turi+hajm — bo'sh bo'lmasa yopish BLOKLANADI.
    Shakli noaniq (read-only kuzatilmadi): obyekt yoki tayyor yorliq string bo'lishi mumkin. */
export type CloseIssueMissingRate = { arrangement_type?: string; volume?: string; label?: string } | string;
export type CloseIssuePreview = {
  florist: number;
  florist_name: string;
  batch_id: number;
  batch_number: string;
  flower: string;
  florist_stems_now: number;
  return_stems: number;
  share_stems: number;
  unplaced_stems: number;
  missing_rates: CloseIssueMissingRate[];
  items: CloseIssuePreviewItem[];
};
export type CloseIssueResult = {
  /** ⚠️ bu YERDA florist = ism (string) */
  florist: string;
  batch_number: string;
  returned_stems: number;
  shared_stems: number;
  unplaced_stems: number;
  items: CloseIssuePreviewItem[];
};
/** batch MAJBURIY (har gul alohida yopiladi). return_stems ixtiyoriy (sukut 0). */
export type CloseIssueInput = { florist: number; batch: number; return_stems?: number };

/** Florist oylik yozuvi (backend: /api/florist-salary/) */
export type SalarySource = "catalog" | "custom_catalog" | "daily" | "manual";
export type FloristSalaryEntry = {
  id: number;
  florist: number;
  florist_detail?: FloristProfile;
  catalog_item?: number | null;
  catalog_item_detail?: { id: number; name_uz?: string } | null;
  amount: string;
  source: SalarySource;
  work_date: string;
  note: string;
  created_at?: string;
  updated_at?: string;
};

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type InstagramSettings = {
  id: number;
  connected: boolean;
  account_id: string;
  account_username: string;
  has_access_token: boolean;
  token_expires_at: string | null;
  auto_reply_dm: boolean;
  auto_reply_post_reply: boolean;
  auto_reply_story_reply: boolean;
  created_at: string;
  updated_at: string;
};

export type BusinessSettings = {
  id: number;
  created_at: string;
  updated_at: string;
  default_florist_fee: string;
  min_sale_reminder_uz: string;
  min_sale_reminder_ru: string;
  approximate_price_wording_uz: string;
  approximate_price_wording_ru: string;
  handoff_rules_uz: string;
  handoff_rules_ru: string;
  working_hours: Record<string, unknown> | string;
};

export type UploadResponse = { url: string; path: string };

/** AI sozlamalari — faqat developer (kontrakt) */
export type AISettings = {
  id: number;
  created_at: string;
  updated_at: string;
  openai_model: string;
  system_prompt: string;
  temperature: number;
  is_active: boolean;
};

/** Integratsiya kalitlari — faqat developer (kontrakt) */
export type IntegrationSettings = {
  id: number;
  created_at: string;
  updated_at: string;
  instagram_access_token: string;
  instagram_account_id: string;
  instagram_business_id: string;
  instagram_verify_token: string;
  telegram_bot_token: string;
  /** Recall xabarlari yuboriladigan Telegram guruh chat ID (bo'sh — .env fallback) */
  telegram_group_chat_id?: string;
  extra: Record<string, unknown> | null;
};

/** Instagram webhook hodisasi — debug jadvali uchun (kontrakt) */
export type InstagramEvent = {
  id: number;
  created_at: string;
  updated_at: string;
  event_type: string;
  sender_id: string;
  recipient_id: string;
  message_id: string;
  text: string;
  media_id: string;
  story_id: string;
  story_url: string;
  extracted: Record<string, unknown> | null;
  raw_payload: Record<string, unknown> | null;
};

// ===== UI types =====

export type ThemeId = "pushti" | "navy" | "bordo" | "zumrad" | "binafsha";
export type Theme = { id: ThemeId; nomi: string; accent: string; strong: string; accL: string; light: string; dark: string };
export type ScreenId = "dashboard" | "analitika" | "hisob" | "chat" | "ai" | "crm" | "mijozlar" | "sklad" | "suppliers" | "gullar" | "katalog" | "floristlar" | "floristStock" | "branchReport" | "postlar" | "bildirishnomalar" | "xodimlar" | "integratsiyalar" | "audit" | "sozlamalar";
export type DateFilter = "bugun" | "hafta" | "oy";
/** Maxsus davr — YYYY-MM-DD (ikkalasi ham kiritilgan kun bilan) */
export type DateRange = { from: string; to: string };
