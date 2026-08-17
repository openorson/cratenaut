import { materializeConfig } from "@cratenaut/core/internal";
import { defineCommand } from "citty";

import { loadConfig } from "../../config/config.load";
import { resolveConfigPath } from "../../config/config.path";
import { createSecretResolver } from "../../config/config.secret";
import { createOutput } from "../../output/output.instance";
import type { IRuntimeArguments } from "../../runtime/runtime.types";
import { commonArguments } from "../commands.arguments";

const configArguments = {
  config: commonArguments.config,
  global: commonArguments.global,
  json: commonArguments.json,
  plain: commonArguments.plain,
  verbose: commonArguments.verbose,
  "secret-key-file": commonArguments["secret-key-file"],
  "secret-key-stdin": commonArguments["secret-key-stdin"],
};

/**
 * 配置检查与查看命令
 */
export const configCommand = defineCommand({
  meta: { name: "config", description: "检查配置来源和结构" },
  subCommands: {
    path: defineCommand({
      meta: { name: "path", description: "显示本次使用的配置路径" },
      args: configArguments,
      run: ({ args }) => {
        createOutput(args).data(resolveConfigPath(args));
      },
    }),
    validate: defineCommand({
      meta: { name: "validate", description: "加载并校验配置" },
      args: configArguments,
      run: async ({ args }) => {
        const output = createOutput(args);
        const loaded = await loadConfig(args as unknown as IRuntimeArguments);
        const secretContext = createSecretResolver({
          args: args as unknown as IRuntimeArguments,
          configDirectory: loaded.directory,
          output,
        });
        const materialized = await materializeConfig(loaded.config, secretContext.resolver);
        output.success(`配置有效：${loaded.path}`, {
          project: materialized.project,
          servers: materialized.servers.length,
          crates: materialized.servers.reduce((count, server) => count + server.crates.length, 0),
        });
      },
    }),
    show: defineCommand({
      meta: { name: "show", description: "显示已遮蔽秘密的配置" },
      args: configArguments,
      run: async ({ args }) => {
        const output = createOutput(args);
        const loaded = await loadConfig(args as unknown as IRuntimeArguments);
        output.data(loaded.config);
      },
    }),
  },
});
