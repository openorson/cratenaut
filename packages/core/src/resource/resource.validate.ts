import { posix } from "node:path";

import { hasSecretSource } from "../secret/secret.internal";
import type { TResourceText } from "./resource.types";

/**
 * 校验非空文本
 */
export function validateResourceText(value: string, subject: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${subject}必须是非空字符串`);
  }

  return value;
}

/**
 * 校验服务器绝对路径
 */
export function validateAbsolutePath(value: string, subject: string): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.includes("\0") ||
    value.includes("\n") ||
    value.includes("\r") ||
    posix.normalize(value) !== value
  ) {
    throw new TypeError(`${subject}必须是服务器上的规范绝对路径`);
  }

  return value;
}

/**
 * 校验文件系统权限
 */
export function validateMode(value: number | undefined, subject: string): number | undefined {
  if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > 0o7777)) {
    throw new TypeError(`${subject}必须是 0o0000 至 0o7777 的整数`);
  }

  return value;
}

/**
 * 校验资源中的普通文本或秘密文本
 */
export function validateResourceValue(value: unknown, subject: string): asserts value is TResourceText {
  if (typeof value !== "string" && !hasSecretSource(value)) {
    throw new TypeError(`${subject}必须是字符串或秘密值`);
  }
}

/**
 * 校验字符串数组
 */
export function validateStringArray(value: readonly string[] | undefined, subject: string): void {
  if (value !== undefined && (!Array.isArray(value) || value.some((item) => typeof item !== "string"))) {
    throw new TypeError(`${subject}必须是字符串数组`);
  }
}

/**
 * 校验字符串枚举值
 */
export function validateChoice<Value extends string>(
  value: string | undefined,
  choices: readonly Value[],
  subject: string,
): Value | undefined {
  if (value !== undefined && !choices.includes(value as Value)) {
    throw new TypeError(`${subject}必须是 ${choices.join("、")} 之一`);
  }

  return value as Value | undefined;
}
