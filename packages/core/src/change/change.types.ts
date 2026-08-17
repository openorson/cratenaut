import type { TSchema } from "typebox";

/**
 * 配置变更风险
 */
export type TChangeRisk = "safe" | "disruptive" | "destructive" | "immutable" | "unknown";

/**
 * 配置字段变更说明
 */
export interface IChangeOptions {
  /**
   * 风险原因
   */
  readonly reason?: string;
}

/**
 * 配置字段变更策略
 */
export interface IOptionChangePolicy extends IChangeOptions {
  /**
   * 配置字段路径
   */
  readonly path: string;
  /**
   * 变更风险
   */
  readonly risk: TChangeRisk;
}

/**
 * 配置变更标注工具
 */
export interface IChange {
  /**
   * 标记可以原地更新的配置
   */
  safe<Schema extends TSchema>(schema: Schema, options?: IChangeOptions): Schema;
  /**
   * 标记会造成短暂中断的配置
   */
  disruptive<Schema extends TSchema>(schema: Schema, options?: IChangeOptions): Schema;
  /**
   * 标记可能删除或不可逆修改数据的配置
   */
  destructive<Schema extends TSchema>(schema: Schema, options?: IChangeOptions): Schema;
  /**
   * 标记实例创建后不可修改的配置
   */
  immutable<Schema extends TSchema>(schema: Schema, options?: IChangeOptions): Schema;
  /**
   * 标记需要部署者判断风险的配置
   */
  unknown<Schema extends TSchema>(schema: Schema, options?: IChangeOptions): Schema;
}
