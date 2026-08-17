import type { TChangeRisk } from "@cratenaut/core/internal";

import type { IDeploymentState } from "../state/state.types";
import type { IServerSpecification, TResourceSpecification } from "../specification/specification.types";

/**
 * 计划操作
 */
export type TPlanOperation = "noop" | "adopt" | "create" | "update" | "recreate" | "run" | "remove" | "drift";

/**
 * 计划所需的额外授权
 */
export type TPlanAuthorization = "destructive" | "unknown" | "major" | "downgrade" | "drift" | "prune" | "immutable";

/**
 * 单个计划操作
 */
export interface IPlanAction {
  readonly crateId: string;
  readonly resourceId: string;
  readonly kind: string;
  readonly operation: TPlanOperation;
  readonly risk: TChangeRisk;
  readonly reason: string;
  readonly desiredHash?: string;
  readonly actualHash?: string;
  readonly previousHash?: string;
  readonly locator?: string;
  readonly authorizations: readonly TPlanAuthorization[];
  readonly specification?: TResourceSpecification;
}

/**
 * 单服务器部署计划
 */
export interface IServerPlan {
  readonly project: string;
  readonly server: string;
  readonly createdAt: string;
  readonly previousState?: IDeploymentState;
  readonly specification: IServerSpecification;
  readonly actions: readonly IPlanAction[];
}
