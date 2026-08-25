import type { RedisClient } from "../../../infrastructure/redis/redis-client.js";
import type { ReadinessProbe } from "../application/readiness.service.js";

export class RedisReadinessProbe implements ReadinessProbe {
  constructor(private readonly redis: RedisClient) {}

  async check(): Promise<void> {
    await this.redis.ping();
  }
}
