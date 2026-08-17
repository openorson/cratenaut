# Gitea

这个示例使用 Gitea 内置的 SQLite 数据库，并由 Caddy 提供统一入口

```bash
bun install
bun run plan
bun run deploy
```

部署完成后访问 <http://localhost:8080>

Gitea 和 Caddy 连接到同一个项目服务器网络。`code-server` 是由 Gitea 实例标识 `code` 和容器资源标识 `server` 组成的稳定网络别名
