# 为 AI 助手安装 Cratenaut Skill

Cratenaut Skill 面向使用项目的用户和 AI 助手。它不会教 AI 修改 Cratenaut 源码，而是教它安全地编写配置、选择官方 Crate、审查计划和排查部署问题

## 安装

交互选择目标：

```bash
naut skill
```

明确指定目标：

```bash
naut skill --target codex
naut skill --target claude
naut skill --target cursor
```

默认安装到当前项目。添加 `--global` 或 `-g` 安装到用户级 Skill 目录：

```bash
naut skill --target codex --global
```

## 安装位置

| 目标   | 项目级                         | 用户级                           |
| ------ | ------------------------------ | -------------------------------- |
| Codex  | `.agents/skills/use-cratenaut` | `~/.agents/skills/use-cratenaut` |
| Claude | `.claude/skills/use-cratenaut` | `~/.claude/skills/use-cratenaut` |
| Cursor | `.cursor/skills/use-cratenaut` | `~/.cursor/skills/use-cratenaut` |

重复执行安装是幂等的。内容相同时不会改写；检测到已有不同内容时，交互模式会要求确认，自动化环境需要显式使用 `--force`

使用 `--dry-run` 可以只显示目标路径和预计动作

## 它能帮助什么

安装后可以向 AI 提出：

- “帮我在本地部署一个只监听 127.0.0.1 的 PostgreSQL”
- “把 Gitea 和 Caddy 配置到 production 服务器”
- “检查这次部署计划里有哪些会中断服务的变更”
- “为这个 Dockerfile 编写一个自定义 Crate”
- “查看 gateway 的最近 200 行日志”

Skill 会要求 AI 先检查项目与配置，再运行校验和计划，不会直接把所有动作合并成一条未经审查的部署命令

## 安全边界

AI 不应擅自使用：

- `--allow-destructive`
- `--allow-unknown-change`
- `--allow-major`
- `--allow-downgrade`
- `--overwrite-drift`
- `--prune`
- `--force-unlock`

当计划需要这些参数时，AI 应解释具体资源、原因和可能后果，并等待用户明确授权

AI 也不应把密码写入配置、聊天内容或命令参数。它应优先使用 `secret.env`、`secret.file`、CI Secret 或权限受限的口令文件

## 版本一致性

Skill 随 `@cratenaut/cli` 发布并从本地包安装，不会在运行时下载 GitHub 上的最新内容。因此 Skill 与当前 CLI 的命令和安全规则保持一致，也可以离线安装
