import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { databaseConfig } from "../server/database.mjs";
import { createApp } from "../server/app.mjs";

test("invalid PostgreSQL configuration fails before connection with safe diagnostic codes", () => {
  for (const [value, code] of [
    [undefined, "DATABASE_URL_MISSING"],
    ["not-a-url", "DATABASE_URL_INVALID"],
    ["https://example.com", "DATABASE_PROTOCOL_INVALID"],
    ["postgresql://host", "DATABASE_ADDRESS_INVALID"],
  ]) {
    assert.throws(
      () => databaseConfig({ DATABASE_URL: value }),
      (e) => e.code === code,
    );
  }
});
test("health endpoint distinguishes database failures without exposing driver messages", async () => {
  const errors = [
    ["28P01", "DATABASE_AUTH_FAILED"],
    ["42P01", "DATABASE_SCHEMA_MISSING"],
    ["ECONNREFUSED", "DATABASE_UNREACHABLE"],
    ["SELF_SIGNED_CERT_IN_CHAIN", "DATABASE_TLS_FAILED"],
  ];
  for (const [driverCode, safeCode] of errors) {
    const { app } = await createApp({
      database: {
        query: async () => {
          throw Object.assign(
            new Error("sensitive-driver-message-do-not-expose"),
            { code: driverCode },
          );
        },
      },
    });
    const res = await request(app).get("/api/health").expect(503);
    assert.equal(res.body.code, safeCode);
    assert.equal(
      JSON.stringify(res.body).includes("sensitive-driver-message"),
      false,
    );
  }
});
