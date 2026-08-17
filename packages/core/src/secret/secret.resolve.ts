import { parseSecretEnvelope } from "./secret.envelope";
import { getSecretSource, hasSecretSource } from "./secret.internal";
import type { ISecretResolver } from "./secret.types";
import type { Secret } from "./secret.value";

/**
 * 解析一个秘密值
 *
 * 本函数只编排来源读取和解密，不直接访问进程环境、文件系统或密钥
 *
 * 解析出的明文应只在最终资源执行边界内短暂使用，调用方不得将其写入日志或部署状态
 */
export async function resolveSecret(secretValue: Secret<string>, resolver: ISecretResolver): Promise<string> {
  const source = getSecretSource(secretValue);
  let value: string;

  switch (source.kind) {
    case "value":
      value = source.value;
      break;
    case "environment": {
      const environmentValue = await resolver.environment(source.name);

      if (environmentValue === undefined) {
        throw new Error(`未找到秘密环境变量：${source.name}`);
      }

      value = environmentValue;
      break;
    }
    case "file":
      value = await resolver.file(source.path);
      break;
  }

  const envelope = parseSecretEnvelope(value);

  if (envelope === undefined) {
    return value;
  }

  if (resolver.decrypt === undefined) {
    throw new Error("发现加密秘密，但当前运行环境没有提供解密能力");
  }

  return resolver.decrypt(envelope);
}

/**
 * 递归解析数组和普通对象中的秘密值
 *
 * @internal
 */
export async function resolveSecretValues(value: unknown, resolver: ISecretResolver): Promise<unknown> {
  return resolveValue(value, resolver, new WeakMap());
}

/**
 * 递归解析单个值
 */
async function resolveValue(
  value: unknown,
  resolver: ISecretResolver,
  resolvedObjects: WeakMap<object, unknown>,
): Promise<unknown> {
  if (hasSecretSource(value)) {
    return resolveSecret(value, resolver);
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  const resolvedObject = resolvedObjects.get(value);

  if (resolvedObject !== undefined) {
    return resolvedObject;
  }

  if (Array.isArray(value)) {
    const resolvedArray: unknown[] = [];
    resolvedObjects.set(value, resolvedArray);

    for (const item of value) {
      resolvedArray.push(await resolveValue(item, resolver, resolvedObjects));
    }

    return resolvedArray;
  }

  const prototype = Object.getPrototypeOf(value);

  if (prototype !== Object.prototype && prototype !== null) {
    return value;
  }

  const resolvedRecord: Record<string, unknown> = Object.create(prototype);
  resolvedObjects.set(value, resolvedRecord);

  for (const [key, item] of Object.entries(value)) {
    resolvedRecord[key] = await resolveValue(item, resolver, resolvedObjects);
  }

  return resolvedRecord;
}
