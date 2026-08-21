import { disconnectDatabase, getDatabaseClient } from "@hooma/database";
import { cleanupExpiredEventChat } from "./events/event-chat-cleanup.js";

const EVENT_CHAT_CLEANUP_INTERVAL_MS = 60_000;
const database = getDatabaseClient();
let cleanupRunning = false;
let shuttingDown = false;

async function runEventChatCleanup(): Promise<void> {
  if (cleanupRunning || shuttingDown) return;
  cleanupRunning = true;
  try {
    const result = await cleanupExpiredEventChat(database);
    if (result.deletedMessages > 0 || result.deletedRooms > 0) {
      console.log("Event chat cleanup completed", result);
    }
  } catch (error) {
    console.error("Event chat cleanup failed", error);
  } finally {
    cleanupRunning = false;
  }
}

console.log("HOOMA ULTIMATE worker started with Event chat cleanup enabled.");
void runEventChatCleanup();
const cleanupTimer = setInterval(() => void runEventChatCleanup(), EVENT_CHAT_CLEANUP_INTERVAL_MS);

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; shutting down worker.`);
  clearInterval(cleanupTimer);
  await disconnectDatabase();
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
