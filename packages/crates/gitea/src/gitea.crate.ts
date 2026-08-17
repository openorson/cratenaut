import { change, defineCrate, secret, t } from "@cratenaut/core";

/**
 * `Gitea` 官方 `Crate`
 */
export const gitea = defineCrate({
  name: "gitea",
  version: "0.1.1",

  optionsSchema: t
    .Codec(
      t.Refine(
        t.Object(
          {
            publicUrl: change.disruptive(
              t
                .Codec(
                  t.Refine(
                    t.String(),
                    (value) => {
                      try {
                        const url = new URL(value);

                        return (
                          ["http:", "https:"].includes(url.protocol) &&
                          url.username === "" &&
                          url.password === "" &&
                          url.search === "" &&
                          url.hash === ""
                        );
                      } catch {
                        return false;
                      }
                    },
                    () => "Gitea 公开地址必须是有效的 HTTP 或 HTTPS 地址",
                  ),
                )
                .Decode((value) => (value.endsWith("/") ? value : `${value}/`))
                .Encode((value) => value),
              { reason: "修改公开地址需要重启 Gitea 并更新仓库链接" },
            ),
            image: change.unknown(t.Optional(t.String({ minLength: 1 })), {
              reason: "自定义 Gitea 镜像的数据布局和升级兼容性需要部署者判断",
            }),
            database: change.disruptive(
              t.Optional(
                t.Union([
                  t.Object(
                    {
                      type: change.immutable(t.Literal("sqlite"), {
                        reason: "数据库类型不能通过修改配置完成迁移",
                      }),
                    },
                    { additionalProperties: false },
                  ),
                  t.Object(
                    {
                      type: change.immutable(t.Literal("postgres"), {
                        reason: "数据库类型不能通过修改配置完成迁移",
                      }),
                      host: t.String({ minLength: 1 }),
                      port: t.Optional(t.Integer({ minimum: 1, maximum: 65_535 })),
                      database: t.Optional(t.String({ minLength: 1 })),
                      username: t.String({ minLength: 1 }),
                      password: secret.schema(t.String({ minLength: 1 })),
                      sslMode: t.Optional(t.Enum(["disable", "require", "verify-ca", "verify-full"])),
                    },
                    { additionalProperties: false },
                  ),
                  t.Object(
                    {
                      type: change.immutable(t.Literal("mysql"), {
                        reason: "数据库类型不能通过修改配置完成迁移",
                      }),
                      host: t.String({ minLength: 1 }),
                      port: t.Optional(t.Integer({ minimum: 1, maximum: 65_535 })),
                      database: t.Optional(t.String({ minLength: 1 })),
                      username: t.String({ minLength: 1 }),
                      password: secret.schema(t.String({ minLength: 1 })),
                      charset: t.Optional(t.String({ minLength: 1 })),
                    },
                    { additionalProperties: false },
                  ),
                ]),
              ),
              { reason: "修改数据库连接需要重启 Gitea" },
            ),
            http: change.disruptive(
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
              { reason: "修改 Gitea HTTP 端口发布会重建容器" },
            ),
            ssh: change.disruptive(
              t.Optional(
                t.Union([
                  t.Literal(false),
                  t.Object(
                    {
                      publish: t.Union([
                        t.Literal(true),
                        t.Integer({ minimum: 1, maximum: 65_535 }),
                        t.Object(
                          {
                            port: t.Optional(t.Integer({ minimum: 1, maximum: 65_535 })),
                            address: t.Optional(t.String({ minLength: 1 })),
                          },
                          { additionalProperties: false },
                        ),
                      ]),
                      domain: t.Optional(t.String({ minLength: 1 })),
                      advertisedPort: t.Optional(t.Integer({ minimum: 1, maximum: 65_535 })),
                    },
                    { additionalProperties: false },
                  ),
                ]),
              ),
              { reason: "修改 Gitea SSH 配置会重建容器" },
            ),
            registration: change.disruptive(t.Optional(t.Enum(["open", "closed", "manual", "email"])), {
              reason: "修改注册策略需要重启 Gitea",
            }),
            mailer: change.disruptive(
              t.Optional(
                t.Union([
                  t.Literal(false),
                  t.Object(
                    {
                      protocol: t.Enum(["smtp", "smtps", "smtp+starttls"]),
                      host: t.String({ minLength: 1 }),
                      port: t.Integer({ minimum: 1, maximum: 65_535 }),
                      from: t.String({ minLength: 1 }),
                      username: t.Optional(t.String()),
                      password: t.Optional(secret.schema(t.String())),
                    },
                    { additionalProperties: false },
                  ),
                ]),
              ),
              { reason: "修改邮件服务需要重启 Gitea" },
            ),
            features: change.disruptive(
              t.Optional(
                t.Object(
                  {
                    lfs: t.Optional(t.Boolean()),
                    actions: t.Optional(t.Boolean()),
                    packages: t.Optional(t.Boolean()),
                  },
                  { additionalProperties: false },
                ),
              ),
              { reason: "修改 Gitea 功能开关需要重启容器" },
            ),
            uid: change.unknown(t.Optional(t.Integer({ minimum: 1 })), {
              reason: "修改容器用户编号可能影响现有数据目录权限",
            }),
            gid: change.unknown(t.Optional(t.Integer({ minimum: 1 })), {
              reason: "修改容器用户组编号可能影响现有数据目录权限",
            }),
            security: t.Optional(
              t.Object(
                {
                  secretKey: change.immutable(t.Optional(secret.schema(t.String({ minLength: 1 }))), {
                    reason: "修改 Gitea SECRET_KEY 会导致已有加密数据无法解密",
                  }),
                  internalToken: change.immutable(t.Optional(secret.schema(t.String({ minLength: 1 }))), {
                    reason: "修改 Gitea INTERNAL_TOKEN 会使内部调用凭据失效",
                  }),
                },
                { additionalProperties: false },
              ),
            ),
            configuration: change.unknown(
              t.Optional(
                t.Record(
                  t.String({ pattern: "^[A-Za-z][A-Za-z0-9_]*$" }),
                  t.Record(t.String({ pattern: "^[A-Za-z][A-Za-z0-9_]*$" }), secret.schema(t.String())),
                ),
              ),
              { reason: "Gitea 原生配置的运行影响由具体字段决定" },
            ),
            extraEnvironment: change.unknown(
              t.Optional(t.Record(t.String({ pattern: "^[A-Za-z_][A-Za-z0-9_]*$" }), secret.schema(t.String()))),
              { reason: "额外环境变量的含义由自定义镜像决定" },
            ),
          },
          { additionalProperties: false },
        ),
        (options) => {
          const reservedConfiguration = new Set([
            "actions.ENABLED",
            "database.CHARSET",
            "database.DB_TYPE",
            "database.HOST",
            "database.NAME",
            "database.PASSWD",
            "database.PATH",
            "database.SSL_MODE",
            "database.USER",
            "mailer.ENABLED",
            "mailer.FROM",
            "mailer.PASSWD",
            "mailer.PROTOCOL",
            "mailer.SMTP_ADDR",
            "mailer.SMTP_PORT",
            "mailer.USER",
            "packages.ENABLED",
            "security.INTERNAL_TOKEN",
            "security.SECRET_KEY",
            "server.DISABLE_SSH",
            "server.DOMAIN",
            "server.HTTP_PORT",
            "server.LFS_START_SERVER",
            "server.PROTOCOL",
            "server.ROOT_URL",
            "server.SSH_DOMAIN",
            "server.SSH_PORT",
            "service.DISABLE_REGISTRATION",
            "service.REGISTER_EMAIL_CONFIRM",
            "service.REGISTER_MANUAL_CONFIRM",
          ]);
          const configurationValid = Object.entries(options.configuration ?? {}).every(([section, values]) =>
            Object.keys(values).every(
              (key) => !reservedConfiguration.has(`${section.toLowerCase()}.${key.toUpperCase()}`),
            ),
          );
          const environmentValid = Object.keys(options.extraEnvironment ?? {}).every(
            (name) => !["USER_GID", "USER_UID"].includes(name) && !name.startsWith("GITEA__"),
          );

          return (
            configurationValid &&
            environmentValid &&
            !(options.registration === "email" && (options.mailer === undefined || options.mailer === false))
          );
        },
        () => "邮件确认注册需要配置邮件服务，且高级配置不能覆盖 Cratenaut 管理的字段",
      ),
    )
    .Decode((options) => ({
      publicUrl: options.publicUrl,
      image: options.image ?? "docker.gitea.com/gitea:1.27.2",
      database: options.database ?? { type: "sqlite" as const },
      http: options.http ?? false,
      ssh: options.ssh ?? false,
      registration: options.registration ?? "closed",
      mailer: options.mailer ?? false,
      features: options.features ?? {},
      uid: options.uid ?? 1_000,
      gid: options.gid ?? 1_000,
      security: options.security ?? {},
      configuration: options.configuration ?? {},
      extraEnvironment: options.extraEnvironment ?? {},
    }))
    .Encode((options) => options),

  resources: ({ options, resource }) => {
    const publicUrl = new URL(options.publicUrl);
    const database = options.database;
    const http = options.http;
    const httpPort =
      http === false ? undefined : http === true ? 3_000 : typeof http === "number" ? http : (http.port ?? 3_000);
    const httpAddress = typeof http === "object" ? http.address : undefined;
    const ssh = options.ssh;
    const sshPort =
      ssh === false
        ? undefined
        : ssh.publish === true
          ? 22
          : typeof ssh.publish === "number"
            ? ssh.publish
            : (ssh.publish.port ?? 22);
    const sshAddress = ssh !== false && typeof ssh.publish === "object" ? ssh.publish.address : undefined;
    const databasePassword = database.type === "sqlite" ? undefined : database.password;
    const mailerPassword = options.mailer === false ? undefined : options.mailer.password;
    const nativeEnvironment = Object.fromEntries(
      Object.entries(options.configuration).flatMap(([section, values]) =>
        Object.entries(values).map(([key, value]) => [`GITEA__${section}__${key}`, value]),
      ),
    );
    const registrationEnvironment =
      options.registration === undefined
        ? {}
        : options.registration === "closed"
          ? {
              GITEA__service__DISABLE_REGISTRATION: "true",
              GITEA__service__REGISTER_EMAIL_CONFIRM: "false",
              GITEA__service__REGISTER_MANUAL_CONFIRM: "false",
            }
          : {
              GITEA__service__DISABLE_REGISTRATION: "false",
              GITEA__service__REGISTER_EMAIL_CONFIRM: options.registration === "email" ? "true" : "false",
              GITEA__service__REGISTER_MANUAL_CONFIRM: options.registration === "manual" ? "true" : "false",
            };
    const databaseEnvironment =
      database.type === "sqlite"
        ? {
            GITEA__database__DB_TYPE: "sqlite3",
            GITEA__database__PATH: "/data/gitea/gitea.db",
          }
        : {
            GITEA__database__DB_TYPE: database.type,
            GITEA__database__HOST: `${database.host}:${database.port ?? (database.type === "postgres" ? 5_432 : 3_306)}`,
            GITEA__database__NAME: database.database ?? "gitea",
            GITEA__database__USER: database.username,
            GITEA__database__PASSWD__FILE: "/run/secrets/database-password",
            ...(database.type === "postgres"
              ? { GITEA__database__SSL_MODE: database.sslMode ?? "disable" }
              : { GITEA__database__CHARSET: database.charset ?? "utf8mb4" }),
          };
    const mailerEnvironment =
      options.mailer === false
        ? { GITEA__mailer__ENABLED: "false" }
        : {
            GITEA__mailer__ENABLED: "true",
            GITEA__mailer__PROTOCOL: options.mailer.protocol,
            GITEA__mailer__SMTP_ADDR: options.mailer.host,
            GITEA__mailer__SMTP_PORT: String(options.mailer.port),
            GITEA__mailer__FROM: options.mailer.from,
            ...(options.mailer.username === undefined ? {} : { GITEA__mailer__USER: options.mailer.username }),
            ...(mailerPassword === undefined ? {} : { GITEA__mailer__PASSWD__FILE: "/run/secrets/mailer-password" }),
          };
    const environment = Object.fromEntries(
      Object.entries({
        ...options.extraEnvironment,
        ...nativeEnvironment,
        USER_UID: String(options.uid),
        USER_GID: String(options.gid),
        GITEA__server__PROTOCOL: "http",
        GITEA__server__HTTP_PORT: "3000",
        GITEA__server__DOMAIN: publicUrl.hostname,
        GITEA__server__ROOT_URL: options.publicUrl,
        GITEA__server__DISABLE_SSH: ssh === false ? "true" : "false",
        ...(ssh === false
          ? {}
          : {
              GITEA__server__SSH_DOMAIN: ssh.domain ?? publicUrl.hostname,
              GITEA__server__SSH_PORT: String(ssh.advertisedPort ?? sshPort ?? 22),
            }),
        ...databaseEnvironment,
        ...registrationEnvironment,
        ...mailerEnvironment,
        ...(options.features.lfs === undefined
          ? {}
          : { GITEA__server__LFS_START_SERVER: options.features.lfs ? "true" : "false" }),
        ...(options.features.actions === undefined
          ? {}
          : { GITEA__actions__ENABLED: options.features.actions ? "true" : "false" }),
        ...(options.features.packages === undefined
          ? {}
          : { GITEA__packages__ENABLED: options.features.packages ? "true" : "false" }),
        ...(options.security.secretKey === undefined
          ? {}
          : { GITEA__security__SECRET_KEY__FILE: "/run/secrets/secret-key" }),
        ...(options.security.internalToken === undefined
          ? {}
          : { GITEA__security__INTERNAL_TOKEN__FILE: "/run/secrets/internal-token" }),
      }).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );

    return [
      ...(databasePassword === undefined
        ? []
        : [resource.file("database-password", { content: databasePassword, mode: 0o600 })]),
      ...(mailerPassword === undefined
        ? []
        : [resource.file("mailer-password", { content: mailerPassword, mode: 0o600 })]),
      ...(options.security.secretKey === undefined
        ? []
        : [resource.file("secret-key", { content: options.security.secretKey, mode: 0o600 })]),
      ...(options.security.internalToken === undefined
        ? []
        : [resource.file("internal-token", { content: options.security.internalToken, mode: 0o600 })]),
      resource.storage("data"),
      resource.container("server", {
        image: options.image,
        environment,
        mounts: [
          {
            source: resource.storageRef("data"),
            target: "/data",
          },
          ...(databasePassword === undefined
            ? []
            : [
                {
                  source: resource.fileRef("database-password"),
                  target: "/run/secrets/database-password",
                  readOnly: true,
                },
              ]),
          ...(mailerPassword === undefined
            ? []
            : [
                {
                  source: resource.fileRef("mailer-password"),
                  target: "/run/secrets/mailer-password",
                  readOnly: true,
                },
              ]),
          ...(options.security.secretKey === undefined
            ? []
            : [
                {
                  source: resource.fileRef("secret-key"),
                  target: "/run/secrets/secret-key",
                  readOnly: true,
                },
              ]),
          ...(options.security.internalToken === undefined
            ? []
            : [
                {
                  source: resource.fileRef("internal-token"),
                  target: "/run/secrets/internal-token",
                  readOnly: true,
                },
              ]),
        ],
        ports: [
          { container: 3_000, host: httpPort, address: httpAddress },
          ...(ssh === false ? [] : [{ container: 22, host: sshPort, address: sshAddress }]),
        ],
        stopTimeout: 60,
        healthcheck: {
          command: "wget --quiet --spider http://127.0.0.1:3000/api/healthz",
          interval: "15s",
          timeout: "5s",
          startPeriod: "30s",
          retries: 10,
        },
        startupTimeout: 180,
      }),
    ];
  },
});
