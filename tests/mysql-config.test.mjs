import { test } from "node:test";
import assert from "node:assert/strict";
import { mysqlConfig } from "../server/mysql.mjs";
test("MySQL configuration handles encoding, TLS and local connections safely", () => {
  const local = mysqlConfig({
    DATABASE_URL: "mysql://cp_user:p%40ss%3Aword@localhost/cp_database",
  });
  assert.equal(local.password, "p@ss:word");
  assert.equal(local.database, "cp_database");
  assert.equal(local.multipleStatements, false);
  assert.equal(local.ssl, undefined);
  const remote = mysqlConfig({
    DATABASE_URL: "mysql://user:placeholder@db.example/database",
  });
  assert.equal(remote.ssl.rejectUnauthorized, true);
  assert.throws(
    () =>
      mysqlConfig({
        DATABASE_URL: "mysql://user:placeholder@db.example/database",
        MYSQL_SSL: "false",
      }),
    /TLS/,
  );
  assert.throws(
    () => mysqlConfig({ DATABASE_URL: "mysql://localhost/" }),
    /host/,
  );
});
