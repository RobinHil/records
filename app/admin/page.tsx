import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import AdminDashboard from "@/components/admin/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await requireAdmin())) redirect("/admin/login");
  return <AdminDashboard />;
}
