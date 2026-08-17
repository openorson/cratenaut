import { defineCommand } from "citty";

import { assertManagedContainer, collectContainers } from "../../container/container.select";
import { prepareServerOperations } from "../../operation/operation.prepare";
import { loadRuntime } from "../../runtime/runtime.load";
import type { IRuntimeArguments } from "../../runtime/runtime.types";
import { commonArguments } from "../commands.arguments";

/**
 * 启动已经创建的托管容器
 */
export const upCommand = defineCommand({
  meta: { name: "up", description: "启动已经部署的容器" },
  args: commonArguments,
  run: async ({ args }) => {
    const runtime = await loadRuntime(args as unknown as IRuntimeArguments);
    const operations = await prepareServerOperations(runtime);

    for (const operation of operations) {
      for (const container of collectContainers(operation.specification)) {
        const state = await operation.docker.inspect(container.name);

        if (!state.exists) {
          runtime.output.warn(`容器 ${container.name} 尚未部署，请先执行 naut deploy`);
        } else if (state.running) {
          assertManagedContainer(container, state, operation.plan.project, operation.plan.server);
          runtime.output.info(`容器 ${container.name} 已在运行`);
        } else {
          assertManagedContainer(container, state, operation.plan.project, operation.plan.server);
          await operation.docker.start(container.name);
          runtime.output.success(`容器 ${container.name} 已启动`);
        }
      }
    }
  },
});
