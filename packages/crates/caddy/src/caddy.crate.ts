import { change, defineCrate, secret, t } from "@cratenaut/core";

/**
 * `Caddy` 官方 `Crate`
 */
export const caddy = defineCrate({
  name: "caddy",
  version: "0.0.1",

  optionsSchema: t
    .Codec(
      t.Refine(
        t.Object(
          {
            image: change.unknown(t.Optional(t.String({ minLength: 1 })), {
              reason: "自定义 Caddy 镜像的模块和配置兼容性需要部署者判断",
            }),
            email: change.safe(
              t.Optional(
                t.Refine(
                  t.String(),
                  (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
                  () => "证书通知邮箱格式无效",
                ),
              ),
              { reason: "证书通知邮箱可以通过配置重载更新" },
            ),
            ports: change.disruptive(
              t.Optional(
                t.Object(
                  {
                    http: t.Optional(
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
                    https: t.Optional(
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
                    http3: t.Optional(t.Boolean()),
                  },
                  { additionalProperties: false },
                ),
              ),
              { reason: "修改网关端口发布会重建 Caddy 容器" },
            ),
            logging: change.safe(
              t.Optional(
                t.Union([
                  t.Literal(false),
                  t.Object(
                    {
                      level: t.Optional(t.Enum(["DEBUG", "INFO", "WARN", "ERROR"])),
                      format: t.Optional(t.Enum(["console", "json"])),
                    },
                    { additionalProperties: false },
                  ),
                ]),
              ),
              { reason: "Caddy 日志配置可以通过配置重载更新" },
            ),
            config: change.safe(
              t.Union([
                t.Object(
                  {
                    format: t.Literal("structured"),
                    sites: t.Array(
                      t.Object(
                        {
                          addresses: t.Array(
                            t.Refine(
                              t.String({ minLength: 1 }),
                              (value) => !/[\s{}]/.test(value),
                              () => "Caddy 站点地址不能包含空白字符或大括号",
                            ),
                            { minItems: 1 },
                          ),
                          tls: t.Optional(t.Enum(["automatic", "internal", "off"])),
                          encode: t.Optional(
                            t.Union([
                              t.Literal(false),
                              t.Array(t.Enum(["zstd", "gzip"]), { minItems: 1, uniqueItems: true }),
                            ]),
                          ),
                          routes: t.Array(
                            t.Union([
                              t.Object(
                                {
                                  kind: t.Literal("reverseProxy"),
                                  paths: t.Optional(
                                    t.Array(
                                      t.Refine(
                                        t.String(),
                                        (value) => value.startsWith("/") && !/[\s{}]/.test(value),
                                        () => "路由路径必须以 / 开头且不能包含空白字符或大括号",
                                      ),
                                      { minItems: 1 },
                                    ),
                                  ),
                                  upstreams: t.Array(
                                    t.Refine(
                                      t.String({ minLength: 1 }),
                                      (value) => !/[\s{}]/.test(value),
                                      () => "上游地址不能包含空白字符或大括号",
                                    ),
                                    { minItems: 1 },
                                  ),
                                  healthUri: t.Optional(
                                    t.Refine(
                                      t.String(),
                                      (value) => value.startsWith("/") && !/[\s{}]/.test(value),
                                      () => "健康检查地址必须以 / 开头且不能包含空白字符或大括号",
                                    ),
                                  ),
                                  loadBalancing: t.Optional(t.Enum(["random", "round_robin", "least_conn", "first"])),
                                },
                                { additionalProperties: false },
                              ),
                              t.Object(
                                {
                                  kind: t.Literal("redirect"),
                                  paths: t.Optional(
                                    t.Array(
                                      t.Refine(
                                        t.String(),
                                        (value) => value.startsWith("/") && !/[\s{}]/.test(value),
                                        () => "路由路径必须以 / 开头且不能包含空白字符或大括号",
                                      ),
                                      { minItems: 1 },
                                    ),
                                  ),
                                  to: t.String({ minLength: 1 }),
                                  status: t.Optional(t.Enum([301, 302, 303, 307, 308])),
                                },
                                { additionalProperties: false },
                              ),
                              t.Object(
                                {
                                  kind: t.Literal("respond"),
                                  paths: t.Optional(
                                    t.Array(
                                      t.Refine(
                                        t.String(),
                                        (value) => value.startsWith("/") && !/[\s{}]/.test(value),
                                        () => "路由路径必须以 / 开头且不能包含空白字符或大括号",
                                      ),
                                      { minItems: 1 },
                                    ),
                                  ),
                                  body: t.Optional(t.String()),
                                  status: t.Optional(t.Integer({ minimum: 100, maximum: 599 })),
                                },
                                { additionalProperties: false },
                              ),
                            ]),
                            { minItems: 1 },
                          ),
                        },
                        { additionalProperties: false },
                      ),
                      { minItems: 1 },
                    ),
                  },
                  { additionalProperties: false },
                ),
                t.Object(
                  {
                    format: t.Literal("caddyfile"),
                    content: t.String({ minLength: 1 }),
                  },
                  { additionalProperties: false },
                ),
                t.Object(
                  {
                    format: t.Literal("json"),
                    content: t.Refine(
                      t.String({ minLength: 1 }),
                      (value) => {
                        try {
                          JSON.parse(value);
                          return true;
                        } catch {
                          return false;
                        }
                      },
                      () => "Caddy JSON 配置必须是有效的 JSON 文本",
                    ),
                  },
                  { additionalProperties: false },
                ),
              ]),
              { reason: "结构化 Caddy 配置会先校验再原地重载" },
            ),
            extraEnvironment: change.unknown(
              t.Optional(t.Record(t.String({ pattern: "^[A-Za-z_][A-Za-z0-9_]*$" }), secret.schema(t.String()))),
              { reason: "额外环境变量的含义由自定义镜像和模块决定" },
            ),
          },
          { additionalProperties: false },
        ),
        (options) => {
          const rawConfig = options.config.format !== "structured";

          return (
            Object.keys(options.extraEnvironment ?? {}).every(
              (name) => !["XDG_CONFIG_HOME", "XDG_DATA_HOME"].includes(name),
            ) &&
            !(options.ports?.https === false && options.ports.http3 === true) &&
            !(rawConfig && (options.email !== undefined || options.logging !== undefined))
          );
        },
        () => "原始配置不能同时使用结构化全局选项，HTTP/3 需要发布 HTTPS 端口，且不能覆盖托管数据目录",
      ),
    )
    .Decode((options) => ({
      image: options.image ?? "caddy:2.11.4-alpine",
      email: options.email,
      ports: {
        http: options.ports?.http ?? true,
        https: options.ports?.https ?? true,
        http3: options.ports?.http3 ?? options.ports?.https !== false,
      },
      logging: options.logging === undefined ? { level: "INFO" as const, format: "console" as const } : options.logging,
      config: options.config,
      extraEnvironment: options.extraEnvironment ?? {},
    }))
    .Encode((options) => options),

  assessChange: ({ nextOptions, changedPaths }) => {
    if (
      nextOptions.config.format !== "structured" &&
      changedPaths.some((path) => path === "config" || path.startsWith("config."))
    ) {
      return {
        risk: "unknown",
        reason: "原始 Caddy 配置的具体运行影响需要部署者判断",
      };
    }

    return undefined;
  },

  resources: ({ options, resource }) => {
    const quote = (value: string): string => JSON.stringify(value);
    const config = options.config;
    const globalLines =
      config.format !== "structured"
        ? []
        : [
            ...(options.email === undefined ||
            config.sites.every((site) => site.tls === "off" || site.tls === "internal")
              ? []
              : [`\temail ${quote(options.email)}`]),
            ...(options.logging === false
              ? []
              : [
                  "\tlog {",
                  "\t\toutput stdout",
                  `\t\tformat ${options.logging.format}`,
                  `\t\tlevel ${options.logging.level}`,
                  "\t}",
                ]),
          ];
    const content =
      config.format === "structured"
        ? `${[
            ...(globalLines.length === 0 ? [] : ["{", ...globalLines, "}", ""]),
            ...config.sites.flatMap((site) => {
              const addresses = site.addresses.map((address) =>
                site.tls === "off" && !address.startsWith("http://") ? `http://${address}` : address,
              );
              const routes = site.routes.flatMap((route) => {
                const paths = route.paths ?? [undefined];

                return paths.map((path) => {
                  const matcher = path === undefined ? "" : ` ${path}`;

                  if (route.kind === "reverseProxy") {
                    const optionsLines = [
                      ...(route.healthUri === undefined ? [] : [`\t\t\thealth_uri ${route.healthUri}`]),
                      ...(route.loadBalancing === undefined ? [] : [`\t\t\tlb_policy ${route.loadBalancing}`]),
                    ];

                    return optionsLines.length === 0
                      ? `\t\treverse_proxy${matcher} ${route.upstreams.join(" ")}`
                      : [`\t\treverse_proxy${matcher} ${route.upstreams.join(" ")} {`, ...optionsLines, "\t\t}"].join(
                          "\n",
                        );
                  }

                  if (route.kind === "redirect") {
                    return `\t\tredir${matcher} ${quote(route.to)} ${route.status ?? 308}`;
                  }

                  return `\t\trespond${matcher} ${quote(route.body ?? "")} ${route.status ?? 200}`;
                });
              });

              return [
                `${addresses.join(", ")} {`,
                ...(site.encode === undefined || site.encode === false ? [] : [`\tencode ${site.encode.join(" ")}`]),
                ...(site.tls === "internal" ? ["\ttls internal"] : []),
                "\troute {",
                ...routes,
                "\t}",
                "}",
                "",
              ];
            }),
          ]
            .join("\n")
            .trim()}\n`
        : `${config.content.trim()}\n`;
    const format = config.format === "structured" ? "caddyfile" : config.format;
    const adapterArguments = format === "caddyfile" ? ["--adapter", "caddyfile"] : [];
    const normalizePort = (
      value: boolean | number | { readonly port?: number; readonly address?: string },
      defaultPort: number,
    ) => ({
      host:
        value === false
          ? undefined
          : value === true
            ? defaultPort
            : typeof value === "number"
              ? value
              : (value.port ?? defaultPort),
      address: typeof value === "object" ? value.address : undefined,
    });
    const http = normalizePort(options.ports.http, 80);
    const https = normalizePort(options.ports.https, 443);

    return [
      resource.file("config-file", {
        content,
        mode: 0o600,
      }),
      resource.storage("data"),
      resource.storage("runtime-config", { backup: false }),
      resource.container("server", {
        image: options.image,
        command: [
          "sh",
          "-c",
          "if [ -f /config/caddy/autosave.json ]; then exec caddy run --resume; else exec caddy run; fi",
        ],
        environment: options.extraEnvironment,
        mounts: [
          {
            source: resource.storageRef("data"),
            target: "/data",
          },
          {
            source: resource.storageRef("runtime-config"),
            target: "/config",
          },
        ],
        ports: [
          { container: 80, host: http.host, address: http.address },
          { container: 443, host: https.host, address: https.address },
          ...(options.ports.http3
            ? [{ container: 443, host: https.host, address: https.address, protocol: "udp" as const }]
            : []),
        ],
        stopTimeout: 30,
        healthcheck: {
          command: "caddy version",
          interval: "10s",
          timeout: "5s",
          startPeriod: "5s",
          retries: 5,
        },
        startupTimeout: 60,
      }),
      resource.task("validate-config", {
        target: resource.containerRef("server"),
        command: "caddy",
        arguments: ["validate", "--config", "-", ...adapterArguments],
        stdin: content,
        run: "on-change",
        impact: "safe",
      }),
      resource.task("reload-config", {
        target: resource.containerRef("server"),
        command: "caddy",
        arguments: ["reload", "--config", "-", ...adapterArguments],
        stdin: content,
        run: "always",
        impact: "safe",
      }),
    ];
  },
});
