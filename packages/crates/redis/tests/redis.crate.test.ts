import { describe, expect, test } from "bun:test";

import { secret } from "@cratenaut/core";
import { materializeCrate } from "@cratenaut/core/internal";

import { redis } from "../src";

const resolver = {
  environment: () => undefined,
  file: () => "",
};

describe("Redis Crate", () => {
  test("允许省略选项并生成持久化实例", async () => {
    const materialized = await materializeCrate(redis({ id: "cache" }), resolver);
    const config = materialized.resources.find((resource) => resource.kind === "file" && resource.id === "config");
    const container = materialized.resources.find((resource) => resource.kind === "container");

    expect(materialized.options.image).toBe("redis:8.10.0-alpine");
    expect(materialized.resources.some((resource) => resource.kind === "storage" && resource.id === "data")).toBe(true);
    expect(config?.kind === "file" ? config.content : "").toContain("appendonly no");
    expect(container?.kind === "container" ? container.ports : undefined).toEqual([
      { container: 6_379, host: undefined, address: undefined },
    ]);
  });

  test("无持久化模式不会申请数据存储", async () => {
    const materialized = await materializeCrate(
      redis({
        id: "cache",
        options: { persistence: false },
      }),
      resolver,
    );
    const config = materialized.resources.find((resource) => resource.kind === "file" && resource.id === "config");

    expect(materialized.resources.some((resource) => resource.kind === "storage")).toBe(false);
    expect(config?.kind === "file" ? config.content : "").toContain('save ""');
  });

  test("拒绝发布未设置密码的 Redis 端口", () => {
    expect(() =>
      redis({
        id: "cache",
        options: { publish: true },
      }),
    ).toThrow();
  });

  test("密码通过托管文件挂载到容器", async () => {
    const materialized = await materializeCrate(
      redis({
        id: "cache",
        options: {
          password: secret("redis-password"),
          publish: { port: 6_380, address: "127.0.0.1" },
        },
      }),
      resolver,
    );
    const password = materialized.resources.find((resource) => resource.kind === "file" && resource.id === "password");
    const container = materialized.resources.find((resource) => resource.kind === "container");

    expect(password?.kind === "file" ? password.content : undefined).toBe("redis-password");
    expect(container?.kind === "container" ? container.ports : undefined).toEqual([
      { container: 6_379, host: 6_380, address: "127.0.0.1" },
    ]);
    expect(container?.kind === "container" ? container.healthcheck?.command : undefined).toContain("REDISCLI_AUTH");
  });
});
