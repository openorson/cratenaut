# 计划与部署

Cratenaut 的标准工作流是检查、计划、授权、部署和验证。即使配置很简单，也建议保留这个顺序

## 1. 校验配置

```bash
naut config validate
naut doctor --all
```

`config validate` 只负责加载和校验配置。`doctor` 还会连接所选服务器并检查 Docker、目录和运行条件

## 2. 明确选择范围

交互终端会优先提供服务器和 Crate 选择列表。自动化环境应通过参数明确范围：

```bash
naut plan --server production --crate database
naut plan --server staging,production --crate gateway
naut plan --all
```

`--all` 表示选择配置中的全部服务器和 Crate。它不会跳过风险授权

## 3. 阅读部署计划

```bash
naut plan --server production --all
```

重点检查：

- 命令选择的项目、服务器和实例是否正确
- 是否出现删除、重建或不可变字段变更
- 是否检测到服务器状态漂移
- Crate 是否发生主版本升级或降级
- 被移除的持久化存储是否仍然需要

## 4. 执行部署

```bash
naut deploy --server production --all
```

部署器只应用计划中真正需要执行的操作。相同配置重复执行应当得到空计划或无变更结果

`--yes` 只跳过普通确认，不会授权破坏性变更、未知风险、主版本升级、降级、漂移覆盖或资源清理

## 5. 验证结果

```bash
naut status --server production --all
naut logs --server production --crate gateway --follow
```

## 生命周期命令

已经部署的容器可以独立启动、停止和重启：

```bash
naut down --server production --crate worker
naut up --server production --crate worker
naut restart --server production --crate gateway
```

这些命令不重新解释配置变更，也不创建尚未部署的资源。配置发生变化时应重新执行 `plan` 和 `deploy`

## 在容器中执行命令

```bash
naut exec --server production --crate database --resource server -- psql --version
```

当程序参数也以 `-` 开头时，在命令前使用 `--`，防止它们被 CLI 当作 Cratenaut 参数
