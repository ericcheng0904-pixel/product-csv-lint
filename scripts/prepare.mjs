import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// `npm install -g` from a git URL keeps npm_config_prefix set for the clone.
// That install then runs this script before devDependencies exist, so tsc is
// not on PATH. Clear the prefix and install them here. A registry tarball
// already contains dist/ and does not run prepare.
const root = fileURLToPath(new URL("..", import.meta.url));
const env = { ...process.env };
for (const key of Object.keys(env)) {
  const lower = key.toLowerCase();
  if (
    lower === "npm_config_prefix" ||
    lower === "npm_config_global" ||
    lower === "npm_config_omit" ||
    lower === "npm_config_ignore_scripts"
  ) {
    delete env[key];
  }
}

if (!existsSync(join(root, "node_modules", "typescript", "package.json"))) {
  const installed = spawnSync(
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--no-save", "--include=dev"],
    { cwd: root, env, stdio: "inherit" },
  );
  if (installed.status !== 0) process.exit(installed.status ?? 1);
}

const built = spawnSync("npm", ["run", "build"], { cwd: root, env, stdio: "inherit" });
process.exit(built.status ?? 1);
