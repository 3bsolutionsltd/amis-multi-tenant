import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Load .env from repo root at startup (dev only; production uses real env vars)
try {
  // Resolve relative to this source file (apps/api/src/index.ts → ../../../.env)
  // so it works regardless of the working directory at startup.
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const envPath = resolve(__dirname, "../../../.env");
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

// Validate required env vars before starting the server
import { assertJwtConfig } from "./lib/jwt.js";
assertJwtConfig();

import { buildApp } from "./app.js";

const app = buildApp();
const port = Number(process.env.PORT) || 3000;

app.listen({ port, host: "0.0.0.0" }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`API listening at ${address}`);
});
