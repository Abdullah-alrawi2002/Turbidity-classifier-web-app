import multer from "multer";
import { z } from "zod";
import type { Request, Response, NextFunction } from "express";
import { config } from "../config/index.js";
import { AppError } from "../types/errors.js";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/bmp",
  "image/tiff",
]);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.MAX_FILE_SIZE_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(AppError.validation(
        `Unsupported image type "${file.mimetype}". Accepted: ${[...ALLOWED_MIME_TYPES].join(", ")}`,
      ));
    }
  },
});

export const base64ImageSchema = z.object({
  image: z
    .string()
    .min(1, "Base64 image string must not be empty")
    .refine(
      (s) => {
        const raw = s.includes(",") ? s.split(",")[1]! : s;
        return raw.length > 0 && /^[A-Za-z0-9+/=]+$/.test(raw);
      },
      { message: "Invalid base64-encoded image data" },
    ),
});

export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
      next(AppError.validation(message));
      return;
    }
    (req as Request & { validatedBody: T }).validatedBody = result.data;
    next();
  };
}
