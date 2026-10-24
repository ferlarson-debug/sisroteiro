import { openDatabase } from "../server/database.mjs";
import { applyInitialSchema } from "../server/migrations.mjs";
let db;
try {
  db = openDatabase();
  await applyInitialSchema(db);
  console.log("Esquema inicial aplicado.");
} catch (error) {
  console.error(
    "Não foi possível aplicar o esquema:",
    error.code || error.name,
  );
  process.exitCode = 1;
} finally {
  if (db) await db.close();
}
