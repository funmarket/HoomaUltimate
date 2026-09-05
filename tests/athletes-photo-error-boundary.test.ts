import assert from "node:assert/strict";
import test from "node:test";
import type { ErrorRequestHandler } from "express";
import { errorHandler } from "../apps/api/src/http/errors/error-handler.js";
import {
  AthletesError,
  type AthletesErrorCode,
} from "../apps/api/src/modules/athletes/domain/athletes-error.js";

const CASES: ReadonlyArray<readonly [AthletesErrorCode, number]> = [
  ["ATHLETES_PHOTO_NOT_FOUND", 404],
  ["ATHLETES_PHOTO_REQUIRED", 400],
  ["ATHLETES_PHOTO_TYPE_INVALID", 415],
  ["ATHLETES_PHOTO_TOO_LARGE", 413],
  ["ATHLETES_PHOTO_STORAGE_NOT_CONFIGURED", 503],
  ["ATHLETES_PHOTO_UPLOAD_FAILED", 503],
  ["ATHLETES_PHOTO_UNAVAILABLE", 503],
];

for (const [code, expectedStatus] of CASES) {
  test(`HTTP error handler maps ${code} to ${expectedStatus}`, () => {
    const response = createJsonResponse();
    const message = `message for ${code}`;

    errorHandler(new AthletesError(code, message), {}, response, () => undefined);

    assert.equal(response.statusCode, expectedStatus);
    assert.deepEqual(response.body, {
      error: {
        code,
        message,
      },
    });
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
