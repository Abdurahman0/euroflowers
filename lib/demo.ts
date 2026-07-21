"use client";
import type {
  AISettings, AuditLog, Branch, BusinessSettings, CatalogItem, Conversation, Customer, Dashboard,
  Flower, FlowerVariant, InstagramEvent, InstagramSettings, IntegrationSettings, Lead, LeadStatusDef, Message,
  Notification, Packaging, PagePermission, Paginated, SocialPost, StockBatch, StockMovement, User,
} from "./types";

/**
 * DEMO MA'LUMOTLARI — backend'siz dizaynni ko'rish uchun.
 * lib/api.ts dagi DEMO_MODE=true bo'lsa, hech qanday tarmoq so'rovi ketmaydi:
 * request() shu yerdagi demoRequest() dan javob oladi.
 * Backend tayyor bo'lganda lib/api.ts da DEMO_MODE=false qiling — bu fayl
 * umuman ishlatilmaydi.
 */

const ago = (days: number, hours = 0) =>
  new Date(Date.now() - days * 864e5 - hours * 36e5).toISOString();

const IMG = {
  peony: "/flowers/textures/peony.png",
  rose: "/flowers/textures/pink-rose.png",
  hpink: "/flowers/textures/hydrangea-pink.png",
  hwhite: "/flowers/textures/hydrangea-white.png",
  hblue: "/flowers/textures/hydrangea-blue.png",
};

// ===== Filiallar =====

const branches: Branch[] = [
  { id: 1, created_at: ago(400), updated_at: ago(10), name: "Chilonzor", code: "CHZ", address: "Chilonzor 12-kvartal, Bunyodkor 45", phone: "+998 71 200 11 22", is_active: true },
  { id: 2, created_at: ago(300), updated_at: ago(8), name: "Yunusobod", code: "YUN", address: "Yunusobod 4-mavze, Amir Temur 108", phone: "+998 71 200 33 44", is_active: true },
];

// ===== Lead statuslari (dinamik) =====

const leadStatuses: LeadStatusDef[] = [
  { id: 1, key: "new", name_uz: "Yangi", name_ru: "Новый", color: "#c2703f", order: 10, is_active: true },
  { id: 2, key: "qualified", name_uz: "Malakali", name_ru: "Квалифицирован", color: "#8a8a8a", order: 20, is_active: true },
  { id: 3, key: "contacted", name_uz: "Aloqada", name_ru: "На связи", color: "#b3873a", order: 30, is_active: true },
  { id: 4, key: "won", name_uz: "Sotildi", name_ru: "Продан", color: "#3d8a5f", order: 40, is_active: true },
  { id: 5, key: "lost", name_uz: "Bekor", name_ru: "Отменён", color: "#a04a4a", order: 50, is_active: true },
];
const statusDetail = (key: string) => leadStatuses.find((s) => s.key === key) ?? null;

// ===== Foydalanuvchilar =====

const ALL_PAGES = ["dashboard", "inventory", "catalog", "crm", "customers", "conversations", "social_posts", "notifications", "settings", "ai_settings", "integrations", "users", "mini_app", "audit"] as const;
const fullPerms: PagePermission[] = ALL_PAGES.map((page, i) => ({ id: i + 1, page, can_view: true, can_control: true }));

const users: User[] = [
  { id: 1, username: "admin", first_name: "Dilnoza", last_name: "Karimova", email: "dilnoza@euroflowers.uz", is_active: true, profile: { role: "admin", language: "uz", branches }, permissions: fullPerms },
  { id: 2, username: "aziza", first_name: "Aziza", last_name: "Tosheva", email: "aziza@euroflowers.uz", is_active: true, profile: { role: "operator", language: "uz", branches: [branches[0]] } },
  { id: 3, username: "malika", first_name: "Malika", last_name: "Yusupova", email: "malika@euroflowers.uz", is_active: true, profile: { role: "florist", language: "ru", branches: [branches[0]] } },
  { id: 4, username: "sardor", first_name: "Sardor", last_name: "Aliyev", email: "sardor@euroflowers.uz", is_active: true, profile: { role: "warehouse", language: "uz", branches: [branches[1]] } },
];

// ===== Mijozlar =====

const mkCustomer = (id: number, name: string, ig: string, spent: string, leads: number, buys: number, days: number): Customer => ({
  id, masked_phone: "+998 ** *** ** " + String(10 + id), leads_count: leads, purchases_count: buys,
  total_spent: spent, created_at: ago(days), updated_at: ago(0, 3), name, phone: `+998 90 12${id} 45 6${id}`,
  language: id % 3 === 0 ? "ru" : "uz", instagram_user_id: `1780${id}`, instagram_username: ig,
  notes: "", is_blocked: false, branch: (id % 2) + 1,
});

const customers: Customer[] = [
  mkCustomer(1, "Nilufar Rashidova", "nilufar.r", "2450000", 4, 3, 90),
  mkCustomer(2, "Jasur Bekmurodov", "jasur_bek", "890000", 2, 1, 45),
  mkCustomer(3, "Kamola Ergasheva", "kamola.e", "5120000", 7, 6, 200),
  mkCustomer(4, "Timur Sattorov", "timur_s", "340000", 1, 1, 12),
  mkCustomer(5, "Sevara Nazarova", "sevara.flowers", "1780000", 3, 2, 60),
  mkCustomer(6, "Olim Xudoyberdiyev", "olim_x", "0", 1, 0, 2),
];

