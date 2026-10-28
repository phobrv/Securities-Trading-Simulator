import { Router, type Request } from "express";

import { ApplicationError } from "../../errors/application-error.js";
import type { AvailabilityCheckRequest, AvailabilitySide } from "./account.types.js";
import { availabilitySides } from "./account.types.js";
import { AccountService } from "./account.service.js";

export function createAccountRouter(accountService: AccountService): Router {
  const router = Router();

  router.get("/api/accounts/:id/balances", async (request, response) => {
    const balance = await accountService.getBalance(readAccountId(request));

    response.status(200).json({ data: serializeBigInts(balance) });
  });

  router.get("/api/accounts/:id/positions", async (request, response) => {
    const positions = await accountService.getPositions(readAccountId(request));

    response.status(200).json({ data: positions });
  });

  router.post(
    "/api/accounts/:id/availability-checks",
    async (request, response) => {
      const result = await accountService.checkAvailability(
        parseAvailabilityCheckRequest(request),
      );

      response.status(200).json({ data: serializeBigInts(result) });
    },
  );

  return router;
}

function parseAvailabilityCheckRequest(request: Request): AvailabilityCheckRequest {
  const body = request.body;
  if (!isRecord(body)) {
    throw new InvalidAvailabilityCheckInputError(
      "Nội dung request phải là một object JSON.",
    );
  }

  const orderType = readNonEmptyString(body, "orderType");
  if (orderType !== "LO") {
    throw new InvalidAvailabilityCheckInputError("orderType chỉ hỗ trợ LO.");
  }

  return {
    accountId: readAccountId(request),
    securityId: readNonEmptyString(body, "securityId"),
    side: readSide(body),
    orderType,
    price: readPositiveSafeInteger(body, "price"),
    quantity: readPositiveQuantity(body),
  };
}

function readAccountId(request: Request): string {
  const rawAccountId = request.params.id;
  if (typeof rawAccountId !== "string" || !rawAccountId.trim()) {
    throw new InvalidAvailabilityCheckInputError(
      "id tài khoản không được để trống.",
    );
  }

  return rawAccountId.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyString(body: Record<string, unknown>, name: string): string {
  const value = body[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new InvalidAvailabilityCheckInputError(
      `${name} phải là một chuỗi không rỗng.`,
    );
  }

  return value.trim();
}

function readSide(body: Record<string, unknown>): AvailabilitySide {
  const value = body.side;
  if (
    typeof value !== "string" ||
    !(availabilitySides as readonly string[]).includes(value)
  ) {
    throw new InvalidAvailabilityCheckInputError("side không hợp lệ.");
  }

  return value as AvailabilitySide;
}

function readPositiveSafeInteger(
  body: Record<string, unknown>,
  name: string,
): number {
  const value = body[name];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new InvalidAvailabilityCheckInputError(
      `${name} phải là số nguyên dương an toàn.`,
    );
  }

  return value;
}

function readPositiveQuantity(body: Record<string, unknown>): number {
  const quantity = readPositiveSafeInteger(body, "quantity");
  if (quantity > 4_294_967_295) {
    throw new InvalidAvailabilityCheckInputError(
      "quantity vượt phạm vi INT UNSIGNED.",
    );
  }

  return quantity;
}

function serializeBigInts<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item: unknown) =>
      typeof item === "bigint" ? item.toString() : item,
    ),
  ) as T;
}

export class InvalidAvailabilityCheckInputError extends ApplicationError {
  public constructor(message: string) {
    super(400, "INVALID_AVAILABILITY_CHECK_INPUT", message);
  }
}
