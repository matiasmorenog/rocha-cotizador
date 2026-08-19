"use server";

export async function fetchBlueDollarRate(): Promise<number | null> {
  try {
    const res = await fetch("https://api.bluelytics.com.ar/v2/latest", {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { blue?: { value_sell?: number } };
    const rate = data?.blue?.value_sell;
    return typeof rate === "number" ? rate : null;
  } catch {
    return null;
  }
}
