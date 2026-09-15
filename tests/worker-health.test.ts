import assert from "node:assert/strict";
import test from "node:test";
import { createWorkerHealthServer } from "../apps/worker/src/health/worker-health.js";

async function readJson(base: string, path: string): Promise<{ status: number; body: unknown }> {
  const response = await fetch(`${base}${path}`);
  return { status: response.status, body: await response.json() };
}

test("Worker health exposes live and storage-aware ready endpoints", async () => {
  const server = createWorkerHealthServer({
    service: "worker",
    version: "0.1.0-test",
    checks: {
      postgres: { check: async () => undefined },
      objectStorage: { check: async () => undefined },
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    assert.deepEqual(await readJson(base, "/health/live"), {
      status: 200,
      body: { status: "ok", service: "worker", version: "0.1.0-test" },
    });
    assert.deepEqual(await readJson(base, "/health/ready"), {
      status: 200,
      body: {
        status: "ok",
        service: "worker",
        version: "0.1.0-test",
        checks: { postgres: "ok", objectStorage: "ok" },
      },
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("Worker ready endpoint fails closed when object storage is unhealthy", async () => {
  const server = createWorkerHealthServer({
    service: "worker",
    version: "0.1.0-test",
    checks: {
      postgres: { check: async () => undefined },
      objectStorage: {
        check: async () => {
          throw new Error("storage unavailable");
        },
      },
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;

  try {
    assert.deepEqual(await readJson(base, "/health/ready"), {
      status: 503,
      body: {
        status: "not_ready",
        service: "worker",
        version: "0.1.0-test",
        checks: { postgres: "ok", objectStorage: "failed" },
      },
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
