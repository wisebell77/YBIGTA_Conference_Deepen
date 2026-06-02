import { readFile, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const packageJsonPath = path.join(root, "package.json");
const nextDir = path.join(root, ".next");

const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

if (packageJson.name !== "ybigta-conference-deepen") {
  throw new Error(`Refusing to clean .next from unexpected project: ${packageJson.name ?? "unknown"}`);
}

await rm(nextDir, { recursive: true, force: true });
