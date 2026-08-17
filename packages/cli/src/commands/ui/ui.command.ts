import { defineCommand } from "citty";

import { createOutput } from "../../output/output.instance";

/**
 * 本地管理界面命令入口
 *
 * `Web UI` 属于后续阶段，本轮只锁定网络参数，避免提前形成不稳定协议
 */
export const uiCommand = defineCommand({
  meta: { name: "ui", description: "启动本地 Cratenaut Web UI" },
  args: {
    host: { type: "string", description: "监听地址", default: "127.0.0.1" },
    port: { type: "string", description: "监听端口", default: "4173" },
    open: { type: "boolean", description: "启动后打开浏览器" },
    json: { type: "boolean", description: "输出 JSON" },
    plain: { type: "boolean", description: "禁用交互和 ANSI 样式" },
  },
  run: ({ args }) => {
    createOutput(args).markdown(`## Web UI 尚未实现

计划监听 \`${args.host}:${args.port}\`，将在独立阶段实现只绑定本机、令牌鉴权和只读优先的管理服务`);
  },
});
