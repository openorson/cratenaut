import { describe, expect, test } from "bun:test";

import { DockerClient } from "../../src/docker/docker.client";

describe("Docker 客户端", () => {
  test("生成完整的容器启动参数", async () => {
    const calls: Array<Readonly<{ command: string; args: readonly string[] }>> = [];
    const connection = {
      serverId: "production",
      connection: { kind: "local" as const },
      execute: async (command: string, args: readonly string[]) => {
        calls.push({ command, args });
        return { code: 0, stdout: "", stderr: "" };
      },
    };
    const docker = new DockerClient(connection as never);

    await docker.run({
      name: "cratenaut-shop-production-database-server",
      image: "postgres:18.6-alpine",
      network: "cratenaut-shop-production",
      networkAlias: "database-server",
      restart: "unless-stopped",
      labels: { "io.cratenaut.managed": "true" },
      mounts: [{ source: "/srv/postgres", target: "/var/lib/postgresql", readOnly: false }],
      ports: [{ container: 5_432, host: 5_432, address: "::1", protocol: "tcp" }],
      healthcheck: {
        command: "pg_isready",
        interval: "10s",
        timeout: "5s",
        startPeriod: "20s",
        retries: 5,
      },
      stopTimeout: 60,
      stopSignal: "SIGTERM",
      sharedMemory: "128m",
    });

    const args = calls[0]?.args ?? [];

    expect(calls[0]?.command).toBe("docker");
    expect(args).toContain("[::1]:5432:5432/tcp");
    expect(args).toContain("--health-cmd");
    expect(args).toContain("--health-start-period");
    expect(args).toContain("--stop-timeout");
    expect(args).toContain("--stop-signal");
    expect(args).toContain("--shm-size");
    expect(args.at(-1)).toBe("postgres:18.6-alpine");
  });

  test("等待容器进入健康状态", async () => {
    const connection = {
      serverId: "production",
      connection: { kind: "local" as const },
      execute: async () => ({
        code: 0,
        stdout: JSON.stringify([
          {
            Config: { Labels: {} },
            HostConfig: {},
            NetworkSettings: {},
            State: { Running: true, Status: "running", Health: { Status: "healthy" } },
          },
        ]),
        stderr: "",
      }),
    };
    const docker = new DockerClient(connection as never);

    await expect(docker.waitUntilReady("database", 1)).resolves.toBeUndefined();
  });

  test("容器内任务通过标准输入执行", async () => {
    let invocation: Readonly<{ args: readonly string[]; stdin?: string }> | undefined;
    const connection = {
      serverId: "production",
      connection: { kind: "local" as const },
      execute: async (_command: string, args: readonly string[], options: Readonly<{ stdin?: string }>) => {
        invocation = { args, stdin: options.stdin };
        return { code: 0, stdout: "", stderr: "" };
      },
    };
    const docker = new DockerClient(connection as never);

    await docker.execTask("gateway", ["caddy", "reload", "--config", "-"], {
      stdin: "example.com { respond ready }\n",
    });

    expect(invocation?.args).toEqual(["exec", "--interactive", "gateway", "caddy", "reload", "--config", "-"]);
    expect(invocation?.stdin).toBe("example.com { respond ready }\n");
  });
});
