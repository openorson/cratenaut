import { describe, expect, test } from "bun:test";

import { materializeCrate } from "@cratenaut/core/internal";

import { caddy } from "../src";

const resolver = {
  environment: () => undefined,
  file: () => "",
};

describe("Caddy Crate", () => {
  test("将结构化站点配置渲染为 Caddyfile", async () => {
    const materialized = await materializeCrate(
      caddy({
        id: "gateway",
        options: {
          email: "admin@example.com",
          config: {
            format: "structured",
            sites: [
              {
                addresses: ["example.com"],
                encode: ["zstd", "gzip"],
                routes: [
                  {
                    kind: "reverseProxy",
                    paths: ["/api/*"],
                    upstreams: ["api:3000"],
                    healthUri: "/health",
                  },
                  { kind: "respond", body: "ready", status: 200 },
                ],
              },
            ],
          },
        },
      }),
      resolver,
    );
    const config = materialized.resources.find((resource) => resource.kind === "file" && resource.id === "config-file");
    const content = config?.kind === "file" ? config.content : "";
    const container = materialized.resources.find((resource) => resource.kind === "container");
    const tasks = materialized.resources.filter((resource) => resource.kind === "task");

    expect(content).toContain('email "admin@example.com"');
    expect(content).toContain("encode zstd gzip");
    expect(content).toContain("reverse_proxy /api/* api:3000");
    expect(content).toContain("health_uri /health");
    expect(container?.kind === "container" ? container.command : undefined).toContain("sh");
    expect(container?.kind === "container" ? container.mounts : undefined).not.toContainEqual(
      expect.objectContaining({ source: { kind: "file", id: "config-file" } }),
    );
    expect(tasks.map((task) => task.id)).toEqual(["validate-config", "reload-config"]);
    expect(tasks.every((task) => task.kind === "task" && task.target?.id === "server")).toBe(true);
    expect(tasks.every((task) => task.kind === "task" && task.stdin === content)).toBe(true);
  });

  test("关闭站点 TLS 时自动生成 HTTP 地址", async () => {
    const materialized = await materializeCrate(
      caddy({
        id: "gateway",
        options: {
          logging: false,
          ports: { https: false },
          config: {
            format: "structured",
            sites: [
              {
                addresses: ["localhost"],
                tls: "off",
                routes: [{ kind: "respond", body: "ready" }],
              },
            ],
          },
        },
      }),
      resolver,
    );
    const config = materialized.resources.find((resource) => resource.kind === "file" && resource.id === "config-file");
    const container = materialized.resources.find((resource) => resource.kind === "container");

    expect(config?.kind === "file" ? config.content : "").toContain("http://localhost {");
    expect(
      container?.kind === "container"
        ? container.ports?.some((port) => port.container === 443 && port.protocol === "udp")
        : true,
    ).toBe(false);
  });

  test("拒绝无效的 JSON 配置", () => {
    expect(() =>
      caddy({
        id: "gateway",
        options: {
          config: { format: "json", content: "{" },
        },
      }),
    ).toThrow();
  });

  test("原始配置不能重复设置结构化全局选项", () => {
    expect(() =>
      caddy({
        id: "gateway",
        options: {
          email: "admin@example.com",
          config: { format: "caddyfile", content: ':80 { respond "ready" }' },
        },
      }),
    ).toThrow();
  });

  test("原始配置变更需要部署者判断影响", async () => {
    const materialized = await materializeCrate(
      caddy({
        id: "gateway",
        options: {
          config: { format: "caddyfile", content: ':80 { respond "ready" }' },
        },
      }),
      resolver,
    );
    const result = materialized.assessChange({
      ...materialized.options,
      config: { format: "caddyfile", content: ':80 { respond "old" }' },
    });

    expect(result.some((assessment) => assessment.risk === "unknown")).toBe(true);
  });
});
