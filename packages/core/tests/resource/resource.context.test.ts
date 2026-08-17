import { describe, expect, test } from "bun:test";

import { secret } from "@cratenaut/core";

import { ResourceContext } from "../../src/resource/resource.context";

describe("资源声明上下文", () => {
  test("创建带有稳定类型标识的资源", () => {
    const resource = new ResourceContext();

    expect(resource.directory("directory", { path: "/srv/app" }).kind).toBe("directory");
    expect(resource.file("managed-file", { content: "value" }).path).toBeUndefined();
    expect(resource.file("file", { path: "/srv/app/config", content: "value" }).kind).toBe("file");
    expect(resource.storage("storage").kind).toBe("storage");
    expect(resource.container("container", { image: "example/app:1" }).kind).toBe("container");
    expect(resource.fileRef("file")).toEqual({ kind: "file", id: "file" });
    expect(resource.containerRef("container")).toEqual({ kind: "container", id: "container" });
    const task = resource.task("task", { command: "migrate" });
    expect(task.kind).toBe("task");
    expect(task.run).toBe("on-change");
    expect(task.impact).toBe("disruptive");
  });

  test("复制并冻结容器集合配置", () => {
    const resource = new ResourceContext();
    const command = ["server", "start"];
    const environment = { TOKEN: secret.env("TOKEN") };
    const healthcheck = {
      command: "test -f /tmp/ready",
      interval: "10s",
      retries: 3,
    };
    const container = resource.container("app", {
      image: "example/app:1",
      command,
      environment,
      mounts: [{ source: "/srv/app", target: "/app" }],
      ports: [{ container: 8080, host: 8080, address: "127.0.0.1" }],
      healthcheck,
      startupTimeout: 60,
      stopTimeout: 30,
      stopSignal: "SIGTERM",
      sharedMemory: "128m",
    });

    command.push("--debug");
    environment.TOKEN = secret.env("OTHER_TOKEN");
    healthcheck.command = "exit 1";

    expect(container.command).toEqual(["server", "start"]);
    expect(String(container.environment?.TOKEN)).toBe("[secret]");
    expect(Object.isFrozen(container)).toBe(true);
    expect(Object.isFrozen(container.command)).toBe(true);
    expect(Object.isFrozen(container.environment)).toBe(true);
    expect(Object.isFrozen(container.mounts)).toBe(true);
    expect(Object.isFrozen(container.ports)).toBe(true);
    expect(container.healthcheck?.command).toBe("test -f /tmp/ready");
    expect(Object.isFrozen(container.healthcheck)).toBe(true);
    expect(container.startupTimeout).toBe(60);
    expect(container.stopTimeout).toBe(30);
    expect(container.stopSignal).toBe("SIGTERM");
    expect(container.sharedMemory).toBe("128m");
  });

  test("二进制文件内容无法修改内部状态", () => {
    const resource = new ResourceContext();
    const input = new Uint8Array([1, 2, 3]);
    const file = resource.file("binary", {
      path: "/srv/app/data.bin",
      content: input,
    });

    input[0] = 9;

    const firstRead = file.content;

    if (!(firstRead instanceof Uint8Array)) {
      throw new TypeError("文件内容不是二进制数据");
    }

    firstRead[1] = 9;

    expect(file.content).toEqual(new Uint8Array([1, 2, 3]));
  });

  test("在资源声明阶段拒绝非法运行时值", () => {
    const resource = new ResourceContext();

    expect(() =>
      resource.container("app", {
        image: "example/app:1",
        restart: "sometimes" as never,
      }),
    ).toThrow("重启策略");
    expect(() => resource.task("migrate", { command: "migrate", impact: "none" as never })).toThrow("执行影响");
    expect(() =>
      resource.container("app", {
        image: "example/app:1",
        environment: { PORT: 8080 as never },
      }),
    ).toThrow("环境变量");
    expect(() =>
      resource.container("app", {
        image: "example/app:1",
        ports: [{ container: 8080, address: "127.0.0.1" }],
      }),
    ).toThrow("发布服务器端口");
    expect(() =>
      resource.container("app", {
        image: "example/app:1",
        healthcheck: { command: "true", retries: 0 },
      }),
    ).toThrow("连续失败次数");
    expect(() =>
      resource.container("app", {
        image: "example/app:1",
        ports: [{ container: 8080, host: 8080, address: "localhost" }],
      }),
    ).toThrow("IPv4 或 IPv6");
    expect(() =>
      resource.container("app", {
        image: "example/app:1",
        healthcheck: { command: "true", interval: "soon" },
      }),
    ).toThrow("时间长度");
    expect(() =>
      resource.container("app", {
        image: "example/app:1",
        sharedMemory: "large",
      }),
    ).toThrow("共享内存大小");
  });
});
