import { describe, expect, test } from "bun:test";

import { secret } from "@cratenaut/core";
import { materializeCrate } from "@cratenaut/core/internal";

import { gitea } from "../src";

const resolver = {
  environment: () => undefined,
  file: () => "",
};

describe("Gitea Crate", () => {
  test("默认使用 SQLite 且不对外发布端口", async () => {
    const materialized = await materializeCrate(
      gitea({
        id: "git",
        options: { publicUrl: "https://git.example.com" },
      }),
      resolver,
    );
    const container = materialized.resources.find((resource) => resource.kind === "container");

    expect(materialized.options.publicUrl).toBe("https://git.example.com/");
    expect(materialized.options.image).toBe("docker.gitea.com/gitea:1.27.2");
    expect(container?.kind === "container" ? container.environment?.GITEA__database__DB_TYPE : undefined).toBe(
      "sqlite3",
    );
    expect(
      container?.kind === "container" ? container.environment?.GITEA__service__DISABLE_REGISTRATION : undefined,
    ).toBe("true");
    expect(container?.kind === "container" ? container.ports : undefined).toEqual([
      { container: 3_000, host: undefined, address: undefined },
    ]);
  });

  test("外部 PostgreSQL 密码通过托管文件注入", async () => {
    const materialized = await materializeCrate(
      gitea({
        id: "git",
        options: {
          publicUrl: "https://git.example.com/",
          database: {
            type: "postgres",
            host: "database",
            username: "gitea",
            password: secret("database-password"),
          },
          http: { port: 3_000, address: "127.0.0.1" },
        },
      }),
      resolver,
    );
    const password = materialized.resources.find(
      (resource) => resource.kind === "file" && resource.id === "database-password",
    );
    const container = materialized.resources.find((resource) => resource.kind === "container");

    expect(password?.kind === "file" ? password.content : undefined).toBe("database-password");
    expect(container?.kind === "container" ? container.environment?.GITEA__database__HOST : undefined).toBe(
      "database:5432",
    );
    expect(container?.kind === "container" ? container.environment?.GITEA__database__PASSWD__FILE : undefined).toBe(
      "/run/secrets/database-password",
    );
    expect(container?.kind === "container" ? container.ports : undefined).toEqual([
      { container: 3_000, host: 3_000, address: "127.0.0.1" },
    ]);
  });

  test("邮件确认注册必须配置邮件服务", () => {
    expect(() =>
      gitea({
        id: "git",
        options: {
          publicUrl: "https://git.example.com/",
          registration: "email",
        },
      }),
    ).toThrow();
  });

  test("安全密钥通过托管文件注入", async () => {
    const materialized = await materializeCrate(
      gitea({
        id: "git",
        options: {
          publicUrl: "https://git.example.com/",
          security: {
            secretKey: secret("secret-key"),
            internalToken: secret("internal-token"),
          },
        },
      }),
      resolver,
    );
    const container = materialized.resources.find((resource) => resource.kind === "container");

    expect(materialized.resources.map((resource) => resource.id)).toEqual([
      "secret-key",
      "internal-token",
      "data",
      "server",
    ]);
    expect(container?.kind === "container" ? container.environment?.GITEA__security__SECRET_KEY__FILE : undefined).toBe(
      "/run/secrets/secret-key",
    );
  });
});
