# Database

这个示例部署 PostgreSQL 和 Redis，并演示如何从环境变量读取敏感配置

```bash
export POSTGRES_PASSWORD='replace-with-a-strong-password'
export REDIS_PASSWORD='replace-with-a-strong-password'
bun install
bun run plan
bun run deploy
```

两个端口都只监听 `127.0.0.1`，不会直接暴露给外部网络。PostgreSQL 和 Redis 的数据由 Cratenaut 放入各自实例的持久化目录
