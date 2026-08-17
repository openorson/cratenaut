import { defineConfig, secret } from "@cratenaut/core";
import { postgres } from "@cratenaut/postgres";
import { redis } from "@cratenaut/redis";

const database = postgres({
  id: "database",
  description: "应用使用的 PostgreSQL 数据库",
  options: {
    username: "example",
    database: "example",
    // 实际密码在命令执行时读取，不会进入配置文件或部署状态快照
    password: secret.env("POSTGRES_PASSWORD"),
    // 只允许当前计算机访问数据库端口
    publish: { port: 5432, address: "127.0.0.1" },
  },
});

const cache = redis({
  id: "cache",
  description: "应用使用的 Redis 缓存",
  options: {
    password: secret.env("REDIS_PASSWORD"),
    publish: { port: 6379, address: "127.0.0.1" },
    persistence: { mode: "aof", fsync: "everysec" },
  },
});

export default defineConfig({
  project: "database-example",
  servers: [
    {
      id: "local",
      connection: { kind: "local" },
      crates: [database, cache],
    },
  ],
});
