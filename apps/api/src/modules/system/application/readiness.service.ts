export interface ReadinessProbe {
  check(): Promise<void>;
}

export interface ReadinessResult {
  readonly status: "ok" | "not_ready";
  readonly checks: {
    readonly postgres: "ok" | "failed";
    readonly redis: "ok" | "failed";
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
  ) {}

  async check(): Promise<ReadinessResult> {
    const [postgres, redis] = await Promise.all([
      probeStatus(this.postgres),
      probeStatus(this.redis),
    ]);
    return {
      status: postgres === "ok" && redis === "ok" ? "ok" : "not_ready",
      checks: { postgres, redis },
    };
  }
}
