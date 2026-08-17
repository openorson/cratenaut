import { caddy } from "@cratenaut/caddy";
import { defineConfig } from "@cratenaut/core";

const createWebsite = (message: string, port: number) =>
  caddy({
    id: "website",
    description: message,
    options: {
      ports: { http: port, https: false, http3: false },
      config: {
        format: "structured",
        sites: [
          {
            addresses: [`http://:${port}`],
            tls: "off",
            routes: [{ kind: "respond", body: `${message}\n` }],
          },
        ],
      },
    },
  });

export default defineConfig({
  project: "multi-server-example",
  servers: [
    {
      id: "local",
      description: "在当前计算机验证配置",
      connection: { kind: "local" },
      crates: [createWebsite("Local environment", 8080)],
    },
    {
      id: "production",
      description: "通过 SSH 管理的生产服务器",
      connection: {
        kind: "ssh",
        host: process.env.CRATENAUT_EXAMPLE_HOST ?? "server.example.com",
        user: process.env.CRATENAUT_EXAMPLE_USER ?? "deploy",
        identityFile: process.env.CRATENAUT_EXAMPLE_IDENTITY_FILE,
      },
      crates: [createWebsite("Production environment", 80)],
    },
  ],
});
