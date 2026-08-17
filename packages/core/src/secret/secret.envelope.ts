import { Buffer } from "node:buffer";

import type { ISecretEnvelope } from "./secret.types";

/**
 * 第一版加密秘密信封前缀
 */
export const SECRET_ENVELOPE_PREFIX = "cratenaut:v1:";

/**
 * 第一版 `scrypt` 计算成本参数
 */
export const SECRET_SCRYPT_COST = 65_536;

/**
 * 第一版 `scrypt` 块大小参数
 */
export const SECRET_SCRYPT_BLOCK_SIZE = 8;

/**
 * 第一版 `scrypt` 并行参数
 */
export const SECRET_SCRYPT_PARALLELIZATION = 1;

/**
 * 第一版随机盐字节数
 */
export const SECRET_SALT_BYTES = 16;

/**
 * 第一版初始化向量字节数
 */
export const SECRET_IV_BYTES = 12;

/**
 * 第一版完整性验证标签字节数
 */
export const SECRET_AUTH_TAG_BYTES = 16;

const base64UrlPattern = /^[A-Za-z0-9_-]*$/;
const maximumEnvelopePayloadLength = 1_048_576;

/**
 * 判断值是否为普通对象
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 判断文本是否为规范的 `Base64URL`
 */
function isBase64Url(value: unknown, expectedBytes?: number): value is string {
  if (typeof value !== "string" || !base64UrlPattern.test(value)) {
    return false;
  }

  const buffer = Buffer.from(value, "base64url");

  return buffer.toString("base64url") === value && (expectedBytes === undefined || buffer.byteLength === expectedBytes);
}

/**
 * 校验并冻结秘密信封
 */
function normalizeSecretEnvelope(value: unknown): ISecretEnvelope {
  if (!isRecord(value) || value.version !== 1) {
    throw new TypeError("秘密信封版本无效");
  }

  const keyDerivation = value.keyDerivation;

  if (
    !isRecord(keyDerivation) ||
    keyDerivation.algorithm !== "scrypt" ||
    keyDerivation.cost !== SECRET_SCRYPT_COST ||
    keyDerivation.blockSize !== SECRET_SCRYPT_BLOCK_SIZE ||
    keyDerivation.parallelization !== SECRET_SCRYPT_PARALLELIZATION ||
    !isBase64Url(keyDerivation.salt, SECRET_SALT_BYTES)
  ) {
    throw new TypeError("秘密信封密钥派生信息无效");
  }

  const cipher = value.cipher;

  if (
    !isRecord(cipher) ||
    cipher.algorithm !== "aes-256-gcm" ||
    !isBase64Url(cipher.iv, SECRET_IV_BYTES) ||
    !isBase64Url(cipher.authTag, SECRET_AUTH_TAG_BYTES)
  ) {
    throw new TypeError("秘密信封对称加密信息无效");
  }

  if (!isBase64Url(value.ciphertext)) {
    throw new TypeError("秘密信封密文无效");
  }

  return Object.freeze({
    version: 1,
    keyDerivation: Object.freeze({
      algorithm: "scrypt",
      cost: SECRET_SCRYPT_COST,
      blockSize: SECRET_SCRYPT_BLOCK_SIZE,
      parallelization: SECRET_SCRYPT_PARALLELIZATION,
      salt: keyDerivation.salt,
    }),
    cipher: Object.freeze({
      algorithm: "aes-256-gcm",
      iv: cipher.iv,
      authTag: cipher.authTag,
    }),
    ciphertext: value.ciphertext,
  });
}

/**
 * 将秘密信封格式化为可保存的文本
 */
export function formatSecretEnvelope(envelope: ISecretEnvelope): string {
  const normalizedEnvelope = normalizeSecretEnvelope(envelope);
  const payload = Buffer.from(JSON.stringify(normalizedEnvelope), "utf8").toString("base64url");

  return `${SECRET_ENVELOPE_PREFIX}${payload}`;
}

/**
 * 解析加密秘密信封
 *
 * 输入不是秘密信封时返回 `undefined`；带有信封前缀但内容损坏时抛出错误
 */
export function parseSecretEnvelope(value: string): ISecretEnvelope | undefined {
  if (!value.startsWith(SECRET_ENVELOPE_PREFIX)) {
    return undefined;
  }

  const payload = value.slice(SECRET_ENVELOPE_PREFIX.length);

  if (payload.length === 0 || payload.length > maximumEnvelopePayloadLength || !isBase64Url(payload)) {
    throw new TypeError("秘密信封载荷格式无效");
  }

  try {
    return normalizeSecretEnvelope(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
  } catch (error) {
    if (error instanceof TypeError) {
      throw error;
    }

    throw new TypeError("秘密信封载荷格式无效", { cause: error });
  }
}

/**
 * 判断文本是否为格式正确的加密秘密信封
 */
export function isSecretEnvelope(value: string): boolean {
  try {
    return parseSecretEnvelope(value) !== undefined;
  } catch {
    return false;
  }
}
