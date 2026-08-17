# Gitea

`@cratenaut/gitea` 用于部署自托管 Git 服务。默认使用 SQLite、关闭注册，并且不直接向主机发布端口

## 安装

```bash
bun add @cratenaut/gitea
```

## 本地示例

<<< ../../../examples/gitea/naut.config.ts

## 顶层选项

| 选项               | 默认值                          | 说明                                     |
| ------------------ | ------------------------------- | ---------------------------------------- |
| `publicUrl`        | 必需                            | 用户访问 Gitea 的完整 HTTP 或 HTTPS 地址 |
| `image`            | `docker.gitea.com/gitea:1.27.2` | 自定义镜像属于未知风险                   |
| `database`         | `{ type: "sqlite" }`            | SQLite、PostgreSQL 或 MySQL              |
| `http`             | `false`                         | 是否直接发布 `3000` 端口                 |
| `ssh`              | `false`                         | 是否发布 Git SSH 服务                    |
| `registration`     | `closed`                        | `open`、`closed`、`manual` 或 `email`    |
| `mailer`           | `false`                         | SMTP 配置                                |
| `features`         | `{}`                            | LFS、Actions 和包注册表开关              |
| `uid`、`gid`       | `1000`                          | 容器内用户和用户组编号                   |
| `security`         | `{}`                            | SECRET_KEY 和 INTERNAL_TOKEN             |
| `configuration`    | `{}`                            | Gitea 原生分区配置                       |
| `extraEnvironment` | `{}`                            | 额外环境变量                             |

## 外部 PostgreSQL

```ts
database: {
  type: "postgres",
  host: "database-server",
  port: 5432,
  database: "gitea",
  username: "gitea",
  password: secret.env("GITEA_DATABASE_PASSWORD"),
  sslMode: "disable",
}
```

数据库类型是不可变选项。把现有 SQLite 部署改成 PostgreSQL 需要独立的数据迁移流程，不能只修改配置字段

MySQL 连接额外支持 `charset`，默认端口为 `3306`

## HTTP 与 SSH 发布

```ts
http: { port: 3000, address: "127.0.0.1" },
ssh: {
  publish: { port: 2222, address: "0.0.0.0" },
  domain: "git.example.com",
  advertisedPort: 2222,
},
```

如果由 Caddy 反向代理，通常保持 `http: false`，通过项目网络中的 `实例标识-server:3000` 访问

## 注册与邮件

`registration: "email"` 必须同时配置邮件服务：

```ts
mailer: {
  protocol: "smtp+starttls",
  host: "smtp.example.com",
  port: 587,
  from: "Gitea <git@example.com>",
  username: "git@example.com",
  password: secret.env("GITEA_SMTP_PASSWORD"),
}
```

## 安全密钥

```ts
security: {
  secretKey: secret.env("GITEA_SECRET_KEY"),
  internalToken: secret.env("GITEA_INTERNAL_TOKEN"),
}
```

这两个值一旦用于已有数据就不应修改。修改 `SECRET_KEY` 可能使已有加密数据无法解密，修改 `INTERNAL_TOKEN` 会使内部调用凭据失效

## 高级配置

`configuration` 对应 Gitea 原生配置分区：

```ts
configuration: {
  repository: {
    DEFAULT_PRIVATE: "private",
  },
}
```

Cratenaut 会拒绝覆盖它已经管理的数据库、服务器、注册、邮件和安全字段。其他原生字段的影响属于未知风险

## 数据与升级

所有仓库、SQLite 数据库、附件和应用数据位于实例的持久化存储中。升级镜像前应阅读 Gitea 发布说明并完成备份；自定义镜像的目录和升级兼容性由部署者负责判断
