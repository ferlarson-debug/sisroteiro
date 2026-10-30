import pg from "pg";
import { configError } from "./database-errors.mjs";
import { openMysql } from "./mysql.mjs";

export function databaseConfig(env = process.env) {
  if (!env.DATABASE_URL)
    throw configError(
      "DATABASE_URL_MISSING",
      "Configure DATABASE_URL com a conexão MySQL ou PostgreSQL.",
    );
  let url;
  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    throw configError("DATABASE_URL_INVALID", "DATABASE_URL inválida.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw configError(
      "DATABASE_PROTOCOL_INVALID",
      "DATABASE_URL deve usar postgres:// ou postgresql://.",
    );
  if (!url.hostname || !url.username || !url.pathname.slice(1) || url.hash)
    throw configError(
      "DATABASE_ADDRESS_INVALID",
      "Informe usuário, host e banco válidos; codifique caracteres especiais da senha para URL.",
    );
  const local =
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) && !env.VERCEL;
  // pg connection-string SSL options must not override certificate validation.
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
    url.searchParams.delete(key);
  return {
    connectionString: url.toString(),
    ssl: local
      ? false
      : {
          rejectUnauthorized: true,
          ...(env.SUPABASE_DB_CA
            ? { ca: env.SUPABASE_DB_CA.replace(/\\n/g, "\n") }
            : {}),
        },
    max: 2,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    statement_timeout: 15000,
    allowExitOnIdle: true,
  };
}

export function openDatabase(env = process.env) {
  if (env.DATABASE_URL?.startsWith("mysql:")) return openMysql(env);
  const pool = new pg.Pool(databaseConfig(env));
  pool.on("error", (error) =>
    console.error("Database pool error:", error.code || "unknown"),
  );
  return {
    query: (sql, args) => pool.query(sql, args),
    async transaction(work) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const value = await work({
          query: (sql, args) => client.query(sql, args),
        });
        await client.query("COMMIT");
        return value;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}

// SQL statements are internal constants; values are always bound parameters.
function statement(sql, db) {
  if (db.dialect === "mysql")
    return sql.replace(/"([A-Za-z_][A-Za-z0-9_]*)"/g, "`$1`");
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}
export async function one(db, sql, ...args) {
  return (await db.query(statement(sql, db), args)).rows[0];
}
export async function all(db, sql, ...args) {
  return (await db.query(statement(sql, db), args)).rows;
}
export async function run(db, sql, ...args) {
  return db.query(statement(sql, db), args);
}
export function transaction(db, work) {
  return db.transaction(work);
}

export async function consumeLimit(db, key, limit, interval) {
  const now = Date.now();
  if (db.dialect === "mysql")
    return transaction(db, async (tx) => {
      await run(
        tx,
        `INSERT INTO rate_limits(\`key\`,\`count\`,expires) VALUES(?,1,?)
      ON DUPLICATE KEY UPDATE \`count\`=IF(expires<=?,1,\`count\`+1),expires=IF(expires<=?,?,expires)`,
        key,
        now + interval,
        now,
        now,
        now + interval,
      );
      const row = await one(
        tx,
        "SELECT `count` FROM rate_limits WHERE `key`=?",
        key,
      );
      return Number(row.count) <= limit;
    });
  const result = await one(
    db,
    `INSERT INTO rate_limits(key,count,expires) VALUES(?,1,?)
    ON CONFLICT(key) DO UPDATE SET
    count=CASE WHEN rate_limits.expires<=? THEN 1 ELSE rate_limits.count+1 END,
    expires=CASE WHEN rate_limits.expires<=? THEN EXCLUDED.expires ELSE rate_limits.expires END
    RETURNING count`,
    key,
    now + interval,
    now,
    now,
  );
  return Number(result.count) <= limit;
}

export async function saveVersion(db, project, version, scenes) {
  return transaction(db, async (tx) => {
    const result = await run(
      tx,
      "UPDATE projects SET scenes=?,version=version+1 WHERE id=? AND org=? AND version=?",
      JSON.stringify(scenes),
      project.id,
      project.org,
      version,
    );
    if (!result.rowCount)
      throw Object.assign(
        new Error(
          "O roteiro mudou em outra janela. Recarregue antes de salvar.",
        ),
        { status: 409 },
      );
    await run(
      tx,
      "INSERT INTO versions(project,version,scenes,created) VALUES(?,?,?,?)",
      project.id,
      version + 1,
      JSON.stringify(scenes),
      new Date().toISOString(),
    );
    return version + 1;
  });
}
