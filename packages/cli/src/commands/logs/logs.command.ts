import { defineCommand } from "citty";

import { assertManagedContainer, selectContainer } from "../../container/container.select";
import { diagnostics } from "../../diagnostic/diagnostic.catalog";
import { prepareServerOperations } from "../../operation/operation.prepare";
import { loadRuntime } from "../../runtime/runtime.load";
import type { IRuntimeArguments } from "../../runtime/runtime.types";
import { commonArguments } from "../commands.arguments";

/**
 * 查看单个托管容器日志
 */
export const logsCommand = defineCommand({
  meta: { name: "logs", description: "查看容器日志" },
  args: {
    ...commonArguments,
    resource: {
      type: "string",
      alias: "r",
      description: "容器资源标识或 crate/resource",
    },
    follow: {
      type: "boolean",
      alias: "f",
      description: "持续跟随日志",
    },
    tail: {
      type: "string",
      alias: "n",
      description: "显示末尾行数",
      default: "100",
    },
    since: {
      type: "string",
      description: "只显示指定时间之后的日志",
    },
    until: {
      type: "string",
      description: "只显示指定时间之前的日志",
    },
    timestamps: {
      type: "boolean",
      alias: "t",
      description: "显示时间戳",
    },
  },
  run: async ({ args }) => {
    const runtime = await loadRuntime(args as unknown as IRuntimeArguments);
    const operations = await prepareServerOperations(runtime);

    if (operations.length !== 1) {
      throw diagnostics.CRN_CLI_1004();
    }

    const operation = operations[0]!;
    const container = await selectContainer(operation.specification, runtime.output, args.resource);
    assertManagedContainer(
      container,
      await operation.docker.inspect(container.name),
      operation.plan.project,
      operation.plan.server,
    );

    if (args.tail !== "all" && (!/^\d+$/.test(args.tail) || Number(args.tail) < 0)) {
      throw new TypeError("--tail 必须是非负整数或 all");
    }

    const dockerArgs = ["--tail", args.tail];

    if (args.follow === true) {
      dockerArgs.push("--follow");
    }

    if (args.since !== undefined) {
      dockerArgs.push("--since", args.since);
    }

    if (args.until !== undefined) {
      dockerArgs.push("--until", args.until);
    }

    if (args.timestamps === true) {
      dockerArgs.push("--timestamps");
    }

    await operation.docker.logs(
      container.name,
      dockerArgs,
      runtime.output.mode === "json"
        ? {
            stdout: (chunk) => runtime.output.data({ stream: "stdout", chunk }),
            stderr: (chunk) => runtime.output.data({ stream: "stderr", chunk }),
          }
        : undefined,
    );
  },
});
