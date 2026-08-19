import { redirect } from "next/navigation";

export default async function AdminMermasRedirect({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const params = new URLSearchParams({ tab: "elaborados" });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  redirect(`/admin/stock?${params}`);
}
