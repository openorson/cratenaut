import { describe, expect, test } from "bun:test";

import { assertPlanAuthorized } from "../../src/deploy/deploy.authorize";

describe("计划授权", () => {
  test("--yes 不会授权破坏性操作", () => {
    const plan = {
      project: "shop",
      server: "production",
      createdAt: "2026-01-01T00:00:00.000Z",
      specification: { project: "shop", server: "production", crates: [] },
      actions: [
        {
          crateId: "database",
          resourceId: "data",
          kind: "storage",
          operation: "remove",
          risk: "destructive",
          reason: "测试",
          authorizations: ["destructive", "prune"],
        },
      ],
    };

    expect(() => assertPlanAuthorized(plan as never, { yes: true, prune: true })).toThrow("尚未授权");
    expect(() => assertPlanAuthorized(plan as never, { yes: true, prune: true, allowDestructive: true })).not.toThrow();
  });

  test("不可修改字段不能通过普通风险参数绕过", () => {
    const plan = {
      project: "shop",
      server: "production",
      createdAt: "2026-01-01T00:00:00.000Z",
      specification: { project: "shop", server: "production", crates: [] },
      actions: [
        {
          crateId: "database",
          resourceId: "$crate",
          kind: "crate",
          operation: "update",
          risk: "immutable",
          reason: "测试",
          authorizations: ["immutable"],
        },
      ],
    };

    expect(() =>
      assertPlanAuthorized(plan as never, {
        allowUnknownChange: true,
        allowDestructive: true,
      }),
    ).toThrow("immutable");
  });
});
