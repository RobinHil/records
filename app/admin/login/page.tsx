import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import LoginForm from "@/components/admin/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await requireAdmin()) redirect("/admin");
  return <LoginForm />;
}
