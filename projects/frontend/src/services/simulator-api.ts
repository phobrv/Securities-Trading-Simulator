import type {
  OrderBookSnapshot,
  SimulatorExecution,
} from "@/types/simulator";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

type DataResponse<T> = { data: T };

export async function fetchOrderBook(
  securityId: string,
): Promise<OrderBookSnapshot> {
  return fetchData<OrderBookSnapshot>(
    `/api/simulator/order-books/${encodeURIComponent(securityId)}`,
  );
}

export async function fetchExecutions(
  securityId: string,
): Promise<SimulatorExecution[]> {
  return fetchData<SimulatorExecution[]>(
    `/api/simulator/executions?securityId=${encodeURIComponent(securityId)}`,
  );
}

async function fetchData<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`);
  if (!response.ok) {
    throw new Error("Không thể tải dữ liệu Matching Simulator.");
  }

  return ((await response.json()) as DataResponse<T>).data;
}
