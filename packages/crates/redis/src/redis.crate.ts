import { change, defineCrate, secret, t } from "@cratenaut/core";

/**
 * `Redis` 官方 `Crate`
 */
export const redis = defineCrate({
  name: "redis",
  version: "0.1.1",

  optionsSchema: t
    .Codec(
      t.Union([
        t.Undefined(),
        t.Refine(
          t.Object(
            {
              image: change.unknown(t.Optional(t.String({ minLength: 1 })), {
                reason: "自定义 Redis 镜像的兼容性需要部署者判断",
              }),
              password: change.disruptive(t.Optional(secret.schema(t.String({ minLength: 1 }))), {
                reason: "修改 Redis 密码需要重建容器并中断现有连接",
              }),
              publish: change.disruptive(
                t.Optional(
                  t.Union([
                    t.Boolean(),
                    t.Integer({ minimum: 1, maximum: 65_535 }),
                    t.Object(
                      {
                        port: t.Optional(t.Integer({ minimum: 1, maximum: 65_535 })),
                        address: t.Optional(t.String({ minLength: 1 })),
                      },
                      { additionalProperties: false },
                    ),
                  ]),
                ),
                { reason: "修改端口发布会重建 Redis 容器" },
              ),
              persistence: change.disruptive(
                t.Optional(
                  t.Union([
                    t.Literal(false),
                    t.Object(
                      {
                        mode: t.Literal("rdb"),
                        save: t.Optional(
                          t.Array(
                            t.Object(
                              {
                                seconds: t.Integer({ minimum: 1 }),
                                changes: t.Integer({ minimum: 1 }),
                              },
                              { additionalProperties: false },
                            ),
                          ),
                        ),
                      },
                      { additionalProperties: false },
                    ),
                    t.Object(
                      {
                        mode: t.Literal("aof"),
                        fsync: t.Optional(t.Enum(["always", "everysec", "no"])),
                      },
                      { additionalProperties: false },
                    ),
                    t.Object(
                      {
                        mode: t.Literal("both"),
                        save: t.Optional(
                          t.Array(
                            t.Object(
                              {
                                seconds: t.Integer({ minimum: 1 }),
                                changes: t.Integer({ minimum: 1 }),
                              },
                              { additionalProperties: false },
                            ),
                          ),
                        ),
                        fsync: t.Optional(t.Enum(["always", "everysec", "no"])),
                      },
                      { additionalProperties: false },
                    ),
                  ]),
                ),
                { reason: "修改 Redis 持久化模式需要重建容器" },
              ),
              databases: change.disruptive(t.Optional(t.Integer({ minimum: 1, maximum: 1_000 })), {
                reason: "修改逻辑数据库数量需要重启 Redis",
              }),
              memory: change.disruptive(
                t.Optional(
                  t.Object(
                    {
                      max: t.Optional(
                        t.Refine(
                          t.String(),
                          (value) => /^[1-9]\d*(?:kb|mb|gb)$/i.test(value),
                          () => "最大内存必须使用正整数和 kb、mb、gb 单位",
                        ),
                      ),
                      policy: t.Optional(
                        t.Enum([
                          "noeviction",
                          "allkeys-lru",
                          "allkeys-lfu",
                          "allkeys-random",
                          "volatile-lru",
                          "volatile-lfu",
                          "volatile-random",
                          "volatile-ttl",
                        ]),
                      ),
                    },
                    { additionalProperties: false },
                  ),
                ),
                { reason: "修改内存限制或淘汰策略需要重启 Redis" },
              ),
              configuration: change.unknown(
                t.Optional(
                  t.Record(
                    t.String({ pattern: "^[a-z][a-z0-9-]*$" }),
                    t.Union([
                      t.String(),
                      t.Number(),
                      t.Boolean(),
                      t.Array(t.Union([t.String(), t.Number(), t.Boolean()])),
                    ]),
                  ),
                ),
                { reason: "Redis 原生配置的运行影响由具体指令决定" },
              ),
              extraEnvironment: change.unknown(
                t.Optional(t.Record(t.String({ pattern: "^[A-Za-z_][A-Za-z0-9_]*$" }), secret.schema(t.String()))),
                { reason: "额外环境变量的含义由自定义镜像决定" },
              ),
            },
            { additionalProperties: false },
          ),
          (options) => {
            const reserved = new Set([
              "appendfsync",
              "appendonly",
              "bind",
              "daemonize",
              "databases",
              "dir",
              "maxmemory",
              "maxmemory-policy",
              "port",
              "protected-mode",
              "requirepass",
              "save",
            ]);

            return (
              Object.keys(options.configuration ?? {}).every((name) => !reserved.has(name)) &&
              !(options.publish !== undefined && options.publish !== false && options.password === undefined)
            );
          },
          () => "对外发布 Redis 端口时必须设置密码，且原生配置不能覆盖 Cratenaut 管理的指令",
        ),
      ]),
    )
    .Decode((input) => {
      const options = input ?? {};

      return {
        image: options.image ?? "redis:8.10.0-alpine",
        password: options.password,
        publish: options.publish ?? false,
        persistence: options.persistence ?? { mode: "rdb" as const },
        databases: options.databases ?? 16,
        memory: options.memory,
        configuration: options.configuration ?? {},
        extraEnvironment: options.extraEnvironment ?? {},
      };
    })
    .Encode((options) => options),

  assessChange: ({ previousOptions, nextOptions, changedPaths }) => {
    if (
      previousOptions !== undefined &&
      previousOptions.persistence !== false &&
      nextOptions.persistence === false &&
      changedPaths.some((path) => path === "persistence" || path.startsWith("persistence."))
    ) {
      return {
        risk: "destructive",
        reason: "关闭 Redis 持久化会移除当前实例的托管数据存储",
      };
    }

    return undefined;
  },

  resources: ({ options, resource }) => {
    const quote = (value: string): string =>
      `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\r", "\\r").replaceAll("\n", "\\n")}"`;
    const renderValue = (value: string | number | boolean): string =>
      typeof value === "string" ? quote(value) : typeof value === "boolean" ? (value ? "yes" : "no") : String(value);
    const persistence = options.persistence;
    const saveRules =
      persistence !== false && (persistence.mode === "rdb" || persistence.mode === "both")
        ? (persistence.save ?? [
            { seconds: 3_600, changes: 1 },
            { seconds: 300, changes: 100 },
            { seconds: 60, changes: 10_000 },
          ])
        : [];
    const lines = [
      "bind 0.0.0.0",
      "protected-mode yes",
      "port 6379",
      "daemonize no",
      `databases ${options.databases}`,
      "dir /data",
      ...(options.password === undefined ? [] : [`requirepass ${quote(options.password)}`]),
      ...(saveRules.length === 0 ? ['save ""'] : saveRules.map((rule) => `save ${rule.seconds} ${rule.changes}`)),
      `appendonly ${persistence !== false && (persistence.mode === "aof" || persistence.mode === "both") ? "yes" : "no"}`,
      ...(persistence !== false && (persistence.mode === "aof" || persistence.mode === "both")
        ? [`appendfsync ${persistence.fsync ?? "everysec"}`]
        : []),
      ...(options.memory?.max === undefined ? [] : [`maxmemory ${options.memory.max}`]),
      ...(options.memory?.policy === undefined ? [] : [`maxmemory-policy ${options.memory.policy}`]),
      ...Object.entries(options.configuration).map(([name, value]) =>
        Array.isArray(value)
          ? `${name} ${value.map((item) => renderValue(item)).join(" ")}`
          : `${name} ${renderValue(value)}`,
      ),
    ];
    const publish = options.publish;
    const hostPort =
      publish === false
        ? undefined
        : publish === true
          ? 6379
          : typeof publish === "number"
            ? publish
            : (publish.port ?? 6379);
    const address = typeof publish === "object" ? publish.address : undefined;
    const persistent = persistence !== false;

    return [
      ...(options.password === undefined
        ? []
        : [
            resource.file("password", {
              content: options.password,
              mode: 0o600,
            }),
          ]),
      resource.file("config", {
        content: `${lines.join("\n")}\n`,
        mode: 0o600,
      }),
      ...(persistent ? [resource.storage("data")] : []),
      resource.container("server", {
        image: options.image,
        command: ["redis-server", "/usr/local/etc/redis/redis.conf"],
        environment: options.extraEnvironment,
        mounts: [
          {
            source: resource.fileRef("config"),
            target: "/usr/local/etc/redis/redis.conf",
            readOnly: true,
          },
          ...(options.password === undefined
            ? []
            : [
                {
                  source: resource.fileRef("password"),
                  target: "/run/secrets/redis-password",
                  readOnly: true,
                },
              ]),
          ...(persistent
            ? [
                {
                  source: resource.storageRef("data"),
                  target: "/data",
                  readOnly: false,
                },
              ]
            : []),
        ],
        ports: [{ container: 6379, host: hostPort, address }],
        stopTimeout: 30,
        healthcheck: {
          command:
            options.password === undefined
              ? "redis-cli ping"
              : 'REDISCLI_AUTH="$(cat /run/secrets/redis-password)" redis-cli ping',
          interval: "10s",
          timeout: "5s",
          startPeriod: "5s",
          retries: 5,
        },
        startupTimeout: 60,
      }),
    ];
  },
});
