# 敏感信息

Cratenaut 使用不透明引用表示密码、令牌和密钥。配置可以说明敏感信息来自哪里，而不必把明文写入仓库

## 从环境变量读取

```ts
import { secret } from "@cratenaut/core";

const password = secret.env("POSTGRES_PASSWORD");
```

执行命令前设置环境变量：

```bash
export POSTGRES_PASSWORD='replace-with-a-strong-password'
naut plan --all
```

这是本地开发和 CI 中最常用的方式。CI 应使用平台提供的 Secret 存储注入环境变量

## 从文件读取

```ts
const password = secret.file("/run/secrets/postgres-password");
```

文件适合系统密钥目录、容器 Secret 挂载或由密码管理器临时创建的文件。限制文件权限为当前用户可读

## 直接值

```ts
const password = secret("development-only");
```

直接值仍会存在于配置源码中，只适合不敏感的测试数据。生产环境优先使用 `secret.env` 或 `secret.file`

## 加密秘密信封

CLI 可以使用 `scrypt` 派生密钥，并通过 `AES-256-GCM` 加密值：

```bash
printf '%s' "$SECRET_VALUE" | naut secret encrypt --from-stdin --key-file ./deploy.key --output ./secret.envelope
```

检查加密元数据不会输出明文：

```bash
naut secret inspect "$(< ./secret.envelope)"
```

部署时从文件或标准输入提供解密口令：

```bash
naut deploy --secret-key-file ./deploy.key --all
printf '%s' "$DEPLOY_KEY" | naut deploy --secret-key-stdin --all
```

不推荐把口令作为普通命令参数，因为它可能进入 Shell 历史和进程列表

::: warning 两种标准输入不能同时使用
如果敏感值和加密口令都需要从标准输入读取，应先把其中一个放入权限受限的临时文件，避免输入边界不明确
:::

## 不会保存什么

Cratenaut 的状态快照保存敏感信息引用和不可逆指纹，不保存解析后的明文。日志、计划和 `naut config show` 也会遮蔽敏感值

Crate 作者应当把敏感内容放入权限为 `0600` 的托管文件或容器环境变量，不应放进容器命令参数，因为命令参数可能出现在进程列表和诊断输出中
