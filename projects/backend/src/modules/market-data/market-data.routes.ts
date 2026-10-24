import { Router, type Request } from "express";

import {
  InvalidQuoteQueryError,
  type MarketDataService,
} from "./market-data.service.js";

export function createMarketDataRouter(
  marketDataService: MarketDataService,
): Router {
  const router = Router();

  router.get("/api/market-data/quotes", async (request, response) => {
    const securityIds = parseSecurityIds(request);
    const result = await marketDataService.getQuotes(securityIds);

    response.status(200).json(result);
  });

  return router;
}

function parseSecurityIds(request: Request): string[] {
  const value = request.query.securityIds;

  if (typeof value !== "string") {
    throw new InvalidQuoteQueryError(
      "securityIds phải là một chuỗi mã phân tách bằng dấu phẩy.",
    );
  }

  const securityIds = value.split(",").map((securityId) => securityId.trim());
  const hasInvalidId = securityIds.some(
    (securityId) => !/^sec-[a-zA-Z0-9_-]+$/.test(securityId),
  );

  if (securityIds.length === 0 || hasInvalidId) {
    throw new InvalidQuoteQueryError(
      "securityIds phải chứa ít nhất một mã hợp lệ.",
    );
  }
  if (new Set(securityIds).size !== securityIds.length) {
    throw new InvalidQuoteQueryError(
      "securityIds không được chứa mã trùng lặp.",
    );
  }

  return securityIds;
}
