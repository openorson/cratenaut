import { describe, expect, test } from "bun:test";

import { decryptSecret, encryptSecret, formatSecretEnvelope, parseSecretEnvelope } from "@cratenaut/core/internal";
import type { ISecretEnvelope } from "@cratenaut/core/internal";

const password = "correct horse battery staple";

describe("秘密加解密", () => {
  test("可以解密使用正确口令加密的秘密", async () => {
    const encrypted = await encryptSecret("database-password", password);
    const envelope = parseSecretEnvelope(encrypted);

    expect(encrypted.startsWith("cratenaut:v1:")).toBe(true);
    expect(envelope).toBeDefined();

    if (envelope === undefined) {
      throw new Error("秘密信封解析失败");
    }

    await expect(decryptSecret(envelope, password)).resolves.toBe("database-password");
  });

  test("相同明文每次生成不同密文", async () => {
    const first = await encryptSecret("same-value", password);
    const second = await encryptSecret("same-value", password);

    expect(first).not.toBe(second);
  });

  test("拒绝错误口令", async () => {
    const encrypted = await encryptSecret("database-password", password);
    const envelope = parseSecretEnvelope(encrypted);

    if (envelope === undefined) {
      throw new Error("秘密信封解析失败");
    }

    await expect(decryptSecret(envelope, "wrong-password")).rejects.toThrow("秘密解密失败");
  });

  test("拒绝被篡改的密文", async () => {
    const encrypted = await encryptSecret("database-password", password);
    const envelope = parseSecretEnvelope(encrypted);

    if (envelope === undefined) {
      throw new Error("秘密信封解析失败");
    }

    const firstCharacter = envelope.ciphertext.at(0) === "A" ? "B" : "A";
    const tamperedEnvelope = {
      ...envelope,
      ciphertext: `${firstCharacter}${envelope.ciphertext.slice(1)}`,
    } satisfies ISecretEnvelope;
    const parsedTamperedEnvelope = parseSecretEnvelope(formatSecretEnvelope(tamperedEnvelope));

    if (parsedTamperedEnvelope === undefined) {
      throw new Error("秘密信封解析失败");
    }

    await expect(decryptSecret(parsedTamperedEnvelope, password)).rejects.toThrow("秘密解密失败");
  });
});
