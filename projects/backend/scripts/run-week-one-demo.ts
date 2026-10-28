const apiUrl = process.env.SIMULATOR_API_URL ?? "http://localhost:3000";

type ApiResponse<T> = { data: T };

async function main(): Promise<void> {
  await get("/health/live");
  await get("/health/ready");
  const security = await get<{ id: string; marketCode: string; tradingStatus: string }>(
    "/api/securities/sec-001",
  );
  const session = await get<{ state: string; allowedOrderTypes: string[] }>(
    "/api/markets/SIM_EQ_A/session",
  );
  assert(security.marketCode === "SIM_EQ_A", "sec-001 không thuộc SIM_EQ_A.");
  assert(security.tradingStatus === "TRADABLE", "sec-001 không ở trạng thái TRADABLE.");
  assert(session.state === "CONTINUOUS", "Phiên demo không phải CONTINUOUS.");
  assert(session.allowedOrderTypes.includes("LO"), "Phiên demo không nhận LO.");

  const balances = await get<{ availableCash: string }>("/api/accounts/acc-001/balances");
  const positions = await get<Array<{ securityId: string; availableQuantity: number }>>(
    "/api/accounts/acc-001/positions",
  );
  assert(balances.availableCash === "6000000", "availableCash fixture không đúng.");
  assert(
    positions.some((position) => position.securityId === "sec-001" && position.availableQuantity === 550),
    "availableQuantity của sec-001 không đúng.",
  );
  const buyCheck = await post<{ valid: boolean; requiredCash: string }>(
    "/api/accounts/acc-001/availability-checks",
    { securityId: "sec-001", side: "BUY", orderType: "LO", price: 25_000, quantity: 100 },
  );
  const sellCheck = await post<{ valid: boolean; reasonCode?: string; shortfallQuantity?: number }>(
    "/api/accounts/acc-001/availability-checks",
    { securityId: "sec-001", side: "SELL", orderType: "LO", price: 25_000, quantity: 600 },
  );
  assert(buyCheck.valid && buyCheck.requiredCash === "2500000", "Kiểm tra BUY 100@25000 phải hợp lệ.");
  assert(!sellCheck.valid && sellCheck.reasonCode === "INSUFFICIENT_SECURITIES" && sellCheck.shortfallQuantity === 50,
    "Kiểm tra SELL 600 phải từ chối, thiếu 50.");

  const initialBook = await get<{ bids: unknown[]; asks: unknown[] }>(
    "/api/simulator/order-books/sec-001",
  );
  const initialExecutions = await get<unknown[]>("/api/simulator/executions?securityId=sec-001");
  assert(initialBook.bids.length === 0 && initialBook.asks.length === 0 && initialExecutions.length === 0,
    "Simulator không rỗng. Hãy khởi động lại backend với phiên demo sạch trước khi chạy script.");

  await post("/api/simulator/orders", order("S1", "SELL", 24_900, 40));
  await post("/api/simulator/orders", order("S2", "SELL", 25_000, 100));
  await post("/api/simulator/orders", order("S3", "SELL", 25_100, 50));
  const result = await post<{ executions: Array<{ price: number; quantity: number }> }>(
    "/api/simulator/orders",
    order("B1", "BUY", 25_000, 100),
  );
  assert(JSON.stringify(result.executions.map(({ price, quantity }) => ({ price, quantity }))) ===
    JSON.stringify([{ price: 24_900, quantity: 40 }, { price: 25_000, quantity: 60 }]),
    "Executions không đúng kịch bản.");

  const quote = await waitForQuote();
  assert(quote.totalVolume === 100 && quote.totalValue === 2_496_000 && quote.lastPrice === 25_000 && quote.lastQuantity === 60,
    "Snapshot Market Data không đúng tổng khớp.");
  assert(quote.openPrice === 24_900 && quote.highPrice === 25_000 && quote.lowPrice === 24_900,
    "OHLC của snapshot không đúng.");
  assert(quote.bestBid === null && quote.bestAsk?.price === 25_000 && quote.bestAsk.quantity === 40,
    "Best bid/ask không phản ánh sổ sau khớp.");
  const remainingBook = await get<{
    asks: Array<{ price: number; quantity: number; orderCount: number }>;
  }>(
    "/api/simulator/order-books/sec-001",
  );
  assert(JSON.stringify(remainingBook.asks) === JSON.stringify([
    { price: 25_000, quantity: 40, orderCount: 1 },
    { price: 25_100, quantity: 50, orderCount: 1 },
  ]), "Sổ sau khớp không đúng.");
  const finalBalance = await get<{ availableCash: string }>("/api/accounts/acc-001/balances");
  const finalPositions = await get<Array<{ securityId: string; availableQuantity: number }>>(
    "/api/accounts/acc-001/positions",
  );
  assert(finalBalance.availableCash === balances.availableCash &&
    finalPositions.some((position) => position.securityId === "sec-001" && position.availableQuantity === 550),
    "Matching không được thay đổi fixture tài sản tuần 1.");
  console.info("Demo tuần 1 thành công: 2 executions, volume 100, value 2.496.000.");
}

async function waitForQuote(): Promise<{
  totalVolume: number;
  totalValue: number;
  lastPrice: number | null;
  lastQuantity: number | null;
  openPrice: number | null;
  highPrice: number | null;
  lowPrice: number | null;
  bestBid: unknown;
  bestAsk: { price: number; quantity: number } | null;
}> {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const quotes = await get<Array<{
      totalVolume: number;
      totalValue: number;
      lastPrice: number | null;
      lastQuantity: number | null;
      openPrice: number | null;
      highPrice: number | null;
      lowPrice: number | null;
      bestBid: unknown;
      bestAsk: { price: number; quantity: number } | null;
    }>>("/api/market-data/quotes?securityIds=sec-001");
    const quote = quotes[0];
    if (quote?.totalVolume === 100) return quote;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Hết thời gian chờ snapshot Market Data.");
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`);
  if (!response.ok) throw new Error(`${path} trả HTTP ${response.status}.`);
  return ((await response.json()) as ApiResponse<T>).data;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`${path} trả HTTP ${response.status}.`);
  return ((await response.json()) as ApiResponse<T>).data;
}

function order(clientOrderId: string, side: "BUY" | "SELL", price: number, quantity: number) {
  return { clientOrderId, securityId: "sec-001", side, orderType: "LO", price, quantity };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