// ===== Leadlar =====

const mkLead = (
  id: number, c: Customer, status: Lead["status"], req: string, price: string | null,
  type: Lead["arrangement_type"], days: number, hours: number
): Lead => ({
  id, customer_detail: c, branch_detail: branches[(id % 2)], created_at: ago(days, hours), updated_at: ago(0, 1),
  status, status_detail: statusDetail(status), request_uz: req, request_ru: req, arrangement_type: type, estimated_price: price,
  desired_date: status === "won" ? null : ago(-2),
  delivery_at: id % 3 === 1 ? ago(-1, -3) : null,
  recall_at: id % 3 === 1 ? ago(-1, -2) : null,
  recall_sent_at: null,
  source: id % 2 ? "instagram_dm" : "story_reply",
  customer: c.id, branch: (id % 2) + 1, conversation: id, social_post: id % 3 === 0 ? 1 : null, assigned_to: 2,
});

const leads: Lead[] = [
  mkLead(1, customers[0], "new", "101 dona qizil atirgul, yubiley uchun", "1200000", "bouquet", 0, 2),
  mkLead(2, customers[1], "qualified", "Oq piyonlardan to'y guldastasi", "850000", "bouquet", 0, 5),
  mkLead(3, customers[2], "contacted", "Savatchada aralash kompozitsiya, pastel", "650000", "basket", 1, 3),
  mkLead(4, customers[3], "won", "Storydagi guldasta — o'sha-o'sha bo'lsin", "480000", "catalog", 1, 8),
  mkLead(5, customers[4], "new", "25 dona pushti gortenziya", "970000", "stems", 2, 1),
  mkLead(6, customers[5], "contacted", "Ona kuniga nafis buket, 500 ming atrofida", "520000", "bouquet", 2, 6),
  mkLead(7, customers[2], "won", "Ofis uchun haftalik gul yetkazish", "1500000", "", 4, 2),
  mkLead(8, customers[0], "lost", "Import qora atirgul so'radi — mavjud emas", null, "stems", 6, 4),
  {
    ...mkLead(10, customers[2], "qualified", "3 pochka Freedom atirguldan savat", "1750000", "basket", 0, 4),
    florist_fee: "50000",
    stock_usage: [{ id: 1, stock_batch: 3, quantity_stems: 30, quantity_bunches: "3.00" }],
    packaging_usage: [{ id: 1, packaging: 2, quantity: 1 }],
    stock_deducted_at: null,
  },
  mkLead(
    9,
    customers[1],
    "new",
    "📅 Yetkazish: Bugun (2026-07-19), 09:00 – 12:00\n📍 Manzil: 9, Xadra (C-14, Shayhontohur Tumani, Toshkent, 100000, Oʻzbekiston — juda uzun manzil misoli, qo'shimcha mo'ljal: metro chiqishi yonidagi biznes markaz\n🗺 Lokatsiya: 41.325960,69.248253 — https://yandex.uz/maps/?pt=69.24825322894111,41.32596027598443&z=17\n💳 To'lov: Click\n💌 Kartochka: \"Ona, sizni yaxshi ko'raman!\"",
    "980000",
    "catalog",
    0,
    1
  ),
];

// ===== Gullar va navlar =====

const mkFlower = (id: number, uz: string, ru: string, img: string): Flower => ({
  id, created_at: ago(300), updated_at: ago(20), name_uz: uz, name_ru: ru, slug: uz.toLowerCase().replace(/\s+/g, "-"),
  description_uz: "", description_ru: "", season_start_month: 3, season_end_month: 10, image_url: img, is_active: true,
});

const flowers: Flower[] = [
  mkFlower(1, "Piyon", "Пион", IMG.peony),
  mkFlower(2, "Atirgul", "Роза", IMG.rose),
  mkFlower(3, "Gortenziya", "Гортензия", IMG.hpink),
  mkFlower(4, "Lola", "Тюльпан", IMG.hwhite),
];

const mkVariant = (id: number, f: Flower, uz: string, ru: string, colorUz: string, colorRu: string, img: string): FlowerVariant => ({
  id, flower_detail: f, created_at: ago(200), updated_at: ago(5), name_uz: uz, name_ru: ru,
  color_uz: colorUz, color_ru: colorRu, default_stems_per_bunch: 10, minimum_sale_stems: 5,
  image_url: img, is_active: true, flower: f.id,
});

const variants: FlowerVariant[] = [
  mkVariant(1, flowers[0], "Oq piyon", "Белый пион", "oq", "белый", IMG.peony),
  mkVariant(2, flowers[0], "Pushti piyon", "Розовый пион", "pushti", "розовый", IMG.peony),
  mkVariant(3, flowers[1], "Pushti atirgul 60sm", "Роза розовая 60см", "pushti", "розовый", IMG.rose),
  mkVariant(4, flowers[2], "Pushti gortenziya", "Гортензия розовая", "pushti", "розовый", IMG.hpink),
  mkVariant(5, flowers[2], "Ko'k gortenziya", "Гортензия синяя", "ko'k", "синий", IMG.hblue),
];

// ===== Sklad =====

