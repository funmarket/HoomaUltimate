import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

export interface WorkerReadinessProbe {
  check(): Promise<void>;
}

export interface WorkerHealthServerOptions {
  readonly service: "worker";
  readonly version: string;
  readonly checks: {
    readonly postgres: WorkerReadinessProbe;
    readonly objectStorage: WorkerReadinessProbe;
  };
}

type WorkerCheckStatus = "ok" | "failed";

async function probeStatus(probe: WorkerReadinessProbe): Promise<WorkerCheckStatus> {
  try {
    await probe.check();
    return "ok";
  } catch {
    return "failed";
  }
}

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

export function createWorkerHealthServer(options: WorkerHealthServerOptions): Server {
  const live = {
    status: "ok" as const,
    service: options.service,
    version: options.version,
  };

  return createServer(async (request: IncomingMessage, response: ServerResponse) => {
    if (request.method !== "GET") {
      writeJson(response, 405, { status: "not_found", service: options.service });
      return;
    }
    if (request.url === "/health" || request.url === "/health/live") {
      writeJson(response, 200, live);
      return;
    }
    if (request.url === "/health/ready") {
      const [postgres, objectStorage] = await Promise.all([
        probeStatus(options.checks.postgres),
        probeStatus(options.checks.objectStorage),
      ]);
      const status = postgres === "ok" && objectStorage === "ok" ? "ok" : "not_ready";
      writeJson(response, status === "ok" ? 200 : 503, {
        ...live,
        status,
        checks: { postgres, objectStorage },
      });
      return;
    }
    writeJson(response, 404, { status: "not_found", service: options.service });
  });
}
