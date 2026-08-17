# 官方 Crates

官方 Crate 把常用服务的 Docker 镜像、配置文件、数据目录、健康检查和变更风险整理成可以直接使用的部署单元

安装需要的包，而不是安装一个包含全部服务的集合：

```bash
bun add @cratenaut/caddy
bun add @cratenaut/postgres
```

| Crate                    | 用途                              | 默认镜像                        |
| ------------------------ | --------------------------------- | ------------------------------- |
| [Caddy](./caddy)         | Web 服务、TLS、反向代理和静态响应 | `caddy:2.11.4-alpine`           |
| [Gitea](./gitea)         | Git 代码托管、包注册表和 Actions  | `docker.gitea.com/gitea:1.27.2` |
| [PostgreSQL](./postgres) | 关系型数据库                      | `postgres:18.6-alpine`          |
| [Redis](./redis)         | 缓存、队列和内存数据服务          | `redis:8.10.0-alpine`           |

## 默认值的原则

官方 Crate 会为镜像、端口和常见运行参数提供可用默认值，同时保持以下边界：

- 数据服务默认不向主机发布端口
- Gitea 默认不开放注册，也不发布 HTTP 或 SSH 端口
- Caddy 默认发布 HTTP、HTTPS 和 HTTP/3，因此本地示例会显式改用 `8080`
- 自定义镜像和原生高级配置通常标记为未知风险
- 只在空数据目录生效的初始化字段标记为不可变

## 实例标识不是服务类型

实例标识应表达这个部署的用途，而不是机械重复 Crate 名称：

```ts
const primaryDatabase = postgres({
  id: "primary-database",
  description: "订单和用户主数据库",
  options: {
    password: secret.env("POSTGRES_PASSWORD"),
  },
});
```

同一服务器可以部署多个 PostgreSQL 实例，只要实例标识不同

## 备份能力

官方备份 Crate 仍在设计中，当前不会作为可用能力发布。在上线数据库或 Gitea 前，应当为 Cratenaut 管理目录建立独立、经过恢复演练的备份方案
