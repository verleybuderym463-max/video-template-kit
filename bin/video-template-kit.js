#!/usr/bin/env node
import { open } from "node:fs/promises";
import { prepare, validate, ValidationError } from "../src/index.js";

const usage = "Usage: video-template-kit <validate|prepare> <configuration.json>\nOffline only: no uploads, provider requests, media reads or .env loading.";
const [command, file, ...extra] = process.argv.slice(2);
if ((command === "--help" || command === "help") && !file && !extra.length) {
  console.log(usage);
} else if (!["validate", "prepare"].includes(command) || !file || extra.length) {
  console.error(usage);
  process.exitCode = 2;
} else {
  let config;
  try {
    const handle = await open(file, "r");
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.size > 1024 * 1024) throw new Error("Configuration must be a regular file of at most 1 MiB.");
      const bytes = await handle.readFile();
      if (bytes.length > 1024 * 1024) throw new Error("Configuration exceeds 1 MiB.");
      config = JSON.parse(bytes.toString("utf8"));
    } finally { await handle.close(); }
  } catch {
    console.error(JSON.stringify({ ok: false, code: "CONFIGURATION_READ_ERROR", message: "Cannot read a JSON configuration of at most 1 MiB. File contents were not printed." }));
    process.exitCode = 2;
  }
  if (config !== undefined) {
    const result = validate(config);
    if (!result.ok) {
      console.error(JSON.stringify(result, null, 2));
      process.exitCode = 1;
    } else {
      try { console.log(JSON.stringify(command === "prepare" ? prepare(config) : result, null, 2)); }
      catch (error) {
        console.error(JSON.stringify(error instanceof ValidationError ? { ok: false, errors: error.errors } : { ok: false, code: "PREPARATION_ERROR", message: "Offline request preparation failed." }));
        process.exitCode = 1;
      }
    }
  }
}
