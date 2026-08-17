import type { TSecretSource } from "./secret.types";
import type { Secret } from "./secret.value";

/**
 * 秘密对象与其来源的内部映射
 *
 * 来源不作为对象的可枚举属性保存，从而避免常规序列化意外带出明文
 */
const secretSources = new WeakMap<object, TSecretSource>();

/**
 * 记录秘密来源
 *
 * @internal
 */
export function registerSecretSource<Value extends string>(
  secretValue: Secret<Value>,
  source: TSecretSource<Value>,
): void {
  secretSources.set(secretValue, source);
}

/**
 * 判断值是否为当前模块创建的秘密对象
 *
 * @internal
 */
export function hasSecretSource(value: unknown): value is Secret<string> {
  return (typeof value === "object" && value !== null) || typeof value === "function"
    ? secretSources.has(value)
    : false;
}

/**
 * 获取秘密来源
 *
 * @internal
 */
export function getSecretSource<Value extends string>(secretValue: Secret<Value>): TSecretSource<Value> {
  const source = secretSources.get(secretValue);

  if (source === undefined) {
    throw new TypeError("无法识别秘密对象");
  }

  return source as TSecretSource<Value>;
}
