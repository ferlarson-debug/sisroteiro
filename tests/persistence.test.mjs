import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { testApp } from "./helpers.mjs";
test("accounts and client records survive database reopening", async () => {
  const dir = mkdtempSync(join(tmpdir(), "sisroteiro-test-"));
  let current;
  try {
    current = await testApp(join(dir, "pgdata"));
    const agent = request.agent(current.app);
    await agent
      .post("/api/auth/register")
      .send({
        name: "Teste",
        email: "persist@example.com",
        password: "persistence-password",
      })
      .expect(201);
    await agent
      .post("/api/clients")
      .send({ name: "Marca persistente" })
      .expect(201);
    await current.db.close();
    current = null;
    current = await testApp(join(dir, "pgdata"));
    const restored = request.agent(current.app);
    await restored
      .post("/api/auth/login")
      .send({ email: "persist@example.com", password: "persistence-password" })
      .expect(200);
    assert.equal(
      (await restored.get("/api/clients").expect(200)).body[0].name,
      "Marca persistente",
    );
  } finally {
    await current?.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
