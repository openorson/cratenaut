import type { StaticDecode, StaticEncode, TSchema } from "typebox";

import type { TChangeRisk } from "../change/change.types";
import type { ResourceContext } from "../resource/resource.context";
import type { TResource } from "../resource/resource.types";

/**
 * `Crate` 定义器
 */
export interface IDefineCrate {
  <
    const Name extends string = string,
    const Version extends string = string,
    const OptionsSchema extends TSchema | undefined = undefined,
  >(
    definition: ICrateDefinition<Name, Version, OptionsSchema>,
  ): ICrate<{ name: Name; version: Version; optionsSchema: OptionsSchema }>;
}

/**
 * `Crate` 工厂
 */
export interface ICrate<
  Type extends { name: string; version: string; optionsSchema: TSchema | undefined } = {
    name: string;
    version: string;
    optionsSchema: TSchema | undefined;
  },
> {
  /**
   * `Crate` 定义
   */
  readonly definition: ICrateDefinition<Type["name"], Type["version"], Type["optionsSchema"]>;

  /**
   * 创建 `Crate` 实例
   */
  <const Id extends string = string>(args: TCrateInstanceArgs<Id, Type>): ICrateInstance<Id, Type>;
}

/**
 * `Crate` 实例
 */
export interface ICrateInstance<
  Id extends string = string,
  Type extends { name: string; version: string; optionsSchema: TSchema | undefined } = {
    name: string;
    version: string;
    optionsSchema: TSchema | undefined;
  },
> {
  /**
   * 实例在服务器配置中的唯一标识
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
   * 经过 `TypeBox` 编码类型校验、等待内部运行时解码的配置选项
   *
   * 未定义配置类型时固定为 `undefined`
   */
  readonly options: Type["optionsSchema"] extends undefined
    ? undefined
    : StaticEncode<NonNullable<Type["optionsSchema"]>>;
}

/**
 * `Crate` 实例化参数
 */
export type TCrateInstanceArgs<
  Id extends string = string,
  Type extends { name: string; version: string; optionsSchema: TSchema | undefined } = {
    name: string;
    version: string;
    optionsSchema: TSchema | undefined;
  },
> = {
  /**
   * 实例在服务器配置中的唯一标识
   */
  readonly id: Id;
  /**
   * 实例用途描述
   */
  readonly description?: string;
} & (Type["optionsSchema"] extends undefined
  ? {}
  : undefined extends StaticEncode<NonNullable<Type["optionsSchema"]>>
    ? {
        /**
         * 等待 `TypeBox` 校验和解码的可选配置选项
         */
        readonly options?: Exclude<StaticEncode<NonNullable<Type["optionsSchema"]>>, undefined>;
      }
    : {
        /**
         * 等待 `TypeBox` 校验和解码的配置选项
         */
        readonly options: StaticEncode<NonNullable<Type["optionsSchema"]>>;
      });

/**
 * 资源声明上下文
 */
export type TCrateResourceContext<
  Id extends string = string,
  Type extends { name: string; version: string; optionsSchema: TSchema | undefined } = {
    name: string;
    version: string;
    optionsSchema: TSchema | undefined;
  },
> = {
  /**
   * 当前 `Crate` 实例标识
   */
  readonly id: Id;
  /**
   * 经过 `TypeBox` 校验和解码的配置选项
   */
  readonly options: Type["optionsSchema"] extends undefined
    ? undefined
    : StaticDecode<NonNullable<Type["optionsSchema"]>>;
  /**
   * 资源声明上下文
   */
  readonly resource: ResourceContext;
};

/**
 * 资源声明函数
 */
export interface ICrateResources<
  Type extends { name: string; version: string; optionsSchema: TSchema | undefined } = {
    name: string;
    version: string;
    optionsSchema: TSchema | undefined;
  },
> {
  /**
   * 根据实例标识和已解码配置声明资源
   */
  <const Id extends string = string>(context: TCrateResourceContext<Id, Type>): readonly TResource[];
}

/**
 * `Crate` 版本兼容规则
 */
export interface ICrateCompatibility {
  /**
   * 允许直接升级到当前版本的语义化版本范围
   *
   * 未声明时，跨主版本升级需要部署者显式确认
   */
  readonly upgradesFrom?: readonly string[];
}

/**
 * `Crate` 配置整体变更上下文
 */
export interface ICrateChangeContext<Options = unknown> {
  /**
   * 上次部署时保存的配置快照
   */
  readonly previousOptions: Options | undefined;
  /**
   * 本次部署的配置
   */
  readonly nextOptions: Options;
  /**
   * 已变化的配置路径
   */
  readonly changedPaths: readonly string[];
}

/**
 * `Crate` 配置整体变更评估
 */
export interface ICrateChangeAssessment {
  /**
   * 变更风险
   */
  readonly risk: TChangeRisk;
  /**
   * 风险原因
   */
  readonly reason: string;
}

/**
 * `Crate` 配置整体变更评估函数
 */
export interface ICrateChangeAssessor<Options = unknown> {
  /**
   * 评估跨字段或条件性变更
   */
  (context: ICrateChangeContext<Options>): ICrateChangeAssessment | readonly ICrateChangeAssessment[] | undefined;
}

/**
 * `Crate` 定义
 */
export interface ICrateDefinition<
  Name extends string = string,
  Version extends string = string,
  OptionsSchema extends TSchema | undefined = TSchema | undefined,
> {
  /**
   * `Crate` 名称
   */
  readonly name: Name;
  /**
   * `Crate` 语义化版本
   */
  readonly version: Version;
  /**
   * 配置选项 `TypeBox Schema`
   */
  readonly optionsSchema?: OptionsSchema;
  /**
   * 版本兼容规则
   */
  readonly compatibility?: ICrateCompatibility;
  /**
   * 评估跨字段或条件性配置变更
   *
   * 该函数必须是纯函数，不参与部署生命周期
   */
  readonly assessChange?: ICrateChangeAssessor<
    OptionsSchema extends undefined ? undefined : StaticDecode<NonNullable<OptionsSchema>>
  >;
  /**
   * 资源声明函数
   *
   * 返回数组是该 `Crate` 的完整资源清单，数组顺序就是声明和处理顺序
   */
  readonly resources: ICrateResources<{ name: Name; version: Version; optionsSchema: OptionsSchema }>;
}
