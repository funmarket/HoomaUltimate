import assert from "node:assert/strict";
import test from "node:test";
import type { ErrorRequestHandler } from "express";
import { errorHandler } from "../apps/api/src/http/errors/error-handler.js";
import { RideError } from "../apps/api/src/modules/rides/domain/ride-error.js";

test("HTTP error handler maps RideError without making Ride application import HTTP", () => {
  const response = createJsonResponse();

  errorHandler(
    new RideError("RIDE_OFFER_MANAGE_FORBIDDEN", "Ride offer owner access required"),
    {},
    response,
    () => undefined,
  );

  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.body, {
    error: {
      code: "RIDE_OFFER_MANAGE_FORBIDDEN",
      message: "Ride offer owner access required",
    },
  });
});

test("HTTP error handler only maps real body parser failures by parser type", () => {
  const invalidJsonResponse = createJsonResponse();
  errorHandler(
    { type: "entity.parse.failed", status: 400, statusCode: 400 },
    {},
    invalidJsonResponse,
    () => undefined,
  );
  assert.equal(invalidJsonResponse.statusCode, 400);
  assert.deepEqual(invalidJsonResponse.body, {
    error: { code: "REQUEST_BODY_INVALID", message: "Request body is invalid" },
  });

  const tooLargeResponse = createJsonResponse();
  errorHandler(
    { type: "entity.too.large", status: 413, statusCode: 413 },
    {},
    tooLargeResponse,
    () => undefined,
  );
  assert.equal(tooLargeResponse.statusCode, 413);
  assert.deepEqual(tooLargeResponse.body, {
    error: { code: "PAYLOAD_TOO_LARGE", message: "Request body is too large" },
  });
});

test("HTTP error handler does not treat arbitrary 400-like errors as parser errors", () => {
  const response = createJsonResponse();
  const originalConsoleError = console.error;
  const loggedErrors: unknown[] = [];
  console.error = (...args: unknown[]) => {
    loggedErrors.push(args);
  };
  try {
    errorHandler({ status: 400, statusCode: 400 }, {}, response, () => undefined);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, {
    error: { code: "INTERNAL_ERROR", message: "Unexpected server error" },
  });
  assert.equal(loggedErrors.length, 1);
});

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
