/**
 * 所有配置型命令共享的参数
 */
export const commonArguments = {
  config: {
    type: "string" as const,
    description: "配置文件路径",
    valueHint: "path",
  },
  global: {
    type: "boolean" as const,
    alias: "g",
    description: "使用 ~/.cratenaut/naut.config.ts",
  },
  server: {
    type: "string" as const,
    alias: "s",
    description: "服务器标识，多个值使用逗号分隔",
    valueHint: "id",
  },
  crate: {
    type: "string" as const,
    alias: "c",
    description: "Crate 实例标识，多个值使用逗号分隔",
    valueHint: "id",
  },
  all: {
    type: "boolean" as const,
    alias: "a",
    description: "选择全部服务器和 Crate",
  },
  yes: {
    type: "boolean" as const,
    alias: "y",
    description: "跳过普通确认，不授权高风险变更",
  },
  json: {
    type: "boolean" as const,
    description: "逐行输出 JSON 事件",
  },
  plain: {
    type: "boolean" as const,
    description: "禁用交互和 ANSI 样式",
  },
  verbose: {
    type: "boolean" as const,
    alias: "v",
    description: "输出详细错误堆栈",
  },
  "secret-key-file": {
    type: "string" as const,
    description: "从文件读取秘密解密口令",
    valueHint: "path",
  },
  "secret-key-stdin": {
    type: "boolean" as const,
    description: "从标准输入读取秘密解密口令",
  },
};

/**
 * 部署安全参数
 */
export const safetyArguments = {
  "allow-destructive": {
    type: "boolean" as const,
    description: "允许破坏性变更",
  },
  "allow-unknown-change": {
    type: "boolean" as const,
    description: "允许风险未知的配置变更",
  },
  "allow-major": {
    type: "boolean" as const,
    description: "允许未声明兼容性的主版本升级",
  },
  "allow-downgrade": {
    type: "boolean" as const,
    description: "允许 Crate 版本降级",
  },
  "overwrite-drift": {
    type: "boolean" as const,
    description: "允许覆盖服务器上的状态漂移",
  },
  prune: {
    type: "boolean" as const,
    description: "移除配置中已删除的托管资源",
  },
};
