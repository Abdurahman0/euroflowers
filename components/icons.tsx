"use client";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  Attachment01Icon,
  BubbleChatIcon,
  Copy01Icon,
  DashboardSquare01Icon,
  FlowerIcon,
  Image01Icon,
  Logout03Icon,
  Moon02Icon,
  Notification03Icon,
  PackageIcon,
  PaintBoardIcon,
  Search01Icon,
  SentIcon,
  Settings01Icon,
  SidebarLeftIcon,
  SmileIcon,
  Sun03Icon,
  UserCircleIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";

/**
 * Yagona premium ikonka oilasi — Hugeicons.
 * Bir xil o'lcham, bir xil chiziq qalinligi (1.5) — Apple/Linear darajasidagi izchillik.
 * `Icon name=...` API'si saqlangan: iste'molchilarga tegilmaydi.
 */
const ICONS: Record<string, typeof FlowerIcon> = {
  dashboard: DashboardSquare01Icon,
  chat: BubbleChatIcon,
  crm: UserGroupIcon,
  sklad: PackageIcon,
  katalog: FlowerIcon,
  postlar: Image01Icon,
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
};

export function Icon({ name, size = 17 }: { name: string; size?: number }) {
  const icon = ICONS[name];
  if (!icon) return null;
  return <HugeiconsIcon icon={icon} size={size} strokeWidth={1.5} color="currentColor" className="block shrink-0" aria-hidden />;
}
