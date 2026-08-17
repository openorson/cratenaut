import { describe, expect, test } from "bun:test";

import { secret } from "@cratenaut/core";
import { resolveSecret } from "@cratenaut/core/internal";

describe("秘密引用", () => {
  test("在日志和序列化中遮蔽直接值", () => {
    const value = secret("do-not-print");

    expect(String(value)).toBe("[secret]");
    expect(JSON.stringify({ value })).toBe('{"value":"[secret]"}');
    expect(Bun.inspect(value)).not.toContain("do-not-print");
  });

  test("可以解析环境变量和文件来源", async () => {
    const resolver = {
      environment: (name: string) => (name === "TOKEN" ? "environment-value" : undefined),
      file: (path: string) => (path === "/run/secrets/token" ? "file-value" : ""),
    };

    await expect(resolveSecret(secret.env("TOKEN"), resolver)).resolves.toBe("environment-value");
    await expect(resolveSecret(secret.file("/run/secrets/token"), resolver)).resolves.toBe("file-value");
  });

  test("拒绝不存在的环境变量", async () => {
    await expect(
      resolveSecret(secret.env("MISSING"), {
        environment: () => undefined,
        file: () => "",
      }),
    ).rejects.toThrow("未找到秘密环境变量");
  });
});
