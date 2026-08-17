import { materializeConfig } from "@cratenaut/core/internal";

import { loadConfig } from "../config/config.load";
import { createSecretResolver } from "../config/config.secret";
import { createOutput } from "../output/output.instance";
import { normalizeRuntimeArguments } from "./runtime.arguments";
import { selectConfig } from "./runtime.select";
import type { IRuntimeArguments, IRuntimeContext } from "./runtime.types";

/**
 * 加载、选择并物化命令运行上下文
 */
export async function loadRuntime(args: IRuntimeArguments): Promise<IRuntimeContext> {
  const normalizedArgs = normalizeRuntimeArguments(args as Readonly<Record<string, unknown>>);
  const output = createOutput(normalizedArgs as Readonly<Record<string, unknown>>);
  const loaded = await loadConfig(normalizedArgs);
  const selectedConfig = await selectConfig(loaded.config, normalizedArgs, output);
  const secretContext = createSecretResolver({
    args: normalizedArgs,
    configDirectory: loaded.directory,
    output,
  });
  const materialized = await materializeConfig(selectedConfig, secretContext.resolver);

  return Object.freeze({
    args: normalizedArgs,
    output,
    loaded,
    selectedConfig,
    secretResolver: secretContext.resolver,
    materialized,
  });
}
