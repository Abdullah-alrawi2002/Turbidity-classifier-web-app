import type { Request, Response, NextFunction } from "express";
import { MulterError } from "multer";
import { AppError } from "../types/errors.js";
import type { ErrorResponse } from "../types/turbidity.js";
import { logger } from "../config/logger.js";
import { config } from "../config/index.js";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response<ErrorResponse>,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error("Non-operational error", { error: err });
    }
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }

  if (err instanceof MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE"
        ? `File too large. Maximum size is ${config.MAX_FILE_SIZE_MB} MB.`
        : err.message;
    res.status(400).json({ error: message, code: "VALIDATION_ERROR" });
    return;
  }

  const message = err instanceof Error ? err.message : "Unknown error";
  logger.error("Unhandled error", { error: message });
  res.status(500).json({
    error: config.NODE_ENV === "production" ? "Internal server error" : message,
    code: "INTERNAL_ERROR",
  });
}
