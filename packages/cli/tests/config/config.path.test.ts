import { describe, expect, test } from "bun:test";
import { homedir } from "node:os";
import { resolve } from "node:path";

import { resolveConfigPath } from "../../src/config/config.path";

describe("配置路径", () => {
  test("默认只检查当前目录", () => {
    expect(resolveConfigPath({}, "/workspace/project")).toBe("/workspace/project/naut.config.ts");
  });

  test("全局配置保持双层信息目录所需的配置位置", () => {
    expect(resolveConfigPath({ global: true })).toBe(resolve(homedir(), ".cratenaut", "naut.config.ts"));
  });

  test("拒绝冲突的配置来源", () => {
    expect(() => resolveConfigPath({ config: "custom.ts", global: true })).toThrow("不能同时使用");
  });
});
