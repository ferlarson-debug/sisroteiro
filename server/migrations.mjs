import { readFile } from "node:fs/promises";
export async function applyInitialSchema(db) {
  if (db.dialect === "mysql") {
    const sql = await readFile(
      new URL("../mysql/migrations/001_initial.sql", import.meta.url),
      "utf8",
    );
    // The maintained schema contains no routines or delimiters inside strings.
    for (const statement of sql
      .replace(/^\s*--.*$/gm, "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await db.query(statement);
  } else {
    await db.query(
      await readFile(
        new URL(
          "../supabase/migrations/202610240001_initial.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
  }
}
