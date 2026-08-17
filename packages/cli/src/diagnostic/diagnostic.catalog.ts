import { defineDiagnostics } from "nostics";

/**
 * `Cratenaut CLI` 稳定诊断目录
 */
export const diagnostics = defineDiagnostics({
  docsBase: () => "https://openorson.github.io/cratenaut/troubleshooting",
  codes: {
    CRN_CLI_1001: {
      why: (params: { path: string }) => `没有找到配置文件“${params.path}”`,
      fix: "创建 naut.config.ts，或使用 --config 指定配置文件",
    },
    CRN_CLI_1002: {
      why: (params: { path: string }) => `无法加载配置文件“${params.path}”`,
      fix: "检查配置文件默认导出、TypeScript 语法和配置字段",
    },
    CRN_CLI_1003: {
      why: (params: { subject: string; value: string }) => `找不到${params.subject}“${params.value}”`,
      fix: (params: { subject: string }) => `使用配置中存在的${params.subject}标识`,
    },
    CRN_CLI_1004: {
      why: "非交互模式缺少必要参数",
      fix: "提供对应参数，或在交互式终端中重新执行命令",
    },
    CRN_CLI_1005: {
      why: "--config 与 --global 不能同时使用",
      fix: "只保留其中一个配置来源参数",
    },
    CRN_CLI_2001: {
      why: (params: { server: string; detail: string }) => `无法连接服务器“${params.server}”：${params.detail}`,
      fix: "检查服务器地址、SSH 凭据和网络连通性",
    },
    CRN_CLI_2002: {
      why: (params: { server: string }) => `服务器“${params.server}”无法使用 Docker`,
      fix: "安装并启动 Docker，确保当前用户可以访问 Docker 守护进程",
    },
    CRN_CLI_3001: {
      why: (params: { server: string }) => `服务器“${params.server}”存在未释放的部署锁`,
      fix: "确认没有其他部署任务后，再使用 --force-unlock 清理锁",
    },
    CRN_CLI_3002: {
      why: (params: { risks: string }) => `部署计划包含尚未授权的风险：${params.risks}`,
      fix: "检查计划后提供对应的 --allow-* 参数，或修改配置",
    },
    CRN_CLI_3003: {
      why: (params: { resource: string }) => `资源“${params.resource}”的实际状态已偏离上次部署状态`,
      fix: "检查服务器上的手动变更，确认后使用 --overwrite-drift 覆盖",
    },
    CRN_CLI_3004: {
      why: (params: { server: string }) => `服务器“${params.server}”的部署状态在计划生成后已经变化`,
      fix: "重新执行命令以生成最新计划，不要复用旧计划",
    },
    CRN_CLI_4001: {
      why: (params: { command: string; code: number }) => `命令“${params.command}”执行失败，退出码为 ${params.code}`,
      fix: "查看标准错误输出并修复目标服务器环境",
    },
    CRN_CLI_5001: {
      why: "发现加密秘密，但没有可用的解密口令",
      fix: "设置 CRATENAUT_SECRET_KEY、使用 --secret-key-file，或在交互模式输入口令",
    },
    CRN_CLI_5002: {
      why: "秘密口令来源参数冲突",
      fix: "--secret-key-file、--secret-key-stdin 和 CRATENAUT_SECRET_KEY 只选择一种来源",
    },
    CRN_CLI_6001: {
      why: (params: { path: string }) => `技能目录“${params.path}”已经存在不同内容`,
      fix: "检查现有内容后使用 --force 更新，或在交互式终端中确认",
    },
    CRN_CLI_6002: {
      why: "--directory 与 --global 不能同时使用",
      fix: "项目级安装使用 --directory，用户级安装使用 --global",
    },
    CRN_CLI_9001: {
      why: "操作已由用户取消",
      docs: false,
    },
    CRN_CLI_9002: {
      why: (params: { detail: string }) => `发生未处理错误：${params.detail}`,
      fix: "使用 --verbose 重新执行并提交完整错误信息",
    },
  },
});
