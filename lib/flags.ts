/**
 * Funksiya bayroqlari — build vaqtida NEXT_PUBLIC_* dan o'qiladi.
 *
 * ENABLE_3D — 3D piyon va 3D fon qatlamlari (three.js kanvaslari).
 * Sukutda O'CHIQ: statik/CSS versiya tezroq va foydalanuvchi afzal ko'rgan
 * ko'rinish. Qayta yoqish: .env'da NEXT_PUBLIC_ENABLE_3D=1.
 * Bayroq o'chiq bo'lsa three.js chunklari umuman yuklab olinmaydi
 * (dynamic import faqat render bo'lganda fetch qilinadi).
 */
export const ENABLE_3D = process.env.NEXT_PUBLIC_ENABLE_3D === "1";
