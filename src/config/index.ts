import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5001),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  MAX_FILE_SIZE_MB: z.coerce.number().positive().default(10),
  LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  CORS_ORIGIN: z.string().default("*"),
});

export type AppConfig = z.infer<typeof envSchema>;

function loadConfig(): AppConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment configuration:", result.error.flatten().fieldErrors);
    process.exit(1);
  }
  return result.data;
}

export const config: AppConfig = loadConfig();
