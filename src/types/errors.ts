export type ErrorCode =
  | "VALIDATION_ERROR"
  | "INFERENCE_FAILED"
  | "IMAGE_PROCESSING_FAILED"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: ErrorCode,
    isOperational = true,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static validation(message: string): AppError {
    return new AppError(message, 400, "VALIDATION_ERROR");
  }

  static inferenceFailed(detail: string): AppError {
    return new AppError(`Inference failed: ${detail}`, 500, "INFERENCE_FAILED");
  }

  static imageProcessing(detail: string): AppError {
    return new AppError(`Image processing failed: ${detail}`, 422, "IMAGE_PROCESSING_FAILED");
  }
}
