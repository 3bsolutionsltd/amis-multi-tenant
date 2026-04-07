import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env from repo root at startup (dev only; production uses real env vars)
try {
  const envPath = resolve(process.cwd(), "../../.env");
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = val;
  }
} catch {
  // .env not present — rely on real environment variables
}

import { buildApp } from "./app.js";

const app = buildApp();

app.listen({ port: 3000, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`API listening at ${address}`);
});
