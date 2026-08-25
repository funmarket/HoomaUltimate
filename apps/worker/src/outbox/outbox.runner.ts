import type { Prisma } from "@hooma/database";
import type { ClaimedOutboxEvent, OutboxRepository } from "./outbox.repository.js";

const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_LEASE_MS = 120_000;
const DEFAULT_MAX_ATTEMPTS = 8;
const MAX_RETRY_DELAY_MS = 300_000;

export interface OutboxHandlerEvent {
  readonly id: string;
  readonly topic: string;
  readonly payload: Prisma.JsonValue;
}

export type OutboxHandler = (event: OutboxHandlerEvent) => Promise<void>;

export interface OutboxRunResult {
  readonly claimed: number;
  readonly delivered: number;
  readonly retried: number;
  readonly failed: number;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 2_000);
  return String(error).slice(0, 2_000);
}

export function retryDelayMilliseconds(
  attempt: number,
  random: () => number = Math.random,
): number {
  const exponent = Math.max(0, attempt - 1);
  const base = Math.min(1_000 * 2 ** exponent, MAX_RETRY_DELAY_MS);
  const jitter = 0.75 + Math.min(Math.max(random(), 0), 1) * 0.5;
  return Math.floor(base * jitter);
}

export class OutboxRunner {
  private running = false;

  constructor(
    private readonly repository: OutboxRepository,
    private readonly handlers: ReadonlyMap<string, OutboxHandler>,
    private readonly options: {
      readonly batchSize?: number;
      readonly leaseMilliseconds?: number;
      readonly maxAttempts?: number;
      readonly random?: () => number;
    } = {},
  ) {}

  async runOnce(now = new Date()): Promise<OutboxRunResult> {
    if (this.running || this.handlers.size === 0) {
      return { claimed: 0, delivered: 0, retried: 0, failed: 0 };
    }

    this.running = true;
    try {
      const leaseMilliseconds = this.options.leaseMilliseconds ?? DEFAULT_LEASE_MS;
      const events = await this.repository.claimAvailable({
        topics: [...this.handlers.keys()],
        now,
        staleBefore: new Date(now.getTime() - leaseMilliseconds),
        limit: this.options.batchSize ?? DEFAULT_BATCH_SIZE,
      });

      const results = await Promise.all(events.map((event) => this.process(event)));
      return results.reduce<OutboxRunResult>(
        (summary, result) => ({
          claimed: summary.claimed + 1,
          delivered: summary.delivered + (result === "DELIVERED" ? 1 : 0),
          retried: summary.retried + (result === "RETRY" ? 1 : 0),
          failed: summary.failed + (result === "FAILED" ? 1 : 0),
        }),
        { claimed: 0, delivered: 0, retried: 0, failed: 0 },
      );
    } finally {
      this.running = false;
    }
  }

  private async process(event: ClaimedOutboxEvent): Promise<"DELIVERED" | "RETRY" | "FAILED"> {
    const handler = this.handlers.get(event.topic);
    if (!handler) {
      throw new Error(`Outbox handler disappeared for registered topic ${event.topic}`);
    }

    try {
      await handler({ id: event.id, topic: event.topic, payload: event.payload });
      await this.repository.markDelivered(event, new Date());
      return "DELIVERED";
    } catch (error) {
      const attempts = event.attempts + 1;
      const terminal = attempts >= (this.options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
      const retryAt = terminal
        ? new Date()
        : new Date(
            Date.now() + retryDelayMilliseconds(attempts, this.options.random ?? Math.random),
          );
      await this.repository.markFailed({
        event,
        attempts,
        retryAt,
        terminal,
        error: errorMessage(error),
      });
      return terminal ? "FAILED" : "RETRY";
    }
  }
}
