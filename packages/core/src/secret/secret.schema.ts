import { Codec, Refine, Union, Unsafe, type TString } from "typebox";

import { hasSecretSource } from "./secret.internal";
import type { TSecretSchema, TSecretValueSchema } from "./secret.types";
import type { Secret } from "./secret.value";

const secretSchemas = new WeakSet<object>();

/**
 * 创建仅接受不透明秘密对象的 `TypeBox` 类型
 */
function createSecretValueSchema(): TSecretValueSchema {
  return Refine(Unsafe<Secret<string>>({}), hasSecretSource, () => "应为 Cratenaut 秘密值");
}

/**
 * 使字符串类型同时接受不透明秘密对象
 *
 * 编码阶段允许秘密对象通过结构校验；解码前必须先把秘密解析为明文，随后
 * 原始字符串类型会再次校验明文并返回字符串
 */
export function createSecretSchema<Schema extends TString>(schema: Schema): TSecretSchema<Schema> {
  const secretSchema = Codec(Union([schema, createSecretValueSchema()]))
    .Decode((value) => {
      if (hasSecretSource(value)) {
        throw new TypeError("秘密值必须在配置解码前完成解析");
      }

      return value;
    })
    .Encode((value) => value);

  secretSchemas.add(secretSchema);

  return secretSchema;
}

/**
 * 收集配置类型中的秘密字段路径
 *
 * @internal
 */
export function collectSecretSchemaPaths(schema: unknown): readonly string[] {
  const paths: string[] = [];
  const visited = new Set<object>();

  const visit = (value: unknown, path: string): void => {
    if (typeof value !== "object" || value === null || visited.has(value)) {
      return;
    }

    visited.add(value);

    if (secretSchemas.has(value)) {
      paths.push(path);
      return;
    }

    const record = value as Record<string, unknown>;
    const properties = record.properties;

    if (typeof properties === "object" && properties !== null) {
      for (const [key, child] of Object.entries(properties)) {
        visit(child, path === "" ? key : `${path}.${key}`);
      }
    }

    if (record.items !== undefined) {
      visit(record.items, path === "" ? "*" : `${path}.*`);
    }

    for (const keyword of ["anyOf", "allOf", "oneOf"] as const) {
      const variants = record[keyword];

      if (Array.isArray(variants)) {
        for (const variant of variants) {
          visit(variant, path);
        }
      }
    }
  };

  visit(schema, "");

  return Object.freeze(paths);
}
