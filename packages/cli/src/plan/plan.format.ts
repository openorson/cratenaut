import type { IOutput } from "../output/output.types";
import type { IServerPlan } from "./plan.types";

const operationLabels = Object.freeze({
  noop: "不变",
  adopt: "接管",
  create: "创建",
  update: "更新",
  recreate: "重建",
  run: "执行",
  remove: "移除",
  drift: "漂移",
});

const riskLabels = Object.freeze({
  safe: "安全",
  disruptive: "中断",
  destructive: "破坏性",
  immutable: "不可修改",
  unknown: "未知",
});

/**
 * 创建不包含秘密和资源明文的计划输出
 */
export function serializePlan(plan: IServerPlan): unknown {
  return {
    project: plan.project,
    server: plan.server,
    createdAt: plan.createdAt,
    summary: Object.fromEntries(
      Object.keys(operationLabels).map((operation) => [
        operation,
        plan.actions.filter((action) => action.operation === operation).length,
      ]),
    ),
    actions: plan.actions.map((action) => ({
      crate: action.crateId,
      resource: action.resourceId,
      kind: action.kind,
      operation: action.operation,
      risk: action.risk,
      reason: action.reason,
      authorizations: action.authorizations,
    })),
  };
}

/**
 * 使用统一风格输出部署计划
 */
export function printPlan(plan: IServerPlan, output: IOutput): void {
  if (output.mode === "json") {
    output.data(serializePlan(plan));
    return;
  }

  output.step(`服务器 ${plan.server}`);

  for (const action of plan.actions) {
    const marker = action.operation === "noop" ? "·" : action.operation === "drift" ? "!" : "+";
    output.info(
      `${marker} ${action.crateId}/${action.resourceId}  ${operationLabels[action.operation]}  ${riskLabels[action.risk]}`,
    );

    if (action.operation !== "noop") {
      output.info(`  ${action.reason}`);
    }
  }

  const changed = plan.actions.filter((action) => action.operation !== "noop").length;
  output.info(`共 ${plan.actions.length} 项，${changed} 项需要操作`);
}
