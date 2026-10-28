import { ref } from "vue";

import { fetchExecutions, fetchOrderBook } from "@/services/simulator-api";
import type { OrderBookSnapshot, SimulatorExecution } from "@/types/simulator";

const refreshIntervalMs = 2_000;

export function useSimulatorOverview(securityId: string) {
  const orderBook = ref<OrderBookSnapshot | null>(null);
  const executions = ref<SimulatorExecution[]>([]);
  const loading = ref(true);
  const errorMessage = ref<string | null>(null);
  let refreshTimer: ReturnType<typeof setInterval> | null = null;

  async function refresh(): Promise<void> {
    try {
      const [nextOrderBook, nextExecutions] = await Promise.all([
        fetchOrderBook(securityId),
        fetchExecutions(securityId),
      ]);
      orderBook.value = nextOrderBook;
      executions.value = nextExecutions;
      errorMessage.value = null;
    } catch (error) {
      errorMessage.value =
        error instanceof Error
          ? error.message
          : "Không thể tải dữ liệu Matching Simulator.";
    } finally {
      loading.value = false;
    }
  }

  function start(): void {
    loading.value = true;
    void refresh();
    refreshTimer = setInterval(() => void refresh(), refreshIntervalMs);
  }

  function stop(): void {
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  }

  return { orderBook, executions, loading, errorMessage, start, stop, refresh };
}
