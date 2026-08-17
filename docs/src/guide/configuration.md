# 配置项目与服务器

Cratenaut 默认只查找当前目录中的 `naut.config.ts`，不会向父目录逐级搜索。这样可以避免在错误的项目上执行部署命令

## 配置来源

配置路径有三种方式：

```bash
# 当前目录的 naut.config.ts
naut plan

# 明确指定文件
naut plan --config ./deploy/production.config.ts

# 使用用户级配置
naut plan --global
```

`--global` 或 `-g` 固定使用 `~/.cratenaut/naut.config.ts`

配置文件旁边的 `.cratenaut` 目录保存本地状态。使用全局配置时，配置路径和元数据路径分别是：

```text
~/.cratenaut/naut.config.ts
~/.cratenaut/.cratenaut/
```

## 最小配置

```ts
import { defineConfig } from "@cratenaut/core";

export default defineConfig({
  project: "my-project",
  servers: [
    {
      id: "local",
      connection: { kind: "local" },
      crates: [],
    },
  ],
});
```

`defineConfig` 会保留项目和服务器标识的字面量类型，使编辑器能够给出更准确的提示

## 本地服务器

```ts
{
  id: "local",
  description: "开发计算机",
  connection: { kind: "local" },
  crates: [website],
}
```

本地服务器默认把托管内容放到配置目录的 `.cratenaut/managed` 中

## SSH 服务器

```ts
{
  id: "production",
  description: "生产服务器",
  connection: {
    kind: "ssh",
    host: "server.example.com",
    user: "deploy",
    port: 22,
    identityFile: "/home/user/.ssh/id_ed25519",
    connectTimeout: 10,
  },
  crates: [website],
}
```

SSH 连接支持的字段：

| 字段             | 必需 | 默认值     | 说明             |
| ---------------- | ---- | ---------- | ---------------- |
| `host`           | 是   | —          | 主机名或 IP 地址 |
| `user`           | 否   | SSH 默认值 | 登录用户         |
| `port`           | 否   | `22`       | SSH 端口         |
| `identityFile`   | 否   | SSH 默认值 | 私钥文件路径     |
| `proxyJump`      | 否   | —          | 跳板机参数       |
| `connectTimeout` | 否   | `10`       | 连接超时秒数     |

远程服务器默认使用 `/var/lib/cratenaut` 作为管理根目录。可以通过服务器的 `root` 字段调整，但发布后不应随意修改

## 标识规则

项目、服务器、Crate 实例和资源标识会参与目录与容器名称生成，应使用简短、稳定且能说明用途的值：

```text
project: commerce
server: production
crate instance: database
resource: server
```

生成的容器名称是：

```text
cratenaut-commerce-production-database-server
```

不要把环境描述、镜像版本或日期放进标识。需要给维护者补充说明时使用可选的 `description`