const mkBatch = (
  id: number, v: FlowerVariant, br: Branch, received: number, remaining: number,
  cost: string, sale: string, height: number, days: number
): StockBatch => ({
  id, variant_detail: v, branch_detail: br, remaining_bunches: Math.floor(remaining / 10),
  stock_value: String(remaining * Number(sale)), created_at: ago(days), updated_at: ago(0, 2),
  batch_number: `B-2607-${100 + id}`, received_at: ago(days), height_cm: height, stems_per_bunch: 10,
  received_stems: received, remaining_stems: remaining, cost_per_stem: cost, sale_price_per_stem: sale,
  sale_price_per_bunch: String(Number(sale) * 10), minimum_sale_stems: 5, image_url: v.image_url,
  notes: "", is_active: true, branch: br.id, variant: v.id,
});

const batches: StockBatch[] = [
  mkBatch(1, variants[0], branches[0], 200, 140, "18000", "35000", 50, 1),
  mkBatch(2, variants[1], branches[0], 150, 30, "20000", "38000", 50, 3),
  mkBatch(3, variants[2], branches[0], 500, 410, "9000", "18000", 60, 0),
  mkBatch(4, variants[3], branches[1], 120, 96, "22000", "42000", 45, 2),
  mkBatch(5, variants[4], branches[1], 100, 12, "24000", "45000", 45, 5),
];

const mkMove = (id: number, b: StockBatch, type: StockMovement["movement_type"], qty: number, reason: string, days: number, hours: number): StockMovement => ({
  id, batch_detail: b, performed_by_detail: users[3], created_at: ago(days, hours), updated_at: ago(days, hours),
  movement_type: type, quantity_stems: qty, quantity_bunches: (qty / 10).toFixed(1), reference_type: type === "out" ? "catalog" : "",
  reference_id: type === "out" ? 1 : null, reason, batch: b.id, performed_by: 4,
});

const movements: StockMovement[] = [
  mkMove(1, batches[2], "in", 500, "Yangi partiya keldi", 0, 6),
  mkMove(2, batches[0], "out", 25, "Katalog: Nafis oq buket", 0, 4),
  mkMove(3, batches[1], "out", 40, "To'y buyurtmasi", 0, 9),
  mkMove(4, batches[3], "in", 120, "Yangi partiya keldi", 2, 3),
  mkMove(5, batches[4], "waste", 8, "So'ligan gullar hisobdan chiqarildi", 1, 5),
  mkMove(6, batches[0], "out", 35, "Katalog: Piyonli savat", 1, 7),
  mkMove(7, batches[2], "adjustment", -5, "Inventarizatsiya tuzatishi", 3, 2),
  mkMove(8, batches[3], "out", 24, "Katalog: Pastel kompozitsiya", 4, 1),
  { ...mkMove(9, batches[2], "out", 30, "Lead #10 — sotildi", 0, 2), reference_type: "lead", reference_id: 10 },
];

// ===== Instagram postlar =====

const mkPost = (id: number, type: SocialPost["post_type"], uz: string, price: string | null, replies: number, leadsN: number, img: string, days: number): SocialPost => ({
  id, reply_count: replies, lead_count: leadsN, created_at: ago(days), updated_at: ago(0, 4),
  post_type: type, media_id: `1789${id}`, permalink: "https://instagram.com/p/demo", title_uz: uz, title_ru: uz,
  description_uz: "Kompozitsiya tarkibi bilan tanishing — DM'ga yozing.", description_ru: "",
  price, flower_count: 25, image_url: img, is_targeted: type === "ad", is_active: true, branch: 1,
});

const posts: SocialPost[] = [
  mkPost(1, "post", "Nafis oq piyonlar to'plami", "850000", 34, 6, IMG.peony, 1),
  mkPost(2, "reel", "Bugungi svejiy keldi — pushti atirgullar", null, 58, 9, IMG.rose, 2),
  mkPost(3, "story", "Faqat bugun: gortenziya savatchasi", "650000", 12, 3, IMG.hpink, 0),
  mkPost(4, "ad", "To'y mavsumi — buyurtmalar ochiq", null, 21, 5, IMG.hwhite, 5),
];

// ===== Katalog =====

const mkItem = (
  id: number, uz: string, price: string, status: CatalogItem["status"], type: CatalogItem["arrangement_type"],
  img: string, days: number, post: SocialPost | null
): CatalogItem => ({
  id,
  // yangi kontrakt: soni bilan ishlash (id=3 — qisman sotilgan, chiqim kutilmoqda)
  quantity_total: id === 3 ? 5 : 1,
  quantity_sold: id === 3 ? 2 : status === "sold" ? 1 : 0,
  quantity_stock_deducted: id === 3 ? 1 : status === "sold" ? 1 : 0,
  composition: [
    { id: id * 10 + 1, stock_batch: batches[0].id, batch_detail: batches[0], quantity_stems: 15, quantity_bunches: "1.5" },
    { id: id * 10 + 2, stock_batch: batches[2].id, batch_detail: batches[2], quantity_stems: 10, quantity_bunches: "1.0" },
  ],
  branch_detail: branches[0], social_post_detail: post, created_at: ago(days), updated_at: ago(0, 2),
  name_uz: uz, name_ru: uz, description_uz: "Floristik namat va atlas lenta bilan.", description_ru: "",
  arrangement_type: type, height_cm: 55, diameter_cm: 35, price, florist_fee: "50000", status,
  image_url: img, instagram_story_url: post ? "https://instagram.com/stories/demo" : "",
  sold_at: status === "sold" ? ago(0, 3) : null, stock_deducted_at: status === "sold" ? ago(0, 3) : null,
  branch: 1, social_post: post?.id ?? null, created_by: 3,
});

