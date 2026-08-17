const identifierPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * 校验并返回规范标识
 *
 * 标识长度为 1 至 30 个字符，只能使用小写字母、数字和连字符，并且必须以字母开头
 */
export function validateIdentifier(value: string, subject: string): string {
  if (typeof value !== "string" || value.length > 30 || !identifierPattern.test(value)) {
    throw new TypeError(`${subject}必须匹配 ${identifierPattern.source}，且长度不能超过 30 个字符`);
  }

  return value;
}

/**
 * 校验可选描述
 */
export function validateDescription(value: string | undefined, subject: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new TypeError(`${subject}必须是字符串`);
  }

  const normalized = value.trim();

  if (normalized.length === 0 || normalized.length > 200) {
    throw new TypeError(`${subject}长度必须为 1 至 200 个字符`);
  }

  return normalized;
}
