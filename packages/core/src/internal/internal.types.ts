import type { StaticDecode, TSchema } from "typebox";

import type { IOptionChangePolicy } from "../change/change.types";
import type { TServerConnection } from "../config/config.types";
import type { ICrateChangeAssessment, ICrateCompatibility, ICrateInstance } from "../crate/crate.types";
import type { TResource } from "../resource/resource.types";

/**
 * `Crate` 的内部运行状态
 *
 * @internal
 */
export interface ICrateRuntimeState {
  /**
   * 配置字段变更策略
   */
  readonly optionChangePolicies: readonly IOptionChangePolicy[];
  /**
   * 配置中的秘密字段路径
   */
  readonly secretOptionPaths: readonly string[];
  /**
   * 版本兼容规则
   */
  readonly compatibility?: ICrateCompatibility;
  /**
   * 解码已经完成秘密解析的配置选项
   */
  readonly decodeOptions: (options: unknown) => unknown;
  /**
   * 根据解码后的配置选项生成资源
   */
  readonly createResources: (id: string, options: unknown) => readonly TResource[];
  /**
   * 评估跨字段或条件性配置变更
   */
  readonly assessChange: (previousOptions: unknown, nextOptions: unknown) => readonly ICrateChangeAssessment[];
}

/**
 * 已完成秘密解析、配置解码和资源生成的 `Crate`
 *
 * @internal
 */
export interface IMaterializedCrate<
  Id extends string = string,
  Type extends { name: string; version: string; optionsSchema: TSchema | undefined } = {
    name: string;
    version: string;
    optionsSchema: TSchema | undefined;
  },
> {
  /**
   * 实例标识
   */
  readonly id: Id;
  /**
   * 实例用途描述
   */
  readonly description?: string;
  /**
   * `Crate` 名称
   */
  readonly name: Type["name"];
  /**
   * `Crate` 版本
   */
  readonly version: Type["version"];
  /**
   * 已解码的配置选项
   */
  readonly options: Type["optionsSchema"] extends undefined
    ? undefined
    : StaticDecode<NonNullable<Type["optionsSchema"]>>;
  /**
   * 配置字段变更策略
   */
  readonly optionChangePolicies: readonly IOptionChangePolicy[];
  /**
   * 配置中的秘密字段路径
   */
  readonly secretOptionPaths: readonly string[];
  /**
   * 版本兼容规则
   */
  readonly compatibility?: ICrateCompatibility;
  /**
   * 评估跨字段或条件性配置变更
   */
  readonly assessChange: (previousOptions: unknown) => readonly ICrateChangeAssessment[];
  /**
   * 有序资源清单
   */
  readonly resources: readonly TResource[];
}

/**
 * 把 `Crate` 实例元组转换为已物化实例元组
 *
 * @internal
 */
export type TMaterializedCrates<Crates extends readonly ICrateInstance[]> = {
  readonly [Index in keyof Crates]: Crates[Index] extends ICrateInstance<infer Id, infer Type>
    ? IMaterializedCrate<Id, Type>
    : never;
};

/**
 * 已完成内部物化的服务器
 *
 * @internal
 */
export interface IMaterializedServer<
  Id extends string = string,
  Crates extends readonly ICrateInstance[] = readonly ICrateInstance[],
> {
  /**
   * 服务器标识
   */
  readonly id: Id;
  /**
   * 服务器用途描述
   */
  readonly description?: string;
  /**
   * 服务器连接方式
   */
  readonly connection: TServerConnection;
  /**
   * 服务器上的管理根目录
   */
  readonly root?: string;
  /**
   * 有序的已物化 `Crate` 清单
   */
  readonly crates: TMaterializedCrates<Crates>;
}

/**
 * 已完成内部物化的配置
 *
 * @internal
 */
export interface IMaterializedConfig {
  /**
   * 项目标识
   */
  readonly project: string;
  /**
   * 有序的已物化服务器清单
   */
  readonly servers: readonly IMaterializedServer[];
}
