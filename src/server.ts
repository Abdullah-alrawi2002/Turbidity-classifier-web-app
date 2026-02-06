import { createApp } from "./app.js";
import { config } from "./config/index.js";
import { logger } from "./config/logger.js";

function main(): void {
  logger.info("Water Turbidity Classifier API");

  const app = createApp();

  const server = app.listen(config.PORT, config.HOST, () => {
    logger.info(`Listening on http://${config.HOST}:${config.PORT} [${config.NODE_ENV}]`);
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main();
