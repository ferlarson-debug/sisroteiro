import express from "express";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.mjs";
const { app, db } = await createApp();
app.use(
  express.static(fileURLToPath(new URL("../dist/", import.meta.url)), {
    dotfiles: "deny",
  }),
);
const server = app.listen(Number(process.env.PORT || 3001), "0.0.0.0", () =>
  console.log("Sisroteiro iniciado"),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.once(signal, () => {
    server.close(async () => {
      await db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
