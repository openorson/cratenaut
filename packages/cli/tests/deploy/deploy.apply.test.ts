import { expect, test } from "bun:test";

import { applyPlan } from "../../src/deploy/deploy.apply";

test("部署应用拒绝计划生成后的并发状态变化", async () => {
  let released = false;
  const stateStore = {
    acquireLock: async () => undefined,
    load: async () => ({ deploymentId: "newer" }),
    releaseLock: async () => {
      released = true;
    },
  };

  await expect(
    applyPlan(
      {
        project: "shop",
        server: "production",
        createdAt: "2026-01-01T00:00:00.000Z",
        previousState: {
          schemaVersion: 1,
          deploymentId: "planned",
          project: "shop",
          server: "production",
          updatedAt: "2026-01-01T00:00:00.000Z",
          crates: [],
        },
        specification: { project: "shop", server: "production", crates: [] },
        actions: [],
      },
      { writeText: async () => undefined } as never,
      {} as never,
      stateStore as never,
      {} as never,
      new Uint8Array(32),
    ),
  ).rejects.toThrow("计划生成后已经变化");
  expect(released).toBeTrue();
});
