import { homedir } from "node:os";
import { resolve } from "node:path";
import { defineCommand } from "citty";

import { createOutput } from "../../output/output.instance";

const identifierPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/**
 * 初始化项目配置文件
 */
export const initCommand = defineCommand({
  meta: { name: "init", description: "创建 Cratenaut 项目配置" },
  args: {
    directory: {
      type: "string",
      alias: "d",
      description: "项目目录",
      default: ".",
    },
    project: {
      type: "string",
      alias: "p",
      description: "项目标识",
    },
    server: {
      type: "string",
      alias: "s",
      description: "初始服务器标识",
    },
    connection: {
      type: "enum",
      options: ["local", "ssh"],
      description: "服务器连接方式",
    },
    host: {
      type: "string",
      description: "SSH 主机",
    },
    user: {
      type: "string",
      description: "SSH 用户",
    },
    port: {
      type: "string",
      description: "SSH 端口",
      default: "22",
    },
    root: {
      type: "string",
      description: "服务器管理根目录",
    },
    global: {
      type: "boolean",
      alias: "g",
      description: "在 ~/.cratenaut 创建全局配置",
    },
    force: {
      type: "boolean",
      description: "覆盖现有配置文件",
    },
    json: { type: "boolean", description: "输出 JSON" },
    plain: { type: "boolean", description: "禁用交互和 ANSI 样式" },
  },
  run: async ({ args }) => {
    const output = createOutput(args);
    output.intro("初始化 Cratenaut 项目");
    const project =
      args.project ?? (output.mode === "interactive" ? await output.text("项目标识", "my-project") : undefined);

    if (project === undefined || project.length > 30 || !identifierPattern.test(project)) {
      throw new TypeError("项目标识必须使用小写字母、数字和连字符，以字母开头，且不超过 30 个字符");
    }

    const connection =
      args.connection ??
      (output.mode === "interactive"
        ? await output.select("服务器连接方式", [
            { value: "local", label: "本地服务器", hint: "在当前设备运行 Docker" },
            { value: "ssh", label: "远程服务器", hint: "通过 SSH 管理 Docker" },
          ])
        : "local");
    const server = args.server ?? (connection === "local" ? "local" : "production");

    if (server.length > 30 || !identifierPattern.test(server)) {
      throw new TypeError("服务器标识格式无效");
    }

    const host =
      connection === "ssh"
        ? (args.host ?? (output.mode === "interactive" ? await output.text("SSH 主机") : undefined))
        : undefined;

    if (connection === "ssh" && host === undefined) {
      throw new TypeError("SSH 连接必须提供 --host");
    }

    const port = Number(args.port);

    if (!Number.isInteger(port) || port < 1 || port > 65_535) {
      throw new TypeError("SSH 端口无效");
    }

    const target =
      args.global === true
        ? resolve(homedir(), ".cratenaut", "naut.config.ts")
        : resolve(args.directory, "naut.config.ts");

    if ((await Bun.file(target).exists()) && args.force !== true) {
      throw new TypeError(`配置文件已存在：${target}，确认覆盖时使用 --force`);
    }

    const connectionSource =
      connection === "local"
        ? '{ kind: "local" }'
        : `{
        kind: "ssh",
        host: ${JSON.stringify(host)},${args.user === undefined ? "" : `\n        user: ${JSON.stringify(args.user)},`}
        port: ${port},
      }`;
    const rootSource = args.root === undefined ? "" : `\n      root: ${JSON.stringify(args.root)},`;
    const source = `import { defineConfig } from "@cratenaut/core";

/**
 * ${project} 的 \`Cratenaut\` 部署配置
 */
export default defineConfig({
  project: ${JSON.stringify(project)},
  servers: [
    {
      id: ${JSON.stringify(server)},
      connection: ${connectionSource},${rootSource}
      crates: [],
    },
  ],
});
`;

    await Bun.write(target, source, { createPath: true });
    output.outro(`已创建 ${target}`);
  },
});
