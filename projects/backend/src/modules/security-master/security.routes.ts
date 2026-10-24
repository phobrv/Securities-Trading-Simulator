import { Router, type Request } from "express";

import {
  InvalidSecurityFilterError,
  type SecurityService,
} from "./security.service.js";
import {
  securityTypes,
  tradingStatuses,
  type SecurityFilters,
  type SecurityType,
  type TradingStatus,
} from "./security.types.js";

export function createSecurityRouter(securityService: SecurityService): Router {
  const router = Router();

  router.get("/api/securities", async (request, response) => {
    const filters = parseSecurityFilters(request);
    const securities = await securityService.listSecurities(filters);

    response.status(200).json({
      data: securities,
      meta: {
        count: securities.length,
        simulation: true,
      },
    });
  });

  router.get("/api/securities/:id", async (request, response) => {
    const security = await securityService.getSecurity(request.params.id);

    response.status(200).json({ data: security });
  });

  return router;
}

function parseSecurityFilters(request: Request): SecurityFilters {
  const type = parseEnumFilter(
    readQueryValue(request, "type"),
    securityTypes,
    "type",
  );
  const status = parseEnumFilter(
    readQueryValue(request, "status"),
    tradingStatuses,
    "status",
  );
  const marketCode = normalizeCodeFilter(readQueryValue(request, "marketCode"));
  const symbol = normalizeCodeFilter(readQueryValue(request, "symbol"));

  return { type, status, marketCode, symbol };
}

function readQueryValue(request: Request, name: string): string | undefined {
  const value = request.query[name];

  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new InvalidSecurityFilterError(`Bộ lọc ${name} phải có một giá trị.`);
  }

  return value;
}

function parseEnumFilter<T extends readonly string[]>(
  value: string | undefined,
  allowedValues: T,
  name: string,
): T[number] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!allowedValues.includes(value)) {
    throw new InvalidSecurityFilterError(`Bộ lọc ${name} không hợp lệ.`);
  }

  return value;
}

function normalizeCodeFilter(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalizedValue = value.trim().toUpperCase();
  if (!normalizedValue) {
    throw new InvalidSecurityFilterError("Mã chứng khoán không được để trống.");
  }

  return normalizedValue;
}
