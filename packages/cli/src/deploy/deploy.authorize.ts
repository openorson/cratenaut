import { diagnostics } from "../diagnostic/diagnostic.catalog";
import type { IServerPlan, TPlanAuthorization } from "../plan/plan.types";
import type { IRuntimeArguments } from "../runtime/runtime.types";

/**
 * 校验部署计划所需的独立授权
 *
 * `--yes` 只跳过普通确认，不会隐式授予任何高风险权限
 */
export function assertPlanAuthorized(plan: IServerPlan, args: IRuntimeArguments): void {
  const unresolved = new Set<TPlanAuthorization>();

  for (const action of plan.actions) {
    if (action.risk === "immutable" && action.operation !== "noop") {
      unresolved.add("immutable");
    }

    for (const authorization of action.authorizations) {
      const allowed =
        (authorization === "destructive" && args.allowDestructive === true) ||
        (authorization === "unknown" && args.allowUnknownChange === true) ||
        (authorization === "major" && args.allowMajor === true) ||
        (authorization === "downgrade" && args.allowDowngrade === true) ||
        (authorization === "drift" && args.overwriteDrift === true) ||
        (authorization === "prune" && args.prune === true);

      if (!allowed) {
        unresolved.add(authorization);
      }
    }
  }

  if (unresolved.size > 0) {
    throw diagnostics.CRN_CLI_3002({ risks: [...unresolved].join(", ") });
  }
}
