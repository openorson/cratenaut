import { caddy } from "@cratenaut/caddy";
import { defineConfig } from "@cratenaut/core";
import { gitea } from "@cratenaut/gitea";

const code = gitea({
  id: "code",
  description: "团队内部的 Git 代码托管服务",
  options: {
    publicUrl: "http://localhost:8080",
    registration: "closed",
    features: {
      lfs: true,
      actions: true,
      packages: true,
    },
    // `HTTP` 不直接发布到主机，只通过同一服务器网络中的 `Caddy` 访问
    http: false,
    ssh: false,
  },
});

const gateway = caddy({
  id: "gateway",
  description: "Gitea 的 Web 入口",
  options: {
    ports: { http: 8080, https: false, http3: false },
    config: {
      format: "structured",
      sites: [
        {
          addresses: ["http://localhost:8080"],
          tls: "off",
          routes: [
            {
              kind: "reverseProxy",
              // 同一服务器中的容器可以通过“实例标识-资源标识”互相访问
              upstreams: ["code-server:3000"],
              healthUri: "/api/healthz",
            },
          ],
        },
      ],
    },
  },
});

export default defineConfig({
  project: "gitea-example",
  servers: [
    {
      id: "local",
      connection: { kind: "local" },
      // 数组决定声明和处理顺序，但不表示两个实例之间存在依赖关系
      crates: [code, gateway],
    },
  ],
});
