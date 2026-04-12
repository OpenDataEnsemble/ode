import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const projectRoot = process.cwd();
const configPath = path.join(projectRoot, "openapi.client.config.json");

async function readConfig() {
  const raw = await readFile(configPath, "utf-8");
  return JSON.parse(raw);
}

function resolvePath(maybeRelativePath) {
  if (path.isAbsolute(maybeRelativePath)) {
    return maybeRelativePath;
  }
  return path.resolve(projectRoot, maybeRelativePath);
}

async function main() {
  const config = await readConfig();
  const specFromEnv = process.env.OPENAPI_SPEC_RELATIVE_PATH?.trim();
  const outputFromEnv = process.env.OPENAPI_OUTPUT_RELATIVE_PATH?.trim();

  const sourceSpecPath = resolvePath(specFromEnv || config.sourceSpecRelativePath);
  const outputPath = resolvePath(outputFromEnv || config.outputRelativePath);

  if (!existsSync(sourceSpecPath)) {
    throw new Error(
      `OpenAPI spec not found: ${sourceSpecPath}\n` +
        "Update openapi.client.config.json or set OPENAPI_SPEC_RELATIVE_PATH.",
    );
  }

  await mkdir(outputPath, { recursive: true });

  const commandArgs = [
    "exec",
    "openapi-generator-cli",
    "generate",
    "-g",
    "typescript-fetch",
    "-i",
    sourceSpecPath,
    "-o",
    outputPath,
    "--global-property",
    "apis,models,supportingFiles",
    "--additional-properties",
    [
      "typescriptThreePlus=true",
      "supportsES6=true",
      "modelPropertyNaming=original",
      "useSingleRequestParameter=true",
      "withoutRuntimeChecks=false",
    ].join(","),
  ];

  const command = process.platform === "win32"
    ? { executable: "cmd", args: ["/d", "/s", "/c", "pnpm", ...commandArgs] }
    : { executable: "pnpm", args: commandArgs };

  const run = spawnSync(command.executable, command.args, {
    cwd: projectRoot,
    stdio: "inherit",
  });

  if (run.status !== 0) {
    throw new Error("OpenAPI generation failed. See output above.");
  }

  await addNoCheckHeader(outputPath);

  process.stdout.write(
    `Generated Synkronus client.\n- spec: ${sourceSpecPath}\n- output: ${outputPath}\n`,
  );
}

async function addNoCheckHeader(rootPath) {
  const noCheckHeader = "// @ts-nocheck\n";
  const entries = await readdir(rootPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(rootPath, entry.name);
    if (entry.isDirectory()) {
      await addNoCheckHeader(fullPath);
      continue;
    }
    if (!entry.isFile() || !fullPath.endsWith(".ts")) {
      continue;
    }
    const fileStat = await stat(fullPath);
    if (!fileStat.isFile()) {
      continue;
    }
    const current = await readFile(fullPath, "utf-8");
    if (!current.startsWith(noCheckHeader)) {
      await writeFile(fullPath, `${noCheckHeader}${current}`, "utf-8");
    }
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
