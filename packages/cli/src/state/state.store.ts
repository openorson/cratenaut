import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

import type { IConnectionClient } from "../connection/connection.types";
import { diagnostics } from "../diagnostic/diagnostic.catalog";
import type { IServerLayout } from "../layout/layout.types";
import type { ICrateState, IDeploymentState, IResourceState, IStateStore } from "./state.types";

const resourceKinds: readonly string[] = Object.freeze(["storage", "directory", "file", "container", "task"]);

/**
 * 判断值是否为普通对象
 */
function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 读取状态中的必填字符串
 */
function requireString(record: Readonly<Record<string, unknown>>, key: string, subject: string): string {
  const value = record[key];

  if (typeof value !== "string" || value === "") {
    throw new TypeError(`${subject}的 ${key} 必须是非空字符串`);
  }

  return value;
}

/**
 * 读取状态中的可选字符串
 */
function optionalString(record: Readonly<Record<string, unknown>>, key: string, subject: string): string | undefined {
  const value = record[key];

  if (value !== undefined && typeof value !== "string") {
    throw new TypeError(`${subject}的 ${key} 必须是字符串`);
  }

  return value;
}

/**
 * 深度冻结从状态文件读取的配置快照
 */
function freezeSnapshot(value: unknown): unknown {
  if (Array.isArray(value)) {
    return Object.freeze(value.map(freezeSnapshot));
  }

  if (isRecord(value)) {
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, freezeSnapshot(child)])));
  }

  return value;
}

/**
 * 校验并冻结目标服务器的权威部署状态
 */
function normalizeDeploymentState(value: unknown, project: string, server: string): IDeploymentState {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.crates)) {
    throw new TypeError(`服务器“${server}”的部署状态格式无效`);
  }

  if (value.project !== project || value.server !== server) {
    throw new TypeError(`服务器“${server}”的部署状态归属不匹配`);
  }

  const crateIds = new Set<string>();
  const crates: ICrateState[] = value.crates.map((crateValue, crateIndex) => {
    const subject = `第 ${crateIndex + 1} 个 Crate 状态`;

    if (!isRecord(crateValue) || !Array.isArray(crateValue.resources)) {
      throw new TypeError(`${subject}格式无效`);
    }

    const id = requireString(crateValue, "id", subject);

    if (crateIds.has(id)) {
      throw new TypeError(`部署状态中存在重复的 Crate 标识“${id}”`);
    }

    crateIds.add(id);
    const resourceIds = new Set<string>();
    const resources: IResourceState[] = crateValue.resources.map((resourceValue, resourceIndex) => {
      const resourceSubject = `Crate“${id}”的第 ${resourceIndex + 1} 个资源状态`;

      if (!isRecord(resourceValue)) {
        throw new TypeError(`${resourceSubject}格式无效`);
      }

      const resourceId = requireString(resourceValue, "id", resourceSubject);
      const kind = requireString(resourceValue, "kind", resourceSubject);

      if (!resourceKinds.includes(kind)) {
        throw new TypeError(`${resourceSubject}的 kind 无效`);
      }

      if (resourceIds.has(resourceId)) {
        throw new TypeError(`Crate“${id}”的部署状态中存在重复资源标识“${resourceId}”`);
      }

      if (resourceValue.backup !== undefined && typeof resourceValue.backup !== "boolean") {
        throw new TypeError(`${resourceSubject}的 backup 必须是布尔值`);
      }

      resourceIds.add(resourceId);
      return Object.freeze({
        id: resourceId,
        kind,
        desiredHash: requireString(resourceValue, "desiredHash", resourceSubject),
        actualHash: requireString(resourceValue, "actualHash", resourceSubject),
        appliedAt: requireString(resourceValue, "appliedAt", resourceSubject),
        locator: optionalString(resourceValue, "locator", resourceSubject),
        imageDigest: optionalString(resourceValue, "imageDigest", resourceSubject),
        backup: resourceValue.backup as boolean | undefined,
      });
    });

    return Object.freeze({
      id,
      name: requireString(crateValue, "name", subject),
      version: requireString(crateValue, "version", subject),
      optionsSnapshot: freezeSnapshot(crateValue.optionsSnapshot),
      resources: Object.freeze(resources),
    });
  });

  return Object.freeze({
    schemaVersion: 1,
    deploymentId: requireString(value, "deploymentId", "部署状态"),
    project,
    server,
    updatedAt: requireString(value, "updatedAt", "部署状态"),
    crates: Object.freeze(crates),
  });
}

