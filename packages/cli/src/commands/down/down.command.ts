import { defineCommand } from "citty";

import { assertManagedContainer, collectContainers } from "../../container/container.select";
import { prepareServerOperations } from "../../operation/operation.prepare";
import { loadRuntime } from "../../runtime/runtime.load";
import type { IRuntimeArguments } from "../../runtime/runtime.types";
import { commonArguments } from "../commands.arguments";

/**
 * 停止托管容器但保留容器和数据
 */
export const downCommand = defineCommand({
  meta: { name: "down", description: "停止已经部署的容器" },
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

        if (state.exists) {
          assertManagedContainer(container, state, operation.plan.project, operation.plan.server);
        }

        if (state.running) {
          await operation.docker.stop(container.name, timeout);
          runtime.output.success(`容器 ${container.name} 已停止`);
        } else {
          runtime.output.info(`容器 ${container.name} 未在运行`);
        }
      }
    }
  },
});
