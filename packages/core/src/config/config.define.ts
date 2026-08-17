import { posix } from "node:path";

import { getCrateRuntimeState } from "../crate/crate.internal";
import type { ICrateInstance } from "../crate/crate.types";
import { validateDescription, validateIdentifier } from "../identifier/identifier.validate";
import type { IConfig, IConfigDefinition, IDefineConfig, IServerDefinition } from "./config.types";

/**
 * 冻结服务器连接配置
 */
function freezeConnection(server: IServerDefinition): IServerDefinition["connection"] {
  if (
    typeof server.connection !== "object" ||
    server.connection === null ||
    !["local", "ssh"].includes(server.connection.kind)
  ) {
    throw new TypeError(`服务器“${server.id}”的连接配置无效`);
  }

  if (server.connection.kind === "local") {
    return Object.freeze({ kind: "local" });
  }

  if (typeof server.connection.host !== "string" || server.connection.host.trim().length === 0) {
    throw new TypeError(`服务器“${server.id}”的 SSH 主机不能为空`);
  }

  for (const [name, value] of [
    ["用户", server.connection.user],
    ["私钥路径", server.connection.identityFile],
    ["跳板机", server.connection.proxyJump],
  ] as const) {
    if (value !== undefined && (typeof value !== "string" || value.trim().length === 0)) {
      throw new TypeError(`服务器“${server.id}”的 SSH ${name}不能为空`);
    }
  }

  if (
    server.connection.port !== undefined &&
    (!Number.isInteger(server.connection.port) || server.connection.port < 1 || server.connection.port > 65_535)
  ) {
    throw new TypeError(`服务器“${server.id}”的 SSH 端口无效`);
  }

  if (
    server.connection.connectTimeout !== undefined &&
    (!Number.isInteger(server.connection.connectTimeout) || server.connection.connectTimeout <= 0)
  ) {
    throw new TypeError(`服务器“${server.id}”的 SSH 连接超时必须大于 0`);
  }

  return Object.freeze({ ...server.connection });
}

/**
 * 冻结并校验服务器定义
 */
function freezeServer<Server extends IServerDefinition>(server: Server): Server {
  if (typeof server !== "object" || server === null) {
    throw new TypeError("服务器定义必须是对象");
  }

  validateIdentifier(server.id, "服务器标识");
  const description = validateDescription(server.description, `服务器“${server.id}”的描述`);

  if (
    server.root !== undefined &&
    (typeof server.root !== "string" ||
      !server.root.startsWith("/") ||
      server.root.includes("\0") ||
      server.root.includes("\n") ||
      server.root.includes("\r") ||
      posix.normalize(server.root) !== server.root)
  ) {
    throw new TypeError(`服务器“${server.id}”的管理根目录必须是规范绝对路径`);
  }

  if (!Array.isArray(server.crates)) {
    throw new TypeError(`服务器“${server.id}”的 crates 必须是数组`);
  }

  const crateIds = new Set<string>();

  for (const crate of server.crates) {
    getCrateRuntimeState(crate);

    if (crateIds.has(crate.id)) {
      throw new TypeError(`服务器“${server.id}”中存在重复的 Crate 实例标识“${crate.id}”`);
    }

    crateIds.add(crate.id);
  }

  return Object.freeze({
    ...server,
    description,
    connection: freezeConnection(server),
    crates: Object.freeze([...server.crates]) as readonly ICrateInstance[],
  }) as Server;
}

/**
 * 创建 `Cratenaut` 配置
 */
function defineConfigImplementation<
  const Project extends string = string,
  const Servers extends readonly IServerDefinition[] = readonly IServerDefinition[],
>(definition: IConfigDefinition<Project, Servers>): IConfig<{ project: Project; servers: Servers }> {
  validateIdentifier(definition.project, "项目标识");

  if (!Array.isArray(definition.servers) || definition.servers.length === 0) {
    throw new TypeError("Cratenaut 配置的 servers 必须是非空数组");
  }

  const serverIds = new Set<string>();
  const servers = definition.servers.map((server) => {
    if (serverIds.has(server.id)) {
      throw new TypeError(`Cratenaut 配置中存在重复的服务器标识“${server.id}”`);
    }

    serverIds.add(server.id);
    return freezeServer(server);
  });

  return Object.freeze({
    project: definition.project,
    servers: Object.freeze(servers) as unknown as Servers,
  });
}

export const defineConfig: IDefineConfig = defineConfigImplementation;