/**
 * 目标服务器为权威来源、本地目录为只读缓存的状态存储
 */
export class StateStore implements IStateStore {
  readonly #connection: IConnectionClient;
  readonly #layout: IServerLayout;
  readonly #cachePath: string;
  #fingerprintKey?: Uint8Array;

  public constructor(connection: IConnectionClient, layout: IServerLayout, informationDirectory: string) {
    this.#connection = connection;
    this.#layout = layout;
    this.#cachePath = resolve(informationDirectory, "cache", layout.project, layout.server, "state.json");
  }

  public async load(): Promise<IDeploymentState | undefined> {
    const content = await this.#connection.readText(this.#layout.currentState);

    if (content === undefined) {
      return undefined;
    }

    return normalizeDeploymentState(JSON.parse(content), this.#layout.project, this.#layout.server);
  }

  public async save(state: IDeploymentState): Promise<void> {
    const previous = await this.#connection.readText(this.#layout.currentState);

    await this.#connection.ensureDirectory(this.#layout.stateHistory);

    if (previous !== undefined) {
      const previousState = normalizeDeploymentState(JSON.parse(previous), this.#layout.project, this.#layout.server);
      await this.#connection.writeText(
        `${this.#layout.stateHistory}/${previousState.updatedAt.replaceAll(":", "-")}-${previousState.deploymentId}.json`,
        `${JSON.stringify(previousState, null, 2)}\n`,
      );
    }

    const serialized = `${JSON.stringify(state, null, 2)}\n`;
    await this.#connection.writeText(this.#layout.currentState, serialized);
    await Bun.write(this.#cachePath, serialized, { createPath: true }).catch(() => undefined);
  }

  public async getFingerprintKey(): Promise<Uint8Array> {
    if (this.#fingerprintKey !== undefined) {
      return new Uint8Array(this.#fingerprintKey);
    }

    const encoded = await this.#connection.readText(this.#layout.fingerprintKey);
    this.#fingerprintKey =
      encoded === undefined ? randomBytes(32) : Uint8Array.from(Buffer.from(encoded.trim(), "base64url"));
    return new Uint8Array(this.#fingerprintKey);
  }

  public async persistFingerprintKey(): Promise<void> {
    const key = await this.getFingerprintKey();

    if (!(await this.#connection.exists(this.#layout.fingerprintKey))) {
      await this.#connection.writeText(this.#layout.fingerprintKey, `${Buffer.from(key).toString("base64url")}\n`);
    }
  }

  public async acquireLock(force = false): Promise<void> {
    if (force) {
      await this.#connection.removeFile(`${this.#layout.deployLock}/owner.json`);
      await this.#connection.execute("rmdir", [this.#layout.deployLock], { allowFailure: true });
    }

    await this.#connection.ensureDirectory(this.#layout.locks);
    const result = await this.#connection.execute("mkdir", [this.#layout.deployLock], { allowFailure: true });

    if (result.code !== 0) {
      throw diagnostics.CRN_CLI_3001({ server: this.#layout.server });
    }

    try {
      await this.#connection.writeText(
        `${this.#layout.deployLock}/owner.json`,
        `${JSON.stringify({ pid: process.pid, host: Bun.env.HOSTNAME, createdAt: new Date().toISOString() })}\n`,
      );
    } catch (error) {
      await this.#connection.execute("rmdir", [this.#layout.deployLock], { allowFailure: true });
      throw error;
    }
  }

  public async releaseLock(): Promise<void> {
    await this.#connection.removeFile(`${this.#layout.deployLock}/owner.json`);
    await this.#connection.execute("rmdir", [this.#layout.deployLock], { allowFailure: true });
  }
}
