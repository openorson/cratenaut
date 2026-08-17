import type { IRuntimeArguments } from "../runtime/runtime.types";

/**
 * 部署执行参数
 */
export interface IApplyPlanOptions {
  readonly args: IRuntimeArguments;
  readonly informationDirectory: string;
}
