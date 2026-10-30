import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { readFile } from "node:fs/promises";
import { databaseConfig, consumeLimit } from "../server/database.mjs";
import { createApp } from "../server/app.mjs";
import { testApp } from "./helpers.mjs";

test("database configuration requires remote PostgreSQL and verifies TLS on Vercel", () => {
  assert.throws(() => databaseConfig({}), /DATABASE_URL/);
  assert.throws(
    () => databaseConfig({ DATABASE_URL: "file:test.db" }),
    /postgres/,
  );
  const c = databaseConfig({
    DATABASE_URL:
      "postgresql://test:placeholder@pooler.example:6543/postgres?sslmode=require",
    VERCEL: "1",
  });
  assert.equal(c.ssl.rejectUnauthorized, true);
  assert.equal(new URL(c.connectionString).searchParams.has("sslmode"), false);
  assert.equal(c.max, 2);
  assert.equal(
    databaseConfig({
      DATABASE_URL: "postgres://test:placeholder@localhost/test",
    }).ssl,
    false,
  );
});

test("independent app instances share sessions and quotas; concurrent saves preserve history", async () => {
  const { app, db } = await testApp();
  try {
    const agent = request.agent(app);
    const registration = await agent
      .post("/api/auth/register")
      .send({
        name: "Autora",
        email: "author@example.com",
        password: "long-password-test",
      })
      .expect(201);
    const second = (await createApp({ database: db })).app;
    await request(second)
      .get("/api/me")
      .set("Cookie", registration.headers["set-cookie"][0].split(";")[0])
      .expect(200);
    for (let i = 0; i < 5; i++)
      assert.equal(await consumeLimit(db, "ai:org", 5, 3600000), true);
    assert.equal(await consumeLimit(db, "ai:org", 5, 3600000), false);
    const client = (
      await agent.post("/api/clients").send({ name: "Cliente" }).expect(201)
    ).body;
    const p = (
      await agent
        .post("/api/projects")
        .send({ client: client.id, name: "Projeto", duration: 30 })
        .expect(201)
    ).body;
    const results = await Promise.all(
      [1, 2].map((i) =>
        agent.put("/api/projects/" + p.id).send({
          version: 1,
          scenes: [{ visual: "Cena " + i, audio: "Texto", duration: 30 }],
        }),
      ),
    );
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    const history = (
      await agent.get("/api/projects/" + p.id + "/versions").expect(200)
    ).body;
    assert.equal(history.length, 2);
    await request(app)
      .post("/api/auth/login")
      .set("Origin", "not a URL")
      .send({})
      .expect(403);
    const policy = await db.query(
      "SELECT relname,relrowsecurity FROM pg_class WHERE relname IN ('users','sessions','clients','projects','versions','rate_limits')",
    );
    assert.equal(policy.rows.length, 6);
    assert.ok(policy.rows.every((t) => t.relrowsecurity));
  } finally {
    await db.close();
  }
});

test("Vercel entry point returns a safe 503 when database configuration is missing", async () => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const { default: handler } = await import("../api/index.mjs");
    const express = (await import("express")).default;
    const app = express();
    app.use(handler);
    const res = await request(app).get("/api/health").expect(503);
    assert.equal(res.body.error.includes("Serviço indisponível"), true);
    assert.equal(res.body.code, "DATABASE_URL_MISSING");
    assert.equal(JSON.stringify(res.body).includes("postgres://"), false);
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
  const config = JSON.parse(
    await readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  );
  assert.equal(config.outputDirectory, "dist");
  assert.equal(
    config.rewrites.find((r) => r.source === "/api/:path*").destination,
    "/api/index",
  );
});
