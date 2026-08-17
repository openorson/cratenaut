import { describe, expect, test } from "bun:test";

import { buildServerSpecification } from "../../src/specification/specification.build";

describe("服务器规格构建", () => {
  const key = new Uint8Array(32).fill(5);
  const resolver = {
    environment: () => undefined,
    file: () => "",
  };
  const layout = {
    project: "shop",
    server: "production",
    crates: "/var/lib/cratenaut/shop/production/crates",
  };

  function createServer(content: string) {
    return {
      id: "production",
      crates: [
        {
          id: "cache",
          name: "redis",
          version: "1.0.0",
          options: {},
          secretOptionPaths: [],
          optionChangePolicies: [],
          assessChange: () => [],
          resources: [
            {
              kind: "file",
              id: "config",
              path: "/etc/cratenaut/redis.conf",
              content,
            },
            {
              kind: "container",
              id: "server",
              image: "redis:8-alpine",
              environment: {},
              mounts: [
                {
                  source: { kind: "file", id: "config" },
                  target: "/usr/local/etc/redis/redis.conf",
                  readOnly: true,
                },
              ],
              ports: [],
              restart: "unless-stopped",
              startupTimeout: 60,
              stopTimeout: 10,
            },
          ],
        },
      ],
    };
  }

  test("托管文件引用使用真实路径和内容修订指纹", async () => {
    const first = await buildServerSpecification(
      "shop",
      createServer("save 60 1\n") as never,
      layout as never,
      resolver,
      key,
    );
    const second = await buildServerSpecification(
      "shop",
      createServer("save 300 10\n") as never,
      layout as never,
      resolver,
      key,
    );
    const firstContainer = first.crates[0]?.resources.find((resource) => resource.kind === "container");
    const secondContainer = second.crates[0]?.resources.find((resource) => resource.kind === "container");
    const firstMount = firstContainer?.kind === "container" ? firstContainer.mounts[0] : undefined;
    const secondMount = secondContainer?.kind === "container" ? secondContainer.mounts[0] : undefined;

    expect(firstMount?.source).toBe("/etc/cratenaut/redis.conf");
    expect(firstMount?.revision).toBeString();
    expect(firstMount?.revision).not.toBe(secondMount?.revision);
    expect(firstMount?.revision).not.toContain("save 60 1");
  });
});
