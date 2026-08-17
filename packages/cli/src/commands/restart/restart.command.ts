import { defineCommand } from "citty";

import { assertManagedContainer, collectContainers } from "../../container/container.select";
import { prepareServerOperations } from "../../operation/operation.prepare";
import { loadRuntime } from "../../runtime/runtime.load";
import type { IRuntimeArguments } from "../../runtime/runtime.types";
import { commonArguments } from "../commands.arguments";

/**
 * 重启已经创建的托管容器
 */
export const restartCommand = defineCommand({
  meta: { name: "restart", description: "重启已经部署的容器" },
  args: {
    ...commonArguments,
    timeout: {
      type: "string",
      description: "容器停止超时秒数",
      default: "10",
    },
  },
  run: async ({ args }) => {
    const runtime = await loadRuntime(args as unknown as IRuntimeArguments);
    const operations = await prepareServerOperations(runtime);
    const timeout = Number(args.timeout);

    if (!Number.isInteger(timeout) || timeout < 0) {
      throw new TypeError("--timeout 必须是非负整数");
    }

    for (const operation of operations) {
      for (const container of collectContainers(operation.specification)) {
        const state = await operation.docker.inspect(container.name);

        if (!state.exists) {
          runtime.output.warn(`容器 ${container.name} 尚未部署`);
          continue;
        }

        assertManagedContainer(container, state, operation.plan.project, operation.plan.server);

        await operation.docker.restart(container.name, timeout);
        runtime.output.success(`容器 ${container.name} 已重启`);
      }
    }
  },
});
