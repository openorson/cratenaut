import { Buffer } from "node:buffer";
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from "node:crypto";

import {
  formatSecretEnvelope,
  parseSecretEnvelope,
  SECRET_AUTH_TAG_BYTES,
  SECRET_IV_BYTES,
  SECRET_SALT_BYTES,
  SECRET_SCRYPT_BLOCK_SIZE,
  SECRET_SCRYPT_COST,
  SECRET_SCRYPT_PARALLELIZATION,
} from "./secret.envelope";
import type { ISecretEnvelope, ISecretKeyDerivation } from "./secret.types";

const secretKeyBytes = 32;
const secretScryptMaximumMemory = 128 * 1024 * 1024;

/**
 * 使用 `scrypt` 从口令派生对称密钥
 */
function deriveSecretKey(password: string, keyDerivation: ISecretKeyDerivation): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      Buffer.from(keyDerivation.salt, "base64url"),
      secretKeyBytes,
      {
        N: keyDerivation.cost,
        r: keyDerivation.blockSize,
        p: keyDerivation.parallelization,
        maxmem: secretScryptMaximumMemory,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      },
    );
  });
}

/**
 * 创建需要参与完整性验证的信封头
 */
function createAdditionalAuthenticatedData(keyDerivation: ISecretKeyDerivation, iv: string): Buffer {
  return Buffer.from(
    JSON.stringify({
      version: 1,
      keyDerivation,
      cipher: {
        algorithm: "aes-256-gcm",
        iv,
      },
    }),
    "utf8",
  );
}

/**
 * 使用口令加密秘密文本
 */
export async function encryptSecret(value: string, password: string): Promise<string> {
  if (password.length === 0) {
    throw new TypeError("秘密加密口令不能为空");
  }

  const salt = randomBytes(SECRET_SALT_BYTES).toString("base64url");
  const iv = randomBytes(SECRET_IV_BYTES).toString("base64url");
  const keyDerivation = Object.freeze({
    algorithm: "scrypt" as const,
    cost: SECRET_SCRYPT_COST,
    blockSize: SECRET_SCRYPT_BLOCK_SIZE,
    parallelization: SECRET_SCRYPT_PARALLELIZATION,
    salt,
  });
  const key = await deriveSecretKey(password, keyDerivation);

  try {
    const cipher = createCipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"), {
      authTagLength: SECRET_AUTH_TAG_BYTES,
    });
    cipher.setAAD(createAdditionalAuthenticatedData(keyDerivation, iv));

    const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]).toString("base64url");
    const authTag = cipher.getAuthTag().toString("base64url");

    return formatSecretEnvelope({
      version: 1,
      keyDerivation,
      cipher: {
        algorithm: "aes-256-gcm",
        iv,
        authTag,
      },
      ciphertext,
    });
  } finally {
    key.fill(0);
  }
}

/**
 * 使用口令解密秘密信封
 */
export async function decryptSecret(envelope: ISecretEnvelope, password: string): Promise<string> {
  if (password.length === 0) {
    throw new TypeError("秘密解密口令不能为空");
  }

  const normalizedEnvelope = parseSecretEnvelope(formatSecretEnvelope(envelope));

  if (normalizedEnvelope === undefined) {
    throw new TypeError("秘密信封格式无效");
  }

  const key = await deriveSecretKey(password, normalizedEnvelope.keyDerivation);

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(normalizedEnvelope.cipher.iv, "base64url"), {
      authTagLength: SECRET_AUTH_TAG_BYTES,
    });
    decipher.setAAD(createAdditionalAuthenticatedData(normalizedEnvelope.keyDerivation, normalizedEnvelope.cipher.iv));
    decipher.setAuthTag(Buffer.from(normalizedEnvelope.cipher.authTag, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(normalizedEnvelope.ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    throw new Error("秘密解密失败，口令错误或密文已损坏", { cause: error });
  } finally {
    key.fill(0);
  }
}
