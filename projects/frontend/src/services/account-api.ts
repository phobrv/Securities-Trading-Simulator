import type {
  AccountBalance,
  AccountPosition,
  AvailabilityCheckRequest,
  AvailabilityCheckResult,
} from "@/types/account";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

type DataResponse<T> = { data: T };

export async function fetchAccountBalance(
  accountId: string,
): Promise<AccountBalance> {
  return fetchData<AccountBalance>(`/api/accounts/${encodeURIComponent(accountId)}/balances`);
}

export async function fetchAccountPositions(
  accountId: string,
): Promise<AccountPosition[]> {
  return fetchData<AccountPosition[]>(
    `/api/accounts/${encodeURIComponent(accountId)}/positions`,
  );
}

export async function previewAccountAvailability(
  accountId: string,
  input: AvailabilityCheckRequest,
): Promise<AvailabilityCheckResult> {
  const response = await fetch(
    `${apiBaseUrl}/api/accounts/${encodeURIComponent(accountId)}/availability-checks`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return ((await response.json()) as DataResponse<AvailabilityCheckResult>).data;
}

async function fetchData<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`);

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return ((await response.json()) as DataResponse<T>).data;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: { message?: unknown };
    };
    if (typeof payload.error?.message === "string") {
      return payload.error.message;
    }
  } catch {
    // Dùng thông báo chung khi response không phải JSON lỗi theo hợp đồng API.
  }

  return "Không thể tải dữ liệu tài khoản.";
}
