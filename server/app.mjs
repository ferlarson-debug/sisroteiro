import express from "express";
import { generateScript, defaultModel } from "./ai.mjs";
import {
  openDatabase,
  one,
  all,
  run,
  transaction,
  consumeLimit,
  saveVersion,
} from "./database.mjs";
import {
  randomUUID,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { z } from "zod";
import PDFDocument from "pdfkit";
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "docx";
export async function createApp(options = {}) {
  const db = options.database || openDatabase();
  const app = express();
  if (process.env.VERCEL || process.env.TRUST_PROXY === "1")
    app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use((req, res, next) => {
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Cache-Control", "no-store");
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.get("origin")) {
      try {
        if (new URL(req.get("origin")).host !== req.get("host"))
          return res.status(403).json({ error: "Origem não autorizada" });
      } catch {
        return res.status(403).json({ error: "Origem não autorizada" });
      }
    }
    next();
  });
  app.get("/api/health", async (req, res) => {
    await all(
      db,
      "SELECT 1 FROM users,sessions,clients,projects,versions,rate_limits LIMIT 0",
    );
    res.json({ ok: true });
  });
  const userSchema = z.object({
    email: z
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    password: z.string().min(12).max(200),
    name: z.string().trim().min(2).max(120),
  });
  const loginSchema = userSchema.omit({ name: true });
  async function issue(res, user) {
    const token = randomBytes(32).toString("hex");
    await run(
      db,
      'INSERT INTO sessions(token,"user",expires) VALUES(?,?,?)',
      createHash("sha256").update(token).digest("hex"),
      user.id,
      Date.now() + 86400000,
    );
    res.cookie("session", token, {
      httpOnly: true,
      sameSite: "strict",
      secure:
        process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL),
      maxAge: 86400000,
      path: "/",
    });
    return { id: user.id, name: user.name, email: user.email };
  }
  app.use("/api/auth", async (req, res, next) => {
    const key =
      "auth:" +
      createHash("sha256")
        .update(req.ip || "unknown")
        .digest("hex");
    if (!(await consumeLimit(db, key, 20, 900000)))
      return res
        .status(429)
        .json({ error: "Muitas tentativas. Aguarde 15 minutos." });
    next();
  });
  app.post("/api/auth/register", async (req, res) => {
    const data = userSchema.parse(req.body);
    const salt = randomBytes(16).toString("hex");
    const u = { id: randomUUID(), org: randomUUID(), ...data };
    try {
      await run(
        db,
        "INSERT INTO users VALUES(?,?,?,?,?)",
        u.id,
        u.org,
        u.email,
        u.name,
        salt + ":" + scryptSync(u.password, salt, 64).toString("hex"),
      );
    } catch (e) {
      if (e.code === "23505" || e.code === "ER_DUP_ENTRY")
        return res
          .status(409)
          .json({ error: "Não foi possível criar a conta com esse e-mail" });
      throw e;
    }
    res.status(201).json(await issue(res, u));
  });
  app.post("/api/auth/login", async (req, res) => {
    const data = loginSchema.parse(req.body);
    const u = await one(db, "SELECT * FROM users WHERE email=?", data.email);
    const [salt, hash] = (u?.password || "dummy:" + "00".repeat(64)).split(":");
    const valid = timingSafeEqual(
      scryptSync(data.password, salt, 64),
      Buffer.from(hash, "hex"),
    );
    if (!u || !valid)
      return res.status(401).json({ error: "E-mail ou senha inválidos" });
    res.json(await issue(res, u));
  });
  app.use("/api", async (req, res, next) => {
    const token =
      (req.headers.cookie || "")
        .split(";")
        .map((s) => s.trim())
        .find((s) => s.startsWith("session="))
        ?.slice(8) || "";
    req.session = createHash("sha256").update(token).digest("hex");
    req.user = await one(
      db,
      'SELECT u.id,u.org,u.name,u.email FROM sessions s JOIN users u ON u.id=s."user" WHERE s.token=? AND s.expires>?',
      req.session,
      Date.now(),
    );
    if (!req.user) return res.status(401).json({ error: "Entre na sua conta" });
    next();
  });
  app.get("/api/capabilities", async (req, res) =>
    res.json({
      ai: Boolean(process.env.AI_API_KEY),
      aiProvider: "OpenAI",
      database: db.dialect === "mysql" ? "MySQL" : "PostgreSQL",
      aiModel: process.env.AI_MODEL || defaultModel,
    }),
  );
  app.get("/api/me", async (req, res) => res.json(req.user));
  app.post("/api/logout", async (req, res) => {
    await run(db, "DELETE FROM sessions WHERE token=?", req.session);
    res.clearCookie("session", { path: "/" }).json({ ok: true });
  });
  const clientSchema = z.object({
    name: z.string().trim().min(2).max(160),
    segment: z.string().max(200).default(""),
    audience: z.string().max(1000).default(""),
    description: z.string().max(20000).default(""),
  });
  app.get("/api/clients", async (req, res) =>
    res.json(
      await all(
        db,
        "SELECT * FROM clients WHERE org=? ORDER BY name",
        req.user.org,
      ),
    ),
  );
  app.post("/api/clients", async (req, res) => {
    const d = clientSchema.parse(req.body);
    const id = randomUUID();
    await run(
      db,
      "INSERT INTO clients VALUES(?,?,?,?,?,?)",
      id,
      req.user.org,
      d.name,
      d.segment,
      d.audience,
      d.description,
    );
    res.status(201).json({ id, ...d });
  });
  app.get("/api/projects", async (req, res) =>
    res.json(
      (
        await all(
          db,
          'SELECT p.*,c.name AS "clientName" FROM projects p JOIN clients c ON c.id=p.client WHERE p.org=? ORDER BY p.created_at DESC,p.id DESC',
          req.user.org,
        )
      ).map((p) => ({ ...p, scenes: JSON.parse(p.scenes) })),
    ),
  );
  const projectSchema = z.object({
    client: z.string(),
    name: z.string().trim().min(2).max(160),
    objective: z.string().max(20000).default(""),
    duration: z.number().int().min(5).max(3600),
  });
  app.post("/api/projects", async (req, res) => {
    const d = projectSchema.parse(req.body);
    if (
      !(await one(
        db,
        "SELECT id FROM clients WHERE id=? AND org=?",
        d.client,
        req.user.org,
      ))
    )
      return res.status(404).json({ error: "Cliente não encontrado" });
    const id = randomUUID();
    await transaction(db, async (tx) => {
      await run(
        tx,
        "INSERT INTO projects(id,org,client,name,objective,duration,status,scenes,version) VALUES(?,?,?,?,?,?,?,?,?)",
        id,
        req.user.org,
        d.client,
        d.name,
        d.objective,
        d.duration,
        "Em elaboração",
        "[]",
        1,
      );
      await run(
        tx,
        "INSERT INTO versions(project,version,scenes,created) VALUES(?,?,?,?)",
        id,
        1,
        "[]",
        new Date().toISOString(),
      );
    });
    res.status(201).json({ id, ...d });
  });
  app.use("/api/projects/:id", async (req, res, next) => {
    req.project = await one(
      db,
      "SELECT * FROM projects WHERE id=? AND org=?",
      req.params.id,
      req.user.org,
    );
    if (!req.project)
      return res.status(404).json({ error: "Projeto não encontrado" });
    next();
  });
  const sceneSchema = z.object({
    visual: z.string().max(10000),
    audio: z.string().max(10000),
    duration: z.number().int().min(1).max(3600),
  });
  app.put("/api/projects/:id", async (req, res) => {
    const d = z
      .object({
        version: z.number().int().positive(),
        scenes: z.array(sceneSchema).max(200),
      })
      .parse(req.body);
    const version = await saveVersion(db, req.project, d.version, d.scenes);
    res.json({ version });
  });
  app.post("/api/projects/:id/generate", async (req, res) => {
    const { version } = z
      .object({ version: z.number().int().positive() })
      .parse(req.body);
    const p = req.project;
    if (p.version !== version)
      return res
        .status(409)
        .json({ error: "Recarregue o projeto antes de gerar." });
    if (!process.env.AI_API_KEY)
      return res
        .status(503)
        .json({ error: "A integração de IA ainda não está configurada." });
    if (!(await consumeLimit(db, "ai:" + req.user.org, 5, 3600000)))
      return res
        .status(429)
        .json({ error: "Limite de cinco gerações por hora atingido." });
    const client = await one(
      db,
      "SELECT * FROM clients WHERE id=? AND org=?",
      p.client,
      req.user.org,
    );
    const scenes = await generateScript({ client, project: p });
    const saved = await saveVersion(db, p, version, scenes);
    res.json({ scenes, version: saved });
  });
  app.get("/api/projects/:id/versions", async (req, res) =>
    res.json(
      (
        await all(
          db,
          "SELECT * FROM versions WHERE project=? ORDER BY version DESC",
          req.project.id,
        )
      ).map((v) => ({ ...v, scenes: JSON.parse(v.scenes) })),
    ),
  );
  app.get("/api/projects/:id/export/:format", async (req, res, next) => {
    try {
      const p = req.project,
        scenes = JSON.parse(p.scenes),
        client = await one(db, "SELECT name FROM clients WHERE id=?", p.client);
      const title = `${p.name} • ${client.name} • v${p.version}`;
      const metadata = `${new Date().toISOString().slice(0, 10)} | Sisroteiro | Duração planejada: ${p.duration}s`;
      if (req.params.format === "pdf") {
        res.type("application/pdf").attachment("roteiro.pdf");
        const doc = new PDFDocument({ margin: 45 });
        doc.pipe(res);
        doc
          .fontSize(19)
          .text(title)
          .moveDown()
          .fontSize(10)
          .text(metadata)
          .moveDown()
          .text(p.objective || "")
          .moveDown();
        let time = 0;
        for (const [i, s] of scenes.entries()) {
          if (doc.y > 600) doc.addPage();
          doc
            .fontSize(12)
            .text(`Cena ${i + 1} | ${time}s - ${time + s.duration}s`)
            .moveDown(0.5);
          doc
            .fontSize(10)
            .text("VÍDEO / IMAGEM")
            .text(s.visual)
            .moveDown()
            .text("ÁUDIO / NARRAÇÃO")
            .text(s.audio)
            .moveDown();
          time += s.duration;
        }
        doc.end();
        return;
      }
      if (req.params.format === "docx") {
        const cell = (text) =>
          new TableCell({ children: [new Paragraph(text)] });
        let time = 0;
        const rows = [
          new TableRow({
            children: [cell("VÍDEO / IMAGEM"), cell("ÁUDIO / NARRAÇÃO")],
          }),
        ];
        scenes.forEach((s, i) => {
          rows.push(
            new TableRow({
              children: [
                cell(
                  `Cena ${i + 1} | ${time}s - ${time + s.duration}s\n${s.visual}`,
                ),
                cell(s.audio),
              ],
            }),
          );
          time += s.duration;
        });
        const doc = new Document({
          sections: [
            {
              children: [
                new Paragraph({ text: title, heading: "Heading1" }),
                new Paragraph(metadata),
                new Paragraph(p.objective || ""),
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows,
                }),
              ],
            },
          ],
        });
        res
          .type(
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          )
          .attachment("roteiro.docx")
          .send(await Packer.toBuffer(doc));
        return;
      }
      res.status(404).json({ error: "Formato não disponível" });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/projects/:id/narration", async (req, res) => {
    res
      .type("text/plain")
      .attachment("narracao.txt")
      .send(
        JSON.parse(req.project.scenes)
          .map((s) => s.audio)
          .join("\n\n"),
      );
  });
  app.use("/api", async (req, res) =>
    res.status(404).json({ error: "Recurso não encontrado" }),
  );
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    if (err instanceof z.ZodError)
      return res.status(400).json({
        error: "Confira os campos informados",
        details: err.issues.map((i) => i.path.join(".")),
      });
    if (err.status === 413)
      return res
        .status(413)
        .json({ error: "Conteúdo excede o limite de 1 MB" });
    if (err.status === 400)
      return res.status(400).json({ error: "JSON inválido" });
    if ([409, 502, 503].includes(err.status))
      return res.status(err.status).json({ error: err.message });
    console.error("Request failed:", err.name, err.code || "");
    res.status(500).json({ error: "Não foi possível concluir a operação" });
  });
  return { app, db };
}
