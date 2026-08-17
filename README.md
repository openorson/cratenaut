<p align="center">
  <img src="docs/src/public/logo.svg" width="132" alt="Cratenaut">
</p>

<h1 align="center">Cratenaut</h1>

<p align="center">用 TypeScript 定义，用计划审查，用信心部署</p>

Cratenaut 是面向本地与远程服务器的类型安全、可审查、幂等 Docker 部署工具。它使用 TypeScript 配置描述部署意图，在执行前对比配置、历史状态和服务器实际状态

## Crate 是什么

在 Cratenaut 中，`crate` 专指一个可复用的部署单元。它把一个服务所需的容器、配置文件、持久化数据、端口、健康检查和变更风险放在同一个定义中

例如 PostgreSQL Crate 不只是一个镜像名称，它也说明密码如何安全注入、数据保存在哪里、如何判断服务健康，以及哪些配置不能直接修改

Cratenaut 这个名称由 `crate` 与 `naut` 组合而来。`naut` 表示航行者：Cratenaut 负责让部署单元按照经过审查的计划抵达目标服务器

## 快速体验

```bash
git clone https://github.com/openorson/cratenaut.git
cd cratenaut/examples/basic
bun install
bun run plan
bun run deploy
curl http://localhost:8080
```

完整指南、官方 Crate 和 CLI 参考请访问 [Cratenaut 文档](https://openorson.github.io/cratenaut/)

## 当前官方 Crates

- Caddy
- Gitea
- PostgreSQL
- Redis

## 许可证

[MIT](LICENSE)
