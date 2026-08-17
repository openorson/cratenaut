import { createHmac } from "node:crypto";

/**
 * 生成确定性的序列化文本
 */
export function stableSerialize(value: unknown): string {
  if (value instanceof Uint8Array) {
    return JSON.stringify({ binary: Buffer.from(value).toString("base64") });
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }

  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableSerialize(child)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

/**
 * 使用项目状态密钥生成不可逆规格指纹
 */
export function fingerprint(value: unknown, key: Uint8Array): string {
  return createHmac("sha256", key).update(stableSerialize(value)).digest("base64url");
}

/**
 * 为配置快照遮蔽秘密字段
 */
export function createOptionsSnapshot(value: unknown, secretPaths: readonly string[], key: Uint8Array): unknown {
  const paths = secretPaths.map((path) => path.split("."));

  const visit = (child: unknown, current: readonly string[]): unknown => {
    const matches = paths.some(
      (path) =>
        path.length === current.length && path.every((segment, index) => segment === "*" || segment === current[index]),
    );

    if (matches) {
      return Object.freeze({ secretFingerprint: fingerprint(child, key) });
    }

    if (Array.isArray(child)) {
      return Object.freeze(child.map((item, index) => visit(item, [...current, String(index)])));
    }

    if (typeof child === "object" && child !== null) {
      return Object.freeze(
        Object.fromEntries(Object.entries(child).map(([name, item]) => [name, visit(item, [...current, name])])),
      );
    }

    return child;
  };

  return visit(value, []);
}
