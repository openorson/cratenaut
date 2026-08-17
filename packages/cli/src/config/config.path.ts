import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";

import { diagnostics } from "../diagnostic/diagnostic.catalog";
import type { IConfigArguments } from "./config.types";

/**
 * 按固定优先级解析配置文件路径
 *
 * `--config` 优先于默认位置，`--global` 固定使用当前用户目录，不会向父目录查找
 */
export function resolveConfigPath(args: IConfigArguments, currentDirectory = process.cwd()): string {
  if (args.config !== undefined && args.global === true) {
    throw diagnostics.CRN_CLI_1005();
  }

  if (args.config !== undefined) {
    return isAbsolute(args.config) ? args.config : resolve(currentDirectory, args.config);
  }

  return args.global === true
    ? resolve(homedir(), ".cratenaut", "naut.config.ts")
    : resolve(currentDirectory, "naut.config.ts");
}
