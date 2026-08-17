# 快速开始

本指南会在当前计算机上部署一个 Caddy 容器。完成后，访问 `http://localhost:8080` 会看到 Cratenaut 返回的欢迎文本

## 前置条件

- Bun 1.3.14 或更高版本
- 正在运行的 Docker
- 能够拉取 `caddy:2.11.4-alpine` 镜像

## 使用示例项目

克隆仓库并进入最小示例：

```bash
git clone https://github.com/openorson/cratenaut.git
cd cratenaut/examples/basic
bun install
```

完整配置如下：

<<< ../../../examples/basic/naut.config.ts

## 检查环境

```bash
bunx naut doctor --all
```

`doctor` 会检查配置、Docker 和目标服务器是否满足部署条件，但不会修改服务器

## 查看计划

```bash
bun run plan
```

计划会说明即将创建的文件、持久化存储、容器和任务。第一次部署通常都是新增；再次运行且配置与服务器没有变化时，计划应当为空

## 执行部署

```bash
bun run deploy
```

部署完成后验证服务：

```bash
curl http://localhost:8080
```

预期输出：

```text
Cratenaut is ready
```

## 查看状态与停止服务

```bash
bun run status
bun run down
```

`down` 只停止已经部署的容器，不会删除持久化数据。以后可以使用 `naut up` 再次启动

## 接下来读什么

- [核心概念](./concepts)解释 `crate`、实例、资源和部署计划
- [配置项目与服务器](./configuration)介绍本地与 SSH 配置
- [官方 Crates](/crates/)提供可以直接安装的服务部署单元
- [自定义 Crate](/advanced/custom-crate)说明如何部署自己的应用
