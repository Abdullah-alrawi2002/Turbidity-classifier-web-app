import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { upload, base64ImageSchema } from "../middleware/validation.js";
import { preprocessImage } from "../services/preprocessing.js";
import { predict } from "../services/classifier.js";
import { AppError } from "../types/errors.js";

export const predictRouter = Router();

predictRouter.post(
  "/",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const imageBuffer = await resolveImageBuffer(req, next);
      if (!imageBuffer) return;

      const tensor = await preprocessImage(imageBuffer);
      const result = predict(tensor);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

async function resolveImageBuffer(
  req: Request,
  next: NextFunction,
): Promise<Buffer | null> {
  const contentType = req.headers["content-type"] ?? "";

  if (contentType.includes("multipart/form-data")) {
    return new Promise<Buffer | null>((resolve) => {
      upload.single("image")(req, req.res!, (err?: unknown) => {
        if (err) {
          next(err);
          resolve(null);
          return;
        }
        if (!req.file?.buffer) {
          next(AppError.validation("No image file provided in form data."));
          resolve(null);
          return;
        }
        resolve(req.file.buffer);
      });
    });
  }

  if (contentType.includes("application/json")) {
    const parsed = base64ImageSchema.safeParse(req.body);
    if (!parsed.success) {
      next(AppError.validation(parsed.error.issues.map((e) => e.message).join("; ")));
      return null;
    }
    const raw = parsed.data.image.includes(",")
      ? parsed.data.image.split(",")[1]!
      : parsed.data.image;
    return Buffer.from(raw, "base64");
  }

  next(AppError.validation("Unsupported Content-Type. Use multipart/form-data or application/json."));
  return null;
}
