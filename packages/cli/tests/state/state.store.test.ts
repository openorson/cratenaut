import { describe, expect, test } from "bun:test";

import { StateStore } from "../../src/state/state.store";

describe("部署状态存储", () => {
  const layout = {
    project: "shop",
    server: "production",
    currentState: "/state/current.json",
  };
  const createState = (kind = "container") => ({
    schemaVersion: 1,
    deploymentId: "deployment",
    project: "shop",
    server: "production",
    updatedAt: "2026-01-01T00:00:00.000Z",
    crates: [
      {
        id: "database",
        name: "postgres",
        version: "1.0.0",
        optionsSnapshot: { password: { secretFingerprint: "fingerprint" } },
        resources: [
          {
            id: "server",
            kind,
            desiredHash: "desired",
            actualHash: "actual",
            appliedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      },
    ],
  });

  test("校验并深度冻结服务器权威状态", async () => {
    const store = new StateStore(
      { readText: async () => JSON.stringify(createState()) } as never,
      layout as never,
      "/local",
    );
    const state = await store.load();

    expect(state?.crates[0]?.resources[0]?.kind).toBe("container");
    expect(Object.isFrozen(state)).toBeTrue();
    expect(Object.isFrozen(state?.crates)).toBeTrue();
    expect(Object.isFrozen(state?.crates[0]?.optionsSnapshot)).toBeTrue();
  });

  test("拒绝损坏的嵌套资源状态", async () => {
    const store = new StateStore(
      { readText: async () => JSON.stringify(createState("unknown")) } as never,
      layout as never,
      "/local",
    );

    await expect(store.load()).rejects.toThrow("kind 无效");
  });
});
