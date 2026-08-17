import type { TSchema } from "typebox";

import type { IChange, IChangeOptions } from "./change.types";
import { registerChangePolicy } from "./change.policy";

/**
 * 配置字段变更策略标注工具
 */
export const change: IChange = Object.freeze({
  safe: <Schema extends TSchema>(schema: Schema, options?: IChangeOptions) =>
    registerChangePolicy(schema, "safe", options),
  disruptive: <Schema extends TSchema>(schema: Schema, options?: IChangeOptions) =>
    registerChangePolicy(schema, "disruptive", options),
  destructive: <Schema extends TSchema>(schema: Schema, options?: IChangeOptions) =>
    registerChangePolicy(schema, "destructive", options),
  immutable: <Schema extends TSchema>(schema: Schema, options?: IChangeOptions) =>
    registerChangePolicy(schema, "immutable", options),
  unknown: <Schema extends TSchema>(schema: Schema, options?: IChangeOptions) =>
    registerChangePolicy(schema, "unknown", options),
});
