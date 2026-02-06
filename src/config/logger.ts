import winston from "winston";
import { config } from "./index.js";

const { combine, timestamp, printf, colorize, errors } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  printf(({ timestamp: ts, level, message, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    const stackStr = stack ? `\n${String(stack)}` : "";
    return `${String(ts)} ${level}: ${String(message)}${metaStr}${stackStr}`;
  }),
);

const prodFormat = combine(timestamp(), errors({ stack: true }), winston.format.json());

export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: config.NODE_ENV === "production" ? prodFormat : devFormat,
  transports: [new winston.transports.Console()],
  exitOnError: false,
});
