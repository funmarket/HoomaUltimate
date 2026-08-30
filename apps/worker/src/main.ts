import { loadObjectStorageConfig, type ObjectStorageConfig } from "@hooma/config";
import { disconnectDatabase, getDatabaseClient } from "@hooma/database";
import { S3ObjectStorage, type ObjectStorage } from "@hooma/storage";
import { cleanupExpiredEventChat } from "./events/event-chat-cleanup.js";
import { reconcileGamerMatches } from "./gamers/match-reconciliation.js";
import { OutboxRepository } from "./outbox/outbox.repository.js";
import { type OutboxHandler, OutboxRunner } from "./outbox/outbox.runner.js";
import {
  createRideVehiclePhotoCleanupHandler,
  RIDE_VEHICLE_PHOTO_DELETE_OBJECT_TOPIC,
} from "./rides/ride-vehicle-photo-cleanup.js";

const EVENT_CHAT_CLEANUP_INTERVAL_MS = 60_000;
const GAMER_MATCH_RECONCILIATION_INTERVAL_MS = 15_000;
const OUTBOX_POLL_INTERVAL_MS = 5_000;
const objectStorageConfig = loadObjectStorageConfig(process.env);
const database = getDatabaseClient();
const outboxHandlers = new Map<string, OutboxHandler>();
const storage = objectStorage(objectStorageConfig);
if (storage) {
  outboxHandlers.set(
    RIDE_VEHICLE_PHOTO_DELETE_OBJECT_TOPIC,
    createRideVehiclePhotoCleanupHandler(storage),
  );
}
const outbox = new OutboxRunner(new OutboxRepository(database), outboxHandlers);

let cleanupRunning = false;
let gamerMatchesRunning = false;
let outboxRunning = false;
let shuttingDown = false;
let cleanupPromise: Promise<void> | null = null;
let gamerMatchesPromise: Promise<void> | null = null;
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

async function runGamerMatchReconciliation(): Promise<void> {
  if (gamerMatchesRunning || shuttingDown) return;
  gamerMatchesRunning = true;
  gamerMatchesPromise = (async () => {
    try {
      const result = await reconcileGamerMatches(database);
      if (result.scanned > 0) console.log("Gamer match reconciliation completed", result);
    } catch (error) {
      console.error("Gamer match reconciliation batch failed", error);
    } finally {
      gamerMatchesRunning = false;
      gamerMatchesPromise = null;
    }
  })();
  await gamerMatchesPromise;
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
  `HOOMA worker started with Event chat cleanup, Gamer match reconciliation and Outbox engine (${outboxHandlers.size} handlers registered).`,
);
void runEventChatCleanup();
void runGamerMatchReconciliation();
void runOutbox();
const cleanupTimer = setInterval(() => void runEventChatCleanup(), EVENT_CHAT_CLEANUP_INTERVAL_MS);
const gamerMatchesTimer = setInterval(
  () => void runGamerMatchReconciliation(),
  GAMER_MATCH_RECONCILIATION_INTERVAL_MS,
);
const outboxTimer = setInterval(() => void runOutbox(), OUTBOX_POLL_INTERVAL_MS);

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}; shutting down worker.`);
  clearInterval(cleanupTimer);
  clearInterval(gamerMatchesTimer);
  clearInterval(outboxTimer);
  await Promise.allSettled(
    [cleanupPromise, gamerMatchesPromise, outboxPromise].filter(
      (promise): promise is Promise<void> => promise !== null,
    ),
  );
  await disconnectDatabase();
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

function objectStorage(config: ObjectStorageConfig): ObjectStorage | null {
  if (
    !config.OBJECT_STORAGE_ENDPOINT ||
    !config.OBJECT_STORAGE_REGION ||
    !config.OBJECT_STORAGE_BUCKET ||
    !config.OBJECT_STORAGE_ACCESS_KEY_ID ||
    !config.OBJECT_STORAGE_SECRET_ACCESS_KEY
  ) {
    return null;
  }
  return new S3ObjectStorage({
    endpoint: config.OBJECT_STORAGE_ENDPOINT,
    region: config.OBJECT_STORAGE_REGION,
    bucket: config.OBJECT_STORAGE_BUCKET,
    accessKeyId: config.OBJECT_STORAGE_ACCESS_KEY_ID,
    secretAccessKey: config.OBJECT_STORAGE_SECRET_ACCESS_KEY,
  });
}
