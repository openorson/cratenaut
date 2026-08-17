import { defineCommand } from "citty";

import { prepareServerOperations } from "../../operation/operation.prepare";
import { printPlan } from "../../plan/plan.format";
import { loadRuntime } from "../../runtime/runtime.load";
import type { IRuntimeArguments } from "../../runtime/runtime.types";
import { commonArguments, safetyArguments } from "../commands.arguments";

/**
 * 显示期望状态、上次状态和实际状态之间的差异
 */
export const planCommand = defineCommand({
  meta: { name: "plan", description: "生成三方部署计划" },
  args: { ...commonArguments, ...safetyArguments },
  run: async ({ args }) => {
    const runtime = await loadRuntime(args as unknown as IRuntimeArguments);
    runtime.output.intro("Cratenaut 部署计划");
    const operations = await prepareServerOperations(runtime);

    for (const operation of operations) {
      printPlan(operation.plan, runtime.output);
    }

    runtime.output.outro("计划生成完成");
  },
});
