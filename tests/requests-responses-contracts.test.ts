import assert from "node:assert/strict";
import test from "node:test";
import {
  helpRequestRespondSchema,
  helpRequestResponseSchema,
  helpRequestResponseStatusSchema,
} from "@hooma/contracts/requests";

test("Request response contracts expose only the planned statuses", () => {
  for (const status of ["PENDING", "ACCEPTED", "DECLINED", "WITHDRAWN"] as const) {
    assert.equal(helpRequestResponseStatusSchema.parse(status), status);
  }
  assert.throws(() => helpRequestResponseStatusSchema.parse("DELETED"));
});

test("Request response input requires a non-empty coordination message", () => {
  assert.deepEqual(helpRequestRespondSchema.parse({ message: "  I can help Saturday.  " }), {
    message: "I can help Saturday.",
  });
  assert.throws(() => helpRequestRespondSchema.parse({ message: "   " }));
});

test("Request response DTO keeps coordination state explicit", () => {
  const parsed = helpRequestResponseSchema.parse({
    id: "response-1",
    requestId: "request-1",
    responderUserId: "user-2",
    message: "I can help Saturday.",
    status: "PENDING",
    createdAt: "2026-09-17T01:00:00.000Z",
    updatedAt: "2026-09-17T01:00:00.000Z",
    acceptedAt: null,
    declinedAt: null,
    withdrawnAt: null,
  });
  assert.equal(parsed.responderUserId, "user-2");
  assert.equal(parsed.status, "PENDING");
});
