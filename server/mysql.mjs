import mysql from "mysql2/promise";

export function mysqlConfig(env = process.env) {
  let url;
  try {
    url = new URL(env.DATABASE_URL);
  } catch {
    throw new Error("DATABASE_URL MySQL inválida.");
  }
  if (url.protocol !== "mysql:")
    throw new Error("A conexão MySQL deve usar mysql://.");
  if (!url.hostname || !url.username || !url.pathname.slice(1))
    throw new Error("Informe host, usuário e banco na DATABASE_URL.");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (env.MYSQL_SSL === "false" && !local)
    throw new Error(
      "Conexões MySQL remotas exigem TLS com verificação de certificado.",
    );
  const tls = env.MYSQL_SSL === "true" || !local;
  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    charset: "utf8mb4",
    timezone: "Z",
    connectionLimit: 5,
    waitForConnections: true,
    queueLimit: 50,
    connectTimeout: 10000,
    multipleStatements: false,
    supportBigNumbers: true,
    ...(tls
      ? {
          ssl: {
            rejectUnauthorized: true,
            ...(env.MYSQL_SSL_CA
              ? { ca: env.MYSQL_SSL_CA.replace(/\\n/g, "\n") }
              : {}),
          },
        }
      : {}),
  };
}
export function openMysql(env = process.env) {
  const pool = mysql.createPool(mysqlConfig(env));
  const wrap = (connection) => ({
    dialect: "mysql",
    async query(sql, args = []) {
      const [result] = await connection.execute(sql, args);
      return Array.isArray(result)
        ? { rows: result, rowCount: result.length }
        : { rows: [], rowCount: result.affectedRows };
    },
  });
  return {
    ...wrap(pool),
    async transaction(work) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const value = await work(wrap(connection));
        await connection.commit();
        return value;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },
    close: () => pool.end(),
  };
}
