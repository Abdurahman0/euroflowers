// ===== Backend API types (mirror DRF serializers) =====

export type Role = "developer" | "admin" | "operator" | "florist" | "warehouse" | "content";

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

export type Branch = {
  id: number;
  created_at: string;
  updated_at: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  is_active: boolean;
};

/** Single-branch mode: profile'da endi branches yo'q */
export type UserProfile = {
  role: Role;
  language: Language;
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
  created_at?: string;
  updated_at?: string;
};
export type SupplierInput = Partial<Pick<Supplier, "name" | "phone" | "notes" | "is_active">>;

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
  cost_per_stem: string;
  sale_price_per_stem: string;
  sale_price_per_bunch: string;
  minimum_sale_stems: number;
  image_url: string;
  notes: string;
  is_active: boolean;
  branch?: number;
  variant: number;
  supplier?: number | null;
};

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
  social_post: number | null;
  created_by: number | null;
};

/** To'lov turi — katalog sotuvida (kontrakt: cash|card) */
export type PaymentType = "cash" | "card";

/* ===== HISOB-KITOB (backend: GET /api/accounting/) — barcha pul maydonlari STRING ===== */
export type AccountingPeriod = { date_from: string | null; date_to: string | null };
export type AccountingSummary = {
  total_sales: string; cash_total: string; card_total: string; unknown_total: string;
  total_quantity: number; standard_quantity: number; custom_quantity: number;
  discount_total: string; discounted_sales_count: number; discounted_quantity: number;
  cost_total: string; net_profit: string;
};
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
  payment_type: string; payment_label: string;
  discount_amount: string; discount_percent: string; discount_reason: string; sold_by: string;
};
export type Accounting = {
  period: AccountingPeriod;
  summary: AccountingSummary;
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
export type AnalyticsDaily = { date: string; leads: number; conversations: number; orders: number; revenue: string };
export type TopCatalogItem = {
  catalog_item_id: number;
  catalog_item__name_uz: string;
  catalog_item__name_ru: string;
  catalog_item__arrangement_type: string;
  quantity: number;
  revenue: string;
};
export type Analytics = {
  period: { from: string; to: string };
  summary: {
    leads: number; customers: number; conversations: number; orders: number;
    revenue: string; florist_revenue: string; flowers_sold_stems: number; conversion_rate: number;
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
  revenue_by_source: { source: string; orders: number; revenue: string }[];
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

/** Florist hajm tarifi (backend: /api/florist-volume-rates/). Single-branch —
    filial (branch) OLIB TASHLANDI: matritsa faqat hajm × turi. */
export type FloristVolumeRate = {
  id: number;
  arrangement_type: "bouquet" | "basket";
  volume: CatalogVolume;
  default_stems: number;
  florist_fee: string;
  is_active: boolean;
};
export type VolumeRateInput = Partial<Omit<FloristVolumeRate, "id">>;

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
export type ScreenId = "dashboard" | "analitika" | "hisob" | "chat" | "ai" | "crm" | "mijozlar" | "sklad" | "suppliers" | "gullar" | "katalog" | "floristlar" | "postlar" | "bildirishnomalar" | "xodimlar" | "integratsiyalar" | "audit" | "sozlamalar";
export type DateFilter = "bugun" | "hafta" | "oy";
/** Maxsus davr — YYYY-MM-DD (ikkalasi ham kiritilgan kun bilan) */
export type DateRange = { from: string; to: string };
