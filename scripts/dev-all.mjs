import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";

function readDotEnv(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/))
      .filter(Boolean)
      .map(([, key, rawValue]) => [key, rawValue.replace(/^['"]|['"]$/g, "")]),
  );
}

const fileEnv = readDotEnv(resolve(process.cwd(), ".env.local"));
const environment = {
  ...fileEnv,
  ...process.env,
  DATA_DIR: process.env.DATA_DIR || resolve(process.cwd(), ".data"),
  SUPABASE_URL: process.env.SUPABASE_URL || fileEnv.SUPABASE_URL || fileEnv.VITE_SUPABASE_URL,
  SUPABASE_ANON_KEY:
    process.env.SUPABASE_ANON_KEY || fileEnv.SUPABASE_ANON_KEY || fileEnv.VITE_SUPABASE_ANON_KEY,
};

const node = process.execPath;
const viteEntry = resolve(process.cwd(), "node_modules", "vite", "bin", "vite.js");
const server = spawn(node, ["server.js"], { cwd: process.cwd(), env: environment, stdio: "inherit" });
const vite = spawn(node, [viteEntry, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: environment,
  stdio: "inherit",
});

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  server.kill();
  vite.kill();
  process.exitCode = code;
}

server.on("exit", (code) => {
  if (!shuttingDown && code !== 0) shutdown(code ?? 1);
});
vite.on("exit", (code) => {
  if (!shuttingDown && code !== 0) shutdown(code ?? 1);
});
process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());
