import { Router } from "express";
import type { Request, Response } from "express";
import {
  TURBIDITY_CLASSES,
  TURBIDITY_LABELS,
  NTU_RANGES,
} from "../types/turbidity.js";
import type { HealthResponse, ClassesResponse } from "../types/turbidity.js";

export const metaRouter = Router();

const startTime = Date.now();

metaRouter.get("/health", (_req: Request, res: Response<HealthResponse>): void => {
  res.json({
    status: "healthy",
    modelLoaded: true,
    uptime: Math.round((Date.now() - startTime) / 1000),
  });
});

metaRouter.get("/classes", (_req: Request, res: Response<ClassesResponse>): void => {
  res.json({
    classes: TURBIDITY_CLASSES,
    labels: TURBIDITY_LABELS,
    ntuRanges: NTU_RANGES,
  });
});
