import type { IConfig } from "@cratenaut/core";
import type { IMaterializedConfig, IMaterializedServer, ISecretResolver } from "@cratenaut/core/internal";

import type { ILoadedConfig } from "../config/config.types";
import type { IOutput } from "../output/output.types";

/**
 * 命令运行参数
 */
export interface IRuntimeArguments {
  readonly config?: string;
  readonly global?: boolean;
  readonly server?: string;
  readonly crate?: string;
  readonly all?: boolean;
  readonly yes?: boolean;
  readonly json?: boolean;
  readonly plain?: boolean;
  readonly verbose?: boolean;
  readonly secretKeyFile?: string;
  readonly secretKeyStdin?: boolean;
  readonly allowDestructive?: boolean;
  readonly allowUnknownChange?: boolean;
  readonly allowMajor?: boolean;
  readonly allowDowngrade?: boolean;
  readonly overwriteDrift?: boolean;
  readonly prune?: boolean;
  readonly forceUnlock?: boolean;
}

/**
 * 已选择的命令运行上下文
 */
export interface IRuntimeContext {
  readonly args: IRuntimeArguments;
  readonly output: IOutput;
  readonly loaded: ILoadedConfig;
  readonly selectedConfig: IConfig;
  readonly secretResolver: ISecretResolver;
  readonly materialized: IMaterializedConfig;
}

/**
 * 单服务器命令运行上下文
 */
export interface IServerRuntimeContext extends IRuntimeContext {
  readonly server: IMaterializedServer;
}
