import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  symlink,
  lstat,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
test("cPanel deploy preserves local environment and CloudLinux node_modules symlink", async () => {
  const base = await mkdtemp(join(tmpdir(), "sisroteiro-cpanel-test-"));
  const stage = join(base, "stage"),
    app = join(base, "app"),
    venv = join(base, "virtualenv");
  try {
    await mkdir(app, { recursive: true });
    await mkdir(venv);
    await symlink(venv, join(app, "node_modules"), "dir");
    await writeFile(join(app, ".env"), "TEST_PRESERVE=true\n");
    for (const dir of [
      "server",
      "dist",
      "scripts",
      "mysql",
      "supabase",
      "docs",
      "node_modules",
    ])
      await mkdir(join(stage, dir), { recursive: true });
    for (const file of [
      "app.cjs",
      "package.json",
      "package-lock.json",
      ".env.example",
      "README.md",
      "COMECE_AQUI.md",
    ])
      await writeFile(join(stage, file), "test fixture");
    await writeFile(join(stage, "dist/index.html"), "application");
    await writeFile(join(stage, "node_modules/runtime.txt"), "dependency");
    const archive = join(base, "release.tar.gz");
    assert.equal(
      spawnSync("tar", ["-czf", archive, "-C", stage, "."]).status,
      0,
    );
    const result = spawnSync(
      "bash",
      [resolve("scripts/deploy-cpanel.sh"), archive],
      { env: { ...process.env, CPANEL_APP_ROOT: app }, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.ok((await lstat(join(app, "node_modules"))).isSymbolicLink());
    assert.equal(
      await readFile(join(app, ".env"), "utf8"),
      "TEST_PRESERVE=true\n",
    );
    assert.equal(
      await readFile(join(venv, "runtime.txt"), "utf8"),
      "dependency",
    );
    await lstat(join(app, "tmp/restart.txt"));
    await writeFile(join(stage, ".env"), "must not deploy");
    spawnSync("tar", ["-czf", archive, "-C", stage, "."]);
    assert.equal(
      spawnSync("bash", [resolve("scripts/deploy-cpanel.sh"), archive], {
        env: { ...process.env, CPANEL_APP_ROOT: app },
      }).status,
      1,
    );
    assert.equal(
      await readFile(join(app, ".env"), "utf8"),
      "TEST_PRESERVE=true\n",
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});
