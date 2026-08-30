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
