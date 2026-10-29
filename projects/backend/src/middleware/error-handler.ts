import type { ErrorRequestHandler, RequestHandler } from "express";

import { ApplicationError } from "../errors/application-error.js";
import { isInfrastructureUnavailable } from "../errors/infrastructure-error.js";

export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Không tìm thấy endpoint.",
    },
    ...(response.locals.requestId ? { requestId: response.locals.requestId } : {}),
  });
};

export const errorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  _next,
) => {
  if (error instanceof SyntaxError && "status" in error && error.status === 400) {
    if (response.locals.requestId) {
      response.status(400).json({ error: { code: "INVALID_REQUEST", message: "JSON không hợp lệ." }, requestId: response.locals.requestId });
      return;
    }
    response.status(400).json({ error: { code: "INVALID_JSON", message: "JSON không hợp lệ." } });
    return;
  }
  if (error instanceof ApplicationError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
      ...(response.locals.requestId ? { requestId: response.locals.requestId } : {}),
    });
    return;
  }

  if (response.locals.requestId && isInfrastructureUnavailable(error)) {
    response.status(503).json({ error: { code: "SERVICE_UNAVAILABLE", message: "Hạ tầng chưa sẵn sàng; hãy thử lại cùng khóa." }, requestId: response.locals.requestId });
    return;
  }

  console.error("Unhandled request error.", error);

  response.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Đã xảy ra lỗi không mong muốn.",
    },
    ...(response.locals.requestId ? { requestId: response.locals.requestId } : {}),
  });
};
