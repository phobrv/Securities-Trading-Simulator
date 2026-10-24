import type { ErrorRequestHandler, RequestHandler } from "express";

import { ApplicationError } from "../errors/application-error.js";

export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Không tìm thấy endpoint.",
    },
  });
};

export const errorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  _next,
) => {
  if (error instanceof ApplicationError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  console.error("Unhandled request error.", error);

  response.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "Đã xảy ra lỗi không mong muốn.",
    },
  });
};
