import { defineCommand } from "citty";

import { applyPlan } from "../../deploy/deploy.apply";
import { assertPlanAuthorized } from "../../deploy/deploy.authorize";
import { prepareServerOperations } from "../../operation/operation.prepare";
import { printPlan } from "../../plan/plan.format";
import { loadRuntime } from "../../runtime/runtime.load";
import type { IRuntimeArguments } from "../../runtime/runtime.types";
import { commonArguments, safetyArguments } from "../commands.arguments";

/**
 * 计算并应用期望状态
 */
export const deployCommand = defineCommand({
  meta: {
    name: "deploy",
    description: "计算三方差异并部署所选 Crate",
  },
  args: {
    ...commonArguments,
    ...safetyArguments,
    "dry-run": {
      type: "boolean",
      description: "只显示计划，不执行变更",
    },
    "force-unlock": {
      type: "boolean",
      description: "确认没有其他部署后清理旧部署锁",
    },
  },
  run: async ({ args }) => {
    const runtime = await loadRuntime(args as unknown as IRuntimeArguments);
    const runtimeArgs = runtime.args;
    runtime.output.intro("Cratenaut 部署");
    const operations = await prepareServerOperations(runtime);

    for (const operation of operations) {
      printPlan(operation.plan, runtime.output);
    }

    const changed = operations.reduce(
      (count, operation) => count + operation.plan.actions.filter((action) => action.operation !== "noop").length,
      0,
    );

    if (args["dry-run"] === true || changed === 0) {
      runtime.output.outro(changed === 0 ? "所有资源已是期望状态" : "预演完成，未执行任何变更");
      return;
    }

    for (const operation of operations) {
      assertPlanAuthorized(operation.plan, runtimeArgs);
    }

    if (runtimeArgs.yes !== true) {
      const confirmed = await runtime.output.confirm(`将执行 ${changed} 项操作，是否继续`);

      if (!confirmed) {
        runtime.output.outro("部署已取消");
        return;
      }
    }

    for (const operation of operations) {
      const progress = runtime.output.progress(`正在部署服务器 ${operation.server.id}`);

      try {
        await applyPlan(
          operation.plan,
          operation.connection,
          operation.docker,
          operation.stateStore,
          operation.layout,
          operation.fingerprintKey,
          runtimeArgs.forceUnlock === true,
        );
        progress.stop(`服务器 ${operation.server.id} 部署成功`);
      } catch (error) {
        progress.error(`服务器 ${operation.server.id} 部署失败`);
        throw error;
      }
    }

    runtime.output.outro("部署完成");
  },
});
