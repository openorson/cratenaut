# CLI 命令

安装 CLI：

```bash
bun add --global @cratenaut/cli
naut --help
```

包同时提供 `naut` 和 `cratenaut` 两个可执行名称，文档统一使用更简短的 `naut`

## 命令概览

| 命令              | 作用                                     |
| ----------------- | ---------------------------------------- |
| `naut init`       | 创建项目配置                             |
| `naut config`     | 查看配置路径、校验配置或显示遮蔽后的配置 |
| `naut doctor`     | 检查 Docker、SSH 和部署环境              |
| `naut plan`       | 生成三方部署计划                         |
| `naut deploy`     | 审查并执行部署计划                       |
| `naut status`     | 查看托管容器状态                         |
| `naut up`         | 启动已经部署的容器                       |
| `naut down`       | 停止已经部署的容器                       |
| `naut restart`    | 重启已经部署的容器                       |
| `naut logs`       | 查看容器日志                             |
| `naut exec`       | 在容器中执行命令                         |
| `naut history`    | 查看部署历史                             |
| `naut render`     | 把计划渲染为 Markdown 或 JSON            |
| `naut secret`     | 加密、检查和解密秘密信封                 |
| `naut skill`      | 安装面向 AI 助手的操作 Skill             |
| `naut completion` | 生成 Shell 补全脚本                      |

`naut ui` 是为未来本地 Web UI 保留的命令入口，当前版本不会启动可用服务

## 共享选择与输出参数

配置型命令使用以下参数：

| 参数                       | 简写 | 说明                               |
| -------------------------- | ---- | ---------------------------------- |
| `--config <path>`          | —    | 明确指定配置文件                   |
| `--global`                 | `-g` | 使用 `~/.cratenaut/naut.config.ts` |
| `--server <id>`            | `-s` | 服务器标识，多个值用逗号分隔       |
| `--crate <id>`             | `-c` | Crate 实例标识，多个值用逗号分隔   |
| `--all`                    | `-a` | 选择全部服务器和 Crate             |
| `--yes`                    | `-y` | 跳过普通确认，不授权高风险变更     |
| `--json`                   | —    | 逐行输出 JSON 事件                 |
| `--plain`                  | —    | 禁用交互和 ANSI 样式               |
| `--verbose`                | `-v` | 输出详细错误堆栈                   |
| `--secret-key-file <path>` | —    | 从文件读取秘密解密口令             |
| `--secret-key-stdin`       | —    | 从标准输入读取秘密解密口令         |

提供某项参数后，CLI 会跳过对应交互问题。非交互环境应明确指定选择范围

## 安全授权参数

`plan`、`deploy` 和 `render` 支持：

| 参数                     | 授权内容                        |
| ------------------------ | ------------------------------- |
| `--allow-destructive`    | 破坏性配置或资源变更            |
| `--allow-unknown-change` | Crate 无法可靠判断影响的变更    |
| `--allow-major`          | 未声明兼容性的 Crate 主版本升级 |
| `--allow-downgrade`      | Crate 版本降级                  |
| `--overwrite-drift`      | 用当前配置覆盖服务器状态漂移    |
| `--prune`                | 清理配置中已经移除的托管资源    |

授权只确认风险，不会自动完成备份、数据迁移或兼容性修复

## `naut init`

```bash
naut init [--directory <path>] [--project <id>] [--server <id>]
```

专用选项：

- `--connection local|ssh`
- `--host`、`--user`、`--port`：SSH 连接
- `--root`：服务器管理根目录
- `--global`：在 `~/.cratenaut` 创建配置
- `--force`：覆盖已有配置文件

未提供的值会优先通过选择列表和交互输入获取

## `naut config`

```bash
naut config path
naut config validate
naut config show
```

`show` 会遮蔽敏感信息，不应用于获取解析后的秘密值

## `naut deploy`

除共享参数和安全参数外，还支持：

| 参数             | 说明                             |
| ---------------- | -------------------------------- |
| `--dry-run`      | 只显示计划，不执行               |
| `--force-unlock` | 确认没有其他部署后清理遗留部署锁 |

遗留锁可能表示另一个部署仍在运行。使用 `--force-unlock` 前应先检查目标服务器进程和部署日志

## `naut logs`

```bash
naut logs --server production --crate gateway --resource server --follow
```

| 参数              | 简写 | 默认值             |
| ----------------- | ---- | ------------------ |
| `--resource <id>` | `-r` | 交互选择或唯一容器 |
| `--follow`        | `-f` | `false`            |
| `--tail <lines>`  | `-n` | `100`              |
| `--since <time>`  | —    | —                  |
| `--until <time>`  | —    | —                  |
| `--timestamps`    | `-t` | `false`            |

资源可以写成 `server` 或 `crate-id/resource-id`

## `naut exec`

```bash
naut exec --crate database --resource server -- psql --version
```

专用选项：`--interactive`、`--tty`、`--user`、`--workdir` 和 `--resource`

## 生命周期与历史

- `naut down --timeout 30` 设置停止超时
- `naut restart --timeout 30` 设置停止超时
- `naut history --limit 20` 限制历史数量
- `naut render --format markdown|json` 渲染计划说明

## `naut secret`

安全地从标准输入加密：

```bash
printf '%s' "$VALUE" | naut secret encrypt --from-stdin --key-file ./key --output ./value.envelope
```

`encrypt` 也支持 `--value`，但该值可能进入 Shell 历史，因此不推荐用于生产秘密

```bash
naut secret inspect '<envelope>'
naut secret decrypt '<envelope>' --key-file ./key --output ./plaintext
```

解密命令强制写入文件，不向终端输出明文

## 自动化输出

`--json` 使用逐行 JSON 事件，适合 CI 和其他程序消费。`--plain` 保留人类可读文本但关闭交互和 ANSI 样式

自动化部署至少应明确提供配置路径或全局模式、服务器范围、Crate 范围以及需要的风险授权。不要用 `--yes` 代替这些参数

## Shell 补全

```bash
naut completion bash
naut completion zsh
naut completion fish
```

具体安装位置取决于当前 Shell。可以把输出保存到用户补全目录并在 Shell 配置中加载
