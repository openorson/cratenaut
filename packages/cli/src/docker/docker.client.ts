import type { IConnectionClient } from "../connection/connection.types";
import { diagnostics } from "../diagnostic/diagnostic.catalog";
import type { IContainerState, IDockerClient, IRunContainerOptions } from "./docker.types";

/**
 * 基于目标服务器连接执行的 `Docker` 客户端
 */
export class DockerClient implements IDockerClient {
  readonly #connection: IConnectionClient;

  public constructor(connection: IConnectionClient) {
    this.#connection = connection;
  }

  public async check(): Promise<void> {
    const result = await this.#connection.execute("docker", ["version", "--format", "{{.Server.Version}}"], {
      allowFailure: true,
    });

    if (result.code !== 0 || result.stdout.trim() === "") {
      throw diagnostics.CRN_CLI_2002({ server: this.#connection.serverId, cause: new Error(result.stderr.trim()) });
    }
  }

  public async inspect(name: string): Promise<IContainerState> {
    const result = await this.#connection.execute("docker", ["inspect", name], { allowFailure: true });

    if (result.code !== 0) {
      return Object.freeze({ exists: false, running: false, labels: Object.freeze({}) });
    }

    const values = JSON.parse(result.stdout) as readonly Readonly<Record<string, unknown>>[];
    const value = values[0];

    if (value === undefined) {
      return Object.freeze({ exists: false, running: false, labels: Object.freeze({}) });
    }

    const configuration = (value.Config ?? {}) as Readonly<Record<string, unknown>>;
    const hostConfiguration = (value.HostConfig ?? {}) as Readonly<Record<string, unknown>>;
    const networkSettings = (value.NetworkSettings ?? {}) as Readonly<Record<string, unknown>>;
    const state = (value.State ?? {}) as Readonly<Record<string, unknown>>;
    const labels = Object.freeze({ ...((configuration.Labels ?? {}) as Record<string, string>) });
    const mounts = Array.isArray(value.Mounts)
      ? value.Mounts.map((mountValue) => {
          const mount = mountValue as Readonly<Record<string, unknown>>;
          return Object.freeze({
            type: mount.Type,
            source: mount.Source,
            destination: mount.Destination,
            readWrite: mount.RW,
          });
        }).sort((left, right) => String(left.destination).localeCompare(String(right.destination)))
      : [];
    const networks =
      typeof networkSettings.Networks === "object" && networkSettings.Networks !== null
        ? Object.fromEntries(
            Object.entries(networkSettings.Networks as Readonly<Record<string, unknown>>).map(([network, raw]) => {
              const definition = (raw ?? {}) as Readonly<Record<string, unknown>>;
              return [
                network,
                Object.freeze({
                  aliases: Array.isArray(definition.Aliases)
                    ? [...definition.Aliases].filter((alias): alias is string => typeof alias === "string").sort()
                    : [],
                }),
              ];
            }),
          )
        : {};
    const actualConfiguration = Object.freeze({
      imageId: value.Image,
      image: configuration.Image,
      command: Array.isArray(configuration.Cmd) ? configuration.Cmd : undefined,
      environment: Array.isArray(configuration.Env)
        ? [...configuration.Env].filter((item): item is string => typeof item === "string").sort()
        : [],
      labels,
      mounts: Object.freeze(mounts),
      restart: hostConfiguration.RestartPolicy,
      portBindings: hostConfiguration.PortBindings,
      networkMode: hostConfiguration.NetworkMode,
      networks: Object.freeze(networks),
      healthcheck: configuration.Healthcheck,
      stopTimeout: configuration.StopTimeout,
      stopSignal: configuration.StopSignal,
      sharedMemory: hostConfiguration.ShmSize,
    });

    return Object.freeze({
      exists: true,
      running: state.Running === true,
      status: typeof state.Status === "string" ? state.Status : undefined,
      health:
        typeof state.Health === "object" && state.Health !== null
          ? String((state.Health as Readonly<Record<string, unknown>>).Status ?? "")
          : undefined,
      image: typeof configuration.Image === "string" ? configuration.Image : undefined,
      imageId: typeof value.Image === "string" ? value.Image : undefined,
      desiredHash: labels["io.cratenaut.spec-hash"],
      labels,
      configuration: actualConfiguration,
    });
  }

  public async checkNetwork(name: string, labels: Readonly<Record<string, string>>): Promise<boolean> {
    const existing = await this.#connection.execute("docker", ["network", "inspect", name], { allowFailure: true });

    if (existing.code === 0) {
      const values = JSON.parse(existing.stdout) as readonly Readonly<Record<string, unknown>>[];
      const network = values[0] ?? {};
      const existingLabels = (network.Labels ?? {}) as Readonly<Record<string, string>>;

      if (
        existingLabels["io.cratenaut.managed"] !== "true" ||
        existingLabels["io.cratenaut.project"] !== labels["io.cratenaut.project"] ||
        existingLabels["io.cratenaut.server"] !== labels["io.cratenaut.server"]
      ) {
        throw new TypeError(`Docker 网络“${name}”已存在，但不属于当前 Cratenaut 服务器`);
      }

      return true;
    }

    return false;
  }

  public async ensureNetwork(name: string, labels: Readonly<Record<string, string>>): Promise<void> {
    if (await this.checkNetwork(name, labels)) {
      return;
    }

    const args = ["network", "create"];

    for (const [key, value] of Object.entries(labels)) {
      args.push("--label", `${key}=${value}`);
    }

    args.push(name);
    await this.#connection.execute("docker", args);
  }

  public async pull(image: string): Promise<void> {
    await this.#connection.execute("docker", ["pull", image]);
  }

  public async resolveImageDigest(image: string): Promise<string | undefined> {
    const result = await this.#connection.execute(
      "docker",
      ["image", "inspect", image, "--format", "{{json .RepoDigests}}"],
      { allowFailure: true },
    );

    if (result.code !== 0) {
      return undefined;
    }

    const digests = JSON.parse(result.stdout.trim()) as readonly string[] | null;
    return digests?.[0];
  }

  public async run(options: IRunContainerOptions): Promise<void> {
    const args = [
      "run",
      "--detach",
      "--name",
      options.name,
      "--network",
      options.network,
      "--network-alias",
      options.networkAlias,
      "--restart",
      options.restart,
    ];

    for (const [key, value] of Object.entries(options.labels)) {
      args.push("--label", `${key}=${value}`);
    }

    if (options.environmentFile !== undefined) {
      args.push("--env-file", options.environmentFile);
    }

    for (const mount of options.mounts) {
      args.push("--mount", `type=bind,src=${mount.source},dst=${mount.target}${mount.readOnly ? ",readonly" : ""}`);
    }

    for (const port of options.ports) {
      if (port.host !== undefined) {
        const address =
          port.address === undefined ? "" : port.address.includes(":") ? `[${port.address}]:` : `${port.address}:`;
        args.push("--publish", `${address}${port.host}:${port.container}/${port.protocol}`);
      }
    }

    if (options.healthcheck !== undefined) {
      args.push(
        "--health-cmd",
        options.healthcheck.command,
        "--health-interval",
        options.healthcheck.interval,
        "--health-timeout",
        options.healthcheck.timeout,
        "--health-start-period",
        options.healthcheck.startPeriod,
        "--health-retries",
        String(options.healthcheck.retries),
      );
    }

    args.push("--stop-timeout", String(options.stopTimeout));

    if (options.stopSignal !== undefined) {
      args.push("--stop-signal", options.stopSignal);
    }

    if (options.sharedMemory !== undefined) {
      args.push("--shm-size", options.sharedMemory);
    }

    args.push(options.image, ...(options.command ?? []));
    await this.#connection.execute("docker", args);
  }

  public async waitUntilReady(name: string, timeout: number): Promise<void> {
    const deadline = Date.now() + timeout * 1_000;

    while (Date.now() < deadline) {
      const state = await this.inspect(name);

      if (!state.exists || !state.running) {
        throw new TypeError(`容器“${name}”在等待健康状态时已经停止`);
      }

      if (state.health === "healthy") {
        return;
      }

      if (state.health === "unhealthy") {
        throw new TypeError(`容器“${name}”健康检查失败`);
      }

      await Bun.sleep(500);
    }

    throw new TypeError(`等待容器“${name}”健康状态超时`);
  }

  public async remove(name: string): Promise<void> {
    await this.#connection.execute("docker", ["rm", "--force", name], { allowFailure: true });
  }

  public async start(name: string): Promise<void> {
    await this.#connection.execute("docker", ["start", name]);
  }

  public async stop(name: string, timeout = 10): Promise<void> {
    await this.#connection.execute("docker", ["stop", "--time", String(timeout), name]);
  }

  public async restart(name: string, timeout = 10): Promise<void> {
    await this.#connection.execute("docker", ["restart", "--time", String(timeout), name]);
  }

  public async logs(
    name: string,
    args: readonly string[],
    observer?: Readonly<{ stdout?: (chunk: string) => void; stderr?: (chunk: string) => void }>,
  ): Promise<void> {
    if (observer === undefined) {
      await this.#connection.executeInteractive("docker", ["logs", ...args, name]);
      return;
    }

    await this.#connection.executeStream("docker", ["logs", ...args, name], observer);
  }

  public async exec(
    name: string,
    command: readonly string[],
    options: Readonly<{ tty?: boolean; interactive?: boolean; user?: string; workingDirectory?: string }> = {},
  ): Promise<void> {
    const args = ["exec"];

    if (options.interactive === true) {
      args.push("--interactive");
    }

    if (options.tty === true) {
      args.push("--tty");
    }

    if (options.user !== undefined) {
      args.push("--user", options.user);
    }

    if (options.workingDirectory !== undefined) {
      args.push("--workdir", options.workingDirectory);
    }

    args.push(name, ...command);
    await this.#connection.executeInteractive("docker", args, { tty: options.tty === true });
  }

  public async execTask(
    name: string,
    command: readonly string[],
    options: Readonly<{ stdin?: string; workingDirectory?: string }> = {},
  ): Promise<void> {
    const args = ["exec", "--interactive"];

    if (options.workingDirectory !== undefined) {
      args.push("--workdir", options.workingDirectory);
    }

    args.push(name, ...command);
    await this.#connection.execute("docker", args, { stdin: options.stdin });
  }
}

/**
 * 创建 `Docker` 客户端
 */
export function createDockerClient(connection: IConnectionClient): IDockerClient {
  return new DockerClient(connection);
}
