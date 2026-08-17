import type { IMaterializedServer } from "@cratenaut/core/internal";
import { posix, resolve } from "node:path";

import type { ICrateLayout, IServerLayout } from "./layout.types";

/**
 * 解析服务器项目目录布局
 */
export function resolveServerLayout(
  project: string,
  server: IMaterializedServer,
  configDirectory: string,
): IServerLayout {
  const root =
    server.root ??
    (server.connection.kind === "local" ? resolve(configDirectory, ".cratenaut", "managed") : "/var/lib/cratenaut");
  const base = posix.join(root, "projects", project, "servers", server.id);
  const state = posix.join(base, "state");
  const locks = posix.join(base, "locks");
  const runtime = posix.join(base, "runtime");

  return Object.freeze({
    root,
    project,
    server: server.id,
    base,
    state,
    currentState: posix.join(state, "current.json"),
    stateHistory: posix.join(state, "history"),
    fingerprintKey: posix.join(state, "fingerprint.key"),
    journals: posix.join(base, "journals"),
    locks,
    deployLock: posix.join(locks, "deploy"),
    runtime,
    deployment: posix.join(runtime, "deployment"),
    backups: posix.join(base, "backups"),
    crates: posix.join(base, "crates"),
  });
}

/**
 * 解析单个 `Crate` 的固定目录布局
 */
export function resolveCrateLayout(server: IServerLayout, crateId: string): ICrateLayout {
  const base = posix.join(server.crates, crateId);
  return Object.freeze({
    base,
    data: posix.join(base, "data"),
    config: posix.join(base, "config"),
    cache: posix.join(base, "cache"),
    runtime: posix.join(base, "runtime"),
  });
}

/**
 * 创建托管容器名称
 */
export function createContainerName(project: string, server: string, crateId: string, resourceId: string): string {
  return `cratenaut-${project}-${server}-${crateId}-${resourceId}`;
}

/**
 * 创建托管网络名称
 */
export function createNetworkName(project: string, server: string): string {
  return `cratenaut-${project}-${server}`;
}

/**
 * 创建容器网络别名
 */
export function createNetworkAlias(crateId: string, resourceId: string): string {
  return `${crateId}-${resourceId}`;
}
