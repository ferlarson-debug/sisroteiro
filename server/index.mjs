import express from "express";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { createApp } from "./app.mjs";
import { openDatabase, all } from "./database.mjs";

let databaseOption;

function isPlaceholder(url) {
  if (!url) return true;
  return /HOST_POOLER_SUPABASE|PROJECT_REF|SENHA_CODIFICADA|example\.com|placeholder/i.test(
    url,
  );
}

if (isPlaceholder(process.env.DATABASE_URL)) {
  const { createEmbeddedDatabase } = await import("./embedded-db.mjs");
  databaseOption = await createEmbeddedDatabase();
} else {
  try {
    const candidateDb = openDatabase();
    await all(candidateDb, "SELECT 1 LIMIT 1");
    databaseOption = candidateDb;
  } catch (err) {
    console.warn(
      `[Sisroteiro] Remote database unreachable (${err.code || err.message}). Falling back to embedded in-memory PostgreSQL...`,
    );
    const { createEmbeddedDatabase } = await import("./embedded-db.mjs");
    databaseOption = await createEmbeddedDatabase();
  }
}

const { app, db } = await createApp(
  databaseOption ? { database: databaseOption } : {},
);

const isProduction = process.env.NODE_ENV === "production";
const distPath = fileURLToPath(new URL("../dist/", import.meta.url));

if (!isProduction) {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true, host: "0.0.0.0" },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  if (existsSync(distPath)) {
    app.use(
      express.static(distPath, {
        dotfiles: "deny",
      }),
    );
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(join(distPath, "index.html"));
    });
  }
}

const PORT = 3000;
const server = app.listen(PORT, "0.0.0.0", () =>
  console.log(`Sisroteiro iniciado na porta ${PORT}`),
);

for (const signal of ["SIGTERM", "SIGINT"])
  process.once(signal, () => {
    server.close(async () => {
      await db?.close?.();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
