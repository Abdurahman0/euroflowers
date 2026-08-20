"use client";
import { HugeiconsIcon } from "@hugeicons/react";
import { Sparkles } from "lucide-react";
import {
  Analytics01Icon,
  ApiIcon,
  ArrowDown01Icon,
  Bookmark02Icon,
  Calculator01Icon,
  ClipboardClockIcon,
  DeliveryTruck01Icon,
  Scissor01Icon,
  FlowerPotIcon,
  Attachment01Icon,
  BubbleChatIcon,
  Copy01Icon,
  DashboardSquare01Icon,
  FlowerIcon,
  Image01Icon,
  LockPasswordIcon,
  Logout03Icon,
  Mail01Icon,
  Moon02Icon,
  Notification03Icon,
  PackageIcon,
  PackageAddIcon,
  PaintBoardIcon,
  Search01Icon,
  SentIcon,
  Settings01Icon,
  ShoppingBag01Icon,
  SidebarLeftIcon,
  SmileIcon,
  Sun03Icon,
  UserCircleIcon,
  UserGroupIcon,
  UserGroup03Icon,
  ViewIcon,
  ViewOffIcon,
  VolumeHighIcon,
  VolumeOffIcon,
  MoneySend01Icon,
  MoneyReceive01Icon,
  Store01Icon,
} from "@hugeicons/core-free-icons";

/**
 * Yagona premium ikonka oilasi — Hugeicons.
 * Bir xil o'lcham, bir xil chiziq qalinligi (1.5) — Apple/Linear darajasidagi izchillik.
 * `Icon name=...` API'si saqlangan: iste'molchilarga tegilmaydi.
 */
const ICONS: Record<string, typeof FlowerIcon> = {
  dashboard: DashboardSquare01Icon,
  analitika: Analytics01Icon,
  hisob: Calculator01Icon,
  chat: BubbleChatIcon,
  crm: ShoppingBag01Icon, // Buyurtmalar
  bronlar: Bookmark02Icon, // Bronlar (zaklad)
  mijozlar: UserGroupIcon,
  sklad: PackageIcon,
  suppliers: DeliveryTruck01Icon,
  floristlar: Scissor01Icon,
  floristStock: PackageAddIcon,
  // ⚠️ Filial hisoboti — ilgari yetkazib beruvchilar bilan BIR XIL yuk mashinasi edi;
  //    ikki xil bo'lim bir xil ikonka bilan turardi.
  branchReport: Store01Icon,
  katalog: FlowerIcon,
  gullar: FlowerPotIcon,
  // ⚠️ Bu ikkisi ILGARI IKONKASIZ edi (ICONS'da kaliti yo'q → Icon null qaytarardi):
  //    yon menyuda «Rasxodlar» va «Qarzdorlar» yorliqlari bo'sh joydan boshlanardi.
  rasxodlar: MoneySend01Icon,   // pul CHIQIMI
  qarzdorlar: MoneyReceive01Icon, // olinadigan pul
  bildirishnomalar: Notification03Icon,
  postlar: Image01Icon,
  xodimlar: UserGroup03Icon,
  integratsiyalar: ApiIcon,
  audit: ClipboardClockIcon,
  sozlamalar: Settings01Icon,
  bell: Notification03Icon,
  palette: PaintBoardIcon,
  menu: SidebarLeftIcon,
  search: Search01Icon,
  send: SentIcon,
  logo: FlowerIcon,
  // profil menyusi va chat uchun
  user: UserCircleIcon,
  logout: Logout03Icon,
  chevron: ArrowDown01Icon,
  attachment: Attachment01Icon,
  copy: Copy01Icon,
  smile: SmileIcon,
  sun: Sun03Icon,
  moon: Moon02Icon,
  mail: Mail01Icon,
  lock: LockPasswordIcon,
  eye: ViewIcon,
  eyeOff: ViewOffIcon,
  volumeOn: VolumeHighIcon,
  volumeOff: VolumeOffIcon,
};

export function Icon({ name, size = 17 }: { name: string; size?: number }) {
  // AI bo'limi — spets-talab: lucide Sparkles
  if (name === "ai" || name === "aiCatalog") return <Sparkles size={size} strokeWidth={1.75} className="block shrink-0" aria-hidden />;
  const icon = ICONS[name];
  if (!icon) return null;
  return <HugeiconsIcon icon={icon} size={size} strokeWidth={1.5} color="currentColor" className="block shrink-0" aria-hidden />;
}
