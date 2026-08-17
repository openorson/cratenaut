import { log } from "@clack/prompts";
import { Diagnostic } from "nostics";

import { diagnostics } from "./diagnostic.catalog";

/**
 * 输出顶层命令错误并设置退出码
 */
export function handleDiagnostic(error: unknown, args: readonly string[]): void {
  const json = args.includes("--json");
  const plain = args.includes("--plain") || !process.stderr.isTTY;
  const diagnostic =
    error instanceof Diagnostic
      ? error
      : diagnostics.CRN_CLI_9002({ detail: error instanceof Error ? error.message : String(error), cause: error });

  if (json) {
    console.error(JSON.stringify({ type: "diagnostic", ...diagnostic.toJSON() }));
  } else if (plain) {
    console.error(`[${diagnostic.code}] ${diagnostic.why}`);

    if (diagnostic.fix !== undefined) {
      console.error(`修复：${diagnostic.fix}`);
    }

    if (diagnostic.docs !== undefined) {
      console.error(`文档：${diagnostic.docs}`);
    }
  } else {
    log.error(`[${diagnostic.code}] ${diagnostic.why}`);

    if (diagnostic.fix !== undefined) {
      log.info(`修复：${diagnostic.fix}`);
    }

    if (diagnostic.docs !== undefined) {
      log.info(`文档：${diagnostic.docs}`);
    }
  }

  if (args.includes("--verbose") && error instanceof Error && error.stack !== undefined) {
    console.error(error.stack);
  }

  process.exitCode = diagnostic.code === "CRN_CLI_9001" ? 130 : 1;
}
