import type { IMaterializedServer } from "@cratenaut/core/internal";

import type { IConnectionClient } from "../connection/connection.types";
import type { IDockerClient } from "../docker/docker.types";
import type { IServerLayout } from "../layout/layout.types";
import type { IServerPlan } from "../plan/plan.types";
import type { IStateStore } from "../state/state.types";
import type { IServerSpecification } from "../specification/specification.types";

/**
 * 已准备的单服务器操作上下文
 */
export interface IPreparedServerOperation {
  readonly server: IMaterializedServer;
  readonly connection: IConnectionClient;
  readonly docker: IDockerClient;
  readonly layout: IServerLayout;
  readonly stateStore: IStateStore;
  readonly fingerprintKey: Uint8Array;
  readonly specification: IServerSpecification;
  readonly plan: IServerPlan;
}
