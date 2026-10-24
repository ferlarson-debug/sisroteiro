import { createApp } from "../server/app.mjs";

let application;
// Reuse the small PostgreSQL pool across invocations of this warm function.
export default async function handler(req, res) {
  try {
    application ||= createApp().catch((error) => {
      application = undefined;
      throw error;
    });
    const { app } = await application;
    return app(req, res);
  } catch (error) {
    console.error("API initialization failed:", error.code || error.name);
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(
      JSON.stringify({
        error:
          "Serviço indisponível. Verifique a configuração do banco no servidor.",
      }),
    );
  }
}
