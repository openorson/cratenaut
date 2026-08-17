import { defineCommand } from "citty";

import { prepareServerOperations } from "../../operation/operation.prepare";
import { loadRuntime } from "../../runtime/runtime.load";
import type { IRuntimeArguments } from "../../runtime/runtime.types";
import { commonArguments } from "../commands.arguments";

/**
 * 检查配置、连接、目录、秘密和 `Docker`
 */
export const doctorCommand = defineCommand({
  meta: { name: "doctor", description: "检查部署环境是否就绪" },
  args: commonArguments,
  run: async ({ args }) => {
    const runtime = await loadRuntime(args as unknown as IRuntimeArguments);
    runtime.output.intro("Cratenaut 环境检查");
    const operations = await prepareServerOperations(runtime);

    for (const operation of operations) {
      runtime.output.success(`服务器 ${operation.server.id} 已就绪`, {
        connection: operation.server.connection.kind,
        root: operation.layout.root,
        state: operation.plan.previousState === undefined ? "尚未部署" : operation.plan.previousState.updatedAt,
      });
    }

    runtime.output.outro("环境检查通过");
  },
});
