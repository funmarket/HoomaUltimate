import assert from "node:assert/strict";
import test from "node:test";
import { resolveWebApiOrigin } from "../scripts/runtime-config.mjs";

test("production Web requires explicit HOOMA_API_ORIGIN", () => {
  assert.throws(
    () => resolveWebApiOrigin({ NODE_ENV: "production" }),
    /HOOMA_API_ORIGIN is required in production/,
  );
});

test("explicit Web API origin is normalized without changing authority", () => {
  assert.equal(
    resolveWebApiOrigin({
      NODE_ENV: "production",
      HOOMA_API_ORIGIN: "http://hooma-api.railway.internal:3000/",
    }),
    "http://hooma-api.railway.internal:3000",
  );
});

test("non-production static serving may run without an API proxy target", () => {
  assert.equal(resolveWebApiOrigin({ NODE_ENV: "development" }), null);
});
