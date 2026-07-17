import { redirect } from "next/navigation";

/** Dashboard ildizda yashaydi — eski /dashboard havolalari 404 bermasin. */
export default function DashboardRedirect() {
  redirect("/");
}