const catalog: CatalogItem[] = [
  mkItem(1, "Nafis oq buket", "850000", "available", "bouquet", IMG.peony, 0, posts[0]),
  mkItem(2, "Pushti atirgul romantikasi", "620000", "available", "bouquet", IMG.rose, 0, null),
  mkItem(3, "Gortenziya savatchasi", "650000", "reserved", "basket", IMG.hpink, 1, posts[2]),
  mkItem(4, "Pastel kompozitsiya qutida", "780000", "sold", "box", IMG.hwhite, 1, null),
  mkItem(5, "Moviy tuman", "920000", "available", "bouquet", IMG.hblue, 2, null),
  mkItem(6, "Ertalabki shabnam", "540000", "draft", "bouquet", IMG.peony, 0, null),
];

// ===== Suhbatlar =====

let msgId = 1;
const mkMsg = (conv: number, sender: Message["sender"], text: string, days: number, hours: number): Message => ({
  id: msgId++, created_at: ago(days, hours), updated_at: ago(days, hours), sender, text,
  instagram_message_id: `igm_${msgId}`, metadata: {}, conversation: conv,
});

const mkConv = (id: number, c: Customer, status: Conversation["status"], summary: string, msgs: Message[]): Conversation => ({
  id, customer_detail: c, messages: msgs, last_message: msgs[msgs.length - 1] ?? null,
  created_at: msgs[0]?.created_at ?? ago(1), updated_at: msgs[msgs.length - 1]?.created_at ?? ago(0),
  status, last_message_at: msgs[msgs.length - 1]?.created_at ?? ago(0), ai_summary: summary,
  ai_paused_until: null, ai_pause_reason: "",
  customer: c.id, branch: 1, social_post: null, assigned_to: status === "operator" ? 2 : null,
});

const conversations: Conversation[] = [
  mkConv(1, customers[0], "ai", "Yubiley uchun 101 atirgul so'ramoqda, narx kelishilmoqda.", [
    mkMsg(1, "customer", "Assalomu alaykum! 101 dona qizil atirgul bormi?", 0, 3),
    mkMsg(1, "ai", "Va alaykum assalom! 🌹 Albatta bor — 60 sm premium qizil atirgul donasi 18 000 so'm. 101 dona uchun chiroyli bezatish bilan 1 950 000 so'm bo'ladi. Qachonga kerak?", 0, 3),
    mkMsg(1, "customer", "Ertaga kechqurunga. Chegirma bo'ladimi?", 0, 2),
    mkMsg(1, "ai", "Ertaga 18:00 gacha tayyor qilamiz. 100+ dona uchun 5% chegirma amal qiladi — jami 1 852 500 so'm. Rasmiylashtiramizmi? 💐", 0, 2),
  ]),
  mkConv(2, customers[1], "operator", "To'y guldastasi — operator narx va dizayn bo'yicha kelishmoqda.", [
    mkMsg(2, "customer", "To'y uchun oq piyonlardan buket kerak edi", 0, 6),
    mkMsg(2, "ai", "Tabriklaymiz! 🤍 Oq piyonlar hozirda mavsumda. Qaysi sana uchun?", 0, 6),
    mkMsg(2, "customer", "Shu shanba. Lekin menga aniq dizayn muhim, rasm ko'rsata olasizmi?", 0, 5),
    mkMsg(2, "system", "Suhbat operatorga o'tkazildi", 0, 5),
    mkMsg(2, "operator", "Assalomu alaykum, men Aziza — floristimiz bilan 3 ta variant tayyorlab yuboramiz 😊", 0, 4),
  ]),
  mkConv(3, customers[2], "ai", "Ofis uchun haftalik gul yetkazib berish shartnomasi.", [
    mkMsg(3, "customer", "Ofisimizga har hafta yangi gul kompozitsiyasi kerak", 1, 4),
    mkMsg(3, "ai", "Ajoyib! Haftalik obuna: 3 ta kompozitsiya, yetkazish bepul — oyiga 1 500 000 so'mdan boshlanadi. Manzilingizni yozib qoldirasizmi?", 1, 4),
  ]),
  mkConv(4, customers[4], "ai", "Gortenziya narxi so'raldi.", [
    mkMsg(4, "customer", "Storydagi gortenziyalar necha pul?", 0, 8),
    mkMsg(4, "ai", "Pushti gortenziya donasi 42 000 so'm, savatchada 650 000 so'm 🌸", 0, 8),
  ]),
  mkConv(5, customers[5], "closed", "Ona kuni buketi — buyurtma yakunlandi.", [
    mkMsg(5, "customer", "Rahmat, buket juda chiroyli chiqdi!", 2, 5),
    mkMsg(5, "operator", "Xursandmiz! Yana kutamiz 🌷", 2, 4),
  ]),
];

// ===== Bildirishnomalar =====

