import sharp from "sharp";
import { AppError } from "../types/errors.js";

const TARGET_SIZE = 224;
const RESIZE_SIZE = 256;
const IMAGENET_MEAN = [0.485, 0.456, 0.406] as const;
const IMAGENET_STD = [0.229, 0.224, 0.225] as const;

export interface PreprocessedImage {
  readonly data: Float32Array;
  readonly channels: 3;
  readonly height: typeof TARGET_SIZE;
  readonly width: typeof TARGET_SIZE;
}

function applyGrayWorld(pixels: Buffer, length: number): Buffer {
  const out = Buffer.alloc(length);
  const pixelCount = length / 3;

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  for (let i = 0; i < length; i += 3) {
    sumR += pixels[i]!;
    sumG += pixels[i + 1]!;
    sumB += pixels[i + 2]!;
  }

  const epsilon = 1e-6;
  const meanR = sumR / pixelCount + epsilon;
  const meanG = sumG / pixelCount + epsilon;
  const meanB = sumB / pixelCount + epsilon;
  const overallMean = (meanR + meanG + meanB) / 3;

  const scaleR = overallMean / meanR;
  const scaleG = overallMean / meanG;
  const scaleB = overallMean / meanB;

  for (let i = 0; i < length; i += 3) {
    out[i] = Math.min(255, Math.max(0, Math.round(pixels[i]! * scaleR)));
    out[i + 1] = Math.min(255, Math.max(0, Math.round(pixels[i + 1]! * scaleG)));
    out[i + 2] = Math.min(255, Math.max(0, Math.round(pixels[i + 2]! * scaleB)));
  }

  return out;
}

// EXIF orient -> resize -> center crop -> gray-world -> ImageNet normalize -> CHW tensor
export async function preprocessImage(imageBuffer: Buffer): Promise<PreprocessedImage> {
  try {
    const resized = await sharp(imageBuffer)
      .rotate()
      .resize(RESIZE_SIZE, RESIZE_SIZE, { fit: "cover", position: "centre" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height } = resized.info;
    const cropLeft = Math.floor((width - TARGET_SIZE) / 2);
    const cropTop = Math.floor((height - TARGET_SIZE) / 2);

    const cropped = Buffer.alloc(TARGET_SIZE * TARGET_SIZE * 3);
    for (let y = 0; y < TARGET_SIZE; y++) {
      const srcOffset = ((cropTop + y) * width + cropLeft) * 3;
      const dstOffset = y * TARGET_SIZE * 3;
      resized.data.copy(cropped, dstOffset, srcOffset, srcOffset + TARGET_SIZE * 3);
    }

    const balanced = applyGrayWorld(cropped, cropped.length);

    const totalPixels = TARGET_SIZE * TARGET_SIZE;
    const tensor = new Float32Array(3 * totalPixels);
    for (let i = 0; i < totalPixels; i++) {
      tensor[i] = (balanced[i * 3]! / 255 - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
      tensor[totalPixels + i] = (balanced[i * 3 + 1]! / 255 - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
      tensor[2 * totalPixels + i] = (balanced[i * 3 + 2]! / 255 - IMAGENET_MEAN[2]) / IMAGENET_STD[2];
    }

    return { data: tensor, channels: 3, height: TARGET_SIZE, width: TARGET_SIZE };
  } catch (err) {
    if (err instanceof AppError) throw err;
    const message = err instanceof Error ? err.message : "Unknown error";
    throw AppError.imageProcessing(message);
  }
}
