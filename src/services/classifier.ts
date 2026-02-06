import type { PreprocessedImage } from "./preprocessing.js";
import {
  type ClassProbability,
  type PredictionResult,
  TURBIDITY_CLASSES,
  TURBIDITY_LABELS,
  NTU_RANGES,
} from "../types/turbidity.js";

// Derives a seed from the tensor so identical images produce identical predictions.
function hashTensor(tensor: Float32Array): number {
  let hash = 0;
  const step = Math.max(1, Math.floor(tensor.length / 256));
  for (let i = 0; i < tensor.length; i += step) {
    hash = ((hash << 5) - hash + Math.round((tensor[i]! + 3) * 10000)) | 0;
  }
  return Math.abs(hash);
}

// Simple seeded PRNG (mulberry32).
function createRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}

function buildResult(probs: number[]): PredictionResult {
  let maxIdx = 0;
  let maxProb = -Infinity;

  const probabilities: ClassProbability[] = TURBIDITY_CLASSES.map((cls, i) => {
    const p = probs[i] ?? 0;
    if (p > maxProb) {
      maxProb = p;
      maxIdx = i;
    }
    return { className: cls, label: TURBIDITY_LABELS[cls], probability: p };
  });

  const predicted = TURBIDITY_CLASSES[maxIdx]!;
  return {
    predictedClass: predicted,
    label: TURBIDITY_LABELS[predicted],
    confidence: maxProb,
    ntuRange: NTU_RANGES[predicted],
    probabilities,
  };
}

// Mock inference: uses mean brightness from the preprocessed tensor to pick a
// class (darker images -> cloudier), then builds a smooth probability curve.
export function predict(image: PreprocessedImage): PredictionResult {
  const totalPixels = image.height * image.width;

  // Compute mean brightness across channels (un-normalize first).
  const means = [0.485, 0.456, 0.406] as const;
  const stds = [0.229, 0.224, 0.225] as const;
  let brightness = 0;
  for (let c = 0; c < 3; c++) {
    const offset = c * totalPixels;
    let channelSum = 0;
    for (let i = 0; i < totalPixels; i++) {
      channelSum += image.data[offset + i]! * stds[c]! + means[c]!;
    }
    brightness += channelSum / totalPixels;
  }
  brightness /= 3;

  // Map brightness [0,1] to a class index (darker = cloudier = lower index).
  const classCount = TURBIDITY_CLASSES.length;
  const center = Math.min(classCount - 1, Math.max(0, Math.round((1 - brightness) * (classCount - 1))));

  const rng = createRng(hashTensor(image.data));
  const logits = TURBIDITY_CLASSES.map((_, i) => {
    const distance = Math.abs(i - center);
    return -distance * 1.8 + (rng() - 0.5) * 0.3;
  });

  return buildResult(softmax(logits));
}
