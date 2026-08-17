import { defineCommand } from "citty";

import { prepareServerOperations } from "../../operation/operation.prepare";
import { loadRuntime } from "../../runtime/runtime.load";
import type { IRuntimeArguments } from "../../runtime/runtime.types";
import { commonArguments } from "../commands.arguments";

/**
 * 查看目标服务器上的部署状态历史
 */
export const historyCommand = defineCommand({
  meta: { name: "history", description: "查看部署历史" },
  args: {
    ...commonArguments,
    limit: {
      type: "string",
      alias: "n",
      description: "最多显示的历史数量",
      default: "20",
    },
  },
  run: async ({ args }) => {
    const runtime = await loadRuntime(args as unknown as IRuntimeArguments);
    const operations = await prepareServerOperations(runtime);
    const limit = Number(args.limit);

    if (!Number.isInteger(limit) || limit < 1 || limit > 1_000) {
      throw new TypeError("--limit 必须是 1 至 1000 的整数");
    }

    for (const operation of operations) {
      const result = await operation.connection.execute(
        "sh",
        [
          "-c",
          'directory="$1"; limit="$2"; test -d "$directory" || exit 0; ls -1t "$directory"/*.json 2>/dev/null | head -n "$limit"',
          "sh",
          operation.layout.stateHistory,
          String(limit),
        ],
        { allowFailure: true },
      );
      runtime.output.data({
        project: operation.plan.project,
        server: operation.plan.server,
        current: operation.plan.previousState,
        history: result.stdout
          .split("\n")
          .map((item) => item.trim())
          .filter((item) => item !== ""),
      });
    }
  },
});
