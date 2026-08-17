#!/usr/bin/env bun

import { handleDiagnostic } from "../src/diagnostic/diagnostic.handle";
import { runCli } from "../src/main/main.command";

const rawArgs = process.argv.slice(2);

try {
  await runCli(rawArgs);
} catch (error) {
  handleDiagnostic(error, rawArgs);
}
