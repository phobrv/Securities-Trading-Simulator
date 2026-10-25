import type { MarketSession } from "@/types/market-session";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

type MarketSessionResponse = {
  data: MarketSession;
};

export async function fetchMarketSession(
  marketCode: string,
): Promise<MarketSession> {
  const response = await fetch(
    `${apiBaseUrl}/api/markets/${encodeURIComponent(marketCode)}/session`,
  );
  if (!response.ok) {
    throw new Error("Không thể tải trạng thái phiên giao dịch.");
  }

  const payload = (await response.json()) as MarketSessionResponse;
  return payload.data;
}
