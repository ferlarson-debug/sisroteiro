import { mkdtemp, cp, mkdir, rm, access, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
const root = resolve(".");
const output = resolve(process.argv[2] || "artifacts/sisroteiro-cpanel.tar.gz");
await access(join(root, "dist/index.html"));
const stage = await mkdtemp(join(tmpdir(), "sisroteiro-package-"));
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0)
    throw new Error("Falha ao preparar pacote: " + command);
}
try {
  for (const file of [
    "package.json",
    "package-lock.json",
    "app.cjs",
    ".env.example",
    "README.md",
    "COMECE_AQUI.md",
  ])
    await copyFile(join(root, file), join(stage, file));
  for (const folder of [
    "server",
    "dist",
    "scripts",
    "mysql",
    "supabase",
    "docs",
  ])
    await cp(join(root, folder), join(stage, folder), { recursive: true });
  run("npm", ["ci", "--omit=dev", "--no-audit", "--no-fund"], { cwd: stage });
  await mkdir(dirname(output), { recursive: true });
  run("tar", ["-czf", output, "-C", stage, "."]);
  console.log("Pacote cPanel criado:", output);
} finally {
  await rm(stage, { recursive: true, force: true });
}