const notifications: Notification[] = [
  { id: 1, created_at: ago(0, 1), updated_at: ago(0, 1), notification_type: "lead", title_uz: "Yangi lead: Nilufar Rashidova", title_ru: "", body_uz: "101 dona qizil atirgul, yubiley uchun — 1 200 000 so'm atrofida.", body_ru: "", reference_type: "lead", reference_id: 1, is_read: false, branch: 1 },
  { id: 2, created_at: ago(0, 3), updated_at: ago(0, 3), notification_type: "handoff", title_uz: "Operator kerak: to'y guldastasi", title_ru: "", body_uz: "Jasur Bekmurodov aniq dizayn so'ramoqda — AI operatorga o'tkazdi.", body_ru: "", reference_type: "conversation", reference_id: 2, is_read: false, branch: 1 },
  { id: 3, created_at: ago(0, 5), updated_at: ago(0, 5), notification_type: "low_stock", title_uz: "Kam qoldiq: Ko'k gortenziya", title_ru: "", body_uz: "Yunusobod filialida 12 dona qoldi (minimal: 20).", body_ru: "", reference_type: "stock_batch", reference_id: 5, is_read: false, branch: 2 },
  { id: 4, created_at: ago(1, 2), updated_at: ago(1, 2), notification_type: "stock_pending", title_uz: "Sklad yechimi kutilmoqda", title_ru: "", body_uz: "«Pastel kompozitsiya» sotildi — sklad hisobidan yechish tasdiqlansin.", body_ru: "", reference_type: "catalog", reference_id: 4, is_read: true, branch: 1 },
  { id: 5, created_at: ago(1, 6), updated_at: ago(1, 6), notification_type: "lead", title_uz: "Yangi lead: Sevara Nazarova", title_ru: "", body_uz: "25 dona pushti gortenziya so'ramoqda.", body_ru: "", reference_type: "lead", reference_id: 5, is_read: true, branch: 1 },
];

// ===== Dashboard =====

const dashboard: Dashboard = {
  period: { from: ago(30), to: ago(0) },
  period_revenue: "12000000.00",
  period_orders: 18,
  period_leads: 52,
  period_customers: 31,
  period_conversations: 140,
  florist_revenue: "900000.00",
  flowers_sold_stems: 620,
  revenue_today: 3250000,
  orders_today: 7,
  revenue_7d: 18400000,
  conversion_rate: 0.42,
  active_leads: 5,
  new_leads_today: 3,
  available_catalog: 3,
  pending_deductions: 1,
  unread_notifications: 3,
  ai_conversations: 3,
  operator_conversations: 1,
  stock_stems: 688,
  low_stock: 2,
  lead_pipeline: [
    { status: "new", count: 2 },
    { status: "qualified", count: 1 },
    { status: "contacted", count: 2 },
    { status: "won", count: 2 },
    { status: "lost", count: 1 },
  ],
  branch_stock: [
    { branch__id: 1, branch__name: "Chilonzor", stems: 580, batches: 3 },
    { branch__id: 2, branch__name: "Yunusobod", stems: 108, batches: 2 },
  ],
  recent_leads: leads.slice(0, 4),
  recent_notifications: notifications.slice(0, 3),
};

// ===== Sozlamalar =====

const instagram: InstagramSettings = {
  id: 1, connected: true, account_id: "17800001", account_username: "euroflowers.uz",
  has_access_token: true, token_expires_at: ago(-45), auto_reply_dm: true,
  auto_reply_post_reply: true, auto_reply_story_reply: false, created_at: ago(120), updated_at: ago(1),
};

const settings: BusinessSettings = {
  id: 1, created_at: ago(300), updated_at: ago(2),
  default_florist_fee: "50000",
  min_sale_reminder_uz: "Hurmatli mijoz, minimal buyurtma — 5 dona guldan.",
  min_sale_reminder_ru: "Минимальный заказ — от 5 стеблей.",
  approximate_price_wording_uz: "Narx taxminiy — yakuniy summa kompozitsiyaga bog'liq.",
  approximate_price_wording_ru: "Цена ориентировочная.",
  handoff_rules_uz: "Aniq dizayn, shikoyat yoki 2 mln so'mdan katta buyurtmalarda operatorga o'tkazing.",
  handoff_rules_ru: "Передавайте оператору при жалобах и заказах свыше 2 млн.",
  working_hours: "09:00–21:00, har kuni",
};

const packaging: Packaging[] = [
  { id: 1, created_at: ago(100), updated_at: ago(5), packaging_type: "wrap", name_uz: "Kraft o'ram", name_ru: "Крафт", size: "M", capacity_min_stems: 5, capacity_max_stems: 25, cost_price: "8000", sale_price: "20000", quantity: 140, image_url: "", is_active: true, branch: 1 },
  { id: 2, created_at: ago(100), updated_at: ago(5), packaging_type: "basket", name_uz: "Toqilgan savat", name_ru: "Корзина", size: "L", capacity_min_stems: 15, capacity_max_stems: 45, cost_price: "45000", sale_price: "95000", quantity: 22, image_url: "", is_active: true, branch: 1 },
  { id: 3, created_at: ago(100), updated_at: ago(5), packaging_type: "box", name_uz: "Shlyapa qutisi", name_ru: "Шляпная коробка", size: "M", capacity_min_stems: 11, capacity_max_stems: 31, cost_price: "38000", sale_price: "80000", quantity: 15, image_url: "", is_active: true, branch: 1 },
];

