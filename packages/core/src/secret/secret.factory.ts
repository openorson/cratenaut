import type { TString } from "typebox";

import { hasSecretSource } from "./secret.internal";
import { createSecretSchema } from "./secret.schema";
import type { TSecretSchema } from "./secret.types";
import { Secret } from "./secret.value";

/**
 * 创建直接值秘密
 *
 * 生产配置优先使用 {@link secret.env} 或 {@link secret.file}，避免在配置文件中
 * 保存明文
 */
function createSecret<const Value extends string>(value: Value): Secret<Value> {
  return new Secret({ kind: "value", value });
}

/**
 * 从环境变量创建秘密引用
 */
function createEnvironmentSecret(name: string): Secret<string> {
  if (name.trim().length === 0) {
    throw new TypeError("秘密环境变量名称不能为空");
  }

  return new Secret({ kind: "environment", name });
}

/**
 * 从文本文件创建秘密引用
 */
function createFileSecret(path: string): Secret<string> {
  if (path.trim().length === 0) {
    throw new TypeError("秘密文件路径不能为空");
  }

  return new Secret({ kind: "file", path });
}

/**
 * 判断值是否为秘密对象
 */
function isSecret(value: unknown): value is Secret<string> {
  return hasSecretSource(value);
}

/**
 * 创建允许秘密引用的 `TypeBox` 字符串类型
 */
function secretSchema<Schema extends TString>(schema: Schema): TSecretSchema<Schema> {
  return createSecretSchema(schema);
}

/**
 * 秘密值工厂
 */
export const secret = Object.assign(createSecret, {
  env: createEnvironmentSecret,
  file: createFileSecret,
  is: isSecret,
  schema: secretSchema,
});
