import assert from "node:assert/strict";
import test from "node:test";
import type { ErrorRequestHandler } from "express";
import { errorHandler } from "../apps/api/src/http/errors/error-handler.js";
import { AthletesError } from "../apps/api/src/modules/athletes/domain/athletes-error.js";

for (const [code, expectedStatus] of [
  ["ATHLETES_CALENDAR_ENTRY_NOT_FOUND", 404],
  ["ATHLETES_CALENDAR_ENTRY_NOT_EDITABLE", 409],
] as const) {
  test(`HTTP error handler maps ${code} to ${expectedStatus}`, () => {
    const response = createJsonResponse();
    errorHandler(new AthletesError(code, code), {}, response, () => undefined);

    assert.equal(response.statusCode, expectedStatus);
    assert.deepEqual(response.body, { error: { code, message: code } });
  });
}

function createJsonResponse() {
  return {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  } as Parameters<ErrorRequestHandler>[2] & { statusCode: number; body: unknown };
}
