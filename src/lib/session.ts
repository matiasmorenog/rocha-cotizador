import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function requireCustomerSession() {
  const session = await auth();
  if (!session?.user || session.user.role !== "CUSTOMER" || !session.user.customerId) {
    redirect("/login");
  }
  return session;
}

export async function requireAdminSession() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/admin/login");
  }
  return session;
}

export async function getOptionalSession() {
  return auth();
}
