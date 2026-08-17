# PostgreSQL

`@cratenaut/postgres` 部署带持久化数据、健康检查和安全密码文件的 PostgreSQL 实例。数据库端口默认不向主机发布

## 安装

```bash
bun add @cratenaut/postgres
```

## 推荐配置

```ts
import { secret } from "@cratenaut/core";
import { postgres } from "@cratenaut/postgres";

const database = postgres({
  id: "database",
  description: "业务主数据库",
  options: {
    username: "app",
    database: "app",
    password: secret.env("POSTGRES_PASSWORD"),
  },
});
```

同一服务器上的其他容器通过 `database-server:5432` 访问，不需要发布主机端口

## 选项

| 选项               | 默认值                 | 说明                                 |
| ------------------ | ---------------------- | ------------------------------------ |
| `image`            | `postgres:18.6-alpine` | PostgreSQL 镜像                      |
| `username`         | `postgres`             | 初始用户，仅空数据目录生效           |
| `password`         | 必需                   | 初始密码，支持敏感信息引用           |
| `database`         | `postgres`             | 初始数据库，仅空数据目录生效         |
| `publish`          | `false`                | 是否向主机发布 `5432`                |
| `sharedMemory`     | `128m`                 | 容器共享内存大小                     |
| `initialization`   | —                      | 初始化编码、区域、校验和、参数和 SQL |
| `parameters`       | `{}`                   | PostgreSQL 原生服务器参数            |
| `extraEnvironment` | `{}`                   | 额外环境变量                         |

开发时需要从主机连接，可以只监听回环地址：

```ts
publish: { port: 5432, address: "127.0.0.1" }
```

## 初始化

```ts
initialization: {
  encoding: "UTF8",
  locale: "C.UTF-8",
  dataChecksums: true,
  scripts: [
    {
      name: "001-schema.sql",
      content: "CREATE TABLE example (id bigint PRIMARY KEY);",
    },
  ],
}
```

初始化设置和脚本只在数据目录为空时执行。修改配置不会让 PostgreSQL 在已有数据库上重新运行脚本，数据库迁移应由应用自己的迁移工具完成

## 原生参数

```ts
parameters: {
  max_connections: 200,
  "log_min_duration_statement": 500,
}
```

原生参数的具体影响无法统一判断，因此被标记为未知风险。Cratenaut 会拒绝覆盖 `data_directory`、`config_file`、`hba_file`、`ident_file` 和 `port`

## 密码轮换

镜像的 `POSTGRES_PASSWORD_FILE` 只负责空数据目录初始化。修改配置里的密码引用不会自动修改已有数据库用户密码

轮换密码时应先在数据库中执行 `ALTER ROLE`，再同步更新应用和 Cratenaut 配置。由于无法安全自动完成这一过程，密码选项被标记为不可变

## 主版本升级

直接把 `postgres:17` 改成 `postgres:18` 不能完成数据格式升级。Cratenaut 会把官方 PostgreSQL 镜像的跨主版本修改标记为破坏性变更

应先选择 `pg_upgrade`、逻辑复制或导出导入等升级方案，验证备份可恢复后再调整部署配置
