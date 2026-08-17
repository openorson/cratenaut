import { describe, expect, test } from "bun:test";

import { defineConfig, defineCrate } from "@cratenaut/core";
import type { IConfig } from "@cratenaut/core";
import { materializeConfig } from "@cratenaut/core/internal";

const crate = defineCrate({
  name: "test",
  version: "1.0.0",
  resources: () => [],
});

describe("配置定义", () => {
  test("保留实例类型、顺序并冻结配置", () => {
    const first = crate({ id: "first" });
    const second = crate({ id: "second" });
    const config = defineConfig({
      project: "example",
      servers: [{ id: "local", connection: { kind: "local" }, crates: [first, second] }],
    });
    const typedConfig: IConfig<{
      project: "example";
      servers: readonly [
        {
          readonly id: "local";
          readonly connection: { readonly kind: "local" };
          readonly crates: readonly [typeof first, typeof second];
        },
      ];
    }> = config;

    expect(typedConfig.servers[0]?.crates).toEqual([first, second]);
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.servers)).toBe(true);
    expect(Object.isFrozen(config.servers[0]?.crates)).toBe(true);
  });

  test("拒绝重复的 Crate 实例标识", () => {
    const first = crate({ id: "main" });
    const second = crate({ id: "main" });

    expect(() =>
      defineConfig({
        project: "example",
        servers: [{ id: "local", connection: { kind: "local" }, crates: [first, second] }],
      }),
    ).toThrow("重复的 Crate 实例标识");
  });

  test("按照配置顺序物化实例", async () => {
    const calls: string[] = [];
    const orderedCrate = defineCrate({
      name: "ordered",
      version: "1.0.0",
      resources: ({ id }) => {
        calls.push(id);
        return [];
      },
    });
    const config = defineConfig({
      project: "example",
      servers: [
        {
          id: "local",
          connection: { kind: "local" },
          crates: [orderedCrate({ id: "first" }), orderedCrate({ id: "second" })],
        },
      ],
    });

    await materializeConfig(config, {
      environment: () => undefined,
      file: () => "",
    });

    expect(calls).toEqual(["first", "second"]);
  });

  test("拒绝不规范的项目和服务器标识", () => {
    expect(() =>
      defineConfig({
        project: "Invalid Project",
        servers: [{ id: "local", connection: { kind: "local" }, crates: [] }],
      }),
    ).toThrow("项目标识");
  });
});
