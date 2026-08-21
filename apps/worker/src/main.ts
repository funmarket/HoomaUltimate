console.log("HOOMA ULTIMATE worker foundation started. No async domain handlers are enabled yet.");

const heartbeat = setInterval(() => undefined, 60_000);

function shutdown(signal: NodeJS.Signals) {
  console.log(`Received ${signal}; shutting down worker.`);
  clearInterval(heartbeat);
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
