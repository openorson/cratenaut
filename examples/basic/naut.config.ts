import { caddy } from "@cratenaut/caddy";
import { defineConfig } from "@cratenaut/core";

/**
 * 创建一个名为 `web` 的 `Caddy` 部署实例
 *
 * `Crate` 是对一个可部署单元的定义，实例则表示它在某台服务器上的一次实际部署
 */
const web = caddy({
  id: "web",
  description: "返回欢迎页面的本地 Web 服务",
  options: {
    ports: {
      // 使用 8080 避免本地开发环境通常需要特权的 80 端口
      http: 8080,
      https: false,
      http3: false,
    },
    config: {
      format: "structured",
      sites: [
        {
          addresses: ["http://localhost:8080"],
          tls: "off",
          routes: [
            {
              kind: "respond",
              body: "Cratenaut is ready\n",
            },
          ],
        },
      ],
    },
  },
});

export default defineConfig({
  project: "basic",
  servers: [
    {
      id: "local",
      description: "运行 Docker 的当前计算机",
      connection: { kind: "local" },
      crates: [web],
    },
  ],
});
