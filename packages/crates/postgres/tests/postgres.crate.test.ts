import { describe, expect, test } from "bun:test";

import { secret } from "@cratenaut/core";
import { materializeCrate } from "@cratenaut/core/internal";

import { postgres } from "../src";

const resolver = {
  environment: () => undefined,
  file: () => "",
};

describe("PostgreSQL Crate", () => {
  test("使用安全默认值生成数据库资源", async () => {
    const materialized = await materializeCrate(
      postgres({
        id: "main",
        options: { password: secret("database-password") },
      }),
      resolver,
    );
    const password = materialized.resources.find((resource) => resource.kind === "file" && resource.id === "password");
    const container = materialized.resources.find((resource) => resource.kind === "container");

    expect(materialized.options.image).toBe("postgres:18.6-alpine");
    expect(password?.kind === "file" ? password.content : undefined).toBe("database-password");
    expect(container?.kind).toBe("container");

    if (container?.kind !== "container") {
      throw new TypeError("未生成 PostgreSQL 容器资源");
    }

    expect(container.environment?.POSTGRES_PASSWORD_FILE).toBe("/run/secrets/postgres-password");
    expect(container.mounts).toContainEqual({
      source: { kind: "storage", id: "data" },
      target: "/var/lib/postgresql",
      readOnly: undefined,
    });
    expect(container.ports).toEqual([{ container: 5_432, host: undefined, address: undefined }]);
    expect(container.healthcheck?.command).toContain("pg_isready");
  });

  test("生成有序的初始化脚本文件", async () => {
    const materialized = await materializeCrate(
      postgres({
        id: "main",
        options: {
          password: secret("database-password"),
          initialization: {
            scripts: [
              { name: "01-schema.sql", content: "CREATE TABLE example(id integer);" },
              { name: "02-data.sql", content: "INSERT INTO example VALUES (1);" },
            ],
          },
        },
      }),
      resolver,
    );

    expect(materialized.resources.map((resource) => resource.id)).toEqual([
      "password",
      "init-0",
      "init-1",
      "data",
      "server",
    ]);
  });

  test("拒绝重名初始化脚本", () => {
    expect(() =>
      postgres({
        id: "main",
        options: {
          password: secret("database-password"),
          initialization: {
            scripts: [
              { name: "01-schema.sql", content: "SELECT 1;" },
              { name: "01-schema.sql", content: "SELECT 2;" },
            ],
          },
        },
      }),
    ).toThrow();
  });

  test("将数据库主版本变更判断为破坏性变更", async () => {
    const materialized = await materializeCrate(
      postgres({
        id: "main",
        options: { password: secret("database-password") },
      }),
      resolver,
    );
    const result = materialized.assessChange({
      ...materialized.options,
      image: "postgres:17.8-alpine",
    });

    expect(result).toContainEqual({
      risk: "destructive",
      reason: "PostgreSQL 镜像主版本将从 17 修改为 18，必须先执行数据库升级流程",
    });
  });
});
