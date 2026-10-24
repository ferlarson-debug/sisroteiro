import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { openDatabase, consumeLimit } from "../server/database.mjs";
import { applyInitialSchema } from "../server/migrations.mjs";
import { createApp } from "../server/app.mjs";
import { apiScenario } from "./api-scenario.mjs";

if (!process.env.TEST_DATABASE_URL?.startsWith("mysql:"))
  throw new Error(
    "Configure TEST_DATABASE_URL para um servidor MySQL de testes com permissão CREATE DATABASE. Nunca use credenciais de produção.",
  );
async function mysqlApp() {
  const env = { DATABASE_URL: process.env.TEST_DATABASE_URL };
  const admin = openDatabase(env);
  const name = "sisroteiro_test_" + randomUUID().replaceAll("-", "");
  await admin.query(
    `CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  const url = new URL(env.DATABASE_URL);
  url.pathname = "/" + name;
  const db = openDatabase({ DATABASE_URL: url.href });
  try {
    await applyInitialSchema(db);
    await applyInitialSchema(db);
    const originalClose = db.close;
    db.close = async () => {
      await originalClose();
      try {
        await admin.query(`DROP DATABASE \`${name}\``);
      } finally {
        await admin.close();
      }
    };
    return createApp({ database: db });
  } catch (error) {
    await db.close();
    await admin.query(`DROP DATABASE \`${name}\``);
    await admin.close();
    throw error;
  }
}
test("MySQL real: API, authentication, isolation, editing, versions and exports", () =>
  apiScenario(mysqlApp));
test("MySQL real: shared rate limits, concurrent writes, rollback and durable sessions", async () => {
  const { app, db } = await mysqlApp();
  try {
    const a = request.agent(app);
    const registration = await a
      .post("/api/auth/register")
      .send({
        name: "Autora",
        email: "mysql@example.com",
        password: "long-test-password-123",
      })
      .expect(201);
    const second = (await createApp({ database: db })).app;
    await request(second)
      .get("/api/me")
      .set("Cookie", registration.headers["set-cookie"][0].split(";")[0])
      .expect(200);
    const limits = await Promise.all(
      Array.from({ length: 8 }, () => consumeLimit(db, "ai:test", 5, 3600000)),
    );
    assert.equal(limits.filter(Boolean).length, 5);
    const c = (
      await a
        .post("/api/clients")
        .send({ name: "Marca com acentuação 🎬" })
        .expect(201)
    ).body;
    const p = (
      await a
        .post("/api/projects")
        .send({ client: c.id, name: "Projeto MySQL", duration: 30 })
        .expect(201)
    ).body;
    const results = await Promise.all(
      [1, 2].map((i) =>
        a
          .put("/api/projects/" + p.id)
          .send({
            version: 1,
            scenes: [{ visual: "Cena " + i, audio: "Narração", duration: 30 }],
          }),
      ),
    );
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    assert.equal(
      (await a.get("/api/projects/" + p.id + "/versions")).body.length,
      2,
    );
    await assert.rejects(
      () =>
        db.transaction(async (tx) => {
          await tx.query("UPDATE projects SET name=? WHERE id=?", [
            "Não deve persistir",
            p.id,
          ]);
          throw new Error("rollback-test");
        }),
      /rollback-test/,
    );
    assert.equal((await a.get("/api/projects")).body[0].name, "Projeto MySQL");
    assert.equal((await a.get("/api/capabilities")).body.database, "MySQL");
  } finally {
    await db.close();
  }
});
