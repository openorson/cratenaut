# Redis

`@cratenaut/redis` 部署 Redis，并管理配置文件、密码文件、健康检查和可选持久化存储。默认不向主机发布端口

## 安装

```bash
bun add @cratenaut/redis
```

## 最小实例

Redis 的选项可以全部省略：

```ts
import { redis } from "@cratenaut/redis";

const cache = redis({
  id: "cache",
  description: "应用缓存",
});
```

默认使用 RDB 持久化。同一服务器上的其他容器可以通过 `cache-server:6379` 访问

## 选项

| 选项               | 默认值                | 说明                             |
| ------------------ | --------------------- | -------------------------------- |
| `image`            | `redis:8.10.0-alpine` | Redis 镜像                       |
| `password`         | —                     | 访问密码，支持敏感信息引用       |
| `publish`          | `false`               | 是否向主机发布 `6379`            |
| `persistence`      | `{ mode: "rdb" }`     | `false`、RDB、AOF 或两者同时启用 |
| `databases`        | `16`                  | 逻辑数据库数量                   |
| `memory`           | —                     | 最大内存和淘汰策略               |
| `configuration`    | `{}`                  | Redis 原生配置                   |
| `extraEnvironment` | `{}`                  | 额外环境变量                     |

向主机发布端口时必须设置密码：

```ts
options: {
  password: secret.env("REDIS_PASSWORD"),
  publish: { port: 6379, address: "127.0.0.1" },
}
```

## 持久化

RDB：

```ts
persistence: {
  mode: "rdb",
  save: [
    { seconds: 3600, changes: 1 },
    { seconds: 60, changes: 1000 },
  ],
}
```

AOF：

```ts
persistence: {
  mode: "aof",
  fsync: "everysec",
}
```

同时启用：

```ts
persistence: {
  mode: "both",
  fsync: "everysec",
}
```

把已有实例的持久化改为 `false` 会移除托管数据存储，属于破坏性变更

## 内存策略

```ts
memory: {
  max: "512mb",
  policy: "allkeys-lru",
}
```

淘汰策略支持 `noeviction`、`allkeys-lru`、`allkeys-lfu`、`allkeys-random` 以及对应的 `volatile` 策略

## 原生配置

```ts
configuration: {
  timeout: 300,
  "tcp-keepalive": 60,
}
```

Cratenaut 会拒绝通过原生配置覆盖端口、绑定地址、密码、持久化、数据库数量、内存和数据目录等托管字段。其余原生指令被标记为未知风险
