import { loadApiConfig } from "@hooma/config";
import { createApp } from "./app.js";

const config = loadApiConfig();
const app = createApp(config);
const server = app.listen(config.API_PORT, "0.0.0.0", () => {
  console.log(`HOOMA ULTIMATE API listening on ${config.API_PORT}`);
});

function shutdown(signal: NodeJS.Signals) {
  console.log(`Received ${signal}; shutting down API.`);
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