// lead #10 sarf detallari — batches/packaging pastda e'lon qilingani uchun shu yerda bog'lanadi
{
  const l10 = leads.find((l) => l.id === 10);
  if (l10) {
    l10.stock_usage![0].batch_detail = batches[2];
    l10.packaging_usage![0].packaging_detail = packaging[1];
  }
}

const aiSettings: AISettings = {
  id: 1, created_at: ago(200), updated_at: ago(1),
  openai_model: "gpt-4o-mini",
  system_prompt: "Sen EuroFlowers gul do'konining samimiy sotuv yordamchisisan. Narxlarni taxminiy ayt, katta buyurtmalarni operatorga uzat.",
  temperature: 0.7, is_active: true,
};

const integrations: IntegrationSettings = {
  id: 1, created_at: ago(200), updated_at: ago(2),
  instagram_access_token: "IGQ***demo***",
  instagram_account_id: "17800001",
  instagram_business_id: "10203040",
  instagram_verify_token: "ef-verify",
  telegram_bot_token: "7000000000:demo",
  telegram_group_chat_id: "-1001234567890",
  extra: null,
};

const igEvents: InstagramEvent[] = [
  { id: 1, created_at: ago(0, 1), updated_at: ago(0, 1), event_type: "message", sender_id: "17801", recipient_id: "17800001", message_id: "mid.1", text: "101 dona qizil atirgul bormi?", media_id: "", story_id: "", story_url: "", extracted: null, raw_payload: null },
  { id: 2, created_at: ago(0, 3), updated_at: ago(0, 3), event_type: "story_reply", sender_id: "17802", recipient_id: "17800001", message_id: "mid.2", text: "Bu qancha turadi?", media_id: "", story_id: "18101433071220523", story_url: "https://instagram.com/stories/demo", extracted: null, raw_payload: null },
  { id: 3, created_at: ago(0, 6), updated_at: ago(0, 6), event_type: "media_send", sender_id: "17803", recipient_id: "17800001", message_id: "mid.3", text: "", media_id: "18448508641115058", story_id: "", story_url: "", extracted: null, raw_payload: null },
  { id: 4, created_at: ago(1, 2), updated_at: ago(1, 2), event_type: "story_send", sender_id: "17804", recipient_id: "17800001", message_id: "mid.4", text: "", media_id: "", story_id: "18101433071220524", story_url: "", extracted: null, raw_payload: null },
];

// material harakatlari (backend: /api/material-movements/)
const materialMoves = [
  { id: 1, packaging_detail: packaging[0], created_at: ago(0, 4), movement_type: "in", quantity: 50, reason: "Yangi partiya keldi", performed_by_detail: users[3], packaging: 1 },
  { id: 2, packaging_detail: packaging[1], created_at: ago(0, 7), movement_type: "out", quantity: 2, reason: "Lead #10 — sotildi", performed_by_detail: users[1], packaging: 2 },
  { id: 3, packaging_detail: packaging[2], created_at: ago(1, 3), movement_type: "out", quantity: 1, reason: "Katalog: Pastel kompozitsiya", performed_by_detail: null, packaging: 3 },
];

const audit: AuditLog[] = [
  { id: 1, user_detail: users[0], action: "update", entity_type: "catalog", entity_id: "4", before: { status: "available" }, after: { status: "sold" }, created_at: ago(0, 3), user: 1 },
  { id: 2, user_detail: users[3], action: "create", entity_type: "stock_batch", entity_id: "3", before: null, after: { received_stems: 500 }, created_at: ago(0, 6), user: 4 },
  { id: 3, user_detail: users[1], action: "update", entity_type: "lead", entity_id: "4", before: { status: "contacted" }, after: { status: "won" }, created_at: ago(1, 2), user: 2 },
];

// ===== So'rov marshrutlagichi =====

const page = <T,>(results: T[]): Paginated<T> => ({ count: results.length, next: null, previous: null, results });

/** Kichik sun'iy kechikish — loader/gul animatsiyalari ko'rinsin */
const delay = (ms = 400) => new Promise((r) => setTimeout(r, ms));

