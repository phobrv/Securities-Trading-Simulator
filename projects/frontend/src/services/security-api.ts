import type { Security } from "@/types/market-data";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

type SecurityListResponse = {
  data: Security[];
};

export async function fetchSecurities(): Promise<Security[]> {
  const response = await fetch(`${apiBaseUrl}/api/securities`);

  if (!response.ok) {
    throw new Error("Không thể tải danh mục chứng khoán.");
  }

  const payload = (await response.json()) as SecurityListResponse;

  return payload.data;
}
