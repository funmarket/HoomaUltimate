import { disconnectDatabase, getDatabaseClient } from "@hooma/database";
import { cleanupExpiredEventChat } from "./events/event-chat-cleanup.js";
import { OutboxRepository } from "./outbox/outbox.repository.js";
import {
  type OutboxHandler,
  OutboxRunner,
} from "./outbox/outbox.runner.js";

const EVENT_CHAT_CLEANUP_INTERVAL_MS = 60_000;
const OUTBOX_POLL_INTERVAL_MS = 5_000;
const database = getDatabaseClient();
const outboxHandlers = new Map<string, OutboxHandler>();
const outbox = new OutboxRunner(
  new OutboxRepository(database),
  outboxHandlers,
);

let cleanupRunning = false;
let outboxRunning = false;
let shuttingDown = false;
let cleanupPromise: Promise<void> | null = null;
let outboxPromise: Promise<void> | null = null;

async function runEventChatCleanup(): Promise<void> {
  if (cleanupRunning || shuttingDown) return;
  cleanupRunning = true;
  cleanupPromise = (async () => {
    try {
      const result = await cleanupExpiredEventChat(database);
      if (result.deletedMessages > 0 || result.deletedRooms > 0) {
        console.log("Event chat cleanup completed", result);
      }
    } catch (error) {
      console.error("Event chat cleanup failed", error);
    } finally {
      cleanupRunning = false;
      cleanupPromise = null;
    }
  })();
  await cleanupPromise;
}

async function runOutbox(): Promise<void> {
  if (outboxRunning || shuttingDown || outboxHandlers.size === 0) return;
  outboxRunning = true;
  outboxPromise = (async () => {
    try {
      const result = await outbox.runOnce();
      if (result.claimed > 0) console.log("Outbox batch completed", result);
    } catch (error) {
      console.error("Outbox batch failed", error);
    } finally {
      outboxRunning = false;
      outboxPromise = null;
    }
  })();
  await outboxPromise;
}

console.log(
  `HOOMA worker started with Event chat cleanup and Outbox engine (${outboxHandlers.size} handlers registered).`,
);
void runEventChatCleanup();
void runOutbox();
const cleanupTimer = setInterval(
  () => void runEventChatCleanup(),
  EVENT_CHAT_CLEANUP_INTERVAL_MS,
);
const outboxTimer = setInterval(
  () => void runOutbox(),
  OUTBOX_POLL_INTERVAL_MS,
);

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; shutting down worker.`);
  clearInterval(cleanupTimer);
  clearInterval(outboxTimer);
  await Promise.allSettled(
    [cleanupPromise, outboxPromise].filter(
      (promise): promise is Promise<void> => promise !== null,
    ),
  );
  await disconnectDatabase();
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
