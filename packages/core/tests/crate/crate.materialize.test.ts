import { describe, expect, test } from "bun:test";

import { change, defineCrate, secret, t } from "@cratenaut/core";
import type { ICrateInstance } from "@cratenaut/core";
import { materializeCrate } from "@cratenaut/core/internal";

const PortSchema = t
  .Codec(t.String({ pattern: "^[0-9]+$" }))
  .Decode((value) => Number(value))
  .Encode((value) => String(value));

const OptionsSchema = t.Object({
  port: change.disruptive(PortSchema, { reason: "修改监听端口需要重建容器" }),
  password: secret.schema(t.String({ minLength: 8 })),
});

describe("Crate 物化", () => {
  test("延迟解析秘密、解码配置并生成资源", async () => {
    let resourceCalls = 0;
    const app = defineCrate({
      name: "app",
      version: "1.0.0",
      optionsSchema: OptionsSchema,
      resources: ({ options, resource }) => {
        resourceCalls += 1;

        return [
          resource.container("app", {
            image: "example/app:1",
            environment: { PASSWORD: options.password },
            ports: [{ container: options.port }],
          }),
        ];
      },
    });
    const instance = app({
      id: "main",
      options: {
        port: "8080",
        password: secret.env("APP_PASSWORD"),
      },
    });
    const typedInstance: ICrateInstance<
      "main",
      { name: "app"; version: "1.0.0"; optionsSchema: typeof OptionsSchema }
    > = instance;

    expect(typedInstance.id).toBe("main");
    expect(resourceCalls).toBe(0);

    const materialized = await materializeCrate(instance, {
      environment: (name) => (name === "APP_PASSWORD" ? "resolved-password" : undefined),
      file: () => "",
    });

    expect(resourceCalls).toBe(1);
    expect(materialized.options.port).toBe(8080);
    expect(materialized.options.password).toBe("resolved-password");
    expect(materialized.version).toBe("1.0.0");
    expect(materialized.optionChangePolicies).toContainEqual({
      path: "port",
      risk: "disruptive",
      reason: "修改监听端口需要重建容器",
    });
    expect(materialized.resources[0]?.kind).toBe("container");
    expect(Object.isFrozen(materialized)).toBe(true);
    expect(Object.isFrozen(materialized.resources)).toBe(true);
  });

  test("解密后的值必须重新满足原始字段约束", async () => {
    const app = defineCrate({
      name: "app",
      version: "1.0.0",
      optionsSchema: OptionsSchema,
      resources: () => [],
    });
    const instance = app({
      id: "main",
      options: {
        port: "8080",
        password: secret.env("APP_PASSWORD"),
      },
    });

    await expect(
      materializeCrate(instance, {
        environment: () => "short",
        file: () => "",
      }),
    ).rejects.toThrow();
  });

  test("在物化阶段拒绝重复资源标识", async () => {
    const app = defineCrate({
      name: "app",
      version: "1.0.0",
      resources: ({ resource }) => [
        resource.directory("data", { path: "/srv/first" }),
        resource.directory("data", { path: "/srv/second" }),
      ],
    });

    await expect(
      materializeCrate(app({ id: "main" }), {
        environment: () => undefined,
        file: () => "",
      }),
    ).rejects.toThrow("重复的资源标识");
  });

  test("拒绝引用后声明的持久化存储", async () => {
    const app = defineCrate({
      name: "app",
      version: "1.0.0",
      resources: ({ resource }) => [
        resource.container("app", {
          image: "example/app:1",
          mounts: [{ source: resource.storageRef("data"), target: "/data" }],
        }),
        resource.storage("data"),
      ],
    });

    await expect(
      materializeCrate(app({ id: "main" }), {
        environment: () => undefined,
        file: () => "",
      }),
    ).rejects.toThrow("尚未声明的存储");
  });

  test("允许容器引用先声明的托管文件", async () => {
    const app = defineCrate({
      name: "app",
      version: "1.0.0",
      resources: ({ resource }) => [
        resource.file("config", { content: "value" }),
        resource.container("app", {
          image: "example/app:1",
          mounts: [{ source: resource.fileRef("config"), target: "/etc/app/config" }],
        }),
      ],
    });

    const materialized = await materializeCrate(app({ id: "main" }), {
      environment: () => undefined,
      file: () => "",
    });

    expect(materialized.resources.map((resource) => resource.kind)).toEqual(["file", "container"]);
  });

  test("拒绝容器引用后声明的托管文件", async () => {
    const app = defineCrate({
      name: "app",
      version: "1.0.0",
      resources: ({ resource }) => [
        resource.container("app", {
          image: "example/app:1",
          mounts: [{ source: resource.fileRef("config"), target: "/etc/app/config" }],
        }),
        resource.file("config", { content: "value" }),
      ],
    });

    await expect(
      materializeCrate(app({ id: "main" }), {
        environment: () => undefined,
        file: () => "",
      }),
    ).rejects.toThrow("尚未声明的文件");
  });

  test("允许任务引用先声明的容器", async () => {
    const app = defineCrate({
      name: "app",
      version: "1.0.0",
      resources: ({ resource }) => [
        resource.container("app", { image: "example/app:1" }),
        resource.task("reload", {
          target: resource.containerRef("app"),
          command: "app",
          arguments: ["reload"],
        }),
      ],
    });

    const materialized = await materializeCrate(app({ id: "main" }), {
      environment: () => undefined,
      file: () => "",
    });

    expect(materialized.resources[1]?.kind).toBe("task");
  });

  test("拒绝任务引用后声明的容器", async () => {
    const app = defineCrate({
      name: "app",
      version: "1.0.0",
      resources: ({ resource }) => [
        resource.task("reload", {
          target: resource.containerRef("app"),
          command: "app",
          arguments: ["reload"],
        }),
        resource.container("app", { image: "example/app:1" }),
      ],
    });

    await expect(
      materializeCrate(app({ id: "main" }), {
        environment: () => undefined,
        file: () => "",
      }),
    ).rejects.toThrow("尚未声明的容器");
  });

  test("拒绝无效的语义化版本", () => {
    expect(() =>
      defineCrate({
        name: "app",
        version: "next",
        resources: () => [],
      }),
    ).toThrow("语义化版本");

    expect(() =>
      defineCrate({
        name: "app",
        version: "1",
        resources: () => [],
      }),
    ).toThrow("语义化版本");

    expect(() =>
      defineCrate({
        name: "app",
        version: "1.0.0",
        compatibility: { upgradesFrom: ["任意版本"] },
        resources: () => [],
      }),
    ).toThrow("兼容范围");
  });
});