export async function demoRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  await delay();
  const method = (init.method ?? "GET").toUpperCase();
  const p = path.split("?")[0];
  const body = typeof init.body === "string" ? (JSON.parse(init.body || "{}") as Record<string, unknown>) : {};
  const idOf = (re: RegExp) => Number(p.match(re)?.[1] ?? 0);
  const out = (v: unknown) => v as T;

  // --- yozuvlar: demo rejimda muvaffaqiyatli javob qaytariladi, saqlanmaydi ---
  if (method !== "GET") {
    if (p === "/api/ai/settings/") return out({ ...aiSettings, ...body, updated_at: ago(0) });
    if (p === "/api/integrations/") return out({ ...integrations, ...body, updated_at: ago(0) });
    if (p === "/api/notifications/read_all/") return out({ updated: 0 });
    if (/\/api\/notifications\/\d+\/read\//.test(p)) {
      const n = notifications.find((x) => x.id === idOf(/notifications\/(\d+)/));
      return out({ ...n, is_read: true });
    }
    if (/\/api\/conversations\/\d+\/send\//.test(p)) {
      return out(mkMsg(idOf(/conversations\/(\d+)/), "operator", String(body.text ?? ""), 0, 0));
    }
    if (/\/api\/conversations\/\d+\/simulate\//.test(p)) {
      return out({ reply: "Demo rejim: AI javobi shu yerda ko'rinadi 🌸" });
    }
    if (/\/api\/conversations\/\d+\/(handoff|resume_ai)\//.test(p)) {
      const c = conversations.find((x) => x.id === idOf(/conversations\/(\d+)/)) ?? conversations[0];
      return out({ ...c, status: p.includes("handoff") ? "operator" : "ai" });
    }
    if (/\/api\/catalog\/\d+\/sell\//.test(p)) {
      // qisman sotish: quantity_sold oshadi; hammasi sotilsa status=sold
      const it = catalog.find((x) => x.id === idOf(/catalog\/(\d+)/)) ?? catalog[0];
      const total = it.quantity_total ?? 1;
      const sold = Math.min((it.quantity_sold ?? 0) + (Number(body.quantity) || 1), total);
      return out({ ...it, quantity_sold: sold, status: sold >= total ? "sold" : it.status, sold_at: sold >= total ? ago(0) : it.sold_at });
    }
    if (/\/api\/catalog\/\d+\/deduct_stock\//.test(p)) {
      // quantity berilmasa sotilgan-u yechilmagan hammasi yechiladi
      const it = catalog.find((x) => x.id === idOf(/catalog\/(\d+)/)) ?? catalog[0];
      const sold = it.quantity_sold ?? 0;
      const dedu = Math.min((it.quantity_stock_deducted ?? 0) + (Number(body.quantity) || sold - (it.quantity_stock_deducted ?? 0)), sold);
      return out({ ...it, quantity_stock_deducted: dedu, stock_deducted_at: ago(0) });
    }
    if (/\/api\/stock-batches\/\d+\/movement\//.test(p)) {
      // production kabi: javob — HARAKAT obyekti (partiya emas); partiya mutatsiya qilinadi
      const bt = batches.find((x) => x.id === idOf(/stock-batches\/(\d+)/)) ?? batches[0];
      const qty = Number(body.quantity_stems) || 0;
      const delta = body.movement_type === "in" || body.movement_type === "transfer_in" ? qty : -qty;
      bt.remaining_stems = Math.max(bt.remaining_stems + delta, 0);
      bt.remaining_bunches = Math.floor(bt.remaining_stems / (bt.stems_per_bunch || 10));
      bt.updated_at = ago(0);
      const mv = mkMove(900 + movements.length, bt, body.movement_type as StockMovement["movement_type"], qty, String(body.reason ?? ""), 0, 0);
      movements.unshift(mv);
      return out(mv);
    }
    if (/\/api\/materials\/\d+\/movement\//.test(p)) {
      const m = packaging.find((x) => x.id === idOf(/materials\/(\d+)/)) ?? packaging[0];
      const delta = (body.movement_type === "out" ? -1 : 1) * (Number(body.quantity) || 0);
      return out({ ...m, quantity: Math.max(m.quantity + delta, 0) });
    }
    if (p === "/api/lead-statuses/" && method === "POST") {
      const st: LeadStatusDef = { id: 100 + leadStatuses.length, key: String(body.key ?? "custom"), name_uz: String(body.name_uz ?? ""), name_ru: String(body.name_ru ?? ""), color: String(body.color ?? "#888888"), order: Number(body.order) || 100, is_active: true };
      leadStatuses.push(st);
      return out(st);
    }
    if (/\/api\/lead-statuses\/\d+\//.test(p) && method === "PATCH") {
      const st = leadStatuses.find((x) => x.id === idOf(/lead-statuses\/(\d+)/)) ?? leadStatuses[0];
      Object.assign(st, body);
      return out(st);
    }
    if (/\/api\/lead-statuses\/\d+\//.test(p) && method === "DELETE") {
      const i = leadStatuses.findIndex((x) => x.id === idOf(/lead-statuses\/(\d+)/));
      if (i >= 0) leadStatuses.splice(i, 1);
      return out(undefined);
    }
    if (p === "/api/leads/" && method === "POST") {
      // yangi kontrakt: customer_name/customer_phone bilan mijoz avtomatik yaratiladi
      const c = body.customer
        ? customers.find((x) => x.id === body.customer) ?? customers[0]
        : { ...customers[0], id: 999, name: String(body.customer_name ?? ""), phone: String(body.customer_phone ?? ""), instagram_username: "" };
      const su = Array.isArray(body.stock_usage_input) ? (body.stock_usage_input as { stock_batch: number; quantity_stems: number; quantity_bunches?: string }[]) : [];
      const pu = Array.isArray(body.packaging_usage_input) ? (body.packaging_usage_input as { packaging: number; quantity: number }[]) : [];
      return out({
        ...mkLead(999, c as Customer, "new", String(body.request_uz ?? ""), (body.estimated_price as string) ?? null, (body.arrangement_type as Lead["arrangement_type"]) ?? "", 0, 0),
        source: "manual",
        florist_fee: (body.florist_fee as string) ?? null,
        stock_deducted_at: null,
        stock_usage: su.map((r, i) => ({ id: i + 1, ...r, batch_detail: batches.find((b) => b.id === r.stock_batch) })),
        packaging_usage: pu.map((r, i) => ({ id: i + 1, ...r, packaging_detail: packaging.find((m) => m.id === r.packaging) })),
      });
    }
    if (/\/api\/leads\/\d+\//.test(p) && method === "PATCH") {
      // won bo'lsa backend sklad kamaytiradi — demo'da stock_deducted_at belgilanadi
      const l = leads.find((x) => x.id === idOf(/leads\/(\d+)/)) ?? leads[0];
      const su = Array.isArray(body.stock_usage_input)
        ? (body.stock_usage_input as { stock_batch: number; quantity_stems: number; quantity_bunches?: string }[]).map((r, i) => ({
            id: i + 1, ...r, batch_detail: batches.find((b) => b.id === r.stock_batch),
          }))
        : l.stock_usage;
      const pu = Array.isArray(body.packaging_usage_input)
        ? (body.packaging_usage_input as { packaging: number; quantity: number }[]).map((r, i) => ({
            id: i + 1, ...r, packaging_detail: packaging.find((m) => m.id === r.packaging),
          }))
        : l.packaging_usage;
      // usage inputlardan tashqari BARCHA yuborilgan maydonlar birlashadi
      // (real backend ham yangilangan leadni to'liq qaytaradi)
      const { stock_usage_input: _si, packaging_usage_input: _pi, ...rest } = body;
      const upd: Lead = {
        ...l,
        ...(rest as Partial<Lead>),
        ...(body.status ? { status_detail: statusDetail(String(body.status)) } : {}),
        stock_usage: su,
        packaging_usage: pu,
        stock_deducted_at:
          body.status === "won" && !l.stock_deducted_at && ((su?.length ?? 0) > 0 || (pu?.length ?? 0) > 0)
            ? ago(0)
            : l.stock_deducted_at ?? null,
        updated_at: ago(0),
      };
      Object.assign(l, upd);
      return out(upd);
    }
    if (p === "/api/uploads/") return out({ url: IMG.peony, path: IMG.peony });
    // umumiy yaratish/yangilash: yuborilganini id va sana bilan qaytaramiz
    return out({ id: 999, created_at: ago(0), updated_at: ago(0), ...body });
  }

  // --- o'qishlar ---
  if (p === "/api/me/") return out(users[0]);
  if (p === "/api/dashboard/") return out(dashboard);
  if (p === "/api/branches/") return out(page(branches));
  if (p === "/api/lead-statuses/") return out(page(leadStatuses));
  if (p === "/api/leads/") return out(page(leads));
  if (/\/api\/leads\/\d+\//.test(p)) return out(leads.find((x) => x.id === idOf(/leads\/(\d+)/)) ?? leads[0]);
  if (p === "/api/customers/") return out(page(customers));
  if (/\/api\/customers\/\d+\//.test(p)) return out(customers.find((x) => x.id === idOf(/customers\/(\d+)/)) ?? customers[0]);
  if (p === "/api/flowers/") return out(page(flowers));
  if (p === "/api/flower-variants/") return out(page(variants));
  if (p === "/api/stock-batches/") return out(page(batches));
  if (/\/api\/stock-batches\/\d+\/$/.test(p)) return out(batches.find((x) => x.id === idOf(/stock-batches\/(\d+)/)) ?? batches[0]);
  if (p === "/api/stock-movements/") {
    const query = new URLSearchParams(path.split("?")[1] ?? "");
    const bId = query.get("batch");
    return out(page(bId ? movements.filter((m) => m.batch === +bId) : movements));
  }
  if (p === "/api/catalog/") return out(page(catalog));
  if (p === "/api/social-posts/") return out(page(posts));
  if (p === "/api/conversations/") return out(page(conversations));
  if (/\/api\/conversations\/\d+\//.test(p)) return out(conversations.find((x) => x.id === idOf(/conversations\/(\d+)/)) ?? conversations[0]);
  if (p === "/api/notifications/") {
    const query = new URLSearchParams(path.split("?")[1] ?? "");
    let ns = notifications;
    const tp = query.get("notification_type");
    if (tp) ns = ns.filter((n) => n.notification_type === tp);
    const ir = query.get("is_read");
    if (ir != null && ir !== "") ns = ns.filter((n) => String(n.is_read) === ir);
    return out(page(ns));
  }
  if (p === "/api/users/") return out(page(users));
  if (p === "/api/instagram/status/") return out(instagram);
  if (p === "/api/ai/settings/") return out(aiSettings);
  if (p === "/api/integrations/") return out(integrations);
  if (p === "/api/instagram/events/") return out(page(igEvents));
  if (p === "/api/permissions/") return out(page(fullPerms));
  if (p === "/api/settings/") return out(settings);
  if (p === "/api/packaging/" || p === "/api/materials/") {
    const query = new URLSearchParams(path.split("?")[1] ?? "");
    const tp = query.get("packaging_type");
    return out(page(tp ? packaging.filter((m) => m.packaging_type === tp) : packaging));
  }
  if (p === "/api/material-movements/" || p === "/api/packaging-movements/") return out(page(materialMoves));
  if (p === "/api/audit/") return out(page(audit));

  // noma'lum yo'l — bo'sh ro'yxat
  return out(page([]));
}
