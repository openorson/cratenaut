# Caddy

`@cratenaut/caddy` 用于部署 Caddy Web 服务器。它支持易于校验的结构化站点配置，也允许高级用户直接提供 Caddyfile 或 JSON

## 安装

```bash
bun add @cratenaut/caddy
```

## 最小本地服务

```ts
import { caddy } from "@cratenaut/caddy";

const gateway = caddy({
  id: "gateway",
  options: {
    ports: { http: 8080, https: false, http3: false },
    config: {
      format: "structured",
      sites: [
        {
          addresses: ["http://localhost:8080"],
          tls: "off",
          routes: [{ kind: "respond", body: "Hello from Caddy\n" }],
        },
      ],
    },
  },
});
```

## 反向代理

同一服务器中，容器的稳定网络别名是 `Crate 实例标识-容器资源标识`

```ts
{
  addresses: ["git.example.com"],
  routes: [
    {
      kind: "reverseProxy",
      upstreams: ["code-server:3000"],
      healthUri: "/api/healthz",
      loadBalancing: "round_robin",
    },
  ],
}
```

## 顶层选项

| 选项               | 默认值                | 说明                                    |
| ------------------ | --------------------- | --------------------------------------- |
| `image`            | `caddy:2.11.4-alpine` | 自定义镜像，变更风险未知                |
| `email`            | —                     | 自动证书通知邮箱，仅用于结构化配置      |
| `ports.http`       | `true`                | `false`、主机端口或 `{ port, address }` |
| `ports.https`      | `true`                | `false`、主机端口或 `{ port, address }` |
| `ports.http3`      | 与 HTTPS 一致         | 是否发布 HTTPS 的 UDP 端口              |
| `logging`          | `INFO`、`console`     | `false` 或日志等级与格式                |
| `config`           | 必需                  | 结构化配置、Caddyfile 或 JSON           |
| `extraEnvironment` | `{}`                  | 额外环境变量，支持敏感信息引用          |

HTTP 和 HTTPS 端口可以写成：

```ts
ports: {
  http: { port: 8080, address: "127.0.0.1" },
  https: false,
  http3: false,
}
```

## 结构化站点

| 字段        | 必需 | 说明                             |
| ----------- | ---- | -------------------------------- |
| `addresses` | 是   | Caddy 站点地址数组               |
| `tls`       | 否   | `automatic`、`internal` 或 `off` |
| `encode`    | 否   | `false` 或 `zstd`、`gzip` 数组   |
| `routes`    | 是   | 至少一个路由                     |

支持三种路由：

- `reverseProxy`：上游数组，可选路径、健康检查地址和负载均衡策略
- `redirect`：目标地址和 `301`、`302`、`303`、`307`、`308` 状态码
- `respond`：直接返回文本与 `100` 到 `599` 的状态码

## 原始配置

```ts
config: {
  format: "caddyfile",
  content: `example.com {
    reverse_proxy code-server:3000
  }`,
}
```

原始 Caddyfile 和 JSON 的具体影响无法由 Cratenaut 完整理解。修改它们会被标记为未知风险；原始配置也不能同时使用结构化配置专用的 `email` 和 `logging`

## 数据与变更

Caddy Crate 管理：

- 配置文件
- 证书和应用数据存储
- Caddy 运行配置存储
- 配置验证任务
- 配置重载任务

结构化配置通常可以原地校验和重载。修改端口会重建容器；自定义镜像和额外环境变量属于未知风险
