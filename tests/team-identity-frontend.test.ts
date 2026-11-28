import assert from "node:assert/strict";
import test from "node:test";
import { createHoomaApi } from "../packages/frontend/src/api.js";

test("Step 26 uploads a raw Team image to the exact badge/banner endpoint", async () => {
  const original = globalThis.fetch;
  const calls: Array<{ url: string; body: BodyInit | null | undefined; type: string | null }> = [];
  globalThis.fetch = async (url, init) => {
    const headers = new Headers(init?.headers);
    calls.push({ url: String(url), body: init?.body, type: headers.get("content-type") });
    return Response.json({ mediaId: "team-media-1" }, { status: 201 });
  };
  try {
    const api = createHoomaApi({ baseUrl: "https://api.example.org", credentials: "include" });
    const file = new File([Uint8Array.of(1, 2, 3)], "badge.png", { type: "image/png" });
    const result = await api.teams.uploadIdentity("team/one", "badge", file);
    assert.equal(result.mediaId, "team-media-1");
    assert.deepEqual(calls, [
      {
        url: "https://api.example.org/api/v1/teams/team%2Fone/identity/badge/upload",
        body: file,
        type: "image/png",
      },
    ]);
  } finally {
    globalThis.fetch = original;
  }
});
