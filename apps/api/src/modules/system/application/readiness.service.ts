export interface ReadinessProbe {
  check(): Promise<void>;
}

export interface ReadinessResult {
  readonly status: "ok" | "not_ready";
  readonly checks: {
    readonly postgres: "ok" | "failed";
    readonly redis: "ok" | "failed";
    readonly objectStorage: "ok" | "failed" | "not_configured";
  };
}

async function probeStatus(probe: ReadinessProbe): Promise<"ok" | "failed"> {
  try {
    await probe.check();
    return "ok";
  } catch {
    return "failed";
  }
}

export class ReadinessService {
  constructor(
    private readonly postgres: ReadinessProbe,
    private readonly redis: ReadinessProbe,
    private readonly objectStorage?: ReadinessProbe,
  ) {}

  async check(): Promise<ReadinessResult> {
    const [postgres, redis, objectStorage] = await Promise.all([
      probeStatus(this.postgres),
      probeStatus(this.redis),
      this.objectStorage
        ? probeStatus(this.objectStorage)
        : Promise.resolve("not_configured" as const),
    ]);
    return {
      status:
        postgres === "ok" && redis === "ok" && objectStorage !== "failed" ? "ok" : "not_ready",
      checks: { postgres, redis, objectStorage },
    };
  }
}
