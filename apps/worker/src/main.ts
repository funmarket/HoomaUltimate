import {
  ATHLETES_CALENDAR_MEDIA_RECONCILE_TOPIC,
  ATHLETES_PHOTO_RECONCILE_TOPIC,
} from "@hooma/contracts/athletes";
import { loadObjectStorageConfig, type ObjectStorageConfig } from "@hooma/config";
import { disconnectDatabase, getDatabaseClient, type PrismaClient } from "@hooma/database";
import {
  S3ObjectStorage,
  type ObjectStorage,
  type ObjectStorageReadinessProbe,
} from "@hooma/storage";
import { createAthletesCalendarMediaCleanupHandler } from "./athletes/athletes-calendar-media-cleanup.js";
import { createAthletesPhotoCleanupHandler } from "./athletes/athletes-photo-cleanup.js";
import { cleanupExpiredEventChat } from "./events/event-chat-cleanup.js";
import { reconcileGamerMatches } from "./gamers/match-reconciliation.js";
import { createWorkerHealthServer } from "./health/worker-health.js";
import { OutboxRepository } from "./outbox/outbox.repository.js";
import { expireDueRequests } from "./requests/request-expiry.js";
import { type OutboxHandler, OutboxRunner } from "./outbox/outbox.runner.js";
import {
  createRideVehiclePhotoCleanupHandler,
  RIDE_VEHICLE_PHOTO_DELETE_OBJECT_TOPIC,
} from "./rides/ride-vehicle-photo-cleanup.js";
import { cleanupExpiredWhistles } from "./whistle/whistle-cleanup.js";

const EVENT_CHAT_CLEANUP_INTERVAL_MS = 60_000;
const GAMER_MATCH_RECONCILIATION_INTERVAL_MS = 15_000;
const OUTBOX_POLL_INTERVAL_MS = 5_000;
const REQUEST_EXPIRY_INTERVAL_MS = 60_000;
const WHISTLE_CLEANUP_INTERVAL_MS = 60_000;

class WorkerDatabaseReadinessProbe {
  constructor(private readonly database: PrismaClient) {}

  async check(): Promise<void> {
    await this.database.$queryRaw`SELECT 1`;
  }
}

const missingObjectStorageProbe: ObjectStorageReadinessProbe = {
  async check(): Promise<void> {
    throw new Error("Object storage is not configured");
  },
};

const objectStorageConfig = loadObjectStorageConfig(process.env);
const database = getDatabaseClient();
const outboxHandlers = new Map<string, OutboxHandler>();
const storage = objectStorage(objectStorageConfig);
const storageReadiness = objectStorageReadinessProbe(storage);
if (storage) {
  outboxHandlers.set(
    ATHLETES_PHOTO_RECONCILE_TOPIC,
    createAthletesPhotoCleanupHandler(database, storage),
  );
  outboxHandlers.set(
    ATHLETES_CALENDAR_MEDIA_RECONCILE_TOPIC,
    createAthletesCalendarMediaCleanupHandler(database, storage),
  );
  outboxHandlers.set(
    RIDE_VEHICLE_PHOTO_DELETE_OBJECT_TOPIC,
    createRideVehiclePhotoCleanupHandler(storage),
  );
}
const outbox = new OutboxRunner(new OutboxRepository(database), outboxHandlers);
const healthServer = createWorkerHealthServer({
  service: "worker",
  version: process.env.npm_package_version ?? "0.1.0",
  checks: {
    postgres: new WorkerDatabaseReadinessProbe(database),
    objectStorage: storageReadiness ?? missingObjectStorageProbe,
  },
});

let cleanupRunning = false;
let gamerMatchesRunning = false;
let outboxRunning = false;
let requestExpiryRunning = false;
let whistleCleanupRunning = false;
let shuttingDown = false;
let cleanupPromise: Promise<void> | null = null;
let gamerMatchesPromise: Promise<void> | null = null;
let outboxPromise: Promise<void> | null = null;
let requestExpiryPromise: Promise<void> | null = null;
let whistleCleanupPromise: Promise<void> | null = null;

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

async function runRequestExpiry(): Promise<void> {
  if (requestExpiryRunning || shuttingDown) return;
  requestExpiryRunning = true;
  requestExpiryPromise = (async () => {
    try {
      const result = await expireDueRequests(database);
      if (result.expiredRequests > 0) console.log("Request expiry completed", result);
    } catch (error) {
      console.error("Request expiry failed", error);
    } finally {
      requestExpiryRunning = false;
      requestExpiryPromise = null;
    }
  })();
  await requestExpiryPromise;
}

async function runWhistleCleanup(): Promise<void> {
  if (whistleCleanupRunning || shuttingDown) return;
  whistleCleanupRunning = true;
  whistleCleanupPromise = (async () => {
    try {
      const result = await cleanupExpiredWhistles(database);
      if (result.deletedMetadata > 0) console.log("Whistle cleanup completed", result);
    } catch (error) {
      console.error("Whistle cleanup failed", error);
    } finally {
      whistleCleanupRunning = false;
      whistleCleanupPromise = null;
    }
  })();
  await whistleCleanupPromise;
}

console.log(
  `HOOMA worker started with Event chat cleanup, Request expiry, Whistle cleanup, Gamer match reconciliation and Outbox engine (${outboxHandlers.size} handlers registered).`,
);
const healthPort = Number(process.env.PORT ?? process.env.WORKER_HEALTH_PORT ?? 3001);
healthServer.listen(healthPort, "0.0.0.0", () => {
  console.log(`HOOMA worker health server listening on ${healthPort}.`);
});
void runEventChatCleanup();
void runRequestExpiry();
void runWhistleCleanup();
void runGamerMatchReconciliation();
void runOutbox();
const cleanupTimer = setInterval(() => void runEventChatCleanup(), EVENT_CHAT_CLEANUP_INTERVAL_MS);
const requestExpiryTimer = setInterval(
  () => void runRequestExpiry(),
  REQUEST_EXPIRY_INTERVAL_MS,
);
const whistleCleanupTimer = setInterval(
  () => void runWhistleCleanup(),
  WHISTLE_CLEANUP_INTERVAL_MS,
);
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
  clearInterval(requestExpiryTimer);
  clearInterval(whistleCleanupTimer);
  clearInterval(gamerMatchesTimer);
  clearInterval(outboxTimer);
  await Promise.allSettled(
    [
      cleanupPromise,
      requestExpiryPromise,
      whistleCleanupPromise,
      gamerMatchesPromise,
      outboxPromise,
    ].filter(
      (promise): promise is Promise<void> => promise !== null,
    ),
  );
  await new Promise<void>((resolve, reject) => {
    healthServer.close((error) => (error ? reject(error) : resolve()));
  });
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
    urlStyle: config.OBJECT_STORAGE_URL_STYLE,
  });
}

function objectStorageReadinessProbe(
  storage: ObjectStorage | null,
): ObjectStorageReadinessProbe | undefined {
  if (storage && "check" in storage && typeof storage.check === "function") {
    return storage as ObjectStorageReadinessProbe;
  }
  return undefined;
}
