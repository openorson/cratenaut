import { defineCommand } from "citty";

import { assertManagedContainer, selectContainer } from "../../container/container.select";
import { diagnostics } from "../../diagnostic/diagnostic.catalog";
import { prepareServerOperations } from "../../operation/operation.prepare";
import { loadRuntime } from "../../runtime/runtime.load";
import type { IRuntimeArguments } from "../../runtime/runtime.types";
import { commonArguments } from "../commands.arguments";

/**
 * 在单个托管容器中执行命令
 */
export const execCommand = defineCommand({
  meta: { name: "exec", description: "在容器中执行命令" },
  args: {
    ...commonArguments,
    resource: {
      type: "string",
      alias: "r",
      description: "容器资源标识或 crate/resource",
    },
    command: {
      type: "positional",
      description: "要执行的程序，程序参数包含选项时应在命令前添加 --",
      required: true,
    },
    interactive: {
      type: "boolean",
      alias: "i",
      description: "保持标准输入打开",
    },
    tty: {
      type: "boolean",
      alias: "t",
      description: "分配终端",
    },
    user: {
      type: "string",
      alias: "u",
      description: "容器内的用户或用户组",
    },
    workdir: {
      type: "string",
      alias: "w",
      description: "容器内工作目录",
    },
  },
  run: async ({ args, rawArgs }) => {
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
    const separator = rawArgs.indexOf("--");
    const command = separator === -1 ? args._ : rawArgs.slice(separator + 1);
    await operation.docker.exec(container.name, command, {
      interactive: args.interactive === true,
      tty: args.tty === true,
      user: args.user,
      workingDirectory: args.workdir,
    });
  },
});
