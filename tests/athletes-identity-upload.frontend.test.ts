import assert from "node:assert/strict";
import test from "node:test";
import { createAthletesApi } from "../packages/frontend/src/athletes/api.js";

test("Athletes logo and banner uploads send the original file to their own slot", async () => {
  const original = globalThis.fetch;
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json({ mediaId: "uploaded" }, { status: 201 });
  };
  try {
    const api = createAthletesApi({ baseUrl: "https://api.example.org" });
    assert.equal(typeof Reflect.get(api, "uploadIdentity"), "function");
    const upload = Reflect.get(api, "uploadIdentity") as (
      id: string,
      slot: "logo" | "banner",
      file: File,
    ) => Promise<{ mediaId: string }>;
    for (const slot of ["logo", "banner"] as const) {
      const file = new File([Uint8Array.of(1)], slot + ".png", { type: "image/png" });
      assert.equal((await upload("community-1", slot, file)).mediaId, "uploaded");
      const call = calls.at(-1);
      assert.equal(
        call?.url,
        "https://api.example.org/api/v1/athletes/community-1/identity/" + slot + "/upload",
      );
      assert.equal(call?.init?.method, "POST");
      assert.equal(call?.init?.body, file);
      assert.equal(new Headers(call?.init?.headers).get("content-type"), "image/png");
    }
  } finally {
    globalThis.fetch = original;
  }
});
