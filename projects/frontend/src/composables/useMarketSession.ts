import { ref } from "vue";

import { fetchMarketSession } from "@/services/market-session-api";
import type { MarketSession } from "@/types/market-session";

const refreshIntervalMs = 5_000;

export function useMarketSession(marketCode: string) {
  const session = ref<MarketSession | null>(null);
  const loading = ref(true);
  const errorMessage = ref<string | null>(null);
  let refreshTimer: ReturnType<typeof setInterval> | null = null;

  async function refresh(): Promise<void> {
    try {
      session.value = await fetchMarketSession(marketCode);
      errorMessage.value = null;
    } catch {
      errorMessage.value = "Không thể tải trạng thái phiên giao dịch.";
    } finally {
      loading.value = false;
    }
  }

  async function start(): Promise<void> {
    loading.value = true;
    await refresh();
    refreshTimer = setInterval(() => void refresh(), refreshIntervalMs);
  }

  function stop(): void {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  return { session, loading, errorMessage, start, stop };
}
