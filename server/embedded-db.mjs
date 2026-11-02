import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

export async function createEmbeddedDatabase() {
  console.log(
    "[Sisroteiro] Initializing in-memory PostgreSQL database (PGlite)...",
  );
  const pglite = new PGlite();
  try {
    await pglite.exec(`
      DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    const schemaSql = await readFile(
      new URL("../supabase/migrations/202610240001_initial.sql", import.meta.url),
      "utf8",
    );
    await pglite.exec(schemaSql);
    console.log("[Sisroteiro] In-memory database ready.");
  } catch (err) {
    console.warn("[Sisroteiro] In-memory database warning:", err.message);
  }
  const wrap = (connection) => ({
    async query(sql, args = []) {
      const result = await connection.query(sql, args);
      return { rows: result.rows, rowCount: result.affectedRows };
    },
  });
  return {
    ...wrap(pglite),
    dialect: "postgres",
    transaction: (work) => pglite.transaction((tx) => work(wrap(tx))),
    close: () => pglite.close(),
  };
}
