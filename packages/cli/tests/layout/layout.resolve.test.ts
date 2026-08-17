import { describe, expect, test } from "bun:test";

import {
  createContainerName,
  createNetworkAlias,
  createNetworkName,
  resolveCrateLayout,
  resolveServerLayout,
} from "../../src/layout/layout.resolve";

describe("服务器目录和 Docker 命名", () => {
  test("按项目和服务器隔离远程目录", () => {
    const layout = resolveServerLayout(
      "shop",
      {
        id: "production",
        connection: { kind: "ssh", host: "example.com" },
        crates: [],
      },
      "/workspace",
    );
    const crate = resolveCrateLayout(layout, "database");

    expect(layout.base).toBe("/var/lib/cratenaut/projects/shop/servers/production");
    expect(crate.data).toBe("/var/lib/cratenaut/projects/shop/servers/production/crates/database/data");
  });

  test("生成稳定的 Docker 名称", () => {
    expect(createNetworkName("shop", "production")).toBe("cratenaut-shop-production");
    expect(createContainerName("shop", "production", "database", "postgres")).toBe(
      "cratenaut-shop-production-database-postgres",
    );
    expect(createNetworkAlias("database", "postgres")).toBe("database-postgres");
  });
});
