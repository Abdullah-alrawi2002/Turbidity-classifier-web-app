import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config/index.js";
import { requestLogger } from "./middleware/request-logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { predictRouter } from "./routes/predict.js";
import { metaRouter } from "./routes/meta.js";

export function createApp(): express.Application {
  const app = express();

  app.use(helmet());
  app.use(cors({
    origin: config.CORS_ORIGIN === "*" ? true : config.CORS_ORIGIN.split(","),
    methods: ["GET", "POST"],
  }));
  app.use(express.json({ limit: `${config.MAX_FILE_SIZE_MB}mb` }));
  app.use(requestLogger);

  app.use("/api/predict", predictRouter);
  app.use("/api", metaRouter);
  app.use(express.static("public"));

  app.use(errorHandler);

  return app;
}
