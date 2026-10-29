import type { MarginResult } from "@/features/risk/margin.types";

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
export async function simulateMargin(
  scenarioId: string,
  price: number,
  quantity: number,
): Promise<MarginResult> {
  const response = await fetch(`${baseUrl}/api/risk/margin-simulations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      scenarioId,
      order: { securityId: "sec-001", side: "BUY", price, quantity },
    }),
  });
  if (!response.ok)
    throw new Error(
      "Không thể chạy mô phỏng margin; kiểm tra backend và migration.",
    );
  return ((await response.json()) as { data: MarginResult }).data;
}
