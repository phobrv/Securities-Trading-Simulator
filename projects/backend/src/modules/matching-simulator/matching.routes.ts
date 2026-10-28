import { Router, type Request } from "express";

import { ApplicationError } from "../../errors/application-error.js";
import {
  MatchingService,
  UnsupportedOrderTypeError,
  type SubmitSimulatorOrderRequest,
} from "./matching.service.js";
import {
  simulatorOrderSides,
  type SimulatorOrderSide,
} from "./matching.types.js";

export function createMatchingSimulatorRouter(
  matchingService: MatchingService,
): Router {
  const router = Router();

  router.post("/api/simulator/orders", async (request, response) => {
    const order = parseSimulatorOrderRequest(request);
    const result = await matchingService.submitOrder(order);
    response.status(201).json({ data: result });
  });

  router.get("/api/simulator/order-books/:securityId", async (request, response) => {
    const orderBook = await matchingService.getOrderBook(request.params.securityId);
    response.status(200).json({ data: orderBook });
  });

  router.get("/api/simulator/executions", async (request, response) => {
    const securityId = readQuerySecurityId(request);
    const executions = await matchingService.getExecutions(securityId);
    response.status(200).json({ data: executions });
  });

  return router;
}

function parseSimulatorOrderRequest(request: Request): SubmitSimulatorOrderRequest {
  const body = request.body;
  if (!isRecord(body)) {
    throw new InvalidOrderInputError("Nội dung request phải là một object JSON.");
  }

  const orderType = readNonEmptyString(body, "orderType");
  if (orderType !== "LO") {
    throw new UnsupportedOrderTypeError();
  }

  return {
    clientOrderId: readNonEmptyString(body, "clientOrderId"),
    securityId: readNonEmptyString(body, "securityId"),
    side: readSide(body),
    orderType,
    price: readPositiveSafeInteger(body, "price"),
    quantity: readPositiveSafeInteger(body, "quantity"),
  };
}

function readQuerySecurityId(request: Request): string {
  const { securityId } = request.query;
  if (typeof securityId !== "string" || !securityId.trim()) {
    throw new InvalidOrderInputError(
      "securityId phải là một query parameter không rỗng.",
    );
  }

  return securityId.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyString(body: Record<string, unknown>, name: string): string {
  const value = body[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new InvalidOrderInputError(`${name} phải là một chuỗi không rỗng.`);
  }

  return value.trim();
}

function readSide(body: Record<string, unknown>): SimulatorOrderSide {
  const value = body.side;
  if (
    typeof value !== "string" ||
    !(simulatorOrderSides as readonly string[]).includes(value)
  ) {
    throw new InvalidOrderInputError("side không hợp lệ.");
  }

  return value as SimulatorOrderSide;
}

function readPositiveSafeInteger(
  body: Record<string, unknown>,
  name: string,
): number {
  const value = body[name];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new InvalidOrderInputError(`${name} phải là số nguyên dương an toàn.`);
  }

  return value;
}

export class InvalidOrderInputError extends ApplicationError {
  public constructor(message: string) {
    super(400, "INVALID_ORDER_INPUT", message);
  }
}
