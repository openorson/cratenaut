import { describe, expect, test } from "bun:test";

import { createPlan } from "../../src/plan/plan.create";
import { fingerprint } from "../../src/specification/specification.hash";

describe("三方计划", () => {
  const key = new Uint8Array(32).fill(3);
  const task = Object.freeze({
    kind: "task" as const,
    id: "migrate",
    command: "true",
    arguments: Object.freeze([]),
    environment: Object.freeze({}),
    run: "on-change" as const,
    impact: "disruptive" as const,
    markerPath: "/runtime/migrate.task.json",
  });
  const connection = {
    serverId: "production",
    connection: { kind: "local" as const },
    execute: async () => ({ code: 44, stdout: "", stderr: "" }),
    readText: async () => undefined,
  };
  const docker = {
    inspect: async () => ({ exists: false, running: false, labels: {} }),
  };
  const layout = {
    project: "shop",
    server: "production",
  };

  test("首次部署任务时生成创建操作", async () => {
    const plan = await createPlan(
      {
        project: "shop",
        server: "production",
        crates: [
          {
            id: "database",
            name: "postgres",
            version: "1.0.0",
            optionsSnapshot: {},
            optionChangePolicies: [],
            assessChange: () => [],
            resources: [task],
          },
        ],
      },
      undefined,
      connection as never,
      docker as never,
      layout as never,
      key,
      false,
    );

    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0]?.operation).toBe("create");
  });

  test("接管状态提交前已经成功的任务", async () => {
    const desiredHash = fingerprint({ crate: { name: "postgres", version: "1.0.0" }, resource: task }, key);
    const plan = await createPlan(
      {
        project: "shop",
        server: "production",
        crates: [
          {
            id: "database",
            name: "postgres",
            version: "1.0.0",
            optionsSnapshot: {},
            optionChangePolicies: [],
            assessChange: () => [],
            resources: [task],
          },
        ],
      },
      undefined,
      { ...connection, readText: async () => JSON.stringify({ desiredHash }) } as never,
      docker as never,
      layout as never,
      key,
      false,
    );

    expect(plan.actions[0]?.operation).toBe("adopt");
    expect(plan.actions[0]?.risk).toBe("safe");
  });

  test("未声明兼容性的主版本升级需要独立授权", async () => {
    const taskHash = fingerprint({ crate: { name: "postgres", version: "1.0.0" }, resource: task }, key);
    const plan = await createPlan(
      {
        project: "shop",
        server: "production",
        crates: [
          {
            id: "database",
            name: "postgres",
            version: "2.0.0",
            optionsSnapshot: {},
            optionChangePolicies: [],
            assessChange: () => [],
            resources: [task],
          },
        ],
      },
      {
        schemaVersion: 1,
        deploymentId: "previous",
        project: "shop",
        server: "production",
        updatedAt: "2026-01-01T00:00:00.000Z",
        crates: [
          {
            id: "database",
            name: "postgres",
            version: "1.0.0",
            optionsSnapshot: {},
            resources: [
              {
                id: "migrate",
                kind: "task",
                desiredHash: taskHash,
                actualHash: taskHash,
                appliedAt: "2026-01-01T00:00:00.000Z",
              },
            ],
          },
        ],
      },
      connection as never,
      docker as never,
      layout as never,
      key,
      false,
    );

    const crateChange = plan.actions.find((action) => action.resourceId === "$crate");
    expect(crateChange?.authorizations).toContain("major");
    expect(crateChange?.authorizations).not.toContain("unknown");
  });

  test("完整选择服务器时可以清理已经删除的 Crate", async () => {
    const plan = await createPlan(
      { project: "shop", server: "production", crates: [] },
      {
        schemaVersion: 1,
        deploymentId: "previous",
        project: "shop",
        server: "production",
        updatedAt: "2026-01-01T00:00:00.000Z",
        crates: [
          {
            id: "database",
            name: "postgres",
            version: "1.0.0",
            optionsSnapshot: {},
            resources: [
              {
                id: "data",
                kind: "storage",
                desiredHash: "desired",
                actualHash: "actual",
                appliedAt: "2026-01-01T00:00:00.000Z",
                locator: "/data/database",
              },
            ],
          },
        ],
      },
      { ...connection, execute: async () => ({ code: 0, stdout: "actual\n", stderr: "" }) } as never,
      docker as never,
      layout as never,
      key,
      true,
      true,
    );

    expect(plan.actions).toHaveLength(2);
    expect(plan.actions.every((action) => action.operation === "remove")).toBeTrue();
    const storageRemoval = plan.actions.find((action) => action.resourceId === "data");
    expect(storageRemoval?.authorizations).toContain("prune");
    expect(storageRemoval?.authorizations).toContain("destructive");
  });

  test("数组通配路径可以声明配置变更风险", async () => {
    const plan = await createPlan(
      {
        project: "shop",
        server: "production",
        crates: [
          {
            id: "database",
            name: "postgres",
            version: "1.0.0",
            optionsSnapshot: { users: [{ password: "next" }] },
            optionChangePolicies: [{ path: "users.*.password", risk: "destructive" }],
            assessChange: () => [],
            resources: [],
          },
        ],
      },
      {
        schemaVersion: 1,
        deploymentId: "previous",
        project: "shop",
        server: "production",
        updatedAt: "2026-01-01T00:00:00.000Z",
        crates: [
          {
            id: "database",
            name: "postgres",
            version: "1.0.0",
            optionsSnapshot: { users: [{ password: "previous" }] },
            resources: [],
          },
        ],
      },
      connection as never,
      docker as never,
      layout as never,
      key,
      false,
    );

    const crateChange = plan.actions.find((action) => action.resourceId === "$crate");
    expect(crateChange?.risk).toBe("destructive");
    expect(crateChange?.authorizations).toContain("destructive");
  });

  test("识别托管容器配置被手工修改后的漂移", async () => {
    const container = Object.freeze({
      kind: "container" as const,
      id: "server",
      image: "registry.example.com/app:1.0.0",
      environment: Object.freeze({}),
      mounts: Object.freeze([]),
      ports: Object.freeze([]),
      restart: "unless-stopped",
    });
    const desiredHash = fingerprint({ crate: { name: "app", version: "1.0.0" }, resource: container }, key);
    const previousConfiguration = { restart: { Name: "unless-stopped" } };
    const plan = await createPlan(
      {
        project: "shop",
        server: "production",
        crates: [
          {
            id: "web",
            name: "app",
            version: "1.0.0",
            optionsSnapshot: {},
            optionChangePolicies: [],
            assessChange: () => [],
            resources: [container],
          },
        ],
      },
      {
        schemaVersion: 1,
        deploymentId: "previous",
        project: "shop",
        server: "production",
        updatedAt: "2026-01-01T00:00:00.000Z",
        crates: [
          {
            id: "web",
            name: "app",
            version: "1.0.0",
            optionsSnapshot: {},
            resources: [
              {
                id: "server",
                kind: "container",
                desiredHash,
                actualHash: fingerprint(previousConfiguration, key),
                appliedAt: "2026-01-01T00:00:00.000Z",
              },
            ],
          },
        ],
      },
      connection as never,
      {
        inspect: async () => ({
          exists: true,
          running: true,
          desiredHash,
          labels: { "io.cratenaut.managed": "true" },
          configuration: { restart: { Name: "always" } },
        }),
      } as never,
      layout as never,
      key,
      false,
    );

    expect(plan.actions[0]?.operation).toBe("drift");
    expect(plan.actions[0]?.authorizations).toContain("drift");
  });
});
