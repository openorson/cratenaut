import type { CrateTypes } from "@cratenaut/core";
import type { IOptionChangePolicy } from "@cratenaut/core/internal";

/**
 * 持久化存储规格
 */
export interface IStorageSpecification {
  readonly kind: "storage";
  readonly id: string;
  readonly path: string;
  readonly backup: boolean;
  readonly mode: number;
  readonly owner?: string;
  readonly group?: string;
}

/**
 * 目录规格
 */
export interface IDirectorySpecification {
  readonly kind: "directory";
  readonly id: string;
  readonly path: string;
  readonly mode?: number;
  readonly owner?: string;
  readonly group?: string;
}

/**
 * 文件规格
 */
export interface IFileSpecification {
  readonly kind: "file";
  readonly id: string;
  readonly path: string;
  readonly content: string | Uint8Array;
  readonly mode?: number;
  readonly owner?: string;
  readonly group?: string;
}

/**
 * 容器挂载规格
 */
export interface IContainerMountSpecification {
  readonly source: string;
  readonly target: string;
  readonly readOnly: boolean;
  /**
   * 托管文件内容的不可逆修订指纹
   *
   * 文件内容变化时用于触发容器重建，不会传递给 `Docker`
   */
  readonly revision?: string;
}

/**
 * 容器端口规格
 */
export interface IContainerPortSpecification {
  readonly container: number;
  readonly host?: number;
  readonly address?: string;
  readonly protocol: "tcp" | "udp";
}

/**
 * 容器健康检查规格
 */
export interface IContainerHealthcheckSpecification {
  readonly command: string;
  readonly interval: string;
  readonly timeout: string;
  readonly startPeriod: string;
  readonly retries: number;
}

/**
 * 容器规格
 */
export interface IContainerSpecification {
  readonly kind: "container";
  readonly id: string;
  readonly image: string;
  readonly command?: readonly string[];
  readonly environment: Readonly<Record<string, string>>;
  readonly mounts: readonly IContainerMountSpecification[];
  readonly ports: readonly IContainerPortSpecification[];
  readonly restart: string;
  readonly healthcheck?: IContainerHealthcheckSpecification;
  readonly startupTimeout: number;
  readonly stopTimeout: number;
  readonly stopSignal?: string;
  readonly sharedMemory?: string;
}

/**
 * 任务规格
 */
export interface ITaskSpecification {
  readonly kind: "task";
  readonly id: string;
  readonly command: string;
  readonly arguments: readonly string[];
  readonly environment: Readonly<Record<string, string>>;
  readonly stdin?: string;
  readonly workingDirectory?: string;
  readonly run: "always" | "on-change" | "once";
  readonly impact: "safe" | "disruptive" | "destructive";
  readonly revision?: string;
  readonly markerPath: string;
  readonly targetContainer?: string;
}

/**
 * 可执行资源规格
 */
export type TResourceSpecification =
  IStorageSpecification | IDirectorySpecification | IFileSpecification | IContainerSpecification | ITaskSpecification;

/**
 * 可执行 `Crate` 规格
 */
export interface ICrateSpecification {
  readonly id: string;
  readonly description?: string;
  readonly name: string;
  readonly version: string;
  readonly compatibility?: CrateTypes.ICrateCompatibility;
  readonly optionsSnapshot: unknown;
  readonly optionChangePolicies: readonly IOptionChangePolicy[];
  readonly assessChange: (previousOptions: unknown) => readonly CrateTypes.ICrateChangeAssessment[];
  readonly resources: readonly TResourceSpecification[];
}

/**
 * 可执行服务器规格
 */
export interface IServerSpecification {
  readonly project: string;
  readonly server: string;
  readonly crates: readonly ICrateSpecification[];
}
