export const TURBIDITY_CLASSES = [
  "ultra_cloudy",
  "very_cloudy",
  "cloudy",
  "lightly_cloudy",
  "lightly_clear",
  "clear",
] as const;

export type TurbidityClass = (typeof TURBIDITY_CLASSES)[number];

export const TURBIDITY_LABELS: Readonly<Record<TurbidityClass, string>> = {
  ultra_cloudy: "Ultra Cloudy",
  very_cloudy: "Very Cloudy",
  cloudy: "Cloudy",
  lightly_cloudy: "Lightly Cloudy",
  lightly_clear: "Lightly Clear",
  clear: "Clear",
};

export interface NtuRange {
  readonly min: number;
  readonly max: number;
}

export const NTU_RANGES: Readonly<Record<TurbidityClass, NtuRange>> = {
  ultra_cloudy: { min: 3336.0, max: 3844.0 },
  very_cloudy: { min: 1300.0, max: 2520.0 },
  cloudy: { min: 600.0, max: 1200.0 },
  lightly_cloudy: { min: 150.0, max: 450.0 },
  lightly_clear: { min: 25.0, max: 90.0 },
  clear: { min: 1.47, max: 17.13 },
};

export interface ClassProbability {
  readonly className: TurbidityClass;
  readonly label: string;
  readonly probability: number;
}

export interface PredictionResult {
  readonly predictedClass: TurbidityClass;
  readonly label: string;
  readonly confidence: number;
  readonly ntuRange: NtuRange;
  readonly probabilities: readonly ClassProbability[];
}

export interface HealthResponse {
  readonly status: "healthy" | "degraded";
  readonly modelLoaded: boolean;
  readonly uptime: number;
}

export interface ClassesResponse {
  readonly classes: readonly TurbidityClass[];
  readonly labels: Readonly<Record<TurbidityClass, string>>;
  readonly ntuRanges: Readonly<Record<TurbidityClass, NtuRange>>;
}

export interface ErrorResponse {
  readonly error: string;
  readonly code: string;
}
