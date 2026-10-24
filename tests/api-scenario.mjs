import assert from "node:assert/strict";
import request from "supertest";
export async function apiScenario(testApp) {
  const { app, db } = await testApp();
  try {
    const alice = request.agent(app),
      bob = request.agent(app);
    await request(app).get("/api/clients").expect(401);
    await alice
      .post("/api/auth/register")
      .send({
        name: "Alice",
        email: "alice@example.com",
        password: "long-password-123",
      })
      .expect(201);
    await bob
      .post("/api/auth/register")
      .send({
        name: "Bob",
        email: "bob@example.com",
        password: "long-password-456",
      })
      .expect(201);
    await request(app)
      .post("/api/auth/login")
      .send({ email: "alice@example.com", password: "incorrect-password" })
      .expect(401);
    const c = await alice
      .post("/api/clients")
      .send({ name: "Marca Alice", description: "Produtos locais" })
      .expect(201);
    assert.equal((await bob.get("/api/clients")).body.length, 0);
    await bob
      .post("/api/projects")
      .send({ client: c.body.id, name: "Intruso", duration: 30 })
      .expect(404);
    const p = await alice
      .post("/api/projects")
      .send({
        client: c.body.id,
        name: "Campanha",
        objective: "Apresentar a marca",
        duration: 30,
      })
      .expect(201);
    const scenes = [
      { visual: "Fachada", audio: "Conheça nossa marca.", duration: 30 },
    ];
    await bob
      .put("/api/projects/" + p.body.id)
      .send({ version: 1, scenes })
      .expect(404);
    await alice
      .put("/api/projects/" + p.body.id)
      .send({ version: 1, scenes })
      .expect(200);
    await alice
      .put("/api/projects/" + p.body.id)
      .send({ version: 1, scenes: [] })
      .expect(409);
    await alice
      .put("/api/projects/" + p.body.id)
      .send({ version: 2, scenes: [{ ...scenes[0], duration: -1 }] })
      .expect(400);
    const history = await alice
      .get("/api/projects/" + p.body.id + "/versions")
      .expect(200);
    assert.equal(history.body.length, 2);
    assert.deepEqual(history.body[0].scenes, scenes);
    const exported = await alice
      .get("/api/projects/" + p.body.id + "/narration")
      .expect(200);
    assert.equal(exported.text, scenes[0].audio);
    await bob.get("/api/projects/" + p.body.id + "/narration").expect(404);
    const pdf = await alice
      .get("/api/projects/" + p.body.id + "/export/pdf")
      .expect(200);
    assert.equal(pdf.body.subarray(0, 4).toString(), "%PDF");
    const docx = await alice
      .get("/api/projects/" + p.body.id + "/export/docx")
      .buffer(true)
      .parse((res, cb) => {
        const parts = [];
        res.on("data", (d) => parts.push(d));
        res.on("end", () => cb(null, Buffer.concat(parts)));
      })
      .expect(200);
    assert.equal(docx.body.subarray(0, 2).toString(), "PK");
    await bob.get("/api/projects/" + p.body.id + "/export/docx").expect(404);
    assert.equal(
      (await alice.get("/api/projects")).body[0].scenes[0].duration,
      30,
    );
    assert.equal(
      (await alice.get("/api/projects")).body[0].clientName,
      "Marca Alice",
    );
    await request(app).get("/api/health").expect(200);
    await alice
      .post("/api/auth/register")
      .send({
        name: "Duplicate",
        email: "alice@example.com",
        password: "long-password-123",
      })
      .expect(409);
    await alice.post("/api/logout").expect(200);
    await alice.get("/api/me").expect(401);
    await alice
      .post("/api/auth/login")
      .send({ email: "alice@example.com", password: "long-password-123" })
      .expect(200);
    await alice
      .post("/api/clients")
      .set("Origin", "https://evil.example")
      .send({ name: "Invalid" })
      .expect(403);
  } finally {
    await db.close();
  }
}
