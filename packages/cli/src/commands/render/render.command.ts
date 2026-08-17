import { defineCommand } from "citty";

import { prepareServerOperations } from "../../operation/operation.prepare";
import { serializePlan } from "../../plan/plan.format";
import { loadRuntime } from "../../runtime/runtime.load";
import type { IRuntimeArguments } from "../../runtime/runtime.types";
import { commonArguments, safetyArguments } from "../commands.arguments";

/**
 * 渲染不包含秘密明文的部署说明
 */
export const renderCommand = defineCommand({
  meta: { name: "render", description: "渲染部署计划说明" },
  args: {
    ...commonArguments,
    ...safetyArguments,
    format: {
      type: "enum",
      options: ["markdown", "json"],
      description: "渲染格式",
      default: "markdown",
    },
  },
  run: async ({ args }) => {
    const runtime = await loadRuntime(args as unknown as IRuntimeArguments);
    const operations = await prepareServerOperations(runtime);

    if (args.format === "json") {
      runtime.output.data(operations.map((operation) => serializePlan(operation.plan)));
      return;
    }

    const markdown = operations
      .map(
        (operation) => `# ${operation.plan.project} / ${operation.plan.server}

${operation.plan.actions
  .map(
    (action) =>
      `- **${action.operation}** \`${action.crateId}/${action.resourceId}\` (${action.risk})\n  - ${action.reason}`,
  )
  .join("\n")}`,
      )
      .join("\n\n");
    runtime.output.markdown(markdown);
  },
});
