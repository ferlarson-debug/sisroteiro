import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { createApp } from "../server/app.mjs";

export async function testApp(path) {
  const pg = new PGlite(path);
  await pg.exec(`DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
  await pg.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202610240001_initial.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const wrap = (connection) => ({
    async query(sql, args = []) {
      const result = await connection.query(sql, args);
      return { rows: result.rows, rowCount: result.affectedRows };
    },
  });
  const database = {
    ...wrap(pg),
    transaction: (work) => pg.transaction((tx) => work(wrap(tx))),
    close: () => pg.close(),
  };
  return createApp({ database });
}
