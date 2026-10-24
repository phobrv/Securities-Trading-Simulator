import { ref } from "vue";

import { fetchSecurities } from "@/services/security-api";
import type {
  MarketDataConnectionState,
  QuoteSnapshot,
  QuotesById,
  Security,
} from "@/types/market-data";

const reconnectDelayMs = 2_000;

export function useMarketData() {
  const securities = ref<Security[]>([]);
  const quotesById = ref<QuotesById>({});
  const connectionState = ref<MarketDataConnectionState>("connecting");
  const loading = ref(true);
  const errorMessage = ref<string | null>(null);
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let isStopped = false;

  async function start(): Promise<void> {
    isStopped = false;
    loading.value = true;
    errorMessage.value = null;

    try {
      securities.value = await fetchSecurities();
      connect();
    } catch {
      connectionState.value = "unavailable";
      errorMessage.value = "Không thể tải danh mục chứng khoán từ backend.";
    } finally {
      loading.value = false;
    }
  }

  function stop(): void {
    isStopped = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    socket?.close();
    socket = null;
  }

  function connect(): void {
    if (isStopped || securities.value.length === 0) {
      return;
    }

    connectionState.value = "connecting";
    socket = new WebSocket(getMarketDataWebSocketUrl());
    socket.addEventListener("open", () => {
      connectionState.value = "connected";
      socket?.send(
        JSON.stringify({
          type: "subscribe",
          securityIds: securities.value.map((security) => security.id),
        }),
      );
    });
    socket.addEventListener("message", (event) => {
      const quote = parseQuoteSnapshot(event.data);
      if (!quote) {
        return;
      }

      quotesById.value = {
        ...quotesById.value,
        [quote.securityId]: quote,
      };
    });
    socket.addEventListener("error", () => {
      connectionState.value = "unavailable";
    });
    socket.addEventListener("close", () => {
      if (isStopped) {
        return;
      }

      connectionState.value = "disconnected";
      reconnectTimer = setTimeout(() => connect(), reconnectDelayMs);
    });
  }

  return {
    securities,
    quotesById,
    connectionState,
    loading,
    errorMessage,
    start,
    stop,
  };
}

function getMarketDataWebSocketUrl(): string {
  const configuredUrl = import.meta.env.VITE_MARKET_DATA_WS_URL;
  if (configuredUrl) {
    return configuredUrl;
  }

  const apiUrl = new URL(
    import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000",
  );
  apiUrl.protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
  apiUrl.pathname = "/ws/market-data";
  apiUrl.search = "";

  return apiUrl.toString();
}

function parseQuoteSnapshot(value: unknown): QuoteSnapshot | null {
  if (typeof value !== "string") {
    return null;
  }

  try {
    const message: unknown = JSON.parse(value);
    if (
      !message ||
      typeof message !== "object" ||
      (message as { type?: unknown }).type !== "quote.snapshot"
    ) {
      return null;
    }

    const quote = (message as { data?: unknown }).data;
    if (
      !quote ||
      typeof quote !== "object" ||
      typeof (quote as { securityId?: unknown }).securityId !== "string"
    ) {
      return null;
    }

    return quote as QuoteSnapshot;
  } catch {
    return null;
  }
}
