import { change, defineCrate, secret, t } from "@cratenaut/core";

/**
 * `PostgreSQL` 官方 `Crate`
 */
export const postgres = defineCrate({
  name: "postgres",
  version: "0.1.0",

  optionsSchema: t
    .Codec(
      t.Refine(
        t.Object(
          {
            image: change.unknown(t.Optional(t.String({ minLength: 1 })), {
              reason: "自定义 PostgreSQL 镜像的兼容性需要部署者判断",
            }),
            username: change.immutable(t.Optional(t.String({ pattern: "^[A-Za-z_][A-Za-z0-9_-]*$" })), {
              reason: "初始数据库用户只在空数据目录中创建",
            }),
            password: change.immutable(secret.schema(t.String({ minLength: 1 })), {
              reason: "镜像初始化密码不会自动轮换已有数据库用户的密码",
            }),
            database: change.immutable(t.Optional(t.String({ pattern: "^[A-Za-z_][A-Za-z0-9_-]*$" })), {
              reason: "初始数据库只在空数据目录中创建",
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
              { reason: "修改端口发布会重建 PostgreSQL 容器" },
            ),
            sharedMemory: change.disruptive(
              t.Optional(
                t.Refine(
                  t.String(),
                  (value) => /^[1-9]\d*(?:[bkmgBKMG])?$/.test(value),
                  () => "共享内存大小必须使用正整数和可选的 b、k、m、g 单位",
                ),
              ),
              { reason: "修改共享内存大小会重建 PostgreSQL 容器" },
            ),
            initialization: change.immutable(
              t.Optional(
                t.Object(
                  {
                    encoding: t.Optional(t.String({ minLength: 1 })),
                    locale: t.Optional(t.String({ minLength: 1 })),
                    dataChecksums: t.Optional(t.Boolean()),
                    arguments: t.Optional(
                      t.Array(
                        t.Refine(
                          t.String({ minLength: 1 }),
                          (value) => !/[\r\n]/.test(value),
                          () => "初始化参数不能包含换行符",
                        ),
                      ),
                    ),
                    scripts: t.Optional(
                      t.Array(
                        t.Object(
                          {
                            name: t.Refine(
                              t.String(),
                              (value) => /^[0-9A-Za-z][0-9A-Za-z._-]*\.sql$/.test(value),
                              () => "初始化脚本名称必须以 .sql 结尾且不能包含路径分隔符",
                            ),
                            content: t.String(),
                          },
                          { additionalProperties: false },
                        ),
                        { maxItems: 100 },
                      ),
                    ),
                  },
                  { additionalProperties: false },
                ),
              ),
              { reason: "初始化配置只在空数据目录中生效" },
            ),
            parameters: change.unknown(
              t.Optional(
                t.Record(t.String({ pattern: "^[a-z][a-z0-9_.]*$" }), t.Union([t.String(), t.Number(), t.Boolean()])),
              ),
              { reason: "PostgreSQL 原生参数的运行影响由具体参数决定" },
            ),
            extraEnvironment: change.unknown(
              t.Optional(t.Record(t.String({ pattern: "^[A-Za-z_][A-Za-z0-9_]*$" }), secret.schema(t.String()))),
              { reason: "额外环境变量的含义由自定义镜像决定" },
            ),
          },
          { additionalProperties: false },
        ),
        (options) => {
          const scriptNames = options.initialization?.scripts?.map((script) => script.name) ?? [];
          const reservedParameters = new Set(["config_file", "data_directory", "hba_file", "ident_file", "port"]);
          const reservedEnvironment = new Set([
            "PGDATA",
            "POSTGRES_DB",
            "POSTGRES_INITDB_ARGS",
            "POSTGRES_PASSWORD",
            "POSTGRES_PASSWORD_FILE",
            "POSTGRES_USER",
          ]);

          return (
            new Set(scriptNames).size === scriptNames.length &&
            Object.keys(options.parameters ?? {}).every((name) => !reservedParameters.has(name)) &&
            Object.keys(options.extraEnvironment ?? {}).every((name) => !reservedEnvironment.has(name))
          );
        },
        () => "初始化脚本名称不能重复，且原生配置不能覆盖 Cratenaut 管理的参数",
      ),
    )
    .Decode((options) => ({
      image: options.image ?? "postgres:18.6-alpine",
      username: options.username ?? "postgres",
      password: options.password,
      database: options.database ?? "postgres",
      publish: options.publish ?? false,
      sharedMemory: options.sharedMemory ?? "128m",
      initialization: options.initialization,
      parameters: options.parameters ?? {},
      extraEnvironment: options.extraEnvironment ?? {},
    }))
    .Encode((options) => options),

  assessChange: ({ previousOptions, nextOptions }) => {
    if (previousOptions === undefined || previousOptions.image === nextOptions.image) {
      return undefined;
    }

    const previousMajor = /^postgres:(\d+)/.exec(previousOptions.image)?.[1];
    const nextMajor = /^postgres:(\d+)/.exec(nextOptions.image)?.[1];

    if (previousMajor !== undefined && nextMajor !== undefined && previousMajor !== nextMajor) {
      return {
        risk: "destructive",
        reason: `PostgreSQL 镜像主版本将从 ${previousMajor} 修改为 ${nextMajor}，必须先执行数据库升级流程`,
      };
    }

    return undefined;
  },

  resources: ({ options, resource }) => {
    const initializationArguments = [
      ...(options.initialization?.encoding === undefined ? [] : [`--encoding=${options.initialization.encoding}`]),
      ...(options.initialization?.locale === undefined ? [] : [`--locale=${options.initialization.locale}`]),
      ...(options.initialization?.dataChecksums === true ? ["--data-checksums"] : []),
      ...(options.initialization?.arguments ?? []),
    ];
    const publish = options.publish;
    const hostPort =
      publish === false
        ? undefined
        : publish === true
          ? 5432
          : typeof publish === "number"
            ? publish
            : (publish.port ?? 5432);
    const address = typeof publish === "object" ? publish.address : undefined;
    const parameterArguments = Object.entries(options.parameters).flatMap(([name, value]) => [
      "-c",
      `${name}=${String(value)}`,
    ]);
    const scripts = options.initialization?.scripts ?? [];

    return [
      resource.file("password", {
        content: options.password,
        mode: 0o600,
      }),
      ...scripts.map((script, index) =>
        resource.file(`init-${index}` as `init-${number}`, {
          content: script.content,
          mode: 0o600,
        }),
      ),
      resource.storage("data"),
      resource.container("server", {
        image: options.image,
        command: ["postgres", ...parameterArguments],
        environment: {
          ...options.extraEnvironment,
          POSTGRES_DB: options.database,
          POSTGRES_USER: options.username,
          POSTGRES_PASSWORD_FILE: "/run/secrets/postgres-password",
          ...(initializationArguments.length === 0 ? {} : { POSTGRES_INITDB_ARGS: initializationArguments.join(" ") }),
        },
        mounts: [
          {
            source: resource.fileRef("password"),
            target: "/run/secrets/postgres-password",
            readOnly: true,
          },
          {
            source: resource.storageRef("data"),
            target: "/var/lib/postgresql",
          },
          ...scripts.map((script, index) => ({
            source: resource.fileRef(`init-${index}` as `init-${number}`),
            target: `/docker-entrypoint-initdb.d/${script.name}`,
            readOnly: true,
          })),
        ],
        ports: [{ container: 5432, host: hostPort, address }],
        sharedMemory: options.sharedMemory,
        stopTimeout: 60,
        healthcheck: {
          command: 'pg_isready --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"',
          interval: "10s",
          timeout: "5s",
          startPeriod: "20s",
          retries: 5,
        },
        startupTimeout: 90,
      }),
    ];
  },
});
