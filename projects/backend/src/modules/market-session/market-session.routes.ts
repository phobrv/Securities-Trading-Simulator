import { Router, type Request } from "express";

import { ApplicationError } from "../../errors/application-error.js";

import type { MarketSessionService } from "./market-session.service.js";
import type { OrderSessionValidator } from "./order-session-validator.js";
import {
  orderSides,
  orderTypes,
  type OrderSide,
  type OrderType,
  type SessionOrderValidationRequest,
} from "./market-session.types.js";

export function createMarketSessionRouter(
  marketSessionService: MarketSessionService,
  orderSessionValidator: OrderSessionValidator,
): Router {
  const router = Router();

  router.get("/api/markets/:marketCode/session", (request, response) => {
    const session = marketSessionService.getCurrentSession(
      request.params.marketCode,
    );
    response.status(200).json({ data: toSessionResponse(session) });
  });

  router.post("/api/order-validations/session", async (request, response) => {
    const orderRequest = parseOrderValidationRequest(request);
    const validation = await orderSessionValidator.validate(orderRequest);

    response.status(200).json({ data: validation });
  });

  return router;
}

function parseOrderValidationRequest(
  request: Request,
): SessionOrderValidationRequest {
  const body = request.body;
  if (!isRecord(body)) {
    throw new InvalidOrderValidationRequestError(
      "Nội dung request phải là một object JSON.",
    );
  }

  const securityId = readNonEmptyString(body, "securityId");
  const side = readEnum(body, "side", orderSides);
  const orderType = readEnum(body, "orderType", orderTypes);
  const quantity = readPositiveInteger(body, "quantity");
  const hasPrice = Object.hasOwn(body, "price");

  if (orderType === "LO" && !hasPrice) {
    throw new InvalidOrderValidationRequestError(
      "Lệnh LO phải có price là số nguyên dương.",
    );
  }
  if (orderType !== "LO" && hasPrice) {
    throw new InvalidOrderValidationRequestError(
      "Lệnh ATO hoặc ATC không được gửi price.",
    );
  }

  return {
    securityId,
    side,
    orderType,
    quantity,
    ...(hasPrice ? { price: readPositiveInteger(body, "price") } : {}),
  };
}

function toSessionResponse(
  session: ReturnType<MarketSessionService["getCurrentSession"]>,
) {
  const { isTradingDay: _isTradingDay, ...response } = session;
  return response;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyString(
  body: Record<string, unknown>,
  name: string,
): string {
  const value = body[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new InvalidOrderValidationRequestError(
      `${name} phải là một chuỗi không rỗng.`,
    );
  }

  return value.trim();
}

function readEnum<T extends readonly string[]>(
  body: Record<string, unknown>,
  name: string,
  allowedValues: T,
): T[number] {
  const value = body[name];
  if (typeof value !== "string" || !allowedValues.includes(value)) {
    throw new InvalidOrderValidationRequestError(`${name} không hợp lệ.`);
  }

  return value;
}

function readPositiveInteger(
  body: Record<string, unknown>,
  name: string,
): number {
  const value = body[name];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new InvalidOrderValidationRequestError(
      `${name} phải là số nguyên dương.`,
    );
  }

  return value;
}

export class InvalidOrderValidationRequestError extends ApplicationError {
  public constructor(message: string) {
    super(400, "INVALID_ORDER_VALIDATION_REQUEST", message);
  }
}
