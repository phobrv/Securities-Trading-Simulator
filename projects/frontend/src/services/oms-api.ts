import type { OmsEvent, OmsOrder, OmsOrderInput, SimulatedEvent } from "@/features/oms/oms.types";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

async function requestData<T>(path: string, body?: OmsOrderInput | SimulatedEvent): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, body ? {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    } : undefined);
  } catch {
    throw new Error("Không kết nối được backend. Hãy kiểm tra kết nối và cấu hình API.");
  }
  if (!response.ok) {
    let message = "Không thể thực hiện yêu cầu OMS.";
    try {
      const error = await response.json() as { error?: { code?: unknown; message?: unknown } };
      if (response.status === 404 && error.error?.code === "NOT_FOUND") {
        message = "API OMS demo chưa bật. Hãy bật OMS_DEMO_ENABLED trên backend.";
      } else if (typeof error.error?.message === "string") {
        message = error.error.message;
      }
    } catch { /* Response không đúng định dạng lỗi API. */ }
    throw new Error(message);
  }
  return ((await response.json()) as { data: T }).data;
}

const orderPath = (id: string): string => `/api/oms-demo/orders/${encodeURIComponent(id)}`;
export const createOmsOrder = (input: OmsOrderInput): Promise<OmsOrder> => requestData("/api/oms-demo/orders", input);
export const fetchOmsOrder = (id: string): Promise<OmsOrder> => requestData(orderPath(id));
export const fetchOmsEvents = (id: string): Promise<OmsEvent[]> => requestData(`${orderPath(id)}/events`);
export const simulateOmsEvent = (id: string, event: SimulatedEvent): Promise<OmsOrder> => requestData(`${orderPath(id)}/simulate`, event);
