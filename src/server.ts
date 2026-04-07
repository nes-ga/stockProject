import { app } from "./app.js";
import { config } from "./config.js";
import { createLogger } from "./lib/logger.js";

const logger = createLogger("server");

app.listen(config.port, () => {
  logger.info("listening", {
    port: config.port
  });
});
