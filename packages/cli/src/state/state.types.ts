/**
 * 已部署资源状态
 */
export interface IResourceState {
  readonly id: string;
  readonly kind: string;
  readonly desiredHash: string;
  readonly actualHash: string;
  readonly appliedAt: string;
  readonly locator?: string;
  readonly imageDigest?: string;
  readonly backup?: boolean;
}

/**
 * 已部署 `Crate` 状态
 */
export interface ICrateState {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly optionsSnapshot: unknown;
  readonly resources: readonly IResourceState[];
}

/**
 * 服务器部署状态
 */
export interface IDeploymentState {
  readonly schemaVersion: 1;
  readonly deploymentId: string;
  readonly project: string;
  readonly server: string;
  readonly updatedAt: string;
  readonly crates: readonly ICrateState[];
}

/**
 * 部署状态存储
 */
export interface IStateStore {
  load(): Promise<IDeploymentState | undefined>;
  save(state: IDeploymentState): Promise<void>;
  getFingerprintKey(): Promise<Uint8Array>;
  persistFingerprintKey(): Promise<void>;
  acquireLock(force?: boolean): Promise<void>;
  releaseLock(): Promise<void>;
}
