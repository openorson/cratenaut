import type { IConfig } from "@cratenaut/core";
import type { ISecretResolver } from "@cratenaut/core/internal";

import type { IOutput } from "../output/output.types";

/**
 * 配置来源参数
 */
export interface IConfigArguments {
  readonly config?: string;
  readonly global?: boolean;
}

/**
 * 秘密口令来源参数
 */
export interface ISecretArguments {
  readonly secretKeyFile?: string;
  readonly secretKeyStdin?: boolean;
}

/**
 * 已加载配置
 */
export interface ILoadedConfig {
  /**
   * 配置对象
   */
  readonly config: IConfig;
  /**
   * 配置文件绝对路径
   */
  readonly path: string;
  /**
   * 配置文件所在目录
   */
  readonly directory: string;
  /**
   * 本地运行信息目录
   */
  readonly informationDirectory: string;
}

/**
 * 秘密解析器创建参数
 */
export interface ICreateSecretResolverOptions {
  readonly args: ISecretArguments;
  readonly configDirectory: string;
  readonly output: IOutput;
}

/**
 * 秘密解析器创建结果
 */
export interface ISecretResolverContext {
  readonly resolver: ISecretResolver;
}
