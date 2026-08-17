import type { IConfig } from "@cratenaut/core";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { diagnostics } from "../diagnostic/diagnostic.catalog";
import { resolveConfigPath } from "./config.path";
import type { IConfigArguments, ILoadedConfig } from "./config.types";

/**
 * 判断值是否为可用配置对象
 */
function isConfig(value: unknown): value is IConfig {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.project === "string" && Array.isArray(record.servers);
}

/**
 * 加载配置文件默认导出
 */
export async function loadConfig(args: IConfigArguments): Promise<ILoadedConfig> {
  const path = resolveConfigPath(args);

  if (!(await Bun.file(path).exists())) {
    throw diagnostics.CRN_CLI_1001({ path });
  }

  try {
    const url = pathToFileURL(path);
    url.searchParams.set("cratenaut", String(Date.now()));
    const module = (await import(url.href)) as Readonly<Record<string, unknown>>;

    if (!isConfig(module.default)) {
      throw new TypeError("配置文件必须默认导出 defineConfig() 的结果");
    }

    const directory = dirname(path);
    return Object.freeze({
      config: module.default,
      path,
      directory,
      informationDirectory: resolve(directory, ".cratenaut"),
    });
  } catch (error) {
    throw diagnostics.CRN_CLI_1002({ path, cause: error, sources: [path] });
  }
}
